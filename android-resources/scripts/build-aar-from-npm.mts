import path from "node:path";
import {program} from "commander";
import {$} from "zx";
import fs from "node:fs";

const sandboxPath = path.resolve("buildler");
if (!fs.existsSync(sandboxPath)) {
  throw new Error(`Sandbox directory doesn't exist: ${sandboxPath}. Please ensure buildler directory is available.`);
}

const sb$ = $({cwd: sandboxPath});

program
  .requiredOption('-p, --packages <packages>', 'Comma-separated list of package names to build')
  .option('-v, --version <version>', 'Version constraint for packages (e.g., ^1.0.0)', '')
  .option('-o, --output <path>', 'Output directory for AAR files', '.')
  .option('--clean-sandbox', 'Clean sandbox before building', false);

program.parse(process.argv, {from: "node"});

const options = program.opts();
const outputDir = path.resolve(options.output);
const packages = options.packages.split(',').map((p: string) => p.trim());

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, {recursive: true});
}

// Clean sandbox if requested
if (options.cleanSandbox) {
  console.log("🧹 Cleaning sandbox...");
  try {
    await sb$`git checkout main`;
    await sb$`git clean -fd`;
    await sb$`npm install`;
  } catch (e) {
    console.log("Note: Could not clean sandbox git state (may not be a git repo)");
  }
}

// Install packages
for (const packageName of packages) {
  const versionSpec = options.version ? `@${options.version}` : '';
  console.log(`📦 Installing ${packageName}${versionSpec} in sandbox...`);
  
  const install = await sb$`npm install ${packageName}${versionSpec} --save`;
  if (install.exitCode !== 0) {
    throw new Error(`Failed to install package ${packageName}: ${install.stderr}`);
  }
}

// Build AARs
console.log(`🔨 Building AARs for: ${packages.join(', ')}`);
const buildResult = await $({
  stdio: "inherit"
})`npm run build-aar -- --packages ${packages.join(',')} --android-project ${sandboxPath} --output ${outputDir}`;

if (buildResult.exitCode !== 0) {
  throw new Error(`Failed to build AARs: ${buildResult.stderr}`);
}

console.log(`\n🎉 Successfully built AARs in: ${outputDir}`);