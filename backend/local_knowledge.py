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
    lines.extend([
        "# COMMON CUSTOMER QUESTIONS AND PERSONAL PREFERENCES",
        "Price negotiation: compare verified lower-cost choices or fewer days/extras while retaining the customer's "
        "trip theme and non-negotiable preferences. Ask for their total budget; never invent discounts, child rates "
        "or group offers. Keep per-person and whole-booking amounts separate.",
        "Facilities: describe only documented inclusions. Confirm room type, private bathroom, air conditioning, "
        "Wi-Fi, meal arrangements, vehicle privacy, toilets, accessibility and supplements for the specific provider. "
        "An unknown facility is a request to verify, not an included service.",
        "Crowds and privacy: translate 'my girlfriend doesn't like people' into quiet venues, low interaction "
        "and private arrangements by asking which matters. Do not diagnose, stereotype, or promise empty public "
        "places. Obtain permission for photos and request no publication when wanted.",
        "Cleanliness and disclosed OCD: acknowledge the preference respectfully and ask about concrete arrangements "
        "such as fresh linen, private bathroom or pre-arrival cleaning. Confirm those with the provider; never "
        "promise sterility, absence of germs, treatment or clinical suitability, or repeatedly reassure about "
        "contamination. Do not request medical history. Share practical preferences rather than a diagnosis unless "
        "the customer explicitly authorizes disclosure; honor private staff-review preferences.",
        "Family and access: ask only relevant needs, preserve group corrections, and confirm mobility access, child "
        "equipment and food preparation instead of assuming suitability. No guaranteed allergy-safe kitchens.",
        "Payments, changes and refunds follow written provider terms. Chat never charges or confirms bookings. "
        "Weather, ferry operation, harvesting and wildlife sightings require current provider checks. Ask one "
        "relevant follow-up, remembering what is already known; respond in the customer's language.",
    ])
    examples = [json.loads(line) for line in DATA_PATH.with_name("jaffna_conversations.jsonl").read_text(encoding="utf-8").splitlines()]
    faqs = [e for e in examples if e["id"].startswith("faq_")]
    useful_terms = terms - {"what", "have", "want", "like", "with", "please", "there", "that", "this", "your", "very"}
    ranked = sorted(faqs, key=lambda e: sum(term in e["messages"][0]["content"].casefold() for term in useful_terms), reverse=True)
    for example in ranked[:2]:
        if any(term in example["messages"][0]["content"].casefold() for term in useful_terms):
            lines.append("Illustrative FAQ, not supplier confirmation; adapt to current conversation and language: "
                         + json.dumps(example["messages"], ensure_ascii=False))
    return "\n".join(lines)
