import unittest
from types import SimpleNamespace as IntentChunk
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
class TripIntentTests(unittest.TestCase):
    def test_reply_options_are_not_included_in_visible_or_spoken_answer(self):
        events = list(response_events([IntentChunk(text="[[language:en]]\nHow many days?"), IntentChunk(text="", suggested_replies=["3 days", "One week"])]))
        self.assertIn({"type": "suggestions", "replies": ["3 days", "One week"]}, events)
        self.assertEqual("".join(e.get("text", "") for e in events), "How many days?")

    def test_readiness_metadata_is_separate_from_visible_reply(self):
        for ready in (True, False):
            events = list(response_events([IntentChunk(text="", ready_to_customise=ready), IntentChunk(text="[[language:en]]\nYour reply")]))
            self.assertEqual(events[0], {"type": "trip_intent", "ready_to_customise": ready})
            self.assertEqual("".join(e.get("text", "") for e in events), "Your reply")

