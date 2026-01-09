module CocoapodsRnrepo
  class PodExtractor
    # Extract third-party React Native pods from Podfile dependencies
    # Returns an array of hashes with :name, :version, :source, :package_root, :npm_package_name, :maven_url keys
    # @param workspace_root [String] The directory where Podfile is located (ios directory)
    def self.extract_rn_pods_from_podfile(podfile, lockfile = nil, workspace_root = nil)
      require 'json'
      rn_pods = []

      # We'll detect RN version once we find the first library's location
      rn_version = nil
      rn_version_detected = false

      podfile.target_definition_list.each do |target_definition|
        target_definition.dependencies.each do |dependency|
          pod_name = dependency.name

          # Only process development pods (local pods with :path)
          external_source = dependency.external_source
          next unless external_source && external_source[:path]

          source_path = external_source[:path]

          # Must be from node_modules (skip if not)
          next unless source_path.include?('node_modules')

          # Resolve to absolute path to check if it's core RN
          # We'll do a simple check here: skip if it's node_modules/react-native itself
          next if source_path.match?(/node_modules\/react-native[\/]?$/)

          # Resolve package root (absolute path to the package directory)
          package_root = workspace_root ? File.expand_path(source_path, workspace_root) : nil

          # Verify package.json exists if we have workspace_root
          package_json_path = package_root ? File.join(package_root, 'package.json') : nil
          if package_json_path && !File.exist?(package_json_path)
            next
          end

          # Detect React Native version from this library's location (only once)
          if !rn_version_detected && package_root
            rn_version = detect_react_native_version(package_root)
            rn_version_detected = true
            if rn_version
              Logger.log "Detected React Native version: #{rn_version}"
            end
          end

          # Parse package.json to get npm package name and version
          npm_package_name = nil
          version = nil
          if package_json_path
            begin
              package_json = JSON.parse(File.read(package_json_path))
              npm_package_name = package_json['name']
              version = package_json['version']
            rescue JSON::ParserError, Errno::ENOENT
              # Fall back to pod name if we can't read package.json
              npm_package_name = pod_name
            end
          end

          # Build Maven URLs for both Debug and Release configurations
          # We'll download both during pod install, and select the right one at build time
          maven_url_debug = nil
          maven_url_release = nil
          if npm_package_name && version && rn_version
            maven_url_debug = build_ios_xcframework_url(npm_package_name, version, rn_version, 'debug')
            maven_url_release = build_ios_xcframework_url(npm_package_name, version, rn_version, 'release')
          end

          # Avoid duplicates
          unless rn_pods.any? { |p| p[:name] == pod_name }
            rn_pods << {
              name: pod_name,
              version: version,
              source: source_path,
              package_root: package_root,
              npm_package_name: npm_package_name,
              maven_url_debug: maven_url_debug,
              maven_url_release: maven_url_release,
              rn_version: rn_version
            }
          end
        end
      end

      rn_pods
    end

    private

    # Detect React Native version using Node.js (like Android Gradle plugin)
    # This uses Node's module resolution to find react-native/package.json
    def self.detect_react_native_version(start_dir)
      return nil unless start_dir

      Logger.log "Detecting React Native version using Node.js from: #{start_dir}"

      begin
        # Use Node.js to resolve react-native/package.json
        # This handles all edge cases: monorepos, nested projects, workspaces, etc.
        command = "node --print \"require('react-native/package.json').version\""

        # Run from start_dir so Node's require.resolve works correctly
        result = `cd "#{start_dir}" && #{command} 2>&1`.strip

        # Check if command succeeded
        if $?.success? && !result.empty? && result.match?(/^\d+\.\d+\.\d+/)
          Logger.log "  ✓ Found React Native version: #{result}"
          return result
        else
          Logger.log "  ✗ Node.js command failed or returned invalid version: #{result}"
        end
      rescue => e
        Logger.log "  ✗ Error running Node.js: #{e.message}"
      end

      Logger.log "  ⚠️  Could not detect React Native version"
      nil
    end

    # Build iOS XCFramework URL for downloading pre-built framework
    # Format: npm-package-name-version-rnX.Y.Z-config.xcframework.zip
    def self.build_ios_xcframework_url(package_name, version, rn_version, config = 'release')
      base_url = 'https://packages.rnrepo.org/snapshots/org/rnrepo'

      # Use the npm package name directly for artifact path
      artifact_path = package_name

      # Sanitize package name for filename (remove @ and replace / with _)
      # Matches sanitizePackageName() in @rnrepo/config
      # e.g., @react-native-picker/picker -> react-native-picker_picker
      sanitized_name = package_name.gsub(/^@/, '').gsub('/', '_')

      # Build filename: react-native-picker_picker-2.11.4-rn0.82.1-release.xcframework.zip
      filename = "#{sanitized_name}-#{version}-rn#{rn_version}-#{config}.xcframework.zip"

      "#{base_url}/#{artifact_path}/#{version}/#{filename}"
    end
  end
end

