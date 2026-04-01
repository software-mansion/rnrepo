# Troubleshooting for the RNRepo

## Common Issues

### Deny List Configuration
You can create a `rnrepo.config.json` file in your React-Native root directory to manage specific packages that should be excluded from automatic AAR management. The structure of the configuration file is as follows:
```json
{
  "denyList": {
    "android": ["library-name-1", "library-name-2"],
    "ios": ["library-name-3", "library-name-4"]
  }
}
```

### Disabling the RNRepo Plugin
You can opt out of the RNRepo plugin using an environment variable `DISABLE_RNREPO`. If this variable is set to ANY value, the plugin will not execute. By default, if this variable is not set, it defaults to enabling the plugin execution.

Android:
```bash
DISABLE_RNREPO=true ./gradlew :app:assembleDebug
```

iOS requires running pod install to disable the plugin:
```bash
DISABLE_RNREPO=true pod install
```

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

### Logging
To get more detailed logs from the RNRepo plugin during the build process, you can run the following command:
```bash
gradlew :app:assembleDebug --info
```
For even more detailed logs, you can use:
```bash
gradlew :app:assembleDebug --scan
```

### Plugin Executing at Wrong Time
The RNRepo plugin is designed to execute only during actual build operations. If you're running commands like `test`, `clean`, `lint`, or other non-building tasks, the plugin should automatically skip execution. However, if the plugin is executing when it shouldn't, you can force it to disable.

#### Problem Description
If you notice the RNRepo plugin is executing during tasks that shouldn't trigger a build (such as running tests or cleaning the build directory), this could cause unnecessary overhead or conflicts with other tasks.

#### Solution
You can disable the RNRepo plugin for a specific command by setting the `DISABLE_RNREPO` environment variable to any value:

```bash
DISABLE_RNREPO=true ./gradlew clean
```

Or for test execution:
```bash
DISABLE_RNREPO=true ./gradlew test
```

This environment variable takes precedence and will completely skip the RNRepo plugin setup regardless of the Gradle task being executed. The variable works with any value - it just needs to be set.

Currently known non-building commands that the RNRepo plugin recognizes include:
- test, signing, clean, clear, init, dependencies, tasks, projects, connected, device, lint, check, properties, help

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

### Duplicate Native Library Files (.so) Conflicts

#### Problem Description
When building your Android app, you might encounter an error about duplicate native library files being found in different locations:

```
Caused by: com.android.builder.merge.DuplicateRelativeFileException: 2 files found with path 'lib/arm64-v8a/libName.so' from inputs:
 - /path/to/node_modules/react-native-some-package/android/build/intermediates/library_jni/debug/copyDebugJniLibsProjectOnly/jni/arm64-v8a/libName.so
 - /path/to/.gradle/caches/.../react-native-some-package-0.0.0-rn0.81.4/jni/arm64-v8a/libName.so
```

This error occurs when:
1. A library built from sources includes native code from a provider library
2. The Gradle build system encounters duplicate `.so` files in different locations during the merge phase

#### Automatic Solution
The RNRepo plugin automatically detects when a provider library (e.g., `react-native-worklets`) is present. When this happens, it adds `pickFirsts` configuration for all native library files of the provider to resolve the conflict gracefully.

**Supported providers that are automatically handled:**
- `react-native-worklets` (provider) → pickFirsts for `libworklets.so`
- `react-native-nitro-modules` (provider) → pickFirsts for `libNitroModules.so`

If other libraries cause similar issues, please report them so they can be added to the automatic handling list.

### No Supported Packages Found or Empty Repository List

#### Problem Description
You might encounter a situation where the RNRepo plugin reports that no packages are supported or no repositories could be found:

```
[📦 RNRepo] Found the following supported prebuilt packages: None
```

Or in info logs:
```
[📦 RNRepo] HTTP RNRepo repositories to check: <no repositories listed>
```

This typically means that:
1. Your project has packages that could be prebuilt, but none are being recognized as supported (i.e., unsupported packages/versions, or all are in the deny list)
2. The plugin cannot find any configured Maven repositories pointing to the RNRepo registry
3. The RNRepo plugin is being applied before the Maven repository is defined in your `build.gradle` file

#### Solution
Ensure that your `build.gradle` applies the RNRepo plugin **after** defining the RNRepo maven repository. This ensures the RNRepo Maven repository is available to all subprojects, including your app module, before the RNRepo plugin attempts to check package availability.

### How to check if the plugin works?

Run `npm run android` and observe the terminal output and build folders. Compare your results with the table below:

| Step | Basic Build | RNRepo Build |
| :--- | :--- | :--- |
| **Gradle Preparation** | No specific logs. | RNRepo logs the supported packages, e.g. <br> `[📦 RNRepo] Found the following supported prebuilt packages:`<br> `📦 react-native-safe-area-context@5.7.0` |
| **Build Phase** | Gradle prints compilation tasks:<br>`> Task :react-native-safe-area-context:compileDebugKotlin` | **No compilation tasks** for substituted RN packages. |

#### Filesystem Impact
Check the `android/build` folder for a specific package (inside node_modules):

* **Basic build:** Contains full compilation artifacts in directories like `generated`, `intermediates`, `kotlin`, `outputs`, and `tmp`.
* **RNRepo build:** Shows **only** the `generated` directory (containing codegen artifacts).

---

## iOS CocoaPods Plugin

### Xcode Version Mismatch (Xcode < 26)

#### Problem Description
Prebuilt frameworks are compiled using Xcode 26. If your application is being compiled with an older version of Xcode, it might not work correctly. The prebuilt libraries might not be compatible because they might utilize newer APIs or language features that are missing or incompatible in older Xcode versions.

#### Identifying the Problematic Package
When the build fails with linker errors, you can identify which package is causing the issue by inspecting the error output. Look for `Undefined symbols` errors that reference specific files e.g.:

```
Undefined symbols for architecture arm64:
  "_OBJC_CLASS_$_UITabAccessory", referenced from:
      objc-class-ref in RNScreens(RNSTabsHostComponentView.o)
  "_OBJC_CLASS_$_UITraitTabAccessoryEnvironment", referenced from:
      objc-class-ref in RNScreens(RNSTabsBottomAccessoryHelper.o)
ld: symbol(s) not found for architecture arm64
```

The `.o` filename (e.g., `RNSTabsBottomAccessoryHelper.o`) points to a source file in one of your packages. Search for it in `node_modules` to identify which package to add to the deny list:

```bash
find ./node_modules -path "*RNSTabsBottomAccessoryHelper*"
# Output: ./node_modules/react-native-screens/ios/tabs/bottom-accessory/RNSTabsBottomAccessoryHelper.mm
```

In this example, `react-native-screens` is the culprit — which could be resolved by adding to the deny list in `rnrepo.config.json`.

#### Solutions
There are three primary ways to solve this issue:
1. **Upgrade your Xcode version (recommended)**: Update your build environment so that the Xcode version you use to compile your app is greater than or equal to the Xcode version used to build the precompiled frameworks (currently Xcode 26). This keeps your dependencies and build toolchain aligned without changing library versions.
2. **Downgrade the library version (if available)**: Switch to a lower version of the library whose prebuilt binaries were produced with an older Xcode that is compatible with your environment. This only works if such an older prebuilt exists in the RNRepo registry.
3. **Add to deny list**: If downgrading is not an option, you can add the library to the `denyList` under `ios` in your `rnrepo.config.json`. This forces standard compilation from sources using your current Xcode version instead of pulling the precompiled framework.

### How to check if the plugin works?

Run building commands and monitor the terminal output:

| Step | Basic Build | RNRepo Build |
| :--- | :--- | :--- |
| **Pod Installation** | Standard CocoaPods output. | RNRepo logs:<br>`[📦 RNRepo] Total React Native dependencies detected: 1`<br>`[📦 RNRepo] ⬇ Downloaded from Maven...`<br>`[📦 RNRepo] • react-native-safe-area-context`<br>`[📦 RNRepo] Added build phase to <package-name>` |
| **Build Phase** | Xcode compiles all source files:<br>`▸ Compiling RNCSafeAreaContext.mm`<br>`▸ Building library libreact-native-safe-area-context.a` | Xcode compiles **only** JSI glue code:<br>`▸ Compiling safeareacontextJSI-generated.cpp`<br>`▸ Compiling safeareacontext-generated.mm` |

#### Filesystem Impact

* **Basic build:**
    * Copies headers to `Pods/Headers/Public` and `Pods/Headers/Private`.
    * Copies the built library to `Xcode/DerivedData`, e.g.:
        ```bash
        ls ~/Library/Developer/Xcode/DerivedData/<project-name>-<hash>/Build/Products/Debug-iphonesimulator/react-native-safe-area-context
        
        Output:
        libreact-native-safe-area-context.a
        ```
* **RNRepo build:**
    * Copies only JSI glue code to `Pods/<pod-name>/<architecture>/<pod-name>.framework`.
    * Keeps the prebuilt framework in `XCFrameworkIntermediates`, e.g.:
        ```bash
        ls ~/Library/Developer/Xcode/DerivedData/<project-name>-<hash>/Build/Products/Debug-iphonesimulator/XCFrameworkIntermediates/react-native-safe-area-context
        
        Output:
        common    react_native_safe_area_context.framework    fabric
        ```

---
