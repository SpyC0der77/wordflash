# SpeedReader

A speed reading app built with [Next.js](https://nextjs.org) that extracts article content from URLs and displays it with a focus-based reading view.

## Development

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+

### Install dependencies

```bash
bun install
```

### Run the development server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app hot-reloads as you edit files.

### Run tests

```bash
bun test
```

Watch mode (re-runs on file changes):

```bash
bun run test:watch
```

### Lint

```bash
bun run lint
```

### Build for production

```bash
bun run build
bun start
```

## Deploy on Vercel

The easiest way to deploy is with the [Vercel Platform](https://vercel.com/new). See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.

**Monorepo setup:** In your Vercel project settings, set **Root Directory** to `apps/web` so Vercel builds and deploys the Next.js app from the correct location.
