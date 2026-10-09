"""Bus Book's Groq model and Azure Speech, adapted to Tourism's API."""
import json
import os
import re
from types import SimpleNamespace
from xml.sax.saxutils import escape, quoteattr

import httpx


class ProviderError(RuntimeError):
    def __init__(self, code):
        self.code = code
        super().__init__(f"Provider request failed ({code})")


def checked(response):
    if response.is_error:
        raise ProviderError(response.status_code)
    return response


class GroqClient:
    """Keep existing validated builder contracts while using one Groq model."""
    def __init__(self, api_key):
        self.key = api_key
        self.model = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
        self.base = os.getenv("AGENT_LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
        self.models = self
        self.chats = self

    def request(self, messages, config, stream=False):
        body = {"model": self.model, "messages": messages,
                "reasoning_effort": os.getenv("AGENT_EFFORT", "low"),
                "max_completion_tokens": config.max_output_tokens or 2000, "stream": stream}
        if config.response_mime_type == "application/json":
            body["response_format"] = {"type": "json_object"}
            schema = config.response_schema
            if schema:
                schema = schema.model_json_schema() if hasattr(schema, "model_json_schema") else schema
                messages[0]["content"] += "\nReturn JSON matching this schema: " + json.dumps(schema)
        timeout = min((config.http_options.timeout / 1000 if config.http_options and config.http_options.timeout else 30),
                      float(os.getenv("AGENT_LLM_TIMEOUT_S", "12")))
        return body, timeout

    def generate_content(self, model, contents, config):
        messages = [{"role": "system", "content": config.system_instruction or "Return valid JSON."},
                    {"role": "user", "content": contents}]
        body, timeout = self.request(messages, config)
        with httpx.Client(timeout=timeout) as session:
            result = checked(session.post(self.base + "/chat/completions", headers={"Authorization": "Bearer " + self.key}, json=body)).json()
        return SimpleNamespace(text=result["choices"][0]["message"]["content"])

    def suggest_replies(self, reply, messages, code):
        from google.genai import types
        try:
            result = self.generate_content(self.model, json.dumps({
                "recent_conversation": messages[1:][-6:], "latest_assistant_reply": reply,
            }, ensure_ascii=False), types.GenerateContentConfig(
                system_instruction=f"Generate optional customer reply buttons in language {code}. "
                "Return JSON only: {\"suggested_replies\": [\"short customer answer\"]}. "
                "Suggest 3 to 5 distinct, natural answers to the latest assistant question or next actions directly "
                "relevant to its answer. Each is a message the CUSTOMER might type, not an assistant response. "
                "Use at most 8 words per option. Match the current topic: dates for a date question, durations "
                "for a length question, group sizes for a traveler question, and budgets in the discussed currency "
                "for a budget question. Never reuse unrelated generic options. Do not invent package names, "
                "availability, discounts, customer facts or booking confirmation. Include an undecided/flexible "
                "answer when helpful. Return an empty array if no relevant suggestions exist.",
                response_mime_type="application/json", max_output_tokens=1024))
            return clean_suggestions(json.loads(result.text).get("suggested_replies"))
        except Exception:
            # Suggestions are optional; they must never turn a successful reply
            # into a provider error or prevent voice playback.
            return []

    def create(self, model, history, config):
        messages = [{"role": "system", "content": config.system_instruction}]
        messages.extend({"role": "assistant" if item.role == "model" else "user",
                         "content": "".join(part.text or "" for part in item.parts)} for item in history)
        def send_message_stream(text):
            messages.append({"role": "user", "content": text})
            # Resolve language from the actual utterance before the English
            # catalogue or previous assistant replies can bias generation.
            from google.genai import types
            from language_policy import REPLY_LANGUAGE_POLICY
            detection = self.generate_content(self.model, json.dumps({
                "current_message": text,
                "speech_language_hint": (re.search(r"Speech recognition language hint: ([a-z]{2,3})", config.system_instruction or "").group(1)
                    if re.search(r"Speech recognition language hint: ([a-z]{2,3})", config.system_instruction or "") else None),
                "previous_user_messages": [m["content"] for m in messages[:-1] if m["role"] == "user"][-2:],
                "recent_conversation": messages[1:-1][-6:]
            }, ensure_ascii=False), types.GenerateContentConfig(
                system_instruction=REPLY_LANGUAGE_POLICY + "\nIgnore any bracketed interface-language notes. "
                "Identify German, French, Arabic, Korean, Chinese, Hindi, Italian, Spanish, Sinhala, Tamil "
                "and other languages equally. For short or ambiguous spoken input use speech_language_hint "
                "before previous messages. An explicit request for a different reply language takes precedence. "
                "Also identify whether the customer is now accepting a proposed trip or explicitly asking to proceed "
                "to customise/build their trip. Set ready_to_customise true only for that intent, including an "
                "affirmative answer to an invitation to customise. Ordinary discovery answers, requests for packages, "
                "exploration, refusals or uncertainty are false. Use recent_conversation to resolve short confirmations. "
                "Return only JSON: {\"language_code\": \"ISO 639 code\", \"ready_to_customise\": false}.",
                response_mime_type="application/json", max_output_tokens=1024))
            decision = json.loads(detection.text)
            code = decision["language_code"]
            if not isinstance(code, str) or not re.fullmatch(r"[a-z]{2,3}", code):
                raise ProviderError(502)
            yield SimpleNamespace(text="", ready_to_customise=decision.get("ready_to_customise") is True)
            messages[0]["content"] += (
                f"\nFINAL REPLY LANGUAGE: {code}. Write every sentence in this language, in its original script. "
                "This overrides the catalogue language and previous assistant language. "
                f"Begin with [[language:{code}]] on its own line. Do not answer in English or Sinhala unless selected."
            )
            # Preserve Tourism's read-only, server-computed budget tool.
            if config.tools:
                import builder_ai
                body, timeout = self.request(messages, config)
                body["tools"] = [{"type": "function", "function": {
                    "name": "budget_check_tool", "description": builder_ai.budget_check_tool.__doc__,
                    "parameters": {"type": "object", "properties": {
                        "package_id": {"type": "string"}, "budget_lkr": {"type": "integer", "minimum": 1},
                        "travelers": {"type": "integer", "minimum": 1, "maximum": 30}},
                        "required": ["package_id", "budget_lkr"], "additionalProperties": False}}}]
                with httpx.Client(timeout=timeout) as session:
                    for step in range(5):
                        if step == 4:
                            body.pop("tools", None)
                        result = checked(session.post(self.base + "/chat/completions", headers={"Authorization": "Bearer " + self.key}, json=body)).json()
                        message = result["choices"][0]["message"]
                        calls = message.get("tool_calls") or []
                        if not calls:
                            reply = message.get("content") or ""
                            yield SimpleNamespace(text=reply)
                            yield SimpleNamespace(text="", suggested_replies=self.suggest_replies(reply, messages, code))
                            return
                        messages.append({k: message[k] for k in ("role", "content", "tool_calls") if k in message})
                        for call in calls:
                            try:
                                if call["function"]["name"] != "budget_check_tool":
                                    raise ValueError("Unknown tool")
                                arguments = json.loads(call["function"]["arguments"])
                                if not isinstance(arguments.get("budget_lkr"), int) or arguments["budget_lkr"] <= 0:
                                    raise ValueError("Invalid budget")
                                if not 1 <= arguments.get("travelers", 2) <= 30:
                                    raise ValueError("Invalid traveler count")
                                output = builder_ai.budget_check_tool(**arguments)
                            except (ValueError, TypeError, KeyError):
                                output = {"error": "Invalid budget tool arguments"}
                            messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(output)})
                raise ProviderError(502)
            body, timeout = self.request(messages, config, stream=True)
            reply_parts = []
            with httpx.Client(timeout=timeout) as session:
                with session.stream("POST", self.base + "/chat/completions", headers={"Authorization": "Bearer " + self.key}, json=body) as response:
                    checked(response)
                    for line in response.iter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        event = json.loads(data)
                        if event.get("error"):
                            raise ProviderError(502)
                        for choice in event.get("choices", []):
                            content = choice.get("delta", {}).get("content")
                            if content:
                                reply_parts.append(content)
                                yield SimpleNamespace(text=content)
            yield SimpleNamespace(text="", suggested_replies=self.suggest_replies("".join(reply_parts), messages, code))
        return SimpleNamespace(send_message_stream=send_message_stream)


def speech_settings():
    key, region = os.getenv("AZURE_SPEECH_KEY"), os.getenv("AZURE_SPEECH_REGION")
    if not key or not region:
        raise ProviderError(503)
    return key, region


def clean_suggestions(value):
    if not isinstance(value, list):
        return []
    return list(dict.fromkeys(item.strip() for item in value
        if isinstance(item, str) and item.strip() and len(item.strip()) <= 120))[:5]


def transcribe_audio(audio, mime_type, locale=None):
    key, region = speech_settings()
    # Supply candidate languages so Sinhala and Tamil participate in automatic
    # identification instead of relying on Azure's narrower empty-locale model.
    if locale:
        locale = os.getenv("AGENT_STT_LOCALE_" + locale.split("-")[0].upper(), locale)
    candidates = os.getenv("AGENT_STT_AUTO_LOCALES", "en-IN,si-LK,ta-IN,ko-KR,hi-IN,it-IT,ar-SA,zh-CN,es-ES,fr-FR,de-DE")
    locales = [locale] if locale else list(dict.fromkeys(
        os.getenv("AGENT_STT_LOCALE_" + item.strip().split("-")[0].upper(), item.strip())
        for item in candidates.split(",") if item.strip()))
    endpoint = os.getenv("AZURE_SPEECH_ENDPOINT", f"https://{region}.api.cognitive.microsoft.com").rstrip("/")
    extension = mime_type.split("/")[1]
    def request(session, locales):
        return checked(session.post(endpoint + "/speechtotext/transcriptions:transcribe",
            params={"api-version": "2025-10-15"}, headers={"Ocp-Apim-Subscription-Key": key},
            files={"audio": ("recording." + extension, audio, mime_type),
                   "definition": (None, json.dumps({"locales": locales}), "application/json")})).json()
    with httpx.Client(timeout=30) as session:
        try:
            result = request(session, locales)
        except ProviderError as exc:
            # Short or noisy clips can fail candidate identification (422
            # NoLanguageIdentified); Azure's multilingual model still handles them.
            if exc.code != 422 or len(locales) < 2:
                raise
            result = request(session, [])
    phrases = sorted(result.get("phrases", []), key=lambda p: p.get("offsetMilliseconds", 0))
    text = " ".join(p.get("text", "") for p in phrases).strip()
    if not text:
        text = " ".join(p.get("text", "") for p in result.get("combinedPhrases", [])).strip()
    detected = (phrases[-1].get("locale") if phrases else None) or locale or ""
    code = detected.split("-")[0].lower()
    segments = [{"text": p["text"], "language_code": (p.get("locale") or detected).split("-")[0].lower()}
                for p in phrases if p.get("text") and (p.get("locale") or detected)]
    return {"text": text, "language": code, "locale": detected, "language_code": code,
            "language_codes": list(dict.fromkeys(s["language_code"] for s in segments)), "segments": segments}


def synthesize(text, code):
    key, region = speech_settings()
    code = code or "en"
    gender = os.getenv("AGENT_VOICE_GENDER", "female").lower()
    defaults = {"en": ("en-IN", "Neerja" if gender == "female" else "Prabhat"),
                "si": ("si-LK", "Thilini" if gender == "female" else "Sameera"),
                "ta": ("ta-LK", "Saranya" if gender == "female" else "Kumar")}
    voice = os.getenv("AGENT_VOICE_" + code.upper()) or os.getenv(f"AGENT_VOICE_{gender.upper()}_{code.upper()}")
    locale = os.getenv("AGENT_TTS_LOCALE_" + code.upper())
    with httpx.Client(timeout=30) as session:
        base = f"https://{region}.tts.speech.microsoft.com/cognitiveservices"
        if not voice:
            if code in defaults:
                locale, name = defaults[code]
                voice = f"{locale}-{name}Neural"
            else:
                voices = checked(session.get(base + "/voices/list", headers={"Ocp-Apim-Subscription-Key": key})).json()
                matches = [v for v in voices if v["Locale"].split("-")[0] == code and v["Gender"].lower() == gender]
                if not matches:
                    raise ProviderError(422)
                locale, voice = matches[0]["Locale"], matches[0]["ShortName"]
        locale = locale or "-".join(voice.split("-")[:2])
        ssml = f'<speak version="1.0" xml:lang={quoteattr(locale)}><voice name={quoteattr(voice)}>{escape(text)}</voice></speak>'
        return checked(session.post(base + "/v1", headers={"Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm"}, content=ssml.encode())).content
