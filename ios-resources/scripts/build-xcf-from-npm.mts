import path from "node:path";

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

const install = await sb$`npm install ${packageName}${options.version ? `@${options.version}` : ''} --no-package-lock --no-audit --no-fund`;
if (install.exitCode !== 0) {
  throw new Error(`Failed to install package ${packageName}: ${install.stderr}`);
}

const packagePath = path.join(sandboxPath, 'node_modules', packageName);
if (!packagePath.endsWith(packageName)) {
  throw new Error(`Package path is not correct: ${packagePath}. Make sure the package is installed in the sandbox.`);
}

console.log("Installed package into sandbox:", packagePath);
console.log("Building xcframework for package:", packageName);

const buildXcf = await $({stdio: "inherit"})`npm run build-xcf -- -p ${packagePath} -i ${sandboxIosPath} --output ${outputDir} --platforms ${options.platforms}`;
if (buildXcf.exitCode !== 0) {
  throw new Error(`Failed to build xcframework for package ${packageName}: ${buildXcf.stderr}`);
}

