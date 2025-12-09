import { writeFile } from 'fs/promises';
import { getAllCompletedBuilds, type BuildRecordCompleted } from '@rnrepo/database';

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

async function loadLibrariesDescriptions(): Promise<Map<string, string>> {
  try {
    // Dynamically fetch libraries.json from the workspace root
    const librariesJson = await fetch(new URL('../../../../libraries.json', import.meta.url));
    const librariesConfig: Record<string, LibraryConfigRecord> = await librariesJson.json();
    console.log(`Loaded libraries configuration from ${librariesJson.url}`);

    // Transform the configuration into LibraryInfo format
    const descriptionMap = new Map<string, string>(
        librariesConfig &&
        Object.entries(librariesConfig).map(([name, config]) => [
            name,
            config.description || '',
        ])
    );
    return descriptionMap;
  } catch (error) {
    console.error('Failed to load libraries from config:', error);
    return new Map<string, string>();
  }
}

async function loadLibrariesFromDatabase(): Promise<LibraryInfo[]> {
  const libraries: BuildRecordCompleted[] = await getAllCompletedBuilds();
  console.log(`Fetched ${libraries.length} completed builds from database`);
  const libsDescriptions = await loadLibrariesDescriptions();
  const mappedLibraries: LibraryInfo[] = libraries.map(lib => ({
    name: lib.package_name,
    description: libsDescriptions.get(lib.package_name) || '',
    supportedPlatforms: [lib.android ? 'android' : null, lib.ios ? 'ios' : null].filter(Boolean) as Array<'android' | 'ios'>,
  }));
  return mappedLibraries;
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
  const loadedLibraries = await loadLibrariesFromDatabase();
  await loadToFile(loadedLibraries);
}

fetchSupportedLibraries();