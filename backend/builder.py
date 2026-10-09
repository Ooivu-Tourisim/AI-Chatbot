"""Package Builder: option groups inside a package, live quotes, and booking *requests*.

The platform books hotels, meals and transport itself, so customers never pay suppliers
individually. They pick from the options we publish for a package and get one price.

Pricing: total = package base price + the price adjustment of every chosen option.
Nothing is booked or charged here. Submitting creates a booking REQUEST (status
"requested") that our team confirms with the customer.

!! The option prices in SEED_GROUPS are PLACEHOLDERS so the builder works end to end.
   Replace them with your real rates (edit the table `package_options` or the seed below).
"""

import json
import re
import secrets
from typing import Any

import database

# Price basis for the package base price and "per_person*" option prices.
# "flat": the published package price covers the whole booking (e.g. a couple's trip); only
# per_person* options scale with travelers. Use "per_person" if prices are per traveler.
BASE_PRICE_BASIS = "flat"

LANGS = ("en", "zh", "es", "fr", "de", "ko")

KOREAN_LABELS = {
    "Hotel tier": "숙박 등급", "Standard (included)": "스탠다드 (포함)",
    "Comfort room (lower cost)": "컴포트 객실 (저렴한 옵션)", "Superior": "슈페리어", "Luxury": "럭셔리",
    "Meal plan": "식사 옵션", "Breakfast only (included)": "조식만 (포함)",
    "Half board": "조식 및 석식", "Full board": "모든 식사",
    "Transport": "교통", "Shared transfers (included)": "공용 이동 서비스 (포함)",
    "Private air-conditioned vehicle": "에어컨이 있는 전용 차량", "Extras": "추가 옵션",
    "Private local guide": "전용 현지 가이드", "Photography session": "사진 촬영",
}


def option_label(raw: str, lang: str) -> str:
    labels = json.loads(raw)
    if lang == "ko":
        return labels.get("ko") or KOREAN_LABELS.get(labels["en"], labels["en"])
    return labels.get(lang) or labels["en"]


def _l(en, zh, es, fr, de):
    return dict(zip(LANGS, (en, zh, es, fr, de)))


# price_type: flat | per_person | per_person_night
SEED_GROUPS = [
    {
        "id": "hotel", "multi": False, "required": True,
        "label": _l("Hotel tier", "酒店等级", "Categoría de hotel", "Catégorie d'hôtel", "Hotelkategorie"),
        "options": [
            {"id": "standard", "price": 0, "type": "per_person_night", "default": True,
             "label": _l("Standard (included)", "标准（已包含）", "Estándar (incluido)", "Standard (inclus)", "Standard (inklusive)")},
            {"id": "comfort", "price": -4000, "type": "per_person_night",
             "label": _l("Comfort room (lower cost)", "舒适房（更省）", "Habitación confort (menor coste)", "Chambre confort (moins cher)", "Komfortzimmer (günstiger)")},
            {"id": "superior", "price": 6000, "type": "per_person_night",
             "label": _l("Superior", "高级", "Superior", "Supérieur", "Superior")},
            {"id": "luxury", "price": 15000, "type": "per_person_night",
             "label": _l("Luxury", "豪华", "Lujo", "Luxe", "Luxus")},
        ],
    },
    {
        "id": "meals", "multi": False, "required": True,
        "label": _l("Meal plan", "餐饮计划", "Plan de comidas", "Formule repas", "Verpflegung"),
        "options": [
            {"id": "breakfast", "price": 0, "type": "per_person_night", "default": True,
             "label": _l("Breakfast only (included)", "仅含早餐（已包含）", "Solo desayuno (incluido)", "Petit-déjeuner seul (inclus)", "Nur Frühstück (inklusive)")},
            {"id": "half", "price": 3500, "type": "per_person_night",
             "label": _l("Half board", "半膳", "Media pensión", "Demi-pension", "Halbpension")},
            {"id": "full", "price": 6000, "type": "per_person_night",
             "label": _l("Full board", "全膳", "Pensión completa", "Pension complète", "Vollpension")},
        ],
    },
    {
        "id": "transport", "multi": False, "required": True,
        "label": _l("Transport", "交通", "Transporte", "Transport", "Transport"),
        "options": [
            {"id": "shared", "price": 0, "type": "flat", "default": True,
             "label": _l("Shared transfers (included)", "拼车接送（已包含）", "Traslados compartidos (incluido)", "Transferts partagés (inclus)", "Gemeinsame Transfers (inklusive)")},
            {"id": "private", "price": 25000, "type": "flat",
             "label": _l("Private air-conditioned vehicle", "私人空调车辆", "Vehículo privado con aire acondicionado", "Véhicule privé climatisé", "Privates klimatisiertes Fahrzeug")},
        ],
    },
    {
        "id": "extras", "multi": True, "required": False,
        "label": _l("Extras", "附加项目", "Extras", "Options", "Extras"),
        "options": [
            {"id": "guide", "price": 15000, "type": "flat",
             "label": _l("Private local guide", "私人当地向导", "Guía local privado", "Guide local privé", "Privater lokaler Guide")},
            {"id": "photo", "price": 8000, "type": "per_person",
             "label": _l("Photography session", "摄影体验", "Sesión de fotografía", "Séance photo", "Fotoshooting")},
        ],
    },
]


