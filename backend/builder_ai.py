"""AI help inside the Package Builder.

The AI only *chooses among options that already exist* (package, traveler count, option
ids). Every price shown to the customer is computed by builder.quote() in code. All
outputs are proposals: the customer reviews, edits and applies them, and nothing is booked.
"""

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout, as_completed, wait
from typing import Any, Optional

from pydantic import BaseModel

import builder
import currency
import database

FALLBACK_MODEL = "gemini-flash-lite-latest"
HEDGE_AFTER = 4.0  # seconds before racing a second model

OPTION_RULES = """- Use ONLY the package ids and option ids listed in the catalogue. Never invent hotels, meals, prices, availability, travel times or services.
- Rank by the traveler's stated interests, group, comfort and budget. Never favour anything for commission or sponsorship.
- Price adjustments are placeholders computed by the server; do NOT calculate totals yourself, and never say a draft is "within budget", "affordable" or "over budget" — the interface compares the server-computed total with the budget.
- Never switch to a different-themed package just because it is cheaper (e.g. do not swap a romantic or proposal trip for a food trip). Keep the package that fits the occasion and show the budget gap honestly.
- If a wish cannot be met from the catalogue (specific hotel, dates availability, live weather, a destination we don't offer), say so honestly instead of pretending."""

DRAFT_PROMPT = """You turn a traveler's request into a DRAFT inside our Package Builder. Output JSON only.

{rules}
- Choose exactly one package that fits best. Pick travelers (default 2 if unclear) and one option per required group; "extras" is a list (may be empty).
- If a budget is stated, return it as {{"amount": number, "currency": "ISO code"}} exactly as the traveler wrote it; otherwise null.
- Write "why_it_fits", "assumptions" and "unmet" in {language}.

JSON shape:
{{"package_id": str, "travelers": int, "travel_month": str, "budget": {{"amount": number, "currency": str}} | null,
 "selections": {{"hotel": str, "meals": str, "transport": str, "extras": [str]}},
 "why_it_fits": str, "assumptions": [str], "unmet": [str]}}

{catalogue}

{options}
"""

ASSIST_PROMPT = """You are Aura, helping a traveler edit their draft in the Package Builder. Reply in {language}. Output JSON only.

{rules}
- You may suggest changes only by returning "changes": travelers and/or selections (same ids as the catalogue). Leave "changes" null if the traveler only asks a question.
- Keep the reply short (max ~90 words). Explain trade-offs plainly (comfort, location, convenience), and say that the exact new total is shown for them to review.
- Never claim anything is booked or confirmed; the traveler decides whether to apply a change. Word changes as suggestions ("I suggest…", "you could…"), never as already done — nothing changes until the traveler presses Apply.

Current draft: package {package_id}, {travelers} traveler(s), selections {selections}, current total LKR {total}. Budget: {budget}.

{catalogue}

{options}

JSON shape: {{"reply": str, "changes": {{"travelers": int, "selections": {{"group": "option id" | ["ids"]}}}} | null}}
"""


def _options_text(package_id: str | None = None) -> str:
    """Compact option catalogue (English labels) for the prompt."""
    ids = [package_id] if package_id else [p["id"] for p in database.get_all_packages()]
    lines = ["# SELECTABLE OPTIONS (per package; price adjustments in LKR)"]
    for pid in ids:
        data = builder.get_builder(pid, "en")
        if not data:
            continue
        lines.append(f"## {pid} (base LKR {data['package']['price_lkr']:,}, {data['price_basis']})")
        for g in data["groups"]:
            kind = "choose many" if g["multi"] else "choose one"
            opts = "; ".join(f"{o['id']}={o['label']} (+{o['price_lkr']:,} {o['price_type']}{', default' if o['default'] else ''})" for o in g["options"])
            lines.append(f"- {g['id']} ({kind}): {opts}")
    return "\n".join(lines)


class _Sel(BaseModel):
    hotel: Optional[str] = None
    meals: Optional[str] = None
    transport: Optional[str] = None
    extras: list[str] = []


class _Budget(BaseModel):
    amount: float
    currency: str


