const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { nameCleansed } = require('./util');

function getPackageInfo(libraryPath) {
  const packageJsonPath = path.join(libraryPath, 'package.json');
  const androidProjectPath = path.join(libraryPath, 'android', '.project');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json does not exist at the specified path.');
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const libName = packageJson.name;
  const libVersion = packageJson.version;

  if (!libName || !libVersion) {
    throw new Error('Library name or version is missing in package.json.');
  }

  let javaProjectName = '';
  if (fs.existsSync(androidProjectPath)) {
    const xml = fs.readFileSync(androidProjectPath, 'utf-8');
    xml2js.parseString(xml, (err, result) => {
      // console.log('Error: ', err);
      // console.log('Result: ', result);
      if (err) {
        javaProjectName = '';
      } else {
        // Safely access project.description[0].name[0]
        javaProjectName = nameCleansed(libName);
      }
    });
  }
  console.log(libName, libVersion, javaProjectName);
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
