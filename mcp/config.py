import os
from dotenv import load_dotenv

load_dotenv()

# ── MongoDB ────────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = "test"

# Collection names (must match your MongoDB exactly)
COLLECTIONS = {
    "audit_logs":           "audit_logs",
    "evaluations":          "evaluations",
    "submissions":          "submissions",
    "users":                "users",
    "tests":                "tests",
    "grievances":           "grievances",
    "reevaluations":        "reevaluations",
    "evaluation_metrics":   "evaluationmetrics",
}

# ── Groq ───────────────────────────────────────────────────
GROQ_API_KEY        = os.getenv("GROQ_API_KEY")
PRIMARY_MODEL       = os.getenv("GROQ_PRIMARY_MODEL",  "llama-3.3-70b-versatile")
FALLBACK_MODEL      = os.getenv("GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant")
MAX_TOOL_ITERATIONS = int(os.getenv("MAX_TOOL_ITERATIONS", 8))

# ── Flask ──────────────────────────────────────────────────
FLASK_PORT      = int(os.getenv("FLASK_PORT", 5000))
FLASK_DEBUG     = os.getenv("FLASK_DEBUG", "False").lower() == "true"
MCP_SECRET_KEY  = os.getenv("MCP_SECRET_KEY", "mcp_admin_secret_2026")

# ── Validation ─────────────────────────────────────────────
def validate_config():
    missing = []
    if not MONGODB_URI:
        missing.append("MONGODB_URI")
    if not GROQ_API_KEY:
        missing.append("GROQ_API_KEY")
    if missing:
        raise EnvironmentError(
            f"❌ Missing required environment variables: {', '.join(missing)}\n"
            f"   Please check your mcp/.env file."
        )

validate_config()
print("✅ Config loaded successfully")
print(f"   DB       : {DB_NAME}")
print(f"   Model    : {PRIMARY_MODEL}")
print(f"   Max Iter : {MAX_TOOL_ITERATIONS}")
