import { CURRENCY_DATA } from "./currencyData.js";
import { useEffect, useId, useState } from "react";

export default function useCurrency(apiBase, preferred = "LKR") {
  const [code, setCode] = useState(/^[A-Z]{3}$/i.test(preferred) ? preferred.toUpperCase() : "LKR");
  const [feed, setFeed] = useState({ rates: { LKR: 1 }, available: false });
  useEffect(() => {
    let live = true;
    fetch(`${apiBase}/api/currencies`).then(r => {
      if (!r.ok) throw new Error("rates");
      return r.json();
    }).then(r => live && setFeed(r)).catch(() => {});
    return () => { live = false; };
  }, [apiBase]);
  const money = (n, currency) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  const fmt = n => {
    const lkr = money(n, "LKR");
    return code === "LKR" ? lkr : feed.rates[code] ? `≈ ${money(n * feed.rates[code], code)} · ${lkr}` : `${lkr} · ${code} conversion unavailable`;
  };
  return { code, setCode, feed, fmt };
}

export function CurrencyControl({ pricing }) {
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const codes = [...new Set(["LKR", pricing.code, ...Object.keys(pricing.feed.rates)])].sort();
  const label = code => {
    const records = CURRENCY_DATA.filter(c => c.code === code);
    const name = records[0]?.name || new Intl.DisplayNames(["en"], { type:"currency" }).of(code);
    return `${name} (${code})${records.length ? " · " + records.map(c => c.country).join(", ") : ""}`;
  };
  function choose(text) {
    const q = text.trim().toLowerCase();
    const found = CURRENCY_DATA.find(c => [c.code, c.name, c.country].some(v => v.toLowerCase() === q)) || CURRENCY_DATA.find(c => label(c.code).toLowerCase() === q);
    const code = found?.code || (codes.includes(text.trim().toUpperCase()) ? text.trim().toUpperCase() : null);
    if (!code || !codes.includes(code)) { setError("Choose a matching country or currency from the suggestions."); return; }
    pricing.setCode(code); setSearch(""); setError("");
  }
  return <div className="trip-currency"><label>Your currency or country
    <input className="bp-input" list={id} value={search} onChange={e => { setSearch(e.target.value); setError(""); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); choose(search); } }} placeholder="Type a country, currency name or code" />
    <datalist id={id}>{CURRENCY_DATA.filter(c => codes.includes(c.code)).map(c => <option key={c.code+c.country} value={c.country}>{c.name} ({c.code})</option>)}{codes.map(c => <option key={c} value={c}>{label(c)}</option>)}</datalist>
  </label><button type="button" className="bp-btn bp-btn-sm" disabled={!search.trim()} onClick={() => choose(search)}>Use currency</button>
  <label>Or choose from the list<select value={pricing.code} onChange={e => { pricing.setCode(e.target.value); setSearch(""); setError(""); }} aria-label="Price currency">{codes.map(c => <option value={c} key={c}>{label(c)}</option>)}</select></label>
  {error && <small role="status">{error}</small>}
  <small title={`${pricing.feed.source || "Exchange rates"} · ${pricing.feed.updated || ""}`}>{pricing.feed.available ? `${pricing.feed.stale ? "Cached" : "Indicative"} conversion · LKR base` : "Conversion unavailable · LKR prices"}</small></div>;
}
