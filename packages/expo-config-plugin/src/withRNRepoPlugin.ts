import { withProjectBuildGradle, withAppBuildGradle, withDangerousMod } from '@expo/config-plugins'; 
import type { ExpoConfig } from '@expo/config-types';
import * as fs from 'fs';
import * as path from 'path';

// Android
const classpathRegex = /(classpath.*)/;
const rnrepoClasspath = 'classpath("org.rnrepo.tools:prebuilds-plugin:0.2.2")';
const mavenCentralRepository = `mavenCentral()`;
const mavenRepositoryBlock = `
    maven { url "https://packages.rnrepo.org/releases" }`;
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
// iOS
const podfileRequire = `require Pod::Executable.execute_command('node', ['-p',
  'require.resolve(
  "@rnrepo/prebuilds-plugin/cocoapods-plugin/lib/plugin.rb",
  {paths: [process.argv[1]]},
)', __dir__]).strip`;
const postInstallRegex = /post_install do \|installer\|/;
const postInstallRNRepo = `rnrepo_post_install(installer)`;

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

function withRNRepoPodfile(config: ExpoConfig) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');
        if (!podfileContent.includes('@rnrepo/prebuilds-plugin/cocoapods-plugin/lib/plugin.rb')) {
          podfileContent = `${podfileRequire}\n\n${podfileContent}`;
          fs.writeFileSync(podfilePath, podfileContent);
        }
        if (!podfileContent.includes('rnrepo_post_install')) {
          podfileContent = podfileContent.replace(
            postInstallRegex,
            `post_install do |installer|\n  ${postInstallRNRepo}`
          );
          fs.writeFileSync(podfilePath, podfileContent);
        }
      }
      
      return config;
    },
  ]);
}

export default function withRNRepoPlugin(config: ExpoConfig): ExpoConfig {
  config = withClasspathDependency(config);
  config = withMavenRepository(config);
  config = withRnrepoPluginApplication(config);
  config = withAllProjectsMavenRepository(config);
  config = withRNRepoPodfile(config);
  return config;
}
