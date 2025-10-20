#!/usr/bin/env ruby
require 'optparse'
require 'xcodeproj'

options = {}

OptionParser.new do |opts|
  opts.banner = "Usage: add_xcframework.rb -p PROJECT.xcodeproj -f PATH.xcframework [--target TARGET_NAME]"

  opts.on("-p", "--project PATH", "Path to the .xcodeproj file") do |p|
    options[:project_path] = p
  end

  opts.on("-f", "--framework PATH", "Path to the .xcframework (relative or absolute)") do |f|
    options[:framework_path] = f
  end

  opts.on("-t", "--target NAME", "Name of the target to add the XCFramework to") do |t|
    options[:target_name] = t
  end

  opts.on("-h", "--help", "Show this help message") do
    puts opts
    exit
  end
end.parse!

[:project_path, :framework_path].each do |key|
  unless options[key]
    abort("❌ Missing required argument: #{key}. Use --help for usage.")
  end
end

project_path     = options[:project_path]
xcframework_path = options[:framework_path]

puts "Project Path:     #{project_path}"
puts "XCFramework Path: #{xcframework_path}"

project = Xcodeproj::Project.open(project_path)

app_targets = project.targets.reject { |t| t.name.include?("Tests") || t.symbol_type == :static_library }

target =
  if options[:target_name]
    project.targets.find { |t| t.name == options[:target_name] } || abort("❌ Target '#{options[:target_name]}' not found in project.")
  elsif app_targets.size == 1
    app_targets.first
  elsif app_targets.size > 1
    target_names = app_targets.map(&:name).join(', ')
    abort("❌ Multiple targets found (#{target_names}). Please specify one with --target TARGET_NAME.")
  else
    abort("❌ No suitable targets found in the Xcode project.")
  end

puts "Selected Target: #{target.name}"

frameworks_group = project.main_group['Frameworks'] || project.main_group.new_group('Frameworks')

xcframework_ref = project.files.find { |f| f.path == xcframework_path }
xcframework_ref ||= frameworks_group.new_file(xcframework_path)

frameworks_phase = target.frameworks_build_phases
unless frameworks_phase.files_references.include?(xcframework_ref)
  frameworks_phase.add_file_reference(xcframework_ref, true)
end

embed_phase = target.copy_files_build_phases.find { |p| p.name == 'Embed Frameworks' }
unless embed_phase
  embed_phase = target.new_copy_files_build_phase('Embed Frameworks')
  embed_phase.symbol_dst_subfolder_spec = :frameworks
end

unless embed_phase.files_references.include?(xcframework_ref)
  build_file = embed_phase.add_file_reference(xcframework_ref, true)
  build_file.settings = { 'ATTRIBUTES' => ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] }
end

project.save

puts "Successfully added '#{xcframework_path}' to target '#{target.name}' in project '#{project_path}'."
