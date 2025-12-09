import { writeFile } from 'fs/promises';

export interface LibraryInfo {
  name: string;
  description?: string;
  supportedPlatforms?: Array<'android' | 'ios'>;
}

interface LibraryConfigRecord {
  description?: string;
  android?: boolean | unknown[];
  ios?: boolean | unknown[];
  [key: string]: unknown;
}

/**
 * Load supported libraries from libraries.json
 * This function reads the libraries configuration and transforms it
 * into the LibraryInfo format for the website
 */
async function loadLibrariesFromConfig(): Promise<LibraryInfo[]> {
  try {
    // Dynamically fetch libraries.json from the workspace root
    const librariesJson = await fetch(new URL('../../../../libraries.json', import.meta.url));
    const librariesConfig: Record<string, LibraryConfigRecord> = await librariesJson.json();
    console.log(`Loaded libraries configuration from ${librariesJson.url}`);

    // Transform the configuration into LibraryInfo format
    const libraries: LibraryInfo[] = Object.entries(librariesConfig).map(
      ([name, config]) => ({
        name,
        description: config.description,
        supportedPlatforms: getSupportedPlatforms(config),
      })
    );
    console.log(`Transformed ${libraries.length} libraries into LibraryInfo format`);
    return libraries;
  } catch (error) {
    console.error('Failed to load libraries from config:', error);
    return [];
  }
}

function getSupportedPlatforms(
  config: LibraryConfigRecord
): Array<'android' | 'ios'> {
  if (!config) {
    return [];
  }
  const fullSupportKeys = ['publishedAfterDate', 'reactNativeVersion', 'versionMatcher'];
  if (fullSupportKeys.some(key => key in config)) {
    return ['android', 'ios'];
  }
  const platformKeys: Array<'android' | 'ios'> = ['android', 'ios'];
  return platformKeys.filter(platform => config[platform]);
}

async function loadToFile(libraries: LibraryInfo[]) {
  const filePath = `${new URL('./libraries.ts', import.meta.url).pathname}`;
  const fileContent = `// This file is auto-generated via 'bun run fetch-supported-libs'. Do not edit directly.

import type { LibraryInfo } from './fetch-supported-libs';

const libraries: LibraryInfo[] = ${JSON.stringify(libraries, null, 2)};

export default libraries;
`;
  // write to file
  await writeFile(filePath, fileContent);
  console.log(`Supported libraries written to ${filePath}`);
}

async function fetchSupportedLibraries() {
  const loadedLibraries = await loadLibrariesFromConfig();
  await loadToFile(loadedLibraries);
}

fetchSupportedLibraries();