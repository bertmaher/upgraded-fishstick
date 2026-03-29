/* ────────────────────────────────────────────────
   AI Text Reader — frontend logic (static/serverless)
───────────────────────────────────────────────── */

const textInput        = document.getElementById("textInput");
const aiContent        = document.getElementById("aiContent");
const loading          = document.getElementById("loading");
const loadingText      = document.getElementById("loadingText");
const cacheBadge       = document.getElementById("cacheBadge");
const paneText         = document.getElementById("paneText");
const paneAI           = document.getElementById("paneAI");
const tabText          = document.getElementById("tabText");
const tabCondensed     = document.getElementById("tabCondensed");
const tabSimplified    = document.getElementById("tabSimplified");
const modeCondensedBtn = document.getElementById("modeCondensed");
const modeSimplifiedBtn = document.getElementById("modeSimplified");
const app              = document.getElementById("app");

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

  if (!text) {
    const modeLabel = currentMode === "condensed" ? "Reader's Digest" : "CliffsNotes";
    aiContent.innerHTML = `<div class="placeholder"><p>Paste some text in the Original tab to get a <strong>${modeLabel}</strong> version.</p></div>`;
    return;
  }

  const cache = currentMode === "condensed" ? condensedCache : simplifiedCache;
  const cacheKey = await sha256(text);
  if (cache.has(cacheKey)) {
    renderAI(cache.get(cacheKey), true);
    return;
  }

  // No cached result — trigger AI processing automatically
  clarify();
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
  const targetWords = Math.max(10, Math.round(wordCount / 4));
  return `You are an expert editor specializing in condensing texts in the style of Reader's Digest Condensed Books. When given a passage, produce a shorter version that preserves the author's original voice, style, and tone as faithfully as possible — cut words, sentences, and redundancies, but do not paraphrase or simplify the language. The goal is a tighter version of the same text, not a summary or a rewrite.\n\nThe input text is ${wordCount} words long. Your condensed version MUST be approximately ${targetWords} words — that is roughly 1/4 the length. Count your words as you write and stop when you reach the target.\n\nMaintain logical paragraph breaks. Preserve the original paragraph structure where possible, or create new breaks at natural thought divisions. Each paragraph should develop a single idea, making the text scannable and readable rather than a dense block of prose.\n\nDo not add a preamble—go straight into the condensed version.\n\nHere is the text to condense:`;
}

function getSimplifiedPrompt() {
  return `You are an expert at making complex texts easy to understand. When given a passage, rewrite it in plain, clear language that anyone can follow. Use simpler vocabulary, shorter sentences, and a straightforward structure — but preserve all the key ideas and information. Do not add a preamble — go straight into the simplified version.`;
}

