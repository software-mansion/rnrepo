#!/bin/bash

# If any command returns a non-zero exit status, the script will halt immediately.
set -e
error_trap() {
    echo "ERROR: A command failed on line $1." >&2
    exit 1
}

PROJECT_PATH=${PROJECT_PATH:-"."}

cd "$PROJECT_PATH"

# setup plugin
# TODO: check if sed changed anything, if not then throw
sed -i '' "/apply plugin: \"com.facebook.react\"/a\\
apply plugin: \"org.rnrepo.tools.prebuilds-plugin\"
" android/app/build.gradle

sed -i '' "/org.jetbrains.kotlin:kotlin-gradle-plugin/a\\
    classpath(\"org.rnrepo.tools:prebuilds-plugin:+\")
" android/build.gradle

sed -i '' "/mavenCentral()/a\\
        maven {\\
            name \"RNRepoMavenRepository\"\\
            url \"https://packages.rnrepo.org/releases\"\\
        }\\
" android/build.gradle

echo "SUCCESS"
