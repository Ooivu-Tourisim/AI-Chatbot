import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { recordSpeech } from "./recordSpeech";

export default function VoiceInput({ value, onChange, disabled, apiBase, onDetected, inputLocale }) {
  const recording = useRef(null), generation = useRef(0);
  const [listening, setListening] = useState(false), [status, setStatus] = useState("");
  const cancel = () => { generation.current++; recording.current?.abort(); recording.current = null; };
  useEffect(() => cancel, []);
  useEffect(() => { if (disabled) { cancel(); setListening(false); } }, [disabled]);
  async function toggle() {
    if (recording.current) { recording.current.stop(); return; }
    const id = ++generation.current, base = value.trim();
    setListening(true);
    window.dispatchEvent(new Event("aura-conversation-stop"));
    window.speechSynthesis?.cancel(); window.dispatchEvent(new Event("aura-speech-stop"));
    try {
      const session = await recordSpeech(apiBase, result => {
        if (id !== generation.current) return;
        recording.current = null; setListening(false); setStatus(`Detected ${result.language}`);
        const text = [base, result.text].filter(Boolean).join(" ");
        if (onDetected) onDetected({ ...result, text });
        else onChange(text);
      }, error => {
        if (id !== generation.current) return;
        recording.current = null; setListening(false); setStatus(error.message);
      }, message => { if (id === generation.current) setStatus(message); }, inputLocale);
      if (id !== generation.current) session.abort(); else recording.current = session;
    } catch (error) { if (id === generation.current) { setListening(false); setStatus(error.message); } }
  }
  return <div className="voice-input"><button type="button" className={`aura-mic ${listening ? "is-listening" : ""}`} title="Dictate into the message box" aria-label={listening ? "Stop dictation" : "Dictate into the message box"} aria-pressed={listening} disabled={disabled || (listening && !recording.current)} onClick={toggle}><Icon name={listening ? "close" : "mic"} size={20} /></button><span className="voice-status" role="status">{status}</span></div>;
}
