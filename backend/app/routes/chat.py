from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models.db import get_db
from ..services.agent import run_agent

bp = Blueprint("chat", __name__)


@bp.post("")
@jwt_required()
def chat():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify(error="message required"), 400

    db = get_db()

    # Load short recent history (last 10 messages)
    history_docs = list(
        db.chat_messages.find({"user_id": user_id})
        .sort("created_at", -1).limit(10)
    )
    history = [{"role": d["role"], "content": d["content"]}
               for d in reversed(history_docs)]

    db.chat_messages.insert_one({
        "user_id": user_id, "role": "user",
        "content": message, "created_at": datetime.utcnow(),
    })

    try:
        result = run_agent(user_id, message, history=history)
    except Exception as e:
        return jsonify(error=f"agent failed: {e}"), 500

    db.chat_messages.insert_one({
        "user_id": user_id, "role": "assistant",
        "content": result["reply"], "tool_trace": result["tool_trace"],
        "created_at": datetime.utcnow(),
    })

    return jsonify(reply=result["reply"], tool_trace=result["tool_trace"])


@bp.get("/history")
@jwt_required()
def history():
    user_id = get_jwt_identity()
    db = get_db()
    msgs = list(db.chat_messages.find({"user_id": user_id})
                .sort("created_at", -1).limit(50))
    return jsonify(messages=[
        {"role": m["role"], "content": m["content"],
         "created_at": m["created_at"].isoformat()}
        for m in reversed(msgs)
    ])
