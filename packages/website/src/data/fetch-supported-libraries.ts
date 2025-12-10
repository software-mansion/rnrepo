import { readFile } from 'fs/promises';
import { getAllCompletedBuilds } from '@rnrepo/database';

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
    // Load libraries.json from the workspace root
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

export async function getLibraries(): Promise<LibraryInfo[]> {
  try {
    const [libraries, libsDescriptions] = await Promise.all([
      getAllCompletedBuilds(),
      loadLibrariesDescriptions()
    ]);
    console.log(`Fetched ${libraries.length} completed builds from database`);
    const mappedLibraries: LibraryInfo[] = libraries.map(lib => ({
      name: lib.package_name,
      description: libsDescriptions.get(lib.package_name) || '',
      supportedPlatforms: [lib.android && 'android', lib.ios && 'ios'].filter((p): p is 'android' | 'ios' => Boolean(p)),
    }));
    return mappedLibraries;
  } catch (error) {
    console.error('Failed to load libraries from database:', error);
    return []; // Return an empty array on failure
  }
}
