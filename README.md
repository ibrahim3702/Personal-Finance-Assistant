# Personal Finance Assistant

An AI-powered personal finance app. Sign in, ingest transactions (CSV or
manual), upload receipts for OCR, set budgets, and chat with an assistant that
answers in plain language using your real data.

**Stack:** Flask · MongoDB · React (Vite + TypeScript + Tailwind) · OpenRouter
(vision + agent with function calling).

---

## Prerequisites

- **Python** 3.10+
- **Node** 18+
- **MongoDB** — free Atlas cluster or local instance
- **OpenRouter API key** — free, no card: https://openrouter.ai/keys

---

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
# Required
MONGO_URI=mongodb://localhost:27017
MONGO_DB=finance_assistant
SECRET_KEY=change-me
JWT_SECRET_KEY=change-me-too
OPENROUTER_API_KEY=sk-or-v1-...

# Optional — override default models (defaults shown)
OPENROUTER_AGENT_MODEL=moonshotai/kimi-k2.6:free
OPENROUTER_VISION_MODEL=moonshotai/kimi-k2.6:free

# Optional — fallback chain used when the primary model is rate-limited
OPENROUTER_AGENT_FALLBACKS=google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free

# Optional — only needed for the "look up unknown merchant" tool
TAVILY_API_KEY=
```

Start it:

```bash
python run.py        # http://localhost:5001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

---

## First run

1. Open http://localhost:5173 and **sign up** (any email + password works locally).
2. Go to **Transactions** → **Upload CSV** and pick `sample_transactions.csv`
   from the project root. This seeds 3 months of realistic data — recurring
   subscriptions, varied categories, and an anomaly or two so the Dashboard
   and Assistant have something to work with.
3. Visit **Dashboard** to see charts populate.
4. Go to **Chat** and try:
   - *"How much did I spend on groceries last month?"*
   - *"Find my recurring subscriptions"*
   - *"Anything unusual in the last 30 days?"*

You can also **add transactions manually** (Transactions → *Add transaction*),
**scan receipts** (Receipts page — drop an image, edit fields, save), and
**create budgets** (Budgets page — pick a category from the dropdown).

---

## Environment variables — quick reference

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | yes | Mongo connection string |
| `MONGO_DB` | yes | Database name |
| `SECRET_KEY` | yes | Flask session secret |
| `JWT_SECRET_KEY` | yes | JWT signing key |
| `OPENROUTER_API_KEY` | yes | Powers the chat agent + receipt OCR |
| `OPENROUTER_AGENT_MODEL` | no | Override agent model |
| `OPENROUTER_AGENT_FALLBACKS` | no | Comma-separated fallback chain on 429 |
| `OPENROUTER_VISION_MODEL` | no | Override receipt OCR model |
| `TAVILY_API_KEY` | no | Enables the "look up unknown merchant" tool |
| `CORS_ORIGINS` | no | Defaults to `http://localhost:5173` |

---

## Notes

- OpenRouter's free pool is shared across `:free` models (~50 requests/day).
  If you hit a 429, the agent automatically tries the next model in
  `OPENROUTER_AGENT_FALLBACKS`. Adding $10 of credit unlocks 1,000/day.
- The CSV ingester accepts varied column names (`date`/`transaction date`,
  `merchant`/`description`/`payee`, etc.) and dedupes on
  `(user, date, amount, merchant)` — re-uploading the same file is a no-op.
- Negative amounts = spending, positive = income.