class _DraftOut(BaseModel):
    package_id: str
    travelers: int = 2
    travel_month: str = ""
    budget: Optional[_Budget] = None
    selections: _Sel = _Sel()
    why_it_fits: str = ""
    assumptions: list[str] = []
    unmet: list[str] = []


class _Changes(BaseModel):
    travelers: Optional[int] = None
    selections: Optional[_Sel] = None


class _AssistOut(BaseModel):
    reply: str
    changes: Optional[_Changes] = None


def _json(client, model: str, system: str, user: str, timeout_ms: int, schema) -> dict[str, Any]:
    """Structured output (the schema keeps the JSON valid), hedged for speed.

    If the first call has not answered after HEDGE_AFTER seconds (or it failed), a second call is
    started on a fallback model and the first valid answer wins. The whole call is bounded by
    `timeout_ms`. Failure raises RuntimeError and the API reports "AI unavailable".
    The Gemini API refuses per-request deadlines under 10 s, so each call gets at least that.
    """
    from google.genai import types

    def one(name: str) -> dict[str, Any]:
        resp = client.models.generate_content(
            model=name,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_schema=schema,
                max_output_tokens=2500,
                http_options=types.HttpOptions(timeout=max(timeout_ms, 10000)),
            ),
        )
        text = re.sub(r"^```(?:json)?|```$", "", (resp.text or "").strip(), flags=re.M).strip()
        return schema.model_validate_json(text).model_dump(exclude_none=True)

    deadline = time.monotonic() + timeout_ms / 1000
    pool = ThreadPoolExecutor(max_workers=2)
    try:
        futures = [pool.submit(one, model)]
        done, _ = wait(futures, timeout=HEDGE_AFTER)
        if not done or futures[0].exception():
            futures.append(pool.submit(one, FALLBACK_MODEL))
        last: Exception | None = None
        try:
            for f in as_completed(futures, timeout=max(deadline - time.monotonic(), 0.1)):
                try:
                    return f.result()
                except Exception as exc:  # API error or malformed JSON: wait for the other call
                    last = exc
        except FuturesTimeout as exc:
            last = exc
        raise RuntimeError("ai_unavailable") from last
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def _to_lkr(budget: Any) -> int | None:
    try:
        amount = float(budget["amount"])
        code = str(budget["currency"]).upper()
    except (TypeError, KeyError, ValueError):
        return None
    if code == "LKR":
        return round(amount)
    rate = (currency.get_rates() or {}).get(code)
    return round(amount / rate) if rate else None


def create_draft(client, model: str, request: str, language: str, timeout_ms: int) -> dict[str, Any]:
    prompt = DRAFT_PROMPT.format(
        rules=OPTION_RULES, language=language,
        catalogue=database.get_packages_summary_for_prompt(), options=_options_text(),
    )
    raw = _json(client, model, prompt, request, timeout_ms, _DraftOut)
    pkg_id = str(raw.get("package_id", ""))
    if not database.get_package_by_id(pkg_id):
        raise LookupError("no_match")

    unmet = list(raw.get("unmet", []))
    travelers = raw.get("travelers") if isinstance(raw.get("travelers"), int) else 2
    travelers = max(1, min(30, travelers))
    selections = raw.get("selections") or {}
    try:
        q = builder.quote(pkg_id, travelers, selections)
    except ValueError:
        # Never keep a selection we couldn't validate: fall back to the included defaults.
        selections = {}
        q = builder.quote(pkg_id, travelers, selections)
    return {
        "package_id": pkg_id,
        "travelers": travelers,
        "selections": q["selections"],
        "travel_month": str(raw.get("travel_month", ""))[:30],
        "budget_lkr": _to_lkr(raw.get("budget")),
        "why_it_fits": raw.get("why_it_fits", ""),
        "assumptions": raw.get("assumptions", []),
        "unmet": unmet,
        "total_lkr": q["total_lkr"],
    }


