# RNRepo (Beta)

RNRepo is an infrastructure and tooling project from [Software Mansion](https://swmansion.com) that improves native build times in React Native projects by pre-building and distributing community library artifacts. We maintain both the automated build system that precompiles popular React Native libraries and the distribution network that hosts these artifacts. With seamless integration via build plugins, RNRepo can reduce your build times by up to **2×** with zero infrastructure changes.

> ⚠️ RNRepo is currently in beta and available **only for Android** for React Native projects using **The New Architecture**. Please give it a try, share your feedback and use [issues](https://github.com/software-mansion/rnrepo/issues) to report any problems with your setup.

To get started quickly head to [Installation](#installation) section or visit [RNRepo.org](https://rnrepo.org) for instructions.

---

## About

RNRepo addresses one of the most critical and underserved pain points in React Native development: slow native build times.
Whether you're working on a greenfield or brownfield project, most React Native dependencies are compiled from source during each build.
This is highly inefficient: popular React Native libraries are downloaded millions of times per week, yet they're rebuilt from source repeatedly on different machines around the world.
This redundant compilation wastes time both during local development and in CI/CD pipelines.

However, distributing prebuilt native artifacts for community libraries is challenging.
Due to mechanisms like codegen, library builds are only compatible with specific React Native versions, so you can't simply publish prebuilt artifacts alongside the NPM package as that would tie the library version to specific React Native version.
Additionally, most libraries don't have build steps, as NPM packages typically publish source code directly.

RNRepo solves this with a comprehensive solution:

1. **Maven repository:** At the heart of RNRepo is our hosted Maven server that stores prebuilt packages for each combination of library version and React Native version we support.
2. **Automated builds:** RNRepo automatically monitors new library and React Native releases and schedules builds accordingly. Building and publishing requires no changes from library maintainers: the builder process follows the same steps any app developer would run locally on on CI when installing and building dependencies.
3. **Seamless integration:** We provide a Gradle plugin and Expo config plugin that, during native builds, automatically substitute libraries that would have been compiled from source with prebuilt artifacts hosted on our Maven servers.

RNRepo provides a secure, reliable infrastructure that integrates seamlessly into existing workflows and follows native platform best practices for building and distributing binaries.

## Installation

To start using RNRepo, you need to configure your Android project to include our Maven repository and use our Gradle plugin that will automatically swap out dependencies on supported libraries with pre-built artifacts downloaded from our repository.

### Expo Prebuild (Continuous Code Generation – CNG)

If you are using Expo Continuous Code Generation (CNG) setup (generating your native android directory with `expo prebuild` command), you can use our expo config plugin to automatically configure Android's project to use RNRepo.

1. **Install the expo config plugin:**

   ```bash
   npx expo install @rnrepo/expo-config-plugin
   ```

2. **Add the plugin to your `app.config.ts` file** (`app.json` or `app.config.js` depending on your setup):

   ```diff
   {
     "expo": {
       ...
       "plugins": [
   +     "@rnrepo/expo-config-plugin"
       ]
     }
   }
   ```

That's it! The plugin will automatically configure your Android project when you run `expo prebuild`.

### Standard React Native / Other Expo Setups

For standard React Native setups or when using Expo but managing your android folder by hand, you need to edit the following gradle files to use RNRepo.

1. **Add the RNRepo Maven repository and plugin to `android/build.gradle`:**

   ```diff
   buildscript {
     repositories {
       ...
   +   maven { url "https://packages.rnrepo.org/releases" }
     }
     dependencies {
       ...
   +   classpath("org.rnrepo.tools:prebuilds-plugin:0.1.0")
     }
   }

   allprojects {
     repositories {
       ...
   +   maven { url "https://packages.rnrepo.org/releases" }
     }
   }
   ```

2. **Apply the plugin in `android/app/build.gradle`:**

   ```diff
   apply plugin: "com.android.application"
   apply plugin: "org.jetbrains.kotlin.android"
   apply plugin: "com.facebook.react"
   + apply plugin: "org.rnrepo.tools.prebuilds-plugin"
   ```

That's it! Now build your app as usual and Gradle will pull prebuilt artifacts from `packages.rnrepo.org` whenever a library + RN version pair is available. If a dependency is missing, Gradle gracefully falls back to building from source.

---

## Troubleshooting

If you're unsure whether RNRepo has been set up correctly in your project, check the build logs and search for the `RNRepo` tag in the build output. The RNRepo plugin prints a list of libraries it successfully uses as prebuilds, along with a list of libraries it couldn't use and the reason (for example, because a prebuild isn't available for that library version).

For troubleshooting Android builds, before reporting an issue, we recommend passing the `--scan` flag to Gradle (e.g., `./gradlew app:assembleDebug --scan`). This flag generates a report of all tasks performed during the build along with their execution times, which can be useful for investigating issues such as when certain prebuilt libraries weren't loaded from the repository.

If you need to completely disable the RNRepo plugin and build all libraries from source (e.g., for debugging build issues or testing), you can set the `DISABLE_RNREPO` environment variable to any value:

```bash
DISABLE_RNREPO=1 ./gradlew app:assembleDebug
```

For more detailed troubleshooting instructions, like how to deny specific libraries, or setting a custom React-Native directory, please refer to the [Troubleshooting Guide](TROUBLESHOOTING.md).

## Limitations

RNRepo is currently in beta, and while we're working to improve compatibility, the current version has certain limitations:

1. **Android and New Architecture only:** We currently only support Android builds for React Native projects using the New Architecture. It's safe to install RNRepo even if your project doesn't meet these requirements: iOS and Android builds will simply compile from source in those cases.
2. **Local build modifications:** If you have local build-time modifications of React Native core or any library code in the form of patches (via patch-package) or build-time feature flags, the prebuilt artifacts may not be compatible with your configuration. In this case, you'll need to explicitly opt out of using prebuilds for specific libraries. If you have a use case where you'd like to use prebuilt patched libraries, reach out to [Software Mansion](https://swmansion.com/contact) to help customize the setup for you.
3. **Limited library coverage:** We host a limited subset of community libraries for specific React Native versions. Refer to `libraries.json` for the complete list of supported libraries. We're actively expanding coverage (see the section below on adding new libraries).
4. **react-native-worklets dependencies:** Packages that link with `react-native-worklets` need to specify the range of worklets library versions they support and are built separately for different versions of the worklets library. This is a temporary limitation while we work with the worklets team on a better approach for handling compile-time dependencies.
5. **C++ compile-time dependencies:** Libraries that require other C++-level compile-time dependencies cannot be pre-compiled (e.g., libraries that use nitro modules). We plan to explore long-term solutions for this limitation.
6. **Codegen requirements:** Most React Native Android libraries depend on codegen, which currently runs during app build time. Due to technical limitations, we still rely on the codegen step running locally in your build process, even when using prebuilt artifacts. Addressing this limitation is on our immediate roadmap.

## Adding new libraries to RNRepo

As RNRepo is currently in beta, we are still expanding the list of libraries that we can cover.
If you'd like us to add a specific library or React Native version, you can submit an [issue](https://github.com/software-mansion/rnrepo/issues), keep in mind that the library need to meet the following requirements:

1. It needs to have some platform native code (JS/TS only libraries won't benefit from pre-builds anyway).
2. It needs to support Android and The New Architecture (this is the only setup RNRepo currently supports).
3. It needs to have no build-time C++ dependencies on other libraries (beyond React Native itself or `react-native-worklets`, which is currently treated as the only exception). Libraries that require a fixed version of another dependency are acceptable, but we cannot pre-build libraries that need to work with multiple versions of external C++ dependencies.

## Advanced / Enterprise: GPG Verification

Enterprises often mandate artifact provenance. RNRepo signs every published artifact with a Software Mansion-controlled GPG key hosted on [keys.openpgp.org](https://keys.openpgp.org). To enable verification inside your CI/CD:

1. Fetch our public key: `curl https://keys.openpgp.org/vks/v1/by-fingerprint/6CBF6E07EBA0219DF11C9F78C9ED010ADBD95DFE | gpg --import`.
2. If not already done, configure Gradle/Maven signature checks [using the official instructions](https://developer.android.com/build/dependency-verification).
3. Store the fingerprint in your policy tooling to alert on unexpected key rotations.

> **Need help?** Reach out and we will walk your security team through the setup or provide signed attestation bundles.

---

## How RNRepo Works

1. **Curated registry:** We maintain `libraries.json`, a manifest of vetted React Native libraries + versions (and matching RN versions).
2. **Automated builds:** Dedicated GitHub Workflows monitor both RN releases and library updates. When an update lands, we spin up isolated builders, compile the Android artifacts (AAR/AAB), run validation, and publish them to our Maven repo.
3. **Transparency:** Every artifact links back to the exact workflow run, logs, and checksums so you can audit what code produced your binaries.
4. **Distribution:** Artifacts live in `https://packages.rnrepo.org/releases` and are served via standard Maven metadata, so Gradle can consume them without any custom tooling.
5. **Security:** Final artifacts are signed with our GPG key. Combined with isolated runners, this prevents tampering or substitution by adversaries.

---

## Security Model

- **Isolated GitHub Workflows:** Build jobs run in locked-down GitHub-hosted environments with no cross-job sharing, eliminating supply-chain leakage.
- **Transparent pipeline:** Every artifact references its workflow URL so you can audit logs before trusting a build.
- **GPG signing:** Artifacts are signed before upload; downstream clients can verify signatures to ensure binaries were produced by the workflow we run on Github.
- **Repository integrity:** `packages.rnrepo.org` serves checksums + signatures.

---

## Enterprise & Private Repos

Need RNRepo inside a private Maven, behind VPN, or mirrored into an internal artifact store? Software Mansion offers:

- Self-hosted Maven deployments with RNRepo content synced to your infra.
- Private RNRepo tenants with custom authentication and access controls.
- Use RNRepo for _all_ your React-Native dependencies (public repo limitations does not apply as private repo will be scoped to your app's dependencies only)
- SLA-backed onboarding, monitoring, and support.

➡️ **Reach out to [Software Mansion](https://swmansion.com/contact)** to learn how RNRepo can work best for your organization.

---

## Roadmap

- ✅ Public beta with shared Maven repo.
- 🔜 iOS support in beta.
- 🔜 Skip local codegen runs for libraries (will improve build times even more).
- 🔜 Expanded library coverage.
- 🔜 Production release (general availability).
