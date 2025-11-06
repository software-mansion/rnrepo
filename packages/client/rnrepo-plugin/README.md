# Usage of RNRepo Gradle Plugin

## Publishing new version of plugin
- Remote
```
cd packages/client/rnrepo-plugin

./gradlew publishRNRepoPluginPublicationPublicationToReposiliteRepositoryReleasesRepository \
-PmavenUser=<> \
-PmavenPassword=<> \
-PsigningKey=<> \
-PsigningPassword=<>
```
- Local
```
cd packages/client/rnrepo-plugin

./gradlew publishRNRepoPluginPublicationPublicationToMavenLocalRepository
```
