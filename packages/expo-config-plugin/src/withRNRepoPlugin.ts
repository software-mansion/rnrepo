import { withProjectBuildGradle, withAppBuildGradle } from '@expo/config-plugins'; 
import type { ExpoConfig } from '@expo/config-types';

const classpathRegex = /(classpath.*)/;
const rnrepoClasspath = 'classpath fileTree(dir: "../node_modules/@rnrepo/build-tools/gradle-plugin/build/libs", include: ["build-tools-*.jar"])';
const applyPluginrnrepo = 'apply plugin: "org.rnrepo.tools.prebuilds-plugin"';
const applyPluginFacebook = 'apply plugin: "com.facebook.react"';
const applyPluginFacebookRootProject =
  'apply plugin: "com.facebook.react.rootproject"';
const mavenAllProjectsBlock = `
allprojects {
    repositories {
        maven { url "https://packages.rnrepo.org/releases" }
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
  config = withRnrepoPluginApplication(config);
  config = withAllProjectsMavenRepository(config);
  return config;
}
