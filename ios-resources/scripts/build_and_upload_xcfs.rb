
require 'thread'

module Pod
  class Installer
    alias_method :original_install!, :install!

    def install!
      original_install!
      build_and_upload_xcframeworks
    end

    private

    def build_and_upload_xcframeworks
      main_target = pods_project.targets.find { |t| t.name.start_with?('Pods-') }
      return unless main_target

      config = BuildConfig.new(sandbox, pod_targets)
      return if config.dependencies.empty?

      print_header(config.rn_version)
      to_build = find_missing_xcframeworks(config)
      build_and_upload(to_build, config) if to_build.any?
      print_footer(config.dependencies.count)
    end

    def find_missing_xcframeworks(config)
      to_build = []
      mutex = Mutex.new

      threads = config.dependencies.map do |dep|
        Thread.new do
          pod_target = pod_targets.find { |pod| pod.name == dep }
          next unless pod_target

          version = pod_target&.root_spec&.version&.to_s
          next if version.nil? || version == 'unknown'

          if xcf_exists?(config, dep, version)
            puts "  ✓ [SKIP] #{dep} (#{version})"
          else
            pod_root = pod_target.sandbox.pod_dir(dep)
            mutex.synchronize { to_build << PodInfo.new(dep, version, pod_root) }
          end
        end
      end

      threads.each(&:join)
      to_build
    end

    def build_and_upload(to_build, config)
      puts "\nBuilding #{to_build.length} XCFrameworks (parallelism: #{config.max_parallel})\n"

      queue = Queue.new
      to_build.each { |item| queue << item }

      workers = config.max_parallel.times.map do
        Thread.new { process_build_queue(queue, config) }
      end

      workers.each(&:join)
    end

    def process_build_queue(queue, config)
      until queue.empty?
        pod_info = queue.pop(true) rescue break

        puts "  [BUILD] #{pod_info.name} (#{pod_info.version})"
        debug_log "Pod root: #{pod_info.root}"

        build_output, build_status = execute_build(pod_info, config)

        if build_status
          handle_successful_build(pod_info, config)
        else
          puts "  ✗ [BUILD FAILED] #{pod_info.name} (#{pod_info.version})"
          puts "    #{build_output}"
        end
      end
    end

    def execute_build(pod_info, config)
      cmd = build_command(pod_info, config)
      debug_log "Running: #{cmd}"

      output = `#{cmd}`
      [output, $?.success?]
    rescue => e
      ["Exception: #{e.message}", false]
    end

    def handle_successful_build(pod_info, config)
      puts "  ✓ [BUILT] #{pod_info.name} (#{pod_info.version})"

      xcf_path = File.join(config.output_dir, "#{pod_info.name}.xcframework")
      debug_log "Looking for XCF at: #{xcf_path}"

      if File.exist?(xcf_path)
        upload_xcframework(xcf_path, pod_info, config)
        FileUtils.rm_rf(xcf_path)
      else
        puts "  ✗ [NOT FOUND] #{pod_info.name} (#{pod_info.version})"
        debug_log "Directory contents:\n#{`ls -la #{config.output_dir}`}"
      end
    end

    def upload_xcframework(xcf_path, pod_info, config)
      puts "  [UPLOAD] #{pod_info.name} (#{pod_info.version})"

      cmd = upload_command(xcf_path, pod_info, config)
      debug_log "Running: #{cmd}"

      output = `#{cmd}`
      status = $?.success?

      if status
        puts "  ✓ [UPLOADED] #{pod_info.name} (#{pod_info.version})"
      else
        puts "  ✗ [UPLOAD FAILED] #{pod_info.name} (#{pod_info.version})"
        puts "    #{output}"
      end
    end

    def build_command(pod_info, config)
      "cd #{config.buildle_root} && npm run build-xcf -- " \
      "-m #{pod_info.name} " \
      "-p #{pod_info.root} " \
      "-i #{config.ios_path} " \
      "-o #{config.output_dir} " \
      "--platforms iphonesimulator,iphoneos " \
      "--skip-pods 2>&1"
    end

    def upload_command(xcf_path, pod_info, config)
      cmd = "cd #{config.buildle_root} && npm run upload-xcf -- " \
            "-f #{xcf_path} " \
            "-n #{pod_info.name} " \
            "-l #{pod_info.version} " \
            "-v #{config.rn_version} " \
            "-r #{config.repo_url} " \
            "-g #{config.group_id}"

      cmd += " -u #{config.username}" if config.username
      cmd += " -p #{config.password}" if config.password
      cmd + " 2>&1"
    end

    def xcf_exists?(config, name, version)
      group_path = config.group_id.gsub('.', '/')
      xcf_version = "#{version}-rn#{config.rn_version}"
      url = "#{config.repo_url}/#{group_path}/#{name}/#{xcf_version}/#{name}-#{xcf_version}.xcframework"

      `curl -s -o /dev/null -w "%{http_code}" -I "#{url}" 2>/dev/null`.strip == "200"
    end

    def print_header(rn_version)
      puts "\n" + "="*80
      puts "BUILD AND UPLOAD XCFRAMEWORKS"
      puts "="*80
      puts "React Native: #{rn_version}"
      puts "-"*80
      puts "\nChecking XCFrameworks...\n"
    end

    def print_footer(count)
      puts "\n" + "="*80
      puts "Total pods: #{count}"
      puts "="*80 + "\n"
    end

    def debug_log(message)
      puts "    #{message}" if ENV['DEBUG']
    end

    PodInfo = Struct.new(:name, :version, :root)

    class BuildConfig
      attr_reader :dependencies, :rn_version, :ios_path, :buildle_root, :output_dir,
                  :repo_url, :group_id, :username, :password, :max_parallel

      def initialize(sandbox, pod_targets)
        @dependencies = extract_dependencies(sandbox)
        @rn_version = extract_rn_version(pod_targets)
        @ios_path = sandbox.root.parent
        @buildle_root = File.expand_path('../../../', __FILE__)
        @output_dir = File.join(@buildle_root, 'xcframeworks')
        @repo_url = ENV['REPOSILITE_URL'] || 'https://repo.swmtest.xyz/releases'
        @group_id = ENV['REPOSILITE_GROUP'] || 'com.swmansion.buildle'
        @username = ENV['REPOSILITE_USERNAME']
        @password = ENV['REPOSILITE_PASSWORD']
        @max_parallel = (ENV['BUILD_PARALLELISM'] || '4').to_i

        FileUtils.mkdir_p(@output_dir)
      end

      private

      def extract_dependencies(sandbox)
        target = sandbox.project.targets.find { |t| t.name.start_with?('Pods-') }
        target ? target.dependencies.map(&:name).sort : []
      end

      def extract_rn_version(pod_targets)
        react_core = pod_targets.find { |pod| pod.name == 'React-Core' }
        react_core&.root_spec&.version&.to_s || 'unknown'
      end
    end
  end
end
