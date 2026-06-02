from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models.db import get_db
from ..services.tools import get_budget_status

bp = Blueprint("budgets", __name__)


@bp.get("")
@jwt_required()
def list_budgets():
    user_id = get_jwt_identity()
    return jsonify(get_budget_status(user_id))


@bp.put("")
@jwt_required()
def upsert_budget():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    category = (data.get("category") or "").lower().strip()
    try:
        amount = float(data["amount"])
    except (KeyError, ValueError, TypeError):
        return jsonify(error="amount required"), 400
    if not category:
        return jsonify(error="category required"), 400
    db = get_db()
    db.budgets.update_one(
        {"user_id": user_id, "category": category},
        {"$set": {"amount": amount, "period": "monthly"}},
        upsert=True,
    )
    return jsonify(ok=True)


@bp.delete("/<category>")
@jwt_required()
def delete_budget(category):
    user_id = get_jwt_identity()
    db = get_db()
    db.budgets.delete_one({"user_id": user_id, "category": category.lower()})
    return jsonify(ok=True)
