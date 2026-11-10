"""Build kham/data/lexicon.tsv (and the copy the web demo loads) from the raw word lists.

    python scripts/build_lexicon.py

Raw inputs in data/raw/ (all CC0 from PyThaiNLP, plus two hand-picked lists):
    words_th.txt   ~62k Thai dictionary entries
    tnc_freq.txt   word frequencies, Thai National Corpus (news / academic)
    ttc_freq.txt   word frequencies, Thai Textbook Corpus (everyday text)
    common_th.txt  hand-picked everyday words
    loanwords.txt  hand-picked loanwords (ซูชิ, คาราโอเกะ ...)

Output, one line per entry:  word <TAB> familiarity <TAB> piece score <TAB> flags
    familiarity  how quickly a person thinks of the word ("-" if it is not a dictionary word)
    piece score  corpus familiarity, kept only when high enough to be noticed inside other words
    flags        "c" = hand-picked common word
"""
import math
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from kham.thai import HEADS, PART_MIN, STOP, plain_word, word_parts  # noqa: E402

RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "kham", "data", "lexicon.tsv")
WEB = os.path.join(ROOT, "docs", "lexicon.tsv")


def lines(name):
    with open(os.path.join(RAW, name), encoding="utf-8-sig") as f:
        return [x.strip() for x in f if x.strip() and not x.startswith("#")]


def counts(name):
    c = {}
    for line in lines(name):
        w, _, n = line.partition("\t")
        w = w.strip()
        if n.strip().isdigit() and w and all("ก" <= ch <= "๎" for ch in w):
            c[w] = int(n)
    return c


def main():
    # TTC is everyday text, TNC leans to news and academic writing (it ranks ดำเนินการ above นักเรียน),
    # so TTC gets the bigger weight. TTC is about 23x smaller, so its counts are scaled up first.
    tnc, ttc = counts("tnc_freq.txt"), counts("ttc_freq.txt")
    famd = {w: 0.75 * math.log1p(23 * ttc.get(w, 0)) + 0.25 * math.log1p(tnc.get(w, 0))
            for w in set(tnc) | set(ttc)}

    curated = [w for w in lines("common_th.txt") + lines("loanwords.txt") if plain_word(w)]
    curated_set = set(curated)
    words = set(curated) | {w for w in lines("words_th.txt") if plain_word(w)}

    def familiarity(w):
        best = famd.get(w, 0.0)
        if best > 0:
            # Real text often splits compounds (การบ้าน shows up far less than การ and บ้าน), so a compound
            # on a common head that does appear is judged by its weaker piece.
            for p in word_parts(w, famd, famd)[0]:
                rest = w[len(p):]
                if p in HEADS and rest not in STOP and rest in famd:
                    best = max(best, min(famd[p], famd[rest]) - 2.0)
        if w in STOP:
            best -= 4.0  # ก็ / กับ are words, but nobody leads with them in a word game
        return best + (1.5 if w in curated_set else 0.0)

    pieces = {w: s for w, s in famd.items() if s >= PART_MIN and plain_word(w)}
    rows = []
    for w in sorted(words | set(pieces)):
        f = f"{familiarity(w):.1f}" if w in words else "-"
        p = f"{pieces[w]:.1f}" if w in pieces else "-"
        rows.append(f"{w}\t{f}\t{p}\t{'c' if w in curated_set else ''}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(rows) + "\n")
    os.makedirs(os.path.dirname(WEB), exist_ok=True)
    shutil.copyfile(OUT, WEB)
    print(f"{len(words):,} words, {len(pieces):,} pieces, {len(rows):,} rows -> {OUT}")


if __name__ == "__main__":
    main()
