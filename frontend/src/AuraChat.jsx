import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./AuraChat.css";

const STARTERS = [
  "Draft me a custom itinerary",
  "Help me fit a package in my budget",
  "Build my packing checklist",
];

export default function AuraChat({ apiBase = "" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Greeting text lives in the backend prompt file, so fetch it rather than
  // duplicating it here.
  useEffect(() => {
    if (!open || messages.length) return;
    let cancelled = false;
    fetch(`${apiBase}/api/greeting`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMessages([{ role: "assistant", content: d.greeting }]);
      })
      .catch(() => {
        if (!cancelled) setError("Can't reach the assistant right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, messages.length, apiBase]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const history = [...messages, { role: "user", content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The greeting is display-only; don't send it back as conversation.
        body: JSON.stringify({ messages: history.filter((m, i) => !(i === 0 && m.role === "assistant")) }),
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
                role: "assistant",
                content: next[next.length - 1].content + event.text,
              };
              return next;
            });
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") setError("Message didn't go through. Try again.");
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

  const showStarters = messages.length === 1 && !streaming;

  return (
    <div className="aura">
      {!open && (
        <button className="aura-launch" onClick={() => setOpen(true)}>
          Plan with Aura
        </button>
      )}

      {open && (
        <section className="aura-panel" aria-label="Aura travel assistant">
          <header className="aura-head">
            <div>
              <p className="aura-head-name">Aura</p>
              <p className="aura-head-role">Travel assistant</p>
            </div>
            <button className="aura-close" onClick={() => setOpen(false)} aria-label="Close assistant">
              &#215;
            </button>
          </header>

          <div className="aura-scroll" ref={scrollRef}>
            {messages.map((m, i) => (
              <article key={i} className={`aura-msg aura-msg-${m.role}`}>
                {m.role === "assistant" ? (
                  <div className="aura-md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    {streaming && i === messages.length - 1 && <span className="aura-caret" />}
                  </div>
                ) : (
                  m.content
                )}
              </article>
            ))}

            {showStarters && (
              <div className="aura-starters">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="aura-error">{error}</p>}
          </div>

          <div className="aura-compose">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              placeholder="Where would you like to go?"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button onClick={() => send(draft)} disabled={streaming || !draft.trim()}>
              Send
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
