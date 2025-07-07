# Buildle

## Contents

- [Android](#android)
- [iOS](#ios)
    - [Creating `.xcframework` binary from library files](ios-resources/README.md)
    - [Using script to create xcframework](#using-script-to-create-xcframework)
    - [Using script to include xcframework](#using-script-to-include-xcframework)

## Android

### Creating `.aar` binary from library files

In order to pack chosen library's native code into `.aar` binary please follow the steps listed below:

1) Install library via npm

```
npm install <library-name> 
```

2) Find `build.gradle` file inside library modules

Go to `node_modules/<library-name>/android` directory and find `build.gradle` file there.  
In some rare cases library might not have `android` folder directly inside its node modules.
If that's the case, search for it inside other folders named e.g.: `platforms`.

3) Modify `build.gradle` file:

First off, find `repositories` section and make sure it includes `mavenLocal` repository:

```kt
repositories {
    // ...
    mavenLocal()
    // ...
}
```

Then go to `android` section and add the following code:

```kt
publishing {
    singleVariant("release") {
        withSourcesJar()
    }
}
```

Finally, add a new section called `publishing`:

```kt
apply plugin: "maven-publish"

afterEvaluate {
    publishing {
        publications {
            release(MavenPublication) {
                groupId = '<LIBRARY_GROUP_ID>'
                artifactId = '<LIBRARY_ARTIFACT_ID>'
                version = '<LIBRARY_VERSION>'

                from components.release
            }
        }
        repositories {
            mavenLocal()
        }
    }
}
```

Make sure to apply `maven-publish` plugin.  
Replace all the information in angle brackets with library-specific info.

Example:

```kt
apply plugin: "maven-publish"

afterEvaluate {
    publishing {
        publications {
            release(MavenPublication) {
                groupId = 'com.mycompany'
                artifactId = 'SuperReactNativeLibrary'
                version = '1.0.0'

                from components.release
            }
        }
        repositories {
            mavenLocal()
        }
    }
}
```

4) You are ready to create `.aar` file now!

Go inside `android` folder of your app and run the following commands:

```
./gradlew :<library-name>:assembleRelease
```

```
./gradlew :<library-name>:publishToMavenLocal
```

Now you should be able to find `.aar` binary inside:   
`~/.m2/repository/your/group/id/<LIBRARY_ARTIFACT_ID>/<LIBRARY_VERSION>`

For above example it would be:  
`~/.m2/repository/com/mycompany/SuperReactNativeLibrary/1.0.0`

### Replacing `node_modules` native code with `.aar`:

Once you build your library's `.aar`, you can replace library native code from `node_modules`.

You can achieve it in two distinct ways:

- Maven Local - you can import your aar directly from its maven local repo,
- Local directory - you can import your aar by placing it in chosen directory inside your app's android folder,
  e.g.: `YourSuperProject/android/libs`,

Regardless of which way you choose, follow the steps below:

1) Modify your app's `build.gradle` file:

You can find it in `YourSuperProject/android/app`.

```kt
// ...

dependencies {
    ...
    // for maven-local-published aars:
    implementation("<LIBRARY_GROUP_ID>:<LIBRARY_ARTIFACT_ID>:<LIBRARY_VERSION>")

    // for local directory aars:
    implementation(name: '<AAR-NAME>', ext: 'aar')
}

// ...

repositories {
    // for maven-local-published aars:
    mavenLocal()

    // for local directory aars:
    flatDir {
      dirs '<YOUR-DIR-NAME>'    // relative to android folder
    }
}

// ...

```

2) Register library package in `MainApplication.kt` file:

You can find `MainApplication.kt` file inside `YourSuperProject/android/app/src/main/java/.../MainApplication.kt`.

```kt
package com.yoursuperproject

import android.app.Application
// other default imports


import com.mycompany.SuperReactNativeLibraryPackage


class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet 
              add(MyLibraryPackage())
            }

        // ...
      }

    // ...
}

```

3) Clean previous build files

As we are changing location of library native code we need to remove previous builds to avoid build errors.

Run the following commands in the project's root directory:

```
rm -rf android/build
```

```
rm -rf android/app/build
```

4) Run the app:

```
npm run android
```

### Troubleshooting

- app build fails

Remove build folders ( `android/build` and `android/app/build` )

If this does not help, try resetting cache:

```
npm run android --reset-cache
```

### Q&A

- How do I know which file from my aar should I import in `MainApplication.kt`?

Most often it is just `<GROUP-ID>.<ARTIFACT-ID>.<ARTIFACT-ID>Package` but it is not a rule.

Every library which provides android native code must have a file which contains a main package class.  
This class is the only one extending `ReactPackage` like:

```java
class MyPackage : ReactPackage {
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    // ...
  }

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    // ...
  }
}
```

Most often it is placed in a file with a `Package` postfix, but again, it is not a rule.

To find exact location and name of this package file you can unzip `.aar` file, then unzip `classes.jar` and find the
package file.

## IOS

### Creating `.xcframework` binary from library files

In order to pack chosen library's native code into `.xcframework` binary, you can either:

- Use script provided by this repository (see [usage](#using-script-to-create-xcframework))
- Use `xcodebuild` command to create `.xcframework` manually (see [writeup](ios-resources/README.md) on whole process).

### Using script to create xcframework

Install project dependencies:

```bash
npm install
```

#### Usage

```bash
npm run build-xcf --  \
  --module MyLibrary \
  --ios-project ./example/ios \
  --output ./dist \
  --project ./libs/MyLibrary \
  --platforms iphonesimulator,iphoneos
```

```bash
npm run build-xcf -- \
  -p ~/react-native-svg \
  -i ~/react-native-svg/apps/fabric-example/ios \
  -m RNSVG  
```

#### Options

| Option                 | Alias | Description                                                                   |
|------------------------|-------|-------------------------------------------------------------------------------|
| `--module <name>`      | `-m`  | **(Required)** Name of the module (matching the podspec name)                 |
| `--ios-project <path>` | `-i`  | **(Required)** Path to the `ios/` directory of your example app               |
| `--output <path>`      | `-o`  | Destination directory for the generated `.xcframework` (default: `.`)         |
| `--project <path>`     | `-p`  | Path to the root project that contains the `.podspec` (default: `.`)          |
| `--platforms <list>`   |       | Comma-separated list of build platforms (default: `iphonesimulator,iphoneos`) |
| `--skip-pods`          |       | If set, skips `pod install` (useful if already installed)                     |

### Using script to include xcframework

You will need Ruby to use the script.

Install project dependencies (be sure to install `xcodeproj` and `optparse` gems as well):

```bash
npm install
[sudo] gem install optparse xcodeproj 
```

Then run the script:

```bash
npm run include-xcf -- \
  --target YourAppTarget \
  --ios-project ./example/ios \
  --xcframework ./dist/MyLibrary.xcframework
```

Target is the name of the target in your Xcode project where you want to include the `.xcframework`. It's optional, if
not provided it will default to the first target found in the project. If there are multiple targets the script will
fail, you can specify the one you want to include the `.xcframework` in via `--target` option.

```bash
npm run include-xcf -- \
  --project ~/react-native-reanimated/apps/fabric-example/ios/FabricExample.xcodeproj \ 
  --framework ~/buildle/RNReanimated.xcframework
```


#### Options

| Option      | Alias | Description                                                                             |
|-------------|-------|-----------------------------------------------------------------------------------------|
| --project   | -p    | Path to the .xcodeproj file (**required**)                                              |
| --framework | -f    | Path to the .xcframework file (absolute or relative) (**required**)                     |
| --target    | -t    | Name of the Xcode target to apply the framework to (required if multiple targets exist) |
| --help      | -h    | Show usage help and exit                                                                |

### Using script to create xcframework from npm package

Install project dependencies (be sure to install `xcodeproj` and `optparse` gems as well):

```bash
npm install
[sudo] gem install optparse xcodeproj 
```

Then run the script:

```bash
npm run npm-build-xcf -- \
  --package react-native-reanimated
```

#### Options

| Option      | Alias | Description                                                                             |
|-------------|-------|-----------------------------------------------------------------------------------------|
| --package   | -p    | NPM package to create .xcframework for. Has to contain valid podspec file.              |
