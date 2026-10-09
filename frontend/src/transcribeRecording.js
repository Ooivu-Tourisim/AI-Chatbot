// A development backend restart must not discard the customer's recording.
export async function transcribeRecording(apiBase, payload, { signal, retryDelay = 1000, onRetry } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      signal?.throwIfAborted();
      response = await fetch(`${apiBase}/api/transcribe`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal,
      });
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError") throw error;
      if (attempt === 2) throw new Error("Cannot reach voice recognition. Check that the Tourism backend is running and try again.");
    }
    if (response && ![500, 502, 504].includes(response.status)) {
      let result;
      try { result = await response.json(); }
      catch { throw new Error("Voice recognition returned an invalid response. Please try again."); }
      if (!response.ok) throw new Error(result.detail || "Transcription failed.");
      return result;
    }
    if (attempt === 2) throw new Error("The voice connection was interrupted. Please try again after the backend restarts.");
    onRetry?.();
    await new Promise((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); reject(signal.reason || new DOMException("Aborted", "AbortError")); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", cancel); resolve(); }, retryDelay * (attempt + 1));
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) cancel();
    });
  }
}
