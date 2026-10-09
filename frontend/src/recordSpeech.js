// Capture original audio so transcription can detect language without a fixed locale.
export async function recordSpeech(apiBase, onResult, onError, onStatus) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported(t));
  if (!mimeType) { stream.getTracks().forEach(t => t.stop()); throw new Error("Audio recording is unavailable in this browser."); }
  const recorder = new MediaRecorder(stream, { mimeType });
  const controller = new AbortController();
  const chunks = [];
  let cancelled = false, timer, monitor, context;
  const cleanup = () => { clearTimeout(timer); clearInterval(monitor); stream.getTracks().forEach(t => t.stop()); context?.close(); };
  const stop = () => { if (recorder.state === "recording") recorder.stop(); };
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onerror = () => { cancelled = true; cleanup(); onError(new Error("Microphone recording failed.")); };
  recorder.onstop = async () => {
    cleanup();
    if (cancelled) return;
    onStatus("Detecting language…");
    try {
      const blob = new Blob(chunks, { type: mimeType });
      const audio = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = reject;
        reader.onload = () => resolve(reader.result.split(",")[1]); reader.readAsDataURL(blob);
      });
      const response = await fetch(`${apiBase}/api/transcribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio, mime_type: mimeType }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Transcription failed.");
      if (!result.text?.trim()) throw new Error("No clear speech detected. Please try again.");
      if (!cancelled) onResult(result);
    } catch (error) { if (!cancelled) onError(error); }
  };
  recorder.start();
  onStatus("Listening… Stop when finished.");
  timer = setTimeout(stop, 30000);
  // End a turn after speech followed by silence; the Stop button remains available.
  try {
    context = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = context.createAnalyser(); analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let heard = false, lastSound = Date.now();
    monitor = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
      if (rms > .02) { heard = true; lastSound = Date.now(); }
      // Stop soon after speech ends so the reply starts quickly; a brief pause is still tolerated.
      if (heard && Date.now() - lastSound > 1200) stop();
    }, 100);
  } catch { /* Manual stop and duration limit still work. */ }
  return { stop, abort() { cancelled = true; controller.abort(); stop(); cleanup(); } };
}
