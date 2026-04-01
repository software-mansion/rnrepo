# RNRepo Gradle Plugin

## Building

To build the plugin locally:

```bash
cd packages/build-tools/gradle-plugin
./gradlew build
```

## Env variables:

#### Setting React Native root directory
You can set the React Native root directory by adding the following to your `gradle.properties`:
```gradle
REACT_NATIVE_ROOT_DIR=<PATH_TO_YOUR_REACT_NATIVE_ROOT_DIRECTORY>
// example:
REACT_NATIVE_ROOT_DIR=../react-native
```
This will make the plugin use the specified React Native root directory instead of trying to locate it automatically. By default it looks for the directory containing `node_modules` and react-native libraries inside.

#### Disabling the RNRepo plugin
You can disable the RNRepo plugin execution by setting the `DISABLE_RNREPO` environment variable to any value:
   ```bash
   DISABLE_RNREPO=true ./gradlew assembleDebug
   ```

## Unittests

To run the unittests for the RNRepo plugin, navigate to the plugin's directory and execute the test task:

```bash
cd packages/build-tools/gradle-plugin
./gradlew test
```
