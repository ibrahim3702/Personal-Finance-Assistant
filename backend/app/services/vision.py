"""Receipt OCR via OpenRouter vision models. Returns strict JSON.

Falls back to confidence=low when the model can't parse cleanly; the API
returns the raw fields it found so the user can correct them in the UI rather
than us silently inserting bad data.
"""
import base64
import io
import json
import re

import requests
from PIL import Image
from flask import current_app


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

PROMPT = """Extract structured data from this receipt image. Return STRICT JSON only,
no prose, no markdown fences. Schema:
{
  "merchant": string,        // store/restaurant name
  "date": string,            // ISO date YYYY-MM-DD if visible, else ""
  "total": number,           // grand total as positive number
  "currency": string,        // 3-letter code if visible, else "USD"
  "items": [{"name": string, "amount": number}],
  "confidence": "high" | "medium" | "low"  // your own self-assessment
}
If any field is unclear or missing, leave it empty/zero and lower the confidence.
Never invent values."""


def _normalize_to_jpeg_data_url(image_bytes: bytes) -> str:
    """Re-encode any PIL-readable image to a JPEG data URL."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    # Cap dimensions to keep tokens (and cost) reasonable
    img.thumbnail((1600, 1600))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def extract_receipt(image_bytes: bytes) -> dict:
    api_key = current_app.config.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not configured")

    model = current_app.config.get("OPENROUTER_VISION_MODEL")
    data_url = _normalize_to_jpeg_data_url(image_bytes)

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "temperature": 0,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        # Optional but recommended by OpenRouter for free-tier routing
        "HTTP-Referer": "https://finance-assistant.local",
        "X-Title": "Finance Assistant",
    }

    resp = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=60)
    if resp.status_code != 200:
        # Surface the upstream error verbatim so the UI shows something useful
        try:
            err = resp.json().get("error", {}).get("message") or resp.text
        except Exception:
            err = resp.text
        raise RuntimeError(f"openrouter {resp.status_code}: {err[:400]}")

    body = resp.json()
    text = ""
    try:
        text = body["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        text = ""
    text = text.strip()
    # Strip accidental code fences
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Some models wrap JSON in prose — grab the first {...} blob.
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group(0))
            except json.JSONDecodeError:
                return {"confidence": "low", "error": "model returned non-JSON",
                        "raw": text[:500]}
        else:
            return {"confidence": "low", "error": "model returned non-JSON",
                    "raw": text[:500]}

    data.setdefault("confidence", "low")
    data.setdefault("merchant", "")
    data.setdefault("total", 0)
    data.setdefault("date", "")
    data.setdefault("currency", "USD")
    data.setdefault("items", [])
    return data
