// Export libraries configuration (from root)
import libraries from '../../libraries.json';
export { libraries };
export default libraries;

// Export React Native versions (from root)
import reactNativeVersions from '../../react-native-versions.json';
export { reactNativeVersions };
export default reactNativeVersions;

// Re-export types
export type { LibraryConfig } from './types';

