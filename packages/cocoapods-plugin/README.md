# CocoaPods RNRepo Plugin

A CocoaPods plugin that automatically replaces React Native local pods with pre-built xcframeworks from the rnrepo Maven repository.

## Overview

This plugin integrates with CocoaPods to substitute local React Native dependencies with pre-compiled xcframeworks, eliminating the need to build native modules from source during every `pod install`.

## How It Works

The plugin hooks into the CocoaPods lifecycle:

1. **Pre-Install Hook**:

   - Scans Podfile dependencies for React Native packages
   - Downloads pre-built xcframeworks from RNRepo's Maven repository `https://packages.rnrepo.org/`
   - Extracts frameworks to `node_modules/{package-name}/.rnrepo-cache/`

2. **Post-Install Hook**:
   - Configures Xcode build settings to use the pre-built frameworks
   - Updates linking and search paths

### Framework Storage

Pre-built frameworks are cached locally:

```
node_modules/
  └── {package-name}/
      └── .rnrepo-cache/
          └── {package-name}.xcframework/
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
