import configPlugins from '@expo/config-plugins'; 
const { withProjectBuildGradle, withAppBuildGradle } = configPlugins;

const classpathRegex = /(classpath.*)/;
const rnrepoClasspath = 'classpath("org.rnrepo.tools:prebuilds-plugin:+")';
const mavenCentralRepository = `mavenCentral()`;
const mavenRepositoryBlock = `
    maven {
        name "RNRepoMavenRepository"
        url "https://packages.rnrepo.org/snapshots"
    }`;
// Todo(radoslawrolka): change snapshots to releases when releasing
const applyPluginrnrepo = 'apply plugin: "org.rnrepo.tools.prebuilds-plugin"';
const applyPluginFacebook = 'apply plugin: "com.facebook.react"';

function withClasspathDependency(config) {
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

function withMavenRepository(config) {
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

function withRnrepoPluginApplication(config) {
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

export default function withCustomBuildSettings(config) {
  config = withClasspathDependency(config);
  config = withMavenRepository(config);
  config = withRnrepoPluginApplication(config);
  return config;
};
