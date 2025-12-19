// Export libraries configuration (from root)
import libraries from '../../../libraries.json';
export { libraries };

// Export React Native versions (from root)
import reactNativeVersions from '../../../react-native-versions.json';
export { reactNativeVersions };

// Re-export types
export type { LibraryConfig, PlatformConfig, PlatformConfigOptions } from './types';

// Export utility functions
export { convertToGradleProjectName } from './utils';

// Export allowed licenses
export { type AllowedLicense , ALLOWED_LICENSES, extractAndVerifyLicense } from './licenses';
