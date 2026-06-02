"""Pre-computed insights served straight from the rollups/aggregations.
No LLM in the hot path for dashboard charts.
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models.db import get_db
from ..services.tools import (
    query_spending, detect_recurring, detect_anomalies, get_budget_status
)

bp = Blueprint("insights", __name__)


@bp.get("/summary")
@jwt_required()
def summary():
    user_id = get_jwt_identity()
    db = get_db()
    rollups = list(
        db.monthly_rollups.find({"user_id": user_id})
        .sort([("year", -1), ("month", -1)]).limit(12)
    )
    return jsonify({
        "by_month": [
            {"year": r["year"], "month": r["month"],
             "total": r["total"], "by_category": r["by_category"]}
            for r in rollups
        ],
        "by_category": query_spending(user_id, group_by="category")["results"],
        "budgets": get_budget_status(user_id)["results"],
    })


@bp.get("/recurring")
@jwt_required()
def recurring():
    return jsonify(detect_recurring(get_jwt_identity()))


@bp.get("/anomalies")
@jwt_required()
def anomalies():
    return jsonify(detect_anomalies(get_jwt_identity()))
