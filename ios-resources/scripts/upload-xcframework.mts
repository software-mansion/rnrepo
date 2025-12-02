  import path from "node:path";
import fs from "node:fs";
import {program} from "commander";
import {$} from "zx";

program
  .requiredOption("-f, --framework <path>", "Path to .xcframework")
  .requiredOption("-n, --name <name>", "Framework name (e.g., RNSVG)")
  .requiredOption("-l, --lib-version <version>", "Library version (e.g., 15.0.0)")
  .requiredOption("-v, --rn-version <version>", "React Native version (e.g., 0.80.1)")
  .requiredOption("-r, --repository <url>", "Reposilite repository URL")
  .option("-u, --username <username>", "Repository username")
  .option("-p, --password <password>", "Repository password")
  .option("-g, --group <group>", "Maven group ID", "com.swmansion.buildle");

program.parse(process.argv, {from: "node"});
const options = program.opts();

const xcframeworkPath = path.resolve(options.framework);
if (!fs.existsSync(xcframeworkPath)) {
  throw new Error(`XCFramework not found: ${xcframeworkPath}`);
}

if (!fs.statSync(xcframeworkPath).isDirectory()) {
  throw new Error(`XCFramework path is not a directory: ${xcframeworkPath}`);
}

const fullVersion = `${options.libVersion}-rn${options.rnVersion}`;
const artifactName = `${options.name}-${fullVersion}.xcframework`;

const groupPath = options.group.replace(/\./g, "/");
const artifactPath = `${groupPath}/${options.name}/${fullVersion}/${artifactName}`;

const targetUrl = `${options.repository.replace(/\/$/, "")}/${artifactPath}`;

console.log(`Uploading ${artifactName}...`);
console.log(`Target: ${targetUrl}`);

const tempZip = path.join(path.dirname(xcframeworkPath), `${options.name}-${fullVersion}.zip`);

try {
  await $`cd ${path.dirname(xcframeworkPath)} && zip -r ${tempZip} ${path.basename(xcframeworkPath)}`;
  console.log(`Created temporary zip: ${tempZip}`);

  const curlArgs = [
    "-X", "PUT",
    "-H", "Content-Type: application/zip",
    "-T", tempZip,
  ];

  if (options.username && options.password) {
    curlArgs.push("-u", `${options.username}:${options.password}`);
  }

  curlArgs.push(targetUrl);

  const upload = await $`curl ${curlArgs}`;

  if (upload.exitCode !== 0) {
    throw new Error(`Upload failed with exit code ${upload.exitCode}`);
  }

  console.log(`✓ Successfully uploaded ${artifactName}`);
  console.log(`  Group: ${options.group}`);
  console.log(`  Artifact: ${options.name}`);
  console.log(`  Library version: ${options.libVersion}`);
  console.log(`  React Native version: ${options.rnVersion}`);
  console.log(`  Full version: ${fullVersion}`);
} finally {
  if (fs.existsSync(tempZip)) {
    fs.rmSync(tempZip);
    console.log(`Cleaned up temporary zip`);
  }
}
