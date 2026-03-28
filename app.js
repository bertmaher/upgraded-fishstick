/* ────────────────────────────────────────────────
   AI Text Reader — frontend logic (static/serverless)
───────────────────────────────────────────────── */

const textInput       = document.getElementById("textInput");
const aiContent       = document.getElementById("aiContent");
const loading         = document.getElementById("loading");
const loadingText     = document.getElementById("loadingText");
const clarifyBtn      = document.getElementById("clarifyBtn");
const cacheBadge      = document.getElementById("cacheBadge");
const paneText        = document.getElementById("paneText");
const paneAI          = document.getElementById("paneAI");
const tabText         = document.getElementById("tabText");
const tabCondensed    = document.getElementById("tabCondensed");
const tabSimplified   = document.getElementById("tabSimplified");
const modeCondensedBtn = document.getElementById("modeCondensed");
const modeSimplifiedBtn = document.getElementById("modeSimplified");
const app             = document.getElementById("app");

/* ── Worker proxy URL ─────────────────────────── */
// Replace with your deployed Cloudflare Worker URL
const API_URL = "https://small-recipe-2ce5.bertmaher.workers.dev";

const DEFAULT_TEXT = `The annual labour of every nation is the fund which originally supplies it with all the necessaries and conveniencies of life which it annually consumes, and which consist always either in the immediate produce of that labour, or in what is purchased with that produce from other nations.

According, therefore, as this produce, or what is purchased with it, bears a greater or smaller proportion to the number of those who are to consume it, the nation will be better or worse supplied with all the necessaries and conveniencies for which it has occasion.

But this proportion must in every nation be regulated by two different circumstances: first, by the skill, dexterity, and judgment with which its labour is generally applied; and, secondly, by the proportion between the number of those who are employed in useful labour, and that of those who are not so employed. Whatever be the soil, climate, or extent of territory of any particular nation, the abundance or scantiness of its annual supply must, in that particular situation, depend upon those two circumstances.

The abundance or scantiness of this supply, too, seems to depend more upon the former of those two circumstances than upon the latter. Among the savage nations of hunters and fishers, every individual who is able to work is more or less employed in useful labour, and endeavours to provide, as well as he can, the necessaries and conveniencies of life, for himself, and such of his family or tribe as are either too old, or too young, or too infirm, to go a-hunting and fishing. Such nations, however, are so miserably poor, that, from mere want, they are frequently reduced, or at least think themselves reduced, to the necessity sometimes of directly destroying, and sometimes of abandoning their infants, their old people, and those afflicted with lingering diseases, to perish with hunger, or to be devoured by wild beasts. Among civilized and thriving nations, on the contrary, though a great number of people do not labour at all, many of whom consume the produce of ten times, frequently of a hundred times, more labour than the greater part of those who work; yet the produce of the whole labour of the society is so great, that all are often abundantly supplied; and a workman, even of the lowest and poorest order, if he is frugal and industrious, may enjoy a greater share of the necessaries and conveniencies of life than it is possible for any savage to acquire.`;

textInput.value = DEFAULT_TEXT;

/* ── Mode state ─────────────────────────────────── */
let currentMode = "condensed"; // 'condensed' | 'simplified'
const condensedCache = new Map();
const simplifiedCache = new Map();

/* ── Clear text ────────────────────────────────── */
function clearText() {
  textInput.value = "";
  textInput.focus();
}

/* ── Mode switching ──────────────────────────────── */
function setMode(mode) {
  currentMode = mode;
  modeCondensedBtn.classList.toggle("active", mode === "condensed");
  modeSimplifiedBtn.classList.toggle("active", mode === "simplified");
  refreshAIPane();
}

async function refreshAIPane() {
  const text = textInput.value.trim();
  cacheBadge.classList.add("hidden");

  if (text) {
    const cache = currentMode === "condensed" ? condensedCache : simplifiedCache;
    const cacheKey = await sha256(text);
    if (cache.has(cacheKey)) {
      renderAI(cache.get(cacheKey), true);
      return;
    }
  }

  const modeLabel = currentMode === "condensed" ? "condense" : "simplify";
  aiContent.innerHTML = `<div class="placeholder"><p>Paste some text on the left and click <strong>Process with AI</strong> to ${modeLabel} it.</p></div>`;
}

