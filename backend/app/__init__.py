from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from .config import Config
from .models.db import init_indexes


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
         supports_credentials=True)
    JWTManager(app)

    init_indexes(app)

    from .routes.auth import bp as auth_bp
    from .routes.transactions import bp as tx_bp
    from .routes.chat import bp as chat_bp
    from .routes.receipts import bp as receipts_bp
    from .routes.budgets import bp as budgets_bp
    from .routes.insights import bp as insights_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(tx_bp, url_prefix="/api/transactions")
    app.register_blueprint(chat_bp, url_prefix="/api/chat")
    app.register_blueprint(receipts_bp, url_prefix="/api/receipts")
    app.register_blueprint(budgets_bp, url_prefix="/api/budgets")
    app.register_blueprint(insights_bp, url_prefix="/api/insights")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    return app
