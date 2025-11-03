const { withProjectBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');

const classpathRegex = /(classpath.*)/;
const buildleClasspath = 'classpath("com.swmansion:buildle-plugin:1.0.6")';
const mavenCentralRepository = `mavenCentral()`;
const mavenRepositoryBlock = `
    maven {
        name "reposiliteRepositoryReleases"
        url "https://repo.swmtest.xyz/releases"
    }`;
const applyPluginBuildle = 'apply plugin: "com.swmansion.buildle"';
const applyPluginFacebook = 'apply plugin: "com.facebook.react"';


function withClasspathDependency(config) {
    return withProjectBuildGradle(config, config => {
        if (!config.modResults.contents.includes(buildleClasspath)) {
            config.modResults.contents = config.modResults.contents.replace(classpathRegex, `$1\n${buildleClasspath}`);
        }
        return config;
    });
}

function withMavenRepository(config) {
    return withProjectBuildGradle(config, config => {
        if (!config.modResults.contents.includes(mavenRepositoryBlock)) {
            config.modResults.contents = config.modResults.contents.replaceAll(
                mavenCentralRepository,
                `${mavenCentralRepository}${mavenRepositoryBlock}`
            )
        }
        return config;
    });
}

function withBuildlePluginApplication(config) {
    return withAppBuildGradle(config, config => {
        if (!config.modResults.contents.includes(applyPluginBuildle)) {
            config.modResults.contents = config.modResults.contents.replace(
                applyPluginFacebook,
                `${applyPluginFacebook}\n${applyPluginBuildle}`
            );
        }
        return config;
    });
}

const withCustomBuildSettings = config => {
    config = withClasspathDependency(config);
    config = withMavenRepository(config);
    config = withBuildlePluginApplication(config);
    return config;
};

module.exports = withCustomBuildSettings;