from datetime import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models.db import get_db
from ..services.ingest import parse_csv, insert_transactions, rebuild_rollups
from ..services.categorize import categorize, normalize_merchant

bp = Blueprint("transactions", __name__)


def _serialize(tx):
    return {
        "id": str(tx["_id"]),
        "date": tx["date"].isoformat() if isinstance(tx["date"], datetime) else tx["date"],
        "amount": tx["amount"],
        "merchant": tx["merchant"],
        "category": tx.get("category", "uncategorized"),
        "source": tx.get("source", "csv"),
    }


@bp.post("/upload")
@jwt_required()
def upload_csv():
    user_id = get_jwt_identity()
    if "file" not in request.files:
        return jsonify(error="file is required"), 400
    f = request.files["file"]
    valid, rejected = parse_csv(f.stream, user_id)
    inserted, dupes = insert_transactions(valid)
    rebuild_rollups(user_id)
    return jsonify(
        inserted=inserted,
        duplicates=dupes,
        rejected=len(rejected),
        rejected_sample=rejected[:5],
    )


@bp.get("/categories")
@jwt_required()
def list_categories():
    user_id = get_jwt_identity()
    db = get_db()
    cats = db.transactions.distinct("category", {"user_id": user_id})
    cats = sorted([c for c in cats if c])
    return jsonify(categories=cats)


@bp.get("")
@jwt_required()
def list_transactions():
    user_id = get_jwt_identity()
    db = get_db()
    q = {"user_id": user_id}
    category = request.args.get("category")
    if category:
        q["category"] = category
    limit = min(int(request.args.get("limit", 100)), 500)
    skip = int(request.args.get("skip", 0))

    cursor = db.transactions.find(q).sort("date", -1).skip(skip).limit(limit)
    items = [_serialize(t) for t in cursor]
    total = db.transactions.count_documents(q)
    return jsonify(items=items, total=total)


@bp.post("")
@jwt_required()
def create_transaction():
    """Manual entry, also used by the receipt flow."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    try:
        date = datetime.fromisoformat(data["date"].replace("Z", "+00:00"))
        amount = float(data["amount"])
        merchant = normalize_merchant(data["merchant"])
    except (KeyError, ValueError, TypeError, AttributeError):
        return jsonify(error="date, amount, merchant required"), 400
    category = (data.get("category") or categorize(merchant)).lower()
    db = get_db()
    doc = {
        "user_id": user_id,
        "date": date,
        "amount": round(amount, 2),
        "merchant": merchant,
        "raw_description": data.get("merchant"),
        "category": category,
        "source": data.get("source", "manual"),
        "dedupe_hash": f"manual-{user_id}-{datetime.utcnow().timestamp()}",
        "created_at": datetime.utcnow(),
    }
    result = db.transactions.insert_one(doc)
    rebuild_rollups(user_id)
    doc["_id"] = result.inserted_id
    return jsonify(transaction=_serialize(doc)), 201


@bp.delete("/<tx_id>")
@jwt_required()
def delete_transaction(tx_id):
    user_id = get_jwt_identity()
    db = get_db()
    res = db.transactions.delete_one({"_id": ObjectId(tx_id), "user_id": user_id})
    if res.deleted_count:
        rebuild_rollups(user_id)
    return jsonify(deleted=res.deleted_count)
