// Checks that the browser engine (docs/kham.js) agrees with the Python package.
//   node tests/parity.mjs expected.json
// expected.json is written by tests/test_parity.py: rhyme keys for every word and the results of some searches.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const Kham = createRequire(import.meta.url)(join(root, "docs", "kham.js"));
Kham.load(readFileSync(join(root, "docs", "lexicon.tsv"), "utf8"));
const expected = JSON.parse(readFileSync(process.argv[2], "utf8"));

const problems = [];
const words = Kham.lexicon.words;
if (words.length !== expected.words) problems.push(`word count: js ${words.length}, python ${expected.words}`);

let bad = 0;
for (const w of words) {
  const js = Kham.rhymeKey(w), py = expected.rhyme[w];
  if (js !== py && bad++ < 10) problems.push(`rhyme key of ${w}: js "${js}", python "${py}"`);
}
if (bad > 10) problems.push(`... and ${bad - 10} more rhyme keys differ`);

for (const { query, result } of expected.searches) {
  // the two sides break ties in a different order, so compare as sets
  const js = Kham.search(query).slice().sort();
  const py = result.slice().sort();
  if (js.length !== py.length || js.some((w, i) => w !== py[i])) {
    const onlyJs = js.filter((w) => !py.includes(w)).slice(0, 5), onlyPy = py.filter((w) => !js.includes(w)).slice(0, 5);
    problems.push(`search ${JSON.stringify(query)}: js ${js.length}, python ${py.length}; only js: ${onlyJs}; only python: ${onlyPy}`);
  }
}

for (const { word, parts } of expected.parts) {
  const [front, back] = Kham.parts(word);
  if (JSON.stringify([front, back]) !== JSON.stringify(parts)) problems.push(`parts of ${word}: js ${JSON.stringify([front, back])}, python ${JSON.stringify(parts)}`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`ok: ${words.length} rhyme keys, ${expected.searches.length} searches, ${expected.parts.length} word splits`);
