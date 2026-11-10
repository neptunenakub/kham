"""Command line: python -m kham กรน   (or `kham กรน` after pip install)."""
import argparse
import json
import sys
import time

from . import __version__
from .finder import COMMON, MATCH_MODES, SORTS, WordFinder


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # Thai on the Windows console
        except Exception:
            pass

    ap = argparse.ArgumentParser(
        prog="kham",
        description="Find Thai words by letters, prefix, suffix, substring or pattern.",
        epilog="examples:\n"
               "  kham กรน                 words containing ก, ร and น\n"
               "  kham กรน --only          words built only from ก, ร, น\n"
               "  kham --starts นัก --sort long\n"
               "  kham --pattern 'ก?ร*' --max 5\n"
               "  kham --rhymes รัก         words that rhyme with รัก\n"
               "  kham รก --families       group results into word families",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("letters", nargs="*", help="Thai letters, any order (ก ร น or กรน)")
    ap.add_argument("--only", action="store_true", help="use only these consonants instead of all of them")
    ap.add_argument("-s", "--starts", default="", help="starts with")
    ap.add_argument("-e", "--ends", default="", help="ends with")
    ap.add_argument("-c", "--contains", default="", help="contains")
    ap.add_argument("-p", "--pattern", default="", help="? = one character, * = any run")
    ap.add_argument("-r", "--rhymes", default="", help="words that rhyme with this word")
    ap.add_argument("--min", type=int, default=0, help="minimum length")
    ap.add_argument("--max", type=int, default=0, help="maximum length")
    ap.add_argument("--common", action="store_true", help="hide rare words")
    ap.add_argument("--sort", choices=SORTS, default="familiar")
    ap.add_argument("-n", "--limit", type=int, default=40, help="how many to show (0 = all)")
    ap.add_argument("-f", "--families", action="store_true", help="group into word families")
    ap.add_argument("--json", action="store_true", help="print JSON")
    ap.add_argument("--random", type=int, metavar="N", help="print N random familiar words")
    ap.add_argument("-V", "--version", action="version", version=f"kham {__version__}")
    a = ap.parse_args(argv)

    wf = WordFinder()
    if a.random:
        words = wf.random(a.random)
        print(json.dumps(words, ensure_ascii=False) if a.json else "\n".join(words))
        return 0

    query = dict(letters="".join(a.letters), match=MATCH_MODES[1] if a.only else MATCH_MODES[0],
                 starts=a.starts, ends=a.ends, contains=a.contains, pattern=a.pattern, rhymes=a.rhymes,
                 min_len=a.min, max_len=a.max, min_familiarity=COMMON if a.common else 0.0, sort=a.sort)
    if not any((query["letters"], a.starts, a.ends, a.contains, a.pattern, a.rhymes)):
        ap.print_help()
        return 2

    t = time.perf_counter()
    found = wf.search(**query)
    ms = (time.perf_counter() - t) * 1000
    shown = found[:a.limit] if a.limit else found

    if a.families:
        groups = wf.families(shown)
        if a.json:
            print(json.dumps(groups, ensure_ascii=False, indent=1))
        else:
            for g in groups:
                mark = "↪" if g["kind"] == "play" else "•"
                print(f"{mark} {g['stem'] or '(อื่น ๆ)'}: {'  '.join(g['words'])}")
    elif a.json:
        print(json.dumps({"total": len(found), "words": shown}, ensure_ascii=False))
    else:
        print("\n".join(shown))
    if not a.json:
        more = f", showing {len(shown):,}" if len(shown) < len(found) else ""
        print(f"\n{len(found):,} words in {ms:.1f} ms{more}", file=sys.stderr)
    return 0 if found else 1


if __name__ == "__main__":
    sys.exit(main())
