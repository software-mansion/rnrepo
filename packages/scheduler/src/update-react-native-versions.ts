/**
 * Standalone script to check for new React Native versions and update the versions list.
 * Creates a PR if new versions are found.
 * This is designed to run in GitHub Actions.
 * 
 * Contains all version checking logic in a single file.
 */

import { readFileSync, writeFileSync } from 'fs';
import { findMatchingVersionsFromNPM } from './npm';

async function main(): Promise<void> {
  try {
    // create yyyy-mm-dd string for yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 100);
    const yesterdayString = yesterday.toISOString().split('T')[0];

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
    console.log(`   Latest in list: ${currentVersions[currentVersions.length - 1]}`);

    // Check for new versions
    const new_versions = await findMatchingVersionsFromNPM(
        'react-native',
        `>${currentVersions[currentVersions.length - 1]}`,
        yesterdayString
    ).then(versions => versions
      .map(v => v.version)
      .filter(v => !currentVersions.includes(v) && !v.includes('1000'))
    );

    console.log(`🔍 Found ${new_versions.length} React Native versions published since ${yesterdayString}`);
    // add entry
    new_versions.push('0.0.0-experimental-future');
    // Add new versions to the current list
    if (new_versions.length > 0) {
        console.log(`   Versions: ${new_versions.join(', ')}`);
        new_versions.forEach(version => {
            currentVersions.push(version);
        });

        // Write the updated versions back to react-native-versions.json
        writeFileSync(
          versionsFilePath,
          JSON.stringify(currentVersions, null, 2) + '\n'
        );
        console.log(`✅ Updated react-native-versions.json with new version(s)`);
    } else {
      console.log(`ℹ️  No new React Native versions found. Your list is up to date!`);
    }

  } catch (error) {
    console.error('❌ Error checking for new React Native versions:', error);
  }
}

main();
