<<<<<<< Updated upstream
# RNRepo
=======
# RNRepo Beta
>>>>>>> Stashed changes

RNRepo is a Software Mansion initiative that ships prebuilt Android artifacts for the React Native ecosystem so your mobile engineers can ship up to **5× faster Android builds** with zero infrastructure lift. We continuously precompile the most popular React Native libraries for specific RN versions, sign the resulting artifacts, and host them in a transparent Maven repository that any team can consume.

If you just want to jump in, head to [Installation](#installation) and you will be running in minutes. If you need to understand how the machinery works or how to adapt RNRepo inside regulated environments, the sections below walk you through every detail.

---

<<<<<<< Updated upstream
RNRepo provides an automated system for building and integrating React Native packages as AAR (Android Archive) files, dramatically improving build performance by eliminating source compilation.
=======
## Why Teams Use RNRepo
>>>>>>> Stashed changes

- Slash Android build times by up to 5× thanks to ready-to-use AARs (measured internally on the React Conf demo app).
- Keep your dependency graph fresh: we track React Native releases and rebuild libraries automatically.
- Gain build transparency and artifact integrity guarantees via isolated GitHub workflows plus GPG signing.
- Keep your workflow: RNRepo plugs into Gradle and works with stock `npx react-native run-android`.

---

## Installation

The quickest way to try RNRepo is to plug our Gradle plugin into your project. Below is the exact setup taken from `docs/TEST.md`.

1. **Create (or open) a React Native project** targeting `react-native@0.81.4` (or compatible version).

   ```bash
   # optional clean-up of legacy CLI
   # npm uninstall -g react-native-cli @react-native-community/cli
   npx @react-native-community/cli@latest init AwesomeProject --version 0.81.4
   cd AwesomeProject
   ```

2. **Add the RNRepo plugin to `android/build.gradle`:**

   ```diff
   buildscript {
     ...
     dependencies {
       ...
   +   classpath("org.rnrepo.tools:prebuilds-plugin:+")
     }
   }
   apply plugin: "com.facebook.react.rootproject"
   +
   +repositories {
   +  maven { url "https://packages.rnrepo.org/releases" }
   +}
   ```

3. **Apply the plugin in `android/app/build.gradle`:**

   ```diff
   apply plugin: "com.android.application"
   apply plugin: "org.jetbrains.kotlin.android"
   apply plugin: "com.facebook.react"
   +apply plugin: "org.rnrepo.tools.prebuilds-plugin"
   ```

4. **Install any libraries you want to accelerate** (example: `react-native-svg@15.13.0`):

   ```diff
     "dependencies": {
       ...
       "react-native-safe-area-context": "^5.5.2",
   +   "react-native-svg": "15.13.0"
     },
   ```

5. **Build as usual:**

   ```bash
   npm install
   npm run android
   ```

That is it—Gradle will now pull prebuilt artifacts from `packages.rnrepo.org` whenever a library + RN version pair is available. If a dependency is missing, Gradle gracefully falls back to building from source.

---

## Advanced / Enterprise: GPG Verification

Enterprises often mandate artifact provenance. RNRepo signs every published artifact with a Software Mansion-controlled GPG key hosted on [keys.openpgp.org](https://keys.openpgp.org). To enable verification inside your CI/CD:

1. Fetch our public key: `curl https://keys.openpgp.org/vks/v1/by-fingerprint/<RNREPO_FINGERPRINT> | gpg --import`.
2. Configure Gradle/Maven signature checks (**placeholder: docs coming soon**).
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
- **GPG signing:** Artifacts are signed before upload; downstream clients can verify signatures to ensure binaries were produced by Software Mansion.
- **Repository integrity:** `packages.rnrepo.org` serves checksums + signatures, and we never mutate published versions.

Need deeper assurances (air-gapped builds, SLSA attestations, etc.)? Contact us—we already operate bespoke pipelines for regulated partners.

---

## FAQ

**How do I opt out?**
Set `DISABLE_RNREPO=1` (environment variable or Gradle property). The plugin immediately stops intercepting dependencies and Gradle compiles everything from source.

**How can I tell RNRepo is active?**
Check your Android build logs: the RNRepo plugin prints a banner plus the list of libraries served from prebuilds. You will also see Maven fetches pointing to `packages.rnrepo.org`.

**Where can I see the list of prebuilt libraries?**
Browse `libraries.json` inside this repo—it enumerates every library/version/RN combo currently produced.

**How do I request a new library?**
For now this is a manual curation process. Open an issue on GitHub with the library coordinates and RN versions you need; we will triage and schedule the build.

**Does RNRepo fall back if a prebuild is missing?**
Yes. Missing entries trigger the standard Gradle compilation path so you are never blocked.

---

## Enterprise & Private Repos

Need RNRepo inside a private Maven, behind VPN, or mirrored into an internal artifact store? Software Mansion offers:

- Self-hosted Maven deployments with RNRepo content synced to your infra.
- Private RNRepo tenants with custom authentication and access controls.
- SLA-backed onboarding, monitoring, and support.

➡️ **Reach out to Software Mansion** (contact info coming soon) and we will design the right topology for your organization.

---

## Roadmap & Placeholders

- ✅ Public beta with shared Maven repo.
- 🔜 Detailed GPG verification guide (`gradle.properties`, signature tasks, etc.).
- 🔜 UI/CLI for browsing available prebuilds.
- 🔜 Automatic request flow for new libraries.

If you have feedback or need something that is not covered above, please open an issue—RNRepo is evolving quickly and we would love to hear from early adopters.
