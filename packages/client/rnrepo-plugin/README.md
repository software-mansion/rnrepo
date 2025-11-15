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
RNREPO_REPO_NAME_DEV = <YOUR_DEV_REPO_NAME> // name is optional
RNREPO_REPO_URL_DEV = <YOUR_DEV_REPO_URL>
```
- this will make the plugin use DEV remote repository instead of PROD
