#!/bin/bash

cd AwesomeProject

# install supported svg
npm install react-native-svg@15.13.0 --save-exact

npm install

sed -i '' "/public void setR(Dynamic r) {/a\\
    System.out.println(\"BUILDLE: YOU SHOULD NOT SEE THAT\");
" node_modules/react-native-svg/android/src/main/java/com/horcrux/svg/CircleView.java

sed -i '' 's/red/green/g' App.tsx

echo "RUN \"npm run android\" and you should see green circle above basic RN app Device logs should not have message: \"BUILDLE: YOU SHOULD NOT SEE THAT\""
