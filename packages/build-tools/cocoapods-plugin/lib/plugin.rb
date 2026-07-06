require 'cocoapods'
require 'json'
require 'shellwords'
require_relative 'logger'
require_relative 'pod_extractor'
require_relative 'downloader'
require_relative 'framework_cache'
require_relative 'stub_xcframework'
require_relative 'spm_package'

# ADD TO PODFILE BEGINING:
#
# require Pod::Executable.execute_command('node', ['-p',
#  'require.resolve(
#  "@rnrepo/build-tools/cocoapods-plugin/lib/plugin.rb",
#  {paths: [process.argv[1]]},
# )', __dir__]).strip
#
# AND IN POST INSTALL: 
# 
# post_install do |installer|
# +  rnrepo_post_install(installer)
#

# Walks up the directory tree looking for node_modules/react-native,
# matching the behavior of the Android Gradle plugin's getReactNativeRoot.
# Falls back to Node's resolver for non-standard layouts (e.g. monorepos
# with hoisting disabled).
def find_react_native_root(start_dir)
  current = File.expand_path(start_dir)
  loop do
    if File.directory?(File.join(current, 'node_modules', 'react-native'))
      return current
    end
    parent = File.dirname(current)
    break if parent == current
    current = parent
  end

  rn_package_path = `cd #{Shellwords.escape(start_dir)} && node --print "require.resolve('react-native/package.json')" 2>/dev/null`.strip
  if !rn_package_path.empty? && File.exist?(rn_package_path)
    return File.expand_path('../..', File.dirname(rn_package_path))
  end

  nil
end

def find_rnrepo_config_path(workspace_root)
  rn_root = find_react_native_root(workspace_root)
  search_dir = rn_root || File.expand_path('..', workspace_root)
  File.join(search_dir, 'rnrepo.config.json')
end

# Helper method to load and parse rnrepo.config.json
def load_rnrepo_config(workspace_root)
  config_path = find_rnrepo_config_path(workspace_root)
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
  denylist_config['ios']
end

def get_ios_allowlist(workspace_root)
  config = load_rnrepo_config(workspace_root)
  allowlist_config = config['allowList'] || config['allowlist'] || {}
  allowlist_config['ios']
end

def get_ios_cache_path(workspace_root)
  config = load_rnrepo_config(workspace_root)
  return File.expand_path('~/.rnrepo-cache') unless config.key?('xcframeworksCacheDir')
  path = config['xcframeworksCacheDir']
  return nil if !path || path.to_s.strip.empty?
  config_dir = File.dirname(find_rnrepo_config_path(workspace_root))
  File.expand_path(path, config_dir)
end

