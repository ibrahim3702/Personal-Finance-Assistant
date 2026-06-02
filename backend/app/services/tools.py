"""Deterministic tools the agent can call. Each one returns plain JSON-able dicts.

These tools do the *math* against MongoDB. The LLM is only responsible for
choosing which tool to call and turning the result into natural language.
"""
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

from dateutil import parser as dateparser
import requests
from flask import current_app

from ..models.db import get_db


def _parse_date(s, default=None):
    if not s:
        return default
    try:
        return dateparser.parse(s)
    except (ValueError, TypeError):
        return default


# ----------------- Spending queries -----------------

def query_spending(user_id, category=None, start=None, end=None, group_by=None):
    db = get_db()
    match = {"user_id": user_id, "amount": {"$lt": 0}}  # spending = negative
    if category:
        match["category"] = category.lower()
    start_dt = _parse_date(start)
    end_dt = _parse_date(end)
    if start_dt or end_dt:
        match["date"] = {}
        if start_dt:
            match["date"]["$gte"] = start_dt
        if end_dt:
            match["date"]["$lte"] = end_dt

    if group_by == "category":
        pipeline = [
            {"$match": match},
            {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
            {"$sort": {"total": 1}},
        ]
        rows = list(db.transactions.aggregate(pipeline))
        return {
            "group_by": "category",
            "results": [
                {"category": r["_id"], "spent": round(abs(r["total"]), 2), "count": r["count"]}
                for r in rows
            ],
        }
    if group_by == "month":
        pipeline = [
            {"$match": match},
            {"$group": {
                "_id": {"y": {"$year": "$date"}, "m": {"$month": "$date"}},
                "total": {"$sum": "$amount"},
            }},
            {"$sort": {"_id.y": 1, "_id.m": 1}},
        ]
        rows = list(db.transactions.aggregate(pipeline))
        return {
            "group_by": "month",
            "results": [
                {"year": r["_id"]["y"], "month": r["_id"]["m"], "spent": round(abs(r["total"]), 2)}
                for r in rows
            ],
        }

    agg = list(db.transactions.aggregate([
        {"$match": match},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]))
    total = abs(agg[0]["total"]) if agg else 0
    count = agg[0]["count"] if agg else 0
    return {
        "category": category,
        "start": start, "end": end,
        "spent": round(total, 2),
        "transaction_count": count,
    }


def top_transactions(user_id, start=None, end=None, n=10, category=None):
    db = get_db()
    match = {"user_id": user_id, "amount": {"$lt": 0}}
    if category:
        match["category"] = category.lower()
    start_dt, end_dt = _parse_date(start), _parse_date(end)
    if start_dt or end_dt:
        match["date"] = {}
        if start_dt: match["date"]["$gte"] = start_dt
        if end_dt: match["date"]["$lte"] = end_dt
    n = min(int(n or 10), 25)
    rows = list(db.transactions.find(match).sort("amount", 1).limit(n))
    return {"results": [
        {"date": r["date"].date().isoformat(), "merchant": r["merchant"],
         "amount": round(abs(r["amount"]), 2), "category": r.get("category")}
        for r in rows
    ]}


def compare_periods(user_id, period_a_start, period_a_end, period_b_start, period_b_end):
    a = query_spending(user_id, start=period_a_start, end=period_a_end)
    b = query_spending(user_id, start=period_b_start, end=period_b_end)
    delta = round(a["spent"] - b["spent"], 2)
    pct = round((delta / b["spent"]) * 100, 1) if b["spent"] else None
    return {"period_a": a, "period_b": b, "delta": delta, "pct_change": pct}


def detect_recurring(user_id, min_occurrences=3, tolerance=0.15):
    """Group by merchant; flag those with >=N similar-amount monthly hits."""
    db = get_db()
    cursor = db.transactions.find(
        {"user_id": user_id, "amount": {"$lt": 0}}
    ).sort("date", 1)

    by_merchant = defaultdict(list)
    for tx in cursor:
        by_merchant[tx["merchant"]].append(tx)

    recurring = []
    for merchant, txs in by_merchant.items():
        if len(txs) < min_occurrences:
            continue
        amounts = [abs(t["amount"]) for t in txs]
        avg = statistics.mean(amounts)
        if avg == 0:
            continue
        spread = max(amounts) - min(amounts)
        if spread / avg > tolerance:
            continue
        # check ~monthly cadence
        dates = sorted(t["date"] for t in txs)
        gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        if not gaps:
            continue
        median_gap = statistics.median(gaps)
        if 25 <= median_gap <= 35:
            cadence = "monthly"
        elif 6 <= median_gap <= 8:
            cadence = "weekly"
        elif 350 <= median_gap <= 380:
            cadence = "yearly"
        else:
            continue
        recurring.append({
            "merchant": merchant,
            "avg_amount": round(avg, 2),
            "cadence": cadence,
            "occurrences": len(txs),
            "last_charge": dates[-1].date().isoformat(),
        })
    recurring.sort(key=lambda r: r["avg_amount"], reverse=True)
    return {"results": recurring[:20]}


def detect_anomalies(user_id, window_days=90, z_threshold=2.5):
    """Flag transactions whose amount is unusual for their category."""
    db = get_db()
    since = datetime.utcnow() - timedelta(days=window_days)
    cursor = db.transactions.find(
        {"user_id": user_id, "amount": {"$lt": 0}, "date": {"$gte": since}}
    )
    by_cat = defaultdict(list)
    for tx in cursor:
        by_cat[tx.get("category", "uncategorized")].append(tx)

    anomalies = []
    for cat, txs in by_cat.items():
        if len(txs) < 5:
            continue
        amounts = [abs(t["amount"]) for t in txs]
        mean = statistics.mean(amounts)
        stdev = statistics.pstdev(amounts) or 1
        for t in txs:
            z = (abs(t["amount"]) - mean) / stdev
            if z >= z_threshold:
                anomalies.append({
                    "date": t["date"].date().isoformat(),
                    "merchant": t["merchant"],
                    "amount": round(abs(t["amount"]), 2),
                    "category": cat,
                    "category_avg": round(mean, 2),
                    "z_score": round(z, 2),
                })
    anomalies.sort(key=lambda a: a["z_score"], reverse=True)
    return {"results": anomalies[:15]}


def get_budget_status(user_id):
    db = get_db()
    budgets = list(db.budgets.find({"user_id": user_id}))
    if not budgets:
        return {"results": [], "note": "no budgets set"}
    now = datetime.utcnow()
    start_month = datetime(now.year, now.month, 1)
    results = []
    for b in budgets:
        agg = list(db.transactions.aggregate([
            {"$match": {
                "user_id": user_id,
                "category": b["category"],
                "amount": {"$lt": 0},
                "date": {"$gte": start_month},
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]))
        spent = abs(agg[0]["total"]) if agg else 0
        pct = round((spent / b["amount"]) * 100, 1) if b["amount"] else 0
        results.append({
            "category": b["category"],
            "limit": b["amount"],
            "spent": round(spent, 2),
            "pct_used": pct,
            "status": "over" if pct >= 100 else "warning" if pct >= 80 else "ok",
        })
    return {"results": results, "month": start_month.date().isoformat()}


# ----------------- Memory -----------------

def save_memory(user_id, fact):
    db = get_db()
    db.memories.insert_one({"user_id": user_id, "fact": fact, "created_at": datetime.utcnow()})
    return {"saved": True, "fact": fact}


def get_memories(user_id):
    db = get_db()
    rows = list(db.memories.find({"user_id": user_id}).sort("created_at", -1).limit(50))
    return {"results": [r["fact"] for r in rows]}


# ----------------- External web lookup -----------------

def lookup_merchant(merchant):
    api_key = current_app.config.get("TAVILY_API_KEY")
    if not api_key:
        return {"merchant": merchant, "info": "web lookup unavailable (no api key)"}
    try:
        r = requests.post(
            "https://api.tavily.com/search",
            json={"api_key": api_key, "query": f"what is the merchant {merchant}",
                  "max_results": 3, "search_depth": "basic"},
            timeout=8,
        )
        r.raise_for_status()
        data = r.json()
        snippets = [{"title": x.get("title"), "content": x.get("content")[:240]}
                    for x in data.get("results", [])[:3]]
        return {"merchant": merchant, "snippets": snippets, "summary": data.get("answer")}
    except Exception as e:
        return {"merchant": merchant, "error": str(e)[:120]}
