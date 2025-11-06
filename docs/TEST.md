# Usage example

## Repo setup

- Create new `react-native@0.81.4` project (if you don't already have one)
```bash
# might be required to uninstall global cli first
# npm uninstall -g react-native-cli @react-native-community/cli 
npx @react-native-community/cli@latest init AwesomeProject --version 0.81.4
cd AwesomeProject
```

- add `rnrepo` plugin to `AwesomeProject/android/build.gradle`
```diff
buildscript {
  ...
  dependencies {
    ...
+    classpath("org.rnrepo.prebuilds:rnrepo-plugin:+")
  }
}
apply plugin: "com.facebook.react.rootproject"
+
+ repositories {
+    maven {
+        name "reposiliteRepositoryReleases"
+        url "https://repo.swmtest.xyz/releases"
+    }
+ }
```

- Add `rnrepo` plugin to `AwesomeProject/android/app/build.gradle`
```diff
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"
+ apply plugin: "org.rnrepo.prebuilds.rnrepo-plugin"
```

## Build app

- Add `react-native-svg@15.13.0` dependency to `AwesomeProject/package.json`
```diff
  "dependencies": {
    ...
    "react-native-safe-area-context": "^5.5.2",
+    "react-native-svg": "15.13.0"
  },
```

- Install dependencies and run project
```
npm install
npm run android
```
