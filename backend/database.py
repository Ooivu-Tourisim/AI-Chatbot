"""SQLite database for North of Ceylon package details.

Provides sample packages and query functions used to ground Aura's responses.
"""

import json
import os
import sqlite3
from typing import Any, Dict, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "packages.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create the packages table and populate it with sample data if empty."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS packages (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                tagline TEXT NOT NULL,
                category TEXT NOT NULL,
                duration_days INTEGER NOT NULL,
                duration_nights INTEGER NOT NULL,
                price_lkr INTEGER NOT NULL,
                price_usd INTEGER NOT NULL,
                destinations TEXT NOT NULL,
                highlights TEXT NOT NULL,
                itinerary TEXT NOT NULL,
                inclusions TEXT NOT NULL,
                exclusions TEXT NOT NULL,
                best_for TEXT NOT NULL,
                is_active INTEGER DEFAULT 1
            )
            """
        )

        cursor.execute("SELECT COUNT(*) FROM packages")
        if cursor.fetchone()[0] == 0:
            sample_packages = [
                {
                    "id": "NOC-JAF-01",
                    "title": "Jaffna Heritage & Kingdom Odyssey",
                    "tagline": "Walk through centuries of Tamil heritage, royal ruins, and Dutch colonial fortifications.",
                    "category": "Cultural Heritage",
                    "duration_days": 4,
                    "duration_nights": 3,
                    "price_lkr": 145000,
                    "price_usd": 460,
                    "destinations": [
                        "Jaffna City",
                        "Nallur",
                        "Point Pedro",
                        "Keerimalai",
                    ],
                    "highlights": [
                        "Nallur Kandaswamy Kovil evening puja ceremony",
                        "Jaffna Dutch Fort sunset ramparts walk",
                        "Historic Jaffna Public Library and clock tower",
                        "Sangilean King's palace entrance ruins and Yamuna Eri",
                        "Point Pedro lighthouse — the northernmost point of Sri Lanka",
                        "Sacred fresh water springs at Keerimalai adjacent to the ocean",
                    ],
                    "itinerary": [
                        {
                            "day": 1,
                            "title": "Arrival & Colonial Fort",
                            "activities": "Check into boutique hotel, afternoon heritage walk through Jaffna Fort, sunset over Jaffna lagoon, welcome dinner.",
                        },
                        {
                            "day": 2,
                            "title": "Royal Kingdom & Sacred Temples",
                            "activities": "Morning visit to King Sangilean ruins and Yamuna pond; traditional vegetarian lunch; evening darshan at iconic Nallur Kandaswamy Kovil.",
                        },
                        {
                            "day": 3,
                            "title": "Northern Tip & Sacred Springs",
                            "activities": "Scenic coastal drive to Point Pedro lighthouse; bath/refreshment at Keerimalai sacred water spring; visit Dambakola Patuna ancient port.",
                        },
                        {
                            "day": 4,
                            "title": "Bazaars & Departure",
                            "activities": "Morning shopping at Jaffna market (spices, palmyrah crafts, jaggery); Jaffna library visit; airport/train station drop-off.",
                        },
                    ],
                    "inclusions": [
                        "3 nights accommodation in 3-star boutique heritage hotel",
                        "Daily breakfast and traditional dinners",
                        "Private AC vehicle with dedicated English/Tamil speaking chauffeur-guide",
                        "All entrance tickets and temple offerings",
                        "Bottled mineral water throughout tour",
                    ],
                    "exclusions": [
                        "Train/flight tickets to Jaffna",
                        "Lunch and personal beverages",
                        "Camera permits at specific monuments",
                        "Gratuities / tips",
                    ],
                    "best_for": "History lovers, families, cultural travelers",
                },
                {
                    "id": "NOC-ISL-02",
                    "title": "Delft Island & Palk Strait Coastal Explorer",
                    "tagline": "Discover wild ponies, baobab trees, coral walls, and sacred island shrines.",
                    "category": "Coastal & Islands",
                    "duration_days": 3,
                    "duration_nights": 2,
                    "price_lkr": 110000,
                    "price_usd": 350,
                    "destinations": [
                        "Kurikadduwan Jetty",
                        "Delft Island (Neduntheevu)",
                        "Nainativu (Nagadeepa)",
                    ],
                    "highlights": [
                        "Boat crossing across the Palk Strait",
                        "Wild horses roaming the windswept coral plains of Delft Island",
                        "Centuries-old Giant Baobab tree planted by Arab traders",
                        "Colonial Dutch Fort and Queen's Tower navigation beacon",
                        "Nagadeepa Purana Viharaya (Buddhist shrine) and Nagapooshani Amman Temple on Nainativu",
                    ],
                    "itinerary": [
                        {
                            "day": 1,
                            "title": "Ferry Crossing & Delft Wild Plains",
                            "activities": "Drive across scenic causeways to KKD jetty; passenger ferry to Delft Island; local open-top truck safari to see wild ponies, baobab tree, and coral stone stables.",
                        },
                        {
                            "day": 2,
                            "title": "Sacred Nainativu Island",
                            "activities": "Ferry to Nainativu island; visit sacred Nagadeepa Temple and Sri Nagapooshani Amman Kovil; fresh crab feast on return to mainland.",
                        },
                        {
                            "day": 3,
                            "title": "Karainagar Coastal Farewell",
                            "activities": "Morning swim at Casuarina beach; palmyra craft cooperative visit; departure transfers.",
                        },
                    ],
                    "inclusions": [
                        "2 nights comfortable resort accommodation",
                        "Daily breakfast & 1 signature island seafood lunch",
                        "All island ferry tickets and Delft open truck safari permits",
                        "Private chauffeured AC vehicle for mainland transfers",
                        "Local island guide escort",
                    ],
                    "exclusions": [
                        "Dinners",
                        "Special pooja archana receipts",
                        "Personal expenses",
                    ],
                    "best_for": "Adventurers, photographers, couples",
                },
                {
                    "id": "NOC-CUL-03",
                    "title": "Northern Ceylon Culinary & Crab Safari",
                    "tagline": "An authentic sensory feast featuring Jaffna crab curry, palmyrah treats, and spice markets.",
                    "category": "Culinary & Foodie",
                    "duration_days": 3,
                    "duration_nights": 2,
                    "price_lkr": 95000,
                    "price_usd": 300,
                    "destinations": [
                        "Jaffna Town",
                        "Chunnakam Market",
                        "Valvettithurai",
                    ],
                    "highlights": [
                        "Authentic fiery Jaffna crab curry dinner at renowned local establishment",
                        "Curry powder blending workshop at Chunnakam spice market",
                        "Tasting artisanal Rio Ice Cream and Jaffna Nelli fruit crush",
                        "Palmyrah toddy & sweet jaggery making demonstration with farmers",
                        "Traditional homemade Tamil breakfast: string hoppers with sothi & mutton paal curry",
                    ],
                    "itinerary": [
                        {
                            "day": 1,
                            "title": "Spice Trails & Midnight Crab Feast",
                            "activities": "Check in; afternoon walking food tour tasting odiyal kool (palmyrah seafood chowder) and Rio ice cream; evening highlight: feast on authentic Jaffna chili crab curry.",
                        },
                        {
                            "day": 2,
                            "title": "Cooking Masterclass & Palmyrah Groves",
                            "activities": "Morning spice procurement at Chunnakam; private cooking masterclass preparing authentic Jaffna curry powder; afternoon palmyrah plantation visit tasting fresh sweet sap & jaggery.",
                        },
                        {
                            "day": 3,
                            "title": "Coastal Seafood Breakfast & Souvenirs",
                            "activities": "Morning breakfast at coastal fishers market; shop for roasted Jaffna curry powder and palmyrah delicacies; departure.",
                        },
                    ],
                    "inclusions": [
                        "2 nights boutique hotel accommodation",
                        "All meals included (3 breakfasts, 2 lunches, 2 specialized dinners including Crab Feast)",
                        "Private culinary instructor & cooking class ingredients",
                        "AC private transport for all food trail excursions",
                    ],
                    "exclusions": [
                        "Alcoholic beverages outside tastings",
                        "Souvenir spice purchases",
                    ],
                    "best_for": "Foodies, culinary enthusiasts, couples",
                },
                {
                    "id": "NOC-WEL-04",
                    "title": "Casuarina Beach & Siddha Wellness Sanctuary",
                    "tagline": "Rejuvenate body and mind with ancient Siddha therapies and tranquil coastal relaxation.",
                    "category": "Wellness & Ayurveda",
                    "duration_days": 5,
                    "duration_nights": 4,
                    "price_lkr": 220000,
                    "price_usd": 700,
                    "destinations": [
                        "Karainagar",
                        "Casuarina Beach",
                        "Keerimalai",
                    ],
                    "highlights": [
                        "Traditional Northern Siddha doctor consultation and customized wellness plan",
                        "Daily 90-minute herbal oil massage & rejuvenation steam bath",
                        "Sunrise beach meditation & gentle yoga on pristine Casuarina Beach",
                        "Medicinal bath in the natural therapeutic mineral springs of Keerimalai",
                        "Wholesome Satvik organic Tamil vegetarian diet prepared with local superfoods",
                    ],
                    "itinerary": [
                        {
                            "day": 1,
                            "title": "Arrival & Siddha Consultation",
                            "activities": "Arrival and check-in to peaceful coastal retreat; initial pulse reading and consultation with Siddha physician; introductory herbal relaxation massage.",
                        },
                        {
                            "day": 2,
                            "title": "Detox & Mineral Springs",
                            "activities": "Morning sunrise pranayama yoga on Casuarina sands; intensive herbal pouch (kizhi) therapy; afternoon excursion to Keerimalai mineral springs.",
                        },
                        {
                            "day": 3,
                            "title": "Herbal Rejuvenation",
                            "activities": "Daily yoga; customized head-to-toe medicinal oil therapy and herbal steam bath; tranquil afternoon reading or beach walking.",
                        },
                        {
                            "day": 4,
                            "title": "Mindfulness & Sound Healing",
                            "activities": "Guided meditation; facial herbal treatment; sunset coastal walk; closing consultation on dietary recommendations for home.",
                        },
                        {
                            "day": 5,
                            "title": "Departure Recharged",
                            "activities": "Farewell herbal tea ceremony, nutritious organic breakfast, transfer to station.",
                        },
                    ],
                    "inclusions": [
                        "4 nights luxury coastal wellness resort accommodation",
                        "Full board organic vegetarian & herbal nutrition meals",
                        "Daily Siddha therapeutic treatments and yoga sessions",
                        "Personal consultation with resident Siddha physician",
                        "All private transport and airport/rail transfers",
                    ],
                    "exclusions": [
                        "Take-home medicinal herbal preparations",
                        "Non-vegetarian meals",
                    ],
                    "best_for": "Solo travelers, wellness seekers, seniors",
                },
                {
                    "id": "NOC-NAT-05",
                    "title": "Chundikulam & Mannar Flamingos Wildlife Safari",
                    "tagline": "Witness thousands of migratory flamingos, Adam's Bridge sandbanks, and wild coastal lagoons.",
                    "category": "Nature & Wildlife",
                    "duration_days": 4,
                    "duration_nights": 3,
                    "price_lkr": 160000,
                    "price_usd": 510,
                    "destinations": [
                        "Chundikulam National Park",
                        "Mannar Island",
                        "Talaimannar",
                    ],
                    "highlights": [
                        "Birdwatching for greater flamingos, pelicans, and Eurasian wigeons in Chundikulam",
                        "Boat safari towards the mythical Adam's Bridge (Rama Setu) sand islands",
                        "Visit to the 700-year-old Giant Baobab Tree in Pallimunai",
                        "Historical Portuguese/Dutch Fort of Mannar overlooking the lagoon",
                        "Talaimannar Pier and lighthouse gazing across the Palk Strait towards India",
                    ],
                    "itinerary": [
                        {
                            "day": 1,
                            "title": "Jaffna to Chundikulam Lagoon",
                            "activities": "Morning departure south towards Chundikulam National Park; 4x4 safari along the lagoon spotting raptors and waterbirds; overnight eco-lodge.",
                        },
                        {
                            "day": 2,
                            "title": "Flamingo Trails to Mannar",
                            "activities": "Early dawn birding safari; transfer to Mannar Island; afternoon exploration of historic Mannar Fort and old Baobab tree.",
                        },
                        {
                            "day": 3,
                            "title": "Adam's Bridge & Talaimannar Pier",
                            "activities": "Morning boat ride along the sand shoals of Adam's Bridge; visit historic Talaimannar lighthouse and rail pier; sunset fishing village visit.",
                        },
                        {
                            "day": 4,
                            "title": "Wetlands & Return",
                            "activities": "Morning birdwatching at Vankalai Sanctuary; return transfer to Jaffna.",
                        },
                    ],
                    "inclusions": [
                        "3 nights eco-lodge and beachfront hotel accommodation",
                        "All meals included",
                        "4x4 safari jeep and local wildlife naturalist guide",
                        "Adam's Bridge boat permits and national park entrance fees",
                        "Private AC transfer throughout",
                    ],
                    "exclusions": [
                        "Binoculars/camera equipment rental",
                        "Personal expenses",
                    ],
                    "best_for": "Birdwatchers, wildlife photographers, nature enthusiasts",
                },
                {
                    "id": "NOC-ROM-06",
                    "title": "North Ceylon Romantic Sunset & Lagoon Escape",
                    "tagline": "An intimate getaway featuring private catamaran cruising, boutique luxury, and candlelit seafood dinners.",
                    "category": "Romantic & Honeymoon",
                    "duration_days": 3,
                    "duration_nights": 2,
                    "price_lkr": 180000,
                    "price_usd": 575,
                    "destinations": [
                        "Jaffna Peninsula",
                        "Karainagar Beach",
                        "Jaffna Lagoon",
                    ],
                    "highlights": [
                        "Private sunset catamaran sail with sparkling juice and local canapés",
                        "Romantic candlelit 4-course seafood dinner under coconut palms",
                        "Deluxe sea-view room at premium boutique resort with floral bed decoration",
                        "Private chauffeur in executive sedan for peaceful peninsula touring",
                        "Private couples photography session at Jaffna Fort and Casuarina beach",
                    ],
                    "itinerary": [
                        {
                            "day": 1,
                            "title": "Romantic Arrival & Sunset Lagoon Sail",
                            "activities": "VIP pickup in executive car; check-in with tropical welcome drinks; late afternoon private catamaran cruise watching the golden sunset over Jaffna lagoon; candlelit dinner.",
                        },
                        {
                            "day": 2,
                            "title": "Secluded Beach Day & Couples Massage",
                            "activities": "Breakfast in bed; private beach cabana at Casuarina; relaxing couples spa treatment; gourmet dinner at heritage courtyard.",
                        },
                        {
                            "day": 3,
                            "title": "Keerimalai & Sweet Departures",
                            "activities": "Morning scenic coastal drive; souvenir shopping for palmyrah crafts and sweets; departure transfer.",
                        },
                    ],
                    "inclusions": [
                        "2 nights luxury boutique resort (Sea-View Deluxe Room)",
                        "Daily champagne-style gourmet breakfast & 2 private dinners",
                        "Private sunset catamaran charter",
                        "Couples relaxing spa massage session",
                        "Private executive AC car with chauffeur throughout",
                    ],
                    "exclusions": [
                        "Travel to Jaffna",
                        "Personal shopping",
                    ],
                    "best_for": "Honeymooners, anniversaries, couples",
                },
            ]

            for pkg in sample_packages:
                cursor.execute(
                    """
                    INSERT INTO packages (
                        id, title, tagline, category, duration_days, duration_nights,
                        price_lkr, price_usd, destinations, highlights, itinerary,
                        inclusions, exclusions, best_for, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        pkg["id"],
                        pkg["title"],
                        pkg["tagline"],
                        pkg["category"],
                        pkg["duration_days"],
                        pkg["duration_nights"],
                        pkg["price_lkr"],
                        pkg["price_usd"],
                        json.dumps(pkg["destinations"]),
                        json.dumps(pkg["highlights"]),
                        json.dumps(pkg["itinerary"]),
                        json.dumps(pkg["inclusions"]),
                        json.dumps(pkg["exclusions"]),
                        pkg["best_for"],
                        1,
                    ),
                )
            conn.commit()

        columns = {r[1] for r in conn.execute("PRAGMA table_info(packages)")}
        if "icon_name" not in columns:
            conn.execute("ALTER TABLE packages ADD COLUMN icon_name TEXT NOT NULL DEFAULT 'compass'")
        icons = {"NOC-JAF-01": "heritage", "NOC-ISL-02": "island", "NOC-CUL-03": "food", "NOC-WEL-04": "wellness", "NOC-NAT-05": "wildlife", "NOC-ROM-06": "romance"}
        for package_id, icon in icons.items():
            conn.execute("UPDATE packages SET icon_name = ? WHERE id = ? AND icon_name = 'compass'", (icon, package_id))
        conn.commit()


def get_all_packages() -> List[Dict[str, Any]]:
    """Return all active packages as parsed Python dictionaries."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM packages WHERE is_active = 1 ORDER BY price_lkr ASC")
        rows = cursor.fetchall()
        result = []
        for r in rows:
            result.append(
                {
                    "id": r["id"],
                    "title": r["title"],
                    "tagline": r["tagline"],
                    "category": r["category"],
                    "icon_name": r["icon_name"],
                    "duration_days": r["duration_days"],
                    "duration_nights": r["duration_nights"],
                    "price_lkr": r["price_lkr"],
                    "price_usd": r["price_usd"],
                    "destinations": json.loads(r["destinations"]),
                    "highlights": json.loads(r["highlights"]),
                    "itinerary": json.loads(r["itinerary"]),
                    "inclusions": json.loads(r["inclusions"]),
                    "exclusions": json.loads(r["exclusions"]),
                    "best_for": r["best_for"],
                }
            )
        return result


def get_package_by_id(package_id: str) -> Optional[Dict[str, Any]]:
    """Return a single package by its ID."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM packages WHERE id = ? AND is_active = 1", (package_id.strip(),))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "title": row["title"],
            "tagline": row["tagline"],
            "category": row["category"],
            "icon_name": row["icon_name"],
            "duration_days": row["duration_days"],
            "duration_nights": row["duration_nights"],
            "price_lkr": row["price_lkr"],
            "price_usd": row["price_usd"],
            "destinations": json.loads(row["destinations"]),
            "highlights": json.loads(row["highlights"]),
            "itinerary": json.loads(row["itinerary"]),
            "inclusions": json.loads(row["inclusions"]),
            "exclusions": json.loads(row["exclusions"]),
            "best_for": row["best_for"],
        }


def get_packages_summary_for_prompt() -> str:
    """Build a compact, comprehensive text summary of all verified database packages for Aura's prompt."""
    packages = get_all_packages()
    lines = ["# VERIFIED PACKAGES DATABASE (OFFICIAL CATALOG)"]
    lines.append(
        "The following packages are the ONLY verified packages offered by the platform. You must extract and present package options exclusively from this data.\n"
    )

    for p in packages:
        dest_str = ", ".join(p["destinations"])
        high_str = " | ".join(p["highlights"])
        inc_str = ", ".join(p["inclusions"])
        lines.append(f"### [{p['id']}] {p['title']}")
        lines.append(f"- **Category**: {p['category']} | **Best For**: {p['best_for']}")
        lines.append(f"- **Duration**: {p['duration_days']} Days / {p['duration_nights']} Nights")
        lines.append(f"- **Official Price**: LKR {p['price_lkr']:,} (≈ USD {p['price_usd']:,})")
        lines.append(f"- **Destinations**: {dest_str}")
        lines.append(f"- **Key Highlights**: {high_str}")
        lines.append(f"- **Inclusions**: {inc_str}")

        lines.append("- **Day-by-Day Schedule**:")
        for day in p["itinerary"]:
            lines.append(f"  * Day {day['day']} ({day['title']}): {day['activities']}")
        lines.append("")

    return "\n".join(lines)
