<<<<<<< rolkrado/migrate-to-system-curl
require 'fileutils'
require 'zip'
=======
require 'net/http'
require 'uri'
>>>>>>> main

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
      "#{@@repo_url}/org/rnrepo/public/#{artifact_spec[:sanitized_name]}/#{artifact_spec[:version]}/#{artifact_spec[:sanitized_name]}-#{artifact_spec[:version]}-rn#{artifact_spec[:rn_version]}#{worklets_suffix}-#{artifact_spec[:configuration]}.zip"
    end

    # Download file via curl
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration, :destination, :worklets_version (optional)
    # Returns: destination path if successful, nil on failure
    def self.download_file(artifact_spec)
      Logger.log "Preparing to download: #{artifact_spec[:package]}@#{artifact_spec[:version]}"

      required_keys = [:sanitized_name, :version, :rn_version, :configuration, :destination]
      return nil unless validate_artifact_spec(artifact_spec, required_keys)

      url = build_artifact_url(artifact_spec)
      Logger.log "Downloading from #{url}..."

      success = system("curl", "-s", "-S", "-f", "-L", "--connect-timeout", "15", "--max-time", "300", "-o", artifact_spec[:destination], url)

      if success
        return artifact_spec[:destination]
      else
        Logger.log "Failed to download #{url}"
        return nil
      end
    rescue => e
      Logger.log "Error downloading #{url}: #{e.message}"
      return nil
    end

    # Unzip file to destination directory
    def self.unzip_file(zip_path, destination)
      Logger.log "Extracting to #{destination}..."
      success = system("unzip", "-oq", zip_path, "-d", destination)
      Logger.log success ? "Extracted successfully #{zip_path}" : "Error extracting #{zip_path}"
      success
    end
  end
end

