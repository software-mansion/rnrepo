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
    'react-native-super-long-versions': {
      name: 'react-native-super-long-versions',
      android_versions: [
        '1.0.0',
        '1.1.0',
        '1.2.0',
        '1.3.0',
        '1.4.0',
        '1.5.0',
        '1.6.0',
        '1.7.0',
        '1.8.0',
        '1.9.0',
        '1.10.0',
        '1.11.0',
        '1.12.0',
      ],
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
    'react-native-super-long-versions': {
      name: 'react-native-super-long-versions',
      android_versions: [
        '0.90.0',
        '0.91.0',
        '0.92.0',
        '0.93.0',
        '0.94.0',
        '0.95.0',
        '0.96.0',
        '0.97.0',
        '0.98.0',
        '0.99.0',
        '0.100.0',
        '0.101.0',
        '0.102.0',
      ],
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
