"""Kham (คำ) — a fast, dependency-free Thai word finder."""
from .finder import COMMON, MATCH_MODES, SORTS, WordFinder
from .thai import CONSONANTS

__version__ = "1.0.0"

_default = None


def finder() -> WordFinder:
    """A shared WordFinder, loaded on first use."""
    global _default
    if _default is None:
        _default = WordFinder()
    return _default


def search(**kwargs) -> list:
    """Shortcut for ``finder().search(...)``, e.g. ``kham.search(letters="กรน", limit=10)``."""
    return finder().search(**kwargs)


__all__ = ["WordFinder", "finder", "search", "CONSONANTS", "SORTS", "MATCH_MODES", "COMMON", "__version__"]
