"""Aura travel assistant API powered by Google Gemini and SQLite Package Database.

Stateless: the client sends the full message history on every turn and the
server prepends the system prompt grounded in the verified package database.
"""

import json
import base64
import binascii
import logging
import os
import io
import threading
import wave
import time
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

import builder
import builder_ai
import currency
import database
import draft
import rag
import translate
from prompt import build_greeting, build_system_prompt
from language_policy import REPLY_LANGUAGE_POLICY, TRANSCRIPTION_INSTRUCTIONS
from chat_stream import response_events

load_dotenv()

# Initialize the SQLite package database
database.init_db()
builder.init()

# Warm the exchange-rate cache so the first draft with a foreign-currency budget is not slowed by it.
threading.Thread(target=currency.get_rates, daemon=True).start()

PLATFORM_NAME = os.getenv("PLATFORM_NAME", "North of Ceylon")
RAW_MODEL = os.getenv("GEMINI_MODEL") or os.getenv("ANTHROPIC_MODEL", "gemini-3.5-flash-lite")
MODEL = "gemini-3.5-flash-lite" if RAW_MODEL in ("gemini", "default", "", None) else RAW_MODEL
BUILDER_MODEL = os.getenv("GEMINI_BUILDER_MODEL") or "gemini-3.5-flash"
LANGUAGE_MODEL = os.getenv("GEMINI_LANGUAGE_MODEL") or "gemini-3.5-flash-lite"

MAX_TOKENS = int(os.getenv("AURA_MAX_TOKENS", "2000"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
client = genai.Client(api_key=API_KEY) if API_KEY else None

app = FastAPI(title="Aura Travel Assistant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


def get_current_system_prompt(query: str = "", history: list[str] | None = None, currency_code: str = "USD") -> str:
    """Fetch the latest packages from the database and generate the grounded prompt."""
    catalog = rag.build_context(query, history)
    requested = [currency_code] + [code for code in currency.MAJOR_CURRENCIES if code in query.upper().split()]
    rates = currency.build_currency_section(database.get_all_packages(), requested)
    return build_system_prompt(PLATFORM_NAME, catalog + "\n\n" + rates)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    messages: list[Message] = Field(min_length=1, max_length=40)
    language_code: str | None = Field(default=None, pattern=r"^[a-z]{2,3}$")


class DayRef(BaseModel):
    package_id: str = Field(max_length=40)
    day: int = Field(ge=1, le=30)


class DraftRequest(BaseModel):
    request: str = Field(min_length=3, max_length=6000)
    language: str = Field(default="English", max_length=40)


class OptimizeRequest(BaseModel):
    days: list[DayRef] = Field(min_length=1, max_length=30)
    budget_lkr: int = Field(gt=0, le=100_000_000)


class ChecklistRequest(BaseModel):
    days: list[DayRef] = Field(min_length=1, max_length=30)
    month: str = Field(default="", max_length=30)
    language: str = Field(default="English", max_length=40)


class QuoteRequest(BaseModel):
    package_id: str = Field(max_length=40)
    travelers: int = Field(ge=1, le=30)
    selections: dict[str, str | list[str]] = Field(default_factory=dict)


class TripPreparation(BaseModel):
    diet: Literal["vegetarian", "non_vegetarian", "vegan", "other", "no_preference"] = "no_preference"
    food_status: Literal["none", "needs", "private"]
    food_details: str = Field(default="", max_length=500)
    stay_status: Literal["none", "needs", "private"]
    stay_details: str = Field(default="", max_length=500)


def preparation_notes(req):
    prep = req.preparation
    if prep is None:
        return req.notes
    for status, details in [(prep.food_status, prep.food_details), (prep.stay_status, prep.stay_details)]:
        if status == "needs" and not details.strip():
            raise HTTPException(status_code=422, detail="Please describe the preparation needed.")
    return req.notes + "\n\nFOOD & STAY PREPARATION (needs provider confirmation)\nFood preference: " + prep.diet + "\n" + "\n".join(
        f"{label}: {status}" + (f" — {details.strip()}" if status == "needs" else "")
        for label, status, details in [("Food", prep.food_status, prep.food_details), ("Stay / emergency", prep.stay_status, prep.stay_details)])


class BookingRequest(QuoteRequest):
    preparation: TripPreparation | None = None
    customer_name: str = Field(min_length=2, max_length=120)
    customer_email: str = Field(max_length=200)
    customer_phone: str = Field(default="", max_length=40)
    travel_date: str = Field(default="", max_length=20)
    notes: str = Field(default="", max_length=1000)
    confirmed: bool = False  # explicit customer confirmation is mandatory


class CustomQuoteRequest(QuoteRequest):
    days: list[DayRef] = Field(min_length=1, max_length=30)


class CustomBookingRequest(BookingRequest):
    days: list[DayRef] = Field(min_length=1, max_length=30)


class BuilderDraftRequest(BaseModel):
    request: str = Field(min_length=3, max_length=6000)
    language: str = Field(default="English", max_length=40)


class AssistRequest(QuoteRequest):
    message: str = Field(min_length=1, max_length=1000)
    budget_lkr: int | None = Field(default=None, gt=0, le=100_000_000)
    language: str = Field(default="English", max_length=40)


class SavingsRequest(QuoteRequest):
    budget_lkr: int = Field(gt=0, le=100_000_000)


DRAFT_TIMEOUT_MS = 13000  # whole AI call (incl. one retry) stays inside the 15 s draft target

AI_DOWN = "AI suggestions are temporarily unavailable. You can continue browsing, customizing, and booking manually."


def ai_call(fn, *args):
    """Run an AI-backed step; any failure becomes a 503 the UI shows as a non-blocking notice."""
    if not client:
        raise HTTPException(status_code=503, detail=AI_DOWN)
    try:
        return fn(client, BUILDER_MODEL, *args)
    except json.JSONDecodeError:
        raise HTTPException(status_code=503, detail=AI_DOWN)  # malformed model output counts as AI failure
    except (LookupError, ValueError):
        raise  # caller handled: not an AI outage
    except Exception:
        raise HTTPException(status_code=503, detail=AI_DOWN)


def sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


class AudioRequest(BaseModel):
    audio: str = Field(min_length=1, max_length=8_000_000)
    mime_type: Literal["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"]


class SpeechSegment(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    language_code: str = Field(pattern=r"^[a-z]{2,3}$")


class Transcript(BaseModel):
    text: str = Field(max_length=6000)
    language: str = Field(max_length=40)
    locale: str = Field(max_length=30)
    language_code: str = Field(pattern=r"^([a-z]{2,3})?$")
    language_codes: list[str] = Field(default_factory=list, max_length=20)
    segments: list[SpeechSegment] = Field(default_factory=list, max_length=100)


class SpeechOutputSegment(BaseModel):
    text: str
    language_code: str


class SpeechOutput(BaseModel):
    """Simple Gemini output schema; validate limits separately with Transcript."""
    text: str
    language: str
    locale: str
    language_code: str


@app.post("/api/transcribe")
def transcribe(req: AudioRequest):
    if not client:
        raise HTTPException(status_code=503, detail=AI_DOWN)
    try:
        audio = base64.b64decode(req.audio, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=422, detail="Invalid audio recording.")
    try:
        result = client.models.generate_content(
            model=LANGUAGE_MODEL,
            contents=[types.Part.from_bytes(data=audio, mime_type=req.mime_type),
                      TRANSCRIPTION_INSTRUCTIONS],
            config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=SpeechOutput,
                                               thinking_config=types.ThinkingConfig(thinking_level="minimal"),
                                               automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                                               http_options=types.HttpOptions(timeout=30000)),
        )
        return Transcript.model_validate_json(result.text)
    except errors.APIError as exc:
        # Log a code, never raw provider messages that may contain request details.
        logging.getLogger(__name__).error("Transcription provider failed: model=%s code=%s", LANGUAGE_MODEL, exc.code)
        if exc.code == 429:
            detail = "Voice transcription is temporarily rate-limited. Please try again shortly."
        elif exc.code in (401, 403):
            detail = "Voice transcription is unavailable: check the Gemini API key and model access."
        elif exc.code == 404:
            detail = "The configured speech model is unavailable. Check GEMINI_LANGUAGE_MODEL."
        else:
            detail = "Could not transcribe the recording. Please try again."
        raise HTTPException(status_code=503, detail=detail) from exc
    except Exception as exc:
        logging.getLogger(__name__).error("Transcription failed: model=%s error_type=%s", LANGUAGE_MODEL, type(exc).__name__)
        raise HTTPException(status_code=503, detail="Could not transcribe the recording. Please try again.")


TTS_MODELS = [m for m in (os.getenv("GEMINI_TTS_MODEL"), "gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview") if m]
TTS_VOICE = os.getenv("GEMINI_TTS_VOICE") or "Kore"


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)


@app.post("/api/speak")
def speak(req: SpeakRequest):
    """Spoken audio (WAV) for any language, used when the browser has no voice for it."""
    if not client:
        raise HTTPException(status_code=503, detail=AI_DOWN)
    pcm = None
    for model in TTS_MODELS:  # next model if one is rate-limited or unavailable
        try:
            result = client.models.generate_content(
                model=model,
                contents=req.text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=TTS_VOICE))),
                    http_options=types.HttpOptions(timeout=30000),
                ),
            )
            pcm = result.candidates[0].content.parts[0].inline_data.data
            break
        except Exception as exc:
            logging.getLogger(__name__).error("Speech synthesis failed: model=%s error_type=%s code=%s", model, type(exc).__name__, getattr(exc, "code", None))
    if not pcm:
        raise HTTPException(status_code=503, detail="Voice output is unavailable right now.")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:  # Gemini TTS returns raw 24 kHz, 16-bit mono PCM
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    return Response(content=buf.getvalue(), media_type="audio/wav")


@app.get("/api/greeting")
def greeting():
    """Opening message, so the greeting text lives in one place (the prompt file)."""
    return {"greeting": build_greeting(PLATFORM_NAME)}


@app.get("/api/packages")
def list_packages():
    """Return all verified packages directly from the SQLite database."""
    return database.get_all_packages()


class TranslateRequest(BaseModel):
    language: str = Field(default="English", max_length=40)
    package_ids: list[str] = Field(min_length=1, max_length=20)


@app.post("/api/translate/packages")
def translate_packages(req: TranslateRequest):
    """Package text in the traveler's language: {package_id: translated fields}. English is returned as-is (empty)."""
    if req.language.strip().lower() in ("english", "en"):
        return {}
    if not client:
        raise HTTPException(status_code=503, detail=AI_DOWN)
    ids = [i for i in dict.fromkeys(req.package_ids) if database.get_package_by_id(i)]
    return translate.translate_many(client, MODEL, ids, req.language, 30000)


@app.get("/api/currencies")
def exchange_rates():
    rates = currency.get_rates()
    return {"rates": rates or {"LKR": 1}, "updated": currency._cache["updated"],
            "available": bool(rates), "stale": bool(rates) and time.time() - currency._cache["fetched_at"] >= currency.CACHE_SECONDS,
            "source": "open.er-api.com"}


def custom_quote(req):
    refs = [d.model_dump() for d in req.days]
    days, dropped = draft.hydrate(refs)
    if dropped:
        raise ValueError("unknown_itinerary_day")
    if len({(d["package_id"], d["day"]) for d in days}) != len(days):
        raise ValueError("duplicate_itinerary_day")
    q = builder.quote(req.package_id, req.travelers, req.selections,
                      base_lkr=draft.total_lkr(days), nights=max(len(days) - 1, 0))
    if q["total_lkr"] <= 0:
        raise ValueError("invalid_custom_total")
    q["lines"][0]["label"] = "Custom itinerary (indicative)"
    q.update(days=days, indicative=True, nights=max(len(days) - 1, 0))
    return q


@app.post("/api/builder/custom/quote")
def custom_builder_quote(req: CustomQuoteRequest):
    try:
        return custom_quote(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/builder/custom/requests")
def custom_builder_request(req: CustomBookingRequest):
    if not req.confirmed:
        raise HTTPException(status_code=422, detail="confirmation_required")
    try:
        q = custom_quote(req)
        # Persist the ordered itinerary alongside options for the team to review.
        q["selections"] = {**q["selections"], "itinerary": [d.model_dump() for d in req.days]}
        ref = builder.create_request(q, req.customer_name, req.customer_email,
                                     req.customer_phone, req.travel_date, preparation_notes(req))
        return {"reference": ref, "status": "requested", "total_lkr": q["total_lkr"], "indicative": True}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/api/packages/{package_id}")
def get_package(package_id: str):
    """Return specific package details by ID from the SQLite database."""
    pkg = database.get_package_by_id(package_id)
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Package '{package_id}' not found.")
    return pkg


@app.get("/api/builder/{package_id}")
def builder_options(package_id: str, lang: str = "en"):
    """Package + its selectable option groups (hotel, meals, transport, extras)."""
    data = builder.get_builder(package_id, lang)
    if not data:
        raise HTTPException(status_code=404, detail=f"Package '{package_id}' not found.")
    return data


@app.post("/api/builder/draft")
def builder_draft(req: BuilderDraftRequest):
    """Natural-language request -> a pre-filled, editable, UNBOOKED Package Builder draft."""
    try:
        return ai_call(builder_ai.create_draft, req.request, req.language, DRAFT_TIMEOUT_MS)
    except LookupError:
        raise HTTPException(status_code=422, detail="no_match")


@app.post("/api/builder/assist")
def builder_assist(req: AssistRequest):
    """AI help while editing: answers questions and may PROPOSE option changes (never applies them)."""
    try:
        return ai_call(builder_ai.assist, req.package_id, req.travelers, req.selections, req.budget_lkr, req.message, req.language, DRAFT_TIMEOUT_MS)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/builder/savings")
def builder_savings(req: SavingsRequest):
    """Exact-saving option swaps when over budget. Code only, so it works without the AI."""
    try:
        return builder_ai.savings(req.package_id, req.travelers, req.selections, req.budget_lkr)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/builder/quote")
def builder_quote(req: QuoteRequest):
    """Live price for a set of selections. Pure code, so it works even when the AI is down."""
    try:
        return builder.quote(req.package_id, req.travelers, req.selections)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/builder/requests")
def builder_request(req: BookingRequest):
    """Submit a booking REQUEST. Requires explicit confirmation; takes no payment and books nothing."""
    if not req.confirmed:
        raise HTTPException(status_code=422, detail="confirmation_required")
    try:
        q = builder.quote(req.package_id, req.travelers, req.selections)
        ref = builder.create_request(q, req.customer_name, req.customer_email, req.customer_phone, req.travel_date, preparation_notes(req))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"reference": ref, "status": "requested", "total_lkr": q["total_lkr"]}


@app.post("/api/draft")
def create_draft(req: DraftRequest):
    """Natural-language request -> editable, UNBOOKED draft built only from catalogue days."""
    result = ai_call(draft.build_draft, req.request, req.language, DRAFT_TIMEOUT_MS)
    if not result["days"]:
        raise HTTPException(status_code=422, detail="I couldn't match that to our verified catalogue. Try describing your interests, trip length or budget, or use the Package Builder.")
    return result


@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    """Deterministic budget substitutions (no AI needed, so it works even if the AI is down)."""
    return draft.optimise([d.model_dump() for d in req.days], req.budget_lkr)


@app.post("/api/checklist")
def checklist(req: ChecklistRequest):
    return ai_call(draft.build_checklist, [d.model_dump() for d in req.days], req.month, req.language, DRAFT_TIMEOUT_MS)


@app.post("/api/chat")
def chat(req: ChatRequest):
    if not client:
        def no_key_stream():
            yield sse({"type": "error", "message": "Gemini API key is not configured in backend/.env"})
        return StreamingResponse(no_key_stream(), media_type="text/event-stream")

    # Dynamic grounded system prompt with verified database packages
    system_instruction = get_current_system_prompt(
        query=req.messages[-1].content,
        history=[m.content for m in req.messages[:-1]][-4:],
        currency_code=req.currency,
    )

    # Map previous turns into Gemini Content objects
    history = [
        types.Content(
            role="model" if m.role == "assistant" else "user",
            parts=[types.Part.from_text(text=m.content)],
        )
        for m in req.messages[:-1]
    ]
    latest_user_message = req.messages[-1].content

    def stream():
        language_code = req.language_code
        delivered = False
        language_instruction = (
            f"Respond in the language with ISO 639 code {language_code}. This resolved reply language takes precedence over interface notes."
            if language_code else REPLY_LANGUAGE_POLICY +
            "\nIgnore bracketed interface preferences for clear input. Start your output with exactly "
            "[[language:xx]] on its own line, replacing xx with the chosen ISO 639 code. "
            "Then immediately write the answer in that language. This first line is transport metadata."
        )

        def stream_with_model(target_model: str):
            nonlocal delivered
            chat_session = client.chats.create(
                model=target_model,
                history=history,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction + "\n" + language_instruction + (
                        " Respond fluently and naturally, using its original script. "
                        "Understand every part of code-switched input without dropping details. Preserve foreign names "
                        "and quoted terms where appropriate; do not explain language detection unless asked."
                    ),
                    max_output_tokens=MAX_TOKENS,
                    thinking_config=types.ThinkingConfig(thinking_level="minimal"),
                    tools=[builder_ai.budget_check_tool],
                ),
            )
            for event in response_events(chat_session.send_message_stream(latest_user_message), language_code):
                if event["type"] == "delta":
                    delivered = True
                yield sse(event)

        try:
            try:
                yield from stream_with_model(MODEL)
            except Exception as exc:
                if isinstance(exc, errors.APIError) and exc.code == 429:
                    raise  # Another model call cannot resolve project quota exhaustion.
                if delivered:
                    raise  # A partial answer must not be duplicated by a retry.
                fallback = "gemini-flash-lite-latest" if MODEL != "gemini-flash-lite-latest" else "gemini-3.5-flash-lite"
                yield from stream_with_model(fallback)
        except errors.APIError as e:
            if e.code == 429:
                yield sse({"type": "error", "code": "rate_limited", "message": "The AI request limit has been reached. Please wait and try again. If it persists, check your Gemini quota in AI Studio."})
            else:
                yield sse({"type": "error", "message": "The assistant is temporarily unavailable. Please try again."})
        except Exception as e:
            yield sse({"type": "error", "message": f"Could not reach the assistant. {str(e)}"})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
