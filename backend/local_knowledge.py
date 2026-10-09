"""Local source-backed Northern tourism concepts, separate from sellable packages."""
import json
import re
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "northern_tourism_knowledge.json"


def build_local_context(query=""):
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    lines = ["# LOCAL NORTHERN TOURISM EXPERIENCE CONCEPTS",
        "These are user-supplied planning concepts, NOT active or confirmed bookable packages. "
        "Discuss them as proposed experiences requiring a custom quote and supplier confirmation. "
        "Their IDs are source references only; NEVER put NORTH-CONCEPT IDs into the builder, quote or booking APIs. "
        "The active SQLite catalogue is authoritative for sellable packages, itinerary days and priced selections.",
        "Brand promise: " + data["tagline"], "Geographic concept coverage: " + ", ".join(data["coverage"]),
        data["pricing_policy"], *data["principles"],
        "Local language: Tamil is an important language for Jaffna hosts; offer Tamil, Sinhala or the customer's "
        "chosen language without assuming their ethnicity, religion or nationality. Retain names such as Nallur, "
        "Nainativu, Keerimalai, Nel Nadavu, Nel Aruvadai and Maattu Vandi with a brief explanation when useful. "
        "Speak naturally in the customer's language; do not claim a guide speaks it unless confirmed.",
        "Concept directory (indicative source ranges; units must stay unchanged):"]
    for product in data["products"]:
        lines.append(f"{product['id']} | {product['name']} | {product['duration']} | {product.get('indicative_price', 'custom quote')}")
    terms = {word.casefold() for word in re.findall(r"[^\W_]+", query) if len(word) >= 4}
    scored = sorted(data["products"], key=lambda p: sum(term in (p["name"] + " " + p.get("experiences", "")).casefold() for term in terms), reverse=True)
    for product in scored[:3]:
        if any(term in (product["name"] + " " + product.get("experiences", "")).casefold() for term in terms):
            lines.append("Relevant source detail: " + json.dumps(product, ensure_ascii=False))
    lines.append("If a concept is not offered as an active package, preserve it as a customer wish for staff review. "
                 "Never silently replace their wish or imply all proposed activities are already selectable. "
                 "A request for all available packages uses the complete ACTIVE directory; distinguish proposed "
                 "experience concepts if the customer also asks about those.")
    return "\n".join(lines)
