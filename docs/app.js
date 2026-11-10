/* Kham — Thai word finder, browser version. Same lexicon and ranking as the Python package. */
"use strict";

// ↓ Put your repository URL here after you push to GitHub.
const REPO = "https://github.com/your-username/kham";

const PAGE = 150;          // chips per "show more"
const FAMILY_CAP = 200;   // the family view groups this many top results
const CONS = "กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";
const STOP = new Set(("ที่ ใน เป็น ให้ ได้ ว่า มี ของ และ กับ จะ ไป มา ก็ แต่ นี้ นั้น อยู่ แล้ว จาก ไม่ หรือ ถึง ซึ่ง โดย " +
  "เพื่อ ต้อง ด้วย อย่าง ขึ้น เมื่อ เพราะ ยัง คือ อีก แห่ง จึง เขา เรา ฉัน").split(" "));
const HEADS = new Set(("การ ความ นัก ผู้ คน น้ำ ข้าว รถ บ้าน ห้อง โรง ร้าน เครื่อง ลูก แม่ พ่อ หัว หน้า ตัว ใจ มือ ตา ปาก " +
  "ไม้ ดอก ผัก ผล ปลา ไก่ หมู นก ช่าง ทาง สวน ตลาด งาน เงิน ทอง ไฟ ฟ้า ดิน หิน ลม ฝน ขนม ชา นม ไข่ " +
  "เนื้อ ใบ ต้น ราก เสื้อ ชุด ชาว คำ เพลง หนัง สี เด็ก ครู หมอ วัน เวลา ยา น่า ขี้ เจ้า พระ นาย เรือ " +
  "ทะเล ประตู หลัง ข้าง กลาง รอง ถุง กล่อง ขวด จาน โต๊ะ เหล็ก ทำ กิน เล่น เรียน รัก ขาย ซื้อ เดิน " +
  "นอน ดู ฟัง พูด อ่าน เขียน ร้อง").split(" "));
const PART_MIN = 5.5, PLAY_MIN = 6.0;

