# CocoaPods RNRepo Plugin

A CocoaPods plugin that automatically replaces React Native local pods with pre-built xcframeworks from the RNRepo Maven repository.

## Overview

This plugin integrates with CocoaPods to substitute local React Native dependencies with pre-compiled xcframeworks, eliminating the need to build native modules from source during every `pod install`.

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
   - Downloads **both Debug and Release** pre-built xcframeworks from RNRepo's Maven repository `https://packages.rnrepo.org/`
   - Extracts frameworks to `node_modules/{package-name}/.rnrepo-cache/Debug/` and `.rnrepo-cache/Release/`
   - If only one configuration is available, creates a symlink so both build types work

2. **Dependency Resolution** (modifies pod specs):
   - Configures pod specifications to use pre-built xcframeworks instead of source files
   - Points vendored_frameworks to `.rnrepo-cache/Current/`, a real directory holding one symlink per xcframework

3. **Post-Install Hook**:
   - Adds build phase scripts to each pod target using pre-built frameworks
   - Scripts run before compilation and repoint the symlinks in `Current` at `Debug` or `Release`, based on whether `DEBUG=1` is defined
   - Ensures the correct framework configuration is used at build time

   `Current` is always a directory and the xcframeworks inside it are always symlinks — neither ever changes type. Metro watches `node_modules` unconditionally and crashes with `tracked as a non-empty directory` if a path it holds as a directory becomes a symlink.

### Framework Storage

Pre-built frameworks are cached locally with separate Debug and Release configurations:

```
node_modules/
  └── {package-name}/
      └── .rnrepo-cache/
          ├── Debug/
          │   └── {package-name}.xcframework/
          ├── Release/
          │   └── {package-name}.xcframework/
          └── Current/
              └── {package-name}.xcframework  (symlink → ../Debug or ../Release)
```

### Cache directory

By default, downloaded artifacts are cached in `~/.rnrepo-cache`. To use a custom path, set `xcframeworksCacheDir` in `rnrepo.config.json`:

```json
{
  "xcframeworksCacheDir": "/path/to/cache"
}
```

A relative path is resolved against the directory containing `rnrepo.config.json`. A path that starts with `/` (absolute) or `~` (home directory) is used as-is.

To disable caching entirely, set `xcframeworksCacheDir` to `null`: