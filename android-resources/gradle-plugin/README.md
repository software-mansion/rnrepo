# Buildle Gradle Plugin

This Gradle plugin automates the integration of pre-built React Native AARs into your Android project.

## Installation

1. Publish the plugin to local Maven (one-time setup):
   ```bash
   cd android-resources/gradle-plugin/buildle-plugin
   ./gradlew publishToMavenLocal
   ```

2. Add the plugin to your project's `android/build.gradle`:
   ```gradle
   buildscript {
       repositories {
           mavenLocal()  // Add local Maven repository
           google()
           mavenCentral()
       }
       dependencies {
           classpath 'com.swmansion:buildle-plugin:1.0.0'
       }
   }

   apply plugin: 'com.swmansion.buildle'
   ```

3. Configure the plugin:
   ```gradle
   buildle {
       packages = ['react-native-svg', '@react-native-community/slider']
       aarsDir = "android/libs"
   }
   ```

## Usage

### Setup AAR Integration
Run this command to generate configuration files:
```bash
./gradlew setupAars
```

This will:
- Generate `react-native.config.js` to disable autolinking for AAR packages
- Update `MainApplication.kt` with package registration code
- Configure Gradle dependencies for AAR files

### Switch Between AAR and Source
To use AARs:
```gradle
buildle {
    packages = ['react-native-svg']
}
```

To use source compilation:
```gradle
buildle {
    packages = []
}
```

Run `./gradlew setupAars` after making changes.

## Generated Files

### `react-native.config.js`
```javascript
module.exports = {
  dependencies: {
    "react-native-svg": {
      "platforms": { "android": null }
    }
  }
};
```

### `MainApplication.kt` additions
```kotlin
// AAR automation - auto-generated package registration
if (BuildConfig.USE_PREBUILT_AARS) {
  try {
    val reactnativesvgClass = Class.forName("com.horcrux.svg.SvgPackage")
    add(reactnativesvgClass.newInstance() as ReactPackage)
  } catch (e: Exception) {
    android.util.Log.e("MainApplication", "Failed to load AAR: ${e.message}")
  }
}
```

## Requirements

- AAR files must be placed in the configured `aarsDir` (default: `android/libs/`)
- AAR files must follow the naming convention: `package-name.aar` or `scope_package.aar`
- React Native packages must follow standard ReactPackage patterns

## Plugin Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `packages` | `List<String>` | `[]` | Packages to load from AARs |
| `aarsDir` | `String` | `"android/libs"` | Directory containing AAR files |

## Troubleshooting

1. **Package not detected**: Ensure the ReactPackage class follows standard patterns
2. **AAR not found**: Check the AAR file name matches the converted package name
3. **Build errors**: Run `./gradlew clean` and rebuild after configuration changes

## Plugin Information

- **Group**: `com.swmansion`
- **Artifact**: `buildle-plugin`
- **Version**: `1.0.0`
- **Plugin ID**: `com.swmansion.buildle`