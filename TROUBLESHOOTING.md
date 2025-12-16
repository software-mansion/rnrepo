# Troubleshooting for the RNRepo

## Android Gradle Plugin

### Setting React-Native Directory
To specify a custom React-Native directory for the RNRepo plugin, you can set the `REACT_NATIVE_ROOT_DIR` environment variable or a project property. This is particularly useful if your React-Native installation is located in a non-standard path. React-Native root directory is used to resolve `node_modules/` paths and `rnrepo.config.json` file. Environment variable takes precedence over project property.
You can set the environment variable directly in your terminal before running Gradle:

```bash
REACT_NATIVE_ROOT_DIR=/path/to/your/react-native-dir ./gradlew :app:assembleDebug
```

Or you can set it in `gradle.properties` file:
```properties
REACT_NATIVE_ROOT_DIR=/path/to/your/react-native-dir
```

### Deny List Configuration
You can create a `rnrepo.config.json` file in your React-Native root directory to manage specific packages that should be excluded from automatic AAR management. The structure of the configuration file is as follows:
```json
{
  "denyList": ["react-native-reanimated", "react-native-svg"]
}
```

### Reload Cache
You can force the RNRepo plugin to re-download all dependencies by running the following command:
```bash
./gradlew :app:assembleDebug --refresh-dependencies
```

RNRepo caches downloaded AAR files and metadata in the Gradle cache directory. If you need to clear the cache, you can delete the following directories:
- `~/.gradle/caches/modules-2/metadata-2.107/descriptors/org.rnrepo.public`
- `~/.gradle/caches/modules-2/files-2.1/org.rnrepo.public`
- `~/.gradle/caches/modules-2/metadata-2.107/descriptors/org.rnrepo.tools`
- `~/.gradle/caches/modules-2/files-2.1/org.rnrepo.tools`

### Disabling the RNRepo Plugin
You can opt out of the RNRepo plugin using an environment variable `DISABLE_RNREPO`. If this variable is set to ANY value, the plugin will not execute. By default, if this variable is not set, it defaults to "false", thereby enabling the plugin execution.

```bash
DISABLE_RNREPO=true ./gradlew :app:assembleDebug
```

### Logging
To get more detailed logs from the RNRepo plugin during the build process, you can run the following command:
```bash
gradlew :app:assembleDebug --info
```
For even more detailed logs, you can use:
```bash
gradlew :app:assembleDebug --scan
```

### C++ Libraries Debug/Release Compatibility Issues
Some native libraries containing C++ code may not have stable interfaces between debug and release builds. This can cause compilation issues when building your app with prebuilt libs of different build types for its dependencies.

#### Problem Description
When building your app in debug mode (e.g., `./gradlew :app:assembleDebug`), you might encounter situations where:
- One dependency is consumed as a prebuilt AAR (release variant)
- Another dependency that depends on it is built from sources (debug variant)

This mismatch between debug and release builds can cause linker errors and compilation failures, especially with libraries that contain C++ code such as `react-native-worklets` and `react-native-reanimated`.

#### Identifying the Issue
You can identify this problem by examining the Gradle logs with the `--info` flag:
```bash
./gradlew :app:assembleDebug --info
```

Look for messages similar to:
```
[📦 RNRepo] In debug builds, react-native-worklets requires all consumer packages to be supported; otherwise, it will not be applied.
[📦 RNRepo] react-native-worklets is supported, checking if all packages depending on it are supported.
[📦 RNRepo] react-native-reanimated depending on react-native-worklets is not available as a prebuild, building react-native-worklets from sources.
```

These messages indicate that the RNRepo plugin has detected an inconsistency and is switching to building from sources to maintain compatibility.

#### Solutions
1. **Use consistent build types**: Ensure all your dependencies are either built in debug or release mode. You can configure this in your `gradle.properties` file.

2. **Add to deny list**: If you encounter persistent issues with specific C++ libraries, you can add them to the deny list in your `rnrepo.config.json` to force them to be built from sources.

3. **Review build variant configuration**: Ensure your build configuration doesn't mix debug and release builds for interdependent packages.
