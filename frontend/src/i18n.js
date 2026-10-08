// UI copy for the Aura chat in each supported language.
// `cards` follows CARD_META order: [title, hint, prompt]. The prompt is written in
// the same language so Aura answers in it.

export const LANGS = [
  { code: "en", label: "English", locale: "en-GB", name: "English" },
  { code: "zh", label: "中文", locale: "zh-CN", name: "Simplified Chinese" },
  { code: "es", label: "Español", locale: "es-ES", name: "Spanish" },
  { code: "fr", label: "Français", locale: "fr-FR", name: "French" },
  { code: "de", label: "Deutsch", locale: "de-DE", name: "German" },
];

export const CARD_IMAGES = [
  "/images/cards/heritage.jpg",
  "/images/cards/romantic.jpg",
  "/images/cards/delft.jpg",
  "/images/cards/food.jpg",
  "/images/cards/wildlife.jpg",
  "/images/cards/budget.jpg",
];

export const I18N = {
  en: {
    headline: "Where shall we wander today?",
    sub: (cur) => `I'm Aura, your guide to Northern Sri Lanka. Pick an idea or tell me your dream trip — I'll show prices in LKR and ${cur || "your own currency"}.`,
    placeholder: "Where would you like to go? Tell me your dates, budget or dream activities…",
    fine: "Prices are shown in LKR with approximate conversions. Checkout happens in LKR.",
    newChat: "New chat", newTrip: "New trip", packages: "Packages", budget: "Budget", packing: "Packing",
    itinerary: "Itinerary", back: "Back",
    pPackages: "Show me all your packages with prices",
    pBudget: "Help me fit a package in my budget",
    pPacking: "Build my packing checklist for Northern Sri Lanka",
    pItinerary: "Draft me a custom itinerary",
    replies: ["Solo", "Couple", "Family with kids", "Friends", "Show me options", "Make it cheaper"],
    cards: [
      ["Plan a Jaffna heritage trip", "A 4-day route through temples, forts and old streets", "Plan me a 4-day Jaffna heritage and culture trip"],
      ["Find a romantic escape", "Sunset spots and quiet stays for two", "Find me a romantic sunset escape for a honeymoon"],
      ["Hop over to Delft Island", "Wild ponies, coral walls and the northern coast", "I want to explore Delft Island and the northern coast"],
      ["Taste the Jaffna food trail", "Crab curry, spice markets and local kitchens", "Show me a culinary trip with Jaffna crab and spice trails"],
      ["Spot flamingos & wildlife", "Birdwatching safaris and where to find them", "I love birdwatching — what wildlife safari do you have?"],
      ["Fit a trip in my budget", "See which packages work for what you can spend", "Help me fit a package in my budget"],
    ],
  },
  zh: {
    headline: "今天想去哪里漫游？",
    sub: (cur) => `我是 Aura，您的斯里兰卡北部向导。选择一个创意或告诉我您的梦想之旅——我会以 LKR 和${cur || "您的货币"}显示价格。`,
    placeholder: "您想去哪里？告诉我日期、预算或理想的活动……",
    fine: "价格以 LKR 显示，换算仅供参考，结算以 LKR 进行。",
    newChat: "新对话", newTrip: "新行程", packages: "套餐", budget: "预算", packing: "行李",
    itinerary: "行程", back: "返回",
    pPackages: "请展示所有套餐及价格",
    pBudget: "请帮我按预算选择合适的套餐",
    pPacking: "请为斯里兰卡北部之旅列一份行李清单",
    pItinerary: "请为我定制一份行程",
    replies: ["独自旅行", "情侣", "带孩子的家庭", "朋友同行", "给我看看选项", "便宜一点"],
    cards: [
      ["规划贾夫纳文化之旅", "4 天行程，探访寺庙、古堡与老街", "请为我规划 4 天的贾夫纳文化遗产之旅"],
      ["寻找浪漫之旅", "日落胜地与两人的静谧住所", "请为蜜月推荐一次浪漫的日落之旅"],
      ["前往德尔夫特岛", "野马、珊瑚石墙与北部海岸", "我想探索德尔夫特岛和北部海岸"],
      ["品尝贾夫纳美食之旅", "咖喱蟹、香料市场与本地厨房", "请推荐包含贾夫纳螃蟹和香料之路的美食之旅"],
      ["观赏火烈鸟与野生动物", "观鸟野生动物游及最佳地点", "我喜欢观鸟——你们有什么野生动物游？"],
      ["按预算安排行程", "看看哪些套餐适合您的预算", "请帮我按预算选择合适的套餐"],
    ],
  },
  es: {
    headline: "¿Adónde vamos hoy?",
    sub: (cur) => `Soy Aura, tu guía del norte de Sri Lanka. Elige una idea o cuéntame tu viaje soñado: mostraré los precios en LKR y ${cur || "tu moneda"}.`,
    placeholder: "¿A dónde te gustaría ir? Cuéntame tus fechas, presupuesto o actividades soñadas…",
    fine: "Los precios se muestran en LKR con conversiones aproximadas. El pago se realiza en LKR.",
    newChat: "Nuevo chat", newTrip: "Nuevo viaje", packages: "Paquetes", budget: "Presupuesto", packing: "Equipaje",
    itinerary: "Itinerario", back: "Volver",
    pPackages: "Muéstrame todos tus paquetes con precios",
    pBudget: "Ayúdame a ajustar un paquete a mi presupuesto",
    pPacking: "Crea mi lista de equipaje para el norte de Sri Lanka",
    pItinerary: "Prepárame un itinerario personalizado",
    replies: ["Solo/a", "En pareja", "Familia con niños", "Con amigos", "Muéstrame opciones", "Hazlo más barato"],
    cards: [
      ["Planifica un viaje patrimonial a Jaffna", "Ruta de 4 días por templos, fuertes y calles antiguas", "Planifícame un viaje de 4 días de patrimonio y cultura en Jaffna"],
      ["Encuentra una escapada romántica", "Atardeceres y alojamientos tranquilos para dos", "Búscame una escapada romántica al atardecer para una luna de miel"],
      ["Salta a la isla de Delft", "Ponis salvajes, muros de coral y la costa norte", "Quiero explorar la isla de Delft y la costa norte"],
      ["Prueba la ruta gastronómica de Jaffna", "Curry de cangrejo, mercados de especias y cocinas locales", "Muéstrame un viaje gastronómico con cangrejo de Jaffna y rutas de especias"],
      ["Observa flamencos y fauna", "Safaris de aves y dónde encontrarlas", "Me encanta observar aves: ¿qué safari de fauna tienen?"],
      ["Ajusta un viaje a mi presupuesto", "Descubre qué paquetes encajan con lo que puedes gastar", "Ayúdame a ajustar un paquete a mi presupuesto"],
    ],
  },
  fr: {
    headline: "Où allons-nous flâner aujourd'hui ?",
    sub: (cur) => `Je suis Aura, votre guide du nord du Sri Lanka. Choisissez une idée ou décrivez votre voyage de rêve — j'afficherai les prix en LKR et en ${cur || "votre devise"}.`,
    placeholder: "Où aimeriez-vous aller ? Indiquez vos dates, votre budget ou vos activités de rêve…",
    fine: "Les prix sont affichés en LKR avec des conversions approximatives. Le paiement se fait en LKR.",
    newChat: "Nouveau chat", newTrip: "Nouveau voyage", packages: "Forfaits", budget: "Budget", packing: "Valise",
    itinerary: "Itinéraire", back: "Retour",
    pPackages: "Montrez-moi tous vos forfaits avec les prix",
    pBudget: "Aidez-moi à trouver un forfait dans mon budget",
    pPacking: "Préparez ma liste de bagages pour le nord du Sri Lanka",
    pItinerary: "Rédigez-moi un itinéraire sur mesure",
    replies: ["Seul(e)", "En couple", "En famille avec enfants", "Entre amis", "Montrez-moi des options", "Moins cher"],
    cards: [
      ["Planifier un voyage patrimoine à Jaffna", "4 jours entre temples, forts et vieilles rues", "Planifiez-moi un voyage de 4 jours sur le patrimoine et la culture de Jaffna"],
      ["Trouver une escapade romantique", "Couchers de soleil et séjours paisibles à deux", "Trouvez-moi une escapade romantique au coucher du soleil pour une lune de miel"],
      ["Cap sur l'île de Delft", "Poneys sauvages, murs de corail et côte nord", "Je veux explorer l'île de Delft et la côte nord"],
      ["Goûter la route culinaire de Jaffna", "Crabe au curry, marchés d'épices et cuisines locales", "Proposez-moi un voyage culinaire avec le crabe de Jaffna et les routes des épices"],
      ["Observer flamants et faune", "Safaris ornithologiques et où les trouver", "J'adore l'ornithologie — quel safari faune proposez-vous ?"],
      ["Un voyage selon mon budget", "Voyez quels forfaits conviennent à votre budget", "Aidez-moi à trouver un forfait dans mon budget"],
    ],
  },
  de: {
    headline: "Wohin soll es heute gehen?",
    sub: (cur) => `Ich bin Aura, Ihre Reiseführerin für Nord-Sri-Lanka. Wählen Sie eine Idee oder erzählen Sie mir von Ihrer Traumreise – ich zeige Preise in LKR und ${cur || "Ihrer Währung"}.`,
    placeholder: "Wohin möchten Sie reisen? Nennen Sie Termine, Budget oder Wunschaktivitäten…",
    fine: "Preise werden in LKR mit ungefähren Umrechnungen angezeigt. Die Zahlung erfolgt in LKR.",
    newChat: "Neuer Chat", newTrip: "Neue Reise", packages: "Pakete", budget: "Budget", packing: "Packliste",
    itinerary: "Reiseplan", back: "Zurück",
    pPackages: "Zeigen Sie mir alle Pakete mit Preisen",
    pBudget: "Helfen Sie mir, ein Paket in mein Budget zu passen",
    pPacking: "Erstellen Sie meine Packliste für Nord-Sri-Lanka",
    pItinerary: "Entwerfen Sie mir einen individuellen Reiseplan",
    replies: ["Allein", "Als Paar", "Familie mit Kindern", "Mit Freunden", "Zeigen Sie Optionen", "Günstiger bitte"],
    cards: [
      ["Jaffna-Kulturreise planen", "4 Tage durch Tempel, Forts und Altstadtgassen", "Planen Sie mir eine 4-tägige Kultur- und Erbereise nach Jaffna"],
      ["Romantische Auszeit finden", "Sonnenuntergänge und ruhige Unterkünfte für zwei", "Finden Sie eine romantische Sonnenuntergangsreise für die Flitterwochen"],
      ["Auf nach Delft Island", "Wildponys, Korallenmauern und die Nordküste", "Ich möchte Delft Island und die Nordküste erkunden"],
      ["Jaffnas Küche entdecken", "Krabbencurry, Gewürzmärkte und lokale Küchen", "Zeigen Sie mir eine Kulinarikreise mit Jaffna-Krabben und Gewürzrouten"],
      ["Flamingos & Tierwelt erleben", "Vogelsafaris und die besten Orte dafür", "Ich liebe Vogelbeobachtung – welche Wildlife-Safari bieten Sie an?"],
      ["Reise nach meinem Budget", "Sehen Sie, welche Pakete zu Ihrem Budget passen", "Helfen Sie mir, ein Paket in mein Budget zu passen"],
    ],
  },
};

export function loadLang() {
  try {
    const saved = localStorage.getItem("aura-lang");
    if (saved && I18N[saved]) return saved;
  } catch { /* storage unavailable */ }
  return "en";
}

export function formatTime(ts, locale) {
  try {
    return new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
