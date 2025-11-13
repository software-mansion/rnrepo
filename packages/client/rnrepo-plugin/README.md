# Usage of RNRepo Gradle Plugin

## Version Management

The plugin version is fixed in code (`0.0.1` in `build.gradle`).

- **Local publishes** automatically append `-SNAPSHOT` suffix
- **Production publishes** use the base version

Examples:

- Local build: `./gradlew build` → `0.0.1`
- Local publish: `./gradlew publishReleasePublicationToMavenLocalRepository` → `0.0.1-SNAPSHOT`
- Production publish: `./gradlew publishReleasePublicationToRnrepoRepository` → `0.0.1`

## Publishing new version of plugin

- Remote PROD

```
cd packages/client/rnrepo-plugin

./gradlew publishReleasePublicationToRnrepoRepository \
-PmavenUsername=<> \
-PmavenPassword=<> \
-PsigningKey=<> \
-PsigningPassword=<>
```

- Local (automatically publishes as `-SNAPSHOT`)

```
cd packages/client/rnrepo-plugin

./gradlew publishReleasePublicationToMavenLocalRepository
```
