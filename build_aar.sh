#!/bin/bash

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

for RN_VERSION in $RN_VERSIONS; do
    echo "Processing React Native Version: $RN_VERSION"
    npx @react-native-community/cli@latest init $TEMP_PROJECT_DIR --version $RN_VERSION --skip-install

    if [ $? -ne 0 ]; then
        echo "Error: Failed to create temporary RN project for $RN_VERSION. Skipping." >&2
        rm -rf "$TEMP_PROJECT_DIR" 2>/dev/null
        continue
    fi

    PACKAGE_OBJECT=$(echo "$JSON_DATA" | jq -r --arg rn_v "$RN_VERSION" '.[$rn_v]')
    PACKAGES=$(echo "$PACKAGE_OBJECT" | jq -r 'keys[]')
    
    for PACKAGE_NAME in $PACKAGES; do
        VERSION_ARRAY=$(echo "$PACKAGE_OBJECT" | jq -r --arg pkg "$PACKAGE_NAME" '.[$pkg][]')

        for VERSION in $VERSION_ARRAY; do
            TARGET_AAR_DIR="$ROOT_PATH/AARS/$RN_VERSION/$PACKAGE_NAME/$VERSION"
            mkdir -p "$TARGET_AAR_DIR"

            if [ "$(ls -A "$TARGET_AAR_DIR" 2>/dev/null)" ]; then
                echo "Skipping for $RN_VERSION@$PACKAGE_NAME@$VERSION"
                continue
            fi

            pushd "$TEMP_PROJECT_DIR" > /dev/null
            npm install "$PACKAGE_NAME@$VERSION" --save-exact

            # change all 'implementation' to 'api' in node_module/$PACKAGE_NAME/android/build.gradle
            sed -i '' 's/implementation/api/g' "node_modules/$PACKAGE_NAME/android/build.gradle"

            # add 'maven-publish' plugin
            if grep -q 'plugins {' "node_modules/$PACKAGE_NAME/android/build.gradle"; then
                sed -i '' -e "/plugins {/a\\
    id 'maven-publish'" "node_modules/react-native-screens/android/build.gradle"
            else
                sed -i '' '/buildscript {/,/^}/ {
/^}/ {
a\
\
plugins {\
    id "maven-publish"\
}
}
}' "node_modules/$PACKAGE_NAME/android/build.gradle"
            fi

            # add publishing block
            echo "
publishing {
    publications {
        release(MavenPublication) {
            groupId = 'com.swmansion'
            artifactId = '$PACKAGE_NAME'
            version = '$VERSION-rn$RN_VERSION'

            pom {
                withXml {
                    def dependenciesNode = asNode().appendNode('dependencies')
                    project.configurations.api.allDependencies.each { dependency ->
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

            pushd "$TEMP_PROJECT_DIR/android" > /dev/null
            ./gradlew ":$PACKAGE_NAME:publishReleasePublicationToMavenLocal"
            
            popd > /dev/null
            cp ~/.m2/repository/com/swmansion/$PACKAGE_NAME/$VERSION-rn$RN_VERSION/*.pom $TARGET_AAR_DIR/$PACKAGE_NAME.pom


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
