# Personal Finance Assistant

An AI-driven personal finance companion. Users sign in, ingest their transaction
history (CSV), upload receipts, and **talk to an assistant in plain language**
about their money.

**Stack:** Flask · MongoDB Atlas · React (Vite + TS + Tailwind) · Google Gemini (free tier).

---

## Quick start

### 1. Prereqs
- Python 3.10+
- Node 18+
- A free **MongoDB Atlas** cluster URI (or local Mongo)
- A free **Google Gemini API key** (https://aistudio.google.com)
- *(optional)* Tavily API key for "look up unfamiliar charge" feature

### 2. Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: set MONGO_URI, GEMINI_API_KEY
python run.py        # serves on http://localhost:5001
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev          # serves on http://localhost:5173
```

Open http://localhost:5173, sign up, then upload `backend/sample_data/transactions.csv`
on the Transactions page. Then talk to the assistant on the Chat page.

---

## What's built

| Feature | Status |
|---|---|
| Email/password signup + JWT auth | done |
| Multi-user data isolation (every Mongo query scoped by `user_id`) | done |
| CSV ingest with normalization, dedupe, junk-row rejection | done |
| Rule-based merchant categorization (zero LLM cost per row) | done |
| Pre-computed monthly rollups (drives "compare across time") | done |
| Conversational assistant w/ Gemini function calling | done |
| Receipt OCR via Gemini vision → human-confirmed insert | done |
| Recurring-charge detection (cadence + amount tolerance) | done |
| Anomaly detection (z-score vs. category mean) | done |
| Budgets w/ live progress | done |
| Persistent user memories (extracted from chat) | done |
| Dashboard charts (by month, by category, recurring, anomalies, budgets) | done |
| Web lookup for unknown merchants (Tavily) | implemented, optional key |

### Intentionally skipped / stubbed
- Real bank connection (assignment provides CSV + mock; only CSV is wired).
- Streaming chat (responses are batched — works fine on free Gemini tier).
- Embedding-based semantic recall on transactions (rule-based + aggregates cover the asks).
- Email verification / password reset.
- Mobile-specific layout polish.
- Test suite beyond syntax validation.

---

## How it's designed (the part that actually matters)

### 1. Routing & model selection
A single Gemini Flash model serves the whole agent loop with **function calling**.
The agent gets a tool catalog and chooses; for analytical questions it chains
multiple tool calls (max 5). Deterministic math happens in Python/Mongo, never
in the LLM.

- **Cheap path** (e.g. "spending on groceries last month"): one tool call → one
  Flash response. ~1 LLM call.
- **Agentic path** (e.g. "am I spending more than usual?"): the model calls
  `compare_periods` or `query_spending(group_by=month)` then summarizes. 2–3
  LLM calls.
- **Vision path**: a dedicated Gemini call with strict JSON schema for receipt
  fields. Confidence is self-reported by the model and surfaced to the user.

We deliberately did **not** route to a heavier model by default — Flash is fast,
free, and good enough when paired with deterministic tools. A `REASONING_MODEL`
escalation hook exists in `services/agent.py` if needed.

### 2. Scale strategy — never dump transactions into the prompt
- **Aggregations in Mongo, not the LLM.** Every tool is an aggregation pipeline.
  A user with 5 years of data costs the same tokens as a user with 5 weeks.
- **Pre-computed monthly rollups** (`monthly_rollups` collection) make
  "compare across time" O(months) instead of O(transactions). Rebuilt on
  every CSV upload, receipt commit, or transaction delete.
- **Hard caps** in every tool (`top_transactions` ≤ 25, anomalies ≤ 15, etc.)
  so a tool result stays small even on huge datasets.
- **Short chat history** sent to the LLM (last 10 messages), with durable user
  facts pulled from a separate `memories` collection and injected into the
  system prompt.

### 3. Edge cases (deliberate)
- **Receipt model returns its own `confidence` field.** The UI shows the
  extracted JSON for the user to confirm/edit before it becomes a transaction.
  Bad parses are caught and surfaced rather than inserted silently.
- **CSV ingest** is forgiving: column names are matched case-insensitively
  across common variants (`date`/`transaction date`/`posted date`, etc.),
  amounts handle `$1,234.56`, `(12.34)` (parenthesized negatives), and rejected
  rows are returned to the caller with reasons — not dropped silently.
- **Dedupe** is a hash of `(user, date, amount, merchant)`, enforced by a
  unique Mongo index. Re-uploading the same CSV is a no-op.
- **Ambiguous questions** are handled in the system prompt: the model is told
  to ask one clarifying question rather than guess a timeframe.
- **Tool errors** are returned to the model as `{error: ...}` so it can
  recover or explain — they don't crash the request.

### 4. Memory
When a user says "I get paid on the 1st" or "don't count rent in my food
budget", the model is instructed to call `save_memory`. On every subsequent
turn, the system prompt is rebuilt with those facts. This is cheaper and more
deterministic than RAG over chat history.

### 5. Multi-user
- Every Mongo query is scoped by `user_id` from the JWT.
- A unique index on `(user_id, dedupe_hash)` prevents one user's dedupes from
  colliding with another's.
- Stateless backend → horizontal scale is `gunicorn --workers N`.

---

## Trade-offs & assumptions
- **USD-only.** Multi-currency is a real product feature, out of scope here.
- **Negative amount = spending, positive = income.** Matches the sample CSV.
- **Rule-based categorizer** beats an LLM categorizer on cost/latency for the
  common case; uncategorized rows fall through to "uncategorized" and the
  assistant can still query them. A batched LLM pass over uncategorized rows
  would be the next addition.
- **No streaming.** Free Gemini tier responds in <2s for these prompts; a
  spinner is fine. Streaming via SSE is straightforward to add.
- **JWT in localStorage.** Fine for an assessment; in production move to
  HttpOnly cookies + CSRF.

---

## Repo layout

```
backend/
  app/
    __init__.py          Flask app factory
    config.py
    models/db.py         Mongo connection + index setup
    routes/              auth, transactions, chat, receipts, budgets, insights
    services/
      agent.py           Gemini function-calling loop + system prompt
      tools.py           All deterministic tools the agent can call
      vision.py          Receipt OCR
      ingest.py          CSV parse, dedupe, rollups
      categorize.py      Rule-based merchant → category
  sample_data/transactions.csv
  run.py
frontend/
  src/
    pages/               Login, Dashboard, Chat, Transactions, Receipts, Budgets
    lib/api.ts           Typed API client
    App.tsx, main.tsx
```

---

## Example questions to try

- "How much did I spend on groceries last month?"
- "What was my biggest purchase in the last 90 days?"
- "Find my recurring subscriptions"
- "Anything unusual in the last 30 days?"
- "Am I spending more this month than last month?"
- "Set a $400 budget for groceries"
- "I get paid on the 1st and 15th — remember that"
