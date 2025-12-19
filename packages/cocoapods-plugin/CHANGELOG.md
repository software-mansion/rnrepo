# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-12-17

### Added

- Initial release of cocoapods-rnrepo plugin
- Automatic detection of React Native packages in node_modules
- Download and extraction of pre-built xcframeworks from Maven repository
- Smart pod replacement during CocoaPods installation
- Local caching of downloaded frameworks
- Support for packages with various naming patterns (React*, RN*, react-native-\*)
- Pre-install and post-install hooks for seamless integration

### Features

- Downloads pre-built frameworks from https://packages.rnrepo.org/snapshots/org/rnrepo
- Stores frameworks in node_modules/{package}/.rnrepo-cache/
- Automatically configures Xcode build settings
- Graceful fallback if pre-built framework not available
