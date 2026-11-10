/* Kham — Thai word finder, browser version. Same lexicon and ranking as the Python package. */
"use strict";

// ↓ Put your repository URL here after you push to GitHub.
const REPO = "https://github.com/neptunenakub/kham";

const PAGE = 150;          // chips per "show more"
const FAMILY_CAP = 200;
const COMMON = 2;         // "hide rare words" keeps familiarity >= this (same as kham.COMMON in Python)   // the family view groups this many top results
const CONS = "กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";
const STOP = new Set(("ที่ ใน เป็น ให้ ได้ ว่า มี ของ และ กับ จะ ไป มา ก็ แต่ นี้ นั้น อยู่ แล้ว จาก ไม่ หรือ ถึง ซึ่ง โดย " +
  "เพื่อ ต้อง ด้วย อย่าง ขึ้น เมื่อ เพราะ ยัง คือ อีก แห่ง จึง เขา เรา ฉัน").split(" "));
const HEADS = new Set(("การ ความ นัก ผู้ คน น้ำ ข้าว รถ บ้าน ห้อง โรง ร้าน เครื่อง ลูก แม่ พ่อ หัว หน้า ตัว ใจ มือ ตา ปาก " +
  "ไม้ ดอก ผัก ผล ปลา ไก่ หมู นก ช่าง ทาง สวน ตลาด งาน เงิน ทอง ไฟ ฟ้า ดิน หิน ลม ฝน ขนม ชา นม ไข่ " +
  "เนื้อ ใบ ต้น ราก เสื้อ ชุด ชาว คำ เพลง หนัง สี เด็ก ครู หมอ วัน เวลา ยา น่า ขี้ เจ้า พระ นาย เรือ " +
  "ทะเล ประตู หลัง ข้าง กลาง รอง ถุง กล่อง ขวด จาน โต๊ะ เหล็ก ทำ กิน เล่น เรียน รัก ขาย ซื้อ เดิน " +
  "นอน ดู ฟัง พูด อ่าน เขียน ร้อง").split(" "));
const PART_MIN = 5.5, PLAY_MIN = 6.0;

const MODES = ["all", "only", "starts", "ends", "contains", "pattern"];

const $ = (s) => document.querySelector(s);
const isCons = (ch) => ch >= "ก" && ch <= "ฮ";
const isThai = (ch) => ch >= "฀" && ch <= "๿";
const thaiOnly = (s) => [...s].filter(isThai).join("");
const collator = new Intl.Collator("th");
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => n.toLocaleString("th-TH");

/* ---------- lexicon ---------- */
const L = { words: [], fam: new Map(), pieces: new Map(), common: new Set(), idx: new Map() };

function loadLexicon(text) {
  for (const line of text.split("\n")) {
    if (!line) continue;
    const [w, f, p, flags] = line.split("\t");
    if (f && f !== "-") { L.fam.set(w, +f); L.words.push(w); }
    if (p && p !== "-") L.pieces.set(w, +p);
    if (flags && flags.includes("c")) L.common.add(w);
  }
  L.words.forEach((w, i) => {
    for (const ch of new Set(w)) {
      let a = L.idx.get(ch);
      if (!a) L.idx.set(ch, (a = []));
      a.push(i);
    }
  });
}

const score = (w) => (L.fam.get(w) || 0) - 0.07 * w.length;

function countChars(s) {
  const c = new Map();
  for (const ch of s) c.set(ch, (c.get(ch) || 0) + 1);
  return c;
}

function compilePattern(p) {
  let src = "";
  for (const ch of p.trim()) {
    if ("?_.".includes(ch)) src += ".";
    else if (ch === "*") src += ".*";
    else if (ch.trim()) src += ch.replace(/[\\^$+.()|[\]{}]/g, "\\$&");
  }
  return new RegExp("^" + src + "$");
}