def is_version_at_least(current_version, minimum_version)
  current_version ||= '0.0.0'
  current_core = current_version.match(/^\d+(\.\d+)*/)&.to_s || '0.0.0'
  Gem::Version.new(current_core) >= Gem::Version.new(minimum_version)
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
    worklets_version = pod_info[:version] if pod_info[:name] == 'RNWorklets'
  end

  # Add worklets version to reanimated pod info
  if (pod = rn_pods.find { |p| p[:name] == 'RNReanimated' })
    if !is_version_at_least(pod[:version], "4.3.0")
      pod[:worklets_version] = worklets_version
    end
  end

  if rn_pods.empty?
    CocoapodsRnrepo::Logger.log "No React Native pods found in node_modules"
    return
  end

  CocoapodsRnrepo::Logger.log "Found #{rn_pods.count} React Native pod(s) to process"

  # Track results with thread-safe collections
  results_mutex = Mutex.new
  prepared_pods = []
  unavailable_pods = []
  failed_pods = []
  denied_pods = []

  ios_denylist = get_ios_denylist(workspace_root)
  ios_allowlist = get_ios_allowlist(workspace_root)

  # Ensure denyList and allowList are mutually exclusive for iOS.
  # The lists are per-platform, so configuring an allowList for one platform
  # and a denyList for another is allowed.
  if ios_denylist && ios_allowlist
    raise "RNRepo: Both 'denyList' and 'allowList' are configured for iOS in rnrepo.config.json. Please use only one of them."
  end

  # Identify which pods to reject based on the active configuration
  rejected_pods = if ios_denylist
                    rn_pods.select { |pod| ios_denylist.include?(pod[:npm_package_name]) }
                  elsif ios_allowlist
                    rn_pods.reject { |pod| ios_allowlist.include?(pod[:npm_package_name]) }
                  else
                    []
                  end

  # Update lists
  rn_pods -= rejected_pods
  denied_pods.concat(rejected_pods.map { |pod| pod[:name] })

  # Add expo pod to installer context for later use in post_install
  Pod::Installer.expo_pod = rn_pods.find { |pod| pod[:name] == 'Expo' }
  cache_path = get_ios_cache_path(workspace_root)
  # Fetch SwiftPM checksums for each prebuilt pod in parallel. The xcframeworks
  # themselves are fetched by SwiftPM at build time, so `pod install` only does
  # cheap checksum requests here.
  threads = rn_pods.map do |pod_info|
    Thread.new do
      result = CocoapodsRnrepo::FrameworkCache.prepare_framework(
        installer_context,
        pod_info,
        workspace_root,
        cache_path: cache_path
      )

      # Thread-safe result collection
      results_mutex.synchronize do
        case result[:status]
        when :prepared
          pod_info[:configs] = result[:configs]
          prepared_pods << pod_info
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

  if prepared_pods.any?
    CocoapodsRnrepo::Logger.log "✓ Prepared for SwiftPM prebuild (#{prepared_pods.count}):"
    prepared_pods.each do |pod_info|
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
  prebuilt_count = prepared_pods.count
  source_build_count = unavailable_pods.count + failed_pods.count + denied_pods.count
  total_original_pods = rn_pods.count + denied_pods.count

  if prebuilt_count > 0
    percentage = ((prebuilt_count.to_f / total_original_pods) * 100).round(1)
    CocoapodsRnrepo::Logger.log "#{prebuilt_count}/#{total_original_pods} dependencies (#{percentage}%) using pre-built frameworks! 🎉"
  end

  if source_build_count > 0
    CocoapodsRnrepo::Logger.log "#{source_build_count}/#{total_original_pods} dependencies will be built from source"
  end

  # Store the list of successfully prepared pods (with package roots and
  # per-configuration artifact info) for later use.
  Pod::Installer.prebuilt_rnrepo_pods = prepared_pods
end

