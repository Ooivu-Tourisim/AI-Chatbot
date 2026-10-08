import { useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Icon from "./Icon.jsx";
import BuilderPage from "./BuilderPage.jsx";
import { PAGE_I18N } from "./builderPageStrings.js";
import { BUILDER_I18N } from "./builderStrings.js";
import { CARD_IMAGES, I18N, LANGS, formatTime, loadLang } from "./i18n.js";
import "./AuraChat.css";

const AI_DOWN = "AI suggestions are temporarily unavailable. You can continue browsing, customizing, and booking manually.";

// Complete world currencies database covering every UN member and territory,
// with country names and common nationalities for seamless search.
const CURRENCY_DATA = [
  // ── Popular & Major Currencies ──
  { code: "USD", name: "US Dollar", country: "United States", keywords: "america american usa dollar", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", country: "European Union (Eurozone)", keywords: "europe euro france germany italy spain netherlands belgium portugal austria ireland greece finland", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", country: "United Kingdom", keywords: "uk britain british england scotland wales london pound sterling", flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", country: "Japan", keywords: "japanese tokyo yen", flag: "🇯🇵" },
  { code: "CHF", name: "Swiss Franc", country: "Switzerland", keywords: "swiss franc zurich geneva", flag: "🇨🇭" },
  { code: "CAD", name: "Canadian Dollar", country: "Canada", keywords: "canadian dollar toronto", flag: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", country: "Australia", keywords: "australian sydney melbourne aussie dollar", flag: "🇦🇺" },
  { code: "NZD", name: "New Zealand Dollar", country: "New Zealand", keywords: "kiwi auckland dollar", flag: "🇳🇿" },
  { code: "CNY", name: "Chinese Yuan (RMB)", country: "China", keywords: "chinese yuan renminbi beijing", flag: "🇨🇳" },
  { code: "INR", name: "Indian Rupee", country: "India", keywords: "indian rupee inr delhi mumbai", flag: "🇮🇳" },
  { code: "LKR", name: "Sri Lankan Rupee", country: "Sri Lanka", keywords: "sri lanka colombo jaffna lkr", flag: "🇱🇰" },

  // ── South Asia ──
  { code: "AFN", name: "Afghan Afghani", country: "Afghanistan", keywords: "afghan afghani afghanistan kabul", flag: "🇦🇫" },
  { code: "PKR", name: "Pakistani Rupee", country: "Pakistan", keywords: "pakistani rupee islamabad karachi", flag: "🇵🇰" },
  { code: "BDT", name: "Bangladeshi Taka", country: "Bangladesh", keywords: "bangladesh bengali dhaka taka", flag: "🇧🇩" },
  { code: "NPR", name: "Nepalese Rupee", country: "Nepal", keywords: "nepal nepalese kathmandu rupee", flag: "🇳🇵" },
  { code: "MVR", name: "Maldivian Rufiyaa", country: "Maldives", keywords: "maldives maldivian male rufiyaa", flag: "🇲🇻" },
  { code: "BTN", name: "Bhutanese Ngultrum", country: "Bhutan", keywords: "bhutan bhutanese thimphu", flag: "🇧🇹" },

  // ── Middle East & Central Asia ──
  { code: "AED", name: "UAE Dirham", country: "United Arab Emirates", keywords: "uae dubai abu dhabi emirati dirham", flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", country: "Saudi Arabia", keywords: "saudi arabia riyadh riyal", flag: "🇸🇦" },
  { code: "QAR", name: "Qatari Riyal", country: "Qatar", keywords: "qatar qatari doha riyal", flag: "🇶🇦" },
  { code: "KWD", name: "Kuwaiti Dinar", country: "Kuwait", keywords: "kuwait kuwaiti dinar", flag: "🇰🇼" },
  { code: "BHD", name: "Bahraini Dinar", country: "Bahrain", keywords: "bahrain bahraini dinar", flag: "🇧🇭" },
  { code: "OMR", name: "Omani Rial", country: "Oman", keywords: "oman omani muscat rial", flag: "🇴🇲" },
  { code: "TRY", name: "Turkish Lira", country: "Turkey", keywords: "turkey turkish istanbul lira", flag: "🇹🇷" },
  { code: "ILS", name: "Israeli New Shekel", country: "Israel", keywords: "israel israeli shekel tel aviv", flag: "🇮🇱" },
  { code: "JOD", name: "Jordanian Dinar", country: "Jordan", keywords: "jordan jordanian amman dinar", flag: "🇯🇴" },
  { code: "IQD", name: "Iraqi Dinar", country: "Iraq", keywords: "iraq iraqi baghdad dinar", flag: "🇮🇶" },
  { code: "IRR", name: "Iranian Rial", country: "Iran", keywords: "iran iranian tehran rial", flag: "🇮🇷" },
  { code: "SYP", name: "Syrian Pound", country: "Syria", keywords: "syria syrian damascus pound", flag: "🇸🇾" },
  { code: "LBP", name: "Lebanese Pound", country: "Lebanon", keywords: "lebanon lebanese beirut pound", flag: "🇱🇧" },
  { code: "YER", name: "Yemeni Rial", country: "Yemen", keywords: "yemen yemeni sanaa rial", flag: "🇾🇪" },
  { code: "KZT", name: "Kazakhstani Tenge", country: "Kazakhstan", keywords: "kazakhstan kazakh tenge almaty astana", flag: "🇰🇿" },
  { code: "UZS", name: "Uzbekistani Som", country: "Uzbekistan", keywords: "uzbekistan uzbek som tashkent", flag: "🇺🇿" },
  { code: "TMT", name: "Turkmenistani Manat", country: "Turkmenistan", keywords: "turkmenistan turkmen manat", flag: "🇹🇲" },
  { code: "KGS", name: "Kyrgyzstani Som", country: "Kyrgyzstan", keywords: "kyrgyzstan kyrgyz som bishkek", flag: "🇰🇬" },
  { code: "TJS", name: "Tajikistani Somoni", country: "Tajikistan", keywords: "tajikistan tajik somoni dushanbe", flag: "🇹🇯" },
  { code: "GEL", name: "Georgian Lari", country: "Georgia", keywords: "georgia georgian lari tbilisi", flag: "🇬🇪" },
  { code: "AMD", name: "Armenian Dram", country: "Armenia", keywords: "armenia armenian dram yerevan", flag: "🇦🇲" },
  { code: "AZN", name: "Azerbaijani Manat", country: "Azerbaijan", keywords: "azerbaijan azeri manat baku", flag: "🇦🇿" },

  // ── Southeast Asia & East Asia ──
  { code: "SGD", name: "Singapore Dollar", country: "Singapore", keywords: "singapore dollar sgd", flag: "🇸🇬" },
  { code: "MYR", name: "Malaysian Ringgit", country: "Malaysia", keywords: "malaysia malaysian ringgit kuala lumpur", flag: "🇲🇾" },
  { code: "THB", name: "Thai Baht", country: "Thailand", keywords: "thailand thai bangkok baht", flag: "🇹🇭" },
  { code: "IDR", name: "Indonesian Rupiah", country: "Indonesia", keywords: "indonesia indonesian jakarta bali rupiah", flag: "🇮🇩" },
  { code: "PHP", name: "Philippine Peso", country: "Philippines", keywords: "philippines filipino manila peso", flag: "🇵🇭" },
  { code: "VND", name: "Vietnamese Dong", country: "Vietnam", keywords: "vietnam vietnamese hanoi saigon dong", flag: "🇻🇳" },
  { code: "MMK", name: "Myanmar Kyat", country: "Myanmar (Burma)", keywords: "myanmar burma burmese yangon kyat", flag: "🇲🇲" },
  { code: "KHR", name: "Cambodian Riel", country: "Cambodia", keywords: "cambodia cambodian phnom penh riel", flag: "🇰🇭" },
  { code: "LAK", name: "Lao Kip", country: "Laos", keywords: "laos laotian vientiane kip", flag: "🇱🇦" },
  { code: "BND", name: "Brunei Dollar", country: "Brunei", keywords: "brunei dollar", flag: "🇧🇳" },
  { code: "HKD", name: "Hong Kong Dollar", country: "Hong Kong", keywords: "hong kong hk dollar", flag: "🇭🇰" },
  { code: "TWD", name: "New Taiwan Dollar", country: "Taiwan", keywords: "taiwan taiwanese taipei dollar", flag: "🇹🇼" },
  { code: "KRW", name: "South Korean Won", country: "South Korea", keywords: "korea korean seoul won", flag: "🇰🇷" },
  { code: "KPW", name: "North Korean Won", country: "North Korea", keywords: "north korea pyongyang won", flag: "🇰🇵" },
  { code: "MNT", name: "Mongolian Tugrik", country: "Mongolia", keywords: "mongolia mongolian tugrik", flag: "🇲🇳" },
  { code: "MOP", name: "Macanese Pataca", country: "Macau", keywords: "macau macanese pataca", flag: "🇲🇴" },

  // ── Europe (Individual Nations) ──
  { code: "EUR", name: "Euro", country: "France", keywords: "france french paris euro", flag: "🇫🇷" },
  { code: "EUR", name: "Euro", country: "Germany", keywords: "germany german deutschland berlin euro", flag: "🇩🇪" },
  { code: "EUR", name: "Euro", country: "Italy", keywords: "italy italian italia rome euro", flag: "🇮🇹" },
  { code: "EUR", name: "Euro", country: "Spain", keywords: "spain spanish espana madrid euro", flag: "🇪🇸" },
  { code: "EUR", name: "Euro", country: "Netherlands", keywords: "netherlands dutch holland amsterdam euro", flag: "🇳🇱" },
  { code: "EUR", name: "Euro", country: "Belgium", keywords: "belgium belgian brussels euro", flag: "🇧🇪" },
  { code: "EUR", name: "Euro", country: "Austria", keywords: "austria austrian vienna euro", flag: "🇦🇹" },
  { code: "EUR", name: "Euro", country: "Portugal", keywords: "portugal portuguese lisbon euro", flag: "🇵🇹" },
  { code: "EUR", name: "Euro", country: "Ireland", keywords: "ireland irish dublin euro", flag: "🇮🇪" },
  { code: "EUR", name: "Euro", country: "Greece", keywords: "greece greek athens euro", flag: "🇬🇷" },
  { code: "EUR", name: "Euro", country: "Finland", keywords: "finland finnish helsinki euro", flag: "🇫🇮" },
  { code: "SEK", name: "Swedish Krona", country: "Sweden", keywords: "sweden swedish stockholm krona", flag: "🇸🇪" },
  { code: "NOK", name: "Norwegian Krone", country: "Norway", keywords: "norway norwegian oslo krone", flag: "🇳🇴" },
  { code: "DKK", name: "Danish Krone", country: "Denmark", keywords: "denmark danish copenhagen krone", flag: "🇩🇰" },
  { code: "ISK", name: "Icelandic Krona", country: "Iceland", keywords: "iceland icelandic reykjavik krona", flag: "🇮🇸" },
  { code: "PLN", name: "Polish Zloty", country: "Poland", keywords: "poland polish warsaw zloty", flag: "🇵🇱" },
  { code: "CZK", name: "Czech Koruna", country: "Czech Republic", keywords: "czech czechia prague koruna", flag: "🇨🇿" },
  { code: "HUF", name: "Hungarian Forint", country: "Hungary", keywords: "hungary hungarian budapest forint", flag: "🇭🇺" },
  { code: "RON", name: "Romanian Leu", country: "Romania", keywords: "romania romanian bucharest leu", flag: "🇷🇴" },
  { code: "BGN", name: "Bulgarian Lev", country: "Bulgaria", keywords: "bulgaria bulgarian sofia lev", flag: "🇧🇬" },
  { code: "RSD", name: "Serbian Dinar", country: "Serbia", keywords: "serbia serbian belgrade dinar", flag: "🇷🇸" },
  { code: "BAM", name: "Bosnian Mark", country: "Bosnia & Herzegovina", keywords: "bosnia herzegovina sarajevo mark", flag: "🇧🇦" },
  { code: "MKD", name: "Macedonian Denar", country: "North Macedonia", keywords: "macedonia macedonian skopje denar", flag: "🇲🇰" },
  { code: "ALL", name: "Albanian Lek", country: "Albania", keywords: "albania albanian tirana lek", flag: "🇦🇱" },
  { code: "MDL", name: "Moldovan Leu", country: "Moldova", keywords: "moldova moldovan leu", flag: "🇲🇩" },
  { code: "UAH", name: "Ukrainian Hryvnia", country: "Ukraine", keywords: "ukraine ukrainian kyiv hryvnia", flag: "🇺🇦" },
  { code: "BYN", name: "Belarusian Ruble", country: "Belarus", keywords: "belarus belarusian minsk ruble", flag: "🇧🇾" },
  { code: "RUB", name: "Russian Ruble", country: "Russia", keywords: "russia russian moscow ruble", flag: "🇷🇺" },

  // ── Americas ──
  { code: "MXN", name: "Mexican Peso", country: "Mexico", keywords: "mexico mexican peso", flag: "🇲🇽" },
  { code: "BRL", name: "Brazilian Real", country: "Brazil", keywords: "brazil brazilian real sao paulo rio", flag: "🇧🇷" },
  { code: "ARS", name: "Argentine Peso", country: "Argentina", keywords: "argentina argentine buenos aires peso", flag: "🇦🇷" },
  { code: "CLP", name: "Chilean Peso", country: "Chile", keywords: "chile chilean santiago peso", flag: "🇨🇱" },
  { code: "COP", name: "Colombian Peso", country: "Colombia", keywords: "colombia colombian bogota peso", flag: "🇨🇴" },
  { code: "PEN", name: "Peruvian Sol", country: "Peru", keywords: "peru peruvian lima sol", flag: "🇵🇪" },
  { code: "UYU", name: "Uruguayan Peso", country: "Uruguay", keywords: "uruguay uruguayan montevideo peso", flag: "🇺🇾" },
  { code: "PYG", name: "Paraguayan Guarani", country: "Paraguay", keywords: "paraguay paraguayan guarani", flag: "🇵🇾" },
  { code: "BOB", name: "Bolivian Boliviano", country: "Bolivia", keywords: "bolivia bolivian la paz boliviano", flag: "🇧🇴" },
  { code: "VES", name: "Venezuelan Bolívar", country: "Venezuela", keywords: "venezuela venezuelan caracas bolivar", flag: "🇻🇪" },
  { code: "GYD", name: "Guyanese Dollar", country: "Guyana", keywords: "guyana guyanese dollar", flag: "🇬🇾" },
  { code: "SRD", name: "Surinamese Dollar", country: "Suriname", keywords: "suriname surinamese dollar", flag: "🇸🇷" },
  { code: "CRC", name: "Costa Rican Colón", country: "Costa Rica", keywords: "costa rica costarican colon", flag: "🇨🇷" },
  { code: "PAB", name: "Panamanian Balboa", country: "Panama", keywords: "panama panamanian balboa", flag: "🇵🇦" },
  { code: "GTQ", name: "Guatemalan Quetzal", country: "Guatemala", keywords: "guatemala guatemalan quetzal", flag: "🇬🇹" },
  { code: "HNL", name: "Honduran Lempira", country: "Honduras", keywords: "honduras honduran lempira", flag: "🇭🇳" },
  { code: "NIO", name: "Nicaraguan Córdoba", country: "Nicaragua", keywords: "nicaragua nicaraguan cordoba", flag: "🇳🇮" },
  { code: "DOP", name: "Dominican Peso", country: "Dominican Republic", keywords: "dominican republic santo domingo peso", flag: "🇩🇴" },
  { code: "CUP", name: "Cuban Peso", country: "Cuba", keywords: "cuba cuban havana peso", flag: "🇨🇺" },
  { code: "HTG", name: "Haitian Gourde", country: "Haiti", keywords: "haiti haitian gourde", flag: "🇭🇹" },
  { code: "JMD", name: "Jamaican Dollar", country: "Jamaica", keywords: "jamaica jamaican kingston dollar", flag: "🇯🇲" },
  { code: "TTD", name: "Trinidad & Tobago Dollar", country: "Trinidad and Tobago", keywords: "trinidad tobago dollar", flag: "🇹🇹" },
  { code: "BBD", name: "Barbadian Dollar", country: "Barbados", keywords: "barbados bajan dollar", flag: "🇧🇧" },
  { code: "BSD", name: "Bahamian Dollar", country: "Bahamas", keywords: "bahamas bahamian dollar", flag: "🇧🇸" },
  { code: "BZD", name: "Belize Dollar", country: "Belize", keywords: "belize belizean dollar", flag: "🇧🇿" },
  { code: "XCD", name: "East Caribbean Dollar", country: "Eastern Caribbean", keywords: "antigua barbuda dominica grenada saint lucia st kitts", flag: "🏝️" },

  // ── Africa ──
  { code: "ZAR", name: "South African Rand", country: "South Africa", keywords: "south africa south african rand cape town", flag: "🇿🇦" },
  { code: "NGN", name: "Nigerian Naira", country: "Nigeria", keywords: "nigeria nigerian lagos abuja naira", flag: "🇳🇬" },
  { code: "KES", name: "Kenyan Shilling", country: "Kenya", keywords: "kenya kenyan nairobi shilling", flag: "🇰🇪" },
  { code: "EGP", name: "Egyptian Pound", country: "Egypt", keywords: "egypt egyptian cairo pound", flag: "🇪🇬" },
  { code: "GHS", name: "Ghanaian Cedi", country: "Ghana", keywords: "ghana ghanaian accra cedi", flag: "🇬🇭" },
  { code: "TZS", name: "Tanzanian Shilling", country: "Tanzania", keywords: "tanzania tanzanian shilling", flag: "🇹🇿" },
  { code: "UGX", name: "Ugandan Shilling", country: "Uganda", keywords: "uganda ugandan kampala shilling", flag: "🇺🇬" },
  { code: "ETB", name: "Ethiopian Birr", country: "Ethiopia", keywords: "ethiopia ethiopian addis ababa birr", flag: "🇪🇹" },
  { code: "MAD", name: "Moroccan Dirham", country: "Morocco", keywords: "morocco moroccan marrakech dirham", flag: "🇲🇦" },
  { code: "DZD", name: "Algerian Dinar", country: "Algeria", keywords: "algeria algerian dinar", flag: "🇩🇿" },
  { code: "TND", name: "Tunisian Dinar", country: "Tunisia", keywords: "tunisia tunisian dinar", flag: "🇹🇳" },
  { code: "LYD", name: "Libyan Dinar", country: "Libya", keywords: "libya libyan dinar", flag: "🇱🇾" },
  { code: "SDG", name: "Sudanese Pound", country: "Sudan", keywords: "sudan sudanese pound", flag: "🇸🇩" },
  { code: "SSP", name: "South Sudanese Pound", country: "South Sudan", keywords: "south sudan pound", flag: "🇸🇸" },
  { code: "SOS", name: "Somali Shilling", country: "Somalia", keywords: "somalia somali mogadishu shilling", flag: "🇸🇴" },
  { code: "DJF", name: "Djiboutian Franc", country: "Djibouti", keywords: "djibouti franc", flag: "🇩🇯" },
  { code: "ERN", name: "Eritrean Nakfa", country: "Eritrea", keywords: "eritrea eritrean nakfa", flag: "🇪🇷" },
  { code: "RWF", name: "Rwandan Franc", country: "Rwanda", keywords: "rwanda rwandan kigali franc", flag: "🇷🇼" },
  { code: "BIF", name: "Burundian Franc", country: "Burundi", keywords: "burundi burundian franc", flag: "🇧🇮" },
  { code: "CDF", name: "Congolese Franc", country: "DR Congo", keywords: "congo kinshasa franc", flag: "🇨🇩" },
  { code: "XAF", name: "Central African CFA Franc", country: "Central Africa (Cameroon/Gabon)", keywords: "cameroon gabon congo chad cfa franc", flag: "🌍" },
  { code: "XOF", name: "West African CFA Franc", country: "West Africa (Senegal/Ivory Coast)", keywords: "senegal ivory coast dakar abidjan cfa franc", flag: "🌍" },
  { code: "AOA", name: "Angolan Kwanza", country: "Angola", keywords: "angola angolan kwanza", flag: "🇦🇴" },
  { code: "MZN", name: "Mozambican Metical", country: "Mozambique", keywords: "mozambique mozambican metical", flag: "🇲🇿" },
  { code: "ZMW", name: "Zambian Kwacha", country: "Zambia", keywords: "zambia zambian kwacha", flag: "🇿🇲" },
  { code: "MWK", name: "Malawian Kwacha", country: "Malawi", keywords: "malawi malawian kwacha", flag: "🇲🇼" },
  { code: "BWP", name: "Botswana Pula", country: "Botswana", keywords: "botswana pula", flag: "🇧🇼" },
  { code: "NAD", name: "Namibian Dollar", country: "Namibia", keywords: "namibia namibian dollar", flag: "🇳🇦" },
  { code: "SZL", name: "Eswatini Lilangeni", country: "Eswatini", keywords: "eswatini swaziland lilangeni", flag: "🇸🇿" },
  { code: "LSL", name: "Lesotho Loti", country: "Lesotho", keywords: "lesotho loti", flag: "🇱🇸" },
  { code: "ZWL", name: "Zimbabwean Dollar", country: "Zimbabwe", keywords: "zimbabwe zimbabwean dollar", flag: "🇿🇼" },
  { code: "MGA", name: "Malagasy Ariary", country: "Madagascar", keywords: "madagascar malagasy ariary", flag: "🇲🇬" },
  { code: "MUR", name: "Mauritian Rupee", country: "Mauritius", keywords: "mauritius mauritian rupee", flag: "🇲🇺" },
  { code: "SCR", name: "Seychellois Rupee", country: "Seychelles", keywords: "seychelles rupee", flag: "🇸🇨" },
  { code: "GMD", name: "Gambian Dalasi", country: "Gambia", keywords: "gambia gambian dalasi", flag: "🇬🇲" },
  { code: "SLL", name: "Sierra Leonean Leone", country: "Sierra Leone", keywords: "sierra leone leone", flag: "🇸🇱" },
  { code: "LRD", name: "Liberian Dollar", country: "Liberia", keywords: "liberia liberian dollar", flag: "🇱🇷" },
  { code: "GNF", name: "Guinean Franc", country: "Guinea", keywords: "guinea guinean franc", flag: "🇬🇳" },
  { code: "MRU", name: "Mauritanian Ouguiya", country: "Mauritania", keywords: "mauritania ouguiya", flag: "🇲🇷" },

  // ── Pacific & Oceania ──
  { code: "FJD", name: "Fijian Dollar", country: "Fiji", keywords: "fiji fijian dollar", flag: "🇫🇯" },
  { code: "PGK", name: "Papua New Guinean Kina", country: "Papua New Guinea", keywords: "papua new guinea kina", flag: "🇵🇬" },
  { code: "WST", name: "Samoan Tala", country: "Samoa", keywords: "samoa samoan tala", flag: "🇼🇸" },
  { code: "TOP", name: "Tongan Paʻanga", country: "Tonga", keywords: "tonga tongan paanga", flag: "🇹🇴" },
  { code: "VUV", name: "Vanuatu Vatu", country: "Vanuatu", keywords: "vanuatu vatu", flag: "🇻🇺" },
  { code: "SBD", name: "Solomon Islands Dollar", country: "Solomon Islands", keywords: "solomon islands dollar", flag: "🇸🇧" },
  { code: "XPF", name: "CFP Franc", country: "French Polynesia / New Caledonia", keywords: "tahiti polynesie caledonie cfp", flag: "🇵🇫" },
];

/* ─── Searchable & Typeable Currency Combobox ─── */
function CurrencyPicker({ value, onChange }) {
  const [dropOpen, setDropOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setDropOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus search input automatically when opened
  useEffect(() => {
    if (dropOpen) {
      setTimeout(() => searchRef.current?.focus(), 40);
      setHighlightIdx(0);
    }
  }, [dropOpen]);

  // Comprehensive filter across code, currency name, country name, and keywords/nationalities
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CURRENCY_DATA;
    return CURRENCY_DATA.filter((c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      (c.keywords && c.keywords.toLowerCase().includes(q))
    );
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[highlightIdx];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  function pick(code) {
    onChange(code);
    setDropOpen(false);
    setSearch("");
  }

  function pickCustom(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // If it's a 3-letter code or country, pass it uppercase or as entered
    onChange(trimmed.length === 3 ? trimmed.toUpperCase() : trimmed);
    setDropOpen(false);
    setSearch("");
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightIdx]) {
        pick(filtered[highlightIdx].code);
      } else if (search.trim()) {
        pickCustom(search);
      }
    } else if (e.key === "Escape") {
      setDropOpen(false);
    }
  }

  const selected = CURRENCY_DATA.find((c) => c.code === value);

  return (
    <div className="aura-currency-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`aura-currency-btn ${value ? "has-value" : ""}`}
        onClick={() => setDropOpen(!dropOpen)}
        aria-haspopup="listbox"
        aria-expanded={dropOpen}
        title="Choose or type your country / currency"
      >
        <Icon name="swap" size={18} className="aura-currency-icon" />
        {selected ? (
          <span className="aura-currency-label">
            <span className="aura-currency-flag">{selected.flag}</span>
            <span className="aura-currency-code">{selected.code}</span>
            <span className="aura-currency-country-hint">({selected.country.split(" ")[0]})</span>
          </span>
        ) : value ? (
          <span className="aura-currency-label">
            <span className="aura-currency-code">{value}</span>
          </span>
        ) : (
          <span className="aura-currency-placeholder">Choose or type currency / country…</span>
        )}
        {value && (
          <span
            className="aura-currency-clear"
            role="button"
            aria-label="Clear currency"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            <Icon name="close" size={14} />
          </span>
        )}
        <Icon name="chevron-down" size={18} className={`aura-currency-chevron ${dropOpen ? "is-open" : ""}`} />
      </button>

      {dropOpen && (
        <div className="aura-currency-dropdown" role="listbox">
          <div className="aura-currency-search-wrap">
            <input
              ref={searchRef}
              className="aura-currency-search"
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIdx(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type any country (e.g. Afghanistan, France) or currency…"
              aria-label="Type country or currency"
            />
            <p className="aura-currency-search-tip">
              💡 Type your country, nationality, or currency name (e.g. <em>Afghan</em>, <em>Australia</em>, <em>USD</em>)
            </p>
          </div>

          <ul className="aura-currency-list" ref={listRef}>
            {filtered.length > 0 ? (
              filtered.map((c, i) => (
                <li
                  key={`${c.code}-${c.country}`}
                  role="option"
                  aria-selected={c.code === value}
                  className={`aura-currency-option ${c.code === value ? "is-selected" : ""} ${i === highlightIdx ? "is-highlighted" : ""}`}
                  onClick={() => pick(c.code)}
                  onMouseEnter={() => setHighlightIdx(i)}
                >
                  <span className="aura-currency-opt-flag">{c.flag}</span>
                  <span className="aura-currency-opt-info">
                    <span className="aura-currency-opt-header">
                      <strong>{c.code}</strong>
                      <span className="aura-currency-opt-country-badge">{c.country}</span>
                    </span>
                    <span className="aura-currency-opt-name">{c.name}</span>
                  </span>
                </li>
              ))
            ) : (
              <li className="aura-currency-empty">
                <span>No exact match for "{search}"</span>
                <button
                  type="button"
                  className="aura-currency-custom-btn"
                  onClick={() => pickCustom(search)}
                >
                  Use "{search.trim()}" as my currency / country
                </button>
              </li>
            )}

            {/* Custom option button when user types something that might not be identical to an item */}
            {search.trim().length > 1 && (
              <li className="aura-currency-custom-row">
                <button
                  type="button"
                  className="aura-currency-custom-pick"
                  onClick={() => pickCustom(search)}
                >
                  Select custom: <strong>"{search.trim()}"</strong>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AuraChat({ apiBase = "" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [quick, setQuick] = useState("");
  const [currency, setCurrency] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState(loadLang);
  const [builder, setBuilder] = useState(null); // null = closed; { request, key }

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Full-page mode: lock the host page's scroll and allow Esc to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setBuilder(null);
    setDraft("");
    setError(null);
    inputRef.current?.focus();
  }

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const history = [...messages, { role: "user", content: trimmed, time: Date.now() }];
    setMessages([...history, { role: "assistant", content: "", time: Date.now() }]);
    setDraft("");
    setError(null);
    setStreaming(true);

    // Tell Aura the chosen currency on the latest turn without showing it in the chat.
    const notes = [currency && `My currency: ${currency}`, `Reply language: ${langInfo.name}`]
      .filter(Boolean)
      .join("; ");
    const payload = history.map((m, i) => ({
      role: m.role,
      content: i === history.length - 1 ? `${m.content}

[${notes}]` : m.content,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(String(res.status));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop();

        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "delta") {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: next[next.length - 1].content + event.text,
              };
              return next;
            });
          } else if (event.type === "error") {
            setError(AI_DOWN);
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") setError(AI_DOWN);
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  }

  const t = I18N[lang];
  const langInfo = LANGS.find((l) => l.code === lang);
  const empty = messages.length === 0;
  const lastIdx = messages.length - 1;

  if (!open) {
    return (
      <div className="aura">
        <button
          className="aura-launch"
          onClick={() => setOpen(true)}
          aria-label="Open Aura AI Travel Assistant"
        >
          <span className="aura-launch-badge" aria-hidden="true">
            <Icon name="message-circle" size={22} className="aura-launch-icon" />
            <span className="aura-launch-dot" />
          </span>
          <span className="aura-launch-text">
            <span className="aura-launch-label">Plan with Aura</span>
            <span className="aura-launch-hint">AI Travel Assistant • Online</span>
          </span>
          <Icon name="arrow-forward" size={20} className="aura-launch-arrow" />
        </button>
        <form
          className="aura-quick"
          onSubmit={(e) => {
            e.preventDefault();
            const text = quick.trim();
            if (!text) return;
            setQuick("");
            setOpen(true);
            send(text);
          }}
        >
          <input
            className="aura-quick-input"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="Or ask Aura a question…"
            aria-label="Ask Aura a question"
          />
          <button className="aura-quick-send" type="submit" disabled={!quick.trim()} aria-label="Ask Aura">
            <Icon name="arrow-upward" size={18} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="aura aura-page" role="dialog" aria-modal="true" aria-label="Aura travel assistant">
      <nav className="aura-rail" aria-label="Aura navigation">
        <img className="aura-logo" src="/images/logo.png" alt="Logo" />

        <button className="aura-rail-item aura-rail-create" onClick={newChat}>
          <span className="aura-rail-icon aura-rail-plus"><Icon name="plus" size={22} /></span>
          {t.newTrip}
        </button>
        <button className="aura-rail-item" onClick={() => setBuilder({ request: null, key: Date.now() })}>
          <span className="aura-rail-icon"><Icon name="map" /></span>
          {BUILDER_I18N[lang].title}
        </button>
        <button className="aura-rail-item" onClick={() => send(t.pPackages)} disabled={streaming}>
          <span className="aura-rail-icon"><Icon name="compass" /></span>
          {t.packages}
        </button>
        <button className="aura-rail-item" onClick={() => send(t.pBudget)} disabled={streaming}>
          <span className="aura-rail-icon"><Icon name="credit-card" /></span>
          {t.budget}
        </button>
        <button className="aura-rail-item" onClick={() => send(t.pPacking)} disabled={streaming}>
          <span className="aura-rail-icon"><Icon name="briefcase" /></span>
          {t.packing}
        </button>
        <span className="aura-rail-item is-active">
          <span className="aura-rail-icon"><Icon name="flash" /></span>
          Aura AI
        </span>

        <button className="aura-rail-item aura-rail-back" onClick={() => setOpen(false)}>
          <span className="aura-rail-icon"><Icon name="arrow-back" /></span>
          {t.back}
        </button>
      </nav>

      <div className="aura-main">
        <header className="aura-top">
          <div className="aura-tabs">
            <span className="aura-tab">{empty ? t.newChat : messages[0].content}</span>
            <button className="aura-tab-add" onClick={newChat} aria-label="Start a new chat"><Icon name="plus" size={20} /></button>
          </div>
          <div className="aura-top-links">
            <label className="aura-lang">
              <Icon name="globe" size={18} />
              <select
                value={lang}
                aria-label="Language"
                onChange={(e) => {
                  setLang(e.target.value);
                  try { localStorage.setItem("aura-lang", e.target.value); } catch { /* ignore */ }
                }}
              >
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            <button
              className="aura-draft-open"
              disabled={streaming || !messages.some((m) => m.role === "user")}
              onClick={() => setBuilder({ request: messages.filter((m) => m.role === "user").map((m) => m.content).join("\n") + (currency ? `\n(Currency: ${currency})` : ""), key: Date.now() })}
              title="Aura drafts a package for you in the Package Builder"
            ><Icon name="map" size={18} />Draft</button>
            <button onClick={() => send(t.pPackages)} disabled={streaming}><Icon name="compass" size={18} />{t.packages}</button>
            <button onClick={() => send(t.pItinerary)} disabled={streaming}><Icon name="map" size={18} />{t.itinerary}</button>
            <button className="aura-close" onClick={() => setOpen(false)} aria-label="Close assistant"><Icon name="close" size={22} /></button>
          </div>
        </header>

        <div className={`aura-scroll ${empty ? "is-empty" : "is-chat"}`} ref={scrollRef}>
          {empty ? (
            <section className="aura-hero">
              <h1 className="aura-headline">{t.headline}</h1>
              <p className="aura-sub">{t.sub(currency)}</p>

              <div className="aura-cards">
                {CARD_IMAGES.map((image, ci) => {
                  const [title, hint, prompt] = t.cards[ci];
                  return (
                  <button key={image} className="aura-card" onClick={() => send(prompt)} aria-label={title}>
                    <img className="aura-card-img" src={image} alt="" loading="lazy" />
                    <span className="aura-card-chip" aria-hidden="true"><Icon name="arrow-forward" size={18} /></span>
                    <span className="aura-card-caption">
                      <span className="aura-card-text">
                        <span className="aura-card-title">{title}</span>
                        <span className="aura-card-hint">{hint}</span>
                      </span>
                      <span className="aura-card-go" aria-hidden="true"><Icon name="arrow-forward" size={18} /></span>
                    </span>
                  </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="aura-thread">
              {messages.map((m, i) => (
                <article key={i} className={`aura-msg aura-msg-${m.role}`}>
                  {m.role === "assistant" ? (
                    <>
                      <span className="aura-avatar" aria-hidden="true">A</span>
                      <div className="aura-bubble">
                        <span className="aura-bubble-name">Aura</span>
                        {m.content ? (
                          <div className="aura-md">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                            {streaming && i === lastIdx && <span className="aura-caret" />}
                          </div>
                        ) : (
                          <span className="aura-typing" aria-label="Aura is typing">
                            <i /><i /><i />
                          </span>
                        )}
                        {m.content && !(streaming && i === lastIdx) && (
                          <time className="aura-time" dateTime={new Date(m.time).toISOString()}>{formatTime(m.time, langInfo.locale)}</time>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="aura-user-text">{m.content}</span>
                      <time className="aura-time" dateTime={new Date(m.time).toISOString()}>{formatTime(m.time, langInfo.locale)}</time>
                    </>
                  )}
                </article>
              ))}
              {error && <p className="aura-error">{error}</p>}
              {!streaming && !error && messages[lastIdx]?.role === "assistant" && messages[lastIdx].content && messages.filter((m) => m.role === "user").length >= 2 && (
                <div className="aura-ready">
                  <div>
                    <strong>{PAGE_I18N[lang].readyTitle}</strong>
                    <p>{PAGE_I18N[lang].readyText}</p>
                  </div>
                  <button onClick={() => setBuilder({ request: messages.filter((m) => m.role === "user").map((m) => m.content).join("\n") + (currency ? `\n(Currency: ${currency})` : ""), key: Date.now() })}>
                    {PAGE_I18N[lang].readyBtn}
                  </button>
                </div>
              )}
              {!streaming && !error && messages[lastIdx]?.role === "assistant" && (
                <div className="aura-replies" aria-label="Quick replies">
                  {t.replies.map((r) => (
                    <button key={r} onClick={() => send(r)}>{r}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {empty && error && <p className="aura-error">{error}</p>}
        </div>

        <div className="aura-dock">
          <div className="aura-compose">
            <textarea
              ref={inputRef}
              rows={2}
              value={draft}
              placeholder={t.placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className="aura-compose-bar">
              <CurrencyPicker value={currency} onChange={setCurrency} />
              <button className="aura-send" onClick={() => send(draft)} disabled={streaming || !draft.trim()} aria-label="Send">
                <Icon name="arrow-upward" size={22} />
              </button>
            </div>
          </div>
          <p className="aura-fine">{t.fine}</p>
        </div>
      </div>
      {builder && (
        <BuilderPage
          key={builder.key}
          apiBase={apiBase}
          lang={lang}
          language={langInfo.name}
          request={builder.request}
          onClose={() => setBuilder(null)}
        />
      )}
    </div>
  );
}

