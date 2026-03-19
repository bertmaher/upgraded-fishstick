# AI Text Reader

A fully static, serverless web app that uses Claude Haiku to simplify complex text passages. Paste in dense or difficult writing and get a clear, plain-language explanation back in seconds.

**[Try it live →](https://bertmaher.github.io/upgraded-fishstick/)**

---

## The experiment: built entirely on a phone

This project is an experiment in mobile-only development. Every part of it — writing the code, creating the GitHub repo, configuring GitHub Pages, opening pull requests, reviewing and merging changes — was done on a mobile phone. No laptop, no desktop, no keyboard. Not even once.

The goal was to find out whether a complete development workflow, from blank repo to deployed web app, is actually achievable from a phone in 2025. The answer turned out to be yes.

---

## What it does

- Paste any complex or dense text into the input pane
- Click **Clarify with AI** (or press `Ctrl+Enter` / `Cmd+Enter`)
- Claude Haiku rewrites it in clear, accessible language while preserving the key ideas

The app works entirely in the browser. Your API key is stored in `localStorage` and sent directly to the Anthropic API — it never passes through any intermediate server.

---

## Features

- **Fully serverless** — plain HTML, CSS, and vanilla JS; no build step, no backend
- **Direct API calls** — browser talks to `api.anthropic.com` directly
- **Client-side caching** — repeated requests for the same text are served instantly (SHA-256 keyed, session-lifetime `Map`)
- **Mobile-first UX** — tab bar and swipe gestures to switch between input and output panes on small screens
- **API key management** — stored in `localStorage`, never leaves your browser

---

## Getting started

You need an [Anthropic API key](https://console.anthropic.com/).

### Use the hosted version

Open the live link above. On first load the app will ask for your API key. Enter it and click Save — it's stored locally in your browser.

### Run locally

No install or build step needed:

```bash
# any static file server works
npx serve .
python3 -m http.server
```

Then open `http://localhost:3000` (or whichever port your server uses) in a browser.

---

## File structure

```
index.html   — app shell and markup
app.js       — all frontend logic (API calls, caching, UI, mobile UX)
style.css    — styling with CSS custom properties and responsive layout
```

No `package.json`. No `node_modules`. No build output directory.

---

## Privacy

- Your API key is stored only in your browser's `localStorage`
- Text you submit is sent directly from your browser to `api.anthropic.com` — no intermediate server ever sees it
- Nothing is persisted between page sessions