/* ── Process with AI ────────────────────────────── */
async function clarify() {
  if (!loading.classList.contains("hidden")) return; // already in flight

  const text = textInput.value.trim();
  if (!text) return;

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
  loading.classList.toggle("hidden", !on);
  cacheBadge.classList.add("hidden");
  loadingText.textContent = currentMode === "condensed" ? "Digesting…" : "Summarizing…";
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

/* ── Sample passages ─────────────────────────── */
const SAMPLES = [
  {
    group: "The Federalist Papers",
    items: [
      { title: "No. 1 — General Introduction (Hamilton, 1787)", text: "AFTER an unequivocal experience of the inefficacy of the subsisting federal government, you are called upon to deliberate on a new Constitution for the United States of America. The subject speaks its own importance; comprehending in its consequences nothing less than the existence of the UNION, the safety and welfare of the parts of which it is composed, the fate of an empire in many respects the most interesting in the world. It has been frequently remarked that it seems to have been reserved to the people of this country, by their conduct and example, to decide the important question, whether societies of men are really capable or not of establishing good government from reflection and choice, or whether they are forever destined to depend for their political constitutions on accident and force. If there be any truth in the remark, the crisis at which we are arrived may with propriety be regarded as the era in which that decision is to be made; and a wrong election of the part we shall act may, in this view, deserve to be considered as the general misfortune of mankind.\nThis idea will add the inducements of philanthropy to those of patriotism, to heighten the solicitude which all considerate and good men must feel for the event. Happy will it be if our choice should be directed by a judicious estimate of our true interests, unperplexed and unbiased by considerations not connected with the public good. But this is a thing more ardently to be wished than seriously to be expected. The plan offered to our deliberations affects too many particular interests, innovates upon too many local institutions, not to involve in its discussion a variety of objects foreign to its merits, and of views, passions and prejudices little favorable to the discovery of truth.\nAmong the most formidable of the obstacles which the new Constitution will have to encounter may readily be distinguished the obvious interest of a certain class of men in every State to resist all changes which may hazard a diminution of the power, emolument, and consequence of the offices they hold under the State establishments; and the perverted ambition of another class of men, who will either hope to aggrandize themselves by the confusions of their country, or will flatter themselves with fairer prospects of elevation from the subdivision of the empire into several partial confederacies than from its union under one government.\nIt is not, however, my design to dwell upon observations of this nature. I am well aware that it would be disingenuous to resolve indiscriminately the opposition of any set of men (merely because their situations might subject them to suspicion) into interested or ambitious views. Candor will oblige us to admit that even such men may be actuated by upright intentions; and it cannot be doubted that much of the opposition which has made its appearance, or may hereafter make its appearance, will spring from sources, blameless at least, if not respectable--the honest errors of minds led astray by preconceived jealousies and fears. So numerous indeed and so powerful are the causes which serve to give a false bias to the judgment, that we, upon many occasions, see wise and good men on the wrong as well as on the right side of questions of the first magnitude to society. This circumstance, if duly attended to, would furnish a lesson of moderation to those who are ever so much persuaded of their being in the right in any controversy. And a further reason for caution, in this respect, might be drawn from the reflection that we are not always sure that those who advocate the truth are influenced by purer principles than their antagonists. Ambition, avarice, personal animosity, party opposition, and many other motives not more laudable than these, are apt to operate as well upon those who support as those who oppose the right side of a question. Were there not even these inducements to moderation, nothing could be more ill-judged than that intolerant spirit which has, at all times, characterized political parties. For in politics, as in religion, it is equally absurd to aim at making proselytes by fire and sword. Heresies in either can rarely be cured by persecution." },
      { title: "No. 10 — On Faction (Madison, 1787)", text: "AMONG the numerous advantages promised by a well constructed Union, none deserves to be more accurately developed than its tendency to break and control the violence of faction. The friend of popular governments never finds himself so much alarmed for their character and fate, as when he contemplates their propensity to this dangerous vice. He will not fail, therefore, to set a due value on any plan which, without violating the principles to which he is attached, provides a proper cure for it. The instability, injustice, and confusion introduced into the public councils, have, in truth, been the mortal diseases under which popular governments have everywhere perished; as they continue to be the favorite and fruitful topics from which the adversaries to liberty derive their most specious declamations. The valuable improvements made by the American constitutions on the popular models, both ancient and modern, cannot certainly be too much admired; but it would be an unwarrantable partiality, to contend that they have as effectually obviated the danger on this side, as was wished and expected. Complaints are everywhere heard from our most considerate and virtuous citizens, equally the friends of public and private faith, and of public and personal liberty, that our governments are too unstable, that the public good is disregarded in the conflicts of rival parties, and that measures are too often decided, not according to the rules of justice and the rights of the minor party, but by the superior force of an interested and overbearing majority. However anxiously we may wish that these complaints had no foundation, the evidence, of known facts will not permit us to deny that they are in some degree true. It will be found, indeed, on a candid review of our situation, that some of the distresses under which we labor have been erroneously charged on the operation of our governments; but it will be found, at the same time, that other causes will not alone account for many of our heaviest misfortunes; and, particularly, for that prevailing and increasing distrust of public engagements, and alarm for private rights, which are echoed from one end of the continent to the other. These must be chiefly, if not wholly, effects of the unsteadiness and injustice with which a factious spirit has tainted our public administrations.\nBy a faction, I understand a number of citizens, whether amounting to a majority or a minority of the whole, who are united and actuated by some common impulse of passion, or of interest, adversed to the rights of other citizens, or to the permanent and aggregate interests of the community.\nThere are two methods of curing the mischiefs of faction: the one, by removing its causes; the other, by controlling its effects.\nThere are again two methods of removing the causes of faction: the one, by destroying the liberty which is essential to its existence; the other, by giving to every citizen the same opinions, the same passions, and the same interests.\nIt could never be more truly said than of the first remedy, that it was worse than the disease. Liberty is to faction what air is to fire, an aliment without which it instantly expires. But it could not be less folly to abolish liberty, which is essential to political life, because it nourishes faction, than it would be to wish the annihilation of air, which is essential to animal life, because it imparts to fire its destructive agency." },
      { title: "No. 51 — Checks and Balances (Madison, 1788)", text: "TO WHAT expedient, then, shall we finally resort, for maintaining in practice the necessary partition of power among the several departments, as laid down in the Constitution? The only answer that can be given is, that as all these exterior provisions are found to be inadequate, the defect must be supplied, by so contriving the interior structure of the government as that its several constituent parts may, by their mutual relations, be the means of keeping each other in their proper places. Without presuming to undertake a full development of this important idea, I will hazard a few general observations, which may perhaps place it in a clearer light, and enable us to form a more correct judgment of the principles and structure of the government planned by the convention.\nIn order to lay a due foundation for that separate and distinct exercise of the different powers of government, which to a certain extent is admitted on all hands to be essential to the preservation of liberty, it is evident that each department should have a will of its own; and consequently should be so constituted that the members of each should have as little agency as possible in the appointment of the members of the others. Were this principle rigorously adhered to, it would require that all the appointments for the supreme executive, legislative, and judiciary magistracies should be drawn from the same fountain of authority, the people, through channels having no communication whatever with one another. Perhaps such a plan of constructing the several departments would be less difficult in practice than it may in contemplation appear. Some difficulties, however, and some additional expense would attend the execution of it. Some deviations, therefore, from the principle must be admitted. In the constitution of the judiciary department in particular, it might be inexpedient to insist rigorously on the principle: first, because peculiar qualifications being essential in the members, the primary consideration ought to be to select that mode of choice which best secures these qualifications; secondly, because the permanent tenure by which the appointments are held in that department, must soon destroy all sense of dependence on the authority conferring them.\nIt is equally evident, that the members of each department should be as little dependent as possible on those of the others, for the emoluments annexed to their offices. Were the executive magistrate, or the judges, not independent of the legislature in this particular, their independence in every other would be merely nominal.\nBut the great security against a gradual concentration of the several powers in the same department, consists in giving to those who administer each department the necessary constitutional means and personal motives to resist encroachments of the others. The provision for defense must in this, as in all other cases, be made commensurate to the danger of attack. Ambition must be made to counteract ambition. The interest of the man must be connected with the constitutional rights of the place. It may be a reflection on human nature, that such devices should be necessary to control the abuses of government. But what is government itself, but the greatest of all reflections on human nature? If men were angels, no government would be necessary. If angels were to govern men, neither external nor internal controls on government would be necessary. In framing a government which is to be administered by men over men, the great difficulty lies in this: you must first enable the government to control the governed; and in the next place oblige it to control itself. A dependence on the people is, no doubt, the primary control on the government; but experience has taught mankind the necessity of auxiliary precautions." },
    ],
  },
  {
    group: "The Wealth of Nations",
    items: [
      { title: "Book I, Ch. 1 — Division of Labour (Smith, 1776)", text: "The greatest improvements in the productive powers of labour, and the greater part of the skill, dexterity, and judgment, with which it is anywhere directed, or applied, seem to have been the effects of the division of labour. The effects of the division of labour, in the general business of society, will be more easily understood, by considering in what manner it operates in some particular manufactures. It is commonly supposed to be carried furthest in some very trifling ones; not perhaps that it really is carried further in them than in others of more importance: but in those trifling manufactures which are destined to supply the small wants of but a small number of people, the whole number of workmen must necessarily be small; and those employed in every different branch of the work can often be collected into the same workhouse, and placed at once under the view of the spectator.\nIn those great manufactures, on the contrary, which are destined to supply the great wants of the great body of the people, every different branch of the work employs so great a number of workmen, that it is impossible to collect them all into the same workhouse. We can seldom see more, at one time, than those employed in one single branch. Though in such manufactures, therefore, the work may really be divided into a much greater number of parts, than in those of a more trifling nature, the division is not near so obvious, and has accordingly been much less observed.\nTo take an example, therefore, from a very trifling manufacture, but one in which the division of labour has been very often taken notice of, the trade of a pin-maker: a workman not educated to this business (which the division of labour has rendered a distinct trade), nor acquainted with the use of the machinery employed in it (to the invention of which the same division of labour has probably given occasion), could scarce, perhaps, with his utmost industry, make one pin in a day, and certainly could not make twenty. But in the way in which this business is now carried on, not only the whole work is a peculiar trade, but it is divided into a number of branches, of which the greater part are likewise peculiar trades. One man draws out the wire; another straights it; a third cuts it; a fourth points it; a fifth grinds it at the top for receiving the head; to make the head requires two or three distinct operations; to put it on is a peculiar business; to whiten the pins is another; it is even a trade by itself to put them into the paper; and the important business of making a pin is, in this manner, divided into about eighteen distinct operations, which, in some manufactories, are all performed by distinct hands, though in others the same man will sometimes perform two or three of them. I have seen a small manufactory of this kind, where ten men only were employed, and where some of them consequently performed two or three distinct operations. But though they were very poor, and therefore but indifferently accommodated with the necessary machinery, they could, when they exerted themselves, make among them about twelve pounds of pins in a day. There are in a pound upwards of four thousand pins of a middling size. Those ten persons, therefore, could make among them upwards of forty-eight thousand pins in a day. Each person, therefore, making a tenth part of forty-eight thousand pins, might be considered as making four thousand eight hundred pins in a day. But if they had all wrought separately and independently, and without any of them having been educated to this peculiar business, they certainly could not each of them have made twenty, perhaps not one pin in a day; that is, certainly, not the two hundred and fortieth, perhaps not the four thousand eight hundredth, part of what they are at present capable of performing, in consequence of a proper division and combination of their different operations.\nIn every other art and manufacture, the effects of the division of labour are similar to what they are in this very trifling one, though, in many of them, the labour can neither be so much subdivided, nor reduced to so great a simplicity of operation. The division of labour, however, so far as it can be introduced, occasions, in every art, a proportionable increase of the productive powers of labour. The separation of different trades and employments from one another, seems to have taken place in consequence of this advantage. This separation, too, is generally carried furthest in those countries which enjoy the highest degree of industry and improvement; what is the work of one man, in a rude state of society, being generally that of several in an improved one. In every improved society, the farmer is generally nothing but a farmer; the manufacturer, nothing but a manufacturer. The labour, too, which is necessary to produce any one complete manufacture, is almost always divided among a great number of hands. How many different trades are employed in each branch of the linen and woollen manufactures, from the growers of the flax and the wool, to the bleachers and smoothers of the linen, or to the dyers and dressers of the cloth! The nature of agriculture, indeed, does not admit of so many subdivisions of labour, nor of so complete a separation of one business from another, as manufactures. It is impossible to separate so entirely the business of the grazier from that of the corn-farmer, as the trade of the carpenter is commonly separated from that of the smith. The spinner is almost always a distinct person from the weaver; but the ploughman, the harrower, the sower of the seed, and the reaper of the corn, are often the same. The occasions for those different sorts of labour returning with the different seasons of the year, it is impossible that one man should be constantly employed in any one of" },
    ],
  },
  {
    group: "Hamlet",
    items: [
      { title: "Act III, Scene 1 — To be, or not to be (Shakespeare)", text: "To be, or not to be,--that is the question:-- Whether 'tis nobler in the mind to suffer The slings and arrows of outrageous fortune Or to take arms against a sea of troubles, And by opposing end them?--To die,--to sleep,-- No more; and by a sleep to say we end The heartache, and the thousand natural shocks That flesh is heir to,--'tis a consummation Devoutly to be wish'd. To die,--to sleep;-- To sleep! perchance to dream:--ay, there's the rub; For in that sleep of death what dreams may come, When we have shuffled off this mortal coil, Must give us pause: there's the respect That makes calamity of so long life; For who would bear the whips and scorns of time, The oppressor's wrong, the proud man's contumely, The pangs of despis'd love, the law's delay, The insolence of office, and the spurns That patient merit of the unworthy takes, When he himself might his quietus make With a bare bodkin? who would these fardels bear, To grunt and sweat under a weary life, But that the dread of something after death,-- The undiscover'd country, from whose bourn No traveller returns,--puzzles the will, And makes us rather bear those ills we have Than fly to others that we know not of? Thus conscience does make cowards of us all; And thus the native hue of resolution Is sicklied o'er with the pale cast of thought; And enterprises of great pith and moment, With this regard, their currents turn awry, And lose the name of action.--Soft you now! The fair Ophelia!--Nymph, in thy orisons Be all my sins remember'd.\nOph. Good my lord, How does your honour for this many a day?\nHam. I humbly thank you; well, well, well.\nOph. My lord, I have remembrances of yours That I have longed long to re-deliver. I pray you, now receive them.\nHam. No, not I; I never gave you aught.\nOph. My honour'd lord, you know right well you did; And with them words of so sweet breath compos'd As made the things more rich; their perfume lost, Take these again; for to the noble mind Rich gifts wax poor when givers prove unkind. There, my lord.\nHam. Ha, ha! are you honest?\nOph. My lord?\nHam. Are you fair?\nOph. What means your lordship?\nHam. That if you be honest and fair, your honesty should admit no discourse to your beauty.\nOph. Could beauty, my lord, have better commerce than with honesty?\nHam. Ay, truly; for the power of beauty will sooner transform honesty from what it is to a bawd than the force of honesty can" },
    ],
  },
];

function toggleSamples() {
  const menu = document.getElementById("samplesMenu");
  const btn  = document.getElementById("samplesBtn");
  const opening = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !opening);
  btn.classList.toggle("open", opening);
}

