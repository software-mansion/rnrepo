module CocoapodsRnrepo
  class PodExtractor
    # Extract third-party React Native pods from Podfile dependencies
    # Returns an array of hashes with :name, :version, :source, :package_root, :npm_package_name, :maven_url keys
    def self.extract_rn_pods_from_podfile(podfile, lockfile = nil, workspace_root = nil)
      require 'json'
      rn_pods = []

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

          # Parse package.json to get npm package name (which may differ from pod name)
          npm_package_name = nil
          if package_json_path
            begin
              package_json = JSON.parse(File.read(package_json_path))
              npm_package_name = package_json['name']
            rescue JSON::ParserError, Errno::ENOENT
              # Fall back to pod name if we can't read package.json
              npm_package_name = pod_name
            end
          end

          # Get version from lockfile if available
          version = lockfile.version(pod_name) if lockfile
          version = version.to_s if version

          # Construct Maven URL using npm package name
          maven_url = nil
          if npm_package_name && version
            maven_url = build_maven_url(npm_package_name, version)
          end

          # Avoid duplicates
          unless rn_pods.any? { |p| p[:name] == pod_name }
            rn_pods << {
              name: pod_name,
              version: version,
              source: source_path,
              package_root: package_root,
              npm_package_name: npm_package_name,
              maven_url: maven_url
            }
          end
        end
      end

      rn_pods
    end

    private

    # Build Maven URL for downloading pre-built xcframework
    def self.build_maven_url(package_name, version)
      base_url = 'https://packages.rnrepo.org/snapshots/org/rnrepo'

      # Convert package name to Maven artifact format following React Native's pattern
      # Same logic as convertToGradleProjectName in packages/config/src/utils.ts
      # @react-native-community/slider -> react-native-community_slider
      artifact_name = package_name.gsub(/^@/, '').gsub('/', '_')

      "#{base_url}/#{artifact_name}/#{version}/#{artifact_name}-#{version}.zip"
    end
  end
end

