/**
 * Standalone script to check for new React Native versions and update the versions list.
 * Creates a PR if new versions are found.
 * This is designed to run in GitHub Actions.
 * 
 * Contains all version checking logic in a single file.
 */

import { readFileSync, writeFileSync } from 'fs';
import { findMatchingVersionsFromNPM } from './npm';
import semver from 'semver';

async function main(): Promise<void> {
  try {
    // Read current versions from react-native-versions.json
    const versionsFilePath = 'react-native-versions.json';
    let currentVersions: string[] = [];
    try {
      const fileContent = readFileSync(versionsFilePath, 'utf-8');
      currentVersions = JSON.parse(fileContent);
    } catch (error) {
      console.error('Failed to read react-native-versions.json:', error);
      throw error;
    }

    console.log(`📋 Current React Native versions: ${currentVersions.length} versions`);
    if (currentVersions.length == 0) {
      throw new Error('No versions found in react-native-versions.json');
    } 

    // Check for new versions
    const newVersions = await findMatchingVersionsFromNPM(
        'react-native',
        `>${currentVersions[0]}`
    ).then(versions => versions
      .map(v => v.version)
      .filter(v => !currentVersions.includes(v) && !v.includes('1000')
      // ignore versions that have smaller pathch version than the latest known of that minor
      && semver.patch(v) >= semver.patch(currentVersions.find(cv => semver.minor(cv) === semver.minor(v)) || '0.0.0')
      )
    );

    console.log(`🔍 Found ${newVersions.length} React Native versions published`);
    newVersions.push('0.79.90-TESTING-DO-NOT-MERGE');     // add entry temporarily for future experimental versions
    // Add new versions to the current list
    if (newVersions.length > 0) {
        console.log(`   New versions: ${newVersions.join(', ')}`);
        const sorted = [...newVersions, ...currentVersions].sort(semver.compare);

        // Write the updated versions back to react-native-versions.json
        writeFileSync(
          versionsFilePath,
          JSON.stringify(sorted, null, 2) + '\n'
        );
        console.log(`✅ Updated react-native-versions.json with new version(s)`);
    } else {
      console.log(`ℹ️  No new React Native versions found. Your list is up to date!`);
    }

  } catch (error) {
    console.error('❌ Error checking for new React Native versions:', error);
    process.exit(1);
  }
}

main();
