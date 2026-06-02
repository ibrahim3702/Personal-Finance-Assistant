from pymongo import MongoClient, ASCENDING, DESCENDING
from flask import current_app, g


def get_client() -> MongoClient:
    if "mongo_client" not in g:
        g.mongo_client = MongoClient(current_app.config["MONGO_URI"])
    return g.mongo_client


def get_db():
    return get_client()[current_app.config["MONGO_DB"]]


def init_indexes(app):
    """Create indexes once at startup."""
    client = MongoClient(app.config["MONGO_URI"])
    db = client[app.config["MONGO_DB"]]

    db.users.create_index("email", unique=True)

    db.transactions.create_index([("user_id", ASCENDING), ("date", DESCENDING)])
    db.transactions.create_index([("user_id", ASCENDING), ("category", ASCENDING)])
    db.transactions.create_index([("user_id", ASCENDING), ("merchant", ASCENDING)])
    db.transactions.create_index(
        [("user_id", ASCENDING), ("dedupe_hash", ASCENDING)], unique=True
    )

    db.chat_messages.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db.memories.create_index([("user_id", ASCENDING)])
    db.budgets.create_index([("user_id", ASCENDING), ("category", ASCENDING)], unique=True)
    db.monthly_rollups.create_index(
        [("user_id", ASCENDING), ("year", ASCENDING), ("month", ASCENDING)], unique=True
    )

    client.close()
