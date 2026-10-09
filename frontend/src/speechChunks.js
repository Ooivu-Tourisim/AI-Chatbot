// Speak complete sentences while text streams; flush the final fragment at completion.
export function readySpeech(text, offset, complete) {
  const remaining = text.slice(offset);
  if (complete) return remaining ? { text: remaining, offset: text.length } : null;
  const sentences = [...remaining.matchAll(/[.!?。！？؟।](?=\s|$)/gu)];
  if (!sentences.length) return null;
  const end = sentences.at(-1).index + 1;
  return { text: remaining.slice(0, end), offset: offset + end };
}
