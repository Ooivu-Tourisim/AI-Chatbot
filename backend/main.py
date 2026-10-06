"""Aura travel assistant API powered by Google Gemini and SQLite Package Database.

Stateless: the client sends the full message history on every turn and the
server prepends the system prompt grounded in the verified package database.
"""

import json
import os
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

import database
from prompt import build_greeting, build_system_prompt

load_dotenv()

# Initialize the SQLite package database
database.init_db()

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


def get_current_system_prompt() -> str:
    """Fetch the latest packages from the database and generate the grounded prompt."""
    catalog = database.get_packages_summary_for_prompt()
    return build_system_prompt(PLATFORM_NAME, catalog)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=40)


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


@app.get("/api/packages/{package_id}")
def get_package(package_id: str):
    """Return specific package details by ID from the SQLite database."""
    pkg = database.get_package_by_id(package_id)
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Package '{package_id}' not found.")
    return pkg


@app.post("/api/chat")
def chat(req: ChatRequest):
    if not client:
        def no_key_stream():
            yield sse({"type": "error", "message": "Gemini API key is not configured in backend/.env"})
        return StreamingResponse(no_key_stream(), media_type="text/event-stream")

    # Dynamic grounded system prompt with verified database packages
    system_instruction = get_current_system_prompt()

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
