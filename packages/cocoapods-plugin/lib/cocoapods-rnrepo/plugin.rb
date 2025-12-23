require 'cocoapods'
require 'cocoapods-rnrepo/logger'
require 'cocoapods-rnrepo/pod_extractor'
require 'cocoapods-rnrepo/downloader'
require 'cocoapods-rnrepo/framework_cache'

# Hook into CocoaPods pre-install phase to download frameworks
Pod::HooksManager.register('cocoapods-rnrepo', :pre_install) do |installer_context|
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

  # Log what we found
  rn_pods.each do |pod_info|
    CocoapodsRnrepo::Logger.log "  Found: #{pod_info[:name]} v#{pod_info[:version] || 'unknown'}"
  end

  if rn_pods.empty?
    CocoapodsRnrepo::Logger.log "No React Native pods found in node_modules"
    next
  end

  CocoapodsRnrepo::Logger.log "Found #{rn_pods.count} React Native pod(s) to process"

  # Track results
  cached_pods = []
  downloaded_pods = []
  unavailable_pods = []
  failed_pods = []

  # Download and cache pre-built frameworks
  rn_pods.each do |pod_info|
    result = CocoapodsRnrepo::FrameworkCache.fetch_framework(
      installer_context,
      pod_info,
      workspace_root
    )

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

  # Overall stats
  prebuilt_count = cached_pods.count + downloaded_pods.count
  source_build_count = unavailable_pods.count + failed_pods.count

  if prebuilt_count > 0
    percentage = ((prebuilt_count.to_f / rn_pods.count) * 100).round(1)
    CocoapodsRnrepo::Logger.log "#{prebuilt_count}/#{rn_pods.count} dependencies (#{percentage}%) using pre-built frameworks! 🎉"
  end

  if source_build_count > 0
    CocoapodsRnrepo::Logger.log "#{source_build_count}/#{rn_pods.count} dependencies will be built from source"
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
      # Call the original method first
      old_method.bind(self).call

      # Get the list of prebuilt pod info (hashes with :name, :package_root, etc.)
      prebuilt_pods = Pod::Installer.prebuilt_rnrepo_pods || []
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
        xcframeworks = Dir.glob(File.join(cache_dir, "*.xcframework"))

        if xcframeworks.empty?
          CocoapodsRnrepo::Logger.log "  ⚠️  xcframework not found in #{cache_dir}"
          next
        end

        if xcframeworks.length > 1
          CocoapodsRnrepo::Logger.log "  ⚠️  Multiple xcframeworks found in #{cache_dir}"
          next
        end

        xcframework_path = xcframeworks.first
        xcframework_name = File.basename(xcframework_path)

        CocoapodsRnrepo::Logger.log "  Configuring #{pod_name} (#{pod_specs.count} spec(s)) at #{node_modules_path}"

        # Verify the xcframework exists and is properly structured
        xcframework_slices = Dir.glob(File.join(xcframework_path, "*")).select { |f| File.directory?(f) }
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
                CocoapodsRnrepo::Logger.log "    Verified static xcframework"
              else
                CocoapodsRnrepo::Logger.log "  ⚠️  WARNING: #{pod_name} may not be a static framework (type: #{file_type})"
              end
            else
              CocoapodsRnrepo::Logger.log "  ⚠️  WARNING: Could not find binary at #{binary_path}"
            end
          else
            CocoapodsRnrepo::Logger.log "  ⚠️  WARNING: Could not find .framework bundle in xcframework"
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

            # Use relative path from pod directory (use actual xcframework name)
            xcframework_relative_path = ".rnrepo-cache/#{xcframework_name}"

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

          # Remove resource_bundles and convert to resources (like cocoapods-binary does)
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