const MODES = {
  all:      { hint: "พิมพ์ตัวอักษรไทยกี่ตัวก็ได้ ลำดับไม่สำคัญ ตัวซ้ำต้องมีซ้ำในคำด้วย", ph: "ก ร น", tiles: true },
  only:     { hint: "คำที่พยัญชนะทุกตัวมาจากชุดนี้เท่านั้น (สระ วรรณยุกต์ ใช้ได้อิสระ)", ph: "ก ร น ม", tiles: true },
  starts:   { hint: "คำที่ขึ้นต้นด้วยข้อความนี้", ph: "นัก" },
  ends:     { hint: "คำที่ลงท้ายด้วยข้อความนี้", ph: "ภาพ" },
  contains: { hint: "คำที่มีข้อความนี้อยู่ตรงไหนก็ได้", ph: "เรียน" },
  pattern:  { hint: "? = ตัวอักษร 1 ตัว · * = กี่ตัวก็ได้   เช่น ก?ร  หรือ  *ภาพ", ph: "ก?ร*" },
};

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
                  minLen = 0, maxLen = 0, sort = "familiar" }) {
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

/* ---------- rendering helpers ---------- */
// A Thai "cluster": a base character plus the vowel / tone marks stacked on it, so highlights never split them.
const MARK = /[ัิ-ฺ็-๎]/;
function clusters(w) {
  const out = [];
  for (const ch of w) {
    if (out.length && MARK.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

function highlight(w) {
  const cl = clusters(w);
  const on = new Array(cl.length).fill(false);
  if (state.mode === "all" || state.mode === "only") {
    const q = thaiOnly(state.q);
    const left = state.mode === "all" ? countChars(q) : null;
    const allowed = new Set(q);
    cl.forEach((c, i) => {
      for (const ch of c) {
        if (left ? (left.get(ch) || 0) > 0 : isCons(ch) && allowed.has(ch)) {
          on[i] = true;
          if (left) left.set(ch, left.get(ch) - 1);
        }
      }
    });
  } else if (["starts", "ends", "contains"].includes(state.mode)) {
    const q = thaiOnly(state.q);
    const at = state.mode === "starts" ? 0 : state.mode === "ends" ? w.length - q.length : w.indexOf(q);
    if (q && at >= 0) {
      let pos = 0;
      cl.forEach((c, i) => {
        if (pos < at + q.length && pos + c.length > at) on[i] = true;
        pos += c.length;
      });
    }
  }
  let html = "", open = false;
  cl.forEach((c, i) => {
    if (on[i] && !open) { html += '<span class="hl">'; open = true; }
    if (!on[i] && open) { html += "</span>"; open = false; }
    html += esc(c);
  });
  return html + (open ? "</span>" : "");
}

function level(w) {
  const f = L.fam.get(w) || 0;
  return f >= 8 ? 3 : f >= 5 ? 2 : f >= 2 ? 1 : 0;
}
const LEVEL_TEXT = ["ไม่ค่อยพบ", "พบบ้าง", "พบบ่อย", "คุ้นมาก"];

function chip(w) {
  const lv = level(w);
  return `<button class="chip${L.common.has(w) ? " c" : ""}" data-w="${esc(w)}" title="${esc(w)} · ${w.length} ตัวอักษร · ${LEVEL_TEXT[lv]} · คลิกเพื่อคัดลอก">` +
    `<span>${highlight(w)}</span><span class="meter" data-l="${lv}" aria-hidden="true"><i></i><i></i><i></i></span></button>`;
}

/* ---------- state + UI ---------- */
const state = { mode: "all", q: "", min: "", max: "", sort: "familiar", view: "list" };
let found = [], shown = 0, randomMode = false, ready = false;

function query() {
  const q = state.q;
  const args = { minLen: +state.min || 0, maxLen: +state.max || 0, sort: state.sort };
  switch (state.mode) {
    case "all": case "only": return { ...args, letters: q, match: state.mode };
    case "pattern": return { ...args, pattern: q.replace(/[^฀-๿?*_.]/g, "") };
    default: return { ...args, [state.mode]: q };
  }
}

function hasQuery() {
  return state.mode === "pattern" ? /[฀-๿?*_.]/.test(state.q) && /[฀-๿]/.test(state.q) : thaiOnly(state.q).length > 0;
}

function run() {
  if (!ready) return;
  randomMode = false;
  renderTiles();
  $("#clear").hidden = !state.q;
  if (!hasQuery()) {
    found = [];
    $("#count").innerHTML = `คลังคำ <b>${fmt(L.words.length)}</b> คำ พร้อมใช้งาน`;
    $("#results").innerHTML = emptyState();
    $("#more").hidden = true;
    syncUrl();
    return;
  }
  const t = performance.now();
  found = search(query());
  const ms = performance.now() - t;
  $("#count").innerHTML = found.length
    ? `พบ <b>${fmt(found.length)}</b> คำ<span class="ms">${ms < 1 ? "<1" : ms.toFixed(1)} ms</span>`
    : "ไม่พบคำที่ตรงเงื่อนไข";
  shown = 0;
  $("#results").innerHTML = "";
  if (!found.length) $("#results").innerHTML = emptyState(true);
  else render();
  syncUrl();
}

function render() {
  const box = $("#results");
  if (state.view === "families" && !randomMode) {
    const top = found.slice(0, FAMILY_CAP);
    const groups = families(top);
    const cards = groups.filter((g) => !(g.words.length === 1 && g.words[0] === g.stem) && g.stem);
    const singles = groups.filter((g) => !cards.includes(g)).flatMap((g) => g.words);
    box.innerHTML =
      (found.length > FAMILY_CAP ? `<p class="fam-note">จัดกลุ่ม ${FAMILY_CAP} คำแรกตามลำดับที่เลือก</p>` : "") +
      `<div class="fam-grid">${cards.map((g) => `<article class="fam"><div class="fam-head"><span class="fam-stem">${esc(g.stem)}</span>` +
        `<span class="badge${g.kind === "play" ? " play" : ""}">${g.kind === "play" ? "↪ ต่อจากคำก่อน" : `${g.words.length} คำ`}</span></div>` +
        `<div class="chips">${g.words.map(chip).join("")}</div></article>`).join("")}</div>` +
      (singles.length ? `<div class="singles"><h3>คำเดี่ยว ${fmt(singles.length)} คำ</h3><div class="chips">${singles.map(chip).join("")}</div></div>` : "");
    $("#more").hidden = true;
    return;
  }
  let list = box.querySelector(".chips");
  if (!list) { box.innerHTML = '<div class="chips"></div>'; list = box.querySelector(".chips"); }
  const next = found.slice(shown, shown + PAGE);
  list.insertAdjacentHTML("beforeend", next.map(chip).join(""));
  shown += next.length;
  const left = found.length - shown;
  $("#more").hidden = left <= 0;
  $("#more").textContent = `แสดงเพิ่ม (${fmt(Math.min(left, PAGE))} จาก ${fmt(left)} คำที่เหลือ)`;
}

const EXAMPLES = [["all", "ก ร น"], ["all", "ม ม"], ["only", "ก ร น ม"], ["starts", "นัก"], ["ends", "ภาพ"], ["contains", "รัก"], ["pattern", "ก?ร*"]];
const MODE_LABEL = { all: "มีครบ", only: "ใช้แค่", starts: "ขึ้นต้น", ends: "ลงท้าย", contains: "มีคำว่า", pattern: "แพทเทิร์น" };
function emptyState(none) {
  return `<div class="empty"><h3>${none ? "ลองลดเงื่อนไขดูครับ" : "เริ่มจากพิมพ์ตัวอักษรด้านบน"}</h3>` +
    `<p>${none ? "เช่น ใช้ตัวอักษรน้อยลง หรือเอาความยาวออก" : "หรือกดลองตัวอย่างพวกนี้"}</p><div class="examples">` +
    EXAMPLES.map(([m, q]) => `<button type="button" data-ex-mode="${m}" data-ex-q="${esc(q)}">${MODE_LABEL[m]} · ${esc(q)}</button>`).join("") +
    "</div></div>";
}

function renderTiles() {
  const box = $("#tiles");
  if (!MODES[state.mode].tiles) { box.innerHTML = ""; return; }
  const letters = [...thaiOnly(state.q)];
  const prev = [...box.children].map((s) => s.textContent);
  if (prev.join("") === letters.join("")) return;
  box.innerHTML = letters.map((ch) => `<span>${esc(ch)}</span>`).join("");
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".modes button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
  $("#hint").textContent = MODES[mode].hint;
  $("#q").placeholder = MODES[mode].ph;
  buildKeyboard();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
}

function buildKeyboard() {
  const extra = state.mode === "pattern" ? ["?", "*"] : [];
  $("#kbd").innerHTML = [...CONS, ...extra].map((c) => `<button type="button" data-key="${c}">${c}</button>`).join("") +
    '<button type="button" class="wide" data-key="back" aria-label="ลบ">⌫ ลบ</button>' +
    '<button type="button" class="wide" data-key="clear">ล้าง</button>';
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.mode !== "all") p.set("mode", state.mode);
  if (state.sort !== "familiar") p.set("sort", state.sort);
  if (state.view !== "list") p.set("view", state.view);
  if (state.min) p.set("min", state.min);
  if (state.max) p.set("max", state.max);
  const s = p.toString();
  try { history.replaceState(null, "", s ? "?" + s : location.pathname); } catch (_) { /* file:// */ }
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  const mode = p.get("mode");
  setMode(MODES[mode] ? mode : "all");
  state.q = p.get("q") || "";
  state.sort = ["familiar", "long", "short", "az"].includes(p.get("sort")) ? p.get("sort") : "familiar";
  setView(p.get("view") === "families" ? "families" : "list");
  state.min = p.get("min") || "";
  state.max = p.get("max") || "";
  $("#q").value = state.q;
  $("#sort").value = state.sort;
  $("#min").value = state.min;
  $("#max").value = state.max;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
}

async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch (_) { toast("คัดลอกไม่ได้ในเบราว์เซอร์นี้"); }
}

/* ---------- theme ---------- */
function applyTheme(t) {
  const root = document.documentElement;
  if (t) root.dataset.theme = t; else delete root.dataset.theme;
  const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.dark = dark ? "1" : "0";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#141310" : "#f6f2ea";
}
let savedTheme = null;
try { savedTheme = localStorage.getItem("kham-theme"); } catch (_) { /* storage blocked */ }
applyTheme(savedTheme);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(savedTheme));

/* ---------- events ---------- */
let debounce;
function onInput() {
  state.q = $("#q").value;
  clearTimeout(debounce);
  debounce = setTimeout(run, 60);
}

function insertAtCursor(text) {
  const el = $("#q");
  const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, s) + text + el.value.slice(e);
  el.selectionStart = el.selectionEnd = s + text.length;
  onInput();
}

