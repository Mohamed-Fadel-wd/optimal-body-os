# Optimal Body OS

Private mobile-first PWA for Mohamed Fadel's training, recovery, skill progression, and workout logging.

## Local Development

```bash
pnpm install
pnpm dev
```

## Production Build

```bash
pnpm build
pnpm preview
```

## GitHub Pages Deployment

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

After pushing to GitHub:

1. Open the repository settings.
2. Go to `Pages`.
3. Set the source to `GitHub Actions`.
4. Push to the `main` branch.

The workflow builds the Vite app and deploys the `dist` folder to GitHub Pages.
