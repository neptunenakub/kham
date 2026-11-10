/* Kham: Thai word finder engine for the browser and Node. No dependencies, no DOM.
 *
 *   Kham.load(text)                      text of lexicon.tsv
 *   Kham.search({ letters: "กรน" })      also: match, starts, ends, contains, pattern, rhymes,
 *                                        minLen, maxLen, minFam, sort
 *   Kham.families(words)                 group words into word families
 *   Kham.rhymeKey("รัก")                 "a:k"
 *
 * Same lexicon, ranking and rules as the Python package; tests/parity.mjs keeps the two in step.
 */
(function (root) {
"use strict";

const COMMON = 2;  // minFam that hides rare words (kham.COMMON in Python)
const CONS = "กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";
const STOP = new Set(("ที่ ใน เป็น ให้ ได้ ว่า มี ของ และ กับ จะ ไป มา ก็ แต่ นี้ นั้น อยู่ แล้ว จาก ไม่ หรือ ถึง ซึ่ง โดย " +
  "เพื่อ ต้อง ด้วย อย่าง ขึ้น เมื่อ เพราะ ยัง คือ อีก แห่ง จึง เขา เรา ฉัน").split(" "));
const HEADS = new Set(("การ ความ นัก ผู้ คน น้ำ ข้าว รถ บ้าน ห้อง โรง ร้าน เครื่อง ลูก แม่ พ่อ หัว หน้า ตัว ใจ มือ ตา ปาก " +
  "ไม้ ดอก ผัก ผล ปลา ไก่ หมู นก ช่าง ทาง สวน ตลาด งาน เงิน ทอง ไฟ ฟ้า ดิน หิน ลม ฝน ขนม ชา นม ไข่ " +
  "เนื้อ ใบ ต้น ราก เสื้อ ชุด ชาว คำ เพลง หนัง สี เด็ก ครู หมอ วัน เวลา ยา น่า ขี้ เจ้า พระ นาย เรือ " +
  "ทะเล ประตู หลัง ข้าง กลาง รอง ถุง กล่อง ขวด จาน โต๊ะ เหล็ก ทำ กิน เล่น เรียน รัก ขาย ซื้อ เดิน " +
  "นอน ดู ฟัง พูด อ่าน เขียน ร้อง").split(" "));
const PART_MIN = 5.5, PLAY_MIN = 6.0;
// grammar words rank lower in rhyme results (same list as kham/thai.py)
const GRAMMAR = new Set([...STOP, ...("กัน มัน อัน นั่น นั้น นี่ นี้ โน่น นู่น ดังนั้น เท่านั้น ทั้งนั้น ฉะนั้น อะไร ทำไม อย่างไร ยังไง ใคร ใด ไหน ที่ไหน เมื่อไร เมื่อไหร่ เท่าไร เท่าไหร่ ไว้ ทำให้ ต่อไป แก่ แด่ ต่อ ถ้า หาก แม้ นอก บน ล่าง ตาม กว่า เคย ควร อาจ คง น่า เลย นะ ครับ ค่ะ คะ จ้ะ จ๊ะ สิ ซิ ล่ะ เถอะ หรอก เหรอ ไหม มั้ย หนึ่ง ทั้ง ทุก บาง หลาย ต่าง เอง ดัง เช่น จน จนถึง หมายถึง กล่าวถึง พูดถึง นึกถึง เกี่ยวกับ สำหรับ ระหว่าง เนื่องจาก อย่างนั้น อย่างนี้ แบบนั้น แบบนี้ ดังกล่าว ซึ่งกัน ด้วยกัน เดียวกัน เหมือนกัน ทั้งหลาย ทั้งหมด").split(" ")]);
const GRAMMAR_PENALTY = 3;


const isCons = (ch) => ch >= "ก" && ch <= "ฮ";
const isThai = (ch) => ch >= "฀" && ch <= "๿";
const thaiOnly = (s) => [...s].filter(isThai).join("");
const collator = new Intl.Collator("th");

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

function search({ letters = "", match = "all", starts = "", ends = "", contains = "", pattern = "", rhymes = "",
                  minLen = 0, maxLen = 0, minFam = 0, sort = "familiar" }) {
  const given = [letters, starts, ends, contains, rhymes];
  [letters, starts, ends, contains, rhymes] = given.map(thaiOnly);
  // a filter with no Thai in it matches nothing, not everything
  if (given.some((g, i) => g.trim() && !thaiOnly(g))) return [];
  const sound = rhymes ? rhymeKey(rhymes) : "";
  if (rhymes && !sound) return [];
  const same = sound ? lastSyllable(rhymes) : "";
  const need = match === "all" ? countChars(letters) : new Map();
  const allowed = match === "only" ? new Set([...letters].filter(isCons)) : null;
  if (allowed && !allowed.size) return [];
  const rx = pattern.trim() ? compilePattern(pattern) : null;

  const anchors = [...need.keys(), ...contains.slice(0, 1), ...starts.slice(0, 1), ...ends.slice(-1)];
  let cands;
  if (sound) cands = byRhyme().get(sound) || [];
  else if (anchors.length) {
    const rare = anchors.reduce((a, b) => ((L.idx.get(a) || []).length <= (L.idx.get(b) || []).length ? a : b));
    cands = (L.idx.get(rare) || []).map((i) => L.words[i]);
  } else cands = L.words;

  const out = [];
  outer: for (const w of cands) {
    const n = w.length;
    if ((minLen && n < minLen) || (maxLen && n > maxLen)) continue;
    if (minFam && (L.fam.get(w) || 0) < minFam) continue;
    if (sound && w.endsWith(same)) continue;  // the same syllable again is not a rhyme (หัวใจ / ดีใจ)
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
    familiar: sound
      ? (a, b) => (score(b) - (GRAMMAR.has(b) ? GRAMMAR_PENALTY : 0)) - (score(a) - (GRAMMAR.has(a) ? GRAMMAR_PENALTY : 0)) || collator.compare(a, b)
      : (a, b) => score(b) - score(a) || collator.compare(a, b),
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

/* ---------- rhymes (port of kham/rhyme.py; tests/parity.mjs checks they agree on every word) ---------- */
const CONS_SET = new Set(CONS), LEAD_SET = new Set("เแโไใ");
const FINAL = {};
for (const [chars, sound] of [["กขคฆ", "k"], ["ดตจชซสศษฎฏฐฑฒถทธฌ", "t"], ["บปพฟภ", "p"], ["ง", "ng"],
                              ["นณญรลฬ", "n"], ["ม", "m"], ["ย", "y"], ["ว", "w"]]) {
  for (const ch of chars) FINAL[ch] = sound;
}
// spellings whose written tail is not what is said (no lookbehind: older Safari cannot parse it)
const RHYME_FIXES = [
  [/ฤๅ/g, "รือ"],
  [/ฤ(?=ก)/g, "รึ"],
  [/ฤ/g, "ริ"],
  [/ริย์$/, ""],
  [/(^|[^เแโไใ])[ตทด]ร์$/, "$1"],
  [/[ก-ฮ][ิุ]?์/g, ""],
  [/เกียรติ$/, "เกียต"],
  [/ารถ$/, "าถ"],
  [/พรรดิ$/, "พรรด"],
  [/ภูมิ$/, "ภูม"],
  [/([าั])ติ$/, "$1ต"],
  [/าตุ$/, "าต"],
  [/(เ[ก-ฮ])ตุ$/, "$1ต"],
  [/([าิีุู]ต)ร$/, "$1"],
  [/มุทร$/, "มุท"],
  [/(เ[ก-ฮ][ตช])ร$/, "$1"],
  [/(เ[ก-ฮ][ก-ฮ][ตช])ร$/, "$1"],
  [/ญจ$/, "ญ"],
  [/(ั[ก-ฮ])[ก-ฮ]$/, "$1"],
];

function isCluster(a, b) {
  return ("กขคตปผพบดฟทสศ".includes(a) && "รล".includes(b)) || ("กขค".includes(a) && b === "ว") ||
    (a === "ห" && "งญนมยรลว".includes(b)) || (a === "อ" && b === "ย");
}

/** The rhyming sound of a word's last syllable as "vowel:final" (รัก -> "a:k"), or "" if unreadable. */
function rhymeKey(word) {
  let s = word.replace(/[่้๊๋]/g, "");
  for (const [rx, to] of RHYME_FIXES) s = s.replace(rx, to);
  const n = s.length;
  if (!n) return "";
  const C = (ch) => CONS_SET.has(ch), LV = (ch) => LEAD_SET.has(ch);
  const lead = (j) => {
    if (j >= 2 && LV(s[j - 2])) return s[j - 2];
    if (j >= 3 && LV(s[j - 3]) && C(s[j - 2])) return s[j - 3];
    return "";
  };
  const last = s[n - 1], prev = n >= 2 ? s[n - 2] : "", prev2 = n >= 3 ? s[n - 3] : "", prev3 = n >= 4 ? s[n - 4] : "";
  const OPEN = { "เ": "ee:", "แ": "aae:", "โ": "oo:" };

  if (last === "ำ") return "a:m";
  if (last === "ะ") {
    if (prev === "า") return lead(n - 2) === "เ" ? "or:" : "a:";
    if (prev === "อ" && lead(n - 2) === "เ") return "er:";
    if (prev === "ย" && prev2 === "ี") return "ia:";
    if (prev === "ว" && prev2 === "ั") return "ua:";
    let v = C(prev) ? prev2 : "";
    if (n >= 4 && C(prev2) && isCluster(prev2, prev)) v = prev3;
    return { "เ": "e:", "แ": "ae:", "โ": "o:" }[v] || "a:";
  }
  if (last === "า") {
    const j = n - 1;
    if ((j >= 2 && s[j - 2] === "เ") || (j >= 3 && s[j - 3] === "เ" && isCluster(s[j - 2], s[j - 1]))) return "a:w";
    return "aa:";
  }
  const MARK_KEY = { "ิ": "i:", "ี": "ii:", "ึ": "ue:", "ื": "uue:", "ุ": "u:", "ู": "uu:" };
  if (MARK_KEY[last]) return MARK_KEY[last];
  if (last === "็") return "or:";
  if (!C(last)) return "";

  const f = FINAL[last] || "";
  if (n === 1) return "oor:";
  const tail = s.slice(-3, -1);
  if (tail.includes("ไ") || tail.includes("ใ")) return "a:y";
  if (prev === "ั") return last === "ว" ? "ua:" : "a:" + f;
  if (prev === "า") return "aa:" + f;
  if (prev === "ิ") return (lead(n - 2) === "เ" ? "eer:" : "i:") + f;
  if (prev === "ี") return last === "ย" && lead(n - 2) === "เ" ? "ia:" : "ii:" + f;
  if (prev === "ึ") return "ue:" + f;
  if (prev === "ื") {
    if (last === "อ") return lead(n - 2) === "เ" ? "uea:" : "uue:";
    return "uue:" + f;
  }
  if (prev === "ุ") return "u:" + f;
  if (prev === "ู") return "uu:" + f;
  if (prev === "็") {
    const v = { "เ": "e:", "แ": "ae:" }[lead(n - 2)];
    return v ? v + f : "";
  }
  if (prev === "ย" && prev2 === "ี" && lead(n - 3) === "เ") return "ia:" + f;
  if (last === "อ" && prev !== "ื") return lead(n - 1) === "เ" ? "eer:" : "oor:";
  if (prev === "อ") {
    if (prev2 === "ื") return (lead(n - 3) === "เ" ? "uea:" : "uue:") + f;
    if (prev2 === "็") return "or:" + f;
    if (C(prev2)) return (lead(n - 2) === "เ" ? "eer:" : "oor:") + f;
    return "o:" + f;
  }

  if (LV(prev)) return OPEN[prev];
  let v = "";
  if (LV(prev2) && C(prev)) {
    if (isCluster(prev, last)) return OPEN[prev2];
    v = prev2;
  } else if (n >= 4 && LV(prev3) && C(prev2) && C(prev)) v = prev3;
  if (v === "เ") return last === "ย" ? "eer:y" : "ee:" + f;
  if (v === "แ") return "aae:" + f;
  if (v === "โ") return "oo:" + f;

  if (prev === "ร" && prev2 === "ร") return "a:" + f;
  if (last === "ร" && prev === "ร") return "a:n";
  if (prev === "ว" && C(prev2)) return "ua:" + f;
  if (last === "ร" && C(prev)) return "oor:n";
  return "o:" + f;
}

/** The written last syllable: หัวใจ -> ใจ, นักเรียน -> เรียน. The whole word when unsure. */
function lastSyllable(word) {
  const key = rhymeKey(word);
  if (!key) return word;
  for (let k = word.length - 1; k > 0; k--) {
    if (syllableCut(word, k) && rhymeKey(word.slice(k)) === key) return word.slice(k);
  }
  return word;
}

function byRhyme() {
  if (!L.rhymes) {
    L.rhymes = new Map();
    for (const w of L.words) {
      const k = rhymeKey(w);
      if (!k) continue;
      let a = L.rhymes.get(k);
      if (!a) L.rhymes.set(k, (a = []));
      a.push(w);
    }
  }
  return L.rhymes;
}

const api = {
  load: loadLexicon, search, families, rhymeKey, lastSyllable, parts: wordParts,
  familiarity: (w) => L.fam.get(w) || 0, lexicon: L, CONSONANTS: CONS, COMMON,
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.Kham = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
