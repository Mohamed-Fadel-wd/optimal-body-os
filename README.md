# Optimal Body OS

Private mobile-first PWA for Mohamed Fadel's training, recovery, skill progression, and workout logging.

## Local Development

```bash
pnpm install
copy .env.example .env
pnpm dev
```

Add your MongoDB Atlas connection string to `.env` before starting. The frontend runs
on port `4173` and the API runs on port `8787`.

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

GitHub Pages only hosts the frontend. Deploy the Node API (`server/index.js`) to a
Node host such as Render, Railway, or Fly.io, then set `VITE_API_URL` in the GitHub
repository Actions variable to `https://YOUR-API-HOST/api`.

Required API environment variables:

- `MONGODB_URI`: MongoDB Atlas connection string.
- `MONGODB_DB`: database name, defaults to `optimal_body_os`.
- `CORS_ORIGIN`: comma-separated frontend origins.
- `PORT`: supplied automatically by most Node hosts.

The current profile button is a UI-only sign-in. Do not expose the API publicly
until server-side authentication is added.