# Monkey patch the Installer class to modify specs during dependency resolution
module Pod
  class Installer
    # Store prebuilt pod info (hashes with :name, :package_root, etc.) as class variable
    class << self
      attr_accessor :prebuilt_rnrepo_pods
      attr_accessor :expo_pod
    end
    self.prebuilt_rnrepo_pods = []
    self.expo_pod = nil

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

        cache_dir = File.join(node_modules_path, '.rnrepo-cache')

        # Get all targets for this pod to determine platforms and the module name.
        targets = pod_targets.select { |t| t.pod_name == pod_name }

        # The module name is the basename of the framework CocoaPods would have
        # built — and, crucially, the name of the .xcframework packed inside the
        # published artifact (see build-library-ios.ts). SwiftPM's binary target
        # must use this exact name, so deriving it from the same CocoaPods source
        # keeps the build pipeline and this plugin in sync.
        module_name = targets.map(&:product_module_name).compact.first || pod_name
        pod_info[:module_name] = module_name
        xcframework_name = "#{module_name}.xcframework"

        # Generate the per-configuration SwiftPM packages that fetch the real
        # xcframework at build time.
        CocoapodsRnrepo::SpmPackage.generate(cache_dir, module_name, pod_info[:configs])

        # Stamp a stub xcframework into Current/ so CocoaPods detects the vendored
        # framework and generates the "[CP] Copy XCFrameworks" phase. The build
        # phase replaces it with the SwiftPM-fetched xcframework before linking.
        current_link = File.join(cache_dir, 'Current')
        FileUtils.mkdir_p(current_link)
        CocoapodsRnrepo::StubXcframework.create(
          File.join(current_link, xcframework_name),
          module_name
        )
        CocoapodsRnrepo::Logger.log "  Configuring #{pod_name} as #{module_name} (#{pod_specs.count} spec(s)) at #{node_modules_path}"

        # Modify each spec (including subspecs)
        pod_specs.each do |spec|
          # Add vendored framework for each platform
          targets.each do |target|
            platform = target.platform.name.to_s

            # Initialize platform hash if needed
            spec.attributes_hash[platform] ||= {}

            # Use simple relative path from pod directory
            xcframework_relative_path = File.join('.rnrepo-cache', 'Current', xcframework_name)

            # Add static xcframework as vendored_frameworks
            # CocoaPods handles static xcframeworks automatically
            vendored_frameworks = spec.attributes_hash[platform]["vendored_frameworks"] || []
            vendored_frameworks = [vendored_frameworks] if vendored_frameworks.is_a?(String)

            unless vendored_frameworks.include?(xcframework_relative_path)
              vendored_frameworks << xcframework_relative_path
              spec.attributes_hash[platform]["vendored_frameworks"] = vendored_frameworks
            end
          end

          # Create dummy header file
          File.write(File.join(current_link, 'dummy.h'), "// Dummy for #{pod_name}\n") if Dir.exist?(current_link)

          # Add dummy header as source files - so Xcode propagates info about the React Native framework to the main app target
          dummy_header_path = ".rnrepo-cache/Current/dummy.h"
          spec.attributes_hash["source_files"] = ["#{dummy_header_path}"]

          # Add dummy header as source files for each platform too
          ["ios", "watchos", "tvos", "osx"].each do |platform|
            if spec.attributes_hash[platform]
              spec.attributes_hash[platform]["source_files"] = ["#{dummy_header_path}"]
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
  end
end

def append_build_setting(build_settings, key, value)
  existing = build_settings[key]

  if existing.is_a?(Array)
    build_settings[key] = existing + [value]
  elsif existing.nil? || (existing.is_a?(String) && existing.empty?)
    build_settings[key] = "$(inherited) #{value}"
  else
    build_settings[key] = "#{existing} #{value}"
  end
end

# CocoaPods' collision-blind UUID generator can mint our build phases onto UUIDs
# core objects already hold, corrupting Pods.xcodeproj. Returns a generator that
# yields free UUIDs in CocoaPods' own 14-char format ('%.6s%07X0'), collision-
# checking each candidate and walking the counter forward from 0 as CocoaPods
# does. The cost of scanning past taken slots is negligible (~1ms, paid once
# since the counter persists across calls).
# UUID generator in CocoaPods: https://github.com/CocoaPods/CocoaPods/blob/458dd19585c03d706c2dc23238afd3845a4c6000/lib/cocoapods/project.rb#L70
def build_safe_uuid_generator(pods_project)
  uuid_prefix = pods_project.root_object.uuid[0, 6]
  next_uuid_counter = 0
  lambda do
    loop do
      candidate = format('%.6s%07X0', uuid_prefix, next_uuid_counter)
      next_uuid_counter += 1
      return candidate unless pods_project.objects_by_uuid.key?(candidate)
    end
  end
end

