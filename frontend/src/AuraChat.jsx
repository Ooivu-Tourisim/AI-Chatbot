import { plannerText } from "./plannerI18n.js";
import VoiceConversation from "./VoiceConversation.jsx";
import VoiceInput from "./VoiceInput.jsx";
import { createReplySpeaker } from "./replySpeaker.js";
import { CURRENCY_DATA } from "./currencyData.js";
import { useEffect, useRef, useState, useMemo, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Icon from "./Icon.jsx";
import ChatActions from "./ChatActions.jsx";
import { deleteTurn } from "./chatHistory.js";
import { PAGE_I18N } from "./builderPageStrings.js";
import { BUILDER_I18N } from "./builderStrings.js";
import { CARD_IMAGES, I18N, LANGS, formatTime, loadLang } from "./i18n.js";
import "./AuraChat.css";
import "./theme-chat.css";

const AI_DOWN = "AI suggestions are temporarily unavailable. You can continue browsing, customizing, and booking manually.";
const BuilderPage = lazy(() => import("./BuilderPage.jsx"));

// Complete world currencies database covering every UN member and territory,
// with country names and common nationalities for seamless search.


/* ─── Searchable & Typeable Currency Combobox ─── */
function CurrencyPicker({ value, onChange, compact = false, lang = "en" }) {
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
      e.stopPropagation();
      setDropOpen(false);
    }
  }

  const selected = CURRENCY_DATA.find((c) => c.code === value);
  const displayCurrency = value || "LKR";
  const currencyName = /^[A-Z]{3}$/.test(displayCurrency)
    ? (lang === "en" && displayCurrency === "USD" ? "United States Dollar" : new Intl.DisplayNames([lang], { type: "currency" }).of(displayCurrency))
    : displayCurrency;

  return (
    <div className="aura-currency-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`aura-currency-btn ${value ? "has-value" : ""}`}
        onClick={() => setDropOpen(!dropOpen)}
        aria-haspopup="listbox"
        aria-expanded={dropOpen}
        aria-label={lang === "ko" ? "통화/국가" : "Currency/country"}
        title={lang === "ko" ? "국가 또는 통화 선택" : "Choose or type your country / currency"}
      >
        {!compact && <Icon name="swap" size={18} className="aura-currency-icon" />}
        {compact ? <span className="aura-currency-label">{currencyName}</span> : selected ? (
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
        {value && !compact && (
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
              Type your country, nationality, or currency name (e.g. <em>Afghan</em>, <em>Australia</em>, <em>USD</em>)
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

export default function AuraChat({ apiBase = "", planRequest = 0 }) {
  const [deletedChat, setDeletedChat] = useState(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const draftLanguage = useRef(null);
  const voiceTurn = useRef(false), speakerRef = useRef(null);
  const [quick, setQuick] = useState("");
  const [currency, setCurrency] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState(loadLang);
  const [previewCard, setPreviewCard] = useState(null);
  const [builder, setBuilder] = useState(null); // null = closed; { request, key }
  useEffect(() => { if (planRequest > 0) { setOpen(true); setBuilder({ request:null, key:Date.now() }); } }, [planRequest]);

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

  useEffect(() => () => { abortRef.current?.abort(); speakerRef.current?.stop(); }, []);

  function newChat() {
    speakerRef.current?.stop();
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setDeletedChat(null);
    setMessages([]);
    setBuilder(null);
    setDraft("");
    setError(null);
    inputRef.current?.focus();
  }

  async function send(text, previous = messages, detectedLanguageCode) {
    const trimmed = text.trim();
    const languageCode = detectedLanguageCode || (draftLanguage.current?.text === trimmed ? draftLanguage.current.language_code : undefined);
    if (!trimmed || streaming) return;

    // A message spoken into the mic is answered out loud as well as in text.
    speakerRef.current?.stop();
    const speaker = voiceTurn.current ? createReplySpeaker(apiBase, languageCode) : null;
    speakerRef.current = speaker;
    voiceTurn.current = false;
    const history = [...previous, { role: "user", content: trimmed, time: Date.now() }];
    setDeletedChat(null);
    setMessages([...history, { role: "assistant", content: "", time: Date.now() }]);
    setDraft("");
    setError(null);
    setStreaming(true);

    // Tell Aura the chosen currency on the latest turn without showing it in the chat.
    const scriptLanguage = /[\u0B80-\u0BFF]/.test(trimmed) ? "Tamil" : /[\u0D80-\u0DFF]/.test(trimmed) ? "Sinhala" : /[\uAC00-\uD7AF]/.test(trimmed) ? "Korean" : /[\u0900-\u097F]/.test(trimmed) ? "Hindi" : /[\u0600-\u06FF]/.test(trimmed) ? "Arabic" : langInfo.name;
    const notes = [currency && `My currency: ${currency}`, `Reply language: ${"Auto-detect from the latest message; use " + scriptLanguage + " only if ambiguous"}`]
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
        body: JSON.stringify({ messages: payload, language_code: languageCode, currency: currency || "USD" }),
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

          if (event.type === "language") {
            if (abortRef.current !== controller) continue;
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, language_code: event.language_code } : m));
            speaker?.setLanguage(event.language_code);
          } else if (event.type === "delta") {
            if (abortRef.current !== controller) continue;
            speaker?.feed(event.text);
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: next[next.length - 1].content + event.text,
              };
              return next;
            });
          } else if (event.type === "error") {
            setError(event.code === "rate_limited" ? event.message : AI_DOWN);
          }
        }
      }
    } catch (err) {
      if (abortRef.current === controller && err.name !== "AbortError") setError(AI_DOWN);
    } finally {
      if (abortRef.current === controller) {
        speaker?.end();
        setStreaming(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  }

  const t = I18N[lang] || I18N.en;
  const langInfo = LANGS.find((l) => l.code === lang) || LANGS.find(l => l.code === "en");
  const empty = messages.length === 0;
  const lastIdx = messages.length - 1;

  if (!open) {
    return (
      <div className="aura">
        <div className="aura-combo">
        <button
          className="aura-launch"
          onClick={() => setOpen(true)}
          aria-label="Open Aura AI Travel Assistant"
        >
          <span className="aura-launch-badge" aria-hidden="true">
            <Icon name="sparkles" size={22} className="aura-launch-icon" />
            <span className="aura-launch-dot" />
          </span>
          <span className="aura-launch-label">{plannerText(lang, "Ask Aura")}</span>
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
            placeholder="Type here"
            aria-label="Ask Aura a question"
          />
          <button className="aura-quick-send" type="submit" disabled={!quick.trim()} aria-label={plannerText(lang, "Ask Aura")}>
            <Icon name="arrow-upward" size={18} />
          </button>
        </form>
        </div>
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
          {(BUILDER_I18N[lang] || BUILDER_I18N.en).title}
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
            <div className="aura-price-preference">
              <CurrencyPicker compact lang={lang} value={currency} onChange={setCurrency} />
            </div>
            <label className="aura-lang">
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
              <Icon name="chevron-down" size={12} className="aura-language-chevron" />
            </label>
            <button
              className="aura-draft-open"
              disabled={streaming}
              onClick={() => setBuilder({ request: messages.filter((m) => m.role === "user").map((m) => m.content).join("\n") + (currency ? `\n(Currency: ${currency})` : ""), key: Date.now() })}
              title="Plan and personalize your trip"
            ><Icon name="paper-plane" size={18} />{plannerText(lang, "Plan my trip")}</button>
            <button onClick={() => send(t.pPackages)} disabled={streaming}><Icon name="compass" size={18} />{t.packages}</button>
            <button onClick={() => send(t.pItinerary)} disabled={streaming}><Icon name="map" size={18} />{t.itinerary}</button>
            <button className="aura-close" onClick={() => setOpen(false)} aria-label="Close assistant"><Icon name="close" size={22} /></button>
          </div>
        </header>
        {deletedChat && <div className="chat-undo"><button onClick={() => { setMessages(deletedChat); setDeletedChat(null); }}>{plannerText(lang, "Undo deletion")}</button></div>}

        <div className={`aura-scroll ${empty ? "is-empty" : "is-chat"}`} ref={scrollRef}>
          {empty ? (
            <section className="aura-hero">
              <h1 className="aura-headline">{lang === "en" ? "Your trip. Made for you." : t.headline}</h1>
              <p className="aura-sub">{lang === "en" ? "Tell Aura your idea, or pick places on the map." : t.sub(currency)}</p>
              <div className="aura-trip-banner"><div><span>{plannerText(lang, "Trip planner")}</span><strong>{plannerText(lang, "Build your route on the map")}</strong></div><button onClick={() => setBuilder({ request: null, key: Date.now() })}>{plannerText(lang, "Open trip planner")}</button></div>

              <div className="aura-cards">
                {CARD_IMAGES.map((image, ci) => {
                  const [title, hint, prompt] = t.cards[ci];
                  return (
                  <article key={image} className={`aura-card aura-photo-card ${previewCard === ci ? "is-revealed" : ""}`} onMouseEnter={() => setPreviewCard(ci)} onMouseLeave={() => setPreviewCard(null)} onFocus={() => setPreviewCard(ci)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPreviewCard(null); }}>
                    <img className="aura-card-img" src={image} alt="" loading="lazy" />
                    <button className="aura-card-cover" aria-label={`Preview ${title}`} aria-expanded={previewCard === ci} aria-controls={`aura-card-details-${ci}`} onClick={() => setPreviewCard(ci)} />
                    <div className="aura-card-caption">
                      <span className="aura-card-title"><Icon name={["heritage", "romance", "island", "food", "wildlife", "credit-card"][ci]} size={18} /> {title}</span>
                      <div className="aura-card-reveal" id={`aura-card-details-${ci}`}>
                        <p className="aura-card-hint">{hint}</p>
                        <button className="aura-card-explore" onClick={() => send(prompt)}>{plannerText(lang, "Explore trip")} <Icon name="arrow-forward" size={16} /></button>
                      </div>
                    </div>
                  </article>
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
                        {m.content && !(streaming && i === lastIdx) && <ChatActions apiBase={apiBase} text={m.content} languageCode={m.language_code} disabled={streaming} onRetry={() => { const previous = messages.slice(0, i); const question = previous.findLastIndex(m => m.role === "user"); if (question >= 0) send(previous[question].content, previous.slice(0, question)); }} onDelete={() => { setDeletedChat(messages); setMessages(deleteTurn(messages, i)); setError(null); }} />}
                        {m.content && !(streaming && i === lastIdx) && (
                          <time className="aura-time" dateTime={new Date(m.time).toISOString()}>{formatTime(m.time, langInfo.locale)}</time>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="aura-user-text">{m.content}</span>
                      <ChatActions apiBase={apiBase} text={m.content} editable disabled={streaming}
                        onEdit={text => send(text, messages.slice(0, i))}
                        onDelete={() => { setDeletedChat(messages); setMessages(deleteTurn(messages, i)); setError(null); }} />
                      <time className="aura-time" dateTime={new Date(m.time).toISOString()}>{formatTime(m.time, langInfo.locale)}</time>
                    </>
                  )}
                </article>
              ))}
              {error && <p className="aura-error">{error}</p>}
              {!streaming && !error && messages[lastIdx]?.role === "assistant" && messages[lastIdx].content && messages.filter((m) => m.role === "user").length >= 2 && (
                <div className="aura-ready">
                  <div>
                    <strong>{(PAGE_I18N[lang] || PAGE_I18N.en).readyTitle}</strong>
                    <p>{(PAGE_I18N[lang] || PAGE_I18N.en).readyText}</p>
                  </div>
                  <button onClick={() => setBuilder({ request: messages.filter((m) => m.role === "user").map((m) => m.content).join("\n") + (currency ? `\n(Currency: ${currency})` : ""), key: Date.now() })}>
                    {(PAGE_I18N[lang] || PAGE_I18N.en).readyBtn}
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
              placeholder={empty ? t.placeholder : "Message Aura…"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className="aura-compose-bar">
              <VoiceConversation apiBase={apiBase} lang={lang} language={langInfo.locale} reply={messages.findLast(m => m.role === "assistant")} busy={streaming} onSend={send} />
              <VoiceInput apiBase={apiBase} key={messages.length} value={draft} onChange={setDraft} onDetected={result => { draftLanguage.current = result; voiceTurn.current = true; send(result.text, undefined, result.language_code); }} language={langInfo.locale} disabled={streaming} />
              <button className="aura-send" onClick={() => send(draft)} disabled={streaming || !draft.trim()} aria-label="Send">
                <Icon name="paper-plane" size={22} />
              </button>
            </div>
          </div>
          {empty && <p className="aura-fine">{t.fine}</p>}
        </div>
      </div>
      {builder && (
        <Suspense fallback={<div className="bp" role="status">Opening planner…</div>}>
        <BuilderPage
          key={builder.key}
          apiBase={apiBase}
          lang={lang}
          request={builder.request}
          currency={currency || "LKR"}
          onClose={() => setBuilder(null)}
        />
        </Suspense>
      )}
    </div>
  );
}


