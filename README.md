# Buildle


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


3) <a id="build-gradle-modifications">Modify `build.gradle` file:</a>
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

4) <a id="publishing-aar">You are ready to create `.aar` file now!</a>

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
- Local directory - you can import your aar by placing it in chosen directory inside your app's android folder, e.g.: `YourSuperProject/android/libs`,

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

### Gradle Plugins

Buildle uses two custom gradle plugins to autolink proper maven dependencies instead of node-modules-based sources:

- `settings-gradle-plugin`

    - detects maven dependencies by searching `.buildlerc.json` file which includes maven dependency information, 
    - excludes `node_modules` native android code by setting its project dir to an empty, unused directory,
    - attaches maven dependency info to `autolinking.json` file (platforms -> android -> mavenDependency field),

- `autolink-aars-plugin`
    - detects maven dependencies based on `mavenDependency` field in `autolinking.json` file,
    - excludes `node_modules` dependencies which have their `mavenDependency` from project,
    - applies maven dependencies to project,

### Scripts

Buildle provides a script for building aar of any library containing native android sources. 

It works as follows:

- gets library info (library name and its version) from its `package.json`,
- modifies library `build.gradle` file (as described [here](#build-gradle-modifications)),
- assembles and publishes aar file to maven local repo (as described [here](#publishing-aar)),
- saves maven dependency info into `<library>/android/.buildlerc.json` to be used by `settings-gradle-plugin` to detect maven dependencies,



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

To find exact location and name of this package file you can unzip `.aar` file, then unzip `classes.jar` and find the package file.


## IOS

### Getting started

#### OCFrameworkNEW:

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

#### SuperProject:

Install all necessary node modules and pods by using the commands below:

```
cd SuperProject
npm install
cd ios
pod install
```

#### OCFrameworkNEW

In `OCFrameworkNEW/scripts` you can find two scipts:
    - `build.sh` for building framework into .xcframework
    - `generate.sh` for generating Codegen files for native modules,

Generate codegen files only once you introduce any changes to native modules.

You can use the scripts above by running respectively:

```
npm run build
npm run generate
```

#### SuperProject

To run the app use the following command:

```
npm run ios
```

