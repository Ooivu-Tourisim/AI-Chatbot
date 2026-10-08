import { useEffect, useRef, useState } from "react";

async function copyText(text, setStatus) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied");
  } catch {
    setStatus("Copy unavailable. Select the message text to copy it.");
  }
}

export function ChatToolbar({ messages, disabled, onClear, onUndo, canUndo }) {
  const [status, setStatus] = useState("");
  return <div className="chat-tools">
    <button disabled={disabled || !messages.length} onClick={() => copyText(messages.map(m => `${m.role === "user" ? "You" : "Aura"}: ${m.content ?? m.text}`).join("\n\n"), setStatus)}>Copy chat</button>
    <button disabled={disabled || !messages.length} onClick={onClear}>Clear chat</button>
    {canUndo && <button disabled={disabled} onClick={onUndo}>Undo delete</button>}
    <span role="status">{status}</span>
  </div>;
}

export default function ChatActions({ text, editable, disabled, onEdit, onDelete, onRetry, maxLength = 8000 }) {
  const [reading, setReading] = useState(false);
  const utterance = useRef(null);
  useEffect(() => {
    const stop = () => { utterance.current = null; setReading(false); };
    window.addEventListener("aura-speech-stop", stop);
    return () => { window.removeEventListener("aura-speech-stop", stop); if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis?.cancel(); window.dispatchEvent(new Event("aura-speech-stop")); } };
  }, []);
  function read() {
    if (!window.speechSynthesis) { setStatus("Read aloud is unavailable in this browser."); return; }
    const wasReading = reading;
    window.speechSynthesis.cancel(); window.dispatchEvent(new Event("aura-speech-stop"));
    if (wasReading) { utterance.current = null; return; }
    const speech = new SpeechSynthesisUtterance(text);
    utterance.current = speech;
    speech.onend = speech.onerror = () => { if (utterance.current === speech) { utterance.current = null; setReading(false); } };
    setReading(true); window.speechSynthesis.speak(speech);
  }
  const [feedback, setFeedback] = useState(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const [status, setStatus] = useState("");
  return <div className="message-tools">
    {editing ? <form onSubmit={e => { e.preventDefault(); if (value.trim()) { onEdit(value.trim()); setEditing(false); } }}>
      <textarea aria-label="Edit your message" value={value} maxLength={maxLength} onChange={e => setValue(e.target.value)} autoFocus />
      <small>Sending an edit replaces this question and the messages after it.</small>
      <button type="submit" disabled={disabled || !value.trim()}>Save & send</button>
      <button type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form> : <>
      <Action label="Copy message" icon="copy" disabled={disabled || !text} onClick={() => copyText(text, setStatus)} />
      {editable ? <Action label="Edit message" icon="edit" disabled={disabled} onClick={() => { setValue(text); setEditing(true); }} /> : <>
        <Action label={reading ? "Stop reading" : "Read aloud"} icon={reading ? "stop" : "sound"} disabled={disabled && !reading} onClick={read} />
        <Action label="Helpful" icon="up" pressed={feedback === "up"} onClick={() => { setFeedback(feedback === "up" ? null : "up"); setStatus("Feedback saved for this session"); }} />
        <Action label="Not helpful" icon="down" pressed={feedback === "down"} onClick={() => { setFeedback(feedback === "down" ? null : "down"); setStatus("Feedback saved for this session"); }} />
        {onRetry && <Action label="Regenerate response" icon="retry" disabled={disabled} onClick={onRetry} />}
      </>}
      <Action label="Delete message" icon="delete" disabled={disabled} onClick={onDelete} />
    </>}
    <span role="status">{status}</span>
  </div>;
}

function Action({label, icon, pressed, ...props}) {
  const paths = {
    stop: "M6 6h12v12H6z",
    copy: "M8 8h12v12H8z M16 8V4H4v12h4",
    sound: "M11 5 6 9H3v6h3l5 4z M15 8c3 2 3 6 0 8 M18 5c5 4 5 10 0 14",
    up: "M8 10h-4v10h4z M8 10l5-7c2 0 2 2 1 6h5c2 0 2 2 1 4l-2 7H8z",
    down: "M8 14H4V4h4z M8 14l5 7c2 0 2-2 1-6h5c2 0 2-2 1-4l-2-7H8z",
    retry: "M20 7v5h-5 M20 12a8 8 0 1 0-2 6",
    edit: "M4 16 16 4l4 4L8 20H4z M13 7l4 4",
    delete: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 10v7 M14 10v7"
  };
  return <button className="message-icon" title={label} aria-label={label} aria-pressed={pressed} {...props}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[icon]} /></svg></button>;
}
