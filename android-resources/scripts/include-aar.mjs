import * as path from "node:path";
import {program} from "commander";
import {$} from "zx";
import * as fs from "node:fs";

const isDirectory = (dir) => {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};

program
  .option("-p, --packages <packages>", "Comma-separated list of package names to include")
  .option("-s, --source-packages <packages>", "Comma-separated list of packages to build from source")
  .requiredOption("-a, --android-project <path>", "Path to Android project directory")
  .option("--libs-dir <path>", "Path to libs directory", "android/libs")
  .option("--setup-only", "Only run setupAars, don't modify package lists", false);

program.parse(process.argv, {from: "node"});
const options = program.opts();

async function main() {
  try {
    const androidProjectPath = path.resolve(options.androidProject);
    if (!isDirectory(androidProjectPath)) {
      throw new Error(`Android project directory doesn't exist: ${androidProjectPath}`);
    }

    const buildGradlePath = path.join(androidProjectPath, 'android', 'build.gradle');
    if (!fs.existsSync(buildGradlePath)) {
      throw new Error(`build.gradle not found at: ${buildGradlePath}`);
    }

    // Read current build.gradle
    let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');

    // Update package configuration if not setup-only
    if (!options.setupOnly) {
      const aarPackages = options.packages ? options.packages.split(',').map(p => p.trim()) : [];
      const sourcePackages = options.sourcePackages ? options.sourcePackages.split(',').map(p => p.trim()) : [];
      
      console.log(`📦 Configuring AAR packages: ${aarPackages.join(', ') || 'none'}`);
      console.log(`🔧 Source packages: ${sourcePackages.join(', ') || 'none'}`);
      
      // Find and replace the aarAutomation block
      const aarAutomationRegex = /aarAutomation\s*\{[^}]*\}/;
      const newAarConfig = `aarAutomation {
    packages = [${aarPackages.map(p => `'${p}'`).join(', ')}]
    autolinkedPackages = [${sourcePackages.map(p => `'${p}'`).join(', ')}]
    addBuildConfigField = true
    outputDir = "${options.libsDir}"
}`;

      if (aarAutomationRegex.test(buildGradleContent)) {
        buildGradleContent = buildGradleContent.replace(aarAutomationRegex, newAarConfig);
      } else {
        // Add aarAutomation block if it doesn't exist
        buildGradleContent += `\n\n// AAR automation configuration\n${newAarConfig}\n`;
      }
      
      fs.writeFileSync(buildGradlePath, buildGradleContent, 'utf8');
      console.log(`✅ Updated ${buildGradlePath}`);
    }

    // Run setupAars
    console.log("🔧 Running setupAars to generate configuration files...");
    const setupResult = await $({
      cwd: androidProjectPath,
      stdio: "inherit"
    })`./android/gradlew -p android setupAars`;

    if (setupResult.exitCode !== 0) {
      throw new Error("Failed to run setupAars");
    }

    console.log("✅ Successfully configured AAR integration");

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();