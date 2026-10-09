"""Rebuild source-grounded examples locally, without an external model call."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
lines = (ROOT / "northern_tourism_source.txt").read_text(encoding="utf-8-sig").splitlines()
products = []
for index, line in enumerate(lines):
    if not line.startswith("Duration:"):
        continue
    name = lines[index - 1].strip()
    details = {"id": f"NORTH-CONCEPT-{len(products)+1:02d}", "name": name,
               "status": "proposed_requires_supplier_confirmation", "source_line": index,
               "duration": line.split("Best for:")[0].removeprefix("Duration:").strip(),
               "best_for": line.split("Best for:")[-1].strip()}
    for following in lines[index+1:index+5]:
        for prefix, field in [("Experience includes:", "experiences"), ("Suggested retail price:", "indicative_price"), ("Planning note:", "conditions")]:
            if following.startswith(prefix):
                details[field] = following.removeprefix(prefix).strip()
    products.append(details)

knowledge = {"version": 1, "source": "northern_tourism_source.txt", "brand": "North of Ceylon",
    "tagline": "Discover the North. Live the Stories. Take Home the Memories.",
    "coverage": ["Jaffna", "nearby islands", "Kilinochchi", "Mullaitivu", "Mannar", "Vavuniya"],
    "pricing_policy": "Source prices are indicative planning ranges, not verified supplier quotes. Preserve per-person, per-couple, per-group and per-day units. Never treat them as database booking prices or calculate confirmed totals from them.",
    "products": products,
    "principles": ["Experiences are hosted with local farmers, fishers, artisans and residents; obtain consent and pay hosts fairly.",
        "Do not promise all Northern districts in three days. Keep routes geographically realistic.",
        "Farming and harvesting require actual season and host permission; do not invent seasonal dates.",
        "Island access and boating depend on weather, permitted landings and authorised operators with suitable life jackets.",
        "Religious access, dress, services and photography rules need confirmation. Respect all communities and their histories.",
        "Wildlife sightings, supplier availability, accessibility and transport schedules are never guaranteed.",
        "Celebration surprises remain private; confirm guest counts, setup permission and deliverables.",
        "Only active SQLite package IDs and options may enter a priced builder draft. Unlisted proposed activities become wishes requiring staff review."]}
(ROOT / "northern_tourism_knowledge.json").write_text(json.dumps(knowledge, ensure_ascii=False, indent=2), encoding="utf-8")

examples = []
def add(identifier, language, turns, sources=None, topic="discovery", suggestions=None):
    examples.append({"id": identifier, "language_code": language, "topic": topic,
        "source": sources or ["northern_tourism_source.txt"], "illustrative": True,
        "messages": [{"role": role, "content": content} for role, content in turns],
        "suggested_replies": suggestions or [], "expected_handoff": "Only after customer acceptance; open Build my own trip inside Package Builder."})

for p in products:
    add(p["id"].lower(), "en", [("user", f"Tell me about {p['name']}."),
        ("assistant", f"The proposed {p['name']} experience covers {p.get('experiences', '')} Which dates are you considering?"),
        ("user", "What would it cost, and is it available?"),
        ("assistant", f"The source's indicative planning range is {p.get('indicative_price', 'a custom quote')}, not a confirmed quote. {p.get('conditions', '')}")], [p["id"]], "experience_and_quote", ["My dates are flexible", "I'd like a custom quote", "Show another experience"])

workflows = [
    ("family", "We have two adults, two children and one elder, with two days in Jaffna.", "An easy-paced heritage, food and craft plan could suit your five travelers, with rest breaks and an island outing only if suitable. Does your elder need step-free access?", "Yes, limited walking please.", "I’ll keep limited walking as a requirement; staff must confirm access and transport before you commit. Would you prefer crafts or a food experience?"),
    ("seasonal_farming", "Can we plant paddy next week?", "Paddy planting needs a suitable field, the actual planting season and a willing farmer; next week's availability is unconfirmed. Are your dates flexible?", "No, only next week.", "I can note that request for a host check and suggest a craft or cooking activity if planting is unavailable. Which alternative interests you?"),
    ("route_scope", "Fit Jaffna, Mannar, Mullaitivu, Kilinochchi and Vavuniya into three days.", "That would risk a rushed trip; the source recommends district-specific routes rather than covering the whole North in three days. Would you prefer a Jaffna-focused route or a wider route with more time?", "Jaffna and village life.", "We can focus the proposal on Jaffna heritage, food and an arranged village experience. How many travelers are joining?"),
    ("proposal_privacy", "I want a secret proposal on a boat.", "A private proposal can be explored, but a boat setup needs an authorised operator, a permitted route and safe conditions. Would a permitted waterfront setup be an acceptable alternative?", "Yes, keep it secret from my partner.", "I’ll keep the surprise details private and note the waterfront alternative for staff review. What date are you considering?"),
    ("food_allergy", "We want crab cooking, but one person has a shellfish allergy.", "Crab cooking poses a shellfish exposure concern; we should request a suitable alternative and confirm cross-contact arrangements with the host. Would you prefer a vegetarian cooking experience?", "Yes, vegetarian for everyone.", "I’ll record a vegetarian meal request and the allergy for provider confirmation. How many guests are attending?"),
    ("faith", "Can we visit Nallur and Nainativu in one trip?", "The proposed Hindu trail includes Nallur and Nainativu, but temple access, ferry conditions and schedules need checking. How much time do you have?", "Two days.", "A two-day proposal gives more flexibility, with island access still subject to confirmation. What are your travel dates?"),
    ("women_group", "Six women want local crafts and a female guide.", "A craft-focused getaway could fit your group, with private transport and a female guide requested subject to availability. How many days would you like?", "Two days and one night.", "I’ll note six guests, a two-day craft-focused stay and your guide preference for review. What accommodation standard do you prefer?"),
    ("budget_units", "The one-day range is LKR 8,000–18,000: is that for our whole family?", "That source range is per person and indicative, so it is not a whole-family confirmed price. How many adults and children are traveling?", "Two adults and two children.", "Staff need the children's ages and current supplier rates before quoting your family total. What are the children's ages?"),
    ("weather", "Will the island boat definitely operate tomorrow?", "I cannot guarantee tomorrow's boat operation; weather, operator confirmation and landing access decide it. Would you like a mainland alternative included in the proposal?", "Yes, crafts and food.", "I’ll note crafts and local food as the fallback, subject to host availability. How many travelers should the proposal cover?"),
    ("photography", "Can I photograph villagers and religious ceremonies?", "Ask for permission before photographing residents, workers or children, and follow each religious site's restrictions. Would you like a hosted village photo session instead?", "Yes, with traditional outfits.", "Outfits, photographer time, edited images and location permission need a supplier quote. Is this for a couple or a larger group?"),
    ("correction", "We are four friends, three days, food and culture.", "I’ll focus on food and culture for four friends over three days. What is your budget?", "Actually six people, and no seafood.", "I’ve updated the proposal to six travelers and no seafood, keeping the three-day food-and-culture focus. What budget should we work within?"),
    ("handoff", "A two-day Jaffna food-and-craft trip for two sounds right.", "I’ll keep the two-day food-and-craft idea for two, with hosts and pricing still to confirm. Would you like to customise it?", "Yes, that is what I want.", "You can review your preferences and build an editable plan in [Customise your trip](#package-builder); nothing is booked.")]
for name, user1, ai1, user2, ai2 in workflows:
    add("jaffna_"+name, "en", [("user",user1),("assistant",ai1),("user",user2),("assistant",ai2)], topic=name)

localized = {
"en": ["We want a two-day trip to Jaffna, with local food and crafts.", "A two-day food-and-craft proposal could suit you; hosts and prices still need confirmation. How many travelers are joining?", "Two people. Yes, we'd like to customise it.", "Review your preferences in [Customise your trip](#package-builder); nothing is booked."],
"ta": ["யாழ்ப்பாணத்தில் இரண்டு நாட்கள் சுற்றுலா செல்ல விரும்புகிறோம். உள்ளூர் உணவும் கைவினையும் பிடிக்கும்.", "இரண்டு நாள் உணவு மற்றும் கைவினைப் பயணத்தை முன்மொழியலாம்; ஏற்பாட்டாளர்களும் விலையும் உறுதிப்படுத்தப்பட வேண்டும். எத்தனை பேர் வருகிறீர்கள்?", "இரண்டு பேர். பயணத்தைத் தனிப்பயனாக்க விரும்புகிறோம்.", "[உங்கள் பயணத்தை வடிவமைக்கவும்](#package-builder) பகுதியில் விருப்பங்களைச் சரிபார்க்கலாம்; முன்பதிவு இன்னும் செய்யப்படவில்லை."],
"si": ["යාපනයේ දින දෙකක් ගත කරන්න කැමතියි. දේශීය ආහාර සහ අත්කම් බලන්න ඕනෑ.", "දින දෙකක ආහාර සහ අත්කම් සංචාරයක් යෝජනා කළ හැකියි; සේවා සපයන්නන් සහ මිල තහවුරු කළ යුතුයි. කී දෙනෙක් එනවාද?", "දෙන්නෙක්. අපේ සංචාරය සකස් කරගන්න කැමතියි.", "[ඔබේ සංචාරය සකස් කරන්න](#package-builder) තුළ ඔබේ කැමැත්ත සමාලෝචනය කරන්න; තවම වෙන් කිරීමක් කර නැහැ."],
"de": ["Wir möchten zwei Tage in Jaffna verbringen, mit regionalem Essen und Handwerk.", "Eine zweitägige Reise mit Essen und Handwerk könnte passen; Anbieter und Preise müssen noch bestätigt werden. Wie viele Personen reisen mit?", "Zwei Personen. Wir möchten die Reise anpassen.", "Prüfen Sie Ihre Wünsche unter [Reise selbst gestalten](#package-builder); es ist noch nichts gebucht."],
"fr": ["Nous voulons passer deux jours à Jaffna et découvrir la cuisine locale et l’artisanat.", "Un séjour de deux jours autour de la cuisine et de l’artisanat pourrait convenir ; les prestataires et les tarifs restent à confirmer. Combien de personnes voyagent ?", "Deux personnes. Nous souhaitons personnaliser le voyage.", "Vérifiez vos préférences dans [Personnaliser votre voyage](#package-builder) ; rien n’est encore réservé."],
"ar": ["نريد رحلة لمدة يومين في جافنا لتجربة الطعام المحلي والحرف اليدوية.", "يمكن اقتراح رحلة يومين للطعام والحرف، مع ضرورة تأكيد مقدمي الخدمات والأسعار. كم شخصاً سيشارك؟", "شخصان. نريد تخصيص الرحلة.", "راجعوا تفضيلاتكم في [خصّص رحلتك](#package-builder)؛ لم يتم حجز أي شيء بعد."],
"ko": ["자프나에서 이틀 동안 현지 음식과 공예를 체험하고 싶어요.", "음식과 공예 중심의 이틀 여행을 제안할 수 있지만, 운영자와 가격은 확인이 필요해요. 몇 분이 함께 여행하시나요?", "두 명이에요. 여행을 맞춤 설정하고 싶어요.", "[나만의 여행 만들기](#package-builder)에서 선호 사항을 검토해 주세요. 아직 예약된 것은 없어요."],
"zh": ["我们想在贾夫纳玩两天，体验当地美食和手工艺。", "可以考虑两天的美食与手工艺行程，但服务商和价格仍需确认。请问有几位旅客？", "两个人。我们想定制行程。", "请在[定制您的旅行](#package-builder)中查看偏好；目前尚未预订。"],
"hi": ["हम जाफना में दो दिन स्थानीय भोजन और हस्तशिल्प का अनुभव करना चाहते हैं।", "भोजन और हस्तशिल्प की दो दिन की यात्रा सुझाई जा सकती है, लेकिन आयोजकों और कीमतों की पुष्टि बाकी है। कितने लोग यात्रा करेंगे?", "दो लोग। हम यात्रा को अपनी पसंद के अनुसार बनाना चाहते हैं।", "[अपनी यात्रा बनाएं](#package-builder) में अपनी पसंद देखें; अभी कोई बुकिंग नहीं हुई है।"],
"it": ["Vorremmo trascorrere due giorni a Jaffna, scoprendo cucina locale e artigianato.", "Un itinerario di due giorni tra cucina e artigianato potrebbe fare al caso vostro; fornitori e prezzi sono da confermare. Quante persone viaggiano?", "Due persone. Vorremmo personalizzare il viaggio.", "Controllate le preferenze in [Personalizza il tuo viaggio](#package-builder); non è ancora stato prenotato nulla."],
"es": ["Queremos pasar dos días en Jaffna para conocer la comida local y la artesanía.", "Podemos proponer dos días de gastronomía y artesanía; los proveedores y precios están pendientes de confirmación. ¿Cuántas personas viajarán?", "Dos personas. Queremos personalizar el viaje.", "Revisen sus preferencias en [Personaliza tu viaje](#package-builder); todavía no se ha reservado nada."]}
for language, turns in localized.items():
    add("localized_jaffna_"+language, language, list(zip(["user","assistant","user","assistant"],turns)), topic="localized_handoff")

from common_questions import COMMON_QUESTIONS, LOCALIZED_QUESTIONS
from tamil_questions import TAMIL_QUESTIONS
for topic, user1, ai1, user2, ai2 in TAMIL_QUESTIONS:
    add("tamil_"+topic, "ta", [("user",user1),("assistant",ai1),("user",user2),("assistant",ai2)], topic=topic)
for topic, user1, ai1, user2, ai2 in COMMON_QUESTIONS:
    add("faq_"+topic, "en", [("user",user1),("assistant",ai1),("user",user2),("assistant",ai2)], topic=topic)
for language, items in LOCALIZED_QUESTIONS.items():
    for topic, user1, ai1, user2, ai2 in items:
        add("faq_"+language+"_"+topic, language, [("user",user1),("assistant",ai1),("user",user2),("assistant",ai2)], topic=topic)

with (ROOT / "jaffna_conversations.jsonl").open("w",encoding="utf-8") as target:
    for example in examples:
        target.write(json.dumps(example,ensure_ascii=False)+"\n")
with (ROOT / "jaffna_conversations_ta.jsonl").open("w",encoding="utf-8") as target:
    for example in examples:
        if example["language_code"] == "ta":
            target.write(json.dumps(example,ensure_ascii=False)+"\n")
readable = ["# Jaffna conversation dataset", "", "Illustrative customer/Aura dialogues grounded in the supplied Northern tourism concept. Proposed experiences and ranges require supplier confirmation; this is example and retrieval data, not model training or an active booking catalogue.", "", f"{len(products)} detailed concept records; {len(examples)} conversations; 11 language variants. Native-speaker editorial review is recommended before using translations in marketing.", ""]
for example in examples:
    readable.extend([f"## {example['id']} ({example['language_code']})", ""])
    readable.extend(f"**{'Customer' if m['role']=='user' else 'Aura'}:** {m['content']}\n" for m in example["messages"])
(ROOT.parent / "docs" / "jaffna_conversations.md").write_text("\n".join(readable),encoding="utf-8")
print(f"Created {len(products)} source records and {len(examples)} conversations in 11 languages.")
