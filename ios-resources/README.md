# 📦 XCFramework Build Process

This document outlines the step-by-step process for building an Apple XCFramework from a CocoaPods module — ideal for
packaging and distributing your static or dynamic library across multiple Apple platforms (e.g., iOS device and
simulator).

---

## 🧭 Overview

An XCFramework is a special bundle format introduced by Apple to support libraries that work across platforms and
architectures. This process automates assembling a single, modular XCFramework containing all needed binaries and
headers. XCFramework consits of:
- Platform-specific archives (e.g., `ios-arm64`, `ios-arm64_x86_64-simulator`)
- A common `Headers` directory containing all public headers
- `Info.plist` metadata

---

## 🛠 Prerequisites

- Node.js ≥ 18.x
- CocoaPods
- Xcode + command-line tools
- An iOS example app that includes your pod as a dependency
- A valid `.podspec` file for your module

---

## 🚦 Build Process Summary

### 1. 🧱 Prepare Environment

- Ensure your module is included in an example app via its `Podfile`
- Run `pod install` to fetch and install dependencies
- Make sure your module’s `.podspec` file exists and is valid
- Confirm the Xcode scheme of your module is:
    - Shared (visible to xcodebuild)
    - Configured with `SKIP_INSTALL = NO`
    - Configured with `BUILD_LIBRARIES_FOR_DISTRIBUTION = YES`

---

### 2. 🔍 Locate the `.podspec` File

There is `<ModuleName>.podspec` file in the given project folder. This file is used to determine:

- The source/header files used by the module (via `source_files`)
- The relative paths to key files and folders

---

### 3. 📂 Collect Header Files

Using the patterns defined in the `.podspec`'s `source_files` field:

- All relevant headers (.h files) are found and copied to a centralized headers directory (used later in packaging)

This ensures the XCFramework contains all public headers needed for consumers to integrate the library.

---

### 4. 🏗 Build Platform Archives

For each specified platform (e.g., `iphoneos`, `iphonesimulator`):

- The build system uses `xcodebuild archive` to generate a `.xcarchive`:

```bash
xcodebuild archive \
  -scheme <ModuleName> \
  -archivePath <OutputPath>.xcarchive \
  -sdk <PlatformSDK> \
  SKIP_INSTALL=NO \
  BUILD_LIBRARIES_FOR_DISTRIBUTION=YES
```

### 5. 📦 Create XCFramework

After building the archives for all platforms, the final step is to bundle them into a single XCFramework:

```bash
xcodebuild -create-xcframework \
  -library <PathToArchive1>.xcarchive/Products/usr/local/lib/lib<ModuleName>.a -headers <HeadersDir> \
  -library <PathToArchive2>.xcarchive/Products/usr/local/lib/lib<ModuleName>.a -headers <HeadersDir> \
  ... \
  -output <DestinationFolder>/<ModuleName>.xcframework
```

This command combines all platform-specific archives into a single XCFramework, ensuring it contains all necessary
binaries and headers.

### 6. 📂 Final Output
The final XCFramework is located in the specified output directory, ready for distribution and use in other projects.

Example output structure:
```
MyLibrary.xcframework/
├── ios-arm64/
│   └── libMyLibrary.a
├── ios-arm64_x86_64-simulator/
│   └── libMyLibrary.a
└── Headers/
    └── MyLibrary.h
```

