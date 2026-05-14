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

      # When RNREPO_CACHE_DIR is set, artifacts live there and symlinks are created
      # in node_modules/<package>/.rnrepo-cache so CocoaPods can find them.
      # Without it, artifacts are stored directly inside the package directory.
      if ENV['RNREPO_CACHE_DIR']
        cache_dir = File.join(File.expand_path(ENV['RNREPO_CACHE_DIR'], workspace_root), '.rnrepo-cache', pod_name)
        cache_dir_symlink = File.join(node_modules_path, '.rnrepo-cache')
        FileUtils.mkdir_p(cache_dir_symlink)
      else
        cache_dir = File.join(node_modules_path, '.rnrepo-cache')
        cache_dir_symlink = nil
      end
      FileUtils.mkdir_p(cache_dir)
      Logger.log "Cache directory: #{cache_dir}"

      if %w[Debug Release].all? { |c|
           xcframework_exists?(File.join(cache_dir, c)) &&
           (cache_dir_symlink.nil? || xcframework_exists?(File.join(cache_dir_symlink, c)))
         }
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
      anything_downloaded = false

      %w[Debug Release].each do |config|
        config_cache_dir = File.join(cache_dir, config)
        symlink_path = cache_dir_symlink && File.join(cache_dir_symlink, config)

        if xcframework_exists?(config_cache_dir)
          ensure_symlink(config_cache_dir, symlink_path) if symlink_path
          configs_available << config
        else
          Logger.log "Downloading #{config} configuration..."
          result = download_and_extract_config(
            cache_dir,
            config_cache_dir,
            sanitized_name,
            version,
            rn_version,
            config.downcase,
            pod_name,
            worklets_version
          )
          if result[:status] == :downloaded
            anything_downloaded = true
            ensure_symlink(config_cache_dir, symlink_path) if symlink_path
            configs_available << config
          else
            Logger.log "⚠️  #{config} configuration not available"
          end
        end
      end

      # Check if both configurations are available
      if configs_available.length != 2
        print_list = configs_available.any? ? configs_available.join(', ') : "none"
        Logger.log "⚠️  Not all configurations are available. Available: #{print_list}"
        return { status: :unavailable, message: "Missing configuration(s), found: #{print_list}" }
      end

      if anything_downloaded
        Logger.log "Successfully downloaded pre-built XCFrameworks (Debug & Release)!"
        return { status: :downloaded, message: "Downloaded and extracted successfully" }
      else
        Logger.log "Pre-built frameworks already exist (Debug & Release)"
        return { status: :cached, message: "Already cached locally" }
      end
    end

    private

    def self.xcframework_exists?(dir)
      Dir.exist?(dir) && !Dir.glob(File.join(dir, "*.xcframework")).empty?
    end

    def self.ensure_symlink(target, symlink_path)
      # rm_rf handles both symlinks and real directories (the latter can exist
      # when switching from the default node_modules cache to RNREPO_CACHE_DIR mode)
      FileUtils.rm_rf(symlink_path)
      FileUtils.ln_s(target, symlink_path)
    end

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

      # Create config-specific directory, remove stale symlink if present
      FileUtils.rm_rf(config_cache_dir) if File.symlink?(config_cache_dir)
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

