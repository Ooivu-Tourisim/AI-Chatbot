import TravelDate from "./TravelDate.jsx";
import TripPreparation, { emptyPreparation } from "./TripPreparation.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { BUILDER_I18N } from "./builderStrings.js";
import { AI_I18N } from "./builderAiStrings.js";
import { DRAFT_I18N } from "./draftStrings.js";
import { PAGE_I18N } from "./builderPageStrings.js";
import "./BuilderPage.css";
import CustomTrip from "./CustomTrip.jsx";
import ChatActions from "./ChatActions.jsx";
import { deleteTurn } from "./chatHistory.js";
import TripMap from "./TripMap.jsx";
import { dayPlaces } from "./tripPlaces.js";
import useCurrency, { CurrencyControl } from "./useCurrency.jsx";

const DRAFT_TIMEOUT_MS = 15000; // progress bar length
const ABORT_MS = 17000; // network headroom beyond the server's own ~13 s limit

const COVER = {
  JAF: "/images/cards/heritage.jpg", ISL: "/images/cards/delft.jpg", CUL: "/images/cards/food.jpg",
  WEL: "/images/cards/delft.jpg", NAT: "/images/cards/wildlife.jpg", ROM: "/images/cards/romantic.jpg",
};
const cover = (id) => COVER[id?.split("-")[1]] || "/images/cards/budget.jpg";
const GROUP_ICON = { hotel: "🏨", meals: "🍽️", transport: "🚐", extras: "✨" };

