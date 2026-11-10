"""A tiny JSON API over Kham, using only the standard library.

    python examples/api_server.py            # http://localhost:8000
    python examples/api_server.py 9000

    GET /search?letters=กรน&limit=10
    GET /search?starts=นัก&sort=long
    GET /search?pattern=ก?ร*&max_len=5&common=1
    GET /families?letters=รก&limit=40
    GET /word?w=นักเรียน

Any chat bot (LINE, Telegram, Discord ...) can call this from its webhook handler.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from kham import COMMON, MATCH_MODES, SORTS, WordFinder  # noqa: E402

wf = WordFinder()
MAX_LIMIT = 500


def run_search(q: dict) -> list:
    """Turn query-string values into a WordFinder.search call."""
    def num(name, default=0):
        try:
            return max(0, int(q.get(name, default)))
        except ValueError:
            raise ValueError(f"{name} must be a whole number")

    match, sort = q.get("match", "all"), q.get("sort", "familiar")
    if match not in MATCH_MODES:
        raise ValueError(f"match must be one of {', '.join(MATCH_MODES)}")
    if sort not in SORTS:
        raise ValueError(f"sort must be one of {', '.join(SORTS)}")
    if not any(q.get(k) for k in ("letters", "starts", "ends", "contains", "pattern")):
        raise ValueError("give at least one of letters, starts, ends, contains, pattern")
    return wf.search(
        letters=q.get("letters", ""), match=match, starts=q.get("starts", ""), ends=q.get("ends", ""),
        contains=q.get("contains", ""), pattern=q.get("pattern", ""),
        min_len=num("min_len"), max_len=num("max_len"),
        min_familiarity=COMMON if q.get("common") == "1" else 0.0, sort=sort,
    )


def handle(path: str, q: dict):
    """Returns (status, body). Kept apart from the HTTP class so it is easy to test or reuse."""
    try:
        if path == "/search":
            found = run_search(q)
            limit = min(int(q.get("limit", 50) or 50), MAX_LIMIT)
            return 200, {"total": len(found), "words": found[:limit]}
        if path == "/families":
            found = run_search(q)
            limit = min(int(q.get("limit", 60) or 60), MAX_LIMIT)
            return 200, {"total": len(found), "families": wf.families(found[:limit])}
        if path == "/word":
            w = q.get("w", "")
            front, back = wf.parts(w) if w in wf else ([], [])
            return 200, {"word": w, "is_word": w in wf, "familiarity": wf.familiarity(w), "parts": front + back}
        if path == "/":
            return 200, {"name": "kham", "words": len(wf), "endpoints": ["/search", "/families", "/word"]}
        return 404, {"error": "not found"}
    except ValueError as e:
        return 400, {"error": str(e)}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        q = {k: v[-1] for k, v in parse_qs(url.query).items()}
        status, body = handle(url.path, q)
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):  # keep the console quiet
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Kham API on http://localhost:{port}  ({len(wf):,} words)  Ctrl+C to stop")
    try:
        ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
