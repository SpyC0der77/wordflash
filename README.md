# WordFlash

WordFlash shows you one word at a time (RSVP). Each word highlights a single focal character so your eyes stay in one place instead of scanning left to right.

Paste text or give it a URL. For URLs it pulls the article body with [Mozilla Readability](https://github.com/mozilla/readability) and reads it back in the same word-by-word view.

Built with [Next.js](https://nextjs.org), [React](https://react.dev), and [Tailwind CSS](https://tailwindcss.com).

## What you get

- Focal-character highlighting with configurable color, font, and WPM
- Natural punctuation and line-break pauses, plus extra time for unfamiliar names, numbers, and long words ([timing rules](docs/reading-timing.md))
- Article reader with the full text beside the RSVP panel; click a word to jump
- A bookmarklet ("Read in WordFlash") for opening the current page in the reader
- Light, dark, and system themes; reduce motion and reduce transparency toggles
- Reading position saved in the browser when you come back

## Repo layout

```
wordflash/
├── apps/web/       Next.js app
├── functions/      Firebase Cloud Function for /api/extract
├── packages/core/  Word timing, parsing, focal index
└── package.json    Bun workspaces
```

## Development

You need [Bun](https://bun.sh) (or Node 18+).

```bash
bun install
bun run dev
```

Dev server: [http://localhost:3000](http://localhost:3000)

| Command | What it does |
|---------|--------------|
| `bun run dev` | Web dev server |
| `bun run build` | Build core + web |
| `bun run lint` | Lint all packages |
| `bun run test` | Run all tests |

Watch tests in one package:

```bash
cd packages/core && bun run test:watch
cd apps/web && bun run test:watch
```

Production build:

```bash
bun run build
bun run --filter wordflash start
```

## Deploy

**Vercel:** Create a project from this repo and set **Root Directory** to `apps/web`. See the [Next.js deploy docs](https://nextjs.org/docs/app/building-your-application/deploying) if you need the details.

**Firebase:** `firebase.json` hosts the web app and routes `/api/extract` to the `extract` Cloud Function in `functions/`. Deploy with `firebase deploy` after `bun install` in `functions/`.