async function call(apiBase, path, body, signal) {
  const res = await fetch(`${apiBase}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.detail || "generic"), { code: res.status === 503 ? "aiDown" : data.detail });
  return data;
}

export default function BuilderPage({ apiBase, lang, language, initialPackage, request, currency = "LKR", onClose }) {
  const [custom, setCustom] = useState(!request && !initialPackage);
  const pricing = useCurrency(apiBase, currency);
  const fmt = pricing.fmt;
  const signed = n => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
  const t = BUILDER_I18N[lang] || BUILDER_I18N.en;
  const a = AI_I18N[lang] || AI_I18N.en;
  const d = DRAFT_I18N[lang] || DRAFT_I18N.en;
  const p = PAGE_I18N[lang] || PAGE_I18N.en;

  const [packages, setPackages] = useState(null);
  const [pkgId, setPkgId] = useState(initialPackage || "");
  const [data, setData] = useState(null);
  const [travelers, setTravelers] = useState(2);
  const [sel, setSel] = useState({});
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState(false);
  const [modal, setModal] = useState(null); // null | details | done
  const [preparation, setPreparation] = useState(emptyPreparation);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "", date: "", ok: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ref, setRef] = useState("");

  const [phase, setPhase] = useState(request ? "drafting" : "idle"); // drafting | idle | failed
  const [elapsed, setElapsed] = useState(0);
  const [failMsg, setFailMsg] = useState("");
  const [ai, setAi] = useState(null);

  const [budget, setBudget] = useState("");
  const [savings, setSavings] = useState(null);

  const [chatOpen, setChatOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1180);
  const [chat, setChat] = useState([]); // { role: "aura"|"user", text, proposal?, applied? }
  const [deletedChat, setDeletedChat] = useState(null);
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [askErr, setAskErr] = useState("");

  const [month, setMonth] = useState("");
  const [list, setList] = useState(null);
  const [listBusy, setListBusy] = useState(false);
  const [listMsg, setListMsg] = useState("");
  const [newItem, setNewItem] = useState("");

  const abortRef = useRef(null);
  const chatEnd = useRef(null);
  const budgetLkr = parseInt(budget.replace(/\D/g, ""), 10) || 0;

  const generate = useCallback(async () => {
    setPhase("drafting");
    setElapsed(0);
    const controller = new AbortController();
    abortRef.current = controller;
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.min(Date.now() - started, DRAFT_TIMEOUT_MS)), 200);
    const timer = setTimeout(() => controller.abort(), ABORT_MS);
    try {
      const r = await call(apiBase, "/api/builder/draft", { request, language }, controller.signal);
      setSel(r.selections);
      setTravelers(r.travelers);
      setPkgId(r.package_id);
      setMonth(r.travel_month || "");
      if (r.budget_lkr) setBudget(String(r.budget_lkr));
      setAi({ why: r.why_it_fits, assumptions: r.assumptions, unmet: r.unmet });
      setChat([{ role: "aura", text: p.greet(r.why_it_fits) }]);
      setPhase("idle");
    } catch (ex) {
      setFailMsg(ex.name === "AbortError" ? d.timeout : ex.code === "no_match" ? d.noMatch : d.aiDown);
      setPhase("failed");
    } finally {
      clearInterval(tick);
      clearTimeout(timer);
    }
  }, [apiBase, request, language, d, p]);

  useEffect(() => {
    if (request) generate();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => {
    if (pkgId || phase !== "idle") return;
    call(apiBase, "/api/packages").then(setPackages).catch(() => setPackages([]));
  }, [pkgId, phase, apiBase]);

  useEffect(() => {
    if (!pkgId) { setData(null); return; }
    call(apiBase, `/api/builder/${pkgId}?lang=${lang}`)
      .then((r) => {
        setData(r);
        setSel((prev) => {
          const next = {};
          for (const g of r.groups) next[g.id] = prev[g.id] ?? (g.multi ? [] : (g.options.find((o) => o.default) ?? g.options[0]).id);
          return next;
        });
        setChat((c) => (c.length ? c : [{ role: "aura", text: p.greet("") }]));
      })
      .catch(() => setQuoteErr(true));
  }, [pkgId, lang, apiBase, p]);

  useEffect(() => {
    if (!data || !Object.keys(sel).length) return;
    setQuote(null);
    let live = true;
    call(apiBase, "/api/builder/quote", { package_id: pkgId, travelers, selections: sel })
      .then((q) => { if (live) { setQuote(q); setQuoteErr(false); } })
      .catch(() => live && setQuoteErr(true));
    return () => { live = false; };
  }, [data, pkgId, travelers, sel, apiBase]);

  useEffect(() => {
    if (!quote || !budgetLkr || quote.total_lkr <= budgetLkr) { setSavings(null); return; }
    let live = true;
    call(apiBase, "/api/builder/savings", { package_id: pkgId, travelers, selections: sel, budget_lkr: budgetLkr })
      .then((r) => live && setSavings(r))
      .catch(() => live && setSavings(null));
    return () => { live = false; };
  }, [quote, budgetLkr, pkgId, travelers, sel, apiBase]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "end" }); }, [chat, asking, chatOpen]);

  function pick(g, id) {
    setSel((s) => ({
      ...s,
      [g.id]: g.multi ? ((s[g.id] || []).includes(id) ? s[g.id].filter((x) => x !== id) : [...(s[g.id] || []), id]) : id,
    }));
  }

  async function sendAsk(text, previous = chat) {
    const message = (text ?? ask).trim();
    if (!message || asking || !quote) return;
    setDeletedChat(null);
    setChat([...previous, { role: "user", text: message }]);
    setAsk("");
    setAsking(true);
    setAskErr("");
    try {
      const r = await call(apiBase, "/api/builder/assist", {
        package_id: pkgId, travelers, selections: sel, message, language,
        ...(budgetLkr ? { budget_lkr: budgetLkr } : {}),
      });
      setChat((c) => [...c, { role: "aura", text: r.reply, proposal: r.proposal }]);
    } catch (ex) {
      setAskErr(ex.code === "aiDown" ? d.aiDown : t.errors.generic);
    } finally {
      setAsking(false);
    }
  }

  function applyProposal(i) {
    const pr = chat[i].proposal;
    setTravelers(pr.travelers);
    setSel(pr.selections);
    setChat((c) => c.map((m, k) => (k === i ? { ...m, applied: true } : m)));
  }

  async function makeList() {
    setListBusy(true);
    setListMsg("");
    try {
      const days = Array.from({ length: data.package.duration_days }, (_, i) => ({ package_id: pkgId, day: i + 1 }));
      const r = await call(apiBase, "/api/checklist", { days, month, language });
      setList({ note: r.note, categories: r.categories.map((c) => ({ name: c.name, items: c.items.map((text) => ({ text, done: false })) })) });
    } catch (ex) {
      setListMsg(ex.code === "aiDown" ? d.aiDown : t.errors.generic);
    } finally {
      setListBusy(false);
    }
  }
  const patchList = (fn) => setList((l) => ({ ...l, categories: fn(l.categories) }));
  const toggle = (ci, ii) => patchList((cs) => cs.map((c, x) => (x !== ci ? c : { ...c, items: c.items.map((it, y) => (y === ii ? { ...it, done: !it.done } : it)) })));
  const removeItem = (ci, ii) => patchList((cs) => cs.map((c, x) => (x !== ci ? c : { ...c, items: c.items.filter((_, y) => y !== ii) })));
  function addItem(e) {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    patchList((cs) => {
      const i = cs.findIndex((c) => c.name === d.mine);
      const item = { text, done: false };
      return i >= 0 ? cs.map((c, x) => (x === i ? { ...c, items: [...c.items, item] } : c)) : [...cs, { name: d.mine, items: [item] }];
    });
    setNewItem("");
  }
  const doneCount = list ? list.categories.reduce((n, c) => n + c.items.filter((i) => i.done).length, 0) : 0;
  const itemCount = list ? list.categories.reduce((n, c) => n + c.items.length, 0) : 0;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await call(apiBase, "/api/builder/requests", {
        package_id: pkgId, travelers, selections: sel,
        customer_name: form.name, customer_email: form.email, customer_phone: form.phone,
        travel_date: form.date, notes: form.notes, confirmed: form.ok, preparation,
      });
      setRef(r.reference);
      setModal("done");
    } catch (ex) {
      setErr(t.errors[ex.code] || t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  const unit = (o) => (o.price_lkr === 0 ? t.included : `${o.price_lkr < 0 ? "Save" : "Add"} ${fmt(Math.abs(o.price_lkr))} ${o.price_type === "per_person_night" ? t.perNight : o.price_type === "per_person" ? t.perPerson : t.flat}`);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const over = quote && budgetLkr && quote.total_lkr > budgetLkr ? quote.total_lkr - budgetLkr : 0;
  const pkg = data?.package;
  const chosenLabels = data
    ? data.groups.map((g) => {
        const v = sel[g.id];
        const ids = Array.isArray(v) ? v : [v];
        const names = g.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
        return { id: g.id, label: g.label, value: names.length ? names.join(", ") : "—" };
      })
    : [];

  return (
    <div className="bp" role="dialog" aria-label={t.title}>
      <header className="bp-top">
        <button className="bp-back" onClick={onClose}><Icon name="arrow-back" size={20} />{p.backChat}</button>
        <div className="bp-top-title">
          <Icon name="map" size={20} />
          <strong>{t.title}</strong>
          <span className="bp-badge">{t.badge}</span>
        </div>
        <button className="bp-x" onClick={onClose} aria-label={t.close}><Icon name="close" size={22} /></button>
      </header>

      <nav className="builder-modes" aria-label="Builder mode"><button className={custom ? "is-active" : ""} onClick={() => setCustom(true)}>Build my own trip</button><button className={!custom ? "is-active" : ""} onClick={() => setCustom(false)}>Customize a package</button><span>Choose experiences → personalize → review</span></nav>
      {custom ? <div className="bp-scroll"><CustomTrip initialPreparation={preparation} apiBase={apiBase} currency={currency} language={language} onBack={() => setCustom(false)} /></div> : <div className="bp-body">
      <div className="bp-scroll">
        {phase === "drafting" && (
          <div className="bp-loading" role="status">
            <div className="bp-orb" aria-hidden="true" />
            <h2>{a.drafting}</h2>
            <div className="aura-progress"><span style={{ width: `${(elapsed / DRAFT_TIMEOUT_MS) * 100}%` }} /></div>
            <p>{d.progress(Math.floor(elapsed / 1000))}</p>
          </div>
        )}

        {phase === "failed" && (
          <div className="bp-loading">
            <p className="aura-draft-notice">{failMsg}</p>
            <div className="bp-row">
              <button className="bp-btn" onClick={generate}>{d.tryAgain}</button>
              <button className="bp-btn bp-btn-ghost" onClick={() => setPhase("idle")}>{a.manual}</button>
            </div>
          </div>
        )}

        {phase === "idle" && !pkgId && (
          <section className="bp-choose">
            <CurrencyControl pricing={pricing} />
            <h2>{t.choose}</h2>
            {packages === null && <p className="bp-muted">{t.loading}</p>}
            <div className="bp-grid">
              {(packages || []).map((pk) => (
                <button key={pk.id} className="bp-pkg" onClick={() => setPkgId(pk.id)}>
                  <img src={cover(pk.id)} alt="" loading="lazy" />
                  <span className="bp-pkg-body">
                    <strong><Icon name={pk.icon_name || "compass"} size={20} /> {pk.title}</strong>
                    <small>{t.meta(pk.duration_days, pk.duration_nights)} · {fmt(pk.price_lkr)}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {phase === "idle" && pkg && (
          <>
            <section className="bp-hero" style={{ backgroundImage: `url(${cover(pkg.id)})` }}>
              <div className="bp-hero-in">
                <span className="bp-chip">{pkg.category}</span>
                <h1>{pkg.title}</h1>
                <p>{pkg.tagline}</p>
                <div className="bp-chips">
                  <span>🗓 {t.meta(pkg.duration_days, pkg.duration_nights)}</span>
                  <span>📍 {pkg.destinations.join(" · ")}</span>
                  <span>🏷 {pkg.id}</span>
                </div>
              </div>
            </section>

            <div className="bp-layout">
              <main className="bp-main">
                {ai && (
                  <div className="bp-ai">
                    <span className="bp-ai-ico"><Icon name="flash" size={18} /></span>
                    <div>
                      <strong>{a.draftNote}</strong>
                      <p>{ai.why}</p>
                      {ai.unmet.length > 0 && (
                        <>
                          <b>{d.couldnt}</b>
                          <ul>{ai.unmet.map((u) => <li key={u}>{u}</li>)}</ul>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <section className="bp-card">
                  <h3>{p.tripDetails}</h3>
                  <CurrencyControl pricing={pricing} />
                  <div className="bp-two">
                    <div>
                      <span className="bp-label">{t.travelers}</span>
                      <span className="bp-step">
                        <button type="button" onClick={() => setTravelers((n) => Math.max(1, n - 1))} aria-label="−">−</button>
                        <b>{travelers}</b>
                        <button type="button" onClick={() => setTravelers((n) => Math.min(30, n + 1))} aria-label="+">+</button>
                      </span>
                    </div>
                    <label>
                      <span className="bp-label">{t.date} {t.dateOpt}</span>
                      <TravelDate label="Preferred travel date" value={form.date} onChange={set("date")} />
                    </label>
                  </div>
                  <p className="bp-muted">{t.basis}</p>
                </section>

                {data.groups.map((g) => (
                  <section key={g.id} className="bp-card">
                    <h3><span aria-hidden="true">{GROUP_ICON[g.id] || "•"}</span> {g.label}{g.multi && <small> · {t.multiHint}</small>}</h3>
                    <div className="bp-tiles">
                      {g.options.map((o) => {
                        const v = sel[g.id];
                        const on = Array.isArray(v) ? v.includes(o.id) : v === o.id;
                        return (
                          <label key={o.id} className={`bp-tile ${on ? "is-on" : ""}`}>
                            <input type={g.multi ? "checkbox" : "radio"} name={g.id} checked={!!on} onChange={() => pick(g, o.id)} />
                            <span className="bp-tile-check" aria-hidden="true">{on ? "✓" : ""}</span>
                            <strong>{o.label}</strong>
                            <em>{unit(o)}</em>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}

                <section className="bp-card">
                  <h3>{p.itinerary}</h3>
                  <TripMap days={pkg.itinerary.map(day => ({...day, places:dayPlaces(day, pkg)}))} onFocusDay={() => {}} />
                  <details><summary>View {pkg.duration_days} days & inclusions</summary>
                  <ol className="bp-days">
                    {pkg.itinerary.map((day) => (
                      <li key={day.day}>
                        <span className="bp-day-n">{day.day}</span>
                        <div><strong>{day.title}</strong><p>{day.activities}</p></div>
                      </li>
                    ))}
                  </ol>
                  <h4>{p.included}</h4>
                  <ul className="bp-incl">{pkg.inclusions.map((x) => <li key={x}>{x}</li>)}</ul>
                  </details>
                </section>

                <section className="bp-card">
                  <h3>🎒 {a.packTitle}</h3>
                  {!list && (
                    <div className="bp-two">
                      <label>
                        <span className="bp-label">{d.monthLabel}</span>
                        <input className="bp-input" value={month} onChange={(e) => setMonth(e.target.value)} placeholder={d.monthPh} />
                      </label>
                      <div className="bp-end"><button className="bp-btn" onClick={makeList} disabled={listBusy}>{listBusy ? d.creating : d.create}</button></div>
                    </div>
                  )}
                  {listMsg && <p className="aura-draft-notice">{listMsg}</p>}
                  {!list && <p className="bp-muted">{d.packHint}</p>}
                  {list && (
                    <>
                      <p className="bp-muted">{list.note} · {d.packed(doneCount, itemCount)}</p>
                      <div className="bp-pack">
                        {list.categories.map((c, ci) => (
                          <div key={c.name}>
                            <h4>{c.name}</h4>
                            <ul>
                              {c.items.map((it, ii) => (
                                <li key={`${it.text}-${ii}`} className={it.done ? "is-done" : ""}>
                                  <label><input type="checkbox" checked={it.done} onChange={() => toggle(ci, ii)} /> {it.text}</label>
                                  <button onClick={() => removeItem(ci, ii)} aria-label={`${d.remove} ${it.text}`}>✕</button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <form className="bp-add" onSubmit={addItem}>
                        <input className="bp-input" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={d.addPh} />
                        <button className="bp-btn" type="submit">{d.add}</button>
                      </form>
                    </>
                  )}
                </section>
              </main>

              <aside className="bp-side">
                <div className="bp-summary">
                  <h3>{p.summary}</h3>
                  <dl>
                    <div><dt>{t.travelers}</dt><dd>{travelers}</dd></div>
                    {chosenLabels.map((c) => <div key={c.id}><dt>{c.label}</dt><dd>{c.value}</dd></div>)}
                  </dl>
                  {quote && (
                    <ul className="bp-lines">
                      {quote.lines.map((l, i) => <li key={i}><span>{l.label}</span><b>{fmt(l.amount_lkr)}</b></li>)}
                    </ul>
                  )}
                  <div className="bp-total"><span>{t.total}</span><strong>{quote ? fmt(quote.total_lkr) : "—"}</strong></div>
                  {quoteErr && <p className="aura-draft-notice">{t.quoteErr}</p>}

                  <label className="bp-budget">
                    <span className="bp-label">{p.budgetTitle} (LKR)</span>
                    <input className="bp-input" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} placeholder={d.budgetPh} />
                  </label>
                  {quote && budgetLkr > 0 && over === 0 && <p className="aura-draft-ok">{d.within(fmt(quote.total_lkr), fmt(budgetLkr))}</p>}
                  {over > 0 && (
                    <div className="bp-over">
                      <p>{d.over(fmt(quote.total_lkr), fmt(budgetLkr), fmt(over))}</p>
                      {savings && savings.suggestions.length === 0 && <small>{a.noSavings}</small>}
                      {savings?.reality && (
                        <div className="bp-reality">
                          <strong>{p.whyPrice}</strong>
                          <ul>{savings.reality.inclusions.slice(0, 5).map((x) => <li key={x}>{x}</li>)}</ul>
                          <p>{p.floor(fmt(savings.reality.floor_lkr), savings.reality.gap_to_floor_lkr > 0 ? fmt(savings.reality.gap_to_floor_lkr) : 0)}</p>
                          {savings.reality.shorter_stays.length > 0 && (
                            <>
                              <strong>{p.shorterTitle}</strong>
                              <ul>
                                {savings.reality.shorter_stays.map((v) => (
                                  <li key={v.days}>{p.shorterRow(v.days, fmt(v.price_lkr))}{v.meets_budget && <span className="aura-draft-ok"> · {p.fitsBudget}</span>}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                      {savings?.suggestions.map((s, i) => (
                        <div className="bp-sug" key={i}>
                          <div>
                            <strong>{d.save(fmt(s.saving_lkr))}</strong>{s.meets_budget && <span className="aura-draft-ok"> · {d.meets}</span>}
                            <small>{s.group_label}: {s.to ? a.swap(s.from, s.to) : a.drop(s.from)}</small>
                          </div>
                          <button className="bp-btn bp-btn-sm" onClick={() => setSel(s.selections)}>{d.accept}</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="bp-btn bp-cta" disabled={!quote} onClick={() => setModal("details")}>{t.review}</button>
                  <p className="bp-muted">{p.noteDraft}</p>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      {phase === "idle" && pkg && (
        <>
          {!chatOpen && (
            <button className="bp-chat-fab" onClick={() => setChatOpen(true)}>
              <Icon name="message-circle" size={22} />{p.chatOpen}
            </button>
          )}
          {chatOpen && (
            <section className="bp-chat" aria-label={p.chatTitle}>
              <header>
                <span className="aura-avatar" aria-hidden="true">A</span>
                <div><strong>{p.chatTitle}</strong><small>● Online</small></div>
                <button onClick={() => setChatOpen(false)} aria-label={t.close}><Icon name="close" size={18} /></button>
              </header>
              {deletedChat && <div className="builder-undo"><button disabled={asking} onClick={() => { setChat(deletedChat); setDeletedChat(null); }}>Undo deletion</button></div>}
              <div className="bp-chat-log">
                {chat.map((m, i) => (
                  <div key={i} className={`bp-msg bp-msg-${m.role}`}>
                    <p>{m.text}</p>
                    <ChatActions text={m.text} editable={m.role === "user"} disabled={asking} maxLength={1000}
                      onEdit={text => sendAsk(text, chat.slice(0, i))}
                      onDelete={() => { setDeletedChat(chat); setChat(deleteTurn(chat, i)); setAskErr(""); }} />
                    {m.proposal && (
                      <div className="bp-prop">
                        <strong>{a.proposal(fmt(m.proposal.total_lkr), signed(m.proposal.delta_lkr))}</strong>
                        {m.applied ? <span className="aura-draft-ok">{p.applied}</span> : (
                          <button className="bp-btn bp-btn-sm" onClick={() => applyProposal(i)}>{a.applyChange}</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {asking && <div className="bp-msg bp-msg-aura"><span className="aura-typing"><i /><i /><i /></span></div>}
                {askErr && <p className="aura-draft-notice">{askErr}</p>}
                <div ref={chatEnd} />
              </div>
              <div className="bp-chat-chips">
                {a.chips.map((c) => <button key={c} onClick={() => sendAsk(c)} disabled={asking || !quote}>{c}</button>)}
              </div>
              <form className="bp-chat-form" onSubmit={(e) => { e.preventDefault(); sendAsk(); }}>
                <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={p.chatPh} maxLength={1000} />
                <button type="submit" disabled={asking || !ask.trim()} aria-label={p.chatSend}><Icon name="paper-plane" size={18} /></button>
              </form>
            </section>
          )}
        </>
      )}

      </div>}

      {modal && quote && (
        <div className="bp-modal" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="bp-dialog">
            {modal === "details" && (
              <form onSubmit={submit}><TripPreparation value={preparation} onChange={setPreparation} />
                <h3>{t.yourDetails}</h3>
                <label><span className="bp-label">{t.name}</span><input className="bp-input" required minLength={2} value={form.name} onChange={set("name")} autoComplete="name" /></label>
                <label><span className="bp-label">{t.email}</span><input className="bp-input" required type="email" value={form.email} onChange={set("email")} autoComplete="email" /></label>
                <label><span className="bp-label">{t.phone}</span><input className="bp-input" value={form.phone} onChange={set("phone")} autoComplete="tel" /></label>
                <label><span className="bp-label">{t.notes}</span><input className="bp-input" value={form.notes} onChange={set("notes")} /></label>
                <p className="bp-modal-total">{t.total}: <strong>{fmt(quote.total_lkr)}</strong></p>
                <label className="bp-confirm"><input type="checkbox" checked={form.ok} onChange={set("ok")} required /><span>{t.confirm}</span></label>
                {err && <p className="aura-draft-notice">{err}</p>}
                <div className="bp-row">
                  <button type="button" className="bp-btn bp-btn-ghost" onClick={() => setModal(null)}>{t.edit}</button>
                  <button className="bp-btn" type="submit" disabled={busy}>{busy ? t.submitting : t.submit}</button>
                </div>
              </form>
            )}
            {modal === "done" && (
              <div>
                <h3>✓ {t.doneTitle}</h3>
                <p>{t.doneText(ref)}</p>
                <button className="bp-btn" onClick={onClose}>{p.backChat}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
