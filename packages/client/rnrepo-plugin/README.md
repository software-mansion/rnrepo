# Usage of RNRepo Gradle Plugin

## Publishing new version of plugin
- Remote
```
cd packages/client/gradle-plugin/buildle-plugin

./gradlew publishRNRepoPluginPublicationPublicationToReposiliteRepositoryReleasesRepository \
-PmavenUser=<> \
-PmavenPassword=<> \
-PsigningKey=<> \
-PsigningPassword=<> \
```
- Local
```
cd packages/client/gradle-plugin/buildle-plugin

./gradlew publishRNRepoPluginPublicationPublicationToMavenLocalRepository
```
