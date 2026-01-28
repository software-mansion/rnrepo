# @rnrepo/prebuilds-plugin

[RNRepo](https://rnrepo.org) plugin for handling prebuilt binaries of iOS and Android libraries in React Native projects.

This package includes both a **Gradle plugin** for Android and a **CocoaPods plugin** for iOS, enabling you to automatically download and integrate prebuilt libraries without building from source.

## Installation

### For React Native Projects

Install the package:

```bash
npm install @rnrepo/prebuilds-plugin
# or
yarn add @rnrepo/prebuilds-plugin
# or
bun add @rnrepo/prebuilds-plugin
```

### For Expo Managed Projects

See the [@rnrepo/expo-config-plugin](https://www.npmjs.com/package/@rnrepo/expo-config-plugin) package for instructions on using RNRepo with Expo Managed workflows.

### Android Configuration

Add the following to your project's `android/build.gradle` file:

```diff
buildscript {
   dependencies {
      ...
+     classpath fileTree(dir: "../node_modules/@rnrepo/prebuilds-plugin/gradle-plugin/build/libs", include: ["prebuilds-plugin-*.jar"])
   }
}

apply plugin: "com.facebook.react.rootproject"

allprojects {
  repositories {
+    maven { url "https://packages.rnrepo.org/releases" }
  }
}

```

Then, apply the plugin in your `android/app/build.gradle` file:

```diff
apply plugin: "com.facebook.react"
+ apply plugin: "org.rnrepo.tools.prebuilds-plugin"
```

### iOS Configuration

Add to the beginning of your `Podfile`:

```diff
+require Pod::Executable.execute_command('node', ['-p',
+  'require.resolve(
+    "@rnrepo/prebuilds-plugin/cocoapods-plugin/lib/plugin.rb",
+    {paths: [process.argv[1]]},
+  )', __dir__]).strip
```

And inside the `post_install` block:

```diff
post_install do |installer|
+  rnrepo_post_install(installer)
   ...
end
```

## How It Works

The RNRepo Prebuilds Plugin automatically detects supported libraries in your React Native project and downloads their prebuilt binaries during the build process. This significantly reduces build times and simplifies dependency management.

## Supported Libraries

The plugin supports prebuilt binaries for:

- react-native-reanimated
- react-native-gesture-handler
- react-native-screens
- @shopify/react-native-skia
- And many more...

Check the [RNRepo Supported Libraries](https://rnrepo.org/supported-libraries/) for the full list of supported libraries.

## License

ISC License

## Support

For issues, questions, or feature requests, please visit:

- 🐛 [Issue Tracker](https://github.com/software-mansion/rnrepo/issues)
- 📖 [Website](https://rnrepo.org)
- 📚 [Documentation](https://github.com/software-mansion/rnrepo/blob/main/README.md)
- 🆘 [Troubleshooting Guide](https://github.com/software-mansion/rnrepo/blob/main/TROUBLESHOOTING.md)

## RNRepo is created by Software Mansion

Since 2012 [Software Mansion](https://swmansion.com/) is a software agency with experience in building web and mobile apps. We are Core React Native Contributors and experts in dealing with all kinds of React Native issues. We can help you build your next dream product – [Hire us](https://swmansion.com/contact).

