import path from "node:path";
import {program} from "commander";
import {$, globby} from "zx";
import fs from "node:fs";

const sourceFilesPodspecRegex = /^[ \t]*[\w\.]+\.source_files\s*=\s*(?:(["'])([^"']+)\1|\[((?:.|\n)*?)\])/gm;

const isDirectory = (dir: string) => {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};

program
  .option("-m, --module <name>", "Name of the module to build")
  .option("-o, --output <path>", "Output directory for the xcframework", ".")
  .requiredOption("-p, --project <path>", "Path to root library project", ".")
  .option("--skip-pods", "Skip pod installation step", false)
  .requiredOption("-i, --ios-project <path>", "Path to iOS directory inside of example app")
  .option("--platforms <platforms>", "Comma-separated list of platforms", "iphonesimulator");

program.parse(process.argv, {from: "node"});
const options = program.opts();

const outputDir = path.resolve(options.output);
if (!isDirectory(outputDir)) throw new Error(`Output path doesn't exist: ${outputDir}`);

const projectRoot = path.resolve(options.project);
if (!isDirectory(projectRoot)) throw new Error(`Project root doesn't exist: ${projectRoot}`);

if (!options.module) {
  const podspecFiles = globby.sync("*.podspec", {cwd: projectRoot});
  if (podspecFiles.length === 0) throw new Error(`No podspec found at: ${projectRoot}`);
  if (podspecFiles.length > 1)
    throw new Error(`Multiple podspecs found, use --module to specify.`);
  options.module = podspecFiles[0].replace(".podspec", "");
  console.log(`Auto-detected module: ${options.module}`);
}

const buildDirectory = path.join(outputDir, "build");
if (!isDirectory(buildDirectory)) fs.mkdirSync(buildDirectory, {recursive: true});

const iosProjectPath = path.resolve(options.iosProject);
if (!isDirectory(iosProjectPath)) throw new Error(`Invalid iOS project: ${iosProjectPath}`);

// Pod install
if (!options.skipPods) {
  console.log("Installing pods...");
  const install = await $({cwd: iosProjectPath, stdio: "inherit"})`pod install --repo-update`;
  if (install.exitCode !== 0) throw new Error(`Failed to install pods`);
}

const headersDirectory = path.join(buildDirectory, "headers");
if (!isDirectory(headersDirectory)) fs.mkdirSync(headersDirectory, {recursive: true});

// Locate podspec
const podspecFindResult = await $`find ${projectRoot} -name "${options.module}.podspec"`;
const podspecPath = podspecFindResult.stdout.trim();
if (!podspecPath) throw new Error(`Podspec not found for: ${options.module}`);
console.log(`Found podspec: ${podspecPath}`);

const packageRoot = path.dirname(podspecPath);
const podspecContent = fs.readFileSync(podspecPath, "utf-8");

// Extract source_files
const headersPaths: string[] = [];

let match;
while ((match = sourceFilesPodspecRegex.exec(podspecContent)) !== null) {
  if (match[2]) {
    // s.source_files = "..."
    headersPaths.push(match[2]);
    console.log("Matched single path:", match[2]);
  } else if (match[3]) {
    // s.source_files = [ ... ]
    const files = [];
    const quotedGlobRegex = /["']([^"']+)["']/g;
    let submatch;
    while ((submatch = quotedGlobRegex.exec(match[3])) !== null) {
      files.push(submatch[1]);
    }
    headersPaths.push(...files);
    console.log("Matched array paths:", files);
  }
}

if (headersPaths.length === 0) {
  throw new Error(`No source files found in podspec`);
}

// Resolve all .h source paths using globby
const resolvedHeaders = await globby(headersPaths, {
  cwd: packageRoot,
  absolute: true,
});

// Copy .h files to headers directory with flattened structure
const headerFiles = resolvedHeaders.filter(h => h.endsWith(".h"));

// Find all unique directory names that appear in paths
const allPaths = headerFiles.map(h => path.relative(packageRoot, h));
const allDirs = new Set<string>();
allPaths.forEach(p => {
  const parts = p.split(path.sep);
  parts.slice(0, -1).forEach(part => allDirs.add(part)); // exclude filename
});

// Find the most common directory name that appears in multiple paths
let targetDirName = '';
let maxCount = 0;
allDirs.forEach(dir => {
  const count = allPaths.filter(p => p.includes(dir)).length;
  if (count > maxCount && count > 1) {
    maxCount = count;
    targetDirName = dir;
  }
});

await Promise.all(
  headerFiles.map(headerPath => {
    const relativePath = path.relative(packageRoot, headerPath);
    const pathParts = relativePath.split(path.sep);
    
    // Find the last occurrence of the target directory and use everything from there
    let targetRelativePath = relativePath;
    if (targetDirName) {
      const targetIndex = pathParts.lastIndexOf(targetDirName);
      if (targetIndex >= 0) {
        targetRelativePath = pathParts.slice(targetIndex).join(path.sep);
      }
    }
    
    const targetPath = path.join(headersDirectory, targetRelativePath);
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.copyFileSync(headerPath, targetPath);
  })
).then(res => {
  console.log(`Copied ${res.length} .h headers`);
});

// Build archives per platform
for (const platform of options.platforms.split(",")) {
  console.log(`Building for ${platform}...`);
  const xcarchivePath = path.join(buildDirectory, `${options.module}-${platform}.xcarchive`);
  const buildCmd = await $({quiet: true})`cd ${iosProjectPath}/Pods && xcodebuild archive -scheme ${options.module} -archivePath ${xcarchivePath} -sdk ${platform} SKIP_INSTALL=NO BUILD_LIBRARIES_FOR_DISTRIBUTION=YES`;
  if (buildCmd.exitCode !== 0) throw new Error(`Failed to archive for ${platform}`);
  console.log(`Archived: ${xcarchivePath}`);
}

// Build XCFramework
const xcframeworkPath = path.join(outputDir, `${options.module}.xcframework`);
fs.rmSync(xcframeworkPath, {force: true, recursive: true});

const libraryParameters = options.platforms.split(",").flatMap((platform: string) => {
  const xcarchivePath = path.join(buildDirectory, `${options.module}-${platform}.xcarchive`);
  return [
    "-library",
    `${xcarchivePath}/Products/usr/local/lib/lib${options.module}.a`,
    "-headers",
    `${headersDirectory}`
  ];
});

const createXC = await $`cd ${iosProjectPath}/Pods && xcodebuild -create-xcframework ${libraryParameters} -output ${xcframeworkPath}`;
if (createXC.exitCode !== 0) throw new Error(`Failed to create XCFramework`);

fs.rmSync(headersDirectory, {force: true, recursive: true});
console.log(`XCFramework successfully created at: ${xcframeworkPath}`);