def rnrepo_post_install(installer_context)
  # Check if plugin is disabled via environment variable
  if ENV['DISABLE_RNREPO']
    return
  end

  CocoapodsRnrepo::Logger.log "🔧 Adding build phase scripts to fetch xcframeworks via SwiftPM..."

  # Full prebuilt pod info (each carries :module_name set during resolve_dependencies).
  prebuilt_pods = Pod::Installer.prebuilt_rnrepo_pods || []
  # Run order is alphabetical. This script must run before the '[CP] Copy XCFrameworks` script
  script_name = '[AA RUN FIRST] RNREPO Build Start'

  pods_project = installer_context.pods_project
  generate_safe_uuid = build_safe_uuid_generator(pods_project)

  # Add build phase script ONLY to targets that have prebuilt frameworks
  pods_project.targets.each do |target|
    target_name = target.name

    # Find the prebuilt pod backing this target (if any).
    pod_info = prebuilt_pods.find do |pod|
      target_name.downcase.start_with?(pod[:name].to_s.downcase)
    end
    next unless pod_info

    module_name = pod_info[:module_name] || pod_info[:name]

    # Remove any existing RNREPO build phase first
    target.build_phases.select { |phase| phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase) && phase.name == script_name }.each(&:remove_from_project)

    # Build the phase with a pre-verified UUID instead of target.new_shell_script_build_phase,
    # which would mint one through CocoaPods' collision-blind generator and risk evicting a
    # core object. This mirrors what Xcodeproj::Project#new does, minus that generator, see:
    # https://github.com/CocoaPods/Xcodeproj/blob/c12d2ae619ae42f947a6b07d865f69948c752df5/lib/xcodeproj/project/object/native_target.rb#L304
    # https://github.com/CocoaPods/Xcodeproj/blob/c12d2ae619ae42f947a6b07d865f69948c752df5/lib/xcodeproj/project.rb#L433
    build_phase = Xcodeproj::Project::Object::PBXShellScriptBuildPhase.new(pods_project, generate_safe_uuid.call)
    build_phase.initialize_defaults
    build_phase.name = script_name
    build_phase.shell_script = CocoapodsRnrepo::SpmPackage.build_phase_script(module_name)
    target.build_phases << build_phase

    CocoapodsRnrepo::Logger.log "  Added build phase to #{target_name}"
  end

  CocoapodsRnrepo::Logger.log "✓ Build phase scripts configured"
  CocoapodsRnrepo::Logger.log ""

  # ExpoModulesCore in SDK@55 requires worklets as direct dependency.
  # So when worklets are prebuilt, we need to add the modulesmaps to ExpoModulesCore target.
  installer_context.pods_project.targets.each do |target|
    if target.name == 'ExpoModulesCore'
      worklets_pod = Pod::Installer.prebuilt_rnrepo_pods.find { |pod| pod[:name] == 'RNWorklets' }
      expoVersion = Pod::Installer.expo_pod ? Pod::Installer.expo_pod[:version] : '999.0.0'
      break if !worklets_pod || Gem::Version.new(expoVersion) < Gem::Version.new('55.0.0')

      worklets_root = worklets_pod[:package_root]
      if worklets_root == nil
        raise "RNWorklets not found in podfile, add react-native-worklets to denyList."
      end
      # The framework copied into PODS_XCFRAMEWORKS_BUILD_DIR is named after the
      # module (same name SwiftPM/the build pipeline use for the xcframework).
      worklets_framework_name = "#{worklets_pod[:module_name] || worklets_pod[:name]}.framework"
      module_map = "-fmodule-map-file=\"$(PODS_XCFRAMEWORKS_BUILD_DIR)/RNWorklets/#{worklets_framework_name}/Modules/module.modulemap\""

      target.build_configurations.each do |config|
        build_settings = config.build_settings
        
        # --- HEADER SEARCH PATHS ---
        append_build_setting(build_settings, 'HEADER_SEARCH_PATHS', "#{worklets_root}/Common/cpp/**")

        # --- CUSTOM COMPILER FLAGS (C/C++) ---
        append_build_setting(build_settings, 'OTHER_CFLAGS', module_map)

        # --- OTHER SWIFT FLAGS ---
        append_build_setting(build_settings, 'OTHER_SWIFT_FLAGS', "-Xcc #{module_map}")
      end

      break
    end
  end
end

