const fs = require('fs');
const path = require('path');

function getPackageInfo(libraryPath) {
  const packageJsonPath = path.join(libraryPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json does not exist at the specified path.');
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const libName = packageJson.name;
  const libVersion = packageJson.version;

  if (!libName || !libVersion) {
    throw new Error('Library name or version is missing in package.json.');
  }

}

const libPath = process.argv[2];
if (!libPath) {
  console.error('Please provide the path to the library folder.');
  process.exit(1);
}

try {
  getPackageInfo(libPath);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
