import path from "node:path";
import {program} from 'commander'
import {$, globby} from "zx";
import fs from "node:fs";

const sourceFilesPodspecRegex = /^[ \t]*[\w\.]+\.source_files\s*=\s*["']([^"']+)["']/gm;


const isDirectory = (dir: string) => {
  try {
    return fs.statSync(dir).isDirectory();
  } catch (error) {
    return false;
  }
}

program
  .requiredOption('-m, --module <name>', 'Name of the module to build')
  .option('-o, --output <path>', 'Output directory for the xcframework', '.')
  .option('-p, --project <path>', 'Path to root library project', '.')
  .option('--skip-pods', 'Skip pod installation step', false)
  .requiredOption('-i, --ios-project <path>', 'Path to iOS directory inside of example app')
  .option('--platforms <platforms>', 'Comma-separated list of platforms to build for', 'iphonesimulator')

program.parse(process.argv, {from: "node"});
const options = program.opts();
const outputDir = path.resolve(options.output);

if (!isDirectory(outputDir)) {
  throw new Error(`Output path is not a directory or doesn't exist: ${outputDir}`);
}

const projectRoot = path.resolve(options.project);
if (!isDirectory(projectRoot)) {
  throw new Error(`Project root path is not a directory or doesn't exist: ${projectRoot}`);
}

const buildDirectory = path.join(outputDir, 'build');
if (!isDirectory(buildDirectory)) {
  fs.mkdirSync(buildDirectory, {recursive: true});
}

const iosProjectPath = path.resolve(options.iosProject)
if (!isDirectory(iosProjectPath)) {
  throw new Error(`iOS project path is not a directory or doesn't exist: ${iosProjectPath}`);
}

// Install all dependencies required for building desired module
if (!options.skipPods) {
  console.log("Installing pods...")
  const installPodsCmd = await $`cd ${iosProjectPath} && pod install`;
  if (installPodsCmd.exitCode !== 0) {
    throw new Error(`Failed to install pods: ${installPodsCmd.stderr}`);
  }
}

const headersDirectory = path.join(buildDirectory, "headers");
if (!isDirectory(headersDirectory)) {
  fs.mkdirSync(headersDirectory, {recursive: true});
}

// Find podspec file for the module. It includes all source files and headers. We need headers to build XCFramework.
const podspecPathFind = await $`find ${projectRoot} -name "${options.module}.podspec"`;
const podspecPath = podspecPathFind.stdout.trim();
if (!podspecPath) {
  throw new Error(`Podspec for module ${options.module} not found in project root: ${projectRoot}`);
}
console.log(`Found podspec at: ${podspecPath}`);

const packageRoot = path.dirname(podspecPath);

const podspecContent = fs.readFileSync(podspecPath, 'utf-8');

// Extract source files from podspec using regex
const headersPaths = [];
let match;
while ((match = sourceFilesPodspecRegex.exec(podspecContent)) !== null) {
  headersPaths.push(match[1]);
}

if (headersPaths.length === 0) {
  throw new Error(`No source files found in podspec for module ${options.module}`);
}

// Resolve paths to headers based on podspec (need resolving because glob patterns can be used which are relative to podspec file)
const resolvedHeaders = await globby(headersPaths, {
  cwd: packageRoot,
  absolute: true,
})

// Copy resolved headers to the headers directory in build directory
await Promise.all(resolvedHeaders.map(async (headerPath) => {
  const headerDest = path.join(headersDirectory, path.basename(headerPath));
  return fs.copyFileSync(headerPath, headerDest);
}))
console.log(`Found and copied ${resolvedHeaders.length} headers`);

// Create XCArchive for each platform. They are later used to create XCFramework.
for (const platform of options.platforms.split(',')) {
  console.log(`Building for platform: ${platform}`);
  const xcarchivePath = path.join(buildDirectory, `${options.module}-${platform}.xcarchive`);
  const buildCmd = await $({quiet: true})`cd ${iosProjectPath}/Pods && xcodebuild archive -scheme ${options.module} -archivePath ${xcarchivePath} -sdk ${platform} SKIP_INSTALL=NO BUILD_LIBRARIES_FOR_DISTRIBUTION=YES`

  if (buildCmd.exitCode !== 0) {
    throw new Error(`Failed to build XCArchive for ${platform}: ${buildCmd.stderr}`);
  }
  console.log(`Built XCArchive for ${platform} (${xcarchivePath})`);
}

// Remove existing XCFramework if it exists, to avoid conflicts
const xcframeworkPath = path.join(outputDir, `${options.module}.xcframework`);
fs.rmSync(xcframeworkPath, {force: true, recursive: true})

// Create XCFramework from the built XCArchives (embed all platforms into a single XCFramework)
let libraryParameters = options.platforms.split(',').flatMap((platform: string) => {
  const xcarchivePath = path.join(buildDirectory, `${options.module}-${platform}.xcarchive`);
  return [`-library`, `${xcarchivePath}/Products/usr/local/lib/lib${options.module}.a`, `-headers`, `${headersDirectory}`];
})
const createXcframeworkCmd = await $`cd ${iosProjectPath}/Pods && xcodebuild -create-xcframework ${libraryParameters} -output ${xcframeworkPath}`;
if (createXcframeworkCmd.exitCode !== 0) {
  throw new Error(`Failed to create XCFramework: ${createXcframeworkCmd.stderr}`);
}

console.log(`XCFramework created successfully at ${xcframeworkPath}`);
