# frozen_string_literal: true

require 'net/http'
require 'uri'
require 'fileutils'
require 'zip'

module CocoapodsRnrepo
  # Handles artifact download and extraction for RNRepo CocoaPods integration.
  class Downloader
    @repo_url = 'https://packages.rnrepo.org/releases'

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
      "#{@repo_url}/org/rnrepo/public/#{artifact_spec[:sanitized_name]}/" \
        "#{artifact_spec[:version]}/#{artifact_spec[:sanitized_name]}-" \
        "#{artifact_spec[:version]}-rn#{artifact_spec[:rn_version]}" \
        "#{worklets_suffix}-#{artifact_spec[:configuration]}.xcframework.zip"
    end

    def self.build_http_client(uri, read_timeout)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')
      http.read_timeout = read_timeout
      http.open_timeout = 10
      http
    end

    # Download file via HTTP request
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version,
    # :configuration, :destination, :worklets_version (optional)
    # Returns: destination path if successful, nil on failure
    def self.download_file(artifact_spec)
      Logger.log "Preparing to download: #{artifact_spec[:package]}@#{artifact_spec[:version]}"

      required_keys = %i[sanitized_name version rn_version configuration destination]
      return nil unless validate_artifact_spec(artifact_spec, required_keys)

      url = build_artifact_url(artifact_spec)
      Logger.log "Downloading from #{url}..."
      download_http_file(url, artifact_spec[:destination])
    rescue StandardError => e
      Logger.log "Error downloading #{url}: #{e.message}"
      nil
    end

    # Unzip file to destination directory
    def self.unzip_file(zip_path, destination)
      Logger.log "Extracting to #{destination}..."
      FileUtils.mkdir_p(destination)

      Zip::File.open(zip_path) do |zip_file|
        zip_file.each { |entry| extract_zip_entry(destination, entry) }
      end

      Logger.log 'Extracted successfully'
      true
    rescue StandardError => e
      Logger.log "Error extracting #{zip_path}: #{e.message}"
      false
    end

    def self.download_http_file(url, destination)
      uri = URI.parse(url)
      http = build_http_client(uri, 60)
      request = Net::HTTP::Get.new(uri.request_uri)

      http.request(request) do |response|
        return handle_download_response(response, url, destination)
      end
    end

    def self.handle_download_response(response, url, destination)
      if response.code.to_i == 200
        write_response_body(response, destination)
        destination
      else
        Logger.log "Failed to download #{url}: HTTP #{response.code}"
        nil
      end
    end

    def self.write_response_body(response, destination)
      File.open(destination, 'wb') do |file|
        response.read_body do |chunk|
          file.write(chunk)
        end
      end
    end

    def self.extract_zip_entry(destination, entry)
      entry_path = File.join(destination, entry.name)
      FileUtils.mkdir_p(File.dirname(entry_path))
      FileUtils.rm_f(entry_path) if File.exist?(entry_path)
      entry.extract(entry_path)
    end
  end
end
