import path from "node:path";
import fs from "node:fs";

import {program} from 'commander';
import {$} from "zx";

process.on('exit', function () {
  $`git checkout buildler` // cleanup sandbox after build / interruption
  sb$`npm install` // reinstall dependencies in sandbox
});

const sandboxPath = path.resolve("buildler")
if (!sandboxPath.endsWith("buildler")) {
  throw new Error(`Sandbox path is not correct: ${sandboxPath}`);
}
const sandboxIosPath = path.join(sandboxPath, 'ios');

const sb$ = $({cwd: sandboxPath})

program
  .requiredOption('-p, --package <name>', 'Name of the package to build')
  .option('-v, --version <version>', 'Version of package to use', '.')
  .option('-o, --output <path>', 'Output directory for the xcframework', '.')
  .option('--platforms <platforms>', 'Comma-separated list of platforms to build for', 'iphonesimulator');

program.parse(process.argv, {from: "node"});

const options = program.opts();
const outputDir = path.resolve(options.output);
const packageName = options.package;

// Use npm pack to download the package and extract it
// This avoids symlink issues that occur with npm install in certain setups
const packagePath = path.join(sandboxPath, 'node_modules', packageName);
await sb$`rm -rf node_modules/${packageName}`;
await sb$`mkdir -p node_modules/${packageName}`;

// Download package tarball directly from npm registry
// Get package metadata to find the tarball URL
const versionSpec = options.version && options.version !== '.' ? `@${options.version}` : '';
const viewCmd = await $`npm view ${packageName}${versionSpec} dist.tarball`;
const tarballUrl = viewCmd.stdout.trim();
if (!tarballUrl) {
  throw new Error(`Failed to get tarball URL for ${packageName}`);
}

const tarballName = path.basename(tarballUrl);
await $`curl -L ${tarballUrl} -o ${tarballName}`;
await $`tar -xzf ${tarballName} -C ${packagePath} --strip-components=1`;
await $`rm ${tarballName}`;

// Get package version and manually add to package.json for autolinking
const getVersionCmd = await $`npm view ${packageName}${versionSpec} version`;
const packageVersion = getVersionCmd.stdout.trim();

const packageJsonPath = path.join(sandboxPath, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
if (!packageJson.dependencies) packageJson.dependencies = {};
packageJson.dependencies[packageName] = `^${packageVersion}`;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log("Installed package into sandbox:", packagePath);
console.log("Building xcframework for package:", packageName);

const buildXcf = await $({stdio: "inherit"})`node --loader ts-node/esm ios-resources/scripts/build-xcframework.mts -p ${packagePath} -i ${sandboxIosPath} --output ${outputDir} --platforms ${options.platforms}`;
if (buildXcf.exitCode !== 0) {
  throw new Error(`Failed to build xcframework for package ${packageName}: ${buildXcf.stderr}`);
}

