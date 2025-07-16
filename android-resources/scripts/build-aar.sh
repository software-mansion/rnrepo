#!/bin/bash

# Check if a path argument was provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path-to-lib-folder>"
    exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

LIB_PATH=$1
ANDROID_PATH="$LIB_PATH/android"
PROJECT_PATH="$LIB_PATH/../../../SuperProject"

# Check if the android folder exists
if [ ! -d "$ANDROID_PATH" ]; then
    echo "Android folder does not exist in the provided library path: $ANDROID_PATH"
    exit 1
fi

echo "Android folder found, proceeding with modifications..."

# Get package name and version using Node.js script
echo "LIB PATH $LIB_PATH"
read -r LIB_NAME LIB_VERSION <<< $(node $SCRIPT_DIR/get-package-info.cjs "$LIB_PATH")
if [ $? -ne 0 ]; then
  echo "Failed to get library name and version from package.json."
  exit 1
fi

echo "Library Name: $LIB_NAME"
echo "Library Version: $LIB_VERSION"

# Run the Node.js script modify-build-gradle.cjs
node $SCRIPT_DIR/modify-build-gradle.cjs "$LIB_PATH" "$LIB_NAME" "$LIB_VERSION"
if [ $? -ne 0 ]; then
  echo "Failed to modify the build.gradle file."
  exit 1
fi

echo "Successfully modified the Gradle file. Proceeding to build the AAR..."

# Change directory to the android folder and run Gradle build
cd $PROJECT_PATH/android
./gradlew :$LIB_NAME:assembleRelease
./gradlew :$LIB_NAME:publishToMavenLocal
cd ..

if [ $? -ne 0 ]; then
    echo "Failed to build AAR."
    exit 1
fi

echo "AAR build successful!"
echo "ANDROID PATH: $ANDROID_PATH"
echo $(pwd)
# Create .buildlerc.json using the Node.js script
node $SCRIPT_DIR/save-artifact-info.cjs "$LIB_NAME" "$LIB_VERSION" "$ANDROID_PATH"
if [ $? -ne 0 ]; then
  echo "Failed to create .buildlerc.json."
  exit 1
fi

echo "Configuration file creation successful."