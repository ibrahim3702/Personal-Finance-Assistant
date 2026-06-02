"""CSV transaction ingest with normalization, dedupe, and rule-based categorization."""
import csv
import hashlib
import io
from datetime import datetime
from typing import Iterable

from dateutil import parser as dateparser
from pymongo.errors import BulkWriteError

from ..models.db import get_db
from .categorize import categorize, normalize_merchant


# Column name candidates we accept from messy CSVs
DATE_KEYS = ["date", "transaction date", "posted date", "trans date"]
AMOUNT_KEYS = ["amount", "value", "debit", "credit"]
MERCHANT_KEYS = ["merchant", "description", "name", "payee", "details"]
CATEGORY_KEYS = ["category", "type"]


def _pick(row: dict, keys) -> str:
    lowered = {k.lower().strip(): v for k, v in row.items() if k}
    for k in keys:
        if k in lowered and lowered[k] not in (None, ""):
            return str(lowered[k]).strip()
    return ""


def _parse_amount(raw: str) -> float | None:
    if not raw:
        return None
    s = raw.replace("$", "").replace(",", "").strip()
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg = True
        s = s[1:-1]
    try:
        v = float(s)
        return -v if neg else v
    except ValueError:
        return None


def _dedupe_hash(user_id: str, date_iso: str, amount: float, merchant: str) -> str:
    key = f"{user_id}|{date_iso}|{amount:.2f}|{merchant.lower()}"
    return hashlib.sha256(key.encode()).hexdigest()


def parse_csv(file_stream, user_id: str) -> tuple[list[dict], list[dict]]:
    """Return (valid_docs, rejected_rows)."""
    text = file_stream.read()
    if isinstance(text, bytes):
        text = text.decode("utf-8-sig", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    valid, rejected = [], []

    for i, row in enumerate(reader, start=2):  # row 1 is header
        date_raw = _pick(row, DATE_KEYS)
        amount_raw = _pick(row, AMOUNT_KEYS)
        merchant_raw = _pick(row, MERCHANT_KEYS)
        cat_raw = _pick(row, CATEGORY_KEYS)

        if not date_raw or not amount_raw or not merchant_raw:
            rejected.append({"row": i, "reason": "missing required field", "raw": row})
            continue
        try:
            date = dateparser.parse(date_raw)
        except (ValueError, TypeError):
            rejected.append({"row": i, "reason": "bad date", "raw": row})
            continue
        amount = _parse_amount(amount_raw)
        if amount is None:
            rejected.append({"row": i, "reason": "bad amount", "raw": row})
            continue

        merchant = normalize_merchant(merchant_raw)
        category = (cat_raw or "").lower().strip() or categorize(merchant, merchant_raw)
        date_iso = date.replace(microsecond=0).isoformat()

        doc = {
            "user_id": user_id,
            "date": date,
            "amount": round(amount, 2),
            "merchant": merchant,
            "raw_description": merchant_raw,
            "category": category,
            "source": "csv",
            "dedupe_hash": _dedupe_hash(user_id, date_iso, amount, merchant),
            "created_at": datetime.utcnow(),
        }
        valid.append(doc)

    return valid, rejected


def insert_transactions(docs: Iterable[dict]) -> tuple[int, int]:
    """Insert with unique dedupe_hash; returns (inserted, duplicates)."""
    docs = list(docs)
    if not docs:
        return 0, 0
    db = get_db()
    try:
        result = db.transactions.insert_many(docs, ordered=False)
        return len(result.inserted_ids), 0
    except BulkWriteError as e:
        inserted = e.details.get("nInserted", 0)
        dupes = sum(1 for err in e.details.get("writeErrors", []) if err.get("code") == 11000)
        return inserted, dupes


def rebuild_rollups(user_id: str) -> int:
    """Recompute monthly rollups for a user. Called after ingest."""
    db = get_db()
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": {
                "year": {"$year": "$date"},
                "month": {"$month": "$date"},
                "category": "$category",
            },
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
    ]
    rows = list(db.transactions.aggregate(pipeline))

    # Reshape into {user, year, month, by_category: {...}, total}
    buckets: dict[tuple[int, int], dict] = {}
    for r in rows:
        y, m, cat = r["_id"]["year"], r["_id"]["month"], r["_id"]["category"]
        key = (y, m)
        b = buckets.setdefault(key, {"by_category": {}, "total": 0.0, "count": 0})
        b["by_category"][cat] = round(r["total"], 2)
        b["total"] += r["total"]
        b["count"] += r["count"]

    db.monthly_rollups.delete_many({"user_id": user_id})
    if buckets:
        db.monthly_rollups.insert_many([
            {
                "user_id": user_id,
                "year": y,
                "month": m,
                "by_category": v["by_category"],
                "total": round(v["total"], 2),
                "count": v["count"],
                "updated_at": datetime.utcnow(),
            }
            for (y, m), v in buckets.items()
        ])
    return len(buckets)
