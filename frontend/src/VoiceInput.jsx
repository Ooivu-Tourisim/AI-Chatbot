import { useEffect, useRef, useState } from "react";

export default function VoiceInput({ value, onChange, language, disabled }) {
  const recognition = useRef(null);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => () => { const r = recognition.current; recognition.current = null; if (r) { r.onresult = r.onend = r.onerror = null; r.abort(); } }, []);
  useEffect(() => { recognition.current?.abort(); }, [disabled, language]);
  function toggle() {
    if (recognition.current) { recognition.current.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setStatus("Voice typing is unavailable in this browser. You can still type your message."); return; }
    window.speechSynthesis?.cancel(); window.dispatchEvent(new Event("aura-speech-stop"));
    const r = new Recognition();
    const base = value.trim();
    r.lang = language || "en-US"; r.continuous = true; r.interimResults = true;
    r.onresult = event => { if (recognition.current !== r) return; const words = Array.from(event.results).map(result => result[0].transcript).join(" "); onChange([base, words].filter(Boolean).join(" ")); };
    r.onerror = event => { setStatus(event.error === "not-allowed" ? "Microphone permission was denied. Allow it in your browser to use voice typing." : event.error === "no-speech" ? "No speech detected. Try again." : event.error === "aborted" ? "" : "Voice typing couldn't connect. Please try again or type."); };
    r.onend = () => { if (recognition.current === r) { recognition.current = null; setListening(false); } };
    recognition.current = r; setStatus(""); setListening(true);
    try { r.start(); } catch { recognition.current = null; setListening(false); setStatus("Voice typing couldn't start. Please try again."); }
  }
  return <div className="voice-input"><button type="button" className={`aura-mic ${listening ? "is-listening" : ""}`} aria-label={listening ? "Stop microphone" : "Speak your message"} title={listening ? "Stop microphone" : "Speak your message"} aria-pressed={listening} disabled={disabled && !listening} onClick={toggle}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{listening ? <path d="M6 6h12v12H6z" /> : <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>}</svg>{listening && <span>Stop</span>}</button><span className="voice-status" role="status">{listening ? "Listening… Review your words before sending." : status}</span></div>;
}
