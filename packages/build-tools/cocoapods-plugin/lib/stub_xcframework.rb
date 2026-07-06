require 'fileutils'

module CocoapodsRnrepo
  # Materializes a *stub* xcframework so CocoaPods detects the pod as a vendored
  # framework and generates the "[CP] Copy XCFrameworks" build phase — even
  # though the real binary isn't on disk yet at `pod install` time. The real
  # xcframework is fetched by SwiftPM during the build phase (see SpmPackage)
  # and replaces this stub before any consumer compiles.
  #
  # This mirrors Expo's create-stub-xcframework.sh, but produces *static*
  # archive stubs to match the static frameworks RNRepo publishes (so CocoaPods
  # links them statically and skips the embed phase).
  class StubXcframework
    # Slice IDs the stub declares. RNRepo libraries target iOS, so we stamp the
    # device and simulator slices every RN app builds. The real xcframework's
    # own Info.plist replaces this one at build time, so additional slices it
    # ships (e.g. tvOS/Catalyst) are picked up then; declaring more here would
    # only wire up copy phases for platforms the prebuilt artifact may not cover.
    DEFAULT_SLICES = [
      { id: 'ios-arm64',                    platform: 'ios', variant: nil,         archs: %w[arm64] },
      { id: 'ios-arm64_x86_64-simulator',   platform: 'ios', variant: 'simulator', archs: %w[arm64 x86_64] },
    ].freeze

    # Creates (or refreshes) a stub xcframework at `xcframework_path` whose
    # inner framework bundle is named `framework_name`. Existing real slice
    # binaries are left untouched; only missing slices are stamped. The
    # Info.plist is always rewritten from whatever slices end up on disk.
    def self.create(xcframework_path, framework_name, slices: DEFAULT_SLICES)
      FileUtils.mkdir_p(xcframework_path)

      stub_binary = build_stub_binary(xcframework_path, framework_name)

      slices.each do |slice|
        framework_dir = File.join(xcframework_path, slice[:id], "#{framework_name}.framework")
        binary_path = File.join(framework_dir, framework_name)
        FileUtils.mkdir_p(framework_dir)
        FileUtils.cp(stub_binary, binary_path) unless File.exist?(binary_path)
      end

      FileUtils.rm_f(stub_binary)

      write_info_plist(xcframework_path, framework_name, slices)
      xcframework_path
    end

    # Compiles a single static-archive stub binary and returns its path. The
    # binary is never linked against — CocoaPods only inspects it at install
    # time to classify the framework as static; the real one replaces it before
    # the build links anything.
    def self.build_stub_binary(xcframework_path, framework_name)
      stub_object = File.join(xcframework_path, '.stub.o')
      stub_archive = File.join(xcframework_path, '.stub-binary')

      # Compile an empty translation unit, then wrap it in an `ar` archive so
      # `file`/Mach-O detection reports a static library (matches RNRepo's
      # static frameworks).
      ok = system('clang', '-x', 'c', '-c', '-', '-o', stub_object, in: '/dev/null')
      raise "RNRepo: failed to compile stub object for #{framework_name} (is the Xcode command line toolchain installed?)" unless ok

      FileUtils.rm_f(stub_archive)
      ok = system('ar', 'crs', stub_archive, stub_object)
      raise "RNRepo: failed to archive stub binary for #{framework_name}" unless ok

      FileUtils.rm_f(stub_object)
      stub_archive
    end

    def self.write_info_plist(xcframework_path, framework_name, slices)
      libraries = slices.map do |slice|
        archs = slice[:archs].map { |a| "        <string>#{a}</string>" }.join("\n")
        variant = ''
        if slice[:variant]
          variant = "      <key>SupportedPlatformVariant</key>\n      <string>#{slice[:variant]}</string>\n"
        end
        <<~DICT.chomp
              <dict>
                <key>BinaryPath</key>
                <string>#{framework_name}.framework/#{framework_name}</string>
                <key>LibraryIdentifier</key>
                <string>#{slice[:id]}</string>
                <key>LibraryPath</key>
                <string>#{framework_name}.framework</string>
                <key>SupportedArchitectures</key>
                <array>
          #{archs}
                </array>
                <key>SupportedPlatform</key>
                <string>#{slice[:platform]}</string>
          #{variant}      </dict>
        DICT
      end.join("\n")

      plist = <<~PLIST
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
          <key>AvailableLibraries</key>
          <array>
        #{libraries}
          </array>
          <key>CFBundlePackageType</key>
          <string>XFWK</string>
          <key>XCFrameworkFormatVersion</key>
          <string>1.0</string>
        </dict>
        </plist>
      PLIST

      File.write(File.join(xcframework_path, 'Info.plist'), plist)
    end
  end
end
