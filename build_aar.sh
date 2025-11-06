#!/bin/bash

for arg in "$@"; do
  if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
    echo """
    Usage: ./build_aar.sh

    This script builds AAR files for libs specified in the supported_versions.json file.
    No additional environment variables / options are required.
    """
    exit 0
  fi
done

trap 'exit 130' INT
JSON_FILE="supported_versions.json"
if [ ! -f "$JSON_FILE" ]; then
    echo "Error: JSON file not found at $JSON_FILE" >&2
    exit 1
fi

ROOT_PATH=$(pwd)
JSON_DATA=$(cat "$JSON_FILE")
RN_VERSIONS=$(echo "$JSON_DATA" | jq -r 'keys[]')
TEMP_PROJECT_DIR="TEMPORARY_RN_PROJECT"

create_temp_rn_project() {
    local RN_VERSION=$1
    local TEMP_DIR=$2
    local IS_EXPO=$3
    rm -rf "$TEMP_DIR" 2>/dev/null

    if [ "$IS_EXPO" = true ]; then
        npx create-expo-app@latest "$TEMP_DIR" > /dev/null 2>&1
        ( cd "$TEMP_DIR" && npx expo install react-native@"$RN_VERSION" )
        ( cd "$TEMP_DIR" && npx expo prebuild -p android )
    else
        npx @react-native-community/cli@latest init "$TEMP_DIR" --version "$RN_VERSION" --skip-install > /dev/null 2>&1
    fi

    if [ $? -ne 0 ]; then
        echo "Error: Failed to create temporary RN project for $RN_VERSION. Skipping." >&2
        rm -rf "$TEMP_PROJECT_DIR" 2>/dev/null
        continue
    fi
}

install_dependencies() {
    local PACKAGE_NAME=$1
    local VERSION=$2
    local IS_EXPO=$3

    if [ "$IS_EXPO" = true ]; then
        npx expo install "$PACKAGE_NAME@$VERSION"
    else
        npm install "$PACKAGE_NAME@$VERSION" --save-exact
    fi
}

for IS_EXPO_PROJECTS in false true; do
    for RN_VERSION in $RN_VERSIONS; do
        echo "Processing React Native Version: $RN_VERSION"
        create_temp_rn_project "$RN_VERSION" "$TEMP_PROJECT_DIR" "$IS_EXPO_PROJECTS"

        PACKAGE_OBJECT=$(echo "$JSON_DATA" | jq -r --arg rn_v "$RN_VERSION" '.[$rn_v]')
        PACKAGES=$(echo "$PACKAGE_OBJECT" | jq -r 'keys[]')
        
        for PACKAGE_NAME in $PACKAGES; do
            # Build expo libs in expo-projects and non-expo libs in non-expo projects only
            if { [[ "$PACKAGE_NAME" == *"expo"* ]] && [ "$IS_EXPO_PROJECTS" = false ]; } || \
            { [[ "$PACKAGE_NAME" != *"expo"* ]] && [ "$IS_EXPO_PROJECTS" = true ]; }; then
                continue
            fi
            
            PACKAGE_NAME_GRADLE=$(echo "$PACKAGE_NAME" | sed 's/@//;s/\//_/g')
            VERSION_ARRAY=$(echo "$PACKAGE_OBJECT" | jq -r --arg pkg "$PACKAGE_NAME" '.[$pkg][]')

            for VERSION in $VERSION_ARRAY; do
                TARGET_AAR_DIR="$ROOT_PATH/AARS/$RN_VERSION/$PACKAGE_NAME/$VERSION"
                mkdir -p "$TARGET_AAR_DIR"

                if [ "$(ls -A "$TARGET_AAR_DIR" 2>/dev/null)" ]; then
                    echo "Skipping for $RN_VERSION@$PACKAGE_NAME@$VERSION"
                    continue
                fi

                pushd "$TEMP_PROJECT_DIR" > /dev/null
                install_dependencies "$PACKAGE_NAME" "$VERSION" "$IS_EXPO_PROJECTS"

                # change all 'implementation' to 'api' in node_module/$PACKAGE_NAME/android/build.gradle
                sed -i '' 's/implementation/api/g' "node_modules/$PACKAGE_NAME/android/build.gradle"

                # add 'maven-publish' plugin
                if ! grep -q 'maven-publish' "node_modules/$PACKAGE_NAME/android/build.gradle"; then
                    if grep -q 'plugins {' "node_modules/$PACKAGE_NAME/android/build.gradle"; then
                        sed -i '' -e "/plugins {/a\\
                        id 'maven-publish'" "node_modules/$PACKAGE_NAME/android/build.gradle"
                    else
                        sed -i '' -e "/apply plugin: 'com.android.library'/a\\
                        apply plugin: 'maven-publish'" "node_modules/$PACKAGE_NAME/android/build.gradle"
                    fi
                fi

                # add publishing block
                echo "
    publishing {
        publications {
            releaseRNREPO(MavenPublication) {
                groupId = 'com.swmansion'
                artifactId = '$PACKAGE_NAME_GRADLE'
                version = '$VERSION-rn$RN_VERSION'

                pom {
                    packaging 'aar'
                    withXml {
                        def dependenciesNode = asNode().appendNode('dependencies')
                        project.configurations.implementation.allDependencies.each { dependency ->
                            def dependencyNode = dependenciesNode.appendNode('dependency')
                            dependencyNode.appendNode('groupId', dependency.group)
                            dependencyNode.appendNode('artifactId', dependency.name)
                            dependencyNode.appendNode('version', dependency.version)
                        }
                    }
                }
            }
        }
        repositories {
            mavenLocal()
        }
    }" >> "node_modules/$PACKAGE_NAME/android/build.gradle"
                
                if [ "$PACKAGE_NAME" = "react-native-reanimated" ]; then
                    if [[ "$VERSION" == 4.0.* ]]; then
                        npm install react-native-worklets@0.4.0 --save-exact
                    elif [[ "$VERSION" == 4.1.* ]]; then
                        npm install react-native-worklets@0.5.0 --save-exact
                    fi
                fi

                npm install
                popd > /dev/null

                npm run build-aar -- \
                    --packages "$PACKAGE_NAME" \
                    --android-project "$TEMP_PROJECT_DIR" \
                    --output "$TARGET_AAR_DIR"

                eval "cp ~/.m2/repository/com/swmansion/$PACKAGE_NAME_GRADLE/$VERSION-rn$RN_VERSION/*.pom $TARGET_AAR_DIR/$PACKAGE_NAME_GRADLE.pom"

                if [ $? -ne 0 ]; then
                    echo "Warning: AAR build failed for $PACKAGE_NAME@$VERSION. Check logs." >&2
                fi

                pushd "$TEMP_PROJECT_DIR" > /dev/null
                npm uninstall "$PACKAGE_NAME"
                popd > /dev/null
            done
        done

        rm -rf "$TEMP_PROJECT_DIR"
    done
done