def assist(client, model: str, package_id: str, travelers: int, selections: dict[str, Any], budget_lkr: int | None,
           message: str, language: str, timeout_ms: int) -> dict[str, Any]:
    current = builder.quote(package_id, travelers, selections)
    prompt = ASSIST_PROMPT.format(
        rules=OPTION_RULES, language=language, package_id=package_id, travelers=travelers,
        selections=json.dumps(current["selections"]), total=f"{current['total_lkr']:,}",
        budget=f"LKR {budget_lkr:,}" if budget_lkr else "not set",
        catalogue=database.get_packages_summary_for_prompt(), options=_options_text(package_id),
    )
    raw = _json(client, model, prompt, message, timeout_ms, _AssistOut)
    proposal = None
    ch = raw.get("changes")
    if isinstance(ch, dict):
        new_travelers = ch.get("travelers") if isinstance(ch.get("travelers"), int) else travelers
        merged = {**current["selections"], **(ch.get("selections") or {})}
        try:
            q = builder.quote(package_id, max(1, min(30, new_travelers)), merged)
            if q["selections"] != current["selections"] or q["travelers"] != travelers:
                proposal = {
                    "travelers": q["travelers"], "selections": q["selections"], "total_lkr": q["total_lkr"],
                    "delta_lkr": q["total_lkr"] - current["total_lkr"],
                }
        except ValueError:
            proposal = None  # invalid ids are dropped, never applied
    return {"reply": raw.get("reply", ""), "proposal": proposal}


def savings(package_id: str, travelers: int, selections: dict[str, Any], budget_lkr: int) -> dict[str, Any]:
    """Deterministic option downgrades with exact savings (works with the AI offline)."""
    current = builder.quote(package_id, travelers, selections)
    out = {"current_lkr": current["total_lkr"], "budget_lkr": budget_lkr,
           "over_by_lkr": max(0, current["total_lkr"] - budget_lkr), "suggestions": []}
    if out["over_by_lkr"] == 0:
        return out
    out["reality"] = budget_reality(package_id, travelers, selections, budget_lkr)
    data = builder.get_builder(package_id, "en")
    for g in data["groups"]:
        chosen = current["selections"].get(g["id"], [])
        label = {o["id"]: o["label"] for o in g["options"]}
        if g["multi"]:
            candidates = [(cid, None, [x for x in chosen if x != cid]) for cid in chosen]  # drop one extra
        else:
            candidates = [(chosen[0], o["id"], o["id"]) for o in g["options"] if o["id"] != chosen[0]]
        for cid, to_id, value in candidates:
            new_sel = {**current["selections"], g["id"]: value}
            q = builder.quote(package_id, travelers, new_sel)
            saving = current["total_lkr"] - q["total_lkr"]
            if saving > 0:
                out["suggestions"].append({
                    "group": g["id"], "group_label": g["label"], "from": label[cid],
                    "to": label[to_id] if to_id else None, "selections": q["selections"],
                    "saving_lkr": saving, "new_total_lkr": q["total_lkr"],
                    "meets_budget": q["total_lkr"] <= budget_lkr,
                })
    # one suggestion per (group, from, to); biggest saving first
    seen, uniq = set(), []
    for s in sorted(out["suggestions"], key=lambda s: -s["saving_lkr"]):
        key = (s["group"], s["from"], s["to"])
        if key not in seen:
            seen.add(key)
            uniq.append(s)
    out["suggestions"] = uniq[:6]
    return out


def stay_variants(pkg: dict[str, Any], travelers: int) -> list[dict[str, int]]:
    """Indicative shorter versions of a package: official price pro-rata per day.
    These are NOT catalogue products; they must be confirmed with us in the Package Builder."""
    per_day = pkg["price_lkr"] / pkg["duration_days"]
    unit = travelers if builder.BASE_PRICE_BASIS == "per_person" else 1
    return [
        {"days": n, "nights": max(n - 1, 0), "price_lkr": round(per_day * n * unit)}
        for n in range(pkg["duration_days"] - 1, 0, -1)
    ]


def floor_quote(package_id: str, travelers: int) -> dict[str, Any]:
    """Cheapest valid combination: the lowest-priced option in every single-choice group, no extras."""
    data = builder.get_builder(package_id, "en")
    picks = {}
    for g in data["groups"]:
        if g["multi"]:
            continue
        picks[g["id"]] = min(
            g["options"],
            key=lambda o: builder._amount(o["price_lkr"], o["price_type"], travelers, data["package"]["duration_nights"]),
        )["id"]
    return builder.quote(package_id, travelers, picks)


def budget_reality(package_id: str, travelers: int, selections: dict[str, Any], budget_lkr: int) -> dict[str, Any]:
    """Why the package costs what it does and the honest floor, for the over-budget panel."""
    pkg = database.get_package_by_id(package_id)
    floor = floor_quote(package_id, travelers)
    variants = stay_variants(pkg, travelers)
    return {
        "floor_lkr": floor["total_lkr"],
        "gap_to_floor_lkr": max(0, floor["total_lkr"] - budget_lkr),
        "inclusions": pkg["inclusions"],
        "shorter_stays": [dict(v, meets_budget=v["price_lkr"] <= budget_lkr) for v in variants],
    }


def price_levers_text() -> str:
    """Per-package price facts injected into the chat prompt so Aura explains budget gaps with real numbers."""
    lines = ["# PRICE LEVERS (use these exact figures when a budget is below a package)"]
    for pkg in database.get_all_packages():
        per_day = round(pkg["price_lkr"] / pkg["duration_days"])
        floor = floor_quote(pkg["id"], 2)
        cut = pkg["price_lkr"] - floor["total_lkr"]
        lines.append(f"### [{pkg['id']}] {pkg['title']}")
        lines.append(f"- Official price LKR {pkg['price_lkr']:,} for the whole booking, {pkg['duration_days']} days / {pkg['duration_nights']} nights.")
        lines.append(f"- LOWEST with option changes (2 travelers, lower-cost options, no extras): LKR {floor['total_lkr']:,}"
                     + (f" — only LKR {cut:,} below the official price." if cut else " — the official price is already the lowest; options only add cost."))
        lines.append(f"- Indicative pro-rata per day: LKR {per_day:,}. Shorter versions (indicative, not official products; final price confirmed in the Package Builder): "
                     + ", ".join(f"{v['days']} days ≈ LKR {v['price_lkr']:,}" for v in stay_variants(pkg, 1)) + ".")
        paid = []
        data = builder.get_builder(pkg["id"], "en")
        for g in data["groups"]:
            for o in g["options"]:
                if o["price_lkr"]:
                    paid.append(f"{o['label']} {o['price_lkr']:+,} {o['price_type']}")
        lines.append("- Option price changes (placeholder rates): " + "; ".join(paid) + ".")
    return "\n".join(lines)


def budget_check_tool(package_id: str, budget_lkr: int, travelers: int = 2) -> dict[str, Any]:
    """Exact budget analysis for a package. Call this whenever a traveler's budget (converted to LKR) is below the price of the package that fits their occasion. Returns verified figures to quote.

    Args:
        package_id: Catalogue package id, e.g. NOC-ROM-06.
        budget_lkr: The traveler's budget converted to Sri Lankan rupees.
        travelers: Number of travelers (default 2).
    """
    pkg = database.get_package_by_id(package_id)
    if not pkg:
        return {"error": "unknown package id"}
    r = budget_reality(package_id, max(1, travelers), {}, int(budget_lkr))
    official = pkg["price_lkr"]
    return {
        "package": f"[{pkg['id']}] {pkg['title']}",
        "official_price_lkr": official,
        "budget_lkr": int(budget_lkr),
        "gap_to_official_lkr": max(0, official - int(budget_lkr)),
        "inclusions_that_make_up_the_price": pkg["inclusions"],
        "lowest_with_lower_cost_options_lkr": r["floor_lkr"],
        "saving_from_options_lkr": official - r["floor_lkr"],
        "gap_remaining_after_options_lkr": r["gap_to_floor_lkr"],
        "shorter_stay_indicative": [
            {"days": v["days"], "nights": v["nights"], "price_lkr": v["price_lkr"], "fits_budget": v["meets_budget"]}
            for v in r["shorter_stays"]
        ],
        "how_to_present": (
            "Do NOT suggest any other package. Show: (1) why the official price is what it is, using the inclusions; "
            "(2) the gap; (3) the lowest price with lower-cost options and the exact saving, saying plainly if a gap remains; "
            "(4) each shorter-stay figure as INDICATIVE (final price confirmed in the Package Builder) and whether it fits, "
            "and what fewer days gives up; (5) ask which route they prefer and offer to open the Package Builder. "
            "Do not invent any other discount or substitution."
        ),
    }
