# this fetches all deps from project and fetches them from remote repo if they exist. After fetching includes them as .xcf to project
require 'fileutils'
require 'thread'

module Pod
  class Installer
    alias_method :original_install!, :install!

    attr_reader :included_xcframeworks

    def install!
      original_install!
      @included_xcframeworks = []
      include_xcframeworks_from_repository
      exclude_xcframeworks_from_build if @included_xcframeworks.any?
    end

    private

    def include_xcframeworks_from_repository
      main_target = pods_project.targets.find { |t| t.name.start_with?('Pods-') }
      return unless main_target

      config = XCFRepoConfig.new(sandbox, pod_targets, pods_project)
      return if config.dependencies.empty?

      print_header(config.rn_version)
      available_xcfs = find_available_xcframeworks(config)
      download_and_include(available_xcfs, config) if available_xcfs.any?
      print_footer(available_xcfs.count, config.dependencies.count)
    end

    def exclude_xcframeworks_from_build
      puts "\nExcluding #{@included_xcframeworks.count} pods from source build...\n"

      excluded_count = 0

      @included_xcframeworks.each do |pod_name|
        target = pod_targets.find { |t| t.name == pod_name }
        next unless target

        if remove_pod_from_build(target)
          puts "  ✓ [EXCLUDED] #{pod_name}"
          excluded_count += 1
        else
          puts "  ✗ [SKIP] #{pod_name}"
        end
      end

      puts "\nSuccessfully excluded #{excluded_count} pods from compilation"
    end

    def remove_pod_from_build(target)
      native_target = pods_project.targets.find { |t| t.name == target.name }
      return false unless native_target

      native_target.build_phases.each do |phase|
        if phase.is_a?(Xcodeproj::Project::Object::PBXSourcesBuildPhase)
          phase.clear
        end
      end

      native_target.build_configurations.each do |config|
        config.build_settings['SKIP_INSTALL'] = 'YES'
        config.build_settings['EXCLUDED_SOURCE_FILE_NAMES'] = ['**/*']
        config.build_settings['OTHER_LDFLAGS'] = ''
      end

      pods_project.save

      true
    end

    def find_available_xcframeworks(config)
      available = []
      mutex = Mutex.new

      threads = config.dependencies.map do |dep|
        Thread.new do
          pod_target = pod_targets.find { |pod| pod.name == dep }
          next unless pod_target

          version = pod_target&.root_spec&.version&.to_s
          next if version.nil? || version == 'unknown'

          xcf_url = build_xcf_url(config, dep, version)
          if xcf_exists?(xcf_url)
            mutex.synchronize { available << XCFInfo.new(dep, version, xcf_url) }
            puts "  ✓ [FOUND] #{dep} (#{version})"
          else
            puts "  ✗ [MISSING] #{dep} (#{version})"
          end
        end
      end

      threads.each(&:join)
      available
    end

    def download_and_include(available_xcfs, config)
      puts "\nDownloading #{available_xcfs.length} XCFrameworks (#{available_xcfs.length} queued, max 4 parallel)...\n"

      downloaded = {}
      mutex = Mutex.new
      unzip_mutex = Mutex.new
      queue = Queue.new
      available_xcfs.each { |xcf| queue << xcf }

      completed = 0
      total = available_xcfs.length

      max_parallel = 4
      threads = max_parallel.times.map do |thread_id|
        Thread.new do
          debug_log "[Thread #{thread_id}] Started"
          while !queue.empty?
            xcf_info = nil
            begin
              xcf_info = queue.pop(true)
              debug_log "[Thread #{thread_id}] Processing #{xcf_info.name} (#{queue.size} remaining)"
            rescue ThreadError
              debug_log "[Thread #{thread_id}] Queue empty, exiting"
              break
            end

            local_path = download_xcframework(xcf_info, config, unzip_mutex)

            mutex.synchronize do
              completed += 1
              if local_path
                downloaded[xcf_info] = local_path
                debug_log "[Progress] #{completed}/#{total} completed"
              else
                puts "  ✗ [DOWNLOAD FAILED] #{xcf_info.name} (#{xcf_info.version})"
              end
            end
          end
          debug_log "[Thread #{thread_id}] Finished"
        end
      end

      debug_log "Waiting for all download threads to complete..."
      threads.each(&:join)
      debug_log "All download threads completed"

      puts "\nIncluding #{downloaded.count} XCFrameworks in project...\n"

      downloaded.each do |xcf_info, local_path|
        if include_in_project(local_path, config)
          @included_xcframeworks << xcf_info.name
          puts "  ✓ [INCLUDED] #{xcf_info.name} (#{xcf_info.version})"
        else
          puts "  ✗ [FAILED] #{xcf_info.name} (#{xcf_info.version})"
        end
      end
    end

    def download_xcframework(xcf_info, config, unzip_mutex)
      local_name = "#{xcf_info.name}-#{xcf_info.version}-rn#{config.rn_version}.xcframework"
      local_path = File.join(config.cache_dir, local_name)

      if File.exist?(local_path) && verify_xcframework_structure(local_path)
        puts "    Using cached: #{File.basename(local_path)}"
        return local_path
      end

      puts "  [DOWNLOAD] #{xcf_info.name} (#{xcf_info.version})"
      temp_zip = File.join(config.cache_dir, "#{local_name}.zip")

      debug_log "[CURL] Starting download: #{xcf_info.url}"
      result = system("curl -f -L -s -S '#{xcf_info.url}' -o '#{temp_zip}'")
      unless result && File.exist?(temp_zip) && File.size(temp_zip) > 0
        debug_log "[CURL] Failed to download from #{xcf_info.url}"
        FileUtils.rm_f(temp_zip)
        return nil
      end
      debug_log "[CURL] Downloaded #{File.size(temp_zip)} bytes"

      unzip_mutex.synchronize do
        debug_log "[UNZIP] Acquired lock, extracting #{File.basename(temp_zip)}"

        unzip_success = system('unzip', '-q', '-o', temp_zip, '-d', config.cache_dir,
                              out: File::NULL, err: File::NULL)

        debug_log "[UNZIP] Cleanup zip file"
        FileUtils.rm_f(temp_zip)

        unless unzip_success
          debug_log "[UNZIP] Failed to extract, exit status: #{$?.exitstatus}"
          return nil
        end
        debug_log "[UNZIP] Extraction complete"

        extracted_path = File.join(config.cache_dir, "#{xcf_info.name}.xcframework")
        if File.exist?(extracted_path) && extracted_path != local_path
          debug_log "[RENAME] #{File.basename(extracted_path)} -> #{File.basename(local_path)}"
          FileUtils.rm_rf(local_path) if File.exist?(local_path)
          FileUtils.mv(extracted_path, local_path)
        end

        debug_log "[UNZIP] Released lock"
      end

      if File.exist?(local_path) && verify_xcframework_structure(local_path)
        debug_log "[VERIFY] Success: #{File.basename(local_path)}"
        local_path
      else
        debug_log "[VERIFY] Failed for #{local_path}"
        debug_log "Contents: #{`ls -la '#{local_path}' 2>&1`}" if File.exist?(local_path)
        nil
      end
    end

    def include_in_project(xcf_path, config)
      project_path = find_xcodeproj(config.ios_path)
      unless project_path
        debug_log "No Xcode project found in #{config.ios_path}"
        return false
      end

      script_path = File.join(config.buildle_root, 'ios-resources/scripts/include-xcframework.rb')
      cmd = "ruby '#{script_path}' -p '#{project_path}' -f '#{xcf_path}' 2>&1"

      debug_log "Running: #{cmd}"
      output = `#{cmd}`
      result = $?.success?

      unless result
        debug_log "Failed to include XCFramework:"
        debug_log output
      end

      result
    end

    def verify_xcframework_structure(xcf_path)
      return false unless File.directory?(xcf_path)

      info_plist = File.join(xcf_path, 'Info.plist')
      if File.exist?(info_plist)
        true
      else
        debug_log "Missing Info.plist at #{info_plist}"
        false
      end
    end

    def find_xcodeproj(ios_path)
      projects = Dir.glob(File.join(ios_path, '*.xcodeproj'))
      projects.first
    end

    def build_xcf_url(config, name, version)
      group_path = config.group_id.gsub('.', '/')
      xcf_version = "#{version}-rn#{config.rn_version}"
      "#{config.repo_url}/#{group_path}/#{name}/#{xcf_version}/#{name}-#{xcf_version}.xcframework"
    end

    def xcf_exists?(url)
      `curl -s -o /dev/null -w "%{http_code}" -I "#{url}" 2>/dev/null`.strip == "200"
    end

    def print_header(rn_version)
      puts "\n" + "="*80
      puts "INCLUDE XCFRAMEWORKS FROM REPOSITORY"
      puts "="*80
      puts "React Native: #{rn_version}"
      puts "-"*80
      puts "\nChecking available XCFrameworks...\n"
    end

    def print_footer(included_count, total_count)
      puts "\n" + "="*80
      puts "Included: #{included_count}/#{total_count} pods"
      puts "="*80 + "\n"
    end

    def debug_log(message)
      puts "    #{message}" if ENV['DEBUG']
    end

    XCFInfo = Struct.new(:name, :version, :url)

    class XCFRepoConfig
      attr_reader :dependencies, :rn_version, :ios_path, :buildle_root,
                  :repo_url, :group_id, :cache_dir

      def initialize(sandbox, pod_targets, pods_project)
        @dependencies = extract_dependencies(pods_project)
        @rn_version = extract_rn_version(pod_targets)
        @ios_path = sandbox.root.parent
        @buildle_root = File.expand_path('../../../', __FILE__)
        @repo_url = ENV['REPOSILITE_URL'] || 'https://repo.swmtest.xyz/releases'
        @group_id = ENV['REPOSILITE_GROUP'] || 'com.swmansion.buildle'
        @cache_dir = File.join(@buildle_root, '.xcframeworks-cache')

        FileUtils.mkdir_p(@cache_dir)
      end

      private

      def extract_dependencies(pods_project)
        target = pods_project.targets.find { |t| t.name.start_with?('Pods-') }
        target ? target.dependencies.map(&:name).sort : []
      end

      def extract_rn_version(pod_targets)
        react_core = pod_targets.find { |pod| pod.name == 'React-Core' }
        react_core&.root_spec&.version&.to_s || 'unknown'
      end
    end
  end
end
