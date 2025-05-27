#!/bin/bash

# export DISABLE_CODEGEN=1

# If there are any issues with running this script, uncomment lines below and enter path to react-native

# export REACT_NATIVE_PATH="/path/to/react/native/"
# if [ ! -d "$REACT_NATIVE_PATH" ]; then
#     echo "React Native path does not exist: $REACT_NATIVE_PATH"
#     exit 1
# fi

# Define directories and target
PROJECT_DIR=$(pwd)
PROJECT_NAME=$(basename "$PROJECT_DIR")
echo "Project directory set to $PROJECT_DIR"
echo "Project name is $PROJECT_NAME"

BUILD_DIR="$PROJECT_DIR/build"
WORKSPACE="$PROJECT_NAME.xcworkspace"
SCHEME="$PROJECT_NAME"

# Cleanup previous builds
echo "Cleaning up previous builds..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Pod deintegrate and install
echo "Running pod deintegrate and install..."
pod deintegrate
pod install

# Build for iOS devices
echo "Building for iOS devices..."
xcodebuild build \
-workspace "$WORKSPACE" \
-scheme "$SCHEME" \
-configuration Release \
-sdk iphoneos \
BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
-derivedDataPath "$BUILD_DIR/iphoneos" \
-verbose

# Check if xcodebuild succeeded
if [ $? -ne 0 ]; then
    echo "Error: Building for iOS devices failed."
    exit 1
fi


# Build for iOS simulator
echo "Building for iOS simulator..."
xcodebuild build \
-workspace "$WORKSPACE" \
-scheme "$SCHEME" \
-configuration Release \
-sdk iphonesimulator \
BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
clean build \
-derivedDataPath "$BUILD_DIR/iphonesimulator"

# Check if xcodebuild succeeded
if [ $? -ne 0 ]; then
    echo "Error: Building for iOS simulator failed."
    exit 1
fi

# Creating XCFramework
echo "Creating XCFramework..."
xcodebuild -create-xcframework \
-framework "$BUILD_DIR/iphoneos/Build/Products/Release-iphoneos/$PROJECT_NAME.framework" \
-framework "$BUILD_DIR/iphonesimulator/Build/Products/Release-iphonesimulator/$PROJECT_NAME.framework" \
-output "$BUILD_DIR/$PROJECT_NAME.xcframework"

# Check if xcodebuild succeeded
if [ $? -ne 0 ]; then
    echo "Error: Creating XCFramework failed."
    exit 1
fi

echo "XCFramework created at $BUILD_DIR/$PROJECT_NAME.xcframework"

# Signing the XCFramework
echo "Signing the XCFramework..."

APPLE_DEVELOPER_IDENTIFIER="ENTER-YOUR-DEVELOPER-IDENTIFIER-HERE"

codesign -s "$APPLE_DEVELOPER_IDENTIFIER" --force --deep --preserve-metadata=identifier,entitlements,flags "$BUILD_DIR/$PROJECT_NAME.xcframework"
    
# Check if codesign succeeded
if [ $? -ne 0 ]; then
    echo "Error: Signing the XCFramework failed."
    exit 1
else
    echo "XCFramework successfully signed."
fi