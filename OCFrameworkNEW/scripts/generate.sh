#!/bin/bash

node ./node_modules/react-native/scripts/generate-codegen-artifacts.js --path . --output-path OCFrameworkNEW -t ios

mv ./OCFrameworkNEW/build/generated/ios/FrameworkSpec ./OCFrameworkNEW/

mv ./OCFrameworkNEW/build/generated/ios/react ./OCFrameworkNEW/

rm -rf ./OCFrameworkNEW/build