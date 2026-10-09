import gc
import json
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import builder
import database


class CustomTripTests(unittest.TestCase):
    def test_route_carries_explicit_group_count_and_keeps_only_catalogue_days(self):
        for count, expected in [(6, 6), (99, None), (True, None)]:
            content = {"title": "Family route", "travelers": count, "days": [
                {"package_id": "NOC-CUL-03", "day": 1}, {"package_id": "invented-package", "day": 1}]}
            with patch.object(self.api, "client") as provider:
                provider.models.generate_content.return_value = SimpleNamespace(text=json.dumps(content))
                result = self.api.draft.build_draft(provider, self.api.MODEL, "Six travelers, culture and food", "English", 13000)
            self.assertEqual(result["travelers"], expected)
            self.assertEqual(len(result["days"]), 1)
            self.assertEqual(result["days"][0]["package_id"], "NOC-CUL-03")
            self.assertEqual(result["status"], "draft")

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(dir=os.path.dirname(__file__))
        cls.original = database.DB_PATH
        database.DB_PATH = os.path.join(cls.tmp.name, "packages.db")
        with patch("threading.Thread.start"), patch("dotenv.load_dotenv"), patch("google.genai.Client"):
            import main
        cls.api = main
        database.init_db()
        builder.init()

    @classmethod
    def tearDownClass(cls):
        database.DB_PATH = cls.original
        gc.collect()
        cls.tmp.cleanup()

    def request(self, **changes):
        values = dict(package_id="NOC-CUL-03", travelers=2, selections={},
                      days=[{"package_id": "NOC-CUL-03", "day": 1}, {"package_id": "NOC-ISL-02", "day": 1}])
        values.update(changes)
        return self.api.CustomQuoteRequest(**values)

    def test_builder_uses_configured_model_and_selected_language_for_foreign_input(self):
        req = self.api.BuilderDraftRequest(request="Quiero un viaje de tres días", language="German")
        with patch.object(self.api, "client", object()), patch.object(self.api, "BUILDER_MODEL", "openai/gpt-oss-120b"), patch.object(self.api.builder_ai, "create_draft", return_value={}) as generate:
            self.api.builder_draft(req)
        args = generate.call_args.args
        self.assertEqual(args[1], "openai/gpt-oss-120b")
        self.assertEqual(args[2], req.request)
        self.assertEqual(args[3], "German")

    def test_korean_option_labels_keep_prices_and_ids(self):
        english = builder.get_builder("NOC-JAF-01", "en")
        korean = builder.get_builder("NOC-JAF-01", "ko")
        for original, translated in zip(english["groups"], korean["groups"]):
            self.assertEqual(original["id"], translated["id"])
            self.assertNotEqual(original["label"], translated["label"])
            for before, after in zip(original["options"], translated["options"]):
                self.assertEqual(before["id"], after["id"])
                self.assertEqual(before["price_lkr"], after["price_lkr"])
                self.assertNotEqual(before["label"], after["label"])

    def test_code_switched_transcript_preserves_both_languages(self):
        content = {
            "text": "I want a beach trip. 예산은 얼마인가요?",
            "language": "Korean", "locale": "ko-KR", "language_code": "ko",
            "language_codes": ["en", "ko"],
            "segments": [{"text": "I want a beach trip.", "language_code": "en"},
                         {"text": "예산은 얼마인가요?", "language_code": "ko"}],
        }
        with patch.object(self.api, "transcribe_audio", return_value=content) as provider:
            result = self.api.transcribe(self.api.AudioRequest(audio="YWJj", mime_type="audio/webm", locale="ko-KR"))
        self.assertEqual(result.text, content["text"])
        self.assertEqual(result.language_codes, ["en", "ko"])
        self.assertEqual(result.language_code, "ko")
        self.assertEqual(len(result.segments), 2)
        provider.assert_called_once_with(b"abc", "audio/webm", "ko-KR")

    def test_language_identification_is_repeated_when_speech_switches(self):
        with patch.object(self.api, "transcribe_audio") as provider:
            provider.side_effect = [
                {"text": "Hello", "language": "en", "locale": "en-IN", "language_code": "en"},
                {"text": "Hola", "language": "es", "locale": "es-ES", "language_code": "es"},
            ]
            request = self.api.AudioRequest(audio="YWJj", mime_type="audio/webm")
            self.assertEqual(self.api.transcribe(request).language_code, "en")
            self.assertEqual(self.api.transcribe(request).language_code, "es")
        self.assertEqual(provider.call_count, 2)

    def test_catalogue_icons_are_persisted_and_preserve_customization(self):
        self.assertEqual(database.get_package_by_id("NOC-JAF-01")["icon_name"], "heritage")
        groups = builder.get_builder("NOC-CUL-03")["groups"]
        self.assertEqual(groups[0]["options"][0]["icon_name"], "bed")
        conn = database.get_connection()
        with conn:
            conn.execute("UPDATE packages SET icon_name = 'map' WHERE id = 'NOC-JAF-01'")
        try:
            database.init_db()
            self.assertEqual(database.get_package_by_id("NOC-JAF-01")["icon_name"], "map")
        finally:
            with conn:
                conn.execute("UPDATE packages SET icon_name = 'heritage' WHERE id = 'NOC-JAF-01'")
            conn.close()

    def test_mixed_day_total_and_option_nights(self):
        quote = self.api.custom_quote(self.request(selections={"hotel": "superior"}))
        self.assertEqual(quote["total_lkr"], 68334 + 6000 * 2)
        self.assertEqual(quote["nights"], 1)
        self.assertTrue(quote["indicative"])

    def test_whole_package_retains_official_price(self):
        days = [{"package_id": "NOC-CUL-03", "day": n} for n in (1, 2, 3)]
        self.assertEqual(self.api.custom_quote(self.request(days=days))["total_lkr"], 95000)

    def test_invalid_and_duplicate_days(self):
        for days in ([{"package_id": "fake", "day": 1}], [{"package_id": "NOC-CUL-03", "day": 1}] * 2):
            with self.assertRaises(ValueError):
                self.api.custom_quote(self.request(days=days))

    def test_preparation_saved_and_missing_details_rejected(self):
        from fastapi import HTTPException
        body = dict(**self.request().model_dump(), customer_name="Test Traveler", customer_email="test@example.com", confirmed=True,
                    preparation={"diet": "vegetarian", "food_status": "needs", "food_details": "Peanut allergy; discuss cross-contact", "stay_status": "private"})
        result = self.api.custom_builder_request(self.api.CustomBookingRequest(**body))
        conn = database.get_connection()
        try:
            notes = conn.execute("SELECT notes FROM booking_requests WHERE reference = ?", (result["reference"],)).fetchone()[0]
            self.assertIn("Peanut allergy", notes)
            self.assertIn("Food preference: vegetarian", notes)
            self.assertIn("Stay / emergency: private", notes)
        finally:
            conn.close()
        body["preparation"]["food_details"] = " "
        with self.assertRaises(HTTPException):
            self.api.custom_builder_request(self.api.CustomBookingRequest(**body))

    def test_confirmation_and_persisted_itinerary(self):
        from fastapi import HTTPException
        body = dict(**self.request().model_dump(), customer_name="Test Traveler", customer_email="test@example.com")
        with self.assertRaises(HTTPException):
            self.api.custom_builder_request(self.api.CustomBookingRequest(**body))
        result = self.api.custom_builder_request(self.api.CustomBookingRequest(**body, confirmed=True))
        conn = database.get_connection()
        try:
            row = conn.execute("SELECT * FROM booking_requests WHERE reference = ?", (result["reference"],)).fetchone()
            self.assertEqual(json.loads(row["selections"])["itinerary"], body["days"])
            self.assertEqual(row["total_lkr"], 68334)
            self.assertEqual(row["status"], "requested")
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
