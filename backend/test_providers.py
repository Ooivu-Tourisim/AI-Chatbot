import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from google.genai import types
from providers import GroqClient, ProviderError, synthesize, transcribe_audio, clean_suggestions


class ProviderTests(unittest.TestCase):
    def test_suggestions_receive_latest_question_and_language(self):
        client = GroqClient("test-key")
        with patch.object(client, "generate_content", return_value=SimpleNamespace(text=json.dumps({"suggested_replies": ["3 days", "One week", "I'm flexible"]}))) as generate:
            replies = client.suggest_replies("How many days would you like to travel?", [{"role": "system", "content": "catalogue"}, {"role": "user", "content": "A beach trip"}], "fr")
        self.assertEqual(replies, ["3 days", "One week", "I'm flexible"])
        context = json.loads(generate.call_args.args[1])
        self.assertEqual(context["latest_assistant_reply"], "How many days would you like to travel?")
        self.assertIn("language fr", generate.call_args.args[2].system_instruction)
        self.assertNotIn("catalogue", generate.call_args.args[1])

    def test_suggestion_failure_does_not_fail_successful_chat(self):
        client = GroqClient("test-key")
        with patch.object(client, "generate_content", side_effect=ProviderError(429)):
            self.assertEqual(client.suggest_replies("A reply", [], "en"), [])
        self.assertEqual(clean_suggestions([" Solo ", "Solo", None, "", "x" * 121, "Couple"]), ["Solo", "Couple"])

    def test_resolved_language_overrides_english_catalogue_and_history(self):
        client = GroqClient("test-key")
        for code in ["de", "fr", "ar", "ko", "zh", "hi", "it", "es", "si"]:
            with self.subTest(language=code), patch.object(client, "generate_content", return_value=SimpleNamespace(text=json.dumps({"language_code": code}))), patch("providers.httpx.Client") as session:
                response = session.return_value.__enter__.return_value.stream.return_value.__enter__.return_value
                response.is_error = False
                response.iter_lines.return_value = ['data: ' + json.dumps({"choices": [{"delta": {"content": "reply"}}]}), 'data: [DONE]']
                chat = client.create("ignored", [types.Content(role="model", parts=[types.Part.from_text(text="Welcome in English")])], types.GenerateContentConfig(system_instruction="English catalogue"))
                list(chat.send_message_stream("Customer message"))
                body = session.return_value.__enter__.return_value.stream.call_args.kwargs["json"]
                self.assertIn("FINAL REPLY LANGUAGE: " + code, body["messages"][0]["content"])

    def test_automatic_recognition_includes_local_languages_and_switches_each_turn(self):
        with patch.dict(os.environ, {"AZURE_SPEECH_KEY": "test-key", "AZURE_SPEECH_REGION": "southeastasia"}), patch("providers.httpx.Client") as session:
            post = session.return_value.__enter__.return_value.post
            post.side_effect = [httpx.Response(200, json={"phrases": [{"text": "Sinhala speech", "locale": "si-LK"}]}),
                                httpx.Response(200, json={"phrases": [{"text": "Tamil speech", "locale": "ta-IN"}]})]
            self.assertEqual(transcribe_audio(b"audio", "audio/webm")["language_code"], "si")
            self.assertEqual(transcribe_audio(b"audio", "audio/webm")["language_code"], "ta")
            for call in post.call_args_list:
                locales = json.loads(call.kwargs["files"]["definition"][1])["locales"]
                self.assertIn("si-LK", locales)
                self.assertIn("ta-IN", locales)
                self.assertIn("en-IN", locales)

    def test_all_text_calls_use_bus_book_model(self):
        with patch.dict(os.environ, {"LLM_MODEL": "openai/gpt-oss-120b"}), patch("providers.httpx.Client") as session:
            session.return_value.__enter__.return_value.post.return_value = httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})
            client = GroqClient("test-key")
            response = client.generate_content("old-model", "Translate", types.GenerateContentConfig(response_mime_type="application/json"))
            self.assertEqual(response.text, "{}")
            call = session.return_value.__enter__.return_value.post.call_args
            self.assertTrue(call.args[0].endswith("/chat/completions"))
            self.assertEqual(call.kwargs["json"]["model"], "openai/gpt-oss-120b")

    def test_azure_transcription_uses_selected_locale(self):
        with patch.dict(os.environ, {"AZURE_SPEECH_KEY": "test-key", "AZURE_SPEECH_REGION": "southeastasia"}), patch("providers.httpx.Client") as session:
            session.return_value.__enter__.return_value.post.return_value = httpx.Response(200, json={"phrases": [{"text": "Hello", "locale": "en-IN"}]})
            result = transcribe_audio(b"audio", "audio/webm", "en-IN")
            self.assertEqual(result["language_code"], "en")
            call = session.return_value.__enter__.return_value.post.call_args
            self.assertEqual(json.loads(call.kwargs["files"]["definition"][1])["locales"], ["en-IN"])

    def test_azure_voice_matches_bus_book_and_escapes_text(self):
        with patch.dict(os.environ, {"AZURE_SPEECH_KEY": "test-key", "AZURE_SPEECH_REGION": "southeastasia", "AGENT_VOICE_GENDER": "female"}), patch("providers.httpx.Client") as session:
            session.return_value.__enter__.return_value.post.return_value = httpx.Response(200, content=b"wav")
            self.assertEqual(synthesize("Hello <world> & friends", "si"), b"wav")
            call = session.return_value.__enter__.return_value.post.call_args
            ssml = call.kwargs["content"].decode()
            self.assertIn("si-LK-ThiliniNeural", ssml)
            self.assertIn("&lt;world&gt; &amp; friends", ssml)

    def test_provider_errors_do_not_expose_response_secrets(self):
        with patch("providers.httpx.Client") as session:
            session.return_value.__enter__.return_value.post.return_value = httpx.Response(429, text="private provider detail")
            with self.assertRaises(ProviderError) as error:
                GroqClient("test-key").generate_content("ignored", "Hello", types.GenerateContentConfig())
            self.assertEqual(error.exception.code, 429)
            self.assertNotIn("private", str(error.exception))