/* ── Tab / pane switching (mobile) ─────────────── */
function showPane(name) {
  const isText = name === "text";
  paneText.classList.toggle("active", isText);
  paneAI.classList.toggle("active", !isText);
  tabText.classList.toggle("active", isText);
  tabCondensed.classList.toggle("active", name === "condensed");
  tabSimplified.classList.toggle("active", name === "simplified");

  if (!isText) {
    setMode(name);
  }
}

/* ── Swipe detection (mobile) ──────────────────── */
(function initSwipe() {
  let startX = null;
  let startY = null;
  const THRESHOLD = 50;
  const MAX_Y_RATIO = 1.5;
  const PANES = ["text", "condensed", "simplified"];

  app.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  app.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    startX = null;
    startY = null;

    if (Math.abs(dx) < THRESHOLD) return;
    if (Math.abs(dy) > Math.abs(dx) * MAX_Y_RATIO) return;

    const activePane = paneText.classList.contains("active") ? "text" : currentMode;
    const idx = PANES.indexOf(activePane);

    if (dx < 0 && idx < PANES.length - 1) showPane(PANES[idx + 1]);
    else if (dx > 0 && idx > 0) showPane(PANES[idx - 1]);
  }, { passive: true });
})();

/* ── Client-side cache ──────────────────────────── */
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ── System prompts ─────────────────────────────── */
function getCondensedPrompt(wordCount) {
  const targetWords = Math.max(10, Math.round(wordCount / 10));
  return `You are an expert editor specializing in condensing texts in the style of Reader's Digest Condensed Books. When given a passage, produce a shorter version that preserves the author's original voice, style, and tone as faithfully as possible — cut words, sentences, and redundancies, but do not paraphrase or simplify the language. The goal is a tighter version of the same text, not a summary or a rewrite.\n\nThe input text is ${wordCount} words long. Your condensed version MUST be approximately ${targetWords} words — that is roughly 1/10 the length. Count your words as you write and stop when you reach the target.\n\nMaintain logical paragraph breaks. Preserve the original paragraph structure where possible, or create new breaks at natural thought divisions. Each paragraph should develop a single idea, making the text scannable and readable rather than a dense block of prose.\n\nDo not add a preamble—go straight into the condensed version.\n\nHere is the text to condense:`;
}

function getSimplifiedPrompt() {
  return `You are an expert at making complex texts easy to understand. When given a passage, rewrite it in plain, clear language that anyone can follow. Use simpler vocabulary, shorter sentences, and a straightforward structure — but preserve all the key ideas and information. Do not add a preamble — go straight into the simplified version.`;
}

/* ── Process with AI ────────────────────────────── */
async function clarify() {
  const text = textInput.value.trim();
  if (!text) {
    textInput.focus();
    return;
  }

  const isMobile = window.innerWidth <= 700;
  if (isMobile) showPane(currentMode);

  setLoading(true);

  try {
    const cache = currentMode === "condensed" ? condensedCache : simplifiedCache;
    const cacheKey = await sha256(text);

    if (cache.has(cacheKey)) {
      renderAI(cache.get(cacheKey), true);
      return;
    }

    const wordCount = text.trim().split(/\s+/).length;
    const systemPrompt = currentMode === "condensed"
      ? getCondensedPrompt(wordCount)
      : getSimplifiedPrompt();

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: text },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message ?? `API error ${res.status}`);
    }

    const result = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    cache.set(cacheKey, result);
    renderAI(result, false);
  } catch (err) {
    renderError(err.message);
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  clarifyBtn.disabled = on;
  loading.classList.toggle("hidden", !on);
  cacheBadge.classList.add("hidden");
  loadingText.textContent = currentMode === "condensed" ? "Condensing…" : "Simplifying…";
}

function renderAI(text, cached) {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");

  aiContent.innerHTML = paras || `<p>${escapeHtml(text)}</p>`;

  if (cached) {
    cacheBadge.classList.remove("hidden");
  }
}

function renderError(msg) {
  aiContent.innerHTML = `<div class="error-msg">\u26a0\ufe0f ${escapeHtml(msg)}</div>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Keyboard shortcut: Ctrl/Cmd + Enter ───────── */
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    clarify();
  }
});
