# @rnrepo/expo-config-plugin

Expo Config Plugin for automatically configuring [RNRepo](https://rnrepo.org) prebuilds in your React Native project.

## Installation

```bash
npx expo install @rnrepo/expo-config-plugin
# or
npm install @rnrepo/expo-config-plugin
# or
yarn add @rnrepo/expo-config-plugin
# or
bun add @rnrepo/expo-config-plugin
```

Then add the plugin to your Expo configuration in `app.json` or `app.config.js`.
```diff
{
    "expo" {
        ...
        plugins: [
+           "@rnrepo/expo-config-plugin"
        ]
    }
}
```

Then run:

```bash
npx expo prebuild --clean
```

It will modify your Android Gradle configuration to use RNRepo prebuilds.

## What It Does

This plugin automatically modifies your Android Gradle configuration to:

1. **Add RNRepo Plugin Classpath** - Adds the prebuilds plugin to your project dependencies
2. **Configure Maven Repository** - Adds RNRepo Maven repository to buildscript and allprojects
3. **Apply Plugin** - Applies the prebuilds plugin to your app's build.gradle

### Disabling the plugin

To temporarily disable RNRepo without removing the plugin, set the environment variable `DISABLE_RNREPO` to any value when running Expo commands:

```bash
DISABLE_RNREPO=true npx expo run:android
```

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


