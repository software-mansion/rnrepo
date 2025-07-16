const fs = require('fs');
const path = require('path');
const { kebabToPascalCase } = require('./util');

const publishingBlock = `
    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }`;

const DEFAULT_LIB_GROUP = 'com';

const insertBlockAtTheEndOfSection = (
  content,
  sectionName,
  blockName,
  block
) => {
  let lines = content.split(/\r?\n/);
  let isDesiredSection = false;
  let braceCount = 0;
  const outputLines = [];
  let foundDesiredBlock = false;

  lines.forEach((line) => {
    if (line.includes(`${sectionName} {`)) {
      isDesiredSection = true;
      braceCount = 0;
    }

    if (isDesiredSection) {
      if (braceCount === 1 && line.includes(blockName)) {
        foundDesiredBlock = true;
      }
      if (line.includes('{')) braceCount++;
      if (line.includes('}')) braceCount--;
      if (braceCount === 0 && line.includes('}') && !foundDesiredBlock) {
        outputLines.push(block);
        isDesiredSection = false;
      }
    }

    outputLines.push(line);
  });

  return outputLines.join('\n');
};

// Gather the path from the command line arguments
const libPath = path.resolve(process.argv[2]);
const libName = process.argv[3];
const libVersion = process.argv[4];
const libGroup = process.argv[5] ?? DEFAULT_LIB_GROUP;

if (!libPath || !libName || !libVersion) {
  console.error(
    'Please specify the path to the library folder as a command line argument.'
  );
  process.exit(1);
}

const libNamePascalCase = kebabToPascalCase(libName);

const gradlePaths = [
  path.join(libPath, 'android', 'build.gradle'),
  path.join(libPath, 'platforms', 'android', 'build.gradle'),
];

let buildGradlePath = gradlePaths.find((gp) => fs.existsSync(gp));
if (!buildGradlePath) {
  console.error(
    `No build.gradle found in expected locations within ${libPath}`
  );
  process.exit(1);
}

try {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  content = insertBlockAtTheEndOfSection(
    content,
    'android',
    'publishing',
    publishingBlock
  );

  if (!content.includes('apply plugin: "maven-publish"')) {
    content = `${content}\napply plugin: "maven-publish"`;
  }

  const publishingBlockContent = `
  publishing {
        publications {
            release(MavenPublication) {
                groupId = '${libGroup}'
                artifactId = '${libNamePascalCase}'
                version = '${libVersion}'
                from components.release
            }
        }
        repositories {
            mavenLocal()
        }
    }`;

  const afterEvaluateBlock = `
afterEvaluate {
    ${publishingBlockContent}
}
`;
  if (!content.includes('afterEvaluate {')) {
    content += afterEvaluateBlock;
  } else {
    content = insertBlockAtTheEndOfSection(
      content,
      'afterEvaluate',
      'publishing',
      publishingBlockContent
    );
  }

  fs.writeFileSync(buildGradlePath, content, 'utf8');
  console.log(
    `test.build.gradle has been created/updated and saved in ${buildGradlePath}`
  );
} catch (error) {
  console.error('Failed to modify build.gradle:', error);
  process.exit(1);
}
