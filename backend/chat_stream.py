"""Strip the small language metadata prefix without buffering the response."""
import re


def response_events(chunks, language_code=None):
    if language_code:
        yield {"type": "language", "language_code": language_code}
    pending = ""
    reading_header = not language_code
    for chunk in chunks:
        if hasattr(chunk, "suggested_replies"):
            yield {"type": "suggestions", "replies": chunk.suggested_replies}
        if hasattr(chunk, "ready_to_customise"):
            yield {"type": "trip_intent", "ready_to_customise": chunk.ready_to_customise}
        text = chunk.text
        if not text:
            continue
        if reading_header:
            pending += text
            match = re.match(r"^\s*\[\[language:([a-z]{2,3})\]\]\s*", pending)
            if match:
                yield {"type": "language", "language_code": match.group(1)}
                text = pending[match.end():]
                reading_header = False
                pending = ""
            elif len(pending) > 80 or ("\n" in pending.strip()):
                # Preserve the answer if the provider omitted/malformed the prefix.
                text = pending
                pending = ""
                reading_header = False
            else:
                continue
        if text:
            yield {"type": "delta", "text": text}
    if pending:
        yield {"type": "delta", "text": pending}
    yield {"type": "done"}
