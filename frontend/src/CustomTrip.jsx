import usePackageText from "./usePackageText.js";
import TravelDate from "./TravelDate.jsx";
import Icon from "./Icon.jsx";
import TripPreparation, { emptyPreparation } from "./TripPreparation.jsx";
import { useEffect, useRef, useState } from "react";
import useCurrency, { CurrencyControl } from "./useCurrency.jsx";
import TripMap from "./TripMap.jsx";
import PriceChart from "./PriceChart.jsx";
import { dayPlaces, groupNearbyDays } from "./tripPlaces.js";

const PHOTOS = { JAF: "heritage", ISL: "delft", CUL: "food", WEL: "delft", NAT: "wildlife", ROM: "romantic" };
const photo = id => `/images/cards/${PHOTOS[id?.split("-")[1]] || "budget"}.jpg`;
const THEMES = { JAF: "Heritage", ISL: "Islands", CUL: "Food", WEL: "Wellness", NAT: "Wildlife", ROM: "Romance" };

async function api(base, path, body) {
  const r = await fetch(`${base}${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Please try again.");
  return data;
}

export default function CustomTrip({ apiBase, currency, language = "English", initialPreparation, onBack }) {
  const pricing = useCurrency(apiBase, currency);
  const [packages, setPackages] = useState([]);
  const localize = usePackageText(apiBase, language, packages.map(p => p.id));
  const categoryRows = useRef({});
  const scrollCategory = (name, direction) => { const row = categoryRows.current[name]; if (row) row.scrollBy({ left: direction * Math.max(240, row.clientWidth * .8), behavior: "smooth" }); };
  const [groupRoute, setGroupRoute] = useState(true);
  const [days, setDays] = useState([]);
  const [base, setBase] = useState("");
  const [options, setOptions] = useState(null);
  const [selections, setSelections] = useState({});
  const [travelers, setTravelers] = useState(2);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("places");
  const [theme, setTheme] = useState("All");
  const [focusedDay, setFocusedDay] = useState(null);
  const [wish, setWish] = useState("");
  const [planning, setPlanning] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [planError, setPlanError] = useState("");
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [budget, setBudget] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preparation, setPreparation] = useState(initialPreparation || emptyPreparation);
  const [form, setForm] = useState({ customer_name: "", customer_email: "", travel_date: "", notes: "", confirmed: false });
  useEffect(() => { api(apiBase, "/api/packages").then(p => { setPackages(p); setBase(p[0]?.id || ""); }).catch(e => setError(e.message)); }, [apiBase]);
  useEffect(() => {
    if (!base) return;
    let live = true;
    setOptions(null); setSelections({});
    api(apiBase, `/api/builder/${base}`).then(o => { if (live) setOptions(o); }).catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [base, apiBase]);
  const payload = { package_id: base, travelers, selections, days: days.map(({ package_id, day }) => ({ package_id, day })) };
  useEffect(() => {
    setQuote(null); setReview(false); setError(""); setReference("");
    if (!days.length || !options) return;
    let live = true;
    api(apiBase, "/api/builder/custom/quote", payload).then(q => live && setQuote(q)).catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [days, base, selections, travelers, options, apiBase]);
  const move = (i, direction) => { setGroupRoute(false); setDays(old => { const next = [...old]; [next[i], next[i + direction]] = [next[i + direction], next[i]]; return next; }); };
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try { const r = await api(apiBase, "/api/builder/custom/requests", { ...payload, ...form, notes: [form.notes, endDate ? `Travel dates: ${form.travel_date} to ${endDate}` : ""].filter(Boolean).join("\n"), preparation }); setReference(r.reference); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function plan(e) {
    e.preventDefault();
    if (!wish.trim() || planning || !packages.length) return;
    setPlanning(true); setPlanError("");
    try {
      const result = await api(apiBase, "/api/draft", { request: `${wish.trim()}\nTravelers: ${travelers}. Preferred dates: ${form.travel_date || "not set"} to ${endDate || "not set"}. Currency: ${pricing.code}.`, language });
      const mapped = result.days.map(ref => {
        const pkg = packages.find(p => p.id === ref.package_id);
        const day = pkg?.itinerary.find(d => d.day === ref.day);
        return day ? { ...day, package_id: pkg.id, places: dayPlaces(day, pkg) } : null;
      }).filter(Boolean);
      if (!mapped.length) throw new Error("No matching days. Try another idea.");
      setDays(groupRoute ? groupNearbyDays(mapped) : mapped); setFocusedDay(0); setTab("places");
      setPlanError((result.unmet || []).join(" · "));
    } catch (e) { setPlanError(e.message); } finally { setPlanning(false); }
  }
  return <div className="custom-trip">
    <div className="trip-intro"><div><span className="trip-eyebrow">YOUR TRIP, YOUR WAY</span><h1>Make the journey yours.</h1><p>Pick your favourites. We’ll connect the journey.</p></div><button className="bp-btn bp-btn-ghost" onClick={onBack}>Browse packages</button></div><div className="planner-steps" aria-label="Planning steps"><span className={tab === "places" ? "current" : ""}><b>01</b> Explore</span><i /><span className={tab === "comfort" ? "current" : ""}><b>02</b> Personalize</span><i /><span className={review ? "current" : ""}><b>03</b> Review</span></div>
    <div className="trip-setup"><label><Icon name="travelers" size={18} /> Travelers<input type="number" min="1" max="30" value={travelers} onChange={e => setTravelers(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} /></label><label><Icon name="calendar" size={18} /> Travel dates<TravelDate label="Travel dates" endValue={endDate} onEndChange={setEndDate} value={form.travel_date} onChange={e => setForm(f => ({...f, travel_date:e.target.value}))} /></label><span><Icon name="map" size={17} /> Northern Sri Lanka</span></div>
    <button className="planner-ai-launch" aria-expanded={aiOpen} aria-controls="planner-ai-panel" onClick={() => setAiOpen(v => !v)}><Icon name="sparkles" size={20} /> {aiOpen ? "Close Aura" : "Ask Aura"}</button>
    {aiOpen && <section id="planner-ai-panel" className="planner-ai-panel" aria-label="Aura route assistant"><header><div><strong>Plan with Aura</strong><small>Your route, a little inspiration.</small></div><button aria-label="Close Aura help" onClick={() => setAiOpen(false)}><Icon name="close" size={18} /></button></header><form className="trip-ai-start" onSubmit={plan}><label><span>Describe your trip</span><textarea aria-label="Describe your trip" placeholder="3 days, quiet beaches, local food…" value={wish} maxLength={5000} onChange={e => setWish(e.target.value)} /></label><button className="bp-btn" disabled={planning || wish.trim().length < 3 || !packages.length}>{planning ? "Planning…" : "Create route"}</button></form>{planError && <p className="route-warning" role="status">{planError}</p>}</section>}
    <div className="custom-layout"><main>
      <nav className="trip-tabs" aria-label="Trip customization"><button className={tab === "places" ? "active" : ""} onClick={() => setTab("places")}><Icon name="compass" size={18} /> Experiences</button><button className={tab === "comfort" ? "active" : ""} onClick={() => setTab("comfort")}><Icon name="bed" size={18} /> Stay & extras</button></nav>
      {tab === "places" && <section className="experience-browser"><div className="explore-heading"><h2>Explore your experiences</h2><span>{days.length} days selected</span></div><input className="bp-input" placeholder="Search a place or experience" aria-label="Search itinerary days" value={filter} onChange={e => setFilter(e.target.value)} />
        <div className="theme-filters">{["All", ...Object.values(THEMES)].map(name => <button key={name} className={theme === name ? "active" : ""} onClick={() => setTheme(name)}>{name}</button>)}</div>
        {Object.values(THEMES).filter(name => theme === "All" || name === theme).map(name => {
          const matches = packages.filter(p => THEMES[p.id.split("-")[1]] === name).flatMap(p => p.itinerary.filter(d => `${p.title} ${p.destinations.join(" ")} ${d.title} ${d.activities}`.toLowerCase().includes(filter.toLowerCase())).map(d => ({p,d})));
          if (!matches.length) return null;
          return <section className="experience-category" key={name} aria-label={`${name} experiences`}><header><div><h3>{name}</h3><span>{matches.length} experiences</span></div><div className="category-arrows"><button aria-label={`Scroll ${name} left`} onClick={() => scrollCategory(name,-1)}><Icon name="arrow-back" size={18} /></button><button aria-label={`Scroll ${name} right`} onClick={() => scrollCategory(name,1)}><Icon name="arrow-forward" size={18} /></button></div></header><div className="experience-row" ref={node => { categoryRows.current[name] = node; }} tabIndex={0} role="region" aria-label={`Browse ${name} cards`}>{matches.map(({p,d}) => {
          const added = days.some(x => x.package_id === p.id && x.day === d.day);
          const places = dayPlaces(d, p);
          const ld = localize(p).itinerary.find(x => x.day === d.day) || d;
          return <article className={`experience-visual ${added ? "added" : ""}`} key={`${p.id}-${d.day}`}><div className="experience-photo"><img src={photo(p.id)} alt={`${THEMES[p.id.split("-")[1]] || "Travel"} experience`} loading="lazy" /><span><Icon name={p.icon_name || "compass"} size={15} /> {THEMES[p.id.split("-")[1]]} · 1 day</span>{places.some(s => s.island) && <b>Ferry</b>}</div><div className="experience-info"><h3>{ld.title}</h3><p className="place-caption">📍 {places.map(s => s.name).join(" – ") || "Location to confirm"}</p><div className="experience-price"><strong>{pricing.fmt(Math.round(p.price_lkr / p.duration_days))}</strong><button className="bp-btn bp-btn-sm" disabled={added || days.length >= 30} onClick={() => { setDays(old => { const next = [...old, { ...d, package_id: p.id, places }]; return groupRoute ? groupNearbyDays(next) : next; }); setFocusedDay(null); }}>{added ? "✓ Added" : "+ Add day"}</button></div><details><summary>Discover this day</summary><p>{ld.activities}</p></details></div></article>;
        })}</div></section>; })}
        {!packages.length && <p>Loading experiences…</p>}
        {packages.length > 0 && !packages.some(p => (theme === "All" || THEMES[p.id.split("-")[1]] === theme) && p.itinerary.some(d => `${p.title} ${p.destinations.join(" ")} ${d.title} ${d.activities}`.toLowerCase().includes(filter.toLowerCase()))) && <p>No matches. Try another place.</p>}
      </section>}
      {tab === "comfort" && <section className="bp-card"><h3>Stay & extras</h3><label>Service catalogue<select className="bp-input" value={base} onChange={e => setBase(e.target.value)}>{packages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      {options?.groups.map(g => <div className="custom-options" key={g.id}><h4>{g.label}</h4><div className="bp-tiles">{g.options.map(o => {
        const selected = g.multi ? (selections[g.id] || []).includes(o.id) : (selections[g.id] || g.options.find(x => x.default)?.id) === o.id;
        return <label className={`bp-tile ${selected ? "is-on" : ""}`} key={o.id}><input type={g.multi ? "checkbox" : "radio"} name={`custom-${g.id}`} checked={selected} onChange={() => setSelections(s => ({ ...s, [g.id]: g.multi ? selected ? s[g.id].filter(x => x !== o.id) : [...(s[g.id] || []), o.id] : o.id }))} /><span className="comfort-symbol" aria-hidden="true"><Icon name={o.icon_name || { hotel: "bed", meals: "food", transport: "vehicle", extras: "sparkles" }[g.id]} size={24} /></span><strong>{o.label}</strong><small>{o.price_lkr ? `${o.price_lkr < 0 ? "Save" : "Add"} ${pricing.fmt(Math.abs(o.price_lkr))}` : "Included"}{o.price_lkr !== 0 && ` per ${o.price_type === "per_person_night" ? "person, per night" : o.price_type === "per_person" ? "person" : "trip"}`}{o.price_lkr < 0 && <span style={{display:"block"}}>Less than the included option</span>}</small></label>;
      })}</div></div>)}
      </section>}
    </main><aside><label className="route-group-toggle"><input type="checkbox" checked={groupRoute} onChange={e => { setGroupRoute(e.target.checked); if (e.target.checked) setDays(old => groupNearbyDays(old)); }} /> Group nearby days <small>Less backtracking · reorder below</small></label><TripMap days={days} onFocusDay={setFocusedDay} /><div className="trip-summary bp-card"><CurrencyControl pricing={pricing} /><div className="journey-heading"><h3>Your itinerary</h3><span>{days.length} days · {travelers} travelers</span></div>{!days.length && <p className="bp-muted">Your days appear here.</p>}<ol className="custom-day-list">{days.map((d, i) => <li className={focusedDay === i ? "focused" : ""} key={`${d.package_id}-${d.day}`}><span>{i + 1}</span><img src={photo(d.package_id)} alt="" /><div><strong>{d.title}</strong><small>{d.places?.map(s => s.name).join(" – ")}</small><div className="day-actions"><button disabled={!i} onClick={() => move(i, -1)} aria-label={`Move ${d.title} earlier`}>↑</button><button disabled={i === days.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${d.title} later`}>↓</button><button onClick={() => setDays(old => old.filter((_, n) => n !== i))}>Remove</button></div></div></li>)}</ol>
      {quote && <><p className="trip-total">{pricing.fmt(quote.total_lkr)}</p><p className="bp-muted">Estimated trip total · {quote.nights} nights</p><PriceChart quote={quote} fmt={pricing.fmt} /><details className="price-note"><summary>How pricing works</summary><p>Days use pro-rata package prices. Services scale with travelers and nights. Final routing, inclusions, availability and price need confirmation.</p></details></>}
      <label className="bp-label">Your budget ({pricing.code})<input className="bp-input" type="number" min="0" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Optional total budget" /></label>
      {quote && Number(budget) > 0 && pricing.feed.rates[pricing.code] && <div className="budget-meter"><meter min="0" max={Math.max(Number(budget), quote.total_lkr * pricing.feed.rates[pricing.code])} value={quote.total_lkr * pricing.feed.rates[pricing.code]} aria-label="Trip estimate compared with budget" /><p>{quote.total_lkr * pricing.feed.rates[pricing.code] <= Number(budget) ? "Within budget" : `Over by ${pricing.fmt(quote.total_lkr - Number(budget) / pricing.feed.rates[pricing.code])}`}</p></div>}
      <button className="bp-btn bp-cta" disabled={!quote || busy} onClick={() => setReview(true)}>Review trip</button>
      <button className="bp-btn bp-btn-ghost bp-cta" disabled={!days.length} onClick={() => { const blob = new Blob([JSON.stringify({ ...payload, estimate_lkr: quote?.total_lkr }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "my-custom-trip.json"; a.click(); URL.revokeObjectURL(url); }}>Save trip draft</button>
      {error && <p role="alert">{error}</p>}
      {review && !reference && <form className="custom-review" onSubmit={submit}><h3>Request your trip</h3><TripPreparation value={preparation} onChange={setPreparation} />{[["customer_name", "Your name", "text"], ["customer_email", "Email", "email"], ["travel_date", "Preferred start date", "date"]].map(([key, label, type]) => <label key={key}>{label}{type === "date" ? <TravelDate label={label} value={form[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))} /> : <input className="bp-input" type={type} required={key !== "travel_date"} minLength={key === "customer_name" ? 2 : undefined} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />}</label>)}<label>Anything else you wish for?<textarea className="bp-input" maxLength={1000} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></label><label><input type="checkbox" required checked={form.confirmed} onChange={e => setForm(f => ({ ...f, confirmed: e.target.checked }))} /> I agree to send this trip request for review. The estimate is subject to confirmation.</label><button className="bp-btn bp-cta" disabled={busy || !quote}>{busy ? "Sending…" : "Send trip request"}</button></form>}
      {reference && <p role="status">Request {reference} received. Our team will confirm the details and final price with you.</p>}
    </div></aside></div>
  </div>;
}
