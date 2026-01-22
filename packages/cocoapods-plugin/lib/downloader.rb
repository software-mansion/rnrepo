require 'net/http'
require 'uri'
require 'fileutils'
require 'zip'
require 'open3'

module CocoapodsRnrepo
  class Downloader
    @@repo_url = "https://packages.rnrepo.org/releases"
    @@gradle_executable = nil

    def self.find_gradle_executable
      android_gradlew = File.join(Dir.pwd, '..', 'android', 'gradlew')
      @@gradle_executable = (File.executable?(android_gradlew) ? android_gradlew : 'gradle')
    end

    def self.gradle_installed?
      self.find_gradle_executable
      _stdout, _stderr, status = Open3.capture3(@@gradle_executable, '-v')
      status.success?
    rescue => e
      Logger.log "Gradle check error: #{e.message}"
      false
    end

    def self.use_gradle?
      return ENV['RNREPO_IOS_USE_GRADLE'] && self.gradle_installed?
    end

    # Check if artifact exists in gradle cache
    # Looks for files in ~/.gradle/caches/modules-2/files-2.1/org.rnrepo.public/{package}/{version}/{hash}/filename
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration, :worklets_version (optional)
    # Returns: cached file path if found, nil otherwise
    def self.check_gradle_cache(artifact_spec)
      gradle_cache_base = File.expand_path('~/.gradle/caches/modules-2/files-2.1/org.rnrepo.public')
      package_cache_dir = File.join(gradle_cache_base, artifact_spec[:sanitized_name], artifact_spec[:version])

      return nil unless Dir.exist?(package_cache_dir)

      # Construct exact filename
      worklets_suffix = artifact_spec[:worklets_version] ? "-worklets#{artifact_spec[:worklets_version]}" : ''
      expected_filename = "#{artifact_spec[:sanitized_name]}-#{artifact_spec[:version]}-rn#{artifact_spec[:rn_version]}#{worklets_suffix}-#{artifact_spec[:configuration]}.xcframework.zip"

      # Look for exact filename in any hash subdirectory
      Dir.glob(File.join(package_cache_dir, '*', expected_filename)).first
    rescue => e
      Logger.log "Error checking gradle cache: #{e.message}"
      nil
    end

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

    # Download multiple files via gradle task in a single invocation
    # Requires: array of artifact_spec hashes, each with: :sanitized_name, :version, :rn_version, :configuration, :worklets_version (optional)
    # Returns: hash mapping artifact specs to their downloaded paths, or nil on failure
    def self.download_via_gradle_batch(artifact_specs)
      return nil unless self.use_gradle?
      return nil if artifact_specs.empty?
      Logger.log "Downloading #{artifact_specs.length} artifact(s) via gradle in a single invocation..."

      # Get the gem's root directory (parent of lib/)
      gem_root = File.expand_path('..', __FILE__)
      gem_gradle_file = File.join(gem_root, 'build.gradle.kts')

      unless File.exist?(gem_gradle_file)
        Logger.log "build.gradle.kts not found at #{gem_gradle_file}"
        return nil
      end

      begin
        # Build JSON with artifact specifications as a single string argument
        require 'json'
        artifacts_json = artifact_specs.map do |spec|
          {
            package: spec[:sanitized_name],
            version: spec[:version],
            rnVersion: spec[:rn_version],
            configuration: spec[:configuration],
            workletsVersion: spec[:worklets_version]
          }
        end.to_json

        gradle_args = [
          @@gradle_executable,
          '-I', gem_gradle_file,
          '-p', File.join(Dir.pwd, '..', 'android'),
          '--project-cache-dir=' + File.join(Dir.pwd, 'rnrepo', 'gradle_project_cache'),
          '--no-daemon',
          '--no-build-cache',
          'downloadArtifacts',
          "-Dartifacts=#{artifacts_json}",
          '-Durl=' + @@repo_url
        ]

        stdout, stderr, status = Open3.capture3(*gradle_args)

        if status.success?
          Logger.log "Gradle batch download completed successfully"
          return self.parse_batch_output(stdout, artifact_specs)
        else
          Logger.log "Gradle execution failed: #{stderr}"
          return nil
        end
      rescue => e
        Logger.log "Error downloading via gradle: #{e.message}"
        return nil
      end
    end

    def self.parse_batch_output(output, artifact_specs)
      result = {}
      prefix = "DOWNLOADED_FILE:"
      paths = []
      
      output.lines.each do |line|
        if line.start_with?(prefix)
          paths << line.sub(prefix, '').strip
        end
      end

      # Map paths back to artifact based on name and version
      artifact_specs.each do |spec|
        expected_filename_part = "#{spec[:sanitized_name]}-#{spec[:version]}"
        matched_path = paths.find { |p| p.include?(expected_filename_part) }
        if matched_path
          result[spec] = matched_path
        else
          Logger.log "No downloaded file found in output for #{expected_filename_part}"
        end
      end

      result
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
    # Tries multiple strategies: local test files, gradle, http
    # Returns: destination path if successful, nil on failure
    def self.download_file(artifact_spec)
      cached_gradle_path = check_gradle_cache(artifact_spec)
      if cached_gradle_path
        Logger.log "Using cached file from Gradle cache: #{cached_gradle_path}"
        return cached_gradle_path
      end

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

