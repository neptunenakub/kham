"""Rhyme keys for Thai words.

Two words rhyme (สัมผัสสระ) when their last syllables share a vowel and a final sound, whatever the
initial consonant and tone: รัก / จัก / หนัก, เรียน / เขียน, ใจ / ไป / ภัย.

``rhyme_key(word)`` returns that sound as "vowel:final", e.g. รัก -> "a:k", เรียน -> "ia:n", ใจ -> "a:y".
It reads the spelling from the end of the word with rules; there is no pronunciation dictionary, so
irregular spellings and a few ambiguous ones (หมุนวน reads like จำนวน) come out wrong.

docs/kham.js has the same function, and tests/parity.mjs checks that the two agree on every word.
"""
import re

from .thai import syllable_cut

CONS = frozenset("กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ")  # sets: "" must not count as a member
LEAD = frozenset("เแโไใ")
TONES = "่้๊๋"

FINAL = {}
for _chars, _sound in (("กขคฆ", "k"), ("ดตจชซสศษฎฏฐฑฒถทธฌ", "t"), ("บปพฟภ", "p"), ("ง", "ng"),
                       ("นณญรลฬ", "n"), ("ม", "m"), ("ย", "y"), ("ว", "w")):
    for _ch in _chars:
        FINAL[_ch] = _sound

# spellings whose written tail is not what is said; applied in order to the tone-less word
_FIXES = [
    (re.compile("ฤๅ"), "รือ"),
    (re.compile("ฤ(?=ก)"), "รึ"),              # ฤกษ์ พฤกษ์
    (re.compile("ฤ"), "ริ"),                   # อังกฤษ ฤทธิ์
    (re.compile("ริย์$"), ""),                 # กษัตริย์
    (re.compile("(?<![เแโไใ])[ตทด]ร์$"), ""),  # ศาสตร์ จันทร์ ยนตร์ (not สโตร์ ไดร์)
    (re.compile("[ก-ฮ][ิุ]?์"), ""),           # any silenced letter: สิทธิ์ พันธุ์ ฟิล์ม เบอร์
    (re.compile("เกียรติ$"), "เกียต"),
    (re.compile("ารถ$"), "าถ"),               # สามารถ
    (re.compile("พรรดิ$"), "พรรด"),            # จักรพรรดิ
    (re.compile("ภูมิ$"), "ภูม"),
    (re.compile("(?<=[าั])ติ$"), "ต"),         # ชาติ ประวัติ
    (re.compile("(?<=า)ตุ$"), "ต"),            # ธาตุ
    (re.compile("(?<=เ[ก-ฮ])ตุ$"), "ต"),       # เหตุ
    (re.compile("(?<=[าิีุู]ต)ร$"), ""),       # บาตร มิตร บุตร สูตร
    (re.compile("(?<=มุท)ร$"), ""),            # สมุทร
    (re.compile("(?<=เ[ก-ฮ][ตช])ร$"), ""),     # เมตร เพชร
    (re.compile("(?<=เ[ก-ฮ][ก-ฮ][ตช])ร$"), ""),  # เกษตร
    (re.compile("(?<=ญ)จ$"), ""),              # กาญจน์
    (re.compile("(?<=ั[ก-ฮ])[ก-ฮ]$"), ""),     # after -ั- only one final is said: จักร สมัคร ลักษณ์
]


def _is_cluster(a: str, b: str) -> bool:
    """Can a + b start a syllable together (กร ปล ขว หน อย ...)?"""
    return ((a in "กขคตปผพบดฟทสศ" and b in "รล") or (a in "กขค" and b == "ว")
            or (a == "ห" and b in "งญนมยรลว") or (a == "อ" and b == "ย"))


def rhyme_key(word: str) -> str:
    """The rhyming sound of the word's last syllable, or "" if it cannot be read."""
    s = "".join(ch for ch in word if ch not in TONES)
    for rx, to in _FIXES:
        s = rx.sub(to, s)
    n = len(s)
    if not n:
        return ""

    def lead(j):
        """The leading vowel (เ แ โ) written before the initial consonant(s) that end just before s[j]."""
        if j >= 2 and s[j - 2] in LEAD:
            return s[j - 2]
        if j >= 3 and s[j - 3] in LEAD and s[j - 2] in CONS:
            return s[j - 3]  # two initials: เกลือ, แสดง, เสมอ
        return ""

    last = s[-1]
    prev = s[-2] if n >= 2 else ""
    prev2 = s[-3] if n >= 3 else ""

    if last == "ำ":
        return "a:m"
    if last == "ะ":
        if prev == "า":
            return "or:" if lead(n - 2) == "เ" else "a:"          # เกาะ
        if prev == "อ" and lead(n - 2) == "เ":
            return "er:"                                           # เลอะ
        if prev == "ย" and prev2 == "ี":
            return "ia:"
        if prev == "ว" and prev2 == "ั":
            return "ua:"
        v = prev2 if prev in CONS else ""
        if n >= 4 and prev2 in CONS and _is_cluster(prev2, prev):
            v = s[-4]                                              # เปราะ-style cluster; โทสะ is not one
        return {"เ": "e:", "แ": "ae:", "โ": "o:"}.get(v, "a:")       # เตะ แกะ โต๊ะ / จะ
    if last == "า":
        j = n - 1
        if (j >= 2 and s[j - 2] == "เ") or (j >= 3 and s[j - 3] == "เ" and _is_cluster(s[j - 2], s[j - 1])):
            return "a:w"                                           # เรา เปล่า, but not เวลา
        return "aa:"
    if last in "ิีึืุู":
        return {"ิ": "i:", "ี": "ii:", "ึ": "ue:", "ื": "uue:", "ุ": "u:", "ู": "uu:"}[last]
    if last == "็":
        return "or:"                                               # ก็
    if last not in CONS:
        return ""

    f = FINAL.get(last, "")
    if n == 1:
        return "oor:"
    if "ไ" in s[-3:-1] or "ใ" in s[-3:-1]:
        return "a:y"                                               # ใจ ไกล ไทย
    if prev == "ั":
        return "ua:" if last == "ว" else "a:" + f                  # ตัว / รัก ภัย
    if prev == "า":
        return "aa:" + f
    if prev == "ิ":
        return ("eer:" if lead(n - 2) == "เ" else "i:") + f        # เดิน / กิน
    if prev == "ี":
        if last == "ย" and lead(n - 2) == "เ":
            return "ia:"                                           # เสีย
        return "ii:" + f
    if prev == "ึ":
        return "ue:" + f
    if prev == "ื":
        if last == "อ":
            return "uea:" if lead(n - 2) == "เ" else "uue:"        # เรือ / มือ
        return "uue:" + f
    if prev == "ุ":
        return "u:" + f
    if prev == "ู":
        return "uu:" + f
    if prev == "็":
        v = {"เ": "e:", "แ": "ae:"}.get(lead(n - 2))
        return v + f if v else ""                                  # เป็น แข็ง
    if prev == "ย" and prev2 == "ี" and lead(n - 3) == "เ":
        return "ia:" + f                                           # เรียน เขียว
    if last == "อ" and prev != "ื":
        return "eer:" if lead(n - 1) == "เ" else "oor:"            # เธอ / พ่อ ออ
    if prev == "อ":
        if prev2 == "ื":
            return ("uea:" if lead(n - 3) == "เ" else "uue:") + f  # เดือน
        if prev2 == "็":
            return "or:" + f                                       # ล็อก
        if prev2 in CONS:
            return ("eer:" if lead(n - 2) == "เ" else "oor:") + f  # เทอม / นอน
        return "o:" + f                                            # อ is the initial: หน้าอก
    # a leading vowel with nothing written after the initial: เลข แดง โลก, or open เท แปล
    if prev in LEAD:
        return {"เ": "ee:", "แ": "aae:", "โ": "oo:"}[prev]
    v = ""
    if prev2 in LEAD and prev in CONS:
        if _is_cluster(prev, last):
            return {"เ": "ee:", "แ": "aae:", "โ": "oo:"}[prev2]    # แปล เปล
        v = prev2
    elif n >= 4 and s[-4] in LEAD and prev2 in CONS and prev in CONS:
        v = s[-4]                                                  # เพลง แสดง โครง
    if v == "เ":
        return "eer:y" if last == "ย" else "ee:" + f               # เคย / เลข เลว
    if v == "แ":
        return "aae:" + f
    if v == "โ":
        return "oo:" + f

    if prev == "ร" and prev2 == "ร":
        return "a:" + f                                            # ธรรม พรรค
    if last == "ร" and prev == "ร":
        return "a:n"                                               # สรร สวรรค์
    if prev == "ว" and prev2 in CONS:
        return "ua:" + f                                           # สวน ด้วย
    if last == "ร" and prev in CONS:
        return "oor:n"                                             # นคร อักษร
    return "o:" + f                                                # คน ลม ตลก


def last_syllable(word: str) -> str:
    """The written last syllable, found as the shortest ending that still has the word's rhyme:
    หัวใจ -> ใจ, ความรัก -> รัก, นักเรียน -> เรียน. Returns the whole word when unsure."""
    key = rhyme_key(word)
    if not key:
        return word
    for k in range(len(word) - 1, 0, -1):
        if syllable_cut(word, k) and rhyme_key(word[k:]) == key:
            return word[k:]
    return word


__all__ = ["rhyme_key", "last_syllable"]
