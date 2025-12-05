import * as fs from 'fs';
import * as path from 'path';

// Get android directory, plugin version, and maven repository type from command line arguments
if (process.argv.length < 5) {
  console.error('❌ Usage: bun run applyRNRepoAndroid.ts <android_directory> <android_gradle_plugin_version> <maven_repository_type>');
  process.exit(1);
}
const androidDir = process.argv[2];
const androidGradlePluginVersion = process.argv[3];
const mavenRepositoryType = process.argv[4] as 'releases' | 'snapshots';

// Configuration constants
const classpathRegex = /(classpath.*)/;
const rnrepoClasspath = `classpath("org.rnrepo.tools:prebuilds-plugin:${androidGradlePluginVersion}")`;
const mavenCentralRepository = `mavenCentral()`;
const mavenRepositoryBlock = `
    maven { url "https://packages.rnrepo.org/${mavenRepositoryType}" }`;
const applyPluginRNRepo = 'apply plugin: "org.rnrepo.tools.prebuilds-plugin"';
const applyPluginFacebook = 'apply plugin: "com.facebook.react"';
const applyPluginFacebookRootProject =
  'apply plugin: "com.facebook.react.rootproject"';
const mavenAllProjectsBlock = `
allprojects {
    repositories {
        maven { url "https://packages.rnrepo.org/${mavenRepositoryType}" }
    }
}`;

// Apply RNRepo configuration
applyRNRepoConfiguration(androidDir);

/**
 * Add classpath dependency to project build.gradle
 */
function addClasspathDependency(content: string): string {
  if (content.includes(rnrepoClasspath)) {
    console.log('  ✓ Classpath dependency already exists');
    return content;
  }

  const updated = content.replace(classpathRegex, `$1\n    ${rnrepoClasspath}`);
  if (updated !== content) {
    console.log('  ✓ Added classpath dependency');
    return updated;
  }

  console.log('  ⚠ Could not add classpath dependency - no classpath found');
  return content;
}

/**
 * Add maven repository to project build.gradle
 */
function addMavenRepository(content: string): string {
  if (content.includes('https://packages.rnrepo.org/')) {
    console.log('  ✓ RNRepo maven repository already exists');
    return content;
  }

  if (!content.includes(mavenCentralRepository)) {
    console.log('  ⚠ Could not add maven repository - no mavenCentral() found');
    return content;
  }

  const updated = content.replace(
    mavenCentralRepository,
    `${mavenCentralRepository}${mavenRepositoryBlock}`
  );
  console.log('  ✓ Added maven repository');
  return updated;
}

/**
 * Add allprojects block to project build.gradle
 */
function addAllProjectsBlock(content: string): string {
  if (content.includes('allprojects {')) {
    console.log('  ✓ allprojects block already exists');
    return content;
  }

  if (!content.includes(applyPluginFacebookRootProject)) {
    console.log('  ⚠ Could not add allprojects block - no rootproject plugin found');
    return content;
  }

  const updated = content.replace(
    applyPluginFacebookRootProject,
    `${mavenAllProjectsBlock}\n\n${applyPluginFacebookRootProject}`
  );
  console.log('  ✓ Added allprojects block');
  return updated;
}

/**
 * Modify project build.gradle file
 */
function modifyProjectBuildGradle(projectBuildGradlePath: string): void {
  console.log('\n📝 Modifying project build.gradle...');

  try {
    let content = fs.readFileSync(projectBuildGradlePath, 'utf8');

    // Apply modifications
    content = addClasspathDependency(content);
    content = addMavenRepository(content);
    content = addAllProjectsBlock(content);

    // Write back to file
    fs.writeFileSync(projectBuildGradlePath, content, 'utf8');
  } catch (error) {
    console.error(`❌ Error modifying project build.gradle: ${error}`);
    throw error;
  }
}

/**
 * Add RNRepo plugin to app build.gradle
 */
function addRNRepoPlugin(content: string): string {
  if (content.includes(applyPluginRNRepo)) {
    console.log('  ✓ RNRepo plugin already applied');
    return content;
  }

  if (!content.includes(applyPluginFacebook)) {
    console.log('  ⚠ Could not add RNRepo plugin - no facebook react plugin found');
    return content;
  }

  const updated = content.replace(
    applyPluginFacebook,
    `${applyPluginFacebook}\n${applyPluginRNRepo}`
  );
  console.log('  ✓ Added RNRepo plugin');
  return updated;
}

/**
 * Modify app build.gradle file
 */
function modifyAppBuildGradle(appBuildGradlePath: string): void {
  console.log('\n📝 Modifying app build.gradle...');

  try {
    let content = fs.readFileSync(appBuildGradlePath, 'utf8');

    // Apply modifications
    content = addRNRepoPlugin(content);

    // Write back to file
    fs.writeFileSync(appBuildGradlePath, content, 'utf8');
  } catch (error) {
    console.error(`❌ Error modifying app build.gradle: ${error}`);
    throw error;
  }
}

/**
 * Main function - apply RNRepo configuration to Android project
 */
function applyRNRepoConfiguration(androidDir: string): void {
  console.log(`🛠  Applying RNRepo configuration to: ${androidDir}`);

  const projectBuildGradlePath = path.join(androidDir, 'build.gradle');
  const appBuildGradlePath = path.join(androidDir, 'app', 'build.gradle');

  // Validate paths exist
  if (!fs.existsSync(projectBuildGradlePath)) {
    console.error(`❌ Project build.gradle not found at: ${projectBuildGradlePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(appBuildGradlePath)) {
    console.error(`❌ App build.gradle not found at: ${appBuildGradlePath}`);
    process.exit(1);
  }

  try {
    modifyProjectBuildGradle(projectBuildGradlePath);
    modifyAppBuildGradle(appBuildGradlePath);
    console.log('\n✅ RNRepo configuration applied successfully!');
  } catch (error) {
    console.error(`\n❌ Failed to apply RNRepo configuration: ${error}`);
    process.exit(1);
  }
}
