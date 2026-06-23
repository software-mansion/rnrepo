# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Add support for allowList in `rnrepo.config.json` (#383)

### Fixed
- Fix Android substitution prefix matching (#385)

## [0.1.5] - 2026-06-12

### Changed
- Allow caching iOS artifacts in a custom path to simplify CI caching (#338)

### Fixed
- Resolve worklets framework module map (#352)
- Detect debug configuration using GCC preprocessor definitions (#367)
- Run C++ dependencies check sequentially instead of in parallel (#372)
- Fix corrupted Pods.xcodeproj caused by iOS build-phase UUID collisions (#373)

## [0.1.4] - 2026-05-21

### Added
- Support react-native-tvos on iOS by stripping pre-release version suffixes (#345)

### Changed
- Resolve Gradle repositories once instead of per-package check for improved build performance (#337)
- Handle Xcode settings in both array and string formats (#330)
- iOS CocoaPods more robust in resolving `rnrepo.config.json` (#346)

## [0.1.3-beta.0] - 2026-04-30

### Added
- Added support for ExpoModulesCore in Android release builds (#301)
- Allow Android packages to be resolved from locations beyond `node_modules` (#328)

### Changed
- Worklets classifier is no longer added in reanimated@4.3.0+ artifacts (#317)
- Incorporate RNRepo maven url inside gradle plugin (#270)
- iOS plugin looks now for artifacts named '<>.xcframework.zip' (#327)

### Fixed
- Added dummy header for iOS pods source_files (#311)

## [0.1.2-beta.0] - 2026-03-26

### Changed 
- Updated Gradle plugin resolution to use names without version regex (#299)

### Removed
- Removed version numbers from both Android and iOS plugins (#299)

## [0.1.1-beta.0] - 2026-03-19

### Changed
- Replace the rubyzip dependency with system("unzip", ...) (#287)
- Replace the net/http dependency with system("curl", ...) (#293)

### Fixed
- Propagate RNWorklets paths and flags to ExpoModulesCore for expo@55 (#281)
- Fallback to worklets from sources in Android for expo@55 due to hardcoded path (#281)

## [0.1.0] - 2026-03-03

### Added

- Initial release
