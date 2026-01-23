require 'cocoapods'
require 'thread'
require 'json'
require_relative 'logger'
require_relative 'pod_extractor'
require_relative 'downloader'
require_relative 'framework_cache'

# ONLY ADD TO PODFILE:
# 
#require Pod::Executable.execute_command('node', ['-p',
#  'require.resolve(
#  "@rnrepo/cocoapods-plugin/lib/plugin.rb",
#  {paths: [process.argv[1]]},
#)', __dir__]).strip
#

# Helper method to load and parse rnrepo.config.json
def load_rnrepo_config(workspace_root)
  config_path = File.join(workspace_root, '..', 'rnrepo.config.json')
  CocoapodsRnrepo::Logger.log "Loading rnrepo.config.json from #{config_path}"
  return {} unless File.exist?(config_path)

  begin
    JSON.parse(File.read(config_path))
  rescue => e
    CocoapodsRnrepo::Logger.log "⚠ Warning: Failed to parse rnrepo.config.json: #{e.message}"
    {}
  end
end

def get_ios_denylist(workspace_root)
  config = load_rnrepo_config(workspace_root)
  denylist_config = config['denyList'] || config['denylist'] || {}
  denylist_config['ios'] || []
end

def rnrepo_pre_install(installer_context)
  # Check if plugin is disabled via environment variable
  if ENV['DISABLE_RNREPO']
    CocoapodsRnrepo::Logger.log "⊘ RNREPO plugin is disabled (DISABLE_RNREPO is set)"
    return
  end

  CocoapodsRnrepo::Logger.log "🚀 Scanning for React Native dependencies to replace with pre-builds..."

  # Get the ios directory (where Podfile is located)
  workspace_root = installer_context.sandbox.root.dirname.to_s
  podfile = installer_context.podfile

  # Extract all React Native pods from the Podfile (with resolved package roots)
  # React Native version will be auto-detected by walking up from library locations
  rn_pods = CocoapodsRnrepo::PodExtractor.extract_rn_pods_from_podfile(
    podfile,
    installer_context.lockfile,
    workspace_root
  )

  worklets_version = nil
  # Log what we found
  rn_pods.each do |pod_info|
    CocoapodsRnrepo::Logger.log "  Found: #{pod_info[:name]} v#{pod_info[:version] || 'unknown'}"
    if pod_info[:name] == 'RNWorklets'
      worklets_version = pod_info[:version]
    end
  end

  # Add worklets version to reanimated pod info
  if (pod = rn_pods.find { |p| p[:name] == 'RNReanimated' })
    pod[:worklets_version] = worklets_version
  end

  if rn_pods.empty?
    CocoapodsRnrepo::Logger.log "No React Native pods found in node_modules"
    return
  end

  CocoapodsRnrepo::Logger.log "Found #{rn_pods.count} React Native pod(s) to process"

  # Track results with thread-safe collections
  results_mutex = Mutex.new
  cached_pods = []
  downloaded_pods = []
  unavailable_pods = []
  failed_pods = []
  denied_pods = []

  # Handle denylist
  ios_denylist = get_ios_denylist(workspace_root)
  rn_pods = rn_pods.reject do |pod_info|
    if ios_denylist.include?(pod_info[:npm_package_name])
      denied_pods << pod_info[:name]
      true
    else
      false
    end
  end

  # Download and cache pre-built frameworks in parallel
  threads = rn_pods.map do |pod_info|
    Thread.new do
      result = CocoapodsRnrepo::FrameworkCache.fetch_framework(
        installer_context,
        pod_info,
        workspace_root
      )

      # Thread-safe result collection
      results_mutex.synchronize do
        case result[:status]
        when :cached
          cached_pods << pod_info
        when :downloaded
          downloaded_pods << pod_info
        when :unavailable
          unavailable_pods << pod_info[:name]
        when :failed
          failed_pods << pod_info[:name]
        end
      end
    end
  end

  # Wait for all threads to complete
  threads.each(&:join)

  # Display summary
  CocoapodsRnrepo::Logger.log "Total React Native dependencies detected: #{rn_pods.count}"

  if cached_pods.any?
    CocoapodsRnrepo::Logger.log "✓ Already Cached (#{cached_pods.count}):"
    cached_pods.each do |pod_info|
      CocoapodsRnrepo::Logger.log "  • #{pod_info[:name]}"
    end
  end

  if downloaded_pods.any?
    CocoapodsRnrepo::Logger.log "⬇ Downloaded from Maven (#{downloaded_pods.count}):"
    downloaded_pods.each do |pod_info|
      CocoapodsRnrepo::Logger.log "  • #{pod_info[:name]}"
    end
  end

  if unavailable_pods.any?
    CocoapodsRnrepo::Logger.log "⚠ Not Available on Maven (#{unavailable_pods.count}):"
    CocoapodsRnrepo::Logger.log "  These will be built from source:"
    unavailable_pods.each do |pod|
      CocoapodsRnrepo::Logger.log "  • #{pod}"
    end
  end

  if failed_pods.any?
    CocoapodsRnrepo::Logger.log "✗ Failed to Process (#{failed_pods.count}):"
    failed_pods.each do |pod|
      CocoapodsRnrepo::Logger.log "  • #{pod}"
    end
  end

  if denied_pods.any?
    CocoapodsRnrepo::Logger.log "⊘ Denied from pre-builds (#{denied_pods.count}):"
    denied_pods.each do |pod_name|
      CocoapodsRnrepo::Logger.log "  • #{pod_name}"
    end
  end

  # Overall stats
  prebuilt_count = cached_pods.count + downloaded_pods.count
  source_build_count = unavailable_pods.count + failed_pods.count + denied_pods.count
  total_original_pods = rn_pods.count + denied_pods.count

  if prebuilt_count > 0
    percentage = ((prebuilt_count.to_f / total_original_pods) * 100).round(1)
    CocoapodsRnrepo::Logger.log "#{prebuilt_count}/#{total_original_pods} dependencies (#{percentage}%) using pre-built frameworks! 🎉"
  end

  if source_build_count > 0
    CocoapodsRnrepo::Logger.log "#{source_build_count}/#{total_original_pods} dependencies will be built from source"
  end

  # Store the list of successfully prebuilt pods (with package roots) for later use
  Pod::Installer.prebuilt_rnrepo_pods = cached_pods + downloaded_pods
