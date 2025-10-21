#!/bin/bash

echo "N" |npx @react-native-community/cli@latest init AwesomeProject --version 0.81.4 
cd AwesomeProject

# edit app
sed -i '' "/} from 'react-native-safe-area-context';/a\\
import {Svg, Circle} from \"react-native-svg\";
" App.tsx

sed -i '' "/<View style={styles.container}>/a\\
      <Svg height=\"100\" width=\"100\"> \\
        <Circle cx=\"30\" cy=\"30\" r=\"20\" fill=\"red\"/> \\
      </Svg>
" App.tsx

# setup plugin
sed -i '' "/apply plugin: \"com.facebook.react\"/a\\
apply plugin: \"com.swmansion.buildle\"
" android/app/build.gradle

sed -i '' "/classpath(\"org.jetbrains.kotlin:kotlin-gradle-plugin\")/a\\
        classpath(\"com.swmansion:buildle-plugin:1.0.5\")
" android/build.gradle

sed -i '' "/mavenCentral()/a\\
        maven { \\
            name \"reposiliteRepositoryReleases\" \\
            url \"https://repo.swmtest.xyz/releases\" \\
        } \\
        // mavenLocal() \\
" android/build.gradle

# install unsupported svg
npm install react-native-svg@15.12.1 --save-exact

npm install

sed -i '' "/public void setR(Dynamic r) {/a\\
    System.out.println(\"BUILDLE: YOU SHOULD SEE THAT\");
" node_modules/react-native-svg/android/src/main/java/com/horcrux/svg/CircleView.java

echo "RUN \"npm run android\" and you should see red circle above basic RN app. Device logs should have message: \"BUILDLE: YOU SHOULD SEE THAT\""
