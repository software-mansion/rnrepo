# Builder Package

This package contains tools for building React Native Android libraries into AAR (Android Archive) artifacts.

## Overview

The builder package automates the process of building React Native libraries for Android by:
1. Creating a temporary React Native project
2. Installing the target library
4. Building the library into an AAR artifact
5. Publishing to Maven Local repository

## Commands

### Build Library for Android

Builds a React Native library into an AAR artifact:

```bash
bun run build-android <library-name> <library-version> <react-native-version> <work-dir> [worklets-version]
```

**Parameters:**
- `library-name` - NPM package name (e.g., `react-native-screens`)
- `library-version` - NPM package version (e.g., `4.18.1`)
- `react-native-version` - React Native version to build against (e.g., `0.79.0`)
- `work-dir` - Temporary working directory for the build
- `worklets-version` - (Optional) React Native Worklets version (e.g., `0.5.1`)

### Check Library Buildability

Verifies if a library can be built by checking for compile-time structural requirements like:
- Presence of native code
- Compatibility with New Architecture
- Custom gradle plugins
- Custom scripts
- C++ code
- `externalNativeBuild` settings
- Dependencies on other libraries

```bash
bun run check-library <library-name> <library-version> [work-dir]
```

**Parameters:**
- `library-name` - Name of the library to check
- `library-version` - Version of the library to check
- `work-dir` - Path to the directory where the library will be checked (optional, defaults to current directory)
