import unittest
from types import SimpleNamespace
from chat_stream import response_events


def events(parts, code=None):
    return list(response_events((SimpleNamespace(text=text) for text in parts), code))


class ChatStreamTests(unittest.TestCase):
    def test_header_at_every_chunk_boundary(self):
        prefix = "[[language:ko]]\n"
        for cut in range(1, len(prefix)):
            result = events([prefix[:cut], prefix[cut:], "안녕하세요"])
            self.assertEqual(result[0], {"type": "language", "language_code": "ko"})
            self.assertEqual("".join(e["text"] for e in result if e["type"] == "delta").strip(), "안녕하세요")

    def test_answer_starts_before_stream_completes(self):
        stream = response_events(iter([SimpleNamespace(text="[[language:es]]\nHola"), SimpleNamespace(text=" mundo")]))
        self.assertEqual(next(stream)["type"], "language")
        self.assertEqual(next(stream), {"type": "delta", "text": "Hola"})

    def test_speech_language_skips_metadata_parsing(self):
        self.assertEqual(events(["Bonjour"], "fr"), [
            {"type": "language", "language_code": "fr"},
            {"type": "delta", "text": "Bonjour"}, {"type": "done"}])

    def test_missing_header_preserves_answer(self):
        self.assertEqual(events(["Hello"]), [{"type": "delta", "text": "Hello"}, {"type": "done"}])
