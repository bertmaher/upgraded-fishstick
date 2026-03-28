/* ────────────────────────────────────────────────
   AI Text Reader — frontend logic (static/serverless)
───────────────────────────────────────────────── */

const textInput  = document.getElementById("textInput");
const aiContent  = document.getElementById("aiContent");
const loading    = document.getElementById("loading");
const clarifyBtn = document.getElementById("clarifyBtn");
const cacheBadge = document.getElementById("cacheBadge");
const paneText   = document.getElementById("paneText");
const paneAI     = document.getElementById("paneAI");
const tabText    = document.getElementById("tabText");
const tabAI      = document.getElementById("tabAI");
const app        = document.getElementById("app");

/* ── Worker proxy URL ─────────────────────────── */
// Replace with your deployed Cloudflare Worker URL
const API_URL = "https://small-recipe-2ce5.bertmaher.workers.dev";

const DEFAULT_TEXT = `The annual labour of every nation is the fund which originally supplies it with all the necessaries and conveniencies of life which it annually consumes, and which consist always either in the immediate produce of that labour, or in what is purchased with that produce from other nations.

According, therefore, as this produce, or what is purchased with it, bears a greater or smaller proportion to the number of those who are to consume it, the nation will be better or worse supplied with all the necessaries and conveniencies for which it has occasion.

But this proportion must in every nation be regulated by two different circumstances: first, by the skill, dexterity, and judgment with which its labour is generally applied; and, secondly, by the proportion between the number of those who are employed in useful labour, and that of those who are not so employed. Whatever be the soil, climate, or extent of territory of any particular nation, the abundance or scantiness of its annual supply must, in that particular situation, depend upon those two circumstances.

The abundance or scantiness of this supply, too, seems to depend more upon the former of those two circumstances than upon the latter. Among the savage nations of hunters and fishers, every individual who is able to work is more or less employed in useful labour, and endeavours to provide, as well as he can, the necessaries and conveniencies of life, for himself, and such of his family or tribe as are either too old, or too young, or too infirm, to go a-hunting and fishing. Such nations, however, are so miserably poor, that, from mere want, they are frequently reduced, or at least think themselves reduced, to the necessity sometimes of directly destroying, and sometimes of abandoning their infants, their old people, and those afflicted with lingering diseases, to perish with hunger, or to be devoured by wild beasts. Among civilized and thriving nations, on the contrary, though a great number of people do not labour at all, many of whom consume the produce of ten times, frequently of a hundred times, more labour than the greater part of those who work; yet the produce of the whole labour of the society is so great, that all are often abundantly supplied; and a workman, even of the lowest and poorest order, if he is frugal and industrious, may enjoy a greater share of the necessaries and conveniencies of life than it is possible for any savage to acquire.`;

textInput.value = DEFAULT_TEXT;

/* ── Clear text ────────────────────────────────── */
function clearText() {
  textInput.value = "";
  textInput.focus();
}

/* ── Tab / pane switching (mobile) ─────────────── */
function showPane(name) {
  if (name === "text") {
    paneText.classList.add("active");
    paneAI.classList.remove("active");
    tabText.classList.add("active");
    tabAI.classList.remove("active");
  } else {
    paneAI.classList.add("active");
    paneText.classList.remove("active");
    tabAI.classList.add("active");
    tabText.classList.remove("active");
  }
}

/* ── Swipe detection (mobile) ──────────────────── */
(function initSwipe() {
  let startX = null;
  let startY = null;
  const THRESHOLD = 50;
  const MAX_Y_RATIO = 1.5;

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

    if (dx < 0) showPane("ai");
    else showPane("text");
  }, { passive: true });
})();

/* ── Client-side cache ──────────────────────────── */
const clarificationCache = new Map();

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ── Clarify ────────────────────────────────────── */
async function clarify() {
  const text = textInput.value.trim();
  if (!text) {
    textInput.focus();
    return;
  }

  const isMobile = window.innerWidth <= 700;
  if (isMobile) showPane("ai");

  setLoading(true);

  try {
    const cacheKey = await sha256(text);
    if (clarificationCache.has(cacheKey)) {
      renderClarification(clarificationCache.get(cacheKey), true);
      return;
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: "You are an expert editor specializing in condensing texts in the style of Reader's Digest Condensed Books. When given a passage, produce a shorter version that preserves the author's original voice, style, and tone as faithfully as possible — cut words, sentences, and redundancies, but do not paraphrase or simplify the language. The goal is a tighter version of the same text, not a summary or a rewrite.\n\nThe goal is to substantially reduce the length of the input text.  We want to make the text about 10x shorter!  That means for every ten sentences in the original source, you should target one sentence in the output!\n\nMaintain logical paragraph breaks. Preserve the original paragraph structure where possible, or create new breaks at natural thought divisions. Each paragraph should develop a single idea, making the text scannable and readable rather than a dense block of prose.\n\nDo not add a preamble—go straight into the condensed version.\n\nHere is the text to condense:",
        messages: [
          { role: "user", content: text },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message ?? `API error ${res.status}`);
    }

    const clarified = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    clarificationCache.set(cacheKey, clarified);
    renderClarification(clarified, false);
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
}

function renderClarification(text, cached) {
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
