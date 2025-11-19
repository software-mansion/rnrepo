export function convertToGradleProjectName(packageName: string): string {
  // Convert npm package name to Gradle project name following React Native's pattern
  // @react-native-community/slider -> react-native-community_slider
  return packageName.replace(/^@/, '').replace(/\//g, '_');
}

export function createExtendedClassifier(classifier: string, additionalLibraries: string[]): string {
  if (additionalLibraries.length === 0) {
    return classifier
  }
  for (const lib of additionalLibraries) {
    // remove part before first slash if exists
    const packageNameWithoutOrganization = lib.split('/').pop();
    // remove 'react-native-' prefix if exists
    const packageNameWithoutPrefix = packageNameWithoutOrganization?.replace(/^react-native-/, '') || '';
    // remove any remaining '-' and '@' and replace with ''
    classifier += `-with-${packageNameWithoutPrefix.replace(/[@-]/g, '')}`;
  }
  return classifier
}