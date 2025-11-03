import path from "node:path";
import {program} from "commander";
import {$, globby} from "zx";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDirectory = (dir: string) => {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};

program
  .option("-p, --packages <packages>", "Comma-separated list of package names to build")
  .option("-o, --output <path>", "Output directory for AAR files", ".")
  .requiredOption("-a, --android-project <path>", "Path to Android project directory")
  .option("--skip-install", "Skip npm install step", false);

program.parse(process.argv, {from: "node"});
const options = program.opts();

if (!options.packages) {
  throw new Error("Please specify packages to build with --packages");
}

const outputDir = path.resolve(options.output);
if (!isDirectory(outputDir)) {
  fs.mkdirSync(outputDir, {recursive: true});
}

const androidProjectPath = path.resolve(options.androidProject);
if (!isDirectory(androidProjectPath)) {
  throw new Error(`Android project directory doesn't exist: ${androidProjectPath}`);
}

const packages = options.packages.split(',').map((p: string) => p.trim());
const buildAarScript = path.join(__dirname, 'build-aar-core.js');

if (!fs.existsSync(buildAarScript)) {
  throw new Error(`build-aar-core.js script not found at: ${buildAarScript}`);
}

console.log(`Building AARs for packages: ${packages.join(', ')}`);
console.log(`Output directory: ${outputDir}`);
console.log(`Android project: ${androidProjectPath}`);

for (const packageName of packages) {
  console.log(`\n📦 Building AAR for ${packageName}...`);
  
  const buildResult = await $({
    cwd: androidProjectPath,
    stdio: "inherit"
  })`node ${buildAarScript} ${packageName} .`;
  
  if (buildResult.exitCode !== 0) {
    throw new Error(`Failed to build AAR for ${packageName}`);
  }
  
  // Copy AAR from sandbox to output directory
  const gradleProjectName = packageName.replace(/^@/, '').replace(/\//g, '_');
  const sourceAar = path.join(androidProjectPath, 'android', 'libs', `${gradleProjectName}.aar`);
  const targetAar = path.join(outputDir, `${gradleProjectName}.aar`);
  
  if (fs.existsSync(sourceAar)) {
    fs.copyFileSync(sourceAar, targetAar);
    console.log(`✅ Successfully built and copied AAR: ${targetAar}`);
  } else {
    console.log(`✅ Successfully built AAR for ${packageName} (kept in sandbox)`);
  }
}

console.log(`\n🎉 All AARs built successfully in: ${outputDir}`);