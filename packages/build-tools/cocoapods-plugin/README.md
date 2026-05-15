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
   - Points vendored_frameworks to `.rnrepo-cache/Current/` (symlink created at build time)

3. **Post-Install Hook**:
   - Adds build phase scripts to each pod target using pre-built frameworks
   - Scripts run before compilation and create a `Current` symlink pointing to `Debug` or `Release` based on `$CONFIGURATION`
   - Ensures the correct framework configuration is used at build time

### Framework Storage

Pre-built frameworks are cached locally with separate Debug and Release configurations.

By default, artifacts are stored directly inside each package's directory:

```
node_modules/
  └── {package-name}/
      └── .rnrepo-cache/
          ├── Debug/
          │   └── {package-name}.xcframework/
          ├── Release/
          │   └── {package-name}.xcframework/
          └── Current/  (symlink created at build time → Debug or Release)
```

### Custom Cache Directory

If you want to store downloaded artifacts outside of `node_modules` (for example to share them across projects, keep them in CI cache, or avoid committing them to version control), you can configure a custom cache directory in two ways:

**Option 1 — `rnrepo.config.json`** (recommended for permanent configuration):

```json
{
  "cacheDir": "/path/to/shared/cache"
}
```

**Option 2 — `RNREPO_CACHE_DIR` environment variable** (useful for one-off overrides or CI pipelines):

```bash
RNREPO_CACHE_DIR=/path/to/shared/cache pod install
```

When either is set, artifacts are stored under `<cache-dir>/.rnrepo-cache/{package-name}/` and a symlink is created at `node_modules/{package-name}/.rnrepo-cache` pointing to that location so CocoaPods can still locate the frameworks. The layout inside is the same as above.

The `RNREPO_CACHE_DIR` environment variable takes priority over `cacheDir` in `rnrepo.config.json`.

This is particularly useful in CI environments where you can restore/save the cache directory between runs to avoid re-downloading unchanged frameworks.

> **Switching cache modes:** If you switch between a custom cache directory and the default mode, existing cached directories in `node_modules` will be replaced with symlinks (or vice versa) automatically on the next `pod install`.
