#!/usr/bin/env node

/**
 * Standalone AAR Builder Script
 * 
 * Builds React Native packages as AAR files for faster builds
 * Usage: node build-aar.js <package-name> <project-path>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AARBuilder {
  constructor(packageName, projectPath) {
    this.packageName = packageName;
    this.gradleProjectName = this.convertToGradleProjectName(packageName);
    this.projectPath = path.resolve(projectPath);
    this.packagePath = path.join(this.projectPath, 'node_modules', packageName);
    this.tempDir = null;
  }

  convertToGradleProjectName(packageName) {
    // Convert npm package name to Gradle project name following React Native's pattern
    // @react-native-community/slider -> react-native-community_slider
    return packageName
      .replace(/^@/, '')           // Remove leading @
      .replace(/\//g, '_');        // Replace / with _
  }

  log(message) {
    console.log(`[AAR Builder] ${message}`);
  }

  error(message) {
    console.error(`[AAR Builder ERROR] ${message}`);
  }

  validateInputs() {
    if (!fs.existsSync(this.projectPath)) {
      throw new Error(`Project path does not exist: ${this.projectPath}`);
    }

    if (!fs.existsSync(this.packagePath)) {
      throw new Error(`Package not found: ${this.packageName}. Make sure it's installed in node_modules.`);
    }

    const androidPath = path.join(this.packagePath, 'android');
    if (!fs.existsSync(androidPath)) {
      throw new Error(`Package ${this.packageName} does not have an Android implementation`);
    }

    const buildGradlePath = path.join(androidPath, 'build.gradle');
    if (!fs.existsSync(buildGradlePath)) {
      throw new Error(`Package ${this.packageName} does not have a build.gradle file`);
    }

    this.log(`✓ Validated package: ${this.packageName}`);
  }

  createTempProject() {
    const tempBaseName = `aar-build-${this.packageName.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
    this.tempDir = path.join(require('os').tmpdir(), tempBaseName);
    
    this.log(`Creating temporary build project: ${this.tempDir}`);
    
    // Create temp directory structure
    fs.mkdirSync(this.tempDir, { recursive: true });
    fs.mkdirSync(path.join(this.tempDir, 'android'), { recursive: true });
    
    // Copy gradle wrapper from main project
    const wrapperFiles = ['gradle/wrapper/gradle-wrapper.jar', 'gradle/wrapper/gradle-wrapper.properties', 'gradlew', 'gradlew.bat'];
    const gradleDir = path.join(this.tempDir, 'android', 'gradle', 'wrapper');
    fs.mkdirSync(gradleDir, { recursive: true });
    
    wrapperFiles.forEach(file => {
      const srcPath = path.join(this.projectPath, 'android', file);
      const destPath = path.join(this.tempDir, 'android', file);
      
      if (fs.existsSync(srcPath)) {
        if (file.includes('/')) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
        }
        fs.copyFileSync(srcPath, destPath);
        if (file === 'gradlew') {
          fs.chmodSync(destPath, 0o755);
        }
      }
    });

    // Create minimal settings.gradle that includes the React Native gradle plugin
    const settingsContent = `
pluginManagement { includeBuild("${this.projectPath}/node_modules/@react-native/gradle-plugin") }
plugins { id("com.facebook.react.settings") }
extensions.configure(com.facebook.react.ReactSettingsExtension){ ex -> ex.autolinkLibrariesFromCommand() }

include ':${this.packageName}'
project(':${this.packageName}').projectDir = new File('${this.packagePath}/android')

includeBuild('${this.projectPath}/node_modules/@react-native/gradle-plugin')
rootProject.name = 'AAR-Builder'
`;
    fs.writeFileSync(path.join(this.tempDir, 'android', 'settings.gradle'), settingsContent.trim());

    // Copy build.gradle from main project but simplify it
    const mainBuildGradle = path.join(this.projectPath, 'android', 'build.gradle');
    let buildContent = fs.readFileSync(mainBuildGradle, 'utf8');
    
    // Remove any custom plugins that might not be available
    buildContent = buildContent.replace(/apply plugin: "aar-automation"/g, '');
    buildContent = buildContent.replace(/apply plugin: "com.swmansion.buildle"/g, '');
    buildContent = buildContent.replace(/aarAutomation\s*\{[\s\S]*?\}/g, '');
    
    // Ensure we have the necessary repositories
    if (!buildContent.includes('allprojects')) {
      buildContent += `
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url "https://www.jitpack.io" }
    }
}
`;
    }
    fs.writeFileSync(path.join(this.tempDir, 'android', 'build.gradle'), buildContent.trim());

    this.log(`✓ Created temporary build environment`);
  }

  buildAAR() {
    // Use the main project's gradle setup to build the AAR
    const gradlewPath = path.join(this.projectPath, 'android', 'gradlew');
    const workingDir = path.join(this.projectPath, 'android');
    
    this.log(`Building AAR for ${this.packageName} using main project...`);
    
    // Temporarily add the package to settings.gradle if not already there
    const settingsPath = path.join(workingDir, 'settings.gradle');
    const originalSettings = fs.readFileSync(settingsPath, 'utf8');
    
    const packageInclude = `include ':${this.gradleProjectName}'`;
    const packageProject = `project(':${this.gradleProjectName}').projectDir = new File('${this.packagePath}/android')`;
    
    let needsRestore = false;
    if (!originalSettings.includes(packageInclude)) {
      fs.appendFileSync(settingsPath, `\n${packageInclude}\n${packageProject}\n`);
      needsRestore = true;
      this.log(`✓ Temporarily added ${this.packageName} as :${this.gradleProjectName} to settings.gradle`);
    }
    
    try {
      const result = execSync(`"${gradlewPath}" :${this.gradleProjectName}:bundleReleaseAar --no-daemon`, {
        cwd: workingDir,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 300000 // 5 minute timeout
      });
      
      this.log(`✓ AAR build completed successfully`);
      return result;
    } catch (error) {
      this.error(`Build failed: ${error.message}`);
      if (error.stdout) {
        console.log('Build output:', error.stdout);
      }
      if (error.stderr) {
        console.error('Build errors:', error.stderr);
      }
      throw error;
    } finally {
      // Restore original settings.gradle
      if (needsRestore) {
        fs.writeFileSync(settingsPath, originalSettings);
        this.log(`✓ Restored original settings.gradle`);
      }
    }
  }

  copyAAR() {
    // Try both potential AAR filenames since gradle might use either
    const possibleAARs = [
      path.join(this.packagePath, 'android', 'build', 'outputs', 'aar', `${this.gradleProjectName}-release.aar`),
      path.join(this.packagePath, 'android', 'build', 'outputs', 'aar', `${this.packageName}-release.aar`)
    ];
    
    let sourceAAR = null;
    for (const aarPath of possibleAARs) {
      if (fs.existsSync(aarPath)) {
        sourceAAR = aarPath;
        break;
      }
    }
    
    if (!sourceAAR) {
      throw new Error(`Built AAR not found at any expected location: ${possibleAARs.join(', ')}`);
    }
    
    const outputDir = path.join(this.projectPath, 'android', 'libs');
    // Use gradle project name for output file to avoid filesystem issues with scoped names
    const outputAAR = path.join(outputDir, `${this.gradleProjectName}.aar`);
    
    // Create output directory if it doesn't exist
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Copy AAR file
    fs.copyFileSync(sourceAAR, outputAAR);
    
    const stats = fs.statSync(outputAAR);
    const fileSizeKB = Math.round(stats.size / 1024);
    
    this.log(`✓ AAR copied to: ${outputAAR} (${fileSizeKB}KB)`);
    return outputAAR;
  }

  cleanup() {
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      this.log(`Cleaning up temporary directory: ${this.tempDir}`);
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  async build() {
    try {
      this.log(`Starting AAR build for ${this.packageName}`);
      this.validateInputs();
      this.buildAAR();
      const outputPath = this.copyAAR();
      this.log(`🎉 Successfully built AAR: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.error(`Build failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// CLI usage
if (require.main === module) {
  const [,, packageName, projectPath] = process.argv;
  
  if (!packageName || !projectPath) {
    console.log(`
Usage: node build-aar.js <package-name> <project-path>

Examples:
  node build-aar.js react-native-svg .
  node build-aar.js react-native-linear-gradient /path/to/my-project
  node build-aar.js react-native-reanimated ./MyReactNativeApp

This script will:
1. Create a temporary build environment
2. Build the specified package as an AAR
3. Copy the AAR to <project-path>/android/libs/
4. Clean up temporary files
`);
    process.exit(1);
  }
  
  const builder = new AARBuilder(packageName, projectPath);
  builder.build();
}

module.exports = AARBuilder;