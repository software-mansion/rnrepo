module CocoapodsRnrepo
  class FrameworkCache
    # Download and cache pre-built frameworks (both Debug and Release)
    # Returns: { status: :cached | :downloaded | :unavailable | :failed, message: String }
    def self.fetch_framework(installer, pod_info, workspace_root)
      pod_name = pod_info[:name]
      version = pod_info[:version]
      source_path = pod_info[:source]

      Logger.log "Processing: #{pod_name} v#{version}".bold

      # Resolve the source path to get absolute package directory
      # source_path is relative like "../node_modules/react-native-svg"
      node_modules_path = File.expand_path(source_path, workspace_root)
      Logger.log "Package directory: #{node_modules_path}"

      # Create .rnrepo-cache directory
      cache_dir = File.join(node_modules_path, '.rnrepo-cache')
      FileUtils.mkdir_p(cache_dir)
      Logger.log "Cache directory: #{cache_dir}"

      # Check if both Debug and Release frameworks are already cached
      debug_cache_dir = File.join(cache_dir, 'Debug')
      release_cache_dir = File.join(cache_dir, 'Release')

      debug_exists = Dir.exist?(debug_cache_dir) && !Dir.glob(File.join(debug_cache_dir, "*.xcframework")).empty?
      release_exists = Dir.exist?(release_cache_dir) && !Dir.glob(File.join(release_cache_dir, "*.xcframework")).empty?

      if debug_exists && release_exists
        Logger.log "Pre-built frameworks already exist (Debug & Release)"
        return { status: :cached, message: "Already cached locally" }
      end

      npm_package_name = pod_info[:npm_package_name] || pod_name
      rn_version = pod_info[:rn_version]
      worklets_version = pod_info[:worklets_version]

      # Sanitize package name for filename (remove @ and replace / with _)
      # Matches sanitizePackageName() in @rnrepo/config
      sanitized_name = npm_package_name.gsub(/^@/, '').gsub('/', '_')

      # Track which configurations were successfully obtained
      configs_available = []

      # Download and extract Debug configuration
      unless debug_exists
        Logger.log "Downloading Debug configuration..."
        debug_result = download_and_extract_config(
          cache_dir,
          debug_cache_dir,
          sanitized_name,
          version,
          rn_version,
          'debug',
          pod_name,
          worklets_version
        )
        if debug_result[:status] == :downloaded || debug_result[:status] == :cached
          configs_available << 'Debug'
        else
          Logger.log "⚠️  Debug configuration not available"
        end
      else
        configs_available << 'Debug'
      end

      # Download and extract Release configuration
      unless release_exists
        Logger.log "Downloading Release configuration..."
        release_result = download_and_extract_config(
          cache_dir,
          release_cache_dir,
          sanitized_name,
          version,
          rn_version,
          'release',
          pod_name,
          worklets_version
        )
        if release_result[:status] == :downloaded || release_result[:status] == :cached
          configs_available << 'Release'
        else
          Logger.log "⚠️  Release configuration not available"
        end
      else
        configs_available << 'Release'
      end

      # Check if both configurations are available
      if configs_available.length != 2
        print_list = configs_available.any? ? configs_available.join(', ') : "none"
        Logger.log "⚠️  Not all configurations are available. Available: #{print_list}"
        return { status: :unavailable, message: "Missing configuration(s), found: #{print_list}" }
      end

      Logger.log "Successfully downloaded pre-built XCFrameworks (Debug & Release)!"
      return { status: :downloaded, message: "Downloaded and extracted successfully" }
    end

    private

    # Download and extract a specific configuration (debug or release)
    def self.download_and_extract_config(cache_dir, config_cache_dir, sanitized_name, version, rn_version, config, pod_name, worklets_version = nil)
      # Filename format: npm-package-name-version-rnX.Y.Z[-workletsX.Y.Z]-config.xcframework.zip
      worklets_suffix = worklets_version ? "-worklets#{worklets_version}" : ''
      zip_filename = "#{sanitized_name}-#{version}-rn#{rn_version}#{worklets_suffix}-#{config}.xcframework.zip"
      zip_path = File.join(cache_dir, zip_filename)

      downloaded_file = Downloader.download_file(
        {
          package: pod_name,
          sanitized_name: sanitized_name,
          version: version,
          rn_version: rn_version,
          worklets_version: worklets_version,
          configuration: config,
          destination: zip_path
        }
      )
      unless downloaded_file
        Logger.log "Not available on Maven repository"
        Logger.log "Will build from source instead"
        return { status: :unavailable, message: "Not available on Maven" }
      end

      # Create config-specific directory
      FileUtils.mkdir_p(config_cache_dir)

      # Extract the zip file to config-specific directory
      # The zip contains: FrameworkName.xcframework/ (may differ from pod name due to sanitization)
      # We extract to cache_dir, which should create: cache_dir/FrameworkName.xcframework/
      unless Downloader.unzip_file(downloaded_file, config_cache_dir)
        Logger.log "Failed to extract pre-built framework for #{pod_name}"
        FileUtils.rm_f(zip_path)
        return { status: :failed, message: "Extraction failed" }
      end

      # Find the extracted xcframework (name may differ from pod name)
      xcframeworks = Dir.glob(File.join(config_cache_dir, "*.xcframework"))
      if xcframeworks.empty?
        Logger.log "XCFramework not found after extraction in #{config_cache_dir}"
        FileUtils.rm_f(zip_path)
        return { status: :failed, message: "XCFramework not found after extraction" }
      end

      if xcframeworks.length > 1
        Logger.log "Multiple XCFrameworks found in #{config_cache_dir}: #{xcframeworks}"
        FileUtils.rm_f(zip_path)
        return { status: :failed, message: "Multiple XCFrameworks found" }
      end

      actual_xcframework_path = xcframeworks.first
      Logger.log "Found XCFramework: #{File.basename(actual_xcframework_path)}"

      # Clean up zip file
      FileUtils.rm_f(zip_path)
      Logger.log "Cleaned up temporary zip file"

      return { status: :downloaded, message: "Downloaded #{config} configuration" }
    end
  end
end

