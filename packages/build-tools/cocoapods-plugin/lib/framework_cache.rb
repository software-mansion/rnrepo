module CocoapodsRnrepo
  class FrameworkCache
    # Prepares a pod for SwiftPM-backed prebuilds without downloading the
    # xcframework. At `pod install` time we only need the (tiny) SwiftPM
    # checksums for each configuration; the xcframework itself is fetched by
    # SwiftPM during the build phase (see SpmPackage + plugin.rb).
    #
    # Returns: {
    #   status: :prepared | :unavailable | :failed,
    #   configs: { 'Debug' => { url:, checksum: }, 'Release' => { ... } },
    #   message: String
    # }
    def self.prepare_framework(installer, pod_info, workspace_root, cache_path: nil)
      pod_name = pod_info[:name]
      version = pod_info[:version]
      source_path = pod_info[:source]

      Logger.log "Processing: #{pod_name} v#{version}".bold

      node_modules_path = File.expand_path(source_path, workspace_root)
      cache_dir = File.join(node_modules_path, '.rnrepo-cache')
      FileUtils.mkdir_p(cache_dir)

      npm_package_name = pod_info[:npm_package_name] || pod_name
      rn_version = pod_info[:rn_version]
      worklets_version = pod_info[:worklets_version]

      # Sanitize package name for the artifact path (remove @ and replace /).
      # Matches sanitizePackageName() in @rnrepo/config.
      sanitized_name = npm_package_name.gsub(/^@/, '').gsub('/', '_')

      configs = {}
      { 'Debug' => 'debug', 'Release' => 'release' }.each do |config_name, config_slug|
        artifact_spec = {
          package: pod_name,
          sanitized_name: sanitized_name,
          version: version,
          rn_version: rn_version,
          worklets_version: worklets_version,
          configuration: config_slug,
          cache_path: cache_path
        }

        checksum = Downloader.download_checksum(artifact_spec)
        next unless checksum

        configs[config_name] = {
          url: Downloader.build_artifact_url(artifact_spec),
          checksum: checksum
        }
      end

      if configs.empty?
        Logger.log "⚠️  No prebuilt configurations available on the registry"
        return { status: :unavailable, configs: {}, message: "No checksums available" }
      end

      unless configs.key?('Debug') && configs.key?('Release')
        Logger.log "⚠️  Only #{configs.keys.join(', ')} available; will use it for all build configurations"
      end

      Logger.log "Prepared SwiftPM prebuild (#{configs.keys.join(' & ')})"
      { status: :prepared, configs: configs, message: "Checksums fetched" }
    end
  end
end
