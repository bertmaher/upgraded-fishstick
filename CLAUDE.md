# CLAUDE.md

## Project Overview

**text-reader-ai** is a dual-mode web app that uses Claude Haiku to simplify complex text passages. It can run as an Express backend server or as a fully static single-page app (for GitHub Pages).

## Architecture

- **`server.js`** — Express backend with a `/api/clarify` POST endpoint. Reads `ANTHROPIC_API_KEY` from the environment. Caches results in-memory using SHA-256 hashes of input text.
- **`app.js`** — Vanilla JS frontend. Works in two modes:
  - With backend: proxies requests through the Express server.
  - Static/serverless: calls the Anthropic API directly from the browser using an API key stored in `localStorage`.
- **`index.html`** / **`style.css`** — Static UI assets.

## Running the Project

### Backend mode

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start   # http://localhost:3000
npm run dev                               # Same, with --watch for auto-restart
```

### Static/GitHub Pages mode

Open `index.html` directly in a browser or serve it as a static site. The user supplies their own API key via the UI; it is stored in `localStorage` and never sent to a server.

## Key Conventions

- **ES modules** throughout (`"type": "module"` in `package.json`). Use `import`/`export`, not `require`.
- **No build step** — all JS is plain, browser-compatible vanilla JS. Do not introduce bundlers or transpilers unless explicitly requested.
- **Model**: `claude-haiku-4-5` with prompt caching on the system prompt (`cache_control: { type: "ephemeral" }`). Keep the system prompt static so caching is effective.
- **In-memory cache**: SHA-256 hash of trimmed input text → clarified output. The cache lives only for the server process lifetime.
- **CSS**: Uses CSS custom properties (variables) for theming. Follow the existing BEM-like class naming (e.g., `pane-text`, `btn-clarify`).

## No Tests or Linting

There is currently no test framework or linter configured. When adding tests or linting, prefer lightweight options compatible with ES modules (e.g., `node --test`, `eslint` with flat config).
