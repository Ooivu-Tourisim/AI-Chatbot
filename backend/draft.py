"""Editable trip drafts, budget substitutions and SmartPack checklists.

Everything here is a *proposal*: nothing is booked, charged or confirmed. The LLM only
chooses which verified catalogue days to combine; names, activities and prices are always
read back from the database, and totals are computed in code, never by the model.

Price rule: the catalogue only stores whole-package prices, so a single day is costed as
the package's official LKR price divided by its number of days (pro-rata). Customised
totals are therefore indicative until confirmed in the Package Builder.
"""

import json
import re
from typing import Any

import database

DRAFT_INSTRUCTIONS = """You design a DRAFT trip from a verified catalogue. Output JSON only.

Rules:
- Use ONLY package ids and day numbers that appear in the catalogue below. Never invent hotels, activities, prices, availability or travel times.
- Rank by how well days fit the traveler's stated interests, group, pace and duration. Price may matter only through the traveler's own budget. Never favour anything for commission or sponsorship (there is no such data).
- Pick a coherent, geographically sensible sequence of days (one entry per trip day).
- If a requirement cannot be met from the catalogue (dates/availability cannot be verified, hotel tier, a destination or activity that is not listed, live weather), list it in "unmet" with a short honest reason. Do not pretend to satisfy it.
- Write "title", "why_it_fits", "assumptions" and "unmet" in {language}.

JSON shape:
{{"title": str, "why_it_fits": str, "days": [{{"package_id": str, "day": int}}], "assumptions": [str], "unmet": [str]}}

{catalogue}
"""

CHECKLIST_INSTRUCTIONS = """Create a personalised packing checklist for this trip in {language}. Output JSON only.

Trip days:
{days}
Travel month (may be unknown): {month}

Rules:
- Base items on the destinations and activities listed and on Sri Lanka's general climate for the month. You have NO live weather data: never state a forecast or current conditions; if the month is unknown, say so in "note".
- 18-28 short items, grouped into categories such as Documents, Clothing, Health, Gear, Money. Do not invent bookings or services.

JSON shape: {{"note": str, "categories": [{{"name": str, "items": [str]}}]}}
"""


def _parse_json(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    return json.loads(text)


def _index() -> dict[str, dict[str, Any]]:
    return {p["id"]: p for p in database.get_all_packages()}


def day_cost(pkg: dict[str, Any]) -> int:
    return round(pkg["price_lkr"] / max(pkg["duration_days"], 1))


def hydrate(refs: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """Turn [{package_id, day}] into full day records read from the catalogue.
    Unknown references are dropped and reported, never guessed."""
    idx = _index()
    out, dropped = [], []
    for r in refs:
        pkg = idx.get(str(r.get("package_id")))
        day = next((d for d in (pkg or {}).get("itinerary", []) if d["day"] == r.get("day")), None)
        if not pkg or not day:
            dropped.append(f"{r.get('package_id')} day {r.get('day')}")
            continue
        out.append({
            "package_id": pkg["id"],
            "package_title": pkg["title"],
            "day": day["day"],
            "title": day["title"],
            "activities": day["activities"],
            "cost_lkr": day_cost(pkg),
        })
    return out, dropped


def total_lkr(days: list[dict[str, Any]]) -> int:
    """Whole package price when every day of one package is present, otherwise pro-rata."""
    idx = _index()
    by_pkg: dict[str, int] = {}
    for d in days:
        by_pkg[d["package_id"]] = by_pkg.get(d["package_id"], 0) + 1
    total = 0
    for pid, n in by_pkg.items():
        pkg = idx[pid]
        total += pkg["price_lkr"] if n == pkg["duration_days"] else day_cost(pkg) * n
    return total


def build_draft(client, model: str, request: str, language: str, timeout_ms: int) -> dict[str, Any]:
    from google.genai import types

    prompt = DRAFT_INSTRUCTIONS.format(
        language=language, catalogue=database.get_packages_summary_for_prompt()
    )
    resp = client.models.generate_content(
        model=model,
        contents=request,
        config=types.GenerateContentConfig(
            system_instruction=prompt,
            response_mime_type="application/json",
            max_output_tokens=2000,
            http_options=types.HttpOptions(timeout=timeout_ms),
        ),
    )
    raw = _parse_json(resp.text)
    days, dropped = hydrate(raw.get("days", []))
    unmet = list(raw.get("unmet", []))
    return {
        "status": "draft",  # never "booked": the customer confirms in the Package Builder
        "title": raw.get("title", "Your draft journey"),
        "why_it_fits": raw.get("why_it_fits", ""),
        "days": days,
        "assumptions": raw.get("assumptions", []),
        "unmet": unmet,
        "dropped": dropped,
        "total_lkr": total_lkr(days) if days else 0,
    }


def optimise(refs: list[dict[str, Any]], budget_lkr: int) -> dict[str, Any]:
    """Suggest cheaper verified swaps for the costliest days. Savings are exact under the
    pro-rata rule above. Suggestions are options only; the customer picks."""
    days, _ = hydrate(refs)
    current = total_lkr(days)
    result = {"current_lkr": current, "budget_lkr": budget_lkr, "over_by_lkr": max(0, current - budget_lkr), "suggestions": []}
    if current <= budget_lkr:
        return result

    idx = _index()
    for i, d in enumerate(days):
        for pkg in idx.values():
            cheaper = day_cost(pkg)
            if cheaper >= d["cost_lkr"]:
                continue
            for alt in pkg["itinerary"]:
                if any(x["package_id"] == pkg["id"] and x["day"] == alt["day"] for x in days):
                    continue
                swapped = days[:i] + [{**d, "package_id": pkg["id"], "day": alt["day"]}] + days[i + 1:]
                saving = current - total_lkr(swapped)
                if saving <= 0:
                    continue
                result["suggestions"].append({
                    "replace_index": i,
                    "from": {"package_id": d["package_id"], "day": d["day"], "title": d["title"], "activities": d["activities"]},
                    "to": {"package_id": pkg["id"], "day": alt["day"], "title": alt["title"], "activities": alt["activities"], "package_title": pkg["title"]},
                    "saving_lkr": saving,
                    "new_total_lkr": current - saving,
                    "meets_budget": current - saving <= budget_lkr,
                })
    result["suggestions"].sort(key=lambda s: (-s["meets_budget"], -s["saving_lkr"]))
    result["suggestions"] = result["suggestions"][:6]
    result["note"] = "Each option swaps one day for a verified day from another package. Compare the activities before accepting — nothing changes until you choose."
    return result


def build_checklist(client, model: str, refs: list[dict[str, Any]], month: str, language: str, timeout_ms: int) -> dict[str, Any]:
    from google.genai import types

    days, _ = hydrate(refs)
    lines = "\n".join(f"- Day {i + 1}: {d['title']} — {d['activities']}" for i, d in enumerate(days))
    resp = client.models.generate_content(
        model=model,
        contents=CHECKLIST_INSTRUCTIONS.format(language=language, days=lines, month=month or "unknown"),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            max_output_tokens=1500,
            http_options=types.HttpOptions(timeout=timeout_ms),
        ),
    )
    raw = _parse_json(resp.text)
    return {"note": raw.get("note", ""), "categories": raw.get("categories", [])}

