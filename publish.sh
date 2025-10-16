#!/bin/bash

trap 'exit 130' INT
JSON_FILE="supported_versions.json"
AARS_ROOT_DIR="android-resources/gradle-plugin/buildle-plugin/AARS"

MAVEN_USER=a${MAVEN_USER:-"user"}
MAVEN_PASSWORD=${MAVEN_PASSWORD:-"password"}

if [ ! -f "$JSON_FILE" ]; then
    echo "Error: JSON file not found at $JSON_FILE" >&2
    exit 1
fi

JSON_DATA=$(cat "$JSON_FILE")
RN_VERSIONS=$(echo "$JSON_DATA" | jq -r 'keys[]')

# Check if Gradle is installed
if ! command -v gradle &> /dev/null; then
    echo "Error: Gradle is not installed or not in PATH." >&2
    exit 1
fi

# Main Publishing Loop
# --------------------------------
for RN_VERSION in $RN_VERSIONS; do
    echo "--- Processing React Native Version: $RN_VERSION ---"
    
    # Get all packages for the current RN version
    PACKAGE_OBJECT=$(echo "$JSON_DATA" | jq -r --arg rn_v "$RN_VERSION" '.[$rn_v]')
    PACKAGES=$(echo "$PACKAGE_OBJECT" | jq -r 'keys[]')
    
    for PACKAGE_NAME in $PACKAGES; do
        VERSION_ARRAY=$(echo "$PACKAGE_OBJECT" | jq -r --arg pkg "$PACKAGE_NAME" '.[$pkg][]')
        
        for LIB_VERSION in $VERSION_ARRAY; do
            AAR_FILE="$AARS_ROOT_DIR/$RN_VERSION/$PACKAGE_NAME/$LIB_VERSION/$PACKAGE_NAME.aar"

            if [ -f "$AAR_FILE" ]; then
                echo "Publishing $PACKAGE_NAME@$LIB_VERSION (RN:$RN_VERSION) from $AAR_FILE"

                pushd android-resources/gradle-plugin/buildle-plugin
                MAVEN_USER=$MAVEN_USER MAVEN_PASSWORD=$MAVEN_PASSWORD ./gradlew publishMavenJavaPublicationToReposiliteRepositoryReleases \
                    -P aarsRootDir="AARS" \
                    -P rnVersion="$RN_VERSION" \
                    -P packageName="$PACKAGE_NAME" \
                    -P libVersion="$LIB_VERSION"
                
                popd
                if [ $? -ne 0 ]; then
                    echo "Error: Maven publishing failed for $AAR_FILE" >&2
                else
                    echo "SUCCESS: Published $PACKAGE_NAME@$LIB_VERSION (RN:$RN_VERSION)"
                fi

            else
                echo "Warning: AAR file not found at $AAR_FILE. Skipping." >&2
            fi
        done
    done
done

echo "Publishing process complete."