"""Live LKR exchange rates so Aura can quote prices in each traveler's own currency.

Rates come from the free open.er-api.com feed (no API key) and are cached in
memory. If the feed can't be reached, Aura falls back to the USD prices stored
in the package database rather than guessing rates.
"""

import json
import time
import threading
import urllib.request
from typing import Dict, List, Optional

RATES_URL = "https://open.er-api.com/v6/latest/LKR"
CACHE_SECONDS = 6 * 60 * 60

# Currencies precomputed per package, so the common cases need no arithmetic.
MAJOR_CURRENCIES = [
    "USD", "EUR", "GBP", "INR", "AUD", "CAD", "CHF", "JPY",
    "CNY", "SGD", "MYR", "AED", "SAR", "NZD", "SEK", "NOK",
    "DKK", "KRW", "THB", "RUB", "QAR", "KWD", "MVR",
]

_cache: Dict[str, object] = {"rates": None, "fetched_at": 0.0, "updated": ""}
_refresh_lock = threading.Lock()


def get_rates(background: bool = False) -> Optional[Dict[str, float]]:
    """Return {currency: units per 1 LKR}, or None if no rates are available."""
    now = time.time()
    if _cache["rates"] and now - _cache["fetched_at"] < CACHE_SECONDS:
        return _cache["rates"]
    if background:
        if _refresh_lock.acquire(blocking=False):
            def refresh():
                try:
                    get_rates()
                finally:
                    _refresh_lock.release()
            threading.Thread(target=refresh, daemon=True).start()
        return _cache["rates"]
    try:
        with urllib.request.urlopen(RATES_URL, timeout=5) as resp:
            data = json.load(resp)
        if data.get("result") == "success" and data.get("rates"):
            _cache.update(
                rates=data["rates"],
                fetched_at=now,
                updated=data.get("time_last_update_utc", ""),
            )
    except Exception:
        pass  # keep serving the last good rates, if any
    return _cache["rates"]


def _fmt(amount: float) -> str:
    return f"{amount:,.0f}" if amount >= 100 else f"{amount:,.2f}"


def build_currency_section(packages: List[dict], currencies: list[str] | None = None) -> str:
    """Prompt section with live rates and per-package prices in major currencies."""
    rates = get_rates(background=True)
    selected = list(dict.fromkeys(currencies if currencies is not None else MAJOR_CURRENCIES))
    lines = ["# LIVE EXCHANGE RATES (for quoting prices in the traveler's currency)"]

    if not rates:
        lines.append(
            "Live exchange rates are currently UNAVAILABLE. Quote prices as LKR with the "
            "database USD figure only, and tell the traveler you can't convert to their "
            "currency right now. Do NOT estimate or invent other exchange rates."
        )
        return "\n".join(lines)

    lines.append(f"Source: open.er-api.com, last updated {_cache['updated'] or 'recently'}.")
    unavailable = [c for c in selected if c not in rates]
    if unavailable:
        lines.append("Rates unavailable for " + ", ".join(unavailable) + ". Do not invent conversions.")
    lines.append("")
    lines.append("## Package prices in major currencies (use these exact figures)")
    for p in packages:
        converted = " | ".join(
            f"{c} {_fmt(p['price_lkr'] * rates[c])}" for c in selected if c in rates
        )
        lines.append(f"- [{p['id']}] LKR {p['price_lkr']:,} → {converted}")

    lines.append("")
    lines.append(
        "## Selected rates as LKR per 1 unit of foreign currency "
        "(for currencies not listed above: foreign amount = LKR amount ÷ rate)"
    )
    lines.append(
        ", ".join(f"{c} {1 / r:,.4g}" for c, r in sorted(rates.items()) if r and c != "LKR" and c in selected)
    )
    return "\n".join(lines)
