# USAGE

## publishing new version of plugin
REMOTE
```
cd android-resources/gradle-plugin/buildle-plugin
MAVEN_USER=<> MAVEN_PASSWORD=<> ./gradlew publishPluginMavenPublicationToReposiliteRepositoryReleasesRepository
```
LOCAL
```
cd android-resources/gradle-plugin/buildle-plugin
./gradlew publishPluginMavenPublicationToMavenLocalRepository
```

## publishing new version of lib
REMOTE
```
cd android-resources/gradle-plugin/buildle-plugin
MAVEN_USER=<> MAVEN_PASSWORD=<> PACKAGE_NAME=<react-native-reanimated> LIB_VERSION=<4.1.3> RN_VERSION=<0.81.4> AAR_FILEPATH=<AARS/0.81.4/react-native-reanimated/4.1.3/react-native-reanimated.aar> ./gradlew publishBuildleArtefactPublicationToreposiliteRepositoryReleases
```
LOCAL
```
cd android-resources/gradle-plugin/buildle-plugin
PACKAGE_NAME=react-native-reanimated LIB_VERSION=4.1.3 RN_VERSION=0.81.4 AAR_FILEPATH=AARS/0.81.4/react-native-reanimated/4.1.3/react-native-reanimated.aar ./gradlew publishBuildleArtefactPublicationToMavenLocal
```
AAR_FILEPATH: is based in android-resources/gradle-plugin/buildle-plugin/<AAR_FILEPATH>

## add buildle to existing project
```
PROJECT_PATH=react-conf-app ./setup_project.sh
```
TEST.md shows more what should be done