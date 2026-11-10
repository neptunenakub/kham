/* Kham web demo: the interface. The search engine itself is in kham.js. */
"use strict";

const REPO = "https://github.com/neptunenakub/kham";
const PAGE = 150;         // words added per "show more"
const FAMILY_CAP = 200;   // the family view groups this many top results
const MODES = ["all", "only", "starts", "ends", "contains", "pattern", "rhymes"];

const { load: loadLexicon, search, families, lexicon: L, CONSONANTS: CONS, COMMON } = Kham;
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => n.toLocaleString("en-US");

/* ---------- interface text, Thai and English ---------- */
const TEXT = {
  th: {
    sub: "หาคำไทยจากตัวอักษรที่มี หาคำสัมผัส หรือคำที่ขึ้นต้นและลงท้ายตามต้องการ",
    uses: "สำหรับเล่นเกมต่อคำ แต่งกลอน เขียนเพลง และเรียนภาษาไทย · คลัง {n} คำ",
    eg: "เช่น {x}",
    mode_all: "มีตัวอักษรครบ", mode_only: "ใช้แค่ตัวเหล่านี้", mode_rhymes: "สัมผัสกับ", mode_starts: "ขึ้นต้นด้วย",
    mode_ends: "ลงท้ายด้วย", mode_contains: "มีคำว่า", mode_pattern: "แพทเทิร์น",
    hint_all: "ลำดับไม่สำคัญ ถ้าพิมพ์ตัวซ้ำ คำนั้นต้องมีตัวนั้นซ้ำด้วย",
    hint_only: "พยัญชนะทุกตัวในคำต้องมาจากชุดนี้ สระและวรรณยุกต์ใช้ได้อิสระ",
    hint_rhymes: "คำที่พยางค์สุดท้ายเสียงสระและตัวสะกดตรงกัน เช่น รัก กับ หนัก · อ่านจากตัวสะกด คำอ่านพิเศษบางคำอาจผิด",
    hint_starts: "คำที่ขึ้นต้นด้วยข้อความนี้",
    hint_ends: "คำที่ลงท้ายด้วยข้อความนี้",
    hint_contains: "คำที่มีข้อความนี้อยู่ตรงไหนก็ได้",
    hint_pattern: "? แทนตัวอักษร 1 ตัว · * แทนกี่ตัวก็ได้ เช่น ก?ร หรือ *ภาพ",
    len: "ความยาว", min: "ต่ำสุด", max: "สูงสุด", sort: "เรียง",
    sort_familiar: "คุ้นเคยก่อน", sort_long: "ยาวก่อน", sort_short: "สั้นก่อน", sort_az: "ก–ฮ",
    view_list: "รายการ", view_families: "ตระกูลคำ", kbd: "แป้นพยัญชนะ",
    common: "ซ่อนคำหายาก", common_tip: "แสดงเฉพาะคำที่พบในข้อความจริงบ่อยพอ คำจริงที่ใช้ไม่บ่อยบางคำจะถูกซ่อนไปด้วย",
    key_back: "ลบ", key_clear: "ล้าง",
    loading: "กำลังโหลดคลังคำ…",
    load_fail: "โหลดคลังคำไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง",
    count: "{n} คำ", none: "ไม่พบคำที่ตรงเงื่อนไข",
    none_tip: "ลองใช้ตัวอักษรน้อยลง เอาความยาวออก หรือเลิกซ่อนคำหายาก",
    idle: "ลองค้นแบบนี้ดู",
    random: "สุ่มคำ", copy_all: "คัดลอกทั้งหมด", share: "คัดลอกลิงก์",
    random_count: "สุ่มมา {n} คำ",
    legend: "สีจาง = คำที่พบไม่บ่อย · แตะคำเพื่อคัดลอกและดูความหมาย",
    more: "แสดงอีก {n} คำ",
    fam_note: "จัดกลุ่มเฉพาะ {n} คำแรก", fam_other: "อื่น ๆ", fam_play: "ต่อจากคำในกลุ่มก่อนหน้า",
    copied: "คัดลอก “{w}” แล้ว", meaning: "ดูความหมาย",
    copied_n: "คัดลอก {n} คำแล้ว", copied_link: "คัดลอกลิงก์แล้ว", copy_fail: "เบราว์เซอร์นี้คัดลอกไม่ได้",
    chars: "{n} ตัวอักษร", freq: ["พบน้อยมาก", "พบบ้าง", "พบบ่อย", "พบบ่อยมาก"],
    to_dark: "เปลี่ยนเป็นโหมดมืด", to_light: "เปลี่ยนเป็นโหมดสว่าง",
    a_lang: "ภาษา", a_search: "คำค้นหา", a_clear: "ล้างคำค้น", a_modes: "วิธีค้นหา",
    a_min: "ความยาวต่ำสุด", a_max: "ความยาวสูงสุด", a_view: "มุมมอง",
    how_title: "วิธีทำงาน",
    how_1_h: "ค้นเร็ว",
    how_1: "ทุกตัวอักษรมีรายการคำที่ใช้ตัวนั้นเตรียมไว้แล้ว เวลาค้นจึงเริ่มจากตัวที่มีคำน้อยที่สุด ไม่ต้องไล่ดูทั้งคลัง ส่วนใหญ่เสร็จในไม่กี่มิลลิวินาที และทำงานในเบราว์เซอร์ทั้งหมด",
    how_2_h: "เรียงตามความคุ้น",
    how_2: "คะแนนมาจากความถี่ของคำในคลังข้อความไทยสองชุด (Thai National Corpus และ Thai Textbook Corpus) โดยให้น้ำหนักภาษาที่ใช้ทั่วไปมากกว่าภาษาข่าว คำอย่าง นักเรียน จึงมาก่อน ดำเนินการ",
    how_3_h: "ตระกูลคำ",
    how_3: "ระบบมองหาคำที่ซ่อนอยู่ในคำ เช่น การเรียน = การ + เรียน แล้วจัดเป็นกลุ่มตามหัวคำ และต่อไปยังกลุ่มถัดไปจากชิ้นที่เพิ่งเห็น เหมือนเวลาคนนึกคำต่อกัน",
    how_4_h: "คำสัมผัส",
    how_4: "อ่านตัวสะกดของพยางค์สุดท้ายด้วยกฎ แล้วสรุปเป็นเสียงสระกับตัวสะกด คำที่เสียงตรงกันถือว่าสัมผัสกัน เช่น ใจ ไป ภัย ไม่ได้ใช้พจนานุกรมคำอ่าน คำที่สะกดไม่ตรงเสียงบางคำจึงอาจผิด",
    dev_title: "สำหรับนักพัฒนา",
    dev_text: "มีไลบรารี Python ที่ไม่ต้องติดตั้งอะไรเพิ่ม ใช้คลังคำและวิธีจัดอันดับชุดเดียวกับหน้านี้",
    dev_cli: "หรือใช้จาก command line",
    foot: 'โอเพนซอร์ส สัญญาอนุญาต MIT · คลังคำจาก <a href="https://github.com/PyThaiNLP/pythainlp" target="_blank" rel="noopener">PyThaiNLP</a> (CC0)',
  },
  en: {
    sub: "Find Thai words from the letters you have, words that rhyme, or words that start and end the way you need",
    uses: "For word games, poems, song lyrics and learning Thai · {n} words",
    eg: "e.g. {x}",
    mode_all: "Has all letters", mode_only: "Only these letters", mode_rhymes: "Rhymes with", mode_starts: "Starts with",
    mode_ends: "Ends with", mode_contains: "Contains", mode_pattern: "Pattern",
    hint_all: "Order does not matter. A letter typed twice must appear twice in the word.",
    hint_only: "Every consonant in the word comes from this set. Vowels and tone marks are free.",
    hint_rhymes: "Words whose last syllable has the same vowel and final sound, like รัก and หนัก. Read from the spelling, so some irregular words come out wrong.",
    hint_starts: "Words that start with this text.",
    hint_ends: "Words that end with this text.",
    hint_contains: "Words with this text anywhere inside.",
    hint_pattern: "? is one character · * is any number of characters, e.g. ก?ร or *ภาพ",
    len: "Length", min: "min", max: "max", sort: "Sort",
    sort_familiar: "Most familiar", sort_long: "Longest first", sort_short: "Shortest first", sort_az: "ก–ฮ",
    view_list: "List", view_families: "Families", kbd: "Thai letters",
    common: "Hide rare words", common_tip: "Only words that show up often enough in real text. Some real but uncommon words are hidden too.",
    key_back: "Delete", key_clear: "Clear",
    loading: "Loading the word list…",
    load_fail: "Could not load the word list. Try refreshing the page.",
    count: "{n} words", none: "No words match",
    none_tip: "Try fewer letters, remove the length limit, or stop hiding rare words.",
    idle: "Try one of these",
    random: "Random", copy_all: "Copy all", share: "Copy link",
    random_count: "{n} random words",
    legend: "Lighter = less common · tap a word to copy it and look it up",
    more: "Show {n} more",
    fam_note: "Grouping the first {n} words only", fam_other: "Other", fam_play: "Continues from the previous group",
    copied: "Copied “{w}”", meaning: "Meaning",
    copied_n: "Copied {n} words", copied_link: "Link copied", copy_fail: "This browser blocked copying",
    chars: "{n} characters", freq: ["rare", "uncommon", "common", "very common"],
    to_dark: "Switch to dark mode", to_light: "Switch to light mode",
    a_lang: "Language", a_search: "Search", a_clear: "Clear search", a_modes: "Search mode",
    a_min: "Minimum length", a_max: "Maximum length", a_view: "View",
    how_title: "How it works",
    how_1_h: "Fast lookup",
    how_1: "Every letter has a ready-made list of the words that use it, so a search starts from the rarest letter instead of scanning everything. Most searches take a few milliseconds, and it all runs in your browser.",
    how_2_h: "Ranked by familiarity",
    how_2: "Scores come from how often a word appears in two Thai corpora (Thai National Corpus and Thai Textbook Corpus), weighted towards everyday language over news writing, so นักเรียน ranks above ดำเนินการ.",
    how_3_h: "Word families",
    how_3: "It looks for words hidden inside words, such as การเรียน = การ + เรียน, groups them under that stem, then moves to the next group from a piece it just showed, the way people chain words together.",
    how_4_h: "Rhymes",
    how_4: "Rules read the spelling of the last syllable and reduce it to a vowel and a final sound; words with the same sound rhyme, like ใจ ไป ภัย. There is no pronunciation dictionary, so some irregular spellings come out wrong.",
    dev_title: "For developers",
    dev_text: "There is a Python library with no dependencies. It uses the same word list and ranking as this page.",
    dev_cli: "Or from the command line",
    foot: 'Open source, MIT license · Word data from <a href="https://github.com/PyThaiNLP/pythainlp" target="_blank" rel="noopener">PyThaiNLP</a> (CC0)',
  },
};

const EXAMPLE = { all: "ก ร น", only: "ก ร น ม", rhymes: "รัก", starts: "นัก", ends: "ภาพ", contains: "เรียน", pattern: "ก?ร*" };
const TRIES = [["all", "ก ร น"], ["rhymes", "รัก"], ["only", "ก ร น ม"], ["starts", "นัก"], ["ends", "ภาพ"], ["contains", "รัก"], ["pattern", "ก?ร*"]];
const DICT_URL = "https://dict.longdo.com/search/";  // where "meaning" links go

let lang = "th";
function t(key, vars) {
  let s = TEXT[lang][key] ?? TEXT.th[key] ?? key;
  if (vars && typeof s === "string") for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
  return s;
}
const icon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/* ---------- state ---------- */
const state = { mode: "all", q: "", min: "", max: "", sort: "familiar", view: "list", common: false };
let found = [], shown = 0, randomMode = false, ready = false, failed = false;

function query() {
  const args = { minLen: +state.min || 0, maxLen: +state.max || 0, minFam: state.common ? COMMON : 0, sort: state.sort };
  if (state.mode === "all" || state.mode === "only") return { ...args, letters: state.q, match: state.mode };
  if (state.mode === "pattern") return { ...args, pattern: state.q.replace(/[^฀-๿?*_.]/g, "") };
  return { ...args, [state.mode]: state.q };
}
const hasQuery = () => /[฀-๿]/.test(state.q);

/* ---------- rendering ---------- */
// A Thai "cluster" is a base character plus the marks stacked on it; it is what a reader counts as one letter.
const MARK = /[ัิ-ฺ็-๎]/;
const width = (w) => [...w].filter((ch) => !MARK.test(ch)).length;

function level(w) {
  const f = L.fam.get(w) || 0;
  return f >= 8 ? 3 : f >= 5 ? 2 : f >= 2 ? 1 : 0;
}

function word(w) {
  const lv = level(w);
  return `<button type="button" class="w l${lv}${width(w) > 10 ? " wide" : ""}" data-w="${esc(w)}" ` +
    `title="${t("chars", { n: w.length })} · ${t("freq")[lv]}">${esc(w)}</button>`;
}

function visibleWords() {
  if (randomMode) return found;
  return state.view === "families" ? found.slice(0, FAMILY_CAP) : found.slice(0, shown);
}

function setCount(html) { $("#count").innerHTML = html; }

function run() {
  if (!ready) return;
  randomMode = false;
  $("#clear").hidden = !state.q;
  $("#slash").classList.toggle("on", !state.q);
  syncUrl();
  shown = 0;
  $("#results").innerHTML = "";
  if (!hasQuery()) {
    found = [];
    setCount("");
    $("#results").innerHTML = idle(false);
    return finish();
  }
  const t0 = performance.now();
  found = search(query());
  const ms = performance.now() - t0;
  if (!found.length) {
    setCount(t("none"));
    $("#results").innerHTML = idle(true);
    return finish();
  }
  setCount(t("count", { n: `<b>${fmt(found.length)}</b>` }) + `<span class="ms">${ms < 1 ? "<1" : ms.toFixed(0)} ms</span>`);
  render();
}

function render() {
  const box = $("#results");
  if (state.view === "families" && !randomMode) {
    const groups = families(found.slice(0, FAMILY_CAP));
    const fams = groups.filter((g) => g.stem && !(g.words.length === 1 && g.words[0] === g.stem));
    const singles = groups.filter((g) => !fams.includes(g)).flatMap((g) => g.words);
    box.innerHTML =
      (found.length > FAMILY_CAP ? `<p class="note">${t("fam_note", { n: FAMILY_CAP })}</p>` : "") +
      '<div class="fams">' +
      fams.map((g) => `<div class="fam"><div class="stem"${g.kind === "play" ? ` title="${t("fam_play")}"` : ""}>` +
        `${g.kind === "play" ? icon("turn") : ""}${esc(g.stem)}</div><div class="fam-words">${g.words.map(word).join("")}</div></div>`).join("") +
      (singles.length ? `<div class="fam"><div class="stem other">${t("fam_other")}</div><div class="fam-words">${singles.map(word).join("")}</div></div>` : "") +
      "</div>";
    return finish();
  }
  let list = box.querySelector(".words");
  if (!list) { box.innerHTML = '<div class="words"></div>'; list = box.firstChild; }
  const next = found.slice(shown, shown + PAGE);
  list.insertAdjacentHTML("beforeend", next.map(word).join(""));
  shown += next.length;
  finish();
}

function finish() {
  const any = found.length > 0;
  const left = !randomMode && state.view === "list" ? found.length - shown : 0;
  $("#more").hidden = left <= 0;
  if (left > 0) $("#more").textContent = t("more", { n: fmt(Math.min(left, PAGE)) });
  $("#legend").hidden = !any;
  $("#copy-all").hidden = !any;
}

function idle(none) {
  return `<div class="idle"><p>${none ? t("none_tip") : t("idle")}</p><div class="tries">` +
    TRIES.map(([m, q]) => `<button type="button" data-try-mode="${m}" data-try-q="${esc(q)}"><small>${t("mode_" + m)}</small><span>${esc(q)}</span></button>`).join("") +
    "</div></div>";
}

/* ---------- controls ---------- */
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".modes button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
  $("#hint").textContent = t("hint_" + mode);
  $("#q").placeholder = t("eg", { x: EXAMPLE[mode] });
  buildKeyboard();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
}

function buildKeyboard() {
  const extra = state.mode === "pattern" ? ["?", "*"] : [];
  $("#kbd").innerHTML = [...CONS, ...extra].map((c) => `<button type="button" data-key="${c}">${c}</button>`).join("") +
    `<button type="button" class="wide" data-key="back">${t("key_back")}</button>` +
    `<button type="button" class="wide" data-key="clear">${t("key_clear")}</button>`;
}

function applyText() {
  document.documentElement.lang = lang;
  const vars = { n: ready ? fmt(L.words.length) : "60,000+" };
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n, vars)));
  document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  setMode(state.mode);
  labelTheme();
  if (failed) setCount(t("load_fail"));
  else if (!ready) setCount(t("loading"));
  else if (randomMode) showRandom(found);
  else {
    const keep = shown;
    run();
    while (state.view === "list" && shown < Math.min(keep, found.length)) render();
  }
}

function setLang(next) {
  lang = TEXT[next] ? next : "th";
  try { localStorage.setItem("kham-lang", lang); } catch (_) { /* storage blocked */ }
  applyText();
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.mode !== "all") p.set("mode", state.mode);
  if (state.sort !== "familiar") p.set("sort", state.sort);
  if (state.view !== "list") p.set("view", state.view);
  if (state.min) p.set("min", state.min);
  if (state.max) p.set("max", state.max);
  if (state.common) p.set("common", "1");
  const s = p.toString();
  try { history.replaceState(null, "", s ? "?" + s : location.pathname); } catch (_) { /* file:// */ }
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.mode = MODES.includes(p.get("mode")) ? p.get("mode") : "all";
  state.q = p.get("q") || "";
  state.sort = ["familiar", "long", "short", "az"].includes(p.get("sort")) ? p.get("sort") : "familiar";
  setView(p.get("view") === "families" ? "families" : "list");
  state.min = p.get("min") || "";
  state.max = p.get("max") || "";
  state.common = p.get("common") === "1";
  $("#common").setAttribute("aria-pressed", String(state.common));
  $("#q").value = state.q;
  $("#sort").value = state.sort;
  $("#min").value = state.min;
  $("#max").value = state.max;
  return p.get("lang");
}

let toastTimer;
function toast(html, ms = 1800) {
  const el = $("#toast");
  el.innerHTML = html;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

async function copy(text, html, ms) {
  try { await navigator.clipboard.writeText(text); toast(html, ms); }
  catch (_) { toast(esc(t("copy_fail"))); }
}

function showRandom(words) {
  randomMode = true;
  found = words;
  shown = found.length;
  setCount(t("random_count", { n: `<b>${found.length}</b>` }));
  $("#results").innerHTML = `<div class="words">${found.map(word).join("")}</div>`;
  finish();
}

/* ---------- theme ---------- */
let savedTheme = null;
try { savedTheme = localStorage.getItem("kham-theme"); } catch (_) { /* storage blocked */ }
const isDark = () => document.documentElement.dataset.dark === "1";
function labelTheme() {
  const label = t(isDark() ? "to_light" : "to_dark");
  $("#theme").setAttribute("aria-label", label);
  $("#theme").title = label;
}
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme) root.dataset.theme = theme; else delete root.dataset.theme;
  const dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.dark = dark ? "1" : "0";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0f0f10" : "#ffffff";
  labelTheme();
}
applyTheme(savedTheme);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(savedTheme));

/* ---------- events ---------- */
let debounce;
function onInput() {
  state.q = $("#q").value;
  clearTimeout(debounce);
  debounce = setTimeout(run, 60);
}

function wire() {
  const q = $("#q");
  document.querySelectorAll(".repo-link").forEach((a) => (a.href = REPO));
  document.querySelectorAll(".repo-text").forEach((s) => (s.textContent = REPO));

  q.addEventListener("input", onInput);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && q.value) { q.value = ""; onInput(); }
  });
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); q.focus(); }
  });
  $("#clear").addEventListener("click", () => { q.value = ""; onInput(); q.focus(); });

  document.querySelector(".modes").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mode]");
    if (!b) return;
    setMode(b.dataset.mode);
    run();
    if (matchMedia("(pointer: fine)").matches) q.focus();
  });
  document.querySelector(".seg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-view]");
    if (!b) return;
    setView(b.dataset.view);
    run();
  });
  document.querySelector(".lang").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lang]");
    if (b) setLang(b.dataset.lang);
  });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; run(); });
  for (const id of ["min", "max"]) {
    $("#" + id).addEventListener("input", (e) => {
      state[id] = e.target.value;
      clearTimeout(debounce);
      debounce = setTimeout(run, 120);
    });
  }

  $("#common").addEventListener("click", (e) => {
    state.common = !state.common;
    e.currentTarget.setAttribute("aria-pressed", String(state.common));
    run();
  });
  $("#kbd-toggle").addEventListener("click", (e) => {
    const open = $("#kbd").hidden;
    $("#kbd").hidden = !open;
    e.currentTarget.setAttribute("aria-expanded", String(open));
  });
  $("#kbd").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-key]");
    if (!b) return;
    const k = b.dataset.key;
    const s = q.selectionStart ?? q.value.length, end = q.selectionEnd ?? s;
    if (k === "clear") q.value = "";
    else if (k === "back") {
      const from = s === end ? Math.max(0, s - 1) : s;
      q.value = q.value.slice(0, from) + q.value.slice(end);
      q.selectionStart = q.selectionEnd = from;
    } else {
      q.value = q.value.slice(0, s) + k + q.value.slice(end);
      q.selectionStart = q.selectionEnd = s + k.length;
    }
    onInput();
  });

  $("#results").addEventListener("click", (e) => {
    const tr = e.target.closest("button[data-try-mode]");
    if (tr) {
      setMode(tr.dataset.tryMode);
      q.value = state.q = tr.dataset.tryQ;
      run();
      return;
    }
    const b = e.target.closest(".w");
    if (!b) return;
    const w = b.dataset.w;
    copy(w, `<span>${esc(t("copied", { w }))}</span>` +
      `<a href="${DICT_URL}${encodeURIComponent(w)}" target="_blank" rel="noopener">${esc(t("meaning"))}${icon("ext")}</a>`, 5000);
  });
  $("#more").addEventListener("click", render);
  $("#share").addEventListener("click", () => copy(location.href, esc(t("copied_link"))));
  $("#copy-all").addEventListener("click", () => {
    const words = visibleWords();
    copy(words.join("\n"), esc(t("copied_n", { n: fmt(words.length) })));
  });
  $("#random").addEventListener("click", () => {
    if (!ready) return;
    const pool = L.words.filter((w) => (L.fam.get(w) || 0) >= 7 && w.length >= 3);
    const pick = new Set();
    while (pick.size < 24 && pick.size < pool.length) pick.add(pool[Math.floor(Math.random() * pool.length)]);
    showRandom([...pick]);
  });
  $("#theme").addEventListener("click", () => {
    savedTheme = isDark() ? "light" : "dark";
    try { localStorage.setItem("kham-theme", savedTheme); } catch (_) { /* storage blocked */ }
    applyTheme(savedTheme);
  });
}

async function init() {
  wire();
  const urlLang = readUrl();
  let savedLang = null;
  try { savedLang = localStorage.getItem("kham-lang"); } catch (_) { /* storage blocked */ }
  lang = TEXT[urlLang] ? urlLang : TEXT[savedLang] ? savedLang : (navigator.language || "th").toLowerCase().startsWith("th") ? "th" : "en";
  applyText();
  if (matchMedia("(pointer: fine)").matches && !state.q) $("#q").focus({ preventScroll: true });
  try {
    const res = await fetch("lexicon.tsv");
    if (!res.ok) throw new Error(res.status);
    loadLexicon(await res.text());
  } catch (err) {
    failed = true;
    setCount(t("load_fail"));
    return;
  }
  ready = true;
  applyText();
}

init();
