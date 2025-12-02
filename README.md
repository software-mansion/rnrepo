# RNRepo Beta

RNRepo is a Software Mansion initiative that ships prebuilt Android artifacts for the React Native ecosystem so your mobile engineers can ship up to **2× faster Android builds** with zero infrastructure lift. We continuously precompile the most popular React Native libraries for specific RN versions, sign the resulting artifacts, and host them in a transparent Maven repository that any team can consume.

> ⚠️ RNRepo is currently in beta and available **only for Android** for React Native projects using **The New Architecture**. Please give it a try, share your feedback and use [issues](https://github.com/software-mansion/rnrepo/issues) to report any problems with your setup.

To get started quickly head to [Installation](#installation) section or visit [RNRepo.org](https://rnrepo.org) for instructions.

---

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

## Advanced / Enterprise: GPG Verification

Enterprises often mandate artifact provenance. RNRepo signs every published artifact with a Software Mansion-controlled GPG key hosted on [keys.openpgp.org](https://keys.openpgp.org). To enable verification inside your CI/CD:

1. Fetch our public key: `curl https://keys.openpgp.org/vks/v1/by-fingerprint/6CBF6E07EBA0219DF11C9F78C9ED010ADBD95DFE | gpg --import`.
2. If not already done, configure Gradle/Maven signature checks [using the official instructions](https://developer.android.com/build/dependency-verification)
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
- 🔜 Expanded library coverage.
- 🔜 Production release (general availability).
