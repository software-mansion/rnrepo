# Settings for RNRepo Plugin in React-Native Android Projects

## Setting React-Native Directory
To specify a custom React-Native directory for the RNRepo plugin, you can set the `REACT_NATIVE_ROOT_DIR` environment variable or a project property. This is particularly useful if your React-Native installation is located in a non-standard path. React-Native root directory is used to resolve `node_modules/` paths and `rnrepo.config.json` file. Environment variable takes precedence over project property.
You can set the environment variable directly in your terminal before running Gradle:

```bash
REACT_NATIVE_ROOT_DIR=/path/to/your/react-native-dir ./gradlew :app:assembleDebug
```

Or you can set it in `gradle.properties` file:
```properties
REACT_NATIVE_ROOT_DIR=/path/to/your/react-native-dir
```

## Deny List Configuration
You can create a `rnrepo.config.json` file in your React-Native root directory to manage specific packages that should be excluded from automatic AAR management. The structure of the configuration file is as follows:
```json
{
  "denyList": ["react-native-reanimated", "react-native-svg"]
}
```

## Deleting RNRepo Cache
// TODO(rolkrado): do we want to mention the gradle task here (and create such task)?
You can force the RNRepo plugin to re-download all dependencies by running the following command:
```bash
./gradlew :app:assembleDebug --refresh-dependencies
```

RNRepo caches downloaded AAR files and metadata in the Gradle cache directory. If you need to clear the cache, you can delete the following directories:
- `~/.gradle/caches/modules-2/metadata-2.107/descriptors/org.rnrepo.public`
- `~/.gradle/caches/modules-2/files-2.1/org.rnrepo.public`
- `~/.gradle/caches/modules-2/metadata-2.107/descriptors/org.rnrepo.tools`
- `~/.gradle/caches/modules-2/files-2.1/org.rnrepo.tools`

## Disabling the RNRepo Plugin
You can disable the RNRepo plugin using an environment variable `DISABLE_RNREPO`. If this variable is set to ANY value, the plugin will not execute. By default, if this variable is not set, it defaults to "false", thereby enabling the plugin execution.

```bash
DISABLE_RNREPO=true ./gradlew :app:assembleDebug
```

## Logging
To get more detailed logs from the RNRepo plugin during the build process, you can run the following command:
```bash
gradlew :app:assembleDebug --info
```
You can filter the logs to show only RNRepo related messages by using `grep`:
```bash
./gradlew :app:assembleDebug --info | grep RNRepo
```
