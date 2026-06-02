"""OpenRouter-powered agent with OpenAI-style function calling.

Strategy:
- Tools return aggregates (never raw transactions) so prompts stay cheap.
- Multi-step tool loop, capped at max_steps.
- Saved user memories are injected into the system prompt every turn.
"""
import json
from datetime import datetime
from typing import Any

import requests
from flask import current_app

from . import tools


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


# ---------------- Tool schemas (OpenAI function-calling format) ----------------

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_spending",
            "description": "Total spending in a category/timeframe. Optionally group by category or month.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "category name e.g. groceries, dining"},
                    "start": {"type": "string", "description": "ISO date, inclusive"},
                    "end": {"type": "string", "description": "ISO date, inclusive"},
                    "group_by": {"type": "string", "enum": ["category", "month"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "top_transactions",
            "description": "Largest expenses in a window, optionally filtered by category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start": {"type": "string"},
                    "end": {"type": "string"},
                    "n": {"type": "integer"},
                    "category": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_periods",
            "description": "Compare total spending between two date ranges.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period_a_start": {"type": "string"},
                    "period_a_end": {"type": "string"},
                    "period_b_start": {"type": "string"},
                    "period_b_end": {"type": "string"},
                },
                "required": ["period_a_start", "period_a_end", "period_b_start", "period_b_end"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detect_recurring",
            "description": "Find recurring/subscription charges (monthly/weekly/yearly).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detect_anomalies",
            "description": "Flag unusually large recent transactions vs. category average.",
            "parameters": {
                "type": "object",
                "properties": {"window_days": {"type": "integer"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_budget_status",
            "description": "Current-month progress against the user's budgets.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Save a durable user preference or rule (e.g. 'paid on the 1st').",
            "parameters": {
                "type": "object",
                "properties": {"fact": {"type": "string"}},
                "required": ["fact"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_merchant",
            "description": "Look up an unfamiliar merchant on the web.",
            "parameters": {
                "type": "object",
                "properties": {"merchant": {"type": "string"}},
                "required": ["merchant"],
            },
        },
    },
]


def _dispatch(name: str, args: dict, user_id: str) -> Any:
    fn_map = {
        "query_spending": lambda: tools.query_spending(user_id, **args),
        "top_transactions": lambda: tools.top_transactions(user_id, **args),
        "compare_periods": lambda: tools.compare_periods(user_id, **args),
        "detect_recurring": lambda: tools.detect_recurring(user_id, **args),
        "detect_anomalies": lambda: tools.detect_anomalies(user_id, **args),
        "get_budget_status": lambda: tools.get_budget_status(user_id),
        "save_memory": lambda: tools.save_memory(user_id, **args),
        "lookup_merchant": lambda: tools.lookup_merchant(**args),
    }
    if name not in fn_map:
        return {"error": f"unknown tool: {name}"}
    try:
        return fn_map[name]()
    except TypeError as e:
        return {"error": f"bad arguments to {name}: {e}"}
    except Exception as e:
        return {"error": str(e)[:200]}


# ---------------- System prompt ----------------

def _build_system_prompt(user_id: str) -> str:
    today = datetime.utcnow().date().isoformat()
    memories = tools.get_memories(user_id)["results"]
    mem_block = "\n".join(f"- {m}" for m in memories) if memories else "(none)"
    return f"""You are a personal finance assistant. Today is {today}.

You have tools to query the user's transaction database. ALWAYS use a tool for
any question that involves numbers, dates, categories, or comparisons — never
guess or make up amounts. Tools return JSON with exact figures.

Style:
- Be concise. Lead with the number, then 1-2 lines of context.
- Use the user's currency symbol implicitly (assume USD unless context says otherwise).
- If a tool returns an error or empty result, say so plainly — do not fabricate data.
- If the question is ambiguous (e.g. unclear timeframe), ask ONE clarifying question
  instead of guessing.
- If the user states a durable preference ("I get paid on the 1st", "exclude rent
  from food budget"), call save_memory to persist it.

User context to apply on every answer:
{mem_block}
"""


# ---------------- OpenRouter call ----------------

def _model_chain() -> list[str]:
    primary = current_app.config.get("OPENROUTER_AGENT_MODEL") or ""
    fallbacks = current_app.config.get("OPENROUTER_AGENT_FALLBACKS") or ""
    chain = [primary] + [m.strip() for m in fallbacks.split(",") if m.strip()]
    # Dedupe while preserving order
    seen, out = set(), []
    for m in chain:
        if m and m not in seen:
            out.append(m); seen.add(m)
    return out


def _post(model: str, messages: list[dict], use_tools: bool) -> requests.Response:
    api_key = current_app.config.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not configured")
    payload: dict = {"model": model, "messages": messages, "temperature": 0.2}
    if use_tools:
        payload["tools"] = TOOLS
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://finance-assistant.local",
        "X-Title": "Finance Assistant",
    }
    return requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=90)


def _call_openrouter(messages: list[dict], use_tools: bool = True) -> dict:
    """Try the configured model, fall back through the chain on 429/5xx."""
    last_err = "no providers tried"
    for model in _model_chain():
        resp = _post(model, messages, use_tools)
        if resp.status_code == 200:
            return resp.json()
        # Retryable: rate limit or transient server error
        if resp.status_code == 429 or 500 <= resp.status_code < 600:
            try:
                last_err = resp.json().get("error", {}).get("message") or resp.text
            except Exception:
                last_err = resp.text
            continue
        # Non-retryable: surface immediately
        try:
            err = resp.json().get("error", {}).get("message") or resp.text
        except Exception:
            err = resp.text
        raise RuntimeError(f"openrouter {resp.status_code} ({model}): {err[:400]}")
    raise RuntimeError(f"all providers rate-limited or failed. last error: {last_err[:300]}")


# ---------------- Public entry point ----------------

def run_agent(user_id: str, user_message: str, history: list[dict] | None = None,
              max_steps: int = 5) -> dict:
    """Run a tool-using conversation turn. Returns {reply, tool_trace}."""
    messages: list[dict] = [
        {"role": "system", "content": _build_system_prompt(user_id)},
    ]
    for h in (history or [])[-10:]:
        role = "user" if h["role"] == "user" else "assistant"
        messages.append({"role": role, "content": h["content"]})
    messages.append({"role": "user", "content": user_message})

    trace = []

    for _ in range(max_steps):
        body = _call_openrouter(messages)
        try:
            msg = body["choices"][0]["message"]
        except (KeyError, IndexError, TypeError):
            return {"reply": "The assistant returned no response.", "tool_trace": trace}

        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            reply = (msg.get("content") or "").strip()
            if not reply:
                reply = "I wasn't able to find an answer for that. Could you rephrase or narrow the timeframe?"
            return {"reply": reply, "tool_trace": trace}

        # Record the assistant's tool-call message verbatim so the next turn has context.
        messages.append({
            "role": "assistant",
            "content": msg.get("content") or "",
            "tool_calls": tool_calls,
        })

        for tc in tool_calls:
            fn = tc.get("function", {}) or {}
            name = fn.get("name", "")
            raw_args = fn.get("arguments", "{}")
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
            except json.JSONDecodeError:
                args = {}

            result = _dispatch(name, args, user_id)
            trace.append({"tool": name, "args": args, "result_preview": _preview(result)})

            messages.append({
                "role": "tool",
                "tool_call_id": tc.get("id", ""),
                "name": name,
                "content": json.dumps(result, default=str),
            })

    # Hit step cap — ask for a final answer with tools disabled.
    final = _call_openrouter(messages, use_tools=False)
    try:
        reply = (final["choices"][0]["message"].get("content") or "").strip()
    except (KeyError, IndexError, TypeError):
        reply = ""
    if not reply:
        reply = "I ran out of steps before finishing. Try a narrower question."
    return {"reply": reply, "tool_trace": trace}


def _preview(result):
    try:
        s = json.dumps(result, default=str)
        return s[:400]
    except Exception:
        return str(result)[:400]
