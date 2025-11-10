# Config Package

This package contains shared configuration files used across the build system.

## Contents

- **`libraries.json`** - Configuration for which React Native libraries to build and their version requirements
- **`libraries.schema.json`** - JSON schema for validating `libraries.json`
- **`react-native-versions.json`** - List of supported React Native versions

## Usage

Import configuration in your code:

```typescript
import { libraries, reactNativeVersions, type LibraryConfig } from '@rnrepo/config';
```

## Validation

Validate the `libraries.json` file:

```bash
bun run validate
```

This checks that `libraries.json` conforms to `libraries.schema.json`.

## Structure

```
packages/config/
├── src/
│   ├── index.ts               # Exports configuration (from root)
│   ├── types.ts               # TypeScript types
│   └── validate.ts            # Validation script
└── package.json

Configuration files are located at the project root:
- libraries.json              # Library build configurations
- libraries.schema.json       # JSON schema for validation
- react-native-versions.json  # Supported RN versions
```

