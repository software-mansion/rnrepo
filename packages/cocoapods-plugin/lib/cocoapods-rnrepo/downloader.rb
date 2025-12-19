require 'net/http'
require 'uri'
require 'fileutils'
require 'zip'

module CocoapodsRnrepo
  class Downloader
    # Download file from URL
    def self.download_file(url, destination)
      # TEMPORARY: Override for testing react-native-svg with local file
      if url.include?('react-native-svg') || url.include?('rnsvg')
        local_test_file = '/tmp/RNSVG.xcframework.zip'
        if File.exist?(local_test_file)
          Logger.log "🧪 TEST MODE: Using local file instead of downloading"
          Logger.log "Copying from #{local_test_file}..."
          FileUtils.cp(local_test_file, destination)
          Logger.log "Copied successfully"
          return true
        else
          Logger.log "⚠️  Local test file not found: #{local_test_file}"
          Logger.log "Falling back to regular download..."
        end
      end
      # END TEMPORARY

      Logger.log "Downloading from #{url}..."

      uri = URI.parse(url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')

      request = Net::HTTP::Get.new(uri.request_uri)

      http.request(request) do |response|
        if response.code.to_i == 200
          File.open(destination, 'wb') do |file|
            response.read_body do |chunk|
              file.write(chunk)
            end
          end
          Logger.log "Downloaded successfully"
          return true
        else
          Logger.log "Failed to download #{url}: HTTP #{response.code}"
          return false
        end
      end
    rescue => e
      Logger.log "Error downloading #{url}: #{e.message}"
      return false
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

