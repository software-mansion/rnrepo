# lists all dependencies and whether they exist in remote repo for debugging purposes
module Pod
  class Installer
    alias_method :original_install!, :install!

    def install!
      original_install!
      display_pod_dependencies_with_xcf_status
    end

    private

    def display_pod_dependencies_with_xcf_status
      main_target = pods_project.targets.find { |t| t.name.start_with?('Pods-') }
      return unless main_target

      rn_version = extract_react_native_version
      dependencies = main_target.dependencies.map(&:name).sort
      return if dependencies.empty?

      print_header(rn_version)
      xcf_status = check_xcf_availability(dependencies, rn_version)
      print_dependencies(dependencies, xcf_status)
      print_footer(dependencies.count)
    end

    def extract_react_native_version
      react_core = pod_targets.find { |pod| pod.name == 'React-Core' }
      react_core&.root_spec&.version&.to_s || 'unknown'
    end

    def check_xcf_availability(dependencies, rn_version)
      config = load_reposilite_config
      results = {}

      threads = dependencies.map do |dep|
        Thread.new do
          pod_target = pod_targets.find { |pod| pod.name == dep }
          version = pod_target&.root_spec&.version&.to_s || 'unknown'
          xcf_url = build_xcf_url(config, dep, version, rn_version)

          results[dep] = {
            version: version,
            exists: xcf_exists?(xcf_url)
          }
        end
      end

      threads.each(&:join)
      results
    end

    def load_reposilite_config
      {
        url: ENV['REPOSILITE_URL'] || 'https://repo.swmtest.xyz/releases',
        group_id: ENV['REPOSILITE_GROUP'] || 'com.swmansion.buildle'
      }
    end

    def build_xcf_url(config, name, version, rn_version)
      group_path = config[:group_id].gsub('.', '/')
      xcf_version = "#{version}-rn#{rn_version}"
      "#{config[:url]}/#{group_path}/#{name}/#{xcf_version}/#{name}-#{xcf_version}.xcframework"
    end

    def xcf_exists?(url)
      `curl -s -o /dev/null -w "%{http_code}" -I "#{url}" 2>/dev/null`.strip == "200"
    end

    def print_header(rn_version)
      puts "\n" + "="*80
      puts "POD DEPENDENCIES"
      puts "="*80
      puts "React Native: #{rn_version}"
      puts "-"*80
    end

    def print_dependencies(dependencies, xcf_status)
      dependencies.each do |dep|
        result = xcf_status[dep]
        status = result[:exists] ? "✓ [XCF]" : "✗"
        puts "  #{status} #{dep} (#{result[:version]})"
      end
    end

    def print_footer(count)
      puts "\n" + "="*80
      puts "Total pods: #{count}"
      puts "="*80 + "\n"
    end
  end
end
