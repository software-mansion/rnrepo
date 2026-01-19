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

    # Download file via gradle task
    # Requires: artifact_spec hash with: :sanitized_name, :version, :rn_version, :configuration, :worklets_version (optional)
    # Returns: destination path if successful, nil on failure
    def self.download_via_gradle(artifact_spec)
      Logger.log "Downloading via gradle..."

      # Get the gem's root directory (parent of lib/)
      gem_root = File.expand_path('../../..', __FILE__)
      gem_gradle_file = File.join(gem_root, 'build.gradle.kts')

      unless File.exist?(gem_gradle_file)
        Logger.log "build.gradle.kts not found at #{gem_gradle_file}"
        return nil
      end

      begin
        gradle_args = [
          @@gradle_executable,
          '-I', gem_gradle_file,
          '-p', File.join(Dir.pwd, '..', 'android'),
          '--project-cache-dir=' + File.join(Dir.pwd, 'rnrepo', 'gradle_project_cache'),
          '--no-daemon',
          '--no-build-cache',
          'downloadArtifact',
          '-Dpackage=' + artifact_spec[:sanitized_name],
          '-Dversion=' + artifact_spec[:version],
          '-DrnVersion=' + artifact_spec[:rn_version],
          '-Dconfiguration=' + artifact_spec[:configuration],
          '-Durl=' + @@repo_url
        ]

        if artifact_spec[:worklets_version]
          gradle_args << '-DworkletsVersion=' + artifact_spec[:worklets_version]
        end
        
        stdout, stderr, status = Open3.capture3(*gradle_args)

        if status.success?
          Logger.log "Gradle download completed successfully"
          return self.find_path_in_gradle_output(stdout)
        else
          Logger.log "Gradle execution failed: #{stderr}"
          return nil
        end
      rescue => e
        Logger.log "Error downloading via gradle: #{e.message}"
        return nil
      end
    end

    def self.find_path_in_gradle_output(output)
      prefix = "DOWNLOADED_FILE:"
      output.lines.each do |line|
        if line.start_with?(prefix)
          return line.sub(prefix, '').strip
        end
      end
      nil
    end


    # Download file via HTTP request
    # Requires: artifact_spec hash with :sanitized_name, :version, :rn_version, :configuration, :destination, :worklets_version (optional)
    # Returns: destination path if successful, nil on failure
    def self.download_via_http(artifact_spec)
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

