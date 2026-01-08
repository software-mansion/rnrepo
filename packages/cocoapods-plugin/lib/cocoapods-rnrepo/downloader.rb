require 'net/http'
require 'uri'
require 'fileutils'
require 'zip'
require 'open3'

module CocoapodsRnrepo
  class Downloader

    def self.gradle_installed?
      _stdout, _stderr, status = Open3.capture3('gradle', '-v')
      status.success?
    rescue => e
      Logger.log "Gradle check error: #{e.message}"
      false
    end

    # Download from local test files (development/testing only)
    # Looks for files in: ~/.rnrepo-test-files/
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration
    # Returns: destination path if successful, nil if file not found
    def self.download_from_local_test(artifact_spec)
      local_test_dir = "/tmp/rnrepo"
      filename = "#{artifact_spec[:sanitized_name]}-#{artifact_spec[:version]}-rn#{artifact_spec[:rn_version]}-#{artifact_spec[:configuration]}.xcframework.zip"
      local_test_file = File.join(local_test_dir, filename)

      if File.exist?(local_test_file)
        Logger.log "🧪 LOCAL TEST MODE: Using local file instead of downloading"
        Logger.log "Copying from #{local_test_file}..."
        FileUtils.cp(local_test_file, artifact_spec[:destination])
        Logger.log "Copied successfully"
        return artifact_spec[:destination]
      end

      nil
    end

    # Download file via gradle task
    # Requires: artifact_spec hash with, :sanitized_name, :version, :rn_version, :configuration
    # Returns: destination path if successful, nil on failure
    def self.download_via_gradle(artifact_spec)
      Logger.log "Downloading via gradle..."

      # Get the gem's root directory (parent of lib/)
      gem_root = File.expand_path('../../..', __FILE__)
      gradle_file = File.join(gem_root, 'build.gradle.kts')
      
      unless File.exist?(gradle_file)
        Logger.log "build.gradle.kts not found at #{gradle_file}"
        return nil
      end

      begin
        _stdout, stderr, status = Open3.capture3(
          'gradle',
          '--project-cache-dir', '/tmp/rnrepo-gradle-project-cache-dir',
          '--build-file', gradle_file,
          '--no-daemon',
          '--no-build-cache',
          '-PbuildDir=/tmp/rnrepo-gradle-build',
          'downloadArtifact',
          '-Dpackage=' + artifact_spec[:sanitized_name],
          '-Dversion=' + artifact_spec[:version],
          '-DrnVersion=' + artifact_spec[:rn_version],
          '-Dconfiguration=' + artifact_spec[:configuration]
        )

        if status.success?
          Logger.log "Gradle download completed successfully"
          return self.find_in_gradle_cache(artifact_spec)
        else
          Logger.log "Gradle execution failed: #{stderr}"
          return nil
        end
      rescue => e
        Logger.log "Error downloading via gradle: #{e.message}"
        return nil
      end
    end

    # Locate downloaded file in gradle cache
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration
    # Returns: path if found, nil if not found
    def find_in_gradle_cache(spec)
      path_parts = [Dir.home, '.gradle/caches/modules-2/files-2.1', 'org.rnrepo.public', spec[:sanitized_name], spec[:version]]
      gradle_cache = File.join(*path_parts)
      
      pattern = "#{spec[:sanitized_name]}-#{spec[:version]}-rn#{spec[:rn_version]}-#{spec[:configuration]}.xcframework.zip"
      downloaded_path = Dir.glob(File.join(gradle_cache, '**', pattern)).first

      downloaded_path || Logger.log("Downloaded file not found in gradle cache at #{gradle_cache}")
    end

    # Download file via HTTP request
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration, :destination
    # Returns: destination path if successful, nil on failure
    def self.download_via_http(artifact_spec)
      # url = "https://packages.rnrepo.org/releases/org/rnrepo/public/#{artifact_spec[:sanitized_name]}/#{artifact_spec[:version]}/#{artifact_spec[:sanitized_name]}-#{artifact_spec[:version]}-rn#{artifact_spec[:rn_version]}-#{artifact_spec[:configuration]}.xcframework.zip"
      url = "https://repo.swmtest.xyz/releases/org/rnrepo/public/#{artifact_spec[:sanitized_name]}/#{artifact_spec[:version]}/#{artifact_spec[:sanitized_name]}-#{artifact_spec[:version]}-rn#{artifact_spec[:rn_version]}-#{artifact_spec[:configuration]}.xcframework.zip"
      Logger.log "Downloading from #{url}..."

      uri = URI.parse(url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')

      request = Net::HTTP::Get.new(uri.request_uri)

      http.request(request) do |response|
        if response.code.to_i == 200
          File.open(artifact_spec[:destination], 'wb') do |file|
            response.read_body do |chunk|
              file.write(chunk)
            end
          end
          return artifact_spec[:destination]
        else
          Logger.log "Failed to download #{url}: HTTP #{response.code}"
          return nil
        end
      end
    rescue => e
      Logger.log "Error downloading #{url}: #{e.message}"
      return nil
    end

    # Main download orchestrator
    # Tries multiple strategies: local test files, gradle, http
    # Returns: destination path if successful, nil on failure
    def self.download_file(artifact_spec)
      Logger.log "Preparing to download: #{artifact_spec[:package]}@#{artifact_spec[:version]}"

      # Try local test files first (development/testing)
      result = download_from_local_test(artifact_spec)
      return result if result

      # Try gradle if available, then fall back to HTTP
      (download_via_gradle(artifact_spec) if gradle_installed?) || download_via_http(artifact_spec)
    end

    # Unzip file to destination directory
    def self.unzip_file(zip_path, destination)
      Logger.log "Extracting to #{destination}..."

      FileUtils.mkdir_p(destination)

      Zip::File.open(zip_path) do |zip_file|
        zip_file.each do |entry|
          entry_path = File.join(destination, entry.name)
          FileUtils.mkdir_p(File.dirname(entry_path))

          # Remove existing file if it exists
          FileUtils.rm_f(entry_path) if File.exist?(entry_path)

          entry.extract(entry_path)
        end
      end

      Logger.log "Extracted successfully"
      true
    rescue => e
      Logger.log "Error extracting #{zip_path}: #{e.message}"
      return false
    end
  end
end

