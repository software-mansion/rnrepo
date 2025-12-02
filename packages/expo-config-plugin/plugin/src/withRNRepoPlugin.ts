import { withProjectBuildGradle } from '@expo/config-plugins';
import { withAppBuildGradle } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';

const classpathRegex = /(classpath.*)/;
const rnrepoClasspath = 'classpath("org.rnrepo.tools:prebuilds-plugin:0.1.0")';
const mavenCentralRepository = `mavenCentral()`;
const mavenRepositoryBlock = `
    maven {
        name "RNRepoMavenRepository"
        url "https://packages.rnrepo.org/releases"
    }`;
// Todo(radoslawrolka): change snapshots to releases when releasing
const applyPluginrnrepo = 'apply plugin: "org.rnrepo.tools.prebuilds-plugin"';
const applyPluginFacebook = 'apply plugin: "com.facebook.react"';
const applyPluginFacebookRootProject =
  'apply plugin: "com.facebook.react.rootproject"';
const mavenAllProjectsBlock = `
allprojects {
    repositories {
        maven {
            name "RNRepoMavenRepository"
            url "https://packages.rnrepo.org/releases"
        }
    }
}`;

function withAllProjectsMavenRepository(config: ExpoConfig) {
  return withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(mavenAllProjectsBlock)) {
      config.modResults.contents = config.modResults.contents.replace(
        applyPluginFacebookRootProject,
        `${mavenAllProjectsBlock}\n\n${applyPluginFacebookRootProject}`
      );
    }
    return config;
  });
}

function withClasspathDependency(config: ExpoConfig) {
  return withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(rnrepoClasspath)) {
      config.modResults.contents = config.modResults.contents.replace(
        classpathRegex,
        `$1\n${rnrepoClasspath}`
      );
    }
    return config;
  });
}

function withMavenRepository(config: ExpoConfig) {
  return withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(mavenRepositoryBlock)) {
      config.modResults.contents = config.modResults.contents.replaceAll(
        mavenCentralRepository,
        `${mavenCentralRepository}${mavenRepositoryBlock}`
      );
    }
    return config;
  });
}

function withRnrepoPluginApplication(config: ExpoConfig) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(applyPluginrnrepo)) {
      config.modResults.contents = config.modResults.contents.replace(
        applyPluginFacebook,
        `${applyPluginFacebook}\n${applyPluginrnrepo}`
      );
    }
    return config;
  });
}

export default function withRNRepoPlugin(config: ExpoConfig): ExpoConfig {
  config = withClasspathDependency(config);
  config = withMavenRepository(config);
  config = withRnrepoPluginApplication(config);
  config = withAllProjectsMavenRepository(config);
  return config;
}
