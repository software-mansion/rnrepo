#!/bin/bash

trap 'exit 130' INT
JSON_FILE="supported_versions.json"

for arg in "$@"; do
  if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
    echo """
    Usage: ./publish.sh

    This script publishes AAR files for libs specified in the supported_versions.json file
    to either a remote Maven repository or the local Maven repository.

    OPTIONAL ENV VARIABLES:
    MAVEN_USER         Maven repository username (required for remote publishing)
    MAVEN_PASSWORD     Maven repository password (required for remote publishing)
    LOCAL              If set to 'true', publishes to local Maven repository instead of remote (default: 'false')
    """
    exit 0
  fi
done

MAVEN_USER=${MAVEN_USER:-"user"}
MAVEN_PASSWORD=${MAVEN_PASSWORD:-"password"}
LOCAL=${LOCAL:-false}

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
    
    for PKG_NAME in $PACKAGES; do
        VERSION_ARRAY=$(echo "$PACKAGE_OBJECT" | jq -r --arg pkg "$PKG_NAME" '.[$pkg][]')
        
        for LIB_VERSION in $VERSION_ARRAY; do
            AAR_FILE="AARS/$RN_VERSION/$PKG_NAME/$LIB_VERSION/$PKG_NAME.aar"

            if [ -f "$AAR_FILE" ]; then
                echo "Publishing $PKG_NAME@$LIB_VERSION (RN:$RN_VERSION) from $AAR_FILE"

                pushd android-resources/gradle-plugin/buildle-plugin
                COMMON_ENV_VARS="PACKAGE_NAME=$PKG_NAME LIB_VERSION=$LIB_VERSION RN_VERSION=$RN_VERSION AAR_FILEPATH=../../../$AAR_FILE"
                if [[ "$LOCAL" != "true" ]]; then
                    MAVEN_USER="$MAVEN_USER" MAVEN_PASSWORD="$MAVEN_PASSWORD" $COMMON_ENV_VARS ./gradlew publishBuildleArtefactPublicationToreposiliteRepositoryReleases
                else
                    $COMMON_ENV_VARS ./gradlew publishBuildleArtefactPublicationToMavenLocal
                fi

                popd
                if [ $? -ne 0 ]; then
                    echo "Error: Maven publishing failed for $AAR_FILE" >&2
                else
                    echo "SUCCESS: Published $PKG_NAME@$LIB_VERSION (RN:$RN_VERSION)"
                fi

            else
                echo "Warning: AAR file not found at $AAR_FILE. Skipping." >&2
            fi
        done
    done
done

echo "Publishing process complete."