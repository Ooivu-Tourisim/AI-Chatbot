import unittest
from unittest.mock import patch, MagicMock
from google.genai import errors
import main
import currency


class ChatLimitTests(unittest.TestCase):
    def test_expired_key_returns_actionable_error_in_complete_stream(self):
        from providers import ProviderError
        provider = MagicMock()
        provider.chats.create.side_effect = ProviderError(401)
        with patch.object(main, "client", provider), patch.object(main, "get_current_system_prompt", return_value="Travel guide"), patch.object(main, "StreamingResponse", side_effect=lambda content, **kwargs: content):
            result = "".join(main.chat(main.ChatRequest(messages=[main.Message(role="user", content="Hello")])))
        self.assertIn('"code": "provider_auth"', result)
        self.assertIn("LLM_API_KEY", result)
        self.assertEqual(provider.chats.create.call_count, 1)

    def test_quota_error_does_not_call_fallback(self):
        provider = MagicMock()
        provider.chats.create.side_effect = errors.ClientError(429, {"error": {"code": 429, "message": "Quota exceeded", "status": "RESOURCE_EXHAUSTED"}})
        with patch.object(main, "client", provider), patch.object(main, "get_current_system_prompt", autospec=True, return_value="Travel guide"), patch.object(main, "StreamingResponse", side_effect=lambda content, **kwargs: content):
            response = main.chat(main.ChatRequest(messages=[main.Message(role="user", content="Hello")]))
            result = "".join(response)
        self.assertIn('"code": "rate_limited"', result)
        self.assertEqual(provider.chats.create.call_count, 1)

    def test_only_requested_currency_prices_enter_prompt(self):
        with patch.object(currency, "get_rates", return_value={"USD": .003, "KRW": 4.5, "EUR": .0028}):
            result = currency.build_currency_section([{"id": "trip", "price_lkr": 10000}], ["KRW"])
        self.assertIn("KRW 45,000", result)
        self.assertNotIn("USD", result)
        self.assertNotIn("EUR", result)

    def test_missing_selected_rate_is_not_invented(self):
        with patch.object(currency, "get_rates", return_value={"USD": .003}):
            result = currency.build_currency_section([], ["KRW"])
        self.assertIn("Rates unavailable for KRW", result)
