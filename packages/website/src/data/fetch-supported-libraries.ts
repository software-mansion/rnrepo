import { getAllCompletedBuilds, getCompletedPackagesNames, type LibrariesData } from '@rnrepo/database';

export async function getSupportedLibraryNames(): Promise<string[]> {
  try {
    const libraryNames = await getCompletedPackagesNames();
    console.log(`Fetched ${libraryNames.length} supported library names from database`);
    return libraryNames;
  } catch (error) {
    console.error('Failed to load supported library names from database:', error);
    return []; // Return an empty array on failure
  }
}

export async function getLibraries(): Promise<LibrariesData> {
  try {
    const libraries = await getAllCompletedBuilds();
    console.log(`Fetched ${Object.keys(libraries).length} completed builds from database`);
    return libraries;
  } catch (error) {
    console.error('Failed to load libraries from database:', error);
    return {}; // Return an empty object on failure
  }
}