function search({ letters = "", match = "all", starts = "", ends = "", contains = "", pattern = "",
                  minLen = 0, maxLen = 0, minFam = 0, sort = "familiar" }) {
  [letters, starts, ends, contains] = [letters, starts, ends, contains].map(thaiOnly);
  const need = match === "all" ? countChars(letters) : new Map();
  const allowed = match === "only" ? new Set([...letters].filter(isCons)) : null;
  if (allowed && !allowed.size) return [];
  const rx = pattern.trim() ? compilePattern(pattern) : null;

  const anchors = [...need.keys(), ...contains.slice(0, 1), ...starts.slice(0, 1), ...ends.slice(-1)];
  let cands;
  if (anchors.length) {
    const rare = anchors.reduce((a, b) => ((L.idx.get(a) || []).length <= (L.idx.get(b) || []).length ? a : b));
    cands = (L.idx.get(rare) || []).map((i) => L.words[i]);
  } else cands = L.words;

  const out = [];
  outer: for (const w of cands) {
    const n = w.length;
    if ((minLen && n < minLen) || (maxLen && n > maxLen)) continue;
    if (minFam && (L.fam.get(w) || 0) < minFam) continue;
    if (starts && !w.startsWith(starts)) continue;
    if (ends && !w.endsWith(ends)) continue;
    if (contains && !w.includes(contains)) continue;
    if (need.size) {
      const have = countChars(w);
      for (const [ch, k] of need) if ((have.get(ch) || 0) < k) continue outer;
    }
    if (allowed) for (const ch of w) if (isCons(ch) && !allowed.has(ch)) continue outer;
    if (rx && !rx.test(w)) continue;
    out.push(w);
  }

  const fam = (w) => L.fam.get(w) || 0;
  const by = {
    familiar: (a, b) => score(b) - score(a) || collator.compare(a, b),
    long: (a, b) => b.length - a.length || fam(b) - fam(a) || collator.compare(a, b),
    short: (a, b) => a.length - b.length || fam(b) - fam(a) || collator.compare(a, b),
    az: (a, b) => collator.compare(a, b),
  };
  return out.sort(by[sort] || by.familiar);
}

/* ---------- word families (port of WordFinder.families) ---------- */
function syllableCut(w, k) {
  if (k <= 0 || k >= w.length) return false;
  const nxt = w[k], prev = w[k - 1];
  if (!((nxt >= "ก" && nxt <= "ฮ") || (nxt >= "เ" && nxt <= "ไ"))) return false;
  if (prev >= "เ" && prev <= "ไ") return false;
  if (("ีื".includes(prev) && "ยอ".includes(nxt)) || (prev === "ั" && nxt === "ว")) return false;
  return !(k + 1 < w.length && w[k + 1] === "์");
}

const partsCache = new Map();
function wordParts(w) {
  let got = partsCache.get(w);
  if (got) return got;
  const known = (r) => L.fam.has(r) || L.pieces.has(r);
  const startsWithWord = (r) => {
    for (let j = r.length; j > 1; j--) if ((j === r.length || syllableCut(r, j)) && known(r.slice(0, j))) return true;
    return false;
  };
  const front = [], back = [];
  for (let k = 2; k < w.length - 1; k++) {
    if (!syllableCut(w, k)) continue;
    const a = w.slice(0, k), b = w.slice(k);
    if ((L.pieces.get(a) || 0) >= PART_MIN && startsWithWord(b)) front.push(a);
    if ((L.pieces.get(b) || 0) >= PART_MIN) back.push(b);
  }
  partsCache.set(w, (got = [front, back]));
  return got;
}

function families(words, chain = 6) {
  words = [...new Set(words)];
  const pool = new Set(words), parts = new Map(), frontOf = new Map(), backOf = new Map();
  const add = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, (a = [])); a.push(v); };
  for (const w of words) {
    const [f, b] = wordParts(w);
    const front = f.filter((p) => !STOP.has(p)), back = b.filter((p) => !STOP.has(p));
    parts.set(w, [...front, ...back]);
    front.forEach((p) => add(frontOf, p, w));
    back.forEach((p) => add(backOf, p, w));
  }
  const fam = new Map(words.map((w) => [w, score(w)]));
  const byFam = (ws) => [...ws].sort((a, b) => fam.get(b) - fam.get(a) || collator.compare(a, b));
  const stems = [...new Set([...pool, ...frontOf.keys(), ...backOf.keys()])].sort(collator.compare);
  const lists = new Map(stems.map((s) => [s, [pool.has(s) ? [s] : [], byFam(frontOf.get(s) || []), byFam(backOf.get(s) || [])]]));
  const ptr = new Map(stems.map((s) => [s, [0, 0, 0]]));
  const bonus = new Map(stems.map((s) => [s, 0.5 * Math.min(L.pieces.get(s) ?? L.fam.get(s) ?? 0, 9) + (HEADS.has(s) ? 1.5 : 0)]));
  const used = new Set(), visits = new Map();

  const heads = (s) => {
    const out = [], l = lists.get(s), p = ptr.get(s);
    for (let i = 0; i < 3; i++) {
      while (p[i] < l[i].length && used.has(l[i][p[i]])) p[i]++;
      if (p[i] < l[i].length) out.push(l[i][p[i]]);
    }
    return out;
  };
  const stemScore = (s) => {
    const h = heads(s);
    return h.length ? bonus.get(s) + Math.max(...h.map((w) => fam.get(w))) - 1.5 * (visits.get(s) || 0) : null;
  };
  const bestHead = (s) => {
    const h = heads(s);
    return h.length ? Math.max(...h.map((w) => fam.get(w))) : null;
  };
  const take = (s, k) => {
    const got = [];
    let base = null;
    for (const lst of lists.get(s)) for (const w of lst) {
      if (got.length === k) return got;
      if (used.has(w)) continue;
      if (base !== null && fam.get(w) < base - 3.5) return got;
      if (w !== s && base === null) base = fam.get(w);
      used.add(w);
      got.push(w);
    }
    return got;
  };

  const groups = [];
  let last = [], cur = null, plays = 0;
  while (used.size < pool.size) {
    let stem = null, kind = "new";
    if (last.length && plays < 2) {
      let best = null, bestSc = -Infinity;
      for (const w of [...last].reverse()) for (const p of [...parts.get(w), w]) {
        if (p === cur || STOP.has(p) || (bestHead(p) || 0) < PLAY_MIN) continue;
        const sc = stemScore(p);
        if (sc > bestSc) { best = p; bestSc = sc; }
      }
      if (best !== null) { stem = best; kind = "play"; }
    }
    if (stem === null) {
      let bestSc = -Infinity;
      for (const s of stems) {
        const sc = stemScore(s);
        if (sc !== null && sc > bestSc) { stem = s; bestSc = sc; }
      }
    }
    if (stem === null) break;
    const got = take(stem, kind === "play" ? Math.max(2, chain - 2) : chain);
    visits.set(stem, (visits.get(stem) || 0) + 1);
    plays = kind === "play" ? plays + 1 : 0;
    groups.push({ stem, kind, words: got });
    last = got; cur = stem;
  }
  const rest = words.filter((w) => !used.has(w));
  if (rest.length) groups.push({ stem: "", kind: "new", words: rest });
  return groups;
}


