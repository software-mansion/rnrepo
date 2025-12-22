module CocoapodsRnrepo
  class FrameworkCache
    # Download and cache pre-built frameworks
    # Returns: { status: :cached | :downloaded | :unavailable | :failed, message: String }
    def self.fetch_framework(installer, pod_info, workspace_root)
      pod_name = pod_info[:name]
      version = pod_info[:version]
      maven_url = pod_info[:maven_url]
      source_path = pod_info[:source]

      Logger.log "Processing: #{pod_name} v#{version}".bold

      # Skip if we don't have a Maven URL
      unless maven_url
        Logger.log "No Maven URL available for #{pod_name}"
        Logger.log "  Debug: npm_package_name=#{pod_info[:npm_package_name]}, version=#{version}, rn_version=#{pod_info[:rn_version]}"
        return { status: :failed, message: "No Maven URL" }
      end

      # Resolve the source path to get absolute package directory
      # source_path is relative like "../node_modules/react-native-svg"
      node_modules_path = File.expand_path(source_path, workspace_root)
      Logger.log "Package directory: #{node_modules_path}"

      # Create .rnrepo-cache directory
      cache_dir = File.join(node_modules_path, '.rnrepo-cache')
      FileUtils.mkdir_p(cache_dir)
      Logger.log "Cache directory: #{cache_dir}"

      # Check if already downloaded
      xcframework_path = File.join(cache_dir, "#{pod_name}.xcframework")
      if File.exist?(xcframework_path)
        Logger.log "Pre-built framework already exists, skipping download"
        return { status: :cached, message: "Already cached locally" }
      end

      # Download the xcframework zip file
      # Filename format: npm-package-name-version-rnX.Y.Z.xcframework.zip
      npm_package_name = pod_info[:npm_package_name] || pod_name
      rn_version = pod_info[:rn_version]
      # Sanitize package name for filename (remove @ and replace / with _)
      # Matches sanitizePackageName() in @rnrepo/config
      sanitized_name = npm_package_name.gsub(/^@/, '').gsub('/', '_')
      zip_filename = "#{sanitized_name}-#{version}-rn#{rn_version}.xcframework.zip"
      zip_path = File.join(cache_dir, zip_filename)

      Logger.log "Maven URL: #{maven_url}"
      unless Downloader.download_file(maven_url, zip_path)
        Logger.log "Not available on Maven repository"
        Logger.log "Will build from source instead"
        return { status: :unavailable, message: "Not available on Maven" }
      end

      # Extract the zip file
      # The zip contains: PodName.xcframework/
      # We extract to cache_dir, which should create: cache_dir/PodName.xcframework/
      unless Downloader.unzip_file(zip_path, cache_dir)
        Logger.log "Failed to extract pre-built framework for #{pod_name}"
        FileUtils.rm_f(zip_path)
        return { status: :failed, message: "Extraction failed" }
      end

      # Verify the xcframework was extracted
      unless File.exist?(xcframework_path)
        Logger.log "XCFramework not found after extraction at #{xcframework_path}"
        FileUtils.rm_f(zip_path)
        return { status: :failed, message: "XCFramework not found after extraction" }
      end

      # Clean up zip file
      FileUtils.rm_f(zip_path)
      Logger.log "Cleaned up temporary zip file"

      Logger.log "Successfully replaced #{pod_name} with pre-built XCFramework!"
      return { status: :downloaded, message: "Downloaded and extracted successfully" }
    end
  end
end

