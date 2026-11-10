"""The browser engine (docs/kham.js) must give the same answers as the Python package."""
import json
import os
import shutil
import subprocess
import tempfile
import unittest

from kham import COMMON, WordFinder
from kham.rhyme import rhyme_key

HERE = os.path.dirname(os.path.abspath(__file__))

# Python keyword arguments -> the names kham.js uses
JS_NAMES = {"min_len": "minLen", "max_len": "maxLen", "min_familiarity": "minFam"}
SEARCHES = [
    dict(letters="กรน"), dict(letters="กก"), dict(letters="ฮ"), dict(letters="กรน", match="only"),
    dict(starts="นัก"), dict(ends="ภาพ"), dict(contains="เรียน"), dict(pattern="ก?ร*", max_len=5),
    dict(pattern="*ภาพ"), dict(letters="มน", min_len=4, max_len=6), dict(letters="กรน", min_familiarity=COMMON),
    dict(rhymes="รัก"), dict(rhymes="เรียน"), dict(rhymes="ใจ", min_len=4), dict(rhymes="จันทร์", starts="ส"),
    dict(rhymes="หัวใจ"), dict(rhymes="นักเรียน"), dict(letters="love"), dict(starts="abc"), dict(rhymes="x"),
    dict(letters="k ก"),
]
SPLITS = ["การเรียน", "นักเรียน", "สังคม", "เรียก", "การบ้าน", "โรงพยาบาล", "ความรัก", "กรรมการ"]


@unittest.skipUnless(shutil.which("node"), "Node.js is not installed")
class ParityTest(unittest.TestCase):
    def test_js_matches_python(self):
        wf = WordFinder()
        expected = {
            "words": len(wf),
            "rhyme": {w: rhyme_key(w) for w in wf.words},
            "searches": [{"query": {JS_NAMES.get(k, k): v for k, v in q.items()}, "result": wf.search(**q)}
                         for q in SEARCHES],
            "parts": [{"word": w, "parts": list(wf.parts(w))} for w in SPLITS],
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "expected.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(expected, f, ensure_ascii=False)
            run = subprocess.run(["node", os.path.join(HERE, "parity.mjs"), path],
                                 capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)


if __name__ == "__main__":
    unittest.main()