end

# Monkey patch the Installer class to modify specs during dependency resolution
module Pod
  class Installer
    # Store prebuilt pod info (hashes with :name, :package_root, etc.) as class variable
    class << self
      attr_accessor :prebuilt_rnrepo_pods
    end
    self.prebuilt_rnrepo_pods = []

    # Hook into resolve_dependencies to modify specs BEFORE project generation
    old_method = instance_method(:resolve_dependencies)
    define_method(:resolve_dependencies) do
      rnrepo_pre_install(installer_context=self)
      # Get the list of prebuilt pod info (hashes with :name, :package_root, etc.)
      prebuilt_pods = Pod::Installer.prebuilt_rnrepo_pods || []

      # Call the original method first
      old_method.bind(self).call

      return if prebuilt_pods.empty?

      CocoapodsRnrepo::Logger.log ""
      CocoapodsRnrepo::Logger.log "🔄 Configuring pre-built frameworks..."

      specs = analysis_result.specifications

      replaced_count = 0

      # Process each prebuilt pod (not each spec, to avoid duplicates in logging)
      prebuilt_pods.each do |pod_info|
        pod_name = pod_info[:name]
        node_modules_path = pod_info[:package_root]

        # Find all specs for this pod (including subspecs)
        pod_specs = specs.select { |spec| spec.root.name == pod_name }
        if pod_specs.empty?
          CocoapodsRnrepo::Logger.log "  ⚠️  No specs found for #{pod_name}"
          next
        end

        # Find the xcframework (name may differ from pod name due to sanitization)
        cache_dir = File.join(node_modules_path, '.rnrepo-cache')

        # Create Current symlink if it doesn't exist (defaults to Debug, will be updated at build time)
        current_link = File.join(cache_dir, 'Current')
        unless File.exist?(current_link)
          # Prefer Debug for development
          debug_cache_dir = File.join(cache_dir, 'Debug')
          release_cache_dir = File.join(cache_dir, 'Release')
          default_config = File.exist?(debug_cache_dir) ? 'Debug' : 'Release'
          FileUtils.ln_s(default_config, current_link)
          CocoapodsRnrepo::Logger.log "  Created Current symlink -> #{default_config}"
        end

        # Look for xcframeworks in Current (which is a symlink to Debug or Release)
        xcframeworks = Dir.glob(File.join(current_link, "*.xcframework"))

        if xcframeworks.empty?
          CocoapodsRnrepo::Logger.log "  ⚠️  xcframework not found in #{current_link}"
          next
        end

        if xcframeworks.length > 1
          CocoapodsRnrepo::Logger.log "  ⚠️  Multiple xcframeworks found in #{current_link}"
          next
        end

        xcframework_path = xcframeworks.first
        xcframework_name = File.basename(xcframework_path)

        CocoapodsRnrepo::Logger.log "  Configuring #{pod_name} (#{pod_specs.count} spec(s)) at #{node_modules_path}"

        # Verify the xcframework exists and is properly structured
        debug_cache_dir = File.join(cache_dir, 'Debug')
        release_cache_dir = File.join(cache_dir, 'Release')
        [debug_cache_dir, release_cache_dir].each do |config_dir|
          config_name = File.basename(config_dir)
          config_xcframeworks = Dir.glob(File.join(config_dir, "*.xcframework"))
          next if config_xcframeworks.empty?

          xcframework_to_verify = config_xcframeworks.first
          xcframework_slices = Dir.glob(File.join(xcframework_to_verify, "*")).select { |f| File.directory?(f) }

          if xcframework_slices.any?
            # For static XCFrameworks, the binary is inside the .framework bundle
            # Structure: RNSVG.xcframework/ios-arm64_x86_64-simulator/RNSVG.framework/RNSVG
            first_slice = xcframework_slices.first
            framework_dir = Dir.glob(File.join(first_slice, "*.framework")).first

            if framework_dir
              binary_name = File.basename(framework_dir, '.framework')
              binary_path = File.join(framework_dir, binary_name)

              if File.exist?(binary_path)
                # Verify it's a static library using 'file' command
                file_type = `file "#{binary_path}"`.strip
                if file_type.include?('ar archive') || file_type.include?('current ar archive')
                  CocoapodsRnrepo::Logger.log "    Verified static xcframework (#{config_name})"
                else
                  CocoapodsRnrepo::Logger.log "  ⚠️  WARNING: #{pod_name} #{config_name} may not be a static framework (type: #{file_type})"
                end
              else
                CocoapodsRnrepo::Logger.log "  ⚠️  WARNING: Could not find binary at #{binary_path}"
              end
            else
              CocoapodsRnrepo::Logger.log "  ⚠️  WARNING: Could not find .framework bundle in xcframework"
            end
          end
        end

        # Get all targets for this pod to determine platforms
        targets = pod_targets.select { |t| t.pod_name == pod_name }

        # Modify each spec (including subspecs)
        pod_specs.each do |spec|
          # Add vendored framework for each platform
          targets.each do |target|
            platform = target.platform.name.to_s

            # Initialize platform hash if needed
            spec.attributes_hash[platform] ||= {}

            # Create a symlink at pod root pointing to the Current framework
            # This allows CocoaPods to find it easily
            pod_root_link = File.join(node_modules_path, xcframework_name)
            unless File.exist?(pod_root_link)
              FileUtils.ln_s(File.join('.rnrepo-cache', 'Current', xcframework_name), pod_root_link)
            end

            # Use simple relative path from pod directory
            xcframework_relative_path = xcframework_name

            # Add static xcframework as vendored_frameworks
            # CocoaPods handles static xcframeworks automatically
            vendored_frameworks = spec.attributes_hash[platform]["vendored_frameworks"] || []
            vendored_frameworks = [vendored_frameworks] if vendored_frameworks.is_a?(String)

            unless vendored_frameworks.include?(xcframework_relative_path)
              vendored_frameworks << xcframework_relative_path
              spec.attributes_hash[platform]["vendored_frameworks"] = vendored_frameworks
            end
          end

          # Empty source files - CocoaPods will handle headers from xcframework automatically
          spec.attributes_hash["source_files"] = []

          # Empty source files for each platform too
          ["ios", "watchos", "tvos", "osx"].each do |platform|
            if spec.attributes_hash[platform]
              spec.attributes_hash[platform]["source_files"] = []
            end
          end

          # Remove resource_bundles and convert to resources
          if spec.attributes_hash["resource_bundles"]
            bundle_names = spec.attributes_hash["resource_bundles"].keys
            spec.attributes_hash["resource_bundles"] = nil
            spec.attributes_hash["resources"] ||= []
            spec.attributes_hash["resources"] += bundle_names.map { |n| "#{n}.bundle" }
          end

          CocoapodsRnrepo::Logger.log "    Modified spec: #{spec.name}"
        end

        replaced_count += 1
      end

      if replaced_count > 0
        CocoapodsRnrepo::Logger.log "✓ Successfully configured #{replaced_count} pre-built framework(s)"
      end

      CocoapodsRnrepo::Logger.log ""
    end
    
    # Register post_install hook inside the monkey patch
    unless @rnrepo_post_install_registered
      Pod::HooksManager.register('cocoapods-rnrepo', :post_install) do |installer_context|
        rnrepo_post_install(installer_context)
      end
      @rnrepo_post_install_registered = true
    end
  end
