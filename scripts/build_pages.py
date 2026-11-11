"""Build the static word pages under docs/ that search engines can read.

    python scripts/build_pages.py

The search tool itself fills its results with JavaScript, so a crawler sees an empty page. These pages are
plain HTML lists made from the same lexicon:

    docs/rhyme/<word>.html    words that rhyme with <word>, one page per rhyme sound
    docs/starts/<letter>.html words that start with a consonant (เกม and ไก่ count under ก)
    docs/has/<letter>.html    words that contain a consonant
    docs/words/index.html     a hub linking to all of them
    docs/sitemap.xml

Output is deterministic, so CI can rebuild and check nothing changed.
"""
import os
import shutil
import sys
from html import escape
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from kham import COMMON, CONSONANTS, WordFinder  # noqa: E402
from kham.rhyme import last_syllable, rhyme_key  # noqa: E402
from kham.thai import GRAMMAR, GRAMMAR_PENALTY, LEADING_VOWELS, sort_key  # noqa: E402

DOCS = os.path.join(ROOT, "docs")
SITE = "https://neptunenakub.github.io/kham/"
MAX_WORDS = 240     # words listed per section
MIN_RHYMES = 8      # a rhyme sound needs this many common words to get a page
# not listed on these public pages (they stay in the lexicon and the search tool)
OFFENSIVE = {"ควย", "หี", "เย็ด", "เหี้ย", "สัส", "แตด", "หำ", "เงี่ยน", "ดอกทอง", "อีดอก", "ระยำ", "จัญไร", "มึง", "กู"}
OFFENSIVE_PARTS = ("ควย", "เย็ด", "เหี้ย")

# words people often want a rhyme for; a rhyme page is named after one of these when its sound has one
POPULAR = frozenset(
    "รัก ใจ เธอ ฝัน ฉัน เรา ดี ตา ฟ้า ดาว วัน คืน ลม ฝน น้ำ ไฟ คน ทาง ไกล ลืม จำ รอ หวัง เหงา เศร้า สุข ทุกข์ ยิ้ม "
    "ร้อง เพลง ใหม่ เก่า เดิน ไป มา อยู่ รู้ เห็น ฟัง พูด คิด ถึง หา เจอ จาก ลา กลับ บ้าน เมือง โลก ชีวิต เวลา "
    "แม่ พ่อ ลูก เพื่อน ครู เด็ก หมา แมว นก ปลา ดอก ไม้ ทะเล ภูเขา สวย งาม หวาน ขม ร้อน หนาว เย็น แสง เงา สี".split()
)

FINAL_TH = {"k": "ก", "t": "ด", "p": "บ", "ng": "ง", "n": "น", "m": "ม", "y": "ย", "w": "ว"}
OPEN_TH = {"a": "อะ", "aa": "อา", "i": "อิ", "ii": "อี", "ue": "อึ", "uue": "อือ", "u": "อุ", "uu": "อู", "e": "เอะ",
           "ee": "เอ", "ae": "แอะ", "aae": "แอ", "o": "โอะ", "oo": "โอ", "or": "เอาะ", "oor": "ออ", "er": "เออะ",
           "eer": "เออ", "ia": "เอีย", "uea": "เอือ", "ua": "อัว"}
CLOSED_TH = {"a": "อั", "aa": "อา", "i": "อิ", "ii": "อี", "ue": "อึ", "uue": "อื", "u": "อุ", "uu": "อู", "e": "เอ็",
             "ee": "เอ", "ae": "แอ็", "aae": "แอ", "o": "อ", "oo": "โอ", "or": "อ็อ", "oor": "ออ", "er": "เอิ",
             "eer": "เอิ", "ia": "เอีย", "uea": "เอือ", "ua": "อว"}
SPECIAL_TH = {"a:y": "ไอ", "a:w": "เอา", "a:m": "อำ", "eer:y": "เอย"}


