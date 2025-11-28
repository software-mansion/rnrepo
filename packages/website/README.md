# RNRepo Website

This is the website for RNRepo, built with [Astro](https://astro.build) and React components.

## Project Structure

```
packages/website/
├── public/          # Static assets (images, fonts, etc.)
├── src/
│   ├── components/  # React components
│   ├── layouts/     # Astro layout files
│   └── pages/       # Astro pages (routes)
├── astro.config.mjs # Astro configuration
├── tailwind.config.mjs # Tailwind CSS configuration
└── package.json
```

## Development

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, pnpm, or bun

### Install Dependencies

```bash
# Using npm
npm install

# Using bun
bun install
```

### Run Development Server

```bash
# Using npm
npm run dev

# Using bun
bun run dev
```

The site will be available at `http://localhost:4321` (Astro's default port).

### Build for Production

```bash
npm run build
```

This creates a `dist/` directory with the static site.

### Preview Production Build

```bash
npm run preview
```

## Deployment to GitHub Pages

This project is configured to deploy to GitHub Pages. The configuration assumes the repository name is `buildle` and the organization/user is `software-mansion`. If your repository structure is different, update the `base` and `site` values in `astro.config.mjs`.

### Option 1: GitHub Actions (Recommended)

1. Create a `.github/workflows/deploy.yml` file in your repository root:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main  # or your default branch
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install
        working-directory: ./packages/website

      - name: Build
        run: bun run build
        working-directory: ./packages/website

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./packages/website/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

2. In your GitHub repository settings:
   - Go to Settings → Pages
   - Under "Source", select "GitHub Actions"
   - Save the settings

3. Push to your main branch and the workflow will automatically build and deploy.

### Option 2: Manual Deployment

1. Build the site:
   ```bash
   cd packages/website
   npm run build
   ```

2. Push the `dist/` folder to the `gh-pages` branch:
   ```bash
   # Install gh-pages if you haven't already
   npm install -g gh-pages

   # Deploy
   cd dist
   git init
   git add .
   git commit -m "Deploy website"
   git branch -M gh-pages
   git remote add origin https://github.com/software-mansion/buildle.git
   git push -f origin gh-pages
   ```

3. In GitHub repository settings:
   - Go to Settings → Pages
   - Under "Source", select the `gh-pages` branch
   - Save the settings

### Updating the Base Path

By default, the site is configured to work at the root path (`/`). If you're deploying to GitHub Pages in a subdirectory (e.g., `https://your-org.github.io/repo-name`), you'll need to add a `base` path in `astro.config.mjs`:

```javascript
export default defineConfig({
  // ... other config
  base: '/repo-name',  // Only needed for subdirectory deployments
  site: 'https://your-org.github.io',
});
```

**Note:** If you're using a custom domain or deploying to the root of your GitHub Pages site, you don't need the `base` configuration.

## Customization

### Styling

The project uses Tailwind CSS. Customize colors and styles in `tailwind.config.mjs`.

### Components

React components are located in `src/components/`. They're used in Astro pages with the `client:load` directive for interactivity.

### Layout

The base layout is in `src/layouts/BaseLayout.astro`. Modify this file to change the overall page structure, head tags, or global styles.

## Troubleshooting

### Images not loading

Make sure images are in the `public/` directory. In components, reference them with paths starting with `/` (e.g., `/swm-pattern.png`). Astro will automatically handle the base path.

### Build errors

- Make sure all dependencies are installed: `npm install`
- Check that all React components are properly exported
- Verify that all image paths in components point to files in the `public/` directory

### GitHub Pages 404 errors

- Verify the `base` path in `astro.config.mjs` matches your repository name
- Make sure the GitHub Pages source is set correctly in repository settings
- Check that the workflow completed successfully in the Actions tab
