# Buildle

## Contents

- [Android](#android)
- [iOS](#ios)
    - [Creating `.xcframework` binary from library files](ios-resources/README.md)
    - [Using script to create xcframework](#using-script-to-create-xcframework)
    - [Using script to include xcframework](#using-script-to-include-xcframework)

## Android

**📖 Comprehensive Guide**: See detailed documentation at [android-resources/README.md](android-resources/README.md)

Buildle provides an automated system for building and integrating React Native packages as AAR (Android Archive) files, dramatically improving build performance by eliminating source compilation.

### Quick Start

1. **Install project dependencies:**
   ```bash
   npm install
   ```

2. **Install the Gradle plugin** (one-time setup):
   ```bash
   cd android-resources/gradle-plugin/buildle-plugin
   ./gradlew publishToMavenLocal
   ```

3. **Add plugin to your project's `android/build.gradle`:**
   ```gradle
   buildscript {
       repositories {
           mavenLocal()
           google()
           mavenCentral()
       }
       dependencies {
           classpath 'com.swmansion:buildle-plugin:1.0.0'
       }
   }

   apply plugin: 'com.swmansion.buildle'

   buildle {
       packages = ['react-native-svg', '@react-native-community/slider']
       aarsDir = "android/libs"
   }
   ```

4. **Build AARs and configure your project:**
   ```bash
   # Build AARs from your existing project
   npm run build-aar -- \
     --packages "react-native-svg,@react-native-community/slider" \
     --android-project ./MyReactNativeApp

   # Configure project to use the AARs
   npm run include-aar -- \
     --packages "react-native-svg,@react-native-community/slider" \
     --android-project ./MyReactNativeApp
   ```

### Available Commands

#### Build AARs from existing project
```bash
npm run build-aar -- \
  --packages "react-native-svg,@react-native-community/slider" \
  --android-project ./MyReactNativeApp
```

#### Build AARs from npm packages
```bash
npm run npm-build-aar -- \
  --packages "react-native-vector-icons,react-native-linear-gradient" \
  --version "^10.0.0"
```

#### Configure project to use AARs
```bash
npm run include-aar -- \
  --packages "react-native-svg,react-native-vector-icons" \
  --android-project ./MyReactNativeApp
```

### How It Works

The AAR integration process follows these steps:

1. **Build AAR files**: Each React Native package gets compiled into a standalone `.aar` file using a temporary build environment
2. **Package detection**: The system scans each package to find the main ReactPackage class (the entry point for React Native modules)
3. **Setup repositories**: Your project's Gradle configuration gets updated to look for AAR files in the `android/libs` directory
4. **Disable autolinking**: A `react-native.config.js` file is generated to prevent React Native from trying to auto-link the packages
5. **Register packages**: Your `MainApplication.kt` file gets updated with code to manually load and register each AAR package


## IOS

### Creating `.xcframework` binary from library files

In order to pack chosen library's native code into `.xcframework` binary, you can either:

- Use script provided by this repository (see [usage](#using-script-to-create-xcframework))
- Use `xcodebuild` command to create `.xcframework` manually (see [writeup](ios-resources/README.md) on whole process).

### Using script to create xcframework

Install project dependencies:

```bash
npm install
```

#### Usage

```bash
npm run build-xcf --  \
  --module MyLibrary \
  --ios-project ./example/ios \
  --output ./dist \
  --project ./libs/MyLibrary \
  --platforms iphonesimulator,iphoneos
```

```bash
npm run build-xcf -- \
  -p ~/react-native-svg \
  -i ~/react-native-svg/apps/fabric-example/ios \
  -m RNSVG  
```

#### Options

| Option                 | Alias | Description                                                                   |
|------------------------|-------|-------------------------------------------------------------------------------|
| `--module <name>`      | `-m`  | **(Required)** Name of the module (matching the podspec name)                 |
| `--ios-project <path>` | `-i`  | **(Required)** Path to the `ios/` directory of your example app               |
| `--output <path>`      | `-o`  | Destination directory for the generated `.xcframework` (default: `.`)         |
| `--project <path>`     | `-p`  | Path to the root project that contains the `.podspec` (default: `.`)          |
| `--platforms <list>`   |       | Comma-separated list of build platforms (default: `iphonesimulator,iphoneos`) |
| `--skip-pods`          |       | If set, skips `pod install` (useful if already installed)                     |

### Using script to include xcframework

You will need Ruby to use the script.

Install project dependencies (be sure to install `xcodeproj` and `optparse` gems as well):

```bash
npm install
[sudo] gem install optparse xcodeproj 
```

Then run the script:

```bash
npm run include-xcf -- \
  --target YourAppTarget \
  --ios-project ./example/ios \
  --xcframework ./dist/MyLibrary.xcframework
```

Target is the name of the target in your Xcode project where you want to include the `.xcframework`. It's optional, if
not provided it will default to the first target found in the project. If there are multiple targets the script will
fail, you can specify the one you want to include the `.xcframework` in via `--target` option.

```bash
npm run include-xcf -- \
  --project ~/react-native-reanimated/apps/fabric-example/ios/FabricExample.xcodeproj \ 
  --framework ~/buildle/RNReanimated.xcframework
```


#### Options

| Option      | Alias | Description                                                                             |
|-------------|-------|-----------------------------------------------------------------------------------------|
| --project   | -p    | Path to the .xcodeproj file (**required**)                                              |
| --framework | -f    | Path to the .xcframework file (absolute or relative) (**required**)                     |
| --target    | -t    | Name of the Xcode target to apply the framework to (required if multiple targets exist) |
| --help      | -h    | Show usage help and exit                                                                |

### Using script to create xcframework from npm package

Install project dependencies (be sure to install `xcodeproj` and `optparse` gems as well):

```bash
npm install
[sudo] gem install optparse xcodeproj 
```

Then run the script:

```bash
npm run npm-build-xcf -- \
  --package react-native-reanimated
```

#### Options

| Option      | Alias | Description                                                                             |
|-------------|-------|-----------------------------------------------------------------------------------------|
| --package   | -p    | NPM package to create .xcframework for. Has to contain valid podspec file.              |

### Using script to upload xcframework to Reposilite

Upload a built `.xcframework` to a Reposilite Maven repository with version information:

```bash
npm run upload-xcf -- \
  --framework ./RNSVG.xcframework \
  --name RNSVG \
  --lib-version 15.0.0 \
  --rn-version 0.80.1 \
  --repository https://repo.example.com/releases \
  --username admin \
  --password secret
```

This uploads as `RNSVG-15.0.0-rn0.80.1.xcframework` to Maven path `com/swmansion/buildle/RNSVG/15.0.0-rn0.80.1/`

#### Options

| Option           | Alias | Description                                                     |
|------------------|-------|-----------------------------------------------------------------|
| --framework      | -f    | Path to .xcframework (**required**)                             |
| --name           | -n    | Framework name (e.g., RNSVG) (**required**)                     |
| --lib-version    | -l    | Library version (e.g., 15.0.0) (**required**)                   |
| --rn-version     | -v    | React Native version (e.g., 0.80.1) (**required**)              |
| --repository     | -r    | Reposilite repository URL (**required**)                        |
| --username       | -u    | Repository username                                             |
| --password       | -p    | Repository password                                             |
| --group          | -g    | Maven group ID (default: `com.swmansion.buildle`)               |
