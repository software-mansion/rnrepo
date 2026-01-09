# RNRepo Gradle Plugin

## Building

To build the plugin locally:

```bash
cd packages/gradle-client/rnrepo-plugin
./gradlew build
```

## Publishing

### Production Publishing (CI)

Production publishing should be done via the GitHub Actions workflow (`.github/workflows/publish-plugin-android.yml`). This ensures proper signing and credentials management.

**Before publishing, update the version in `build.gradle`** (line 11):

```gradle
def baseVersion = '0.0.1'  // Update this version
```

### Local Publishing

To publish locally for testing (e.g., to `~/.m2/repository`):

```bash
cd packages/gradle-client/rnrepo-plugin
./gradlew publishReleasePublicationToMavenLocalRepository
```

**Note:** Local publishes automatically append a `-SNAPSHOT` suffix to the version (e.g., `0.0.1` becomes `0.0.1-SNAPSHOT`).

## Env variables:

#### Using RNRepo in dev mode:
Add the following to `<RNProjectRoot/android/gradle.properties` to use the provided remote repository:
```gradle
RNREPO_REPO_URL_DEV=<YOUR_DEV_REPO_URL>
// example:
RNREPO_REPO_URL_DEV=https://packages.rnrepo.org/releases
```

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
cd packages/gradle-client/rnrepo-plugin
./gradlew test
```
