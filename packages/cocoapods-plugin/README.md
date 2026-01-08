# CocoaPods RNRepo Plugin

A CocoaPods plugin that automatically replaces React Native local pods with pre-built xcframeworks from the rnrepo Maven repository.

## Overview

This plugin integrates with CocoaPods to substitute local React Native dependencies with pre-compiled xcframeworks, eliminating the need to build native modules from source during every `pod install`.

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

Pre-built frameworks are cached locally with separate Debug and Release configurations:

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

## Development

To test it on a project that lives outside of RNRepo monorepo structure, you can build and install the gem locally and later import it in the Podfile:

### Build and install gem locally

```bash
cd packages/cocoapods-plugin
bun run install
```

This will automatically uninstall any previous version, build the gem, and install it.

### Update Podfile in your React Native project

Add the following line at the start of the Podfile:

```
plugin 'cocoapods-rnrepo'
```

### Install pods in your RN project

You may also want to remove the `Pods/` and the lockfile to avoid any issue (ultimately this step shouldn't be necessary):

```bash
cd ios/
rm -rf Pods/ Podfile.lock
pod install
```

The plugin runs in the install step and should replace available pre-built libraries in the `Pods.xcodeproj` to use `.xcframework` builds instead of building from source.
