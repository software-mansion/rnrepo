# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3-beta.0] - 2026-04-23

### Added
- Added support for ExpoModulesCore in Android release builds (#301)

### Changed
- Worklets classifier is no longer added in reanimated@4.3.0+ artifacts (#317)
- Incorporate RNRepo maven url inside gradle plugin (#270)

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
