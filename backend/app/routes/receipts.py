from datetime import datetime
from dateutil import parser as dateparser
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models.db import get_db
from ..services.vision import extract_receipt
from ..services.categorize import categorize, normalize_merchant
from ..services.ingest import rebuild_rollups

bp = Blueprint("receipts", __name__)


@bp.post("/extract")
@jwt_required()
def extract():
    """Extract fields only. Frontend lets the user confirm before committing."""
    if "file" not in request.files:
        return jsonify(error="file required"), 400
    image_bytes = request.files["file"].read()
    try:
        data = extract_receipt(image_bytes)
    except Exception as e:
        return jsonify(error=f"vision failed: {e}"), 500
    return jsonify(extracted=data)


@bp.post("/commit")
@jwt_required()
def commit():
    """After user confirms the extracted fields, insert as a transaction."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    try:
        merchant = normalize_merchant(data["merchant"])
        total = float(data["total"])
        date = dateparser.parse(data["date"]) if data.get("date") else datetime.utcnow()
    except (KeyError, ValueError, TypeError):
        return jsonify(error="merchant, total required"), 400
    category = (data.get("category") or categorize(merchant)).lower()
    db = get_db()
    doc = {
        "user_id": user_id,
        "date": date,
        "amount": -abs(round(total, 2)),  # receipts are spending
        "merchant": merchant,
        "raw_description": data.get("merchant"),
        "category": category,
        "source": "receipt",
        "dedupe_hash": f"receipt-{user_id}-{datetime.utcnow().timestamp()}",
        "created_at": datetime.utcnow(),
    }
    result = db.transactions.insert_one(doc)
    rebuild_rollups(user_id)
    return jsonify(id=str(result.inserted_id), category=category), 201
