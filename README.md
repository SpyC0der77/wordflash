# WordFlash

A speed reading app that uses **rapid serial visual presentation (RSVP)** to help you read faster. Paste text or enter an article URL, and WordFlash extracts the content and displays it one word at a time with a focal character (the red letter) to guide your eyes.

Built with [Next.js](https://nextjs.org), [React](https://react.dev), and [Tailwind CSS](https://tailwindcss.com).

## Features

- **Focus-based reading** — Each word highlights a focal character (configurable color) to reduce eye movement and increase reading speed
- **Article extraction** — Enter any URL; [Mozilla Readability](https://github.com/mozilla/readability) strips ads and clutter, leaving clean article content
- **Reader view** — Read articles with the speed reader panel and full article side-by-side; click any word to jump
- **Bookmarklet** — Drag "Read in WordFlash" to your bookmarks bar to open any article from any page
- **Customizable** — Font size, font family, words per minute, pause durations (sentence ends, commas), theme (light/dark/system)
- **Accessibility** — Reduce motion and reduce transparency options
- **Reading position** — Resumes where you left off when you return

## Project structure

```
wordflash/
├── apps/
│   └── web/          # Next.js web app
├── packages/
│   └── core/         # Shared logic: word timing, text preprocessing, focal character index
└── package.json      # Bun workspaces monorepo
```

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

Open [http://localhost:3000](http://localhost:3000). The app hot-reloads as you edit files.

### Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start the web app dev server |
| `bun run build` | Build `@wordflash/core` and the web app |
| `bun run lint` | Lint all packages |
| `bun run test` | Run tests across all packages |

For watch mode during development, run tests from a specific package:

```bash
cd packages/core && bun run test:watch
cd apps/web && bun run test:watch
```

### Build for production

```bash
bun run build
bun run --filter wordflash start
```

## Deploy on Vercel

The easiest way to deploy is with the [Vercel Platform](https://vercel.com/new). See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.

**Monorepo setup:** In your Vercel project settings, set **Root Directory** to `apps/web` so Vercel builds and deploys the Next.js app from the correct location.