def init() -> None:
    with database.get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS package_options (
                package_id TEXT NOT NULL,
                group_id TEXT NOT NULL,
                option_id TEXT NOT NULL,
                is_multi INTEGER NOT NULL,
                is_required INTEGER NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0,
                price_lkr INTEGER NOT NULL,
                price_type TEXT NOT NULL,
                group_label TEXT NOT NULL,
                label TEXT NOT NULL,
                sort INTEGER NOT NULL,
                PRIMARY KEY (package_id, group_id, option_id)
            );
            CREATE TABLE IF NOT EXISTS booking_requests (
                reference TEXT PRIMARY KEY,
                package_id TEXT NOT NULL,
                travelers INTEGER NOT NULL,
                travel_date TEXT,
                selections TEXT NOT NULL,
                total_lkr INTEGER NOT NULL,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'requested',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        # New options are added to every package; existing rows keep their (possibly edited) rates, only the display order is refreshed.
        for pkg in database.get_all_packages():
            sort = 0
            for g in SEED_GROUPS:
                for o in g["options"]:
                    sort += 1
                    conn.execute(
                        "INSERT INTO package_options (package_id, group_id, option_id, is_multi, is_required, is_default, price_lkr, price_type, group_label, label, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?) "
                        "ON CONFLICT(package_id, group_id, option_id) DO UPDATE SET sort = excluded.sort",
                        (pkg["id"], g["id"], o["id"], int(g["multi"]), int(g["required"]),
                         int(o.get("default", False)), o["price"], o["type"],
                         json.dumps(g["label"], ensure_ascii=False), json.dumps(o["label"], ensure_ascii=False), sort),
                    )
        columns = {r[1] for r in conn.execute("PRAGMA table_info(package_options)")}
        if "icon_name" not in columns:
            conn.execute("ALTER TABLE package_options ADD COLUMN icon_name TEXT NOT NULL DEFAULT 'sparkles'")
        for group, icon in {"hotel": "bed", "meals": "food", "transport": "vehicle"}.items():
            conn.execute("UPDATE package_options SET icon_name = ? WHERE group_id = ? AND icon_name = 'sparkles'", (icon, group))
        for option, icon in {"guide": "guide", "photo": "camera"}.items():
            conn.execute("UPDATE package_options SET icon_name = ? WHERE group_id = 'extras' AND option_id = ? AND icon_name = 'sparkles'", (icon, option))
        conn.commit()


def _load(package_id: str) -> list[dict[str, Any]]:
    with database.get_connection() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM package_options WHERE package_id = ? ORDER BY sort, rowid", (package_id,))]


def get_builder(package_id: str, lang: str = "en") -> dict[str, Any] | None:
    pkg = database.get_package_by_id(package_id)
    if not pkg:
        return None
    lang = lang if lang in LANGS else "en"
    groups: dict[str, dict[str, Any]] = {}
    for r in _load(package_id):
        g = groups.setdefault(r["group_id"], {
            "id": r["group_id"], "multi": bool(r["is_multi"]), "required": bool(r["is_required"]),
            "label": option_label(r["group_label"], lang), "options": [],
        })
        g["options"].append({
            "id": r["option_id"], "icon_name": r["icon_name"], "label": option_label(r["label"], lang),
            "price_lkr": r["price_lkr"], "price_type": r["price_type"], "default": bool(r["is_default"]),
        })
    return {
        "package": {k: pkg[k] for k in ("id", "title", "tagline", "category", "icon_name", "duration_days", "duration_nights", "price_lkr", "destinations", "highlights", "itinerary", "inclusions", "exclusions", "best_for")},
        "price_basis": BASE_PRICE_BASIS,
        "groups": list(groups.values()),
    }


def _amount(price: int, ptype: str, travelers: int, nights: int) -> int:
    if ptype == "per_person_night":
        return price * travelers * nights
    if ptype == "per_person":
        return price * travelers
    return price


def quote(package_id: str, travelers: int, selections: dict[str, Any], *, base_lkr: int | None = None, nights: int | None = None) -> dict[str, Any]:
    """Validate the selections and price them in code. Raises ValueError on bad input."""
    pkg = database.get_package_by_id(package_id)
    if not pkg:
        raise ValueError("unknown_package")
    rows = _load(package_id)
    by_group: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        by_group.setdefault(r["group_id"], []).append(r)

    base_price = pkg["price_lkr"] if base_lkr is None else base_lkr
    base = base_price * travelers if BASE_PRICE_BASIS == "per_person" else base_price
    lines = [{"kind": "base", "label": pkg["title"], "amount_lkr": base}]
    chosen: dict[str, list[str]] = {}

    for gid, opts in by_group.items():
        raw = selections.get(gid)
        ids = [raw] if isinstance(raw, str) else list(raw or [])
        if not ids and opts[0]["is_required"]:
            ids = [o["option_id"] for o in opts if o["is_default"]][:1]
        valid = {o["option_id"]: o for o in opts}
        if len(set(ids)) != len(ids) or any(i not in valid for i in ids) or (not opts[0]["is_multi"] and len(ids) > 1):
            raise ValueError("bad_selection")
        if opts[0]["is_required"] and not ids:
            raise ValueError("missing_selection")
        chosen[gid] = ids
        for i in ids:
            o = valid[i]
            amt = _amount(o["price_lkr"], o["price_type"], travelers, pkg["duration_nights"] if nights is None else nights)
            if amt:
                lines.append({"kind": "option", "group": gid, "option": i,
                              "label": json.loads(o["label"])["en"], "amount_lkr": amt})

    return {"package_id": package_id, "travelers": travelers, "selections": chosen,
            "lines": lines, "total_lkr": sum(l["amount_lkr"] for l in lines)}


_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_request(q: dict[str, Any], name: str, email: str, phone: str, travel_date: str, notes: str) -> str:
    """Store a booking REQUEST. No payment is taken and nothing is confirmed with suppliers."""
    if not _EMAIL.match(email):
        raise ValueError("bad_email")
    ref = "REQ-" + secrets.token_hex(3).upper()
    with database.get_connection() as conn:
        conn.execute(
            "INSERT INTO booking_requests (reference, package_id, travelers, travel_date, selections, total_lkr,"
            " customer_name, customer_email, customer_phone, notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (ref, q["package_id"], q["travelers"], travel_date or None, json.dumps(q["selections"]),
             q["total_lkr"], name.strip(), email.strip(), phone.strip() or None, notes.strip() or None),
        )
        conn.commit()
    return ref
