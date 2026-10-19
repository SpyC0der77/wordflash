# WordFlash

WordFlash uses rapid serial visual presentation (RSVP) to show one word at a time in the same spot on screen. Each word highlights a single focal character so your eyes stay put instead of scanning left to right.

## Demo

![Playing text, clicking words in Scrub mode, dragging the position slider, and reading a NASA article with synchronized highlighting.](docs/images/demo.gif)

[Watch the MP4](docs/images/demo.mp4) · [Recording script](docs/demo/README.md)

[Watch the MP4](docs/images/demo.mp4) · [Recording script](docs/demo/README.md)

<details>
<summary>Screenshot</summary>

![WordFlash reader](docs/images/app.png)

</details>

Paste text or give it a URL. For URLs it pulls the article body with [Mozilla Readability](https://github.com/mozilla/readability) and reads it back in the same word-by-word view.

[Live demo](https://wordflashreader.vercel.app)

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
└── package.json    pnpm workspaces
```

## Development

Use pnpm 12.14.0 and the latest Node.js 24 patch release for development, the web app, and Firebase Functions. The runtime is set in the package manifests and `firebase.json`; `.nvmrc` selects Node.js 24 for compatible version managers. Package-manager settings live in `pnpm-workspace.yaml`.

TypeScript stays on 6.0.x and ESLint on 9.x until the lint plugins support the newer major versions. Node type definitions stay on 24.x to match the runtime.

```bash
pnpm install
pnpm run dev
```

Dev server: [http://localhost:3000](http://localhost:3000)

| Command | What it does |
|---------|--------------|
| `pnpm run dev` | Web dev server |
| `pnpm run build` | Build core + web |
| `pnpm run lint` | Lint all packages |
| `pnpm run test` | Run all tests |

Watch tests in one package:

```bash
cd packages/core && pnpm run test:watch
cd apps/web && pnpm run test:watch
```

Production build:

```bash
pnpm run build
pnpm --filter wordflash run start
```

## Deploy

**Vercel:** Create a project from this repo and set **Root Directory** to `apps/web`. See the [Next.js deploy docs](https://nextjs.org/docs/app/building-your-application/deploying) if you need the details.

**Firebase:** `firebase.json` hosts the web app and routes `/api/extract` to the `extract` Cloud Function in `functions/`. Use Firebase CLI 15.34.0 or newer. Install the Functions dependencies with `pnpm --dir functions install` and authenticate the Firebase CLI before running `firebase deploy`. The predeploy hook builds the Functions code. Review `.firebaserc` and choose your own Firebase project before deployment.
