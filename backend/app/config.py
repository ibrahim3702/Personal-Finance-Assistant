import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24 * 7  # 7 days

    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB = os.getenv("MONGO_DB", "finance_assistant")

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_VISION_MODEL = os.getenv(
        "OPENROUTER_VISION_MODEL",
        "moonshotai/kimi-k2.6:free",
    )
    OPENROUTER_AGENT_MODEL = os.getenv(
        "OPENROUTER_AGENT_MODEL",
        "moonshotai/kimi-k2.6:free",
    )
    # Comma-separated fallback chain. Tried in order on 429/5xx.
    OPENROUTER_AGENT_FALLBACKS = os.getenv(
        "OPENROUTER_AGENT_FALLBACKS",
        "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    )

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # 8 MB uploads