/* ---------- interface text, Thai and English ---------- */
const TEXT = {
  th: {
    h1: "หาคำไทยจากตัวอักษรที่มี",
    sub: "พิมพ์ตัวอักษร แล้วดูว่าประกอบเป็นคำอะไรได้บ้าง จากคลัง {n} คำ",
    eg: "เช่น {x}",
    mode_all: "มีตัวอักษรครบ", mode_only: "ใช้แค่ตัวเหล่านี้", mode_starts: "ขึ้นต้นด้วย",
    mode_ends: "ลงท้ายด้วย", mode_contains: "มีคำว่า", mode_pattern: "แพทเทิร์น",
    hint_all: "ลำดับไม่สำคัญ ถ้าพิมพ์ตัวซ้ำ คำนั้นต้องมีตัวนั้นซ้ำด้วย",
    hint_only: "พยัญชนะทุกตัวในคำต้องมาจากชุดนี้ สระและวรรณยุกต์ใช้ได้อิสระ",
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
    dev_title: "สำหรับนักพัฒนา",
    dev_text: "มีไลบรารี Python ที่ไม่ต้องติดตั้งอะไรเพิ่ม ใช้คลังคำและวิธีจัดอันดับชุดเดียวกับหน้านี้",
    dev_cli: "หรือใช้จาก command line",
    foot: 'โอเพนซอร์ส สัญญาอนุญาต MIT · คลังคำจาก <a href="https://github.com/PyThaiNLP/pythainlp" target="_blank" rel="noopener">PyThaiNLP</a> (CC0)',
  },
  en: {
    h1: "Find Thai words from the letters you have",
    sub: "Type some letters and see which words they make, out of {n} words",
    eg: "e.g. {x}",
    mode_all: "Has all letters", mode_only: "Only these letters", mode_starts: "Starts with",
    mode_ends: "Ends with", mode_contains: "Contains", mode_pattern: "Pattern",
    hint_all: "Order does not matter. A letter typed twice must appear twice in the word.",
    hint_only: "Every consonant in the word comes from this set. Vowels and tone marks are free.",
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
    dev_title: "For developers",
    dev_text: "There is a Python library with no dependencies. It uses the same word list and ranking as this page.",
    dev_cli: "Or from the command line",
    foot: 'Open source, MIT license · Word data from <a href="https://github.com/PyThaiNLP/pythainlp" target="_blank" rel="noopener">PyThaiNLP</a> (CC0)',
  },
};

const EXAMPLE = { all: "ก ร น", only: "ก ร น ม", starts: "นัก", ends: "ภาพ", contains: "เรียน", pattern: "ก?ร*" };
const TRIES = [["all", "ก ร น"], ["only", "ก ร น ม"], ["starts", "นัก"], ["ends", "ภาพ"], ["contains", "รัก"], ["pattern", "ก?ร*"]];
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

// the engine is open for anyone poking around in the console
window.kham = { search, families, lexicon: L };