def sound_label(key: str) -> str:
    """A rhyme key spelled the Thai way with อ as the initial: a:k -> อัก, ia:n -> เอียน, a:y -> ไอ."""
    if key in SPECIAL_TH:
        return SPECIAL_TH[key]
    vowel, final = key.split(":")
    return CLOSED_TH[vowel] + FINAL_TH[final] if final else OPEN_TH[vowel]


def clean(words):
    return [w for w in words if w not in OFFENSIVE and not any(p in w for p in OFFENSIVE_PARTS)]


def url(path: str) -> str:
    return SITE + quote(path)


def word_list(words) -> str:
    return '<ul class="wordlist">' + "".join(f"<li>{escape(w)}</li>" for w in words) + "</ul>"


def page(path, title, description, body, depth=1):
    up = "../" * depth
    canonical = url(path[:-len("index.html")] if path.endswith("index.html") else path)
    html = f"""<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<meta name="description" content="{escape(description)}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="{escape(description)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE}og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{up}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600&family=Noto+Sans+Thai+Looped:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{up}style.css">
</head>
<body>
<header class="bar">
  <div class="wrap bar-row">
    <a class="brand" href="{up}">Kham</a>
    <nav class="crumbs"><a href="{up}">ตัวค้นหาคำ</a><a href="{up}words/">รวมหน้าคำ</a></nav>
  </div>
</header>
<main class="wrap static">
{body}
</main>
<footer class="foot">
  <div class="wrap foot-row">
    <p>รายการนี้สร้างจากคลังคำของ <a href="{up}">Kham</a> ตัวหาคำไทยแบบโอเพนซอร์ส · คลังคำจาก <a href="https://github.com/PyThaiNLP/pythainlp" rel="noopener">PyThaiNLP</a> (CC0)</p>
  </div>
</footer>
</body>
</html>
"""
    full = os.path.join(DOCS, path.replace("/", os.sep))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    return path


def tool_link(up, label, **params) -> str:
    query = "&".join(f"{k}={quote(v)}" for k, v in params.items())
    return f'<p><a class="btn cta" href="{up}?{query}">{escape(label)}</a></p>'


