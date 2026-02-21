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


class MCPAgent:
    """
    Multi-step AI agent using Groq LLM with tool calling.
    Queries MongoDB collections iteratively to answer admin questions.
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
        """
        Process admin message through multi-step tool calling loop.

        Args:
            user_message:          The admin's question
            conversation_history:  Previous messages for context

        Returns:
            {
              "answer":       final text response,
              "tools_used":   list of tools called,
              "iterations":   number of LLM calls made,
              "tool_results": raw tool outputs for debugging
            }
        """
        # Build message history
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Add previous conversation context if provided
        if conversation_history:
            for msg in conversation_history[-6:]:  # Last 6 msgs for context
                messages.append(msg)

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        tools_used    = []
        tool_results  = []
        iterations    = 0

        print(f"\n🤖 Processing: {user_message[:80]}...")

        # ── Multi-step tool calling loop ──────────────────────
        while iterations < MAX_TOOL_ITERATIONS:
            iterations += 1
            print(f"   Iteration {iterations}/{MAX_TOOL_ITERATIONS}")

            try:
                response = self._call_groq(messages)
            except Exception as e:
                # Try fallback model
                print(f"   ⚠️ Primary model failed: {e}. Trying fallback...")
                response = self._call_groq(messages, use_fallback=True)

            choice  = response.choices[0]
            message = choice.message

            # Always append assistant message to history
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

            # ── No tool calls → LLM has final answer ─────────
            if not message.tool_calls:
                print(f"   ✅ Final answer after {iterations} iterations")
                print(f"   🔧 Tools used: {tools_used}")
                return {
                    "answer":       message.content,
                    "tools_used":   tools_used,
                    "iterations":   iterations,
                    "tool_results": tool_results,
                }

            # ── Execute each tool call ────────────────────────
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                tools_used.append(tool_name)

                print(f"   🔧 Calling tool: {tool_name}")

                # Parse arguments
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    args = {}

                # Execute tool
                result = self._execute_tool(tool_name, args)

                # Store for debugging
                tool_results.append({
                    "tool":   tool_name,
                    "args":   args,
                    "result": result,
                })

                # Truncate large results to avoid token overflow
                result_str = self._truncate_result(
                    json.dumps(result, default=str)
                )

                # Add tool result to message history
                messages.append({
                    "role":         "tool",
                    "tool_call_id": tool_call.id,
                    "content":      result_str,
                })

        # ── Max iterations reached ────────────────────────────
        print(f"   ⚠️  Max iterations ({MAX_TOOL_ITERATIONS}) reached")
        return {
            "answer": (
                "I've gathered significant data but reached my analysis limit. "
                "Here's what I found based on the data collected:\n\n"
                + self._summarize_tool_results(tool_results)
            ),
            "tools_used":   tools_used,
            "iterations":   iterations,
            "tool_results": tool_results,
        }

    # ──────────────────────────────────────────────────────────
    # PRIVATE HELPERS
    # ──────────────────────────────────────────────────────────

    def _call_groq(
        self,
        messages: list,
        use_fallback: bool = False,
    ):
        """Make a Groq API call with tool definitions."""
        model = FALLBACK_MODEL if use_fallback else self.model

        # Clean messages for API
        # (remove None tool_calls fields)
        clean_messages = []
        for msg in messages:
            clean_msg = {
                "role":    msg["role"],
                "content": msg.get("content") or "",
            }
            if msg.get("tool_calls"):
                clean_msg["tool_calls"] = msg["tool_calls"]
            if msg.get("tool_call_id"):
                clean_msg["tool_call_id"] = msg["tool_call_id"]
                clean_msg["role"]         = "tool"
            clean_messages.append(clean_msg)

        return self.client.chat.completions.create(
            model=model,
            messages=clean_messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            temperature=0.1,      # Low temp for factual analysis
            max_tokens=4096,
        )

    def _execute_tool(self, tool_name: str, args: dict) -> dict:
        """Execute a tool by name with given arguments."""
        tool_fn = ALL_TOOLS.get(tool_name)

        if not tool_fn:
            return {
                "success": False,
                "error":   f"Unknown tool: {tool_name}",
            }

        try:
            start = time.time()
            result = tool_fn(**args)
            elapsed = round(time.time() - start, 3)
            print(f"      ⏱  {tool_name} completed in {elapsed}s")
            return result
        except TypeError as e:
            # Wrong arguments passed
            return {
                "success": False,
                "error":   f"Invalid arguments for {tool_name}: {e}",
            }
        except Exception as e:
            return {
                "success": False,
                "error":   f"Tool execution error: {e}",
            }

    def _truncate_result(
        self,
        result_str: str,
        max_chars: int = 15000,   # ✅ CHANGED from 8000 → 15000
    ) -> str:
        if len(result_str) <= max_chars:
            return result_str

        print(f"      ✂️  Truncating result: {len(result_str)} → {max_chars} chars")

        try:
            result = json.loads(result_str)

            for key in ["logs", "evaluations", "metrics", "grievances"]:
                if key in result and isinstance(result[key], list):
                    result[key] = result[key][:20]   # ✅ CHANGED from 5 → 20
                    result[f"_{key}_truncated"] = True

            truncated = json.dumps(result, default=str)

            if len(truncated) > max_chars:
                return truncated[:max_chars] + "... [truncated]"

            return truncated

        except Exception:
            return result_str[:max_chars] + "... [truncated]"

    def _summarize_tool_results(self, tool_results: list) -> str:
        """
        Create a readable summary of tool results collected
        when max iterations are reached.
        """
        lines = []
        for tr in tool_results:
            tool   = tr.get("tool", "unknown")
            result = tr.get("result", {})

            if not result.get("success"):
                lines.append(f"- {tool}: Failed - {result.get('error')}")
                continue

            # Summarize based on tool type
            if tool == "get_teacher_audit_summary":
                timing  = result.get("timing", {})
                marking = result.get("marking", {})
                lines.append(
                    f"- Audit Summary: "
                    f"avg {timing.get('avg_seconds_per_question')}s/question, "
                    f"avg {marking.get('avg_marks_percentage')}% marks"
                )
            elif tool == "get_teacher_bias_report":
                lines.append(
                    f"- Bias Report: "
                    f"Risk={result.get('risk_level')}, "
                    f"FlagRate={result.get('flag_rate_pct')}%"
                )
            elif tool == "get_grievances_by_teacher":
                lines.append(
                    f"- Grievances: "
                    f"Total={result.get('total')}, "
                    f"Success rate={result.get('success_rate_pct')}%"
                )
            elif tool == "compare_teacher_with_peers":
                diff = result.get("difference", {})
                lines.append(
                    f"- Peer Comparison: "
                    f"Marks diff={diff.get('marks_pct')}%, "
                    f"Outlier={result.get('is_outlier')}"
                )
            else:
                lines.append(f"- {tool}: Data retrieved successfully")

        return "\n".join(lines) if lines else "No data collected."
