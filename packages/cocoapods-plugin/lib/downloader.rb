require 'net/http'
require 'uri'
require 'fileutils'
require 'zip'
require 'open3'

module CocoapodsRnrepo
  class Downloader
    @@repo_url = "https://packages.rnrepo.org/releases"

    # Download from local test files (development/testing only)
    # Looks for files in RNREPO_BUILDS_FOLDER environment variable
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration, :destination, :worklets_version (optional)
    # Returns: destination path if successful, nil if file not found
    def self.download_from_local_test(artifact_spec)
      local_test_dir = ENV['RNREPO_BUILDS_FOLDER']
      return nil unless local_test_dir && Dir.exist?(local_test_dir)
      worklets_suffix = artifact_spec[:worklets_version] ? "-worklets#{artifact_spec[:worklets_version]}" : ''
      filename = "#{artifact_spec[:sanitized_name]}-#{artifact_spec[:version]}-rn#{artifact_spec[:rn_version]}#{worklets_suffix}-#{artifact_spec[:configuration]}.xcframework.zip"
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

    # Download file via HTTP request
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration, :destination, :worklets_version (optional)
    # Returns: destination path if successful, nil on failure
    def self.download_via_http(artifact_spec)
      required_keys = [:sanitized_name, :version, :rn_version, :configuration, :destination]
      missing_keys = required_keys.select { |key| !artifact_spec.key?(key) }
      unless missing_keys.empty?
        Logger.log "Missing required artifact_spec keys: #{missing_keys.join(', ')}"
        return nil
      end

      worklets_suffix = artifact_spec[:worklets_version] ? "-worklets#{artifact_spec[:worklets_version]}" : ''
      url = "#{@@repo_url}/org/rnrepo/public/#{artifact_spec[:sanitized_name]}/#{artifact_spec[:version]}/#{artifact_spec[:sanitized_name]}-#{artifact_spec[:version]}-rn#{artifact_spec[:rn_version]}#{worklets_suffix}-#{artifact_spec[:configuration]}.xcframework.zip"
      Logger.log "Downloading from #{url}..."

      uri = URI.parse(url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')
      http.read_timeout = 60
      http.open_timeout = 10

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
    # Tries multiple strategies: local test files, http
    # Returns: destination path if successful, nil on failure
    def self.download_file(artifact_spec)
      Logger.log "Preparing to download: #{artifact_spec[:package]}@#{artifact_spec[:version]}"

      # Try local test files first (development/testing)
      result = download_from_local_test(artifact_spec)
      return result if result

      download_via_http(artifact_spec)
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