function selectSample(gi, ii) {
  textInput.value = SAMPLES[gi].items[ii].text;
  document.getElementById("samplesMenu").classList.add("hidden");
  document.getElementById("samplesBtn").classList.remove("open");
  cacheBadge.classList.add("hidden");
  aiContent.innerHTML = `<div class="placeholder"><p>Press <strong>Ctrl+Enter</strong> or switch modes to process this passage.</p></div>`;
}

(function initSamples() {
  const menu = document.getElementById("samplesMenu");
  SAMPLES.forEach((group, gi) => {
    const label = document.createElement("div");
    label.className = "samples-group-label";
    label.textContent = group.group;
    menu.appendChild(label);
    group.items.forEach((item, ii) => {
      const btn = document.createElement("button");
      btn.className = "samples-item";
      btn.textContent = item.title;
      btn.onclick = () => selectSample(gi, ii);
      menu.appendChild(btn);
    });
    if (gi < SAMPLES.length - 1) {
      const hr = document.createElement("div");
      hr.className = "samples-divider";
      menu.appendChild(hr);
    }
  });

  document.addEventListener("click", (e) => {
    if (!document.getElementById("samplesContainer").contains(e.target)) {
      document.getElementById("samplesMenu").classList.add("hidden");
      document.getElementById("samplesBtn").classList.remove("open");
    }
  });
})();
