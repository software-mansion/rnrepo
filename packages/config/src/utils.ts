export function convertToGradleProjectName(packageName: string): string {
  // Convert npm package name to Gradle project name following React Native's pattern
  // @react-native-community/slider -> react-native-community_slider
  return packageName.replace(/^@/, '').replace(/\//g, '_');
}
