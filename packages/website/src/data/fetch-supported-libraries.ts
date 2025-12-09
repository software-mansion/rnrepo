import { writeFile, readFile } from 'fs/promises';
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
    const librariesJson = await readFile(new URL('../../../../libraries.json', import.meta.url), 'utf-8');
    const librariesConfig: Record<string, LibraryConfigRecord> = JSON.parse(librariesJson);
    console.log(`Loaded libraries configuration from libraries.json`);

    // Transform the configuration into LibraryInfo format
    const descriptionMap = new Map<string, string>(
      Object.entries(librariesConfig || {}).map(([name, config]) => [
        name,
        config.description || '',
      ])
    );
    return descriptionMap;
  } catch (error) {
    console.error('Failed to load libraries from config:', error);
    throw error;
  }
}

async function loadLibrariesFromDatabase(): Promise<LibraryInfo[]> {
  try {
    const libraries: BuildRecordCompleted[] = await getAllCompletedBuilds();
    console.log(`Fetched ${libraries.length} completed builds from database`);
    const libsDescriptions = await loadLibrariesDescriptions();
    const mappedLibraries: LibraryInfo[] = libraries.map(lib => ({
      name: lib.package_name,
      description: libsDescriptions.get(lib.package_name) || '',
      supportedPlatforms: [lib.android && 'android', lib.ios && 'ios'].filter((p): p is 'android' | 'ios' => Boolean(p)),
    }));
    return mappedLibraries;
  } catch (error) {
    console.error('Failed to load libraries from database:', error);
    throw error;
  }
}

async function loadToFile(libraries: LibraryInfo[]) {
  try {
    const filePath = `${new URL('./libraries.ts', import.meta.url).pathname}`;
    const fileContent = `// This file is auto-generated via the 'fetch-supported-libraries' script. Do not edit directly.

import type { LibraryInfo } from './fetch-supported-libraries';

const libraries: LibraryInfo[] = ${JSON.stringify(libraries, null, 2)};

export default libraries;
`;
    // write to file
    await writeFile(filePath, fileContent);
    console.log(`Supported libraries written to ${filePath}`);
  } catch (error) {
    console.error('Failed to write supported libraries to file:', error);
    throw error;
  }
}

async function fetchSupportedLibraries() {
  const loadedLibraries = await loadLibrariesFromDatabase();
  await loadToFile(loadedLibraries);
}

fetchSupportedLibraries();