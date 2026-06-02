from datetime import datetime, timezone
import bcrypt
from bson import ObjectId
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from ..models.db import get_db

bp = Blueprint("auth", __name__)


def _user_public(user):
    return {"id": str(user["_id"]), "email": user["email"]}


@bp.post("/signup")
def signup():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or len(password) < 6:
        return jsonify(error="email and password (>=6 chars) required"), 400

    db = get_db()
    if db.users.find_one({"email": email}):
        return jsonify(error="email already registered"), 409

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    result = db.users.insert_one(
        {"email": email, "password_hash": pw_hash, "created_at": datetime.now(timezone.utc)}
    )
    user_id = str(result.inserted_id)
    token = create_access_token(identity=user_id)
    return jsonify(access_token=token, user={"id": user_id, "email": email}), 201


@bp.post("/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    db = get_db()
    user = db.users.find_one({"email": email})
    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return jsonify(error="invalid credentials"), 401

    token = create_access_token(identity=str(user["_id"]))
    return jsonify(access_token=token, user=_user_public(user))


@bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()
    db = get_db()
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify(error="not found"), 404
    return jsonify(user=_user_public(user))
