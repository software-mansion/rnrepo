import {
  getAllCompletedBuilds,
  getCompletedPackagesNames,
  type LibrariesData,
} from '@rnrepo/database';

const MOCK_LIBRARIES: LibrariesData = {
  '0.74.0': {
    'react-native-reanimated': {
      name: 'react-native-reanimated',
      android_versions: ['3.6.0', '3.7.0', '3.8.0'],
    },
    'react-native-gesture-handler': {
      name: 'react-native-gesture-handler',
      android_versions: ['2.14.0', '2.15.0'],
    },
    '@react-native-firebase/app': {
      name: '@react-native-firebase/app',
      android_versions: ['21.6.0'],
    },
  },
  '0.73.0': {
    'react-native-reanimated': {
      name: 'react-native-reanimated',
      android_versions: ['3.5.4', '3.6.0'],
    },
    'react-native-gesture-handler': {
      name: 'react-native-gesture-handler',
      android_versions: ['2.13.0', '2.14.0'],
    },
    '@react-native-firebase/app': {
      name: '@react-native-firebase/app',
      android_versions: ['21.5.0', '21.6.0'],
    },
  },
};

function getMockSupportedLibraryNames(): string[] {
  const names = new Set<string>();
  for (const rnVersion of Object.keys(MOCK_LIBRARIES)) {
    for (const libName of Object.keys(MOCK_LIBRARIES[rnVersion] || {})) {
      names.add(libName);
    }
  }
  return [...names].sort();
}

export async function getSupportedLibraryNames(): Promise<string[]> {
  if (import.meta.env.DEV) {
    return getMockSupportedLibraryNames();
  }

  try {
    const libraryNames = await getCompletedPackagesNames();
    console.log(
      `Fetched ${libraryNames.length} supported library names from database`
    );
    return libraryNames;
  } catch (error) {
    console.error(
      'Failed to load supported library names from database:',
      error
    );
    return []; // Return an empty array on failure
  }
}

export async function getLibraries(): Promise<LibrariesData> {
  if (import.meta.env.DEV) {
    return MOCK_LIBRARIES;
  }

  try {
    const libraries = await getAllCompletedBuilds();
    console.log(
      `Fetched ${Object.keys(libraries).length} completed builds from database`
    );
    return libraries;
  } catch (error) {
    console.error('Failed to load libraries from database:', error);
    return {}; // Return an empty object on failure
  }
}
