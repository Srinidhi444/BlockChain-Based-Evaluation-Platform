import json
import time
from groq import Groq
from config import (
    GROQ_API_KEY,
    PRIMARY_MODEL,
    FALLBACK_MODEL,
    MAX_TOOL_ITERATIONS,
)
from tools import ALL_TOOLS
from agent.prompts import SYSTEM_PROMPT, TOOL_DEFINITIONS


# ── General query patterns ────────────────────────────────────
_GENERAL_PATTERNS = [
    "hi", "hello", "hey", "hii", "helo", "heya",
    "how are you", "what can you do", "who are you",
    "help", "thanks", "thank you", "okay", "ok", "k",
    "bye", "goodbye", "good morning", "good evening",
    "good night", "good afternoon", "what is mcp",
    "what are you", "ping", "test", "yo", "sup",
    "what do you do", "how do you work", "capabilities",
]

_DB_KEYWORDS = [
    "teacher", "tch", "student", "submission", "eval",
    "bias", "grievance", "marks", "test", "audit",
    "report", "compare", "department", "reevaluation",
    "blockchain", "flag", "risk", "score", "question",
    "analyze", "analyse", "investigate", "check", "show",
    "list", "get", "find", "fetch", "was", "is there",
]

# ── Follow-up phrases that reference prior context ────────────
# These look general but are part of an ongoing investigation
_FOLLOWUP_PATTERNS = [
    "next steps", "what next", "what should", "what do you",
    "tell me more", "explain", "elaborate", "go on",
    "continue", "and then", "what about", "more details",
    "summarize", "summary", "conclusion", "verdict",
    "recommendation", "what does this mean", "so what",
    "is that bad", "is that good", "how serious",
    "what does that indicate", "what now",
]


