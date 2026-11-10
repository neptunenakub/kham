import unittest

from kham import WordFinder
from kham.thai import syllable_cut, thai_only


class FinderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.wf = WordFinder()

    def test_loads_dictionary(self):
        self.assertGreater(len(self.wf), 50000)
        self.assertIn("นักเรียน", self.wf)
        self.assertNotIn("xyz", self.wf)

    def test_letters_all(self):
        got = self.wf.search(letters="ก ร น")
        self.assertIn("นักเรียน", got)
        for w in got:
            for ch in "กรน":
                self.assertIn(ch, w)

    def test_repeated_letter_needs_repeats(self):
        for w in self.wf.search(letters="กก"):
            self.assertGreaterEqual(w.count("ก"), 2)

    def test_letters_only(self):
        got = self.wf.search(letters="กรน", match="only")
        self.assertIn("การ", got)
        for w in got:
            self.assertTrue(all(not ("ก" <= ch <= "ฮ") or ch in "กรน" for ch in w), w)

    def test_starts_ends_contains(self):
        self.assertTrue(all(w.startswith("นัก") for w in self.wf.search(starts="นัก")))
        self.assertTrue(all(w.endswith("ภาพ") for w in self.wf.search(ends="ภาพ")))
        self.assertTrue(all("เรียน" in w for w in self.wf.search(contains="เรียน")))

    def test_pattern(self):
        got = self.wf.search(pattern="ก?ร")
        self.assertIn("การ", got)
        self.assertTrue(all(len(w) == 3 and w[0] == "ก" and w[2] == "ร" for w in got))

    def test_length_and_sort(self):
        got = self.wf.search(starts="นัก", min_len=5, max_len=8, sort="long")
        self.assertTrue(all(5 <= len(w) <= 8 for w in got))
        self.assertEqual([len(w) for w in got], sorted((len(w) for w in got), reverse=True))

    def test_familiar_first(self):
        top = self.wf.search(letters="รก", limit=20)
        self.assertIn("การ", top)

    def test_families_cover_every_word(self):
        words = self.wf.search(letters="รก", limit=200)
        groups = self.wf.families(words)
        flat = [w for g in groups for w in g["words"]]
        self.assertEqual(sorted(flat), sorted(words))
        self.assertTrue(any(g["stem"] == "การ" for g in groups))

    def test_parts(self):
        self.assertEqual(self.wf.parts("การเรียน"), (["การ"], ["เรียน"]))

    def test_helpers(self):
        self.assertEqual(thai_only("ก, r น!"), "กน")
        self.assertFalse(syllable_cut("เรียก", 3))  # เ-ีย keeps its ย
        self.assertTrue(syllable_cut("การบ้าน", 3))

    def test_bad_options(self):
        with self.assertRaises(ValueError):
            self.wf.search(letters="ก", sort="nope")


if __name__ == "__main__":
    unittest.main()