function wire() {
  document.querySelectorAll(".repo-link").forEach((a) => (a.href = REPO));
  document.querySelectorAll(".repo-text").forEach((s) => (s.textContent = REPO));

  $("#q").addEventListener("input", onInput);
  $("#clear").addEventListener("click", () => { $("#q").value = ""; onInput(); $("#q").focus(); });
  document.querySelector(".modes").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mode]");
    if (!b) return;
    setMode(b.dataset.mode);
    run();
    $("#q").focus();
  });
  document.querySelector(".seg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-view]");
    if (!b) return;
    setView(b.dataset.view);
    if (randomMode) return;
    shown = 0;
    $("#results").innerHTML = "";
    if (found.length) render(); else run();
    syncUrl();
  });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; run(); });
  for (const id of ["min", "max"]) {
    $("#" + id).addEventListener("input", (e) => {
      state[id] = e.target.value;
      clearTimeout(debounce);
      debounce = setTimeout(run, 120);
    });
  }
  $("#kbd").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-key]");
    if (!b) return;
    const k = b.dataset.key, el = $("#q");
    if (k === "clear") { el.value = ""; onInput(); }
    else if (k === "back") {
      const s = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? s;
      if (s !== end) { el.value = el.value.slice(0, s) + el.value.slice(end); el.selectionStart = el.selectionEnd = s; }
      else if (s > 0) { el.value = el.value.slice(0, s - 1) + el.value.slice(s); el.selectionStart = el.selectionEnd = s - 1; }
      onInput();
    } else insertAtCursor(k);
  });
  $("#results").addEventListener("click", (e) => {
    const ex = e.target.closest("button[data-ex-mode]");
    if (ex) {
      setMode(ex.dataset.exMode);
      $("#q").value = state.q = ex.dataset.exQ;
      run();
      return;
    }
    const c = e.target.closest(".chip");
    if (c) copy(c.dataset.w, `คัดลอก “${c.dataset.w}” แล้ว`);
  });
  $("#more").addEventListener("click", render);
  $("#share").addEventListener("click", () => copy(location.href, "คัดลอกลิงก์ผลค้นหาแล้ว"));
  $("#random").addEventListener("click", () => {
    if (!ready) return;
    const pool = L.words.filter((w) => (L.fam.get(w) || 0) >= 7 && w.length >= 3);
    const pick = new Set();
    while (pick.size < 24 && pick.size < pool.length) pick.add(pool[Math.floor(Math.random() * pool.length)]);
    randomMode = true;
    found = [...pick];
    shown = 0;
    $("#results").innerHTML = "";
    $("#count").innerHTML = `สุ่มคำที่คนคุ้น <b>${found.length}</b> คำ`;
    const saved = state.mode;
    state.mode = "random";  // no highlighting for random picks
    render();
    state.mode = saved;
  });
  $("#theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.dark === "1";
    savedTheme = dark ? "light" : "dark";
    try { localStorage.setItem("kham-theme", savedTheme); } catch (_) { /* storage blocked */ }
    applyTheme(savedTheme);
  });
  document.querySelectorAll(".code-tabs button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".code-tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    document.querySelectorAll(".code-block").forEach((pre) => (pre.hidden = pre.dataset.code !== b.dataset.code));
  }));
  $("#copy-code").addEventListener("click", () => {
    const pre = [...document.querySelectorAll(".code-block")].find((p) => !p.hidden);
    copy(pre.textContent, "คัดลอกโค้ดแล้ว");
  });
  window.addEventListener("scroll", () => document.querySelector(".top").classList.toggle("scrolled", scrollY > 8), { passive: true });
}

async function init() {
  wire();
  readUrl();
  $("#results").innerHTML = '<div class="skeleton">' + "<span></span>".repeat(18) + "</div>";
  try {
    const res = await fetch("lexicon.tsv");
    if (!res.ok) throw new Error(res.status);
    loadLexicon(await res.text());
  } catch (err) {
    $("#count").textContent = "โหลดคลังคำไม่สำเร็จ — ถ้าเปิดไฟล์ตรง ๆ ให้รันผ่านเว็บเซิร์ฟเวอร์ (ดู README)";
    $("#results").innerHTML = "";
    return;
  }
  ready = true;
  $("#stat-words").textContent = fmt(L.words.length);
  run();
}

init();

// expose the engine for anyone poking around in the console
window.kham = { search, families, lexicon: L };
