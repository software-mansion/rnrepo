import * as fs from 'fs';
import * as path from 'path';

// Get app directory from command line arguments
if (process.argv.length < 3) {
  console.error('❌ Usage: bun run applyRNRepo.ts <app_directory>');
  process.exit(1);
}
const appDir = process.argv[2];
const androidDir = path.join(appDir, 'android');
const iosDir = path.join(appDir, 'ios');

// Configuration constants - Android
const classpathRegex = /(classpath.*)/;
const rnrepoClasspathBlock = `def rnrepoDir = new File(
     providers.exec {
       workingDir(rootDir)
       commandLine("node", "--print", "require.resolve('@rnrepo/build-tools/package.json')")
     }.standardOutput.asText.get().trim()
   ).getParentFile().absolutePath
   classpath fileTree(dir: "\${rnrepoDir}/gradle-plugin/build/libs", include: ["prebuilds-plugin.jar"])
`;
const applyPluginRNRepo = 'apply plugin: "org.rnrepo.tools.prebuilds-plugin"';
const applyPluginFacebook = 'apply plugin: "com.facebook.react"';
const applyPluginFacebookRootProject =
  'apply plugin: "com.facebook.react.rootproject"';
const mavenAllProjectsBlock = `
allprojects {
    repositories {
        maven { url "https://packages.rnrepo.org/releases" }
    }
}`;

// Configuration constants - iOS
const podfileRequire = `require Pod::Executable.execute_command('node', ['-p',
  'require.resolve(
  "@rnrepo/build-tools/cocoapods-plugin/lib/plugin.rb",
  {paths: [process.argv[1]]},
)', __dir__]).strip`;
const postInstallRegex = /(post_install do \|installer\|)/;
const postInstallRNRepo = `rnrepo_post_install(installer)`;

// Apply RNRepo configuration
if (fs.existsSync(androidDir)) {
  applyRNRepoAndroidConfiguration(androidDir);
}
if (fs.existsSync(iosDir)) {
  applyRNRepoIOSConfiguration(iosDir);
}

/**
 * Add classpath dependency to project build.gradle
 */
function addClasspathDependency(content: string): string {
  const normalizedBlock = rnrepoClasspathBlock.replace(/\s+/g, '');
  const normalizedContent = content.replace(/\s+/g, '');

  if (normalizedContent.includes(normalizedBlock)) {
    console.log('  ✓ Classpath dependency already exists');
    return content;
  }

  const updated = content.replace(classpathRegex, `$1\n${rnrepoClasspathBlock}`);
  if (updated !== content) {
    console.log('  ✓ Added classpath dependency');
    return updated;
  }

  console.log('  ⚠ Could not add classpath dependency - no classpath found');
  return content;
}

/**
 * Add allprojects block to project build.gradle
 */
function addAllProjectsBlock(content: string): string {
  const normalizedBlock = mavenAllProjectsBlock.replace(/\s+/g, '');
  const normalizedContent = content.replace(/\s+/g, '');

  if (normalizedContent.includes(normalizedBlock)) {
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
 * Add require statement to Podfile
 */
function addPodfileRequire(content: string): string {
  if (content.includes('@rnrepo/build-tools/cocoapods-plugin/lib/plugin.rb')) {
    console.log('  ✓ Podfile require already exists');
    return content;
  }

  console.log('  ✓ Added Podfile require');
  return `${podfileRequire}\n\n${content}`;
}

/**
 * Add post_install hook to Podfile
 */
function addPostInstallHook(content: string): string {
  if (content.includes('rnrepo_post_install')) {
    console.log('  ✓ post_install hook already exists');
    return content;
  }

  const updated = content.replace(postInstallRegex, `$1\n  ${postInstallRNRepo}`);
  if (updated !== content) {
    console.log('  ✓ Added post_install hook');
    return updated;
  }

  console.log('  ⚠ Could not add post_install hook - no post_install block found');
  return content;
}

/**
 * Modify Podfile
 */
function modifyPodfile(podfilePath: string): void {
  console.log('\n📝 Modifying Podfile...');

  try {
    let content = fs.readFileSync(podfilePath, 'utf8');

    // Apply modifications
    content = addPodfileRequire(content);
    content = addPostInstallHook(content);

    // Write back to file
    fs.writeFileSync(podfilePath, content, 'utf8');
  } catch (error) {
    console.error(`❌ Error modifying Podfile: ${error}`);
    throw error;
  }
}

function validateFile(filePath: string, fileName: string): void {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${fileName} not found at: ${filePath}`);
    process.exit(1);
  }
}

/**
 * Apply RNRepo configuration to iOS project
 */
function applyRNRepoIOSConfiguration(iosDir: string): void {
  console.log(`\n🛠 Applying RNRepo iOS configuration to: ${iosDir}`);

  const podfilePath = path.join(iosDir, 'Podfile');

  validateFile(podfilePath, 'Podfile');

  try {
    modifyPodfile(podfilePath);
    console.log('\n✅ RNRepo iOS configuration applied successfully!');
  } catch (error) {
    console.error(`\n❌ Failed to apply RNRepo iOS configuration: ${error}`);
    process.exit(1);
  }
}

/**
 * Apply RNRepo configuration to Android project
 */
function applyRNRepoAndroidConfiguration(androidDir: string): void {
  console.log(`🛠 Applying RNRepo Android configuration to: ${androidDir}`);

  const projectBuildGradlePath = path.join(androidDir, 'build.gradle');
  const appBuildGradlePath = path.join(androidDir, 'app', 'build.gradle');

  // Validate paths exist
  validateFile(projectBuildGradlePath, 'Project build.gradle');
  validateFile(appBuildGradlePath, 'App build.gradle');

  try {
    modifyProjectBuildGradle(projectBuildGradlePath);
    modifyAppBuildGradle(appBuildGradlePath);
    console.log('\n✅ RNRepo Android configuration applied successfully!');
  } catch (error) {
    console.error(`\n❌ Failed to apply RNRepo configuration: ${error}`);
    process.exit(1);
  }
}
