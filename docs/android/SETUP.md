# Repo setup instructions for Android projects

## Prerequisites
- Project with react-native (e.g. [React Native Getting Started](https://reactnative.dev/docs/getting-started-without-a-framework))

## Integration steps
- add `rnrepo` plugin to `AwesomeProject/android/build.gradle` with repository
```diff
buildscript {
  ...
  repositories {
    ...
+   maven {
+     name "RNRepoMavenRepository"
+     url "https://packages.rnrepo.org/releases"
    }
  }
  dependencies {
    ...
+   classpath("org.rnrepo.tools:prebuilds-plugin:+")
  }
}

+ allprojects {
+  repositories {
+    maven {
+      name "RNRepoMavenRepository"
+      url "https://packages.rnrepo.org/releases"
+    }
+  }
+ }
```

- Add `rnrepo` plugin to `AwesomeProject/android/app/build.gradle`
```diff
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"
+ apply plugin: "org.rnrepo.tools.prebuilds-plugin"
```

## Expo Plugin
// TODO(rolkrado): add link to withBuildlePlugin.js when ready
If you are using Expo, you can integrate the RNRepo plugin by adding a custom config plugin to your `app.json` or `app.config.ts` file.
```diff
 plugins: [
+   "./withBuildlePlugin",
 ]
```
Make sure to copy the `withBuildlePlugin.js` file to your project root from this repository `resources/withBuildlePlugin.js`.
