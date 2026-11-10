"""The word finder: search ~60k Thai words by letters, prefix, suffix, substring or pattern."""
import heapq
import os
import random
import re

from .thai import (CONSONANTS, HEADS, PLAY_MIN, STOP, char_counts, is_consonant, sort_key, thai_only,
                   word_parts)

LEXICON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "lexicon.tsv")
SORTS = ("familiar", "long", "short", "az")
MATCH_MODES = ("all", "only")


class WordFinder:
    """Thai word finder.

    >>> wf = WordFinder()
    >>> wf.search(letters="กรน", limit=5)          # words that contain ก, ร and น
    >>> wf.search(starts="นัก", sort="long")       # words that start with นัก, longest first
    >>> wf.search(pattern="ก?ร*")                   # ? = one character, * = any run
    >>> wf.families(wf.search(letters="รก"))        # group results into word families
    """

    def __init__(self, path: str = LEXICON):
        self.fam = {}        # dictionary word -> how quickly a person thinks of it
        self.pieces = {}     # familiar piece -> score (used to spot การ / เรียน inside การเรียน)
        self.common = set()  # hand-picked everyday words and loanwords
        with open(path, encoding="utf-8") as f:
            for line in f:
                w, f_, p, flags = (line.rstrip("\n").split("\t") + ["", "", ""])[:4]
                if f_ and f_ != "-":
                    self.fam[w] = float(f_)
                if p and p != "-":
                    self.pieces[w] = float(p)
                if "c" in flags:
                    self.common.add(w)
        self.words = list(self.fam)
        self._index = None
        self._parts = {}

    # ---------- lookups ----------
    def __len__(self):
        return len(self.words)

    def __contains__(self, word):
        return word in self.fam

    def is_word(self, word: str) -> bool:
        return word in self.fam

    def familiarity(self, word: str) -> float:
        """Roughly 0-14; higher = a person thinks of it sooner. 0 for unknown or rare words."""
        return self.fam.get(word, 0.0)

    def score(self, word: str) -> float:
        """Ranking score used by sort="familiar": familiar first, slightly preferring short words."""
        return self.fam.get(word, 0.0) - 0.07 * len(word)

    def random(self, n: int = 1, min_familiarity: float = 6.0, seed=None) -> list:
        rng = random.Random(seed)
        pool = [w for w, s in self.fam.items() if s >= min_familiarity]
        return rng.sample(pool, min(n, len(pool)))

    # ---------- search ----------
    def _by_char(self):
        if self._index is None:
            idx = {}
            for i, w in enumerate(self.words):
                for ch in set(w):
                    idx.setdefault(ch, []).append(i)
            self._index = idx
        return self._index

    def search(self, letters: str = "", match: str = "all", starts: str = "", ends: str = "",
               contains: str = "", pattern: str = "", min_len: int = 0, max_len: int = 0,
               sort: str = "familiar", limit: int = 0, exclude=()) -> list:
        """Find words. Every filter you pass must hold.

        letters   Thai letters in any order, e.g. "ก ร น" or "กรน".
                  match="all":  the word contains every letter (a repeated letter must appear that many times)
                  match="only": every consonant in the word is one of these letters
        starts / ends / contains   plain text the word starts with / ends with / contains
        pattern   ? = exactly one character, * = any run of characters, e.g. "ก?ร*" or "*ภาพ"
        min_len / max_len   length in characters (0 = no limit)
        sort      "familiar" (default), "long", "short" or "az"
        """
        if match not in MATCH_MODES:
            raise ValueError(f"match must be one of {MATCH_MODES}")
        if sort not in SORTS:
            raise ValueError(f"sort must be one of {SORTS}")
        letters, starts, ends, contains = (thai_only(x) for x in (letters, starts, ends, contains))
        need = char_counts(letters) if match == "all" else {}
        allowed = {ch for ch in letters if is_consonant(ch)} if match == "only" else None
        if match == "only" and not allowed:
            return []
        rx = _compile(pattern) if pattern.strip() else None
        skip = set(exclude)

        # start from the rarest required character instead of scanning every word
        idx = self._by_char()
        anchors = list(need) + list(contains[:1]) + list(starts[:1]) + list(ends[-1:])
        if anchors:
            rare = min(anchors, key=lambda ch: len(idx.get(ch, ())))
            cands = (self.words[i] for i in idx.get(rare, ()))
        else:
            cands = iter(self.words)

        out = []
        for w in cands:
            n = len(w)
            if (min_len and n < min_len) or (max_len and n > max_len) or w in skip:
                continue
            if starts and not w.startswith(starts):
                continue
            if ends and not w.endswith(ends):
                continue
            if contains and contains not in w:
                continue
            if need and any(w.count(ch) < k for ch, k in need.items()):
                continue
            if allowed is not None and any(is_consonant(ch) and ch not in allowed for ch in w):
                continue
            if rx and not rx.fullmatch(w):
                continue
            out.append(w)

        if sort == "familiar":
            out.sort(key=lambda w: (-self.score(w), sort_key(w)))
        elif sort == "long":
            out.sort(key=lambda w: (-len(w), -self.fam[w], sort_key(w)))
        elif sort == "short":
            out.sort(key=lambda w: (len(w), -self.fam[w], sort_key(w)))
        else:
            out.sort(key=sort_key)
        return out[:limit] if limit else out

    # ---------- word families ----------
    def parts(self, word: str) -> tuple:
        """Familiar pieces inside a word: การเรียน -> (['การ'], ['เรียน'])."""
        got = self._parts.get(word)
        if got is None:
            got = self._parts[word] = word_parts(word, _Known(self), self.pieces)
        return got

    def families(self, words, chain: int = 6) -> list:
        """Group words the way a person thinks of them, as a list of
        {"stem": ..., "kind": "new" | "play", "words": [...]}.

        A family grows from a familiar stem (การ -> การบ้าน การงาน การเรียน); the stem does not have to be
        in the list. After a family, the next one often comes from a piece of what was just listed
        (การเรียน -> เรียน -> นักเรียน, สังคม -> คม -> คมมีด). Those jumps are marked kind="play".
        """
        words = list(dict.fromkeys(words))
        pool = set(words)
        parts, front_of, back_of = {}, {}, {}
        for w in words:
            front, back = self.parts(w)
            front = [p for p in front if p not in STOP]
            back = [p for p in back if p not in STOP]
            parts[w] = front + back
            for p in front:
                front_of.setdefault(p, []).append(w)
            for p in back:
                back_of.setdefault(p, []).append(w)

        fam = {w: self.score(w) for w in words}

        def by_fam(ws):
            return sorted(ws, key=lambda w: (-fam[w], sort_key(w)))

        stems = sorted(pool | set(front_of) | set(back_of))
        # a stem's members: itself if it is in the list, then words starting with it, then words ending with it
        lists = {s: ([s] if s in pool else [], by_fam(front_of.get(s, ())), by_fam(back_of.get(s, ())))
                 for s in stems}
        ptr = {s: [0, 0, 0] for s in stems}
        bonus = {s: 0.5 * min(self.pieces.get(s, self.fam.get(s, 0.0)), 9.0) + (1.5 if s in HEADS else 0.0)
                 for s in stems}
        used, visits = set(), {}

        def heads(s):
            out = []
            for i in range(3):
                lst, p = lists[s][i], ptr[s]
                while p[i] < len(lst) and lst[p[i]] in used:
                    p[i] += 1
                if p[i] < len(lst):
                    out.append(lst[p[i]])
            return out

        def score(s):
            h = heads(s)
            return bonus[s] + max(fam[w] for w in h) - 1.5 * visits.get(s, 0) if h else None

        def best_head(s):
            h = heads(s)
            return max(fam[w] for w in h) if h else None

        def take(s, k):
            got, base = [], None
            for i in range(3):
                for w in lists[s][i]:
                    if len(got) == k:
                        return got
                    if w in used:
                        continue
                    if base is not None and fam[w] < base - 3.5:
                        return got  # the obvious ones are done; leave the rest of this stem for later
                    if w != s and base is None:
                        base = fam[w]
                    used.add(w)
                    got.append(w)
            return got

        heap = [(-score(s), i, s) for i, s in enumerate(stems) if score(s) is not None]
        heapq.heapify(heap)
        tie = len(stems)

        groups, last, cur, plays = [], [], None, 0
        while len(used) < len(pool):
            stem, kind = None, "new"
            if last and plays < 2:
                cands = [p for w in reversed(last) for p in parts[w] + [w]
                         if p != cur and p not in STOP and (best_head(p) or 0) >= PLAY_MIN]
                if cands:
                    stem, kind = max(cands, key=score), "play"
            while stem is None and heap:
                neg, _t, s = heapq.heappop(heap)
                sc = score(s)
                if sc is None:
                    continue
                if sc < -neg - 1e-9:  # went down since it was queued; queue it again at its real score
                    heapq.heappush(heap, (-sc, tie, s))
                    tie += 1
                    continue
                stem = s
            if stem is None:
                break
            got = take(stem, max(2, chain - 2) if kind == "play" else chain)
            visits[stem] = visits.get(stem, 0) + 1
            plays = plays + 1 if kind == "play" else 0
            groups.append({"stem": stem, "kind": kind, "words": got})
            last, cur = got, stem
            sc = score(stem)
            if sc is not None:
                heapq.heappush(heap, (-sc, tie, stem))
                tie += 1
        rest = [w for w in words if w not in used]  # safety net; should be empty
        if rest:
            groups.append({"stem": "", "kind": "new", "words": rest})
        return groups


class _Known:
    """'Is this a real word?' for the piece finder: dictionary words and familiar pieces."""
    __slots__ = ("wf",)

    def __init__(self, wf):
        self.wf = wf

    def __contains__(self, w):
        return w in self.wf.fam or w in self.wf.pieces


def _compile(pattern: str):
    out = []
    for ch in pattern.strip():
        if ch in "?_.":
            out.append(".")
        elif ch == "*":
            out.append(".*")
        elif ch.strip():
            out.append(re.escape(ch))
    return re.compile("".join(out))


__all__ = ["WordFinder", "CONSONANTS", "SORTS", "MATCH_MODES"]
