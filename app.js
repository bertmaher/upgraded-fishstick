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
const keyBtn     = document.getElementById("keyBtn");
const keyPanel   = document.getElementById("keyPanel");
const keyInput   = document.getElementById("keyInput");

const LS_KEY = "anthropic_api_key";

const DEFAULT_TEXT = `The annual labour of every nation is the fund which originally supplies it with all the necessaries and conveniencies of life which it annually consumes, and which consist always either in the immediate produce of that labour, or in what is purchased with that produce from other nations.

According, therefore, as this produce, or what is purchased with it, bears a greater or smaller proportion to the number of those who are to consume it, the nation will be better or worse supplied with all the necessaries and conveniencies for which it has occasion.

But this proportion must in every nation be regulated by two different circumstances: first, by the skill, dexterity, and judgment with which its labour is generally applied; and, secondly, by the proportion between the number of those who are employed in useful labour, and that of those who are not so employed. Whatever be the soil, climate, or extent of territory of any particular nation, the abundance or scantiness of its annual supply must, in that particular situation, depend upon those two circumstances.`;

textInput.value = DEFAULT_TEXT;

/* ── API key management ─────────────────────── */
function getKey() {
  return localStorage.getItem(LS_KEY) || "";
}

function updateKeyBtnState() {
  if (getKey()) {
    keyBtn.classList.add("has-key");
    keyBtn.title = "API key saved — click to change";
  } else {
    keyBtn.classList.remove("has-key");
    keyBtn.title = "Set your Anthropic API key";
  }
}

function toggleKeyPanel() {
  const isHidden = keyPanel.classList.contains("hidden");
  keyPanel.classList.toggle("hidden", !isHidden);
  if (isHidden) {
    keyInput.value = getKey();
    keyInput.focus();
  }
}

function saveKey() {
  const val = keyInput.value.trim();
  if (val) {
    localStorage.setItem(LS_KEY, val);
  }
  keyPanel.classList.add("hidden");
  updateKeyBtnState();
}

function clearKey() {
  localStorage.removeItem(LS_KEY);
  keyInput.value = "";
  keyPanel.classList.add("hidden");
  updateKeyBtnState();
}

// Close panel when pressing Enter in key input
keyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveKey();
  if (e.key === "Escape") keyPanel.classList.add("hidden");
});

// On load: show key panel if no key set
window.addEventListener("load", () => {
  updateKeyBtnState();
  if (!getKey()) {
    keyPanel.classList.remove("hidden");
    keyInput.focus();
  }
});

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

  const apiKey = getKey();
  if (!apiKey) {
    keyPanel.classList.remove("hidden");
    keyInput.focus();
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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: "You are an expert at making complex texts easier to understand. When given a passage, rewrite it in clear, accessible language while preserving all the key ideas and nuance. Format your response as a clean, readable explanation. Do not add a preamble—go straight into the clarified version.",
        messages: [
          { role: "user", content: `Please clarify the following text:\n\n${text}` },
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
  aiContent.innerHTML = `<div class="error-msg">⚠️ ${escapeHtml(msg)}</div>`;
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
