# Repo setup instructions for Android projects

## Prerequisites
- Project with react-native (e.g. [React Native Getting Started](https://reactnative.dev/docs/getting-started-without-a-framework))

## Integration steps
- add `rnrepo` plugin to `AwesomeProject/android/build.gradle`
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
```

- Add rnrepo repository to `AwesomeProject/android/build.gradle`
```diff
android {
  ...
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
