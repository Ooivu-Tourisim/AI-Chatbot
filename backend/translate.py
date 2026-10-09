"""Translate catalogue package text (titles, itinerary, inclusions...) into the traveler's language.

Only display text is translated; ids, day numbers, prices and the English source in the database
stay untouched. Results are cached in memory per (package, language).
"""

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from pydantic import BaseModel

import builder_ai
import database

_cache: dict[tuple[str, str], dict[str, Any]] = {}
_lock = threading.Lock()

PROMPT = """Translate this travel package into {language}. Output JSON only.
- Translate every string value naturally and fluently. Keep the same number and order of list items.
- Keep place names (e.g. Jaffna, Nallur, Delft, Kayts), brand names and numbers recognisable; transliterate or add the local form only where that is the normal usage in {language}.
- Do not add, remove or change any facts, times, prices or inclusions."""


class _Day(BaseModel):
    day: int
    title: str
    activities: str


class _Pkg(BaseModel):
    title: str
    tagline: str
    category: str
    best_for: str
    destinations: list[str]
    highlights: list[str]
    inclusions: list[str]
    exclusions: list[str]
    itinerary: list[_Day]


def _source(pkg: dict[str, Any]) -> dict[str, Any]:
    keys = ("title", "tagline", "category", "best_for", "destinations", "highlights", "inclusions", "exclusions")
    out = {k: pkg.get(k) or ("" if k in ("title", "tagline", "category", "best_for") else []) for k in keys}
    out["itinerary"] = [{"day": d["day"], "title": d.get("title", ""), "activities": d.get("activities", "")} for d in pkg["itinerary"]]
    return out


def translate_package(client, model: str, package_id: str, language: str, timeout_ms: int) -> dict[str, Any]:
    key = (package_id, language.lower())
    with _lock:
        if key in _cache:
            return _cache[key]
    pkg = database.get_package_by_id(package_id)
    if not pkg:
        raise LookupError("unknown_package")
    src = _source(pkg)
    raw = builder_ai._json(client, model, PROMPT.format(language=language), json.dumps(src, ensure_ascii=False), timeout_ms, _Pkg)
    # Guard against the model dropping or reordering items: fall back to English for any mismatch.
    out = dict(src)
    for k, v in raw.items():
        if k == "itinerary":
            if [d["day"] for d in v] == [d["day"] for d in src["itinerary"]]:
                out[k] = v
        elif isinstance(src[k], list):
            if isinstance(v, list) and len(v) == len(src[k]):
                out[k] = v
        elif isinstance(v, str) and v.strip():
            out[k] = v
    with _lock:
        _cache[key] = out
    return out


def translate_many(client, model: str, package_ids: list[str], language: str, timeout_ms: int) -> dict[str, Any]:
    def one(pid: str):
        try:
            return pid, translate_package(client, model, pid, language, timeout_ms)
        except Exception:
            return pid, None  # that package stays in English

    with ThreadPoolExecutor(max_workers=4) as pool:
        return {pid: tr for pid, tr in pool.map(one, package_ids) if tr}
