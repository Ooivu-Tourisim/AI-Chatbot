"""Aura travel assistant API powered by Google Gemini and SQLite Package Database.

Stateless: the client sends the full message history on every turn and the
server prepends the system prompt grounded in the verified package database.
"""

import json
import os
import threading
import time
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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

load_dotenv()

# Initialize the SQLite package database
database.init_db()
builder.init()

# Warm the exchange-rate cache so the first draft with a foreign-currency budget is not slowed by it.
threading.Thread(target=currency.get_rates, daemon=True).start()

PLATFORM_NAME = os.getenv("PLATFORM_NAME", "North of Ceylon")
RAW_MODEL = os.getenv("GEMINI_MODEL") or os.getenv("ANTHROPIC_MODEL", "gemini-3.5-flash-lite")
MODEL = "gemini-3.5-flash-lite" if RAW_MODEL in ("gemini", "default", "", None) else RAW_MODEL

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


def get_current_system_prompt(query: str = "", history: list[str] | None = None) -> str:
    """Fetch the latest packages from the database and generate the grounded prompt."""
    catalog = rag.build_context(query, history)
    rates = currency.build_currency_section(database.get_all_packages())
    return build_system_prompt(PLATFORM_NAME, catalog + "\n\n" + rates)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=40)


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
        return fn(client, MODEL, *args)
    except json.JSONDecodeError:
        raise HTTPException(status_code=503, detail=AI_DOWN)  # malformed model output counts as AI failure
    except (LookupError, ValueError):
        raise  # caller handled: not an AI outage
    except Exception:
        raise HTTPException(status_code=503, detail=AI_DOWN)


def sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


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
        req.messages[-1].content, [m.content for m in req.messages[:-1]][-4:]
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
        def stream_with_model(target_model: str):
            chat_session = client.chats.create(
                model=target_model,
                history=history,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    max_output_tokens=MAX_TOKENS,
                    tools=[builder_ai.budget_check_tool],
                ),
            )
            for chunk in chat_session.send_message_stream(latest_user_message):
                if chunk.text:
                    yield sse({"type": "delta", "text": chunk.text})
            yield sse({"type": "done"})

        try:
            try:
                yield from stream_with_model(MODEL)
            except Exception:
                fallback = "gemini-flash-lite-latest" if MODEL != "gemini-flash-lite-latest" else "gemini-3.5-flash-lite"
                yield from stream_with_model(fallback)
        except errors.APIError as e:
            yield sse({"type": "error", "message": f"Assistant unavailable ({e.code}): {e.message}"})
        except Exception as e:
            yield sse({"type": "error", "message": f"Could not reach the assistant. {str(e)}"})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