class MCPAgent:
    """
    Multi-step AI agent using Groq LLM with tool calling.
    Handles general queries instantly, follow-ups contextually,
    and DB queries with full tool loop.
    """

    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)
        self.model  = PRIMARY_MODEL
        print(f"✅ MCPAgent initialized with model: {self.model}")

    # ──────────────────────────────────────────────────────────
    # PUBLIC: Main entry point
    # ──────────────────────────────────────────────────────────

    def chat(
        self,
        user_message: str,
        conversation_history: list = None,
    ) -> dict:

        # ── ✅ Fast-path: pure general queries (no history needed)
        if self._is_general_query(user_message, conversation_history or []):
            print(f"   ⚡ General/follow-up query — skipping tools")
            answer = self._answer_general_query(
                user_message,
                conversation_history or [],
            )
            return {
                "answer":       answer,
                "tools_used":   [],
                "iterations":   0,
                "tool_results": [],
            }

        # ── Build message history ─────────────────────────────
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        if conversation_history:
            for msg in conversation_history[-10:]:
                messages.append(msg)

        messages.append({"role": "user", "content": user_message})

        tools_used       = []
        tool_results     = []
        iterations       = 0
        called_tool_sigs = set()

        print(f"\n🤖 Processing: {user_message[:80]}...")

        # ── Multi-step tool calling loop ──────────────────────
        while iterations < MAX_TOOL_ITERATIONS:
            iterations += 1
            print(f"   Iteration {iterations}/{MAX_TOOL_ITERATIONS}")

            try:
                response = self._call_groq(messages)
            except Exception as e:
                print(f"   ⚠️ Primary model failed: {e}. Trying fallback...")
                try:
                    # ✅ Pass trimmed messages to fallback — avoids 413
                    response = self._call_groq(
                        messages,
                        use_fallback=True,
                        trim_for_fallback=True,
                    )
                except Exception as e2:
                    print(f"   ❌ Fallback also failed: {e2}")
                    return {
                        "answer":       f"Both models failed. Last error: {e2}",
                        "tools_used":   tools_used,
                        "iterations":   iterations,
                        "tool_results": tool_results,
                    }

            choice  = response.choices[0]
            message = choice.message

            messages.append({
                "role":       "assistant",
                "content":    message.content or "",
                "tool_calls": [
                    {
                        "id":       tc.id,
                        "type":     tc.type,
                        "function": {
                            "name":      tc.function.name,
                            "arguments": tc.function.arguments,
                        }
                    }
                    for tc in (message.tool_calls or [])
                ] or None,
            })

            # ── No tool calls → final answer ──────────────────
            if not message.tool_calls:
                print(f"   ✅ Final answer after {iterations} iterations")
                print(f"   🔧 Tools used: {tools_used}")
                return {
                    "answer":       message.content,
                    "tools_used":   list(dict.fromkeys(tools_used)),
                    "iterations":   iterations,
                    "tool_results": tool_results,
                }

            # ── Execute each tool call ────────────────────────
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name

                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    args = {}

                # Skip duplicate calls
                sig = f"{tool_name}::{json.dumps(args, sort_keys=True)}"
                if sig in called_tool_sigs:
                    print(f"   ⏭  Skipping duplicate: {tool_name}")
                    messages.append({
                        "role":         "tool",
                        "tool_call_id": tool_call.id,
                        "content":      json.dumps({
                            "success": True,
                            "note":    "Duplicate — result already in context.",
                        }),
                    })
                    continue

                called_tool_sigs.add(sig)
                tools_used.append(tool_name)
                print(f"   🔧 Calling tool: {tool_name}")

                result     = self._execute_tool(tool_name, args)
                result_str = self._truncate_result(
                    json.dumps(result, default=str)
                )

                tool_results.append({
                    "tool":   tool_name,
                    "args":   args,
                    "result": result,
                })

                messages.append({
                    "role":         "tool",
                    "tool_call_id": tool_call.id,
                    "content":      result_str,
                })

        # ── Max iterations — force synthesis ──────────────────
        print(f"   ⚠️  Max iterations ({MAX_TOOL_ITERATIONS}) reached")
        messages.append({
            "role":    "user",
            "content": (
                "You have reached the maximum number of tool calls. "
                "Write the complete bias investigation report now "
                "using only the data already retrieved. No more tools."
            ),
        })

        try:
            final_response = self._call_groq_no_tools(messages)
            final_answer   = final_response.choices[0].message.content
        except Exception:
            final_answer = (
                "Analysis limit reached. Summary:\n\n"
                + self._summarize_tool_results(tool_results)
            )

        return {
            "answer":       final_answer,
            "tools_used":   list(dict.fromkeys(tools_used)),
            "iterations":   iterations,
            "tool_results": tool_results,
        }

    # ──────────────────────────────────────────────────────────
    # GENERAL QUERY HANDLING
    # ──────────────────────────────────────────────────────────

    def _is_general_query(
        self,
        message: str,
        history: list,
    ) -> bool:
        """
        Four-tier classification:

        Tier 1 — Known greeting/smalltalk patterns
        Tier 2 — Short message with no DB keywords
        Tier 3 — Self-referential capability questions
        Tier 4 — Follow-up phrases (e.g. "what are your next steps?")
                 BUT only if history has NO tool results
                 (if tools were used → it's a real investigation follow-up
                  that should go through the tool loop)
        """
        msg_clean = message.lower().strip().rstrip("!?.,:;")

        # Tier 1: exact greeting match
        if msg_clean in _GENERAL_PATTERNS:
            return True
        for pattern in _GENERAL_PATTERNS:
            if msg_clean.startswith(pattern) and len(msg_clean) < len(pattern) + 10:
                return True

        # Tier 2: short + no DB keywords
        words = msg_clean.split()
        if len(words) <= 3:
            if not any(kw in msg_clean for kw in _DB_KEYWORDS):
                return True

        # Tier 3: capability/identity questions
        self_questions = [
            "what can you", "what do you", "who are you",
            "how do you work", "what are your capabilities",
            "tell me about yourself", "how can you help",
        ]
        if any(msg_clean.startswith(q) for q in self_questions):
            return True

        # Tier 4: follow-up phrases
        # ✅ Key fix: only treat as general if history has NO assistant
        # messages that used tools (i.e. no real investigation context)
        is_followup_phrase = any(
            msg_clean.startswith(p) or p in msg_clean
            for p in _FOLLOWUP_PATTERNS
        )
        if is_followup_phrase:
            history_has_tool_use = _history_has_tool_results(history)
            if not history_has_tool_use:
                # No prior investigation — treat as general question
                return True
            else:
                # Prior investigation exists — let LLM answer from context
                # without calling NEW tools
                return True  # ✅ Still no tools — LLM has data in history

        return False

    def _answer_general_query(
        self,
        message: str,
        history: list,
    ) -> str:
        """
        Handle general/follow-up queries.

        Pure greetings → instant hardcoded response (0 API calls)
        Follow-ups with prior investigation context → LLM synthesises
          from history, NO tools attached
        Capability questions → single LLM call, no tools
        """
        msg_clean = message.lower().strip().rstrip("!?.,:;")

        # ── Pure greetings: zero API calls ────────────────────
        pure_greetings = [
            "hi", "hello", "hey", "hii", "helo", "heya",
            "yo", "sup", "bye", "goodbye", "good morning",
            "good evening", "good night", "good afternoon",
            "thanks", "thank you", "ok", "okay", "k", "ping",
        ]
        if any(msg_clean == g or msg_clean.startswith(g + " ") for g in pure_greetings):
            return (
                "Hello! 👋 I'm your **MCP Admin AI** assistant.\n\n"
                "I can help you with:\n"
                "- 🔍 **Bias detection** — *\"Was teacher TCH2026001 biased?\"*\n"
                "- 📊 **Evaluation analysis** — *\"Analyze submission 0X034...\"*\n"
                "- 📣 **Grievance patterns** — *\"Show grievances for TCH2026002\"*\n"
                "- 👥 **Peer comparisons** — *\"Compare TCH2026001 with department\"*\n"
                "- 🔗 **Blockchain verification** — *\"Are there unverified evals?\"*\n"
                "- 📋 **Quick reports** — *\"Generate bias report for TCH2026003\"*\n\n"
                "What would you like to investigate?"
            )

        # ── Follow-up with prior context: LLM synthesises ─────
        # ✅ Build messages WITH history but WITHOUT tools
        # so LLM answers from already-collected data
        has_context = _history_has_tool_results(history)

        if has_context:
            print(f"   ⚡ Follow-up on existing investigation — no new tools")
            try:
                messages = [
                    {
                        "role":    "system",
                        "content": (
                            "You are MCP Admin AI. The user is following up on "
                            "a previous bias investigation. Answer using ONLY "
                            "the data already in the conversation history. "
                            "Do NOT call any tools or fetch new data. "
                            "Be direct and reference specific numbers from the prior analysis."
                        ),
                    }
                ]
                # ✅ Include trimmed history for context
                for msg in history[-6:]:
                    messages.append({
                        "role":    msg.get("role", "user"),
                        "content": msg.get("content", ""),
                    })
                messages.append({"role": "user", "content": message})

                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    # ✅ No tools= — eliminates tool_use_failed entirely
                    temperature=0.2,
                    max_tokens=1024,
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"   ⚠️ Follow-up synthesis failed: {e}")
                return (
                    "I can see the previous investigation data. "
                    "Could you be more specific about what you'd like to know? "
                    "For example: 'What does the variance mean?' or "
                    "'Should this teacher be suspended?'"
                )

        # ── General question without context ──────────────────
        try:
            print(f"   ⚡ Answering general question — no tools")
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role":    "system",
                        "content": (
                            "You are MCP Admin AI, an assistant for academic "
                            "platform administrators. Answer concisely. "
                            "Do NOT call any tools or functions."
                        ),
                    },
                    {"role": "user", "content": message},
                ],
                # ✅ No tools= parameter
                temperature=0.3,
                max_tokens=512,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"   ⚠️ General LLM call failed: {e}")
            return (
                "I'm your MCP Admin AI assistant. I can investigate teacher bias, "
                "analyze evaluations, and review grievances. "
                "What would you like to investigate?"
            )

    # ──────────────────────────────────────────────────────────
    # PRIVATE HELPERS
    # ──────────────────────────────────────────────────────────

    def _call_groq(
        self,
        messages: list,
        use_fallback: bool = False,
        trim_for_fallback: bool = False,    # ✅ NEW
    ):
        """Groq API call WITH tool definitions."""
        model = FALLBACK_MODEL if use_fallback else self.model

        # ✅ Trim messages for fallback to avoid 413 token limit errors
        clean = self._clean_messages(messages)
        if trim_for_fallback:
            clean = self._trim_messages_for_fallback(clean)

        return self.client.chat.completions.create(
            model=model,
            messages=clean,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            temperature=0.1,
             parallel_tool_calls=False,
            max_tokens=2048,   # ✅ Reduced from 4096 for fallback safety
        )

    def _call_groq_no_tools(self, messages: list):
        """Groq API call WITHOUT tools — for final synthesis."""
        return self.client.chat.completions.create(
            model=self.model,
            messages=self._clean_messages(messages),
            temperature=0.1,
            max_tokens=4096,
        )

    def _trim_messages_for_fallback(self, messages: list) -> list:
        """
        ✅ NEW: Aggressively trim messages for small fallback models.
        Keeps: system prompt (truncated) + last 4 messages only.
        Truncates large tool results to 500 chars.
        Prevents 413 token limit errors on llama-3.1-8b-instant (6000 TPM).
        """
        trimmed = []

        for i, msg in enumerate(messages):
            role    = msg.get("role")
            content = msg.get("content", "")

            # Always keep system — but truncate to 1000 chars
            if role == "system":
                trimmed.append({
                    **msg,
                    "content": content[:1000] + "...[truncated for fallback]"
                    if len(content) > 1000 else content,
                })
                continue

            # Keep only last 4 non-system messages
            non_system = [m for m in messages if m.get("role") != "system"]
            last_4     = non_system[-4:]
            if msg not in last_4:
                continue

            # Truncate large tool results
            if role == "tool" and len(content) > 500:
                try:
                    data = json.loads(content)
                    # Keep only top-level keys, drop large lists
                    for key in list(data.keys()):
                        if isinstance(data[key], list) and len(data[key]) > 3:
                            data[key] = data[key][:3]
                            data[f"_{key}_note"] = "truncated for fallback"
                    content = json.dumps(data, default=str)[:500]
                except Exception:
                    content = content[:500] + "...[truncated]"

            trimmed.append({**msg, "content": content})

        return trimmed

    def _clean_messages(self, messages: list) -> list:
        """Clean messages for Groq API."""
        clean = []
        for msg in messages:
            m = {
                "role":    msg["role"],
                "content": msg.get("content") or "",
            }
            if msg.get("tool_calls"):
                m["tool_calls"] = msg["tool_calls"]
            if msg.get("tool_call_id"):
                m["tool_call_id"] = msg["tool_call_id"]
                m["role"]         = "tool"
            clean.append(m)
        return clean

    def _execute_tool(self, tool_name: str, args: dict) -> dict:
        """Execute a tool by name."""
        tool_fn = ALL_TOOLS.get(tool_name)
        if not tool_fn:
            return {
                "success":         False,
                "error":           f"Unknown tool: {tool_name}",
                "available_tools": list(ALL_TOOLS.keys()),
            }
        try:
            start   = time.time()
            result  = tool_fn(**args)
            elapsed = round(time.time() - start, 3)
            print(f"      ⏱  {tool_name} completed in {elapsed}s")
            return result
        except TypeError as e:
            return {
                "success": False,
                "error":   f"Invalid arguments for {tool_name}: {e}",
                "hint":    "Check required parameters in tool definition.",
            }
        except Exception as e:
            return {"success": False, "error": f"Tool error: {e}"}

    def _truncate_result(self, result_str: str, max_chars: int = 15000) -> str:
        if len(result_str) <= max_chars:
            return result_str
        print(f"      ✂️  Truncating: {len(result_str)} → {max_chars}")
        try:
            result = json.loads(result_str)
            for key in [
                "logs", "evaluations", "metrics", "grievances",
                "questions", "audit_events", "eval_summary", "all_percentages",
            ]:
                if key in result and isinstance(result[key], list):
                    orig        = len(result[key])
                    result[key] = result[key][:25]
                    if orig > 25:
                        result[f"_{key}_truncated"] = f"{orig - 25} more omitted"
            truncated = json.dumps(result, default=str)
            return truncated[:max_chars] + "... [truncated]" if len(truncated) > max_chars else truncated
        except Exception:
            return result_str[:max_chars] + "... [truncated]"

    def _summarize_tool_results(self, tool_results: list) -> str:
        lines = []
        for tr in tool_results:
            tool   = tr.get("tool", "unknown")
            result = tr.get("result", {})
            if not result.get("success"):
                lines.append(f"- {tool}: Failed — {result.get('error')}")
                continue
            if tool == "get_teacher_audit_summary":
                timing = result.get("timing", {})
                lines.append(f"- Audit: avg {timing.get('avg_seconds_per_question')}s/q")
            elif tool == "get_teacher_bias_report":
                lines.append(f"- Bias: Risk={result.get('risk_level')}, Flags={result.get('flags', [])}")
            elif tool == "get_grievances_by_teacher":
                lines.append(f"- Grievances: {result.get('total')}, Success={result.get('success_rate_pct')}%")
            elif tool == "compare_teacher_with_peers":
                diff = result.get("difference", {})
                lines.append(f"- Peer diff: {diff.get('marks_pct')}%, Outlier={result.get('is_outlier')}")
            elif tool == "get_evaluations_by_teacher":
                ma = result.get("marks_analysis", {})
                lines.append(f"- Evals: Avg={ma.get('average_pct')}%, Variance={ma.get('variance')}%, Zeros={ma.get('zero_mark_count')}")
            else:
                lines.append(f"- {tool}: OK")
        return "\n".join(lines) if lines else "No data."


# ──────────────────────────────────────────────────────────────
# MODULE-LEVEL HELPER
# ──────────────────────────────────────────────────────────────

def _history_has_tool_results(history: list) -> bool:
    """
    Returns True if the conversation history contains any
    assistant messages that used tools (i.e. a real investigation
    was already run in this conversation).
    """
    for msg in history:
        if msg.get("role") == "assistant":
            if msg.get("tool_calls"):
                return True
        if msg.get("role") == "tool":
            return True
    return False
