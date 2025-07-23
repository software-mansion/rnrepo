export const kebabToPascalCase = (kebab) =>
  kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

// Rewrite of name cleansing from react-native-gradle-plugin
// https://github.com/facebook/react-native/blob/0.81-stable/packages/gradle-plugin/shared/src/main/kotlin/com/facebook/react/model/ModelAutolinkingDependenciesJson.kt#L16
export const nameCleansed = (name) => {
  return name
    .replace(/[~*!'()]+/g, "_")           // Replace special characters with "_"
    .replace(/^@([\w-.]+)\//, "$1_");
}
