export const kebabToPascalCase = (kebab) =>
  kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
