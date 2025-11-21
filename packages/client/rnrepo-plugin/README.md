# RNRepo Gradle Plugin

## Building

To build the plugin locally:

```bash
cd packages/client/rnrepo-plugin
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
cd packages/client/rnrepo-plugin
./gradlew publishReleasePublicationToMavenLocalRepository
```

**Note:** Local publishes automatically append a `-SNAPSHOT` suffix to the version (e.g., `0.0.1` becomes `0.0.1-SNAPSHOT`).

## Using RNRepo in dev mode
- add to `<RNProjectRoot/android/gradle.properties`:
```
RNREPO_REPO_URL_DEV=<YOUR_DEV_REPO_URL>
// example:
RNREPO_REPO_URL_DEV=https://packages.rnrepo.org/releases
```
- this will make the plugin use DEV remote repository instead of PROD

## Setting React Native root directory
- you can set the React Native root directory by adding the following to your `gradle.properties`:
```
REACT_NATIVE_ROOT_DIR=<PATH_TO_YOUR_REACT_NATIVE_ROOT_DIRECTORY>
// example:
REACT_NATIVE_ROOT_DIR=../react-native
```
This will make the plugin use the specified React Native root directory instead of trying to locate it automatically. By default it looks for the directory containing `node_modules` and react-native libraries inside.