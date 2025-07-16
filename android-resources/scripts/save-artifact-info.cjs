const fs = require('fs');
const path = require('path');
const { kebabToPascalCase } = require('./util');

const DEFAULT_ARTIFACT_GROUP = 'com';

const libName = process.argv[2];
const libVersion = process.argv[3];
const outputPath = process.argv[4];
const artifactGroup = process.argv[5] ?? DEFAULT_ARTIFACT_GROUP;

const CONFIG_FILE_NAME = '.buildlerc.json';

if (!libName || !libVersion || !outputPath) {
  console.error(
    'Usage: node save-artifact-info.cjs <libName> <libVersion> <outputPath>'
  );
  process.exit(1);
}

// Convert lib name from kebab-case to PascalCase
const artifactName = kebabToPascalCase(libName);

const config = {
  libraryName: libName,
  artifactGroup: artifactGroup,
  artifactName: artifactName,
  libraryVersion: libVersion,
};

const configFileContent = JSON.stringify(config, null, 2);

const configFilePath = path.join(outputPath, CONFIG_FILE_NAME);

fs.writeFile(configFilePath, configFileContent, (err) => {
  if (err) {
    console.error(`Error writing the ${CONFIG_FILE_NAME} file:`, err);
    process.exit(1);
  }

  console.log(`Successfully created ${CONFIG_FILE_NAME} at:`, configFilePath);
});
