/* ────────────────────────────────────────────────
   AI Text Reader — frontend logic
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
  const MAX_Y_RATIO = 1.5; // horizontal must dominate

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
    if (Math.abs(dy) > Math.abs(dx) * MAX_Y_RATIO) return; // vertical scroll

    if (dx < 0) {
      // Swipe left → show AI pane
      showPane("ai");
    } else {
      // Swipe right → show text pane
      showPane("text");
    }
  }, { passive: true });
})();

/* ── Clarify ────────────────────────────────────── */
async function clarify() {
  const text = textInput.value.trim();
  if (!text) {
    textInput.focus();
    return;
  }

  // On mobile, switch to AI pane while loading
  const isMobile = window.innerWidth <= 700;
  if (isMobile) showPane("ai");

  setLoading(true);

  try {
    const res = await fetch("/api/clarify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? `Server error ${res.status}`);
    }

    renderClarification(data.clarified, data.cached);
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
  // Convert line breaks to paragraphs for readable output
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
