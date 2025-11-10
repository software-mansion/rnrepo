# Usage of RNRepo Gradle Plugin

## Publishing new version of plugin
- Remote PROD
```
cd packages/client/rnrepo-plugin

./gradlew publishRNRepoPluginPublicationToProductionRepositoryRepository \
-PpluginVersion=<> \
-PmavenUserProd=<> \
-PmavenPasswordProd=<> \
-PsigningKey=<> \
-PsigningPassword=<>
```
- Remote DEV
```
cd packages/client/rnrepo-plugin

./gradlew publishRNRepoPluginPublicationToDevelopmentRepositoryRepository \
-PpluginVersion=<> \
-PmavenUserDev=<> \
-PmavenPasswordDev=<> \
-PsigningKey=<> \
-PsigningPassword=<>
```
- Local
```
cd packages/client/rnrepo-plugin

./gradlew publishRNRepoPluginPublicationToMavenLocalRepository
```

## Using RNRepo in dev mode
- add to `gradle.properties` in your project root:
```
RNREPO_USE_DEV_REPO=true
```
- this will make the plugin use DEV remote repository instead of PROD