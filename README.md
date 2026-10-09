# Aura — AI travel assistant

The visual planner uses photo cards, interest filters, an AI route draft, a price
chart, and a Leaflet/OpenStreetMap map. Adding, removing or reordering days updates
the ordered map stops. Representative area coordinates are sourced in
`frontend/src/tripPlaces.js`; these are not exact hotel or attraction entrances.
OSRM supplies road geometry and estimated driving times where reachable. Island
connections remain labeled ferry/boat previews with no invented schedules.
If routing fails, grey dotted lines show stop order; Maps links provide directions
for each leg. Maps and routing require internet access and use public services;
use a production tile/routing provider for deployment at scale.

Check route mapping with `node src/tripPlaces.test.js` from `frontend`.

Chat controls: copy an individual message or the complete conversation; edit a
customer question and resend it; delete a message or clear the chat. Deleting a
question removes its associated replies. **Undo delete** restores the last
deletion or clear until another message is sent. Editing replaces that question
and all subsequent messages. These controls are available in main chat and the
package assistant; removing chat messages does not reverse applied trip choices.

## Customer-built trips and currency comparison

Open **Build my own trip** in chat or the builder. Customers can search catalogue
experiences, add up to 30 unique itinerary days, reorder/remove them, and choose
hotel, meal, transport and extra options. The summary compares the estimate with
their budget and displays their selected currency alongside LKR using the existing
exchange-rate feed. If conversion is unavailable, LKR remains visible.

Custom prices are computed on the server from catalogue day prices, plus service
adjustments scaled to the chosen travelers and nights. These are indicative;
staff must confirm routing, inclusions, availability and the final price. The
existing seeded service option prices are placeholders and need real rates before launch.
Customers can download a JSON draft or submit a confirmed review request. Its
ordered itinerary is stored with the selections in `booking_requests`.

New endpoints: `GET /api/currencies`, `POST /api/builder/custom/quote`, and
`POST /api/builder/custom/requests`. Run backend checks with
`python -m unittest test_custom_trip test_rag -v` from `backend`.

## Database RAG

Chat retrieves relevant active records from `backend/packages.db` before sending
the prompt to Gemini. `backend/rag.py` uses SQLite FTS5 with BM25 keyword ranking;
it does not use semantic embeddings or require a separate vector database.
Each request builds a small local search index, so database edits and deactivated
packages take effect immediately. A compact directory supports broad discovery,
while up to three full package records provide itineraries, inclusions, exclusions,
and source IDs. Recent conversation references preserve package context for follow-ups.
Prices and booking quotes continue to come from the existing database and quote code.

Run retrieval checks from `backend`: `python -m unittest test_rag -v`.
For larger catalogues or multilingual semantic search, replace the request-local
keyword index with a persistent embedding index.

A runnable React + FastAPI project. `npm run dev` and `uvicorn` give you a
working assistant in two terminals; the widget then lifts out into your real
site as a single component.

```
aura/
├── backend/
│   ├── main.py          FastAPI — /api/chat (SSE stream), /api/greeting
│   ├── prompt.py        Aura system prompt + greeting, verbatim from your spec
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── package.json
    ├── vite.config.js   proxies /api → :8000, so CORS never fires in dev
    ├── index.html
    └── src/
        ├── main.jsx     entry point
        ├── App.jsx      placeholder host page — delete when your site exists
        ├── host.css     styles for the placeholder — delete with App.jsx
        ├── AuraChat.jsx the widget  ← this is the part you keep
        └── AuraChat.css scoped styles for the widget
```
clear
## Run it

**Terminal 1 — backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env
# edit .env: set ANTHROPIC_API_KEY and PLATFORM_NAME
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and click **Plan with Aura**.

## Moving it into your real site

Only two files travel: `AuraChat.jsx` and `AuraChat.css`. Copy them into your
components folder, `npm install react-markdown remark-gfm`, and mount the
widget once at app level:

```jsx
import AuraChat from "./components/AuraChat";

<YourSite />
<AuraChat />
```

Delete `App.jsx` and `host.css` — they're only scaffolding.

If your real frontend doesn't proxy `/api`, pass the API origin directly and set
`ALLOWED_ORIGINS` in `.env` to match:

```jsx
<AuraChat apiBase="https://api.yoursite.lk" />
```

## How it's wired

- **Stateless.** The widget sends the whole history each turn. No session store.
- **Streaming.** Package drafts are long; without SSE users watch a blank box.
- **The greeting is fetched, not hardcoded.** It lives in `prompt.py` next to the
  system prompt, so Aura's voice has one home. The widget strips the greeting
  before sending history, because the Anthropic API requires the first message
  to be a `user` turn.
- **Markdown matters.** Aura's package format ends in a cost table. `remark-gfm`
  is what renders it; without it you get raw pipe characters.
- **CSS is namespaced under `.aura`** so it can't collide with your site. Change
  the five colour variables at the top of `AuraChat.css` to match your brand.

## Before launch

1. **Rate limiting.** There is none. A public endpoint calling a paid API needs a
   per-IP or per-session cap — `slowapi`, or gate it behind your site's auth.
2. **The Package Builder handoff.** Aura tells users to "load this into the
   Package Builder," but nothing does. When the builder exists, define a tool on
   the API call so Claude returns structured package JSON — don't parse the
   markdown table.
3. **Exchange rates.** Aura estimates conversions from its own knowledge. For
   live rates, inject them into the system prompt at request time.
4. **Model.** `claude-sonnet-5-5`. Haiku is cheaper at volume; change
   `ANTHROPIC_MODEL` in `.env`.

Chat voice controls: Read aloud toggles to Stop reading and stops when the message or chat closes. The microphone uses browser speech recognition in the selected language, inserts a transcript into the draft, and never sends it automatically. Users grant microphone access in their browser; unsupported browsers and permission/network failures show a message. Browser recognition may use a remote speech service.
