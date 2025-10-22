#!/bin/bash

PROJECT_PATH=${PROJECT_PATH:-"."}

cd "$PROJECT_PATH"

# setup plugin
sed -i '' "/apply plugin: \"com.facebook.react\"/a\\
apply plugin: \"com.swmansion.buildle\"
" android/app/build.gradle

sed -i '' "/org.jetbrains.kotlin:kotlin-gradle-plugin/a\\
    classpath(\"com.swmansion:buildle-plugin:1.0.5\")
" android/build.gradle

sed -i '' "/mavenCentral()/a\\
        maven {\\
            name \"reposiliteRepositoryReleases\"\\
            url \"https://repo.swmtest.xyz/releases\"\\
        }\\
" android/build.gradle

echo "SUCCESS"
