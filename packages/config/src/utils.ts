/**
 * Sanitizes an NPM package name for use in filenames, Gradle projects, and Maven artifacts.
 * Patterns:
 * - Removes leading '@'
 * - Replaces '/' with '_' to preserve the distinction from '-'
 * Example: @react-native-picker/picker -> react-native-picker_picker
 */
export function sanitizePackageName(packageName: string): string {
  return packageName.replace(/^@/, '').replace(/\//g, '_');
}
