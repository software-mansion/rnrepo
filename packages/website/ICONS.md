# Icon Usage Guide

All SVG icons have been extracted from React components and are now available as asset files.

## Icon Locations

- **Source files**: `src/assets/icons/*.svg` (for importing in components)
- **Public files**: `public/icons/*.svg` (for direct URL references)

## Usage in Astro Components

### Using the Icon Component (Recommended for styled icons)

For icons that need CSS styling (like `currentColor`), use the `Icon` component:

```astro
---
import Icon from '../components/Icon.astro';
---

<Icon name="speed" className="text-brandPink-100 w-6 h-6" />
<Icon name="github" className="text-rnrGrey-0" />
```

### Available Icon Names

- `speed`
- `open-source`
- `shield`
- `box`
- `phone`
- `folder`
- `check`
- `clock`
- `server`
- `chevron-down`
- `github`
- `x`
- `youtube`
- `git-branch`
- `building`
- `lock`
- `file-text`
- `arrow-down`
- `swm-logo`

### Using Direct Image Tags (For simple cases)

For icons that don't need styling, you can use direct `<img>` tags:

```astro
<img src="/icons/speed.svg" alt="Speed icon" class="w-6 h-6" />
```

### Logos

- **RNRepo Logo**: Available at `/rnrepo-logo.svg` (in public root)
- **Software Mansion Logo**: Use `<Icon name="swm-logo" />` or reference `/icons/swm-logo.svg`

## Migration from React Components

Replace React icon components like this:

**Before (React):**
```tsx
import { IconSpeed } from './icons/Icons';
<IconSpeed className="text-brandPink-100" />
```

**After (Astro):**
```astro
---
import Icon from '../components/Icon.astro';
---
<Icon name="speed" className="text-brandPink-100" />
```

## Benefits

1. ✅ Icons are now separate asset files, not embedded in code
2. ✅ Easier to update icons without touching component code
3. ✅ Better caching - icons can be cached separately
4. ✅ Smaller bundle size - icons loaded on demand
5. ✅ Still supports CSS styling via `currentColor` when using Icon component

