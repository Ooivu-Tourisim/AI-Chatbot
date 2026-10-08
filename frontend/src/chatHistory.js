// Removing a question also removes its replies, so they cannot become orphaned.
export function deleteTurn(messages, index) {
  if (messages[index]?.role !== "user") return messages.filter((_, i) => i !== index);
  let end = index + 1;
  while (end < messages.length && messages[end].role !== "user") end++;
  return [...messages.slice(0, index), ...messages.slice(end)];
}
