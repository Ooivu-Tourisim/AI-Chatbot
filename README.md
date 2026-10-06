# Aura — AI travel assistant

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
