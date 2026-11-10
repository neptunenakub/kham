"""Small Thai-script helpers shared by the finder and the data build."""

CONSONANTS = "กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ"
LEADING_VOWELS = "เแโใไ"

# Grammar words: nobody builds a word family on them (เป็นการ, ให้การ, ในกรม ...).
STOP = frozenset(
    "ที่ ใน เป็น ให้ ได้ ว่า มี ของ และ กับ จะ ไป มา ก็ แต่ นี้ นั้น อยู่ แล้ว จาก ไม่ หรือ ถึง ซึ่ง โดย "
    "เพื่อ ต้อง ด้วย อย่าง ขึ้น เมื่อ เพราะ ยัง คือ อีก แห่ง จึง เขา เรา ฉัน".split()
)

# Word-family heads people build compounds on (การบ้าน, นักเรียน, น้ำแข็ง, ทำงาน ...).
HEADS = frozenset(
    "การ ความ นัก ผู้ คน น้ำ ข้าว รถ บ้าน ห้อง โรง ร้าน เครื่อง ลูก แม่ พ่อ หัว หน้า ตัว ใจ มือ ตา ปาก "
    "ไม้ ดอก ผัก ผล ปลา ไก่ หมู นก ช่าง ทาง สวน ตลาด งาน เงิน ทอง ไฟ ฟ้า ดิน หิน ลม ฝน ขนม ชา นม ไข่ "
    "เนื้อ ใบ ต้น ราก เสื้อ ชุด ชาว คำ เพลง หนัง สี เด็ก ครู หมอ วัน เวลา ยา น่า ขี้ เจ้า พระ นาย เรือ "
    "ทะเล ประตู หลัง ข้าง กลาง รอง ถุง กล่อง ขวด จาน โต๊ะ เหล็ก ทำ กิน เล่น เรียน รัก ขาย ซื้อ เดิน "
    "นอน ดู ฟัง พูด อ่าน เขียน ร้อง".split()
)

# More grammar words. Rhyme results push these and STOP down: someone looking for a rhyme for ฝัน
# wants วัน สำคัญ รางวัล, not กัน มัน อัน.
GRAMMAR = STOP | frozenset(
    "กัน มัน อัน นั่น นั้น นี่ นี้ โน่น นู่น ดังนั้น เท่านั้น ทั้งนั้น ฉะนั้น อะไร ทำไม อย่างไร ยังไง ใคร ใด ไหน "
    "ที่ไหน เมื่อไร เมื่อไหร่ เท่าไร เท่าไหร่ ไว้ ทำให้ ต่อไป แก่ แด่ ต่อ ถ้า หาก แม้ นอก บน ล่าง ตาม กว่า "
    "เคย ควร อาจ คง น่า เลย นะ ครับ ค่ะ คะ จ้ะ จ๊ะ สิ ซิ ล่ะ เถอะ หรอก เหรอ ไหม มั้ย หนึ่ง ทั้ง ทุก บาง "
    "หลาย ต่าง เอง ดัง เช่น จน จนถึง หมายถึง กล่าวถึง พูดถึง นึกถึง เกี่ยวกับ สำหรับ ระหว่าง เนื่องจาก "
    "อย่างนั้น อย่างนี้ แบบนั้น แบบนี้ ดังกล่าว ซึ่งกัน ด้วยกัน เดียวกัน เหมือนกัน ทั้งหลาย ทั้งหมด".split()
)
GRAMMAR_PENALTY = 3.0

PART_MIN = 5.5  # how familiar a piece must be before a person "sees" it inside a longer word
PLAY_MIN = 6.0  # a word-play jump only goes where the best next word is at least this familiar


def is_consonant(ch: str) -> bool:
    return "ก" <= ch <= "ฮ"


def is_thai(ch: str) -> bool:
    return "฀" <= ch <= "๿"


def thai_only(text: str) -> str:
    """Keep only Thai characters (drops spaces, commas, Latin letters)."""
    return "".join(ch for ch in text if is_thai(ch))


def char_counts(text: str) -> dict:
    c = {}
    for ch in text:
        c[ch] = c.get(ch, 0) + 1
    return c


def plain_word(w: str, max_len: int = 20) -> bool:
    """A single dictionary word made of ordinary Thai letters (no spaces, dots, ๆ, ฯ)."""
    if not 2 <= len(w) <= max_len or "ๆ" in w or "ฯ" in w:
        return False
    return all("ก" <= ch <= "ฺ" or "เ" <= ch <= "๎" for ch in w) and any(is_consonant(ch) for ch in w)


def sort_key(w: str) -> str:
    """Rough Thai dictionary order: a leading vowel (เ แ โ ใ ไ) sorts by the consonant after it."""
    if len(w) > 1 and w[0] in LEADING_VOWELS:
        return w[1] + w[0] + w[2:]
    return w


def syllable_cut(w: str, k: int) -> bool:
    """Could a new word start at w[k]?"""
    if k <= 0 or k >= len(w):
        return False
    nxt, prev = w[k], w[k - 1]
    if not ("ก" <= nxt <= "ฮ" or "เ" <= nxt <= "ไ"):
        return False  # vowels and tone marks belong to the syllable before them
    if "เ" <= prev <= "ไ":
        return False  # เ แ โ ใ ไ always go with the consonant after them
    if (prev in "ีื" and nxt in "ยอ") or (prev == "ั" and nxt == "ว"):
        return False  # เ-ีย, เ-ือ, -ัว: the ย / อ / ว is part of the vowel (เรียก is not เรี + ยก)
    return not (k + 1 < len(w) and w[k + 1] == "์")  # การ+ณ์ is not การ + something


def word_parts(w: str, known, fam) -> tuple:
    """Familiar words a person notices inside w, as (front pieces, back pieces).

    การเรียน -> (['การ'], ['เรียน']),  สังคม -> (['สัง'], ['คม']).
    ``known`` is any container of real words; ``fam`` maps word -> familiarity.
    A front piece also needs a real word right after it, so การบ้าน is not กา + รบ้าน.
    """
    def starts_with_word(r):
        return any(r[:j] in known for j in range(len(r), 1, -1) if j == len(r) or syllable_cut(r, j))

    front, back = [], []
    for k in range(2, len(w) - 1):
        if not syllable_cut(w, k):
            continue
        a, b = w[:k], w[k:]
        if fam.get(a, 0) >= PART_MIN and starts_with_word(b):
            front.append(a)
        if fam.get(b, 0) >= PART_MIN:
            back.append(b)
    return front, back
