# CocoaPods RNRepo Plugin

A CocoaPods plugin that automatically replaces React Native local pods with pre-built xcframeworks, fetched by **SwiftPM** at build time, from the RNRepo Maven repository.

## Overview

This plugin integrates with CocoaPods to substitute local React Native dependencies with pre-compiled xcframeworks, eliminating the need to build native modules from source.

Instead of downloading frameworks during `pod install`, at install time it only stamps a lightweight **stub xcframework** (so CocoaPods wires up the copy/link build phases) and generates a tiny **SwiftPM package** per pod whose target is a remote `.binaryTarget(url:checksum:)`. The real xcframework is downloaded, checksum-verified, and cached by SwiftPM during a build phase that runs before linking. The app links a precompiled, SwiftPM-fetched framework while still building entirely under CocoaPods.

## Installation

### Install the npm package

Add the plugin to your React Native project's dependencies:

```bash
npm install @rnrepo/build-tools
```

### Add plugin to Podfile

Add the following line at the top of your `ios/Podfile`:

```diff
+require Pod::Executable.execute_command('node', ['-p',
+  'require.resolve(
+    "@rnrepo/build-tools/cocoapods-plugin/lib/plugin.rb",
+    {paths: [process.argv[1]]},
+  )', __dir__]).strip
```

### Add the post-install hook

At the end of your `ios/Podfile`, add:

```diff
post_install do |installer|
+  rnrepo_post_install(installer)
   ...
end
```

## How It Works

The plugin hooks into the CocoaPods lifecycle:

1. **Pre-Install Hook**:

   - Scans Podfile dependencies for React Native packages
   - For each one, fetches only the **SwiftPM checksums** (tiny `.checksum` files) for the Debug and Release artifacts from RNRepo's Maven repository `https://packages.rnrepo.org/`. No xcframeworks are downloaded here, so `pod install` stays fast.

2. **Dependency Resolution** (modifies pod specs):
   - Derives the framework module name from CocoaPods (matching the name of the `.xcframework` inside the published artifact, see `builder/build-library-ios.ts`)
   - Generates a per-configuration SwiftPM package under `.rnrepo-cache/spm/{Debug,Release}/Package.swift` with a `.binaryTarget(url:checksum:)`
   - Stamps a **stub xcframework** into `.rnrepo-cache/Current/{Module}.xcframework` so CocoaPods detects the vendored framework and generates the `[CP] Copy XCFrameworks` phase
   - Points `vendored_frameworks` at `.rnrepo-cache/Current/{Module}.xcframework` and replaces the pod's sources with a dummy header

3. **Post-Install Hook**:
   - Adds a `[AA RUN FIRST] RNREPO Build Start` build phase to each prebuilt pod target, ordered before `[CP] Copy XCFrameworks`
   - The phase selects Debug/Release (via the `DEBUG=1` preprocessor define), runs `swift package resolve` so **SwiftPM downloads and checksum-verifies** the xcframework, then swaps the real artifact into `Current/`, replacing the stub before anything links
   - A content hash of the generated `Package.swift` gates the work, so unchanged builds skip resolving

### Framework Storage

Each pod gets a `.rnrepo-cache` directory holding the generated SwiftPM packages and the active xcframework. SwiftPM keeps the downloaded artifacts in its own global/per-package cache.

```
node_modules/
  └── {package-name}/
      └── .rnrepo-cache/
          ├── spm/
          │   ├── Debug/Package.swift     (.binaryTarget(url:checksum:))
          │   └── Release/Package.swift
          └── Current/
              ├── {Module}.xcframework/   (stub at install → real, SwiftPM-fetched, at build)
              ├── dummy.h
              └── .rnrepo-build-hash
```

### Publishing checksums

`.binaryTarget(url:checksum:)` requires the SHA256 checksum of the artifact. The publisher (`packages/publisher/publish-library-ios.ts`) computes it with `swift package compute-checksum` and deploys it next to each zip as a `…​.xcframework.zip.checksum` sidecar artifact, which the plugin fetches during `pod install`.

### Cache directory

By default, downloaded artifacts are cached in `~/.rnrepo-cache`. To use a custom path, set `xcframeworksCacheDir` in `rnrepo.config.json`:

```json
{
  "xcframeworksCacheDir": "/path/to/cache"
}
```

A relative path is resolved against the directory containing `rnrepo.config.json`. A path that starts with `/` (absolute) or `~` (home directory) is used as-is.

To disable caching entirely, set `xcframeworksCacheDir` to `null`:
