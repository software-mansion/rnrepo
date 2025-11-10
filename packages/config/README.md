# Config Package

This package provides TypeScript exports and validation for shared configuration files used across the build system.

## Configuration Files

The actual configuration files are located at the **project root**:

- **`libraries.json`** - Configuration for which React Native libraries to build and their version requirements
- **`libraries.schema.json`** - JSON schema for validating `libraries.json`
- **`react-native-versions.json`** - List of supported React Native versions

## Usage

Import configuration in your code:

```typescript
import {
  libraries,
  reactNativeVersions,
  type LibraryConfig,
} from '@rnrepo/config';
```

## Validation

Validate the `libraries.json` file:

```bash
bun run validate
```

This checks that `libraries.json` (at the project root) conforms to `libraries.schema.json`.

## Structure

```
packages/config/
├── src/
│   ├── index.ts               # Exports configuration (imports from root)
│   ├── types.ts               # TypeScript types
│   └── validate.ts            # Validation script (validates root files)
└── package.json
```

The package imports and re-exports the JSON files from the project root, providing a clean TypeScript interface for other packages to use.
