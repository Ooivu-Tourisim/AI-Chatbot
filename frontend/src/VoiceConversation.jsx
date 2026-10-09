import { useEffect, useRef, useState } from "react";
import { createReplySpeaker } from "./replySpeaker.js";
import Icon from "./Icon.jsx";
import { recordSpeech } from "./recordSpeech";
export default function VoiceConversation({ language, reply, busy, onSend, apiBase, lang = "en" }) {
  const [active, setActive] = useState(false), [status, setStatus] = useState(""), [voices, setVoices] = useState([]), [voice, setVoice] = useState("");
  const rec = useRef(null), enabled = useRef(false), handled = useRef(null), locale = useRef(language), generation = useRef(0);
  const spoken = useRef({ key:null, offset:0, speaker:null });
  const latest = useRef({ onSend, busy }); latest.current = { onSend, busy, reply };
  function stop() { enabled.current = false; generation.current++; spoken.current.speaker?.stop(); setActive(false); rec.current?.abort(); rec.current = null; window.speechSynthesis?.cancel(); setStatus(""); }
  useEffect(() => {
    const update = () => setVoices(window.speechSynthesis?.getVoices() || []);
    update(); window.speechSynthesis?.addEventListener("voiceschanged", update);
    return () => { stop(); window.speechSynthesis?.removeEventListener("voiceschanged", update); };
  }, []);
  async function listen() {
    if (!enabled.current || latest.current.busy) return;
    const id = ++generation.current;
    try {
      const session = await recordSpeech(apiBase, result => {
        if (!enabled.current || id !== generation.current) return;
        rec.current = null; locale.current = result.locale || language;
        setStatus(`Detected ${result.language}. Aura is thinking…`);
        latest.current.onSend(result.text, undefined, result.language_code);
      }, error => { if (id === generation.current) { stop(); setStatus(error.message); } }, message => { if (id === generation.current) setStatus(message); });
      if (id !== generation.current) session.abort(); else rec.current = session;
    } catch (error) { if (id === generation.current) { stop(); setStatus(error.message); } }
  }
  useEffect(() => {
    if (!active || !reply?.content || handled.current === reply.time) return;
    if (spoken.current.key !== reply.time) {
      spoken.current.speaker?.stop();
      spoken.current = { key:reply.time, offset:0, speaker:createReplySpeaker(apiBase, reply.language_code || locale.current, voice) };
    }
    const current = spoken.current;
    current.speaker.setLanguage(reply.language_code || locale.current);
    current.speaker.feed(reply.content.slice(current.offset));
    current.offset = reply.content.length;
    setStatus("Aura is speaking…");
    if (!busy) {
      handled.current = reply.time;
      const id = generation.current;
      current.speaker.end().then(success => {
        if (!enabled.current || id !== generation.current) return;
        if (success) listen(); else { stop(); setStatus("Audio is temporarily unavailable. Your text reply is still available."); }
      });
    }
  }, [reply, busy, active]);
  const copy = lang === "ko" ? { talk:"Aura와 대화", stop:"대화 중지", finish:"말하기 완료", settings:"음성 설정", voice:"응답 음성", auto:"언어에 맞게 자동 선택" } : { talk:"Talk with Aura", stop:"Stop conversation", finish:"Finish speaking", settings:"Voice settings", voice:"Reply voice", auto:"Automatic for detected language" };
  return <div className="voice-conversation">
    <button className={`voice-talk ${active ? "is-active" : ""}`} type="button" disabled={busy && !active} onClick={() => { if (active) { stop(); return; } handled.current = reply?.time; enabled.current = true; setActive(true); listen(); }}><Icon name={active ? "close" : "sound"} size={18} />{active ? copy.stop : copy.talk}</button>
    {active && <button className="voice-finish" type="button" onClick={() => rec.current?.stop()}>{copy.finish}</button>}
    <details className="voice-settings"><summary aria-label={copy.settings} title={copy.settings}><Icon name="settings" size={17} /></summary><div className="voice-settings-panel"><label>{copy.voice}<select aria-label={copy.voice} value={voice} disabled={active} onChange={e => setVoice(e.target.value)}><option value="">{copy.auto}</option>{voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label></div></details>
    {status && <span className="voice-conversation-status" role="status">{status}</span>}
  </div>;
}
