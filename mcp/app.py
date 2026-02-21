import json
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
from config import FLASK_PORT, FLASK_DEBUG, MCP_SECRET_KEY
from agent import MCPAgent

# ── App Setup ──────────────────────────────────────────────
app = Flask(__name__)

CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",   # Next.js dev
            "http://localhost:3001",   # Next.js alt port
            "https://*.vercel.app",    # Production (update with your domain)
        ],
        "methods":  ["GET", "POST", "OPTIONS"],
        "headers":  ["Content-Type", "Authorization", "X-MCP-Key"],
    }
})

# ── Initialize Agent (once at startup) ────────────────────
print("\n🚀 Starting MCP Server...")
agent = MCPAgent()
print("✅ MCP Server ready!\n")


# ──────────────────────────────────────────────────────────
# MIDDLEWARE: Verify admin secret key
# ──────────────────────────────────────────────────────────

def verify_request(req) -> tuple[bool, str]:
    """
    Verify that the request comes from the admin Next.js frontend.
    Checks X-MCP-Key header.
    """
    mcp_key = req.headers.get("X-MCP-Key")

    if not mcp_key:
        return False, "Missing X-MCP-Key header"

    if mcp_key != MCP_SECRET_KEY:
        return False, "Invalid MCP key"

    return True, "OK"


# ──────────────────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Health check — used by Next.js to verify Flask is running."""
    return jsonify({
        "status":  "ok",
        "service": "MCP Admin AI",
        "model":   agent.model,
    }), 200


@app.route("/chat", methods=["POST"])
def chat():
    """
    Main chat endpoint.

    Request Body:
    {
        "message":  "Was teacher TCH2026001 biased?",
        "history":  [  // optional - previous messages
            {"role": "user",      "content": "..."},
            {"role": "assistant", "content": "..."}
        ]
    }

    Response:
    {
        "success":      true,
        "answer":       "...",
        "tools_used":   ["get_audit_logs", ...],
        "iterations":   3,
        "debug": {
            "tool_results": [...]   // only in debug mode
        }
    }
    """
    # ── Auth check ─────────────────────────────────────────
    valid, msg = verify_request(request)
    if not valid:
        return jsonify({
            "success": False,
            "error":   f"Unauthorized: {msg}",
        }), 401

    # ── Parse body ─────────────────────────────────────────
    try:
        body = request.get_json(force=True)
    except Exception:
        return jsonify({
            "success": False,
            "error":   "Invalid JSON body",
        }), 400

    if not body:
        return jsonify({
            "success": False,
            "error":   "Empty request body",
        }), 400

    user_message = body.get("message", "").strip()
    history      = body.get("history", [])

    if not user_message:
        return jsonify({
            "success": False,
            "error":   "Message is required",
        }), 400

    if len(user_message) > 2000:
        return jsonify({
            "success": False,
            "error":   "Message too long (max 2000 characters)",
        }), 400

    # ── Validate history format ─────────────────────────────
    if not isinstance(history, list):
        history = []

    # Keep last 10 messages only
    history = history[-10:]

    print(f"\n📨 Chat request:")
    print(f"   Message  : {user_message[:100]}...")
    print(f"   History  : {len(history)} previous messages")

    # ── Run agent ──────────────────────────────────────────
    try:
        result = agent.chat(
            user_message=user_message,
            conversation_history=history,
        )

        print(f"   ✅ Response generated")
        print(f"   Tools used : {result.get('tools_used', [])}")
        print(f"   Iterations : {result.get('iterations', 0)}")

        response = {
            "success":    True,
            "answer":     result["answer"],
            "tools_used": result["tools_used"],
            "iterations": result["iterations"],
        }

        # Include debug info in dev mode
        if FLASK_DEBUG:
            response["debug"] = {
                "tool_results": result.get("tool_results", []),
            }

        return jsonify(response), 200

    except Exception as e:
        print(f"   ❌ Agent error: {e}")
        traceback.print_exc()

        return jsonify({
            "success": False,
            "error":   "Internal server error. Please try again.",
            "detail":  str(e) if FLASK_DEBUG else None,
        }), 500


