import { readySpeech } from "./speechChunks.js";

// Reads a streaming reply aloud, sentence by sentence, so speech starts before the text finishes.
// Uses a browser voice when one exists for the language; otherwise falls back to server speech (/api/speak).
export function createReplySpeaker(apiBase, languageCode, preferredVoice = "") {
  const synth = window.speechSynthesis;
  let text = "", offset = 0, locale = languageCode || "en", stopped = false;
  let queue = Promise.resolve(), current = null, failed = false;
  const voiceFor = () => {
    const voices = synth?.getVoices() || [], base = locale.split("-")[0].toLowerCase();
    return voices.find(v => v.voiceURI === preferredVoice && v.lang.toLowerCase().split("-")[0] === base) || voices.find(v => v.lang.toLowerCase() === locale.toLowerCase()) || voices.find(v => v.lang.toLowerCase().split("-")[0] === base);
  };
  const playServer = spoken => {
    const audio = fetch(`${apiBase}/api/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: spoken, language_code: locale.split("-")[0].toLowerCase() }) })
      .then(r => (r.ok ? r.blob() : null)).catch(() => null);  // start fetching now; play in order below
    queue = queue.then(async () => {
      const blob = await audio;
      if (stopped) return;
      if (!blob) { failed = true; return; }
      const player = new Audio(URL.createObjectURL(blob));
      current = player;
      await new Promise(resolve => { player.onended = resolve; player.onerror = () => { failed = true; resolve(); }; player.play().catch(() => { failed = true; resolve(); }); });
      URL.revokeObjectURL(player.src);
    });
  };
  const flush = complete => {
    if (stopped) return;
    const chunk = readySpeech(text, offset, complete);
    if (!chunk) return;
    offset = chunk.offset;
    const spoken = chunk.text.replace(/[*#`_>]/g, "").trim();
    if (!spoken) return;
    const voice = voiceFor();
    if (voice && synth) {
      queue = queue.then(() => new Promise(resolve => {
        if (stopped) { resolve(); return; }
        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.lang = locale; utterance.voice = voice;
        utterance.onend = resolve;
        utterance.onerror = () => { failed = true; resolve(); };
        synth.speak(utterance);
      }));
    } else {
      // Stay within the server's text limit even when reading an entire long reply.
      for (let start = 0; start < spoken.length; start += 1400) playServer(spoken.slice(start, start + 1400));
    }
  };
  if (synth) { synth.cancel(); window.dispatchEvent(new Event("aura-speech-stop")); }
  return {
    setLanguage(code) { if (code) locale = code; },
    feed(delta) { text += delta; flush(false); },
    end() { flush(true); return queue.then(() => !failed); },
    stop() { stopped = true; synth?.cancel(); current?.pause(); },
  };
}
