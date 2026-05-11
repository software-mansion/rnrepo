import * as fs from 'fs';
import * as path from 'path';

// Get android and ios directories from command line arguments
if (process.argv.length < 4) {
  console.error('❌ Usage: bun run applyRNRepoAndroid.ts <android_directory> <ios_directory>');
  process.exit(1);
}
const androidDir = process.argv[2];
const iosDir = process.argv[3];

// Android
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

// iOS
const podfileRequire = `require Pod::Executable.execute_command('node', ['-p',
  'require.resolve(
  "@rnrepo/build-tools/cocoapods-plugin/lib/plugin.rb",
  {paths: [process.argv[1]]},
)', __dir__]).strip`;
const postInstallRegex = /(post_install do \|installer\|)/;
const postInstallRNRepo = `rnrepo_post_install(installer)`;

/**
 * Modify project build.gradle file
 */
function modifyProjectBuildGradle(projectBuildGradlePath: string): void {
  console.log('\n📝 Modifying project build.gradle...');

  try {
    let content = fs.readFileSync(projectBuildGradlePath, 'utf8');
    const normalizedNewBlock = rnrepoClasspathBlock.replace(/\s+/g, '');
    const normalizedContents = content.replace(/\s+/g, '');
    
    if (normalizedContents.includes(normalizedNewBlock)) {
      console.log('  ✓ Classpath dependency already exists');
      return;
    }

    if (!classpathRegex.test(content)) {
      console.log('  ⚠ Could not add classpath dependency - no classpath found');
      return;
    }

    const updated = content.replace(
      classpathRegex,
      `$1\n${rnrepoClasspathBlock}`
    );

    console.log('  ✓ Added classpath dependency');
    fs.writeFileSync(projectBuildGradlePath, updated, 'utf8');
  } catch (error) {
    console.error(`❌ Error modifying project build.gradle: ${error}`);
    throw error;
  }
}

/**
 * Modify app build.gradle file
 */
function modifyAppBuildGradle(appBuildGradlePath: string): void {
  console.log('\n📝 Modifying app build.gradle...');

  try {
    let content = fs.readFileSync(appBuildGradlePath, 'utf8');
    if (content.includes(applyPluginRNRepo)) {
      console.log('  ✓ RNRepo plugin already applied');
      return;
    }

    if (!content.includes(applyPluginFacebook)) {
      console.log('  ⚠ Could not add RNRepo plugin - no facebook react plugin found');
      return;
    }

    const updated = content.replace(
      applyPluginFacebook,
      `${applyPluginFacebook}\n${applyPluginRNRepo}`
    );

    console.log('  ✓ Added RNRepo plugin');
    fs.writeFileSync(appBuildGradlePath, updated, 'utf8');
  } catch (error) {
    console.error(`❌ Error modifying app build.gradle: ${error}`);
    throw error;
  }
}

function checkIfPathExists(paths: string[]): void {
  paths.forEach((path) => {
    if (!fs.existsSync(path)) {
      console.error(`❌ Path ${path} does not exist`);
      process.exit(1);
    }
  });
}

function androidRNRepoConfig(androidDir: string): void {
  console.log(`🛠 Applying RNRepo configuration to: ${androidDir}`);

  const projectBuildGradlePath = path.join(androidDir, 'build.gradle');
  const appBuildGradlePath = path.join(androidDir, 'app', 'build.gradle');
  checkIfPathExists([projectBuildGradlePath, appBuildGradlePath]);

  try {
    modifyProjectBuildGradle(projectBuildGradlePath);
    modifyAppBuildGradle(appBuildGradlePath);
    console.log('\n✅ RNRepo configuration applied successfully!');
  } catch (error) {
    console.error(`\n❌ Failed to apply RNRepo configuration: ${error}`);
    process.exit(1);
  }
}

function iosRNRepoConfig(iosDir: string): void {
  console.log(`🛠 Applying RNRepo configuration to: ${iosDir}`);

  const podfilePath = path.join(iosDir, 'Podfile');
  checkIfPathExists([podfilePath]);

  try {
    let content = fs.readFileSync(podfilePath, 'utf8');
    const normalizedNewBlock = podfileRequire.replace(/\s+/g, '');
    const normalizedContents = content.replace(/\s+/g, '');

    if (normalizedContents.includes(normalizedNewBlock)) {
      console.log('  ✓ Podfile requirement already exists');
      return;
    }

    // add podfileRequire
    if (!content.includes(podfileRequire)) {
      content = `${podfileRequire}\n\n${content}`;
    } 

    const updated = content.replace(
      postInstallRegex,
      `${postInstallRNRepo}\n\n$1`
    );

    console.log('  ✓ Added Podfile requirement');
    fs.writeFileSync(podfilePath, updated, 'utf8');
  } catch (error) {
    console.error(`❌ Error modifying Podfile: ${error}`);
    throw error;
  }
}

// run main function
androidRNRepoConfig(androidDir);
iosRNRepoConfig(iosDir);
