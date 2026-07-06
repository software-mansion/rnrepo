require 'fileutils'
require 'shellwords'

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

    # The SwiftPM checksum is published next to the xcframework zip as a sidecar
    # artifact (same coordinates, `.checksum` appended). See publish-library-ios.ts.
    def self.build_checksum_url(artifact_spec)
      "#{build_artifact_url(artifact_spec)}.checksum"
    end

    # Returns the published SwiftPM checksum (SHA256 hex) for an artifact, or nil
    # if it can't be fetched. The checksum file is tiny, so this stays cheap
    # enough to run during `pod install` for every prebuilt pod.
    #
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version,
    # :configuration (and optional :worklets_version, :cache_path).
    def self.download_checksum(artifact_spec)
      required_keys = [:sanitized_name, :version, :rn_version, :configuration]
      return nil unless validate_artifact_spec(artifact_spec, required_keys)

      cache_file = nil
      if artifact_spec[:cache_path]
        cache_file = File.join(
          artifact_spec[:cache_path],
          artifact_spec[:sanitized_name],
          artifact_spec[:version],
          "#{File.basename(build_artifact_url(artifact_spec))}.checksum"
        )
        if File.exist?(cache_file)
          checksum = File.read(cache_file).strip
          return checksum unless checksum.empty?
        end
      end

      url = build_checksum_url(artifact_spec)
      checksum = `curl -s -S -f -L --connect-timeout 15 --max-time 60 #{Shellwords.escape(url)} 2>/dev/null`.strip

      if $?.success? && !checksum.empty?
        if cache_file
          FileUtils.mkdir_p(File.dirname(cache_file))
          File.write(cache_file, checksum)
        end
        return checksum
      end

      Logger.log "Checksum not available at #{url}"
      nil
    rescue => e
      Logger.log "Error downloading checksum: #{e.message}"
      nil
    end
  end
end

