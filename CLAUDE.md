# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

RNRepo is a build infrastructure that pre-builds React Native community libraries and distributes them as native artifacts (`.aar` for Android, `.xcframework` for iOS), eliminating redundant source compilation. It has two sides:

- **Infrastructure** (this repo): automated monitoring, building, and publishing pipeline
- **End-user tooling**: Gradle plugin, CocoaPods plugin, and Expo config plugin that substitute prebuilts transparently during app builds

## Commands

### TypeScript (Bun)
```bash
bun install                   # install all workspace dependencies
bun test                      # run all TypeScript tests
bun run lint-ts               # ESLint across TypeScript files
bun run validate              # validate libraries.json and react-native-versions.json against JSON schema
```

### Gradle plugin (Kotlin)
```bash
bun run test-gradle-client    # run JUnit 5 tests (uses Gradle TestKit)
bun run lint-gradle-client    # Spotless check (Kotlin formatting)

# Build the JAR (required before the plugin can be used):
bun run build --filter @rnrepo/build-tools
# or directly:
./packages/build-tools/gradle-plugin/gradlew build --no-daemon -p packages/build-tools/gradle-plugin
```

### Expo config plugin
```bash
cd packages/expo-config-plugin
bun run build     # expo-module build (compiles TS → build/)
bun run test      # expo-module test
bun run lint      # expo-module lint
```

## Architecture

### Pipeline: how prebuilts are produced and published

```
Scheduler (cron, every 4h)
  → monitors NPM/GitHub for new library and RN releases
  → writes jobs to Supabase (@rnrepo/database)
  → dispatches build-library-android.yml / build-library-ios.yml via GitHub Actions API

Builder (@rnrepo/builder)
  → sets up a temporary RN project with the target library
  → runs Gradle / xcodebuild
  → outputs Maven-compatible artifacts

Publisher (@rnrepo/publisher)
  → triggered on build completion (workflow_run)
  → uploads .aar/.xcframework to packages.rnrepo.org (Maven server)
```

### End-user integration: how prebuilts are consumed

When an app developer installs `@rnrepo/build-tools` or `@rnrepo/expo-config-plugin`, the following happens at build time:

**Android (Gradle plugin)**
- Plugin ID: `org.rnrepo.tools.prebuilds-plugin`
- Entry class: `org.rnrepo.tools.prebuilds.PrebuildsPlugin`
- Source: `packages/build-tools/gradle-plugin/src/main/kotlin/`
- The plugin JAR is not committed to git (`gradle-plugin/build/` is gitignored). It must be built before use — see the CI step "Build Gradle Plugin JAR" in the workflows.
- Loaded via `classpath fileTree(dir: "${rnrepoDir}/gradle-plugin/build/libs", include: ["prebuilds-plugin.jar"])`

**iOS (CocoaPods plugin)**
- Entry: `packages/build-tools/cocoapods-plugin/lib/plugin.rb`
- Exposes `rnrepo_pre_install(installer_context)` and `rnrepo_post_install(installer)`
- Modules: `pod_extractor.rb` (find RN pods), `downloader.rb` (fetch xcframeworks), `framework_cache.rb`
- Falls back to source build if no prebuilt exists

**Expo (config plugin)**
- Source: `packages/expo-config-plugin/src/withRNRepoPlugin.ts`
- Runs during `expo prebuild`; auto-applies the Gradle and CocoaPods plugins to generated native directories
- Uses `withProjectBuildGradle`, `withAppBuildGradle`, `withDangerousMod` from `@expo/config-plugins`

### Key configuration files (end-user)
- `rnrepo.config.json` (in the app root): deny list for per-library opt-out
- `DISABLE_RNREPO=true` env var: disables the plugin entirely (used in CI to test builds without RNRepo)

### Key data files (this repo)
- `libraries.json`: list of supported libraries with versions (validated by `libraries.schema.json`)
- `react-native-versions.json`: supported RN versions

## Multi-language structure

| Layer | Language | Tool |
|---|---|---|
| Scheduler / Builder / Publisher | TypeScript | Bun |
| Gradle plugin | Kotlin | Gradle (JVM 11) |
| CocoaPods plugin | Ruby | gem (no external deps) |
| Expo config plugin | TypeScript | expo-module-scripts |
| Website | TypeScript / Astro | Bun |
| Database | TypeScript | Supabase JS |

## CI workflows

The workflows in `.github/workflows/` and composite actions in `.github/actions/` follow this pattern:

- **build-example-expo-app.yml** and **build-example-rn-app.yml**: integration tests that spin up a real app, install the plugins, and do a full Gradle/xcodebuild. These require the Gradle plugin JAR to be built first (step "Build Gradle Plugin JAR") since the JAR is gitignored.
- **setup-expo-example-app/** and **setup-rn-example-app/**: composite actions for the above. Inputs use `type:` field which is not supported in composite actions (ignored by GitHub); boolean inputs must be compared with `== 'true'` not evaluated directly (non-empty string `"false"` is truthy).
- **build-library-android.yml / build-library-ios.yml**: dispatched by the scheduler per library×RN version combination.
- **publish-library-*.yml**: triggered by `workflow_run` on successful build jobs.
- iOS builds run on self-hosted runners `[self-hosted, macOS, ARM64, ephemeral]`; Android on `rnrepo-builder-ubuntu-latest`.