end

def rnrepo_post_install(installer_context)
  # Check if plugin is disabled via environment variable
  if ENV['DISABLE_RNREPO']
    return
  end

  # Get the list of prebuilt pod info
  prebuilt_pods = Pod::Installer.prebuilt_rnrepo_pods || []
  return if prebuilt_pods.empty?

  CocoapodsRnrepo::Logger.log ""
  CocoapodsRnrepo::Logger.log "🔧 Adding build phase scripts for configuration selection..."

  # Add build phase script to each target that uses prebuilt frameworks
  installer_context.pods_project.targets.each do |pod_target|
    # Check if this target uses any prebuilt frameworks
    # Target names in Xcode are like "react-native-svg" or "React-native-svg"
    pod_name = prebuilt_pods.find { |pod_info| pod_target.name.start_with?(pod_info[:name]) }
    next unless pod_name

    pod_info = prebuilt_pods.find { |p| p[:name] == pod_name[:name] }
    next unless pod_info

    # Check if script phase already exists
    script_name = "[RNREPO] Select Framework Configuration"
    existing_phase = pod_target.shell_script_build_phases.find { |phase| phase.name == script_name }

    if existing_phase
      CocoapodsRnrepo::Logger.log "  Build phase already exists for #{pod_info[:name]}"
      next
    end

    # Skip aggregate targets that don't have source build phases
    next unless pod_target.respond_to?(:source_build_phase)

    # Add a build phase script that runs before compilation
    # This script creates a symlink from Current -> Debug or Release based on CONFIGURATION
    script_phase = pod_target.new_shell_script_build_phase(script_name)
    script_phase.shell_script = <<~SCRIPT
      set -e

      # Path to the cache directory (relative to the pod's source directory)
      CACHE_DIR="${PODS_TARGET_SRCROOT}/.rnrepo-cache"
      CURRENT_LINK="${CACHE_DIR}/Current"

      # Select the appropriate configuration
      if [ "$CONFIGURATION" == "Debug" ]; then
        TARGET_DIR="Debug"
      elif [ "$CONFIGURATION" == "Release" ]; then
        TARGET_DIR="Release"
      else
        echo "warning: Unknown configuration '$CONFIGURATION', defaulting to Release"
        TARGET_DIR="Release"
      fi

      # Remove existing Current link/directory if it exists
      if [ -L "${CURRENT_LINK}" ] || [ -e "${CURRENT_LINK}" ]; then
        rm -rf "${CURRENT_LINK}"
      fi

      # Create symlink to the appropriate configuration
      ln -sf "${TARGET_DIR}" "${CURRENT_LINK}"

      echo "RNREPO: Selected ${TARGET_DIR} configuration for ${PODS_TARGET_SRCROOT}"
    SCRIPT

    # Move the script phase to run before "Compile Sources" phase
    compile_phase = pod_target.source_build_phase
    if compile_phase
      pod_target.build_phases.delete(script_phase)
      compile_phase_index = pod_target.build_phases.index(compile_phase)
      pod_target.build_phases.insert(compile_phase_index, script_phase)
    end

    CocoapodsRnrepo::Logger.log "  Added build phase to #{pod_info[:name]}"
  end

  CocoapodsRnrepo::Logger.log "✓ Build phase scripts configured"
  CocoapodsRnrepo::Logger.log ""
end