@app.route("/tools", methods=["GET"])
def list_tools():
    """
    List all available tools.
    Useful for admin to see what the agent can do.
    """
    valid, msg = verify_request(request)
    if not valid:
        return jsonify({"success": False, "error": msg}), 401

    from tools import ALL_TOOLS
    return jsonify({
        "success":     True,
        "total_tools": len(ALL_TOOLS),
        "tools":       list(ALL_TOOLS.keys()),
    }), 200


@app.route("/quick-report/<teacher_id>", methods=["GET"])
def quick_report(teacher_id: str):
    """
    Generate a quick bias report for a teacher
    without requiring a chat message.

    GET /quick-report/TCH2026001
    """
    valid, msg = verify_request(request)
    if not valid:
        return jsonify({"success": False, "error": msg}), 401

    if not teacher_id or len(teacher_id) > 50:
        return jsonify({
            "success": False,
            "error":   "Invalid teacher ID",
        }), 400

    print(f"\n📊 Quick report for: {teacher_id}")

    try:
        result = agent.chat(
            user_message=(
                f"Generate a comprehensive bias analysis report for teacher {teacher_id}. "
                f"Check their audit logs, evaluation metrics, grievances, and compare "
                f"with peers. Give me a final risk assessment."
            ),
        )

        return jsonify({
            "success":    True,
            "teacher_id": teacher_id,
            "report":     result["answer"],
            "tools_used": result["tools_used"],
            "iterations": result["iterations"],
        }), 200

    except Exception as e:
        print(f"   ❌ Report error: {e}")
        return jsonify({
            "success": False,
            "error":   str(e),
        }), 500


@app.route("/analyze-submission/<submission_id>", methods=["GET"])
def analyze_submission(submission_id: str):
    """
    Analyze a specific submission's evaluation quality.

    GET /analyze-submission/0X034...
    """
    valid, msg = verify_request(request)
    if not valid:
        return jsonify({"success": False, "error": msg}), 401

    print(f"\n🔍 Analyzing submission: {submission_id}")

    try:
        result = agent.chat(
            user_message=(
                f"Analyze submission {submission_id}. "
                f"Check the evaluation marks, teacher's audit logs for this submission, "
                f"any grievances filed, and whether the evaluation was fair. "
                f"Check timing, marks given per question, and any reevaluation outcomes."
            ),
        )

        return jsonify({
            "success":       True,
            "submission_id": submission_id,
            "analysis":      result["answer"],
            "tools_used":    result["tools_used"],
            "iterations":    result["iterations"],
        }), 200

    except Exception as e:
        print(f"   ❌ Analysis error: {e}")
        return jsonify({
            "success": False,
            "error":   str(e),
        }), 500


# ──────────────────────────────────────────────────────────
# ERROR HANDLERS
# ──────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "success": False,
        "error":   "Endpoint not found",
        "available_endpoints": [
            "GET  /health",
            "POST /chat",
            "GET  /tools",
            "GET  /quick-report/<teacher_id>",
            "GET  /analyze-submission/<submission_id>",
        ],
    }), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({
        "success": False,
        "error":   "Method not allowed",
    }), 405


@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        "success": False,
        "error":   "Internal server error",
    }), 500


# ──────────────────────────────────────────────────────────
# STARTUP
# ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\n{'='*50}")
    print(f"  MCP Admin AI Server")
    print(f"  Port  : {FLASK_PORT}")
    print(f"  Debug : {FLASK_DEBUG}")
    print(f"  Model : {agent.model}")
    print(f"{'='*50}\n")

    app.run(
        host="0.0.0.0",
        port=FLASK_PORT,
        debug=FLASK_DEBUG,
    )
