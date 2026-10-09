import { readySpeech } from "./speechChunks.js";

// Reads a streaming reply aloud, sentence by sentence, so speech starts before the text finishes.
// Use the backend's fixed multilingual voice for every playback path and language.
export function createReplySpeaker(apiBase, languageCode) {
  const synth = window.speechSynthesis;
  let text = "", offset = 0, locale = languageCode || "en", stopped = false;
  let queue = Promise.resolve(), current = null, failed = false;
  const controller = new AbortController();
  let finishPlayback = null;
  const stop = () => { stopped = true; controller.abort(); synth?.cancel(); current?.pause(); finishPlayback?.(); window.removeEventListener?.("aura-speech-stop", stop); };
  const playServer = spoken => {
    const audio = fetch(`${apiBase}/api/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: spoken, language_code: locale.split("-")[0].toLowerCase() }), signal: controller.signal })
      .then(r => (r.ok ? r.blob() : null)).catch(() => null);  // start fetching now; play in order below
    queue = queue.then(async () => {
      const blob = await audio;
      if (stopped) return;
      if (!blob) { failed = true; return; }
      const player = new Audio(URL.createObjectURL(blob));
      current = player;
      await new Promise(resolve => { finishPlayback = resolve; player.onended = resolve; player.onerror = () => { failed = true; resolve(); }; player.play().catch(() => { failed = true; resolve(); }); });
      finishPlayback = null;
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
    // Stay within the server's text limit even when reading an entire long reply.
    for (let start = 0; start < spoken.length; start += 1400) playServer(spoken.slice(start, start + 1400));
  };
  if (synth) { synth.cancel(); window.dispatchEvent(new Event("aura-speech-stop")); }
  window.addEventListener?.("aura-speech-stop", stop);
  return {
    setLanguage(code) { if (code) locale = code; },
    feed(delta) { text += delta; flush(false); },
    end() { flush(true); return queue.then(() => { window.removeEventListener?.("aura-speech-stop", stop); return !failed && !stopped; }); },
    stop,
  };
}
