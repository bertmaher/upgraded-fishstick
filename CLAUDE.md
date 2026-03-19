# CLAUDE.md

## Project Overview

**AI Text Reader** (`text-reader-ai`) is a fully static, serverless single-page app that uses Claude Haiku to simplify complex text passages. There is no backend — the browser calls the Anthropic API directly using an API key the user supplies via the UI.

It is designed to be hosted on GitHub Pages (`.nojekyll` present) or served as plain static files.

## File Structure

```
index.html   — App shell and markup
app.js       — All frontend logic (API calls, caching, UI, mobile UX)
style.css    — Styling with CSS custom properties and responsive layout
```

No `package.json`, no build step, no server.

## How to Run

Open `index.html` in a browser — no server required. On first load, the app prompts for an Anthropic API key. The key is saved to `localStorage` and sent directly to `api.anthropic.com`; it never touches any intermediate server.

For local development, any static file server works:

```bash
npx serve .
python3 -m http.server
```

## Key Conventions

- **No build step.** All JS is plain, browser-compatible vanilla JS. Do not introduce bundlers, transpilers, or `npm` dependencies.
- **No backend.** API calls go directly from the browser to `https://api.anthropic.com/v1/messages` using the `anthropic-dangerous-direct-browser-access` header.
- **Model:** `claude-haiku-4-5-20251001` with `max_tokens: 4096`. The system prompt is kept static.
- **Client-side cache:** SHA-256 hash of trimmed input text → clarified output, stored in a `Map` for the page session lifetime. A "⚡ Cached" badge appears on cache hits.
- **API key storage:** `localStorage` key `anthropic_api_key`. The key panel auto-opens on load if no key is set.
- **CSS:** Uses CSS custom properties for theming. Follow the existing BEM-like class naming (e.g., `pane-text`, `btn-clarify`, `cache-badge`).
- **Mobile UX:** Tab bar (`Text` / `AI View`) and swipe gestures switch between the two panes on narrow screens (≤700 px).
- **Keyboard shortcut:** `Ctrl+Enter` / `Cmd+Enter` triggers clarification from the textarea.

## No Tests or Linting

No test framework or linter is configured. If adding either, prefer options that don't require a build step (e.g., `eslint` with flat config, browser-native test runners).