def main():
    wf = WordFinder()
    common = clean(w for w in wf.words if wf.fam[w] >= COMMON)
    for folder in ("rhyme", "starts", "has", "words"):
        shutil.rmtree(os.path.join(DOCS, folder), ignore_errors=True)
    made = []

    # ---------- rhyme pages: one per rhyme sound ----------
    def rank(w):
        return (-wf.score(w) + (GRAMMAR_PENALTY if w in GRAMMAR else 0.0), sort_key(w))

    by_sound, total_by_sound = {}, {}
    for w in common:
        by_sound.setdefault(rhyme_key(w), []).append(w)
    for w in wf.words:
        k = rhyme_key(w)
        total_by_sound[k] = total_by_sound.get(k, 0) + 1
    by_sound.pop("", None)

    rhyme_pages = []   # (path, head word, label, examples, count)
    used_names = set()
    for key in sorted(by_sound):
        words = sorted(by_sound[key], key=rank)
        if len(words) < MIN_RHYMES:
            continue
        single = [w for w in words if last_syllable(w) == w]
        multi = [w for w in words if last_syllable(w) != w]
        heads = [w for w in single if w not in GRAMMAR] or single or words
        heads = sorted(heads, key=lambda w: w not in POPULAR)  # words people look up rhymes for come first
        head = next(w for w in heads if w not in used_names)
        used_names.add(head)
        rhyme_pages.append((f"rhyme/{head}.html", head, sound_label(key), [w for w in heads if w != head][:4], len(words),
                            key, single, multi))

    by_vowel = {}
    for p in rhyme_pages:
        by_vowel.setdefault(p[5].split(":")[0], []).append(p)

    for path, head, label, examples, count, key, single, multi in rhyme_pages:
        eg = " ".join(examples[:3])
        title = f"คำคล้องจองกับ {head} {eg} (เสียง{label}) {count} คำ"
        desc = (f"รวมคำคล้องจอง คำสัมผัสกับ “{head}” เสียงสระ{label} เช่น {' '.join(examples)} "
                f"{count} คำที่ใช้บ่อย เรียงจากคำที่คนคุ้นก่อน สำหรับแต่งกลอน เขียนเพลง และแร็ป")
        body = [
            f'<p class="crumbs"><a href="../words/">รวมหน้าคำ</a> › คำคล้องจอง</p>',
            f"<h1>คำคล้องจองกับ “{escape(head)}”</h1>",
            f'<p class="sub">คำที่พยางค์สุดท้ายลงเสียง <b>{escape(label)}</b> เหมือน “{escape(head)}” เช่น {escape(" ".join(examples))} '
            f"หน้านี้มี {count:,} คำที่ใช้บ่อย เรียงจากคำที่คนคุ้นก่อน ทั้งคลังมี {total_by_sound[key]:,} คำ</p>",
            tool_link("../", f"ค้นคำคล้องจองกับคำอื่น หรือดูครบ {total_by_sound[key]:,} คำ", q=head, mode="rhymes"),
        ]
        if single:
            body += [f"<h2>คำพยางค์เดียวที่คล้องจองกับ {escape(head)}</h2>", word_list(single[:MAX_WORDS])]
        if multi:
            body += [f"<h2>คำหลายพยางค์ที่ลงท้ายเสียง {escape(label)}</h2>", word_list(multi[:MAX_WORDS])]
        near = [p for p in by_vowel[key.split(":")[0]] if p[0] != path]
        if near:
            links = "".join(f'<a href="{escape(os.path.basename(p[0]))}">{escape(p[2])} <small>{escape(p[1])}</small></a>' for p in near)
            body += ["<h2>เสียงสระเดียวกัน ตัวสะกดต่างกัน</h2>", f'<p class="links">{links}</p>']
        body.append('<p class="note">เสียงสัมผัสอ่านจากตัวสะกดด้วยกฎ คำที่สะกดไม่ตรงเสียงบางคำอาจจัดผิดกลุ่ม</p>')
        made.append(page(path, title, desc, "\n".join(body)))

    # ---------- letter pages ----------
    def initial(w):
        return w[1] if len(w) > 1 and w[0] in LEADING_VOWELS else w[0]

    letter_pages = []  # (letter, starts count, has count)
    by_fam = lambda ws: sorted(ws, key=lambda w: (-wf.score(w), sort_key(w)))
    everything = clean(wf.words)
    for ch in CONSONANTS:
        starts_all = [w for w in everything if initial(w) == ch]
        has_all = [w for w in everything if ch in w]
        if not has_all:
            continue
        counts = []
        for kind, all_words, h1, what in (
            ("starts", starts_all, f"คำที่ขึ้นต้นด้วย {ch}", f"คำที่ขึ้นต้นด้วยตัว {ch}"),
            ("has", has_all, f"คำที่มีตัว {ch}", f"คำที่มีตัว {ch} อยู่ในคำ"),
        ):
            usual = [w for w in all_words if wf.fam[w] >= COMMON]
            # rare letters (ฬ ฌ ฆ) have few common words, so list the rare ones too
            show_all = len(all_words) <= MAX_WORDS or len(usual) < 30
            words = by_fam(all_words if show_all else usual)[:MAX_WORDS]
            counts.append(len(words))
            if not words:
                continue
            eg = " ".join(words[:5])
            title = f"{h1} {len(words)} คำ เช่น {eg}"
            desc = f"รวม{what} {len(words)} คำ เช่น {' '.join(words[:8])} เรียงจากคำที่ใช้บ่อย ทั้งคลังมี {len(all_words):,} คำ"
            note = " (คำที่ขึ้นต้นด้วยสระหน้าอย่าง เ แ โ ใ ไ นับตามพยัญชนะตัวแรก เช่น เกม และ ไก่ อยู่ในหมวด ก)" if kind == "starts" else ""
            other = ("has", f"คำที่มีตัว {ch}") if kind == "starts" else ("starts", f"คำที่ขึ้นต้นด้วย {ch}")
            body = [
                f'<p class="crumbs"><a href="../words/">รวมหน้าคำ</a> › {"คำขึ้นต้น" if kind == "starts" else "คำที่มีตัวอักษร"}</p>',
                f"<h1>{escape(h1)}</h1>",
                f'<p class="sub">{escape(what)} {len(words):,} คำ เรียงจากคำที่คนใช้บ่อย ทั้งคลังมี {len(all_words):,} คำ{note}</p>',
                tool_link("../", f"ค้นเองในตัวค้นหา ดูครบ {len(all_words):,} คำ กรองความยาวได้", q=ch, mode="starts" if kind == "starts" else "all"),
                word_list(words),
            ]
            if (starts_all if other[0] == "starts" else has_all):
                body.append(f'<p class="links"><a href="../{other[0]}/{escape(ch)}.html">{escape(other[1])}</a></p>')
            made.append(page(f"{kind}/{ch}.html", title, desc, "\n".join(body)))
        letter_pages.append((ch, counts[0], counts[1]))

    # ---------- hub ----------
    starts_links = "".join(f'<a href="../starts/{escape(ch)}.html">{escape(ch)}</a>' for ch, s, _ in letter_pages if s)
    has_links = "".join(f'<a href="../has/{escape(ch)}.html">{escape(ch)}</a>' for ch, _, h in letter_pages if h)
    rhyme_links = "".join(
        f'<a href="../{escape(p[0])}">{escape(p[2])} <small>{escape(" ".join([p[1]] + p[3][:2]))}</small></a>' for p in rhyme_pages)
    body = "\n".join([
        "<h1>รวมหน้าคำไทย</h1>",
        f'<p class="sub">รายการคำไทยสำเร็จรูป {len(made) + 1:,} หน้า จากคลัง {len(wf):,} คำ ทั้งคำคล้องจองแยกตามเสียง '
        "คำที่ขึ้นต้นด้วยพยัญชนะแต่ละตัว และคำที่มีตัวอักษรที่ต้องการ</p>",
        tool_link("../", "ไปที่ตัวค้นหาคำ ค้นจากตัวอักษร คำสัมผัส หรือแพทเทิร์น", mode="all"),
        "<h2>คำที่ขึ้นต้นด้วย…</h2>", f'<p class="links letters">{starts_links}</p>',
        "<h2>คำที่มีตัว…</h2>", f'<p class="links letters">{has_links}</p>',
        f"<h2>คำคล้องจองตามเสียง ({len(rhyme_pages)} เสียง)</h2>", f'<p class="links">{rhyme_links}</p>',
    ])
    made.append(page("words/index.html", "รวมหน้าคำไทย: คำคล้องจอง คำขึ้นต้น และคำที่มีตัวอักษร",
                     f"รวมรายการคำไทย {len(made) + 1} หน้า คำคล้องจองแยกตามเสียง คำที่ขึ้นต้นด้วย ก ถึง ฮ และคำที่มีตัวอักษรที่ต้องการ",
                     body))

    # ---------- sitemap ----------
    locs = [SITE] + [url("words/" if p == "words/index.html" else p) for p in sorted(made)]
    with open(os.path.join(DOCS, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        f.writelines(f"  <url><loc>{loc}</loc></url>\n" for loc in locs)
        f.write("</urlset>\n")

    print(f"{len(rhyme_pages)} rhyme pages, {sum(1 for _, s, _ in letter_pages if s)} starts pages, "
          f"{sum(1 for _, _, h in letter_pages if h)} has pages, 1 hub, sitemap with {len(locs)} URLs")


if __name__ == "__main__":
    main()
