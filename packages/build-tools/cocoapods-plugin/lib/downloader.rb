require 'net/http'
require 'uri'
require 'fileutils'
require 'zip'

module CocoapodsRnrepo
  class Downloader
    @@repo_url = "https://packages.rnrepo.org/releases"

    def self.validate_artifact_spec(artifact_spec, required_keys)
      missing_keys = required_keys.select { |key| !artifact_spec.key?(key) || artifact_spec[key].nil? }
      unless missing_keys.empty?
        Logger.log "Missing or empty required artifact_spec keys: #{missing_keys.join(', ')}"
        return false
      end

      true
    end

    def self.build_artifact_url(artifact_spec)
      worklets_suffix = artifact_spec[:worklets_version] ? "-worklets#{artifact_spec[:worklets_version]}" : ''
      "#{@@repo_url}/org/rnrepo/public/#{artifact_spec[:sanitized_name]}/#{artifact_spec[:version]}/#{artifact_spec[:sanitized_name]}-#{artifact_spec[:version]}-rn#{artifact_spec[:rn_version]}#{worklets_suffix}-#{artifact_spec[:configuration]}.xcframework.zip"
    end

    def self.build_http_client(uri, read_timeout)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')
      http.read_timeout = read_timeout
      http.open_timeout = 10
      http
    end

    # Check if file exists on server using HEAD request
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration, :worklets_version (optional)
    # Returns: true if file exists, false otherwise
    def self.file_exists?(artifact_spec)
      required_keys = [:sanitized_name, :version, :rn_version, :configuration]
      return false unless validate_artifact_spec(artifact_spec, required_keys)

      url = build_artifact_url(artifact_spec)
      uri = URI.parse(url)
      http = build_http_client(uri, 10)

      request = Net::HTTP::Head.new(uri.request_uri)

      begin
        response = http.request(request)
        return response.code.to_i == 200
      rescue => e
        Logger.log "Error checking file existence at #{url}: #{e.message}"
        return false
      end
    end

    # Download file via HTTP request
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration, :destination, :worklets_version (optional)
    # Returns: destination path if successful, nil on failure
    def self.download_file(artifact_spec)
      Logger.log "Preparing to download: #{artifact_spec[:package]}@#{artifact_spec[:version]}"

      required_keys = [:sanitized_name, :version, :rn_version, :configuration, :destination]
      return nil unless validate_artifact_spec(artifact_spec, required_keys)

      url = build_artifact_url(artifact_spec)
      Logger.log "Downloading from #{url}..."

      uri = URI.parse(url)
      http = build_http_client(uri, 60)

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

