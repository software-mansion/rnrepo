# Buildle



## Getting started

### OCFrameworkNEW:

Generate necessary node modules:

```
cd OCFrameworkNEW
npm install
```

In `build.sh` script find APPLE_DEVELOPER_IDENTIFIER variable and replace "ENTER-YOUR-DEVELOPER-IDENTIFIER-HERE" with your codesign identifier key.

You can find your key by using the following command:

```
security find-identity -v -p codesigning
```

### SuperProject:

Install all necessary node modules and pods by using the commands below:

```
cd SuperProject
npm install
cd ios
pod install
```

### OCFrameworkNEW

In `OCFrameworkNEW/scripts` you can find two scipts:
    - `build.sh` for building framework into .xcframework
    - `generate.sh` for generating Codegen files for native modules,

Generate codegen files only once you introduce any changes to native modules.

You can use the scripts above by running respectively:

```
npm run build
npm run generate
```

### SuperProject

To run the app use the following command:

```
npm run ios
```

