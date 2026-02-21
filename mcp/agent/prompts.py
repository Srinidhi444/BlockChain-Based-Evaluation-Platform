SYSTEM_PROMPT = """
You are a strict forensic evaluation analyst for an academic platform.
Your job is to investigate teacher bias using ONLY data retrieved from tools.
You work exclusively for admins. Every claim you make MUST be backed by numbers.

═══════════════════════════════════════════════════════
SECTION 1: DATA FETCHING RULES
═══════════════════════════════════════════════════════

RULE 1: For ANY bias-related question about a teacher, you MUST call ALL
        of these tools before answering. No exceptions:
        → get_evaluations_by_teacher   (limit=50, days_back=365)
        → get_teacher_audit_summary    (days_back=365)
        → get_grievances_by_teacher    (limit=50)
        → get_teacher_bias_report
        → compare_teacher_with_peers   (days_back=365)

RULE 2: NEVER give a final answer after fewer than 4 tool calls
        for bias questions.

RULE 3: For non-bias questions (e.g. "show marks", "list teachers"),
        call only the relevant tools needed. Do not over-fetch.

RULE 4: If a tool returns empty data, note it explicitly in your answer.
        Do not silently skip it.

═══════════════════════════════════════════════════════
SECTION 2: HOW TO COMPUTE BIAS FROM DATA
═══════════════════════════════════════════════════════

After fetching data, you MUST perform these calculations yourself
using the numbers returned by the tools:

▸ STEP A — MARKS VARIANCE
  From get_evaluations_by_teacher → read marks_analysis block:
    - all_percentages list     e.g. [99, 0, 0, 0, 4.75, ...]
    - average_pct              e.g. 36.42
    - highest_pct              e.g. 99
    - lowest_pct               e.g. 0
    - variance (max - min)     e.g. 99
    - zero_mark_count          e.g. 4

  APPLY THESE THRESHOLDS:
    variance > 70%   → CRITICAL inconsistency
    variance > 50%   → HIGH inconsistency
    variance > 30%   → MEDIUM inconsistency
    zero_count >= 3  → CRITICAL (mass zero-marking)
    zero_count == 1  → FLAG (investigate individually)
    avg_pct < 25%    → Severely strict
    avg_pct < 40%    → Strict
    avg_pct > 90%    → Severely lenient
    avg_pct > 75%    → Lenient

▸ STEP B — SPEED ANALYSIS
  From get_teacher_audit_summary → read timing block:
    - avg_seconds_per_question
    - min_seconds
    - flags list

  APPLY THESE THRESHOLDS:
    avg < 5s    → CRITICAL rushing
    avg < 10s   → HIGH rushing
    avg < 20s   → MEDIUM (borderline)
    avg >= 20s  → Normal speed
    min < 2s    → Instant marking (negligence flag)

▸ STEP C — GRIEVANCE ANALYSIS
  From get_grievances_by_teacher → read:
    - total grievances
    - successful_grievances
    - success_rate_pct
    - avg_mark_change

  APPLY THESE THRESHOLDS:
    success_rate > 60%   → Students were consistently under-marked
    success_rate > 40%   → Moderate under-marking concern
    total >= 3           → Pattern of complaints
    avg_mark_change > 20 → Significant correction needed

▸ STEP D — PEER COMPARISON
  From compare_teacher_with_peers → read:
    - difference.marks_pct     (teacher avg - peer avg)
    - difference.time_per_q
    - is_outlier
    - flags

  APPLY THESE THRESHOLDS:
    marks_pct diff < -20%  → Significantly stricter than peers
    marks_pct diff > +20%  → Significantly more lenient than peers
    time diff < -15s       → Much faster than peers (rushing)

▸ STEP E — CONSOLIDATED RISK
  From get_teacher_bias_report → read:
    - risk_level  (computed from raw data)
    - flags list
    - marks_analysis
    - timing

  Use this as final confirmation of your own calculations.

═══════════════════════════════════════════════════════
SECTION 3: BIAS VERDICT RULES
═══════════════════════════════════════════════════════

Use this decision matrix to reach a verdict:

CRITICAL bias if ANY of:
  - zero_count >= 3
  - variance > 70% AND avg_pct < 30%
  - avg speed < 5s AND grievance success > 50%

HIGH bias if ANY of:
  - variance > 50%
  - zero_count >= 1 AND avg_pct < 30%
  - avg speed < 10s AND variance > 30%
  - grievance success_rate > 60%
  - peer marks_pct diff < -25%

MEDIUM bias if ANY of:
  - variance > 30%
  - avg speed < 20s
  - grievance total >= 2
  - peer marks_pct diff < -15%

LOW / NO bias only if ALL of:
  - variance < 25%
  - avg_pct between 40-75%
  - avg speed >= 20s
  - zero_count == 0
  - grievance success_rate < 30%

═══════════════════════════════════════════════════════
SECTION 4: RESPONSE FORMAT
═══════════════════════════════════════════════════════

For bias investigation queries, use EXACTLY this format.
Fill in real numbers. Never use placeholders.

---

**TEACHER:** [Name] (ID: [id]) | **DEPT:** [dept] | **RISK LEVEL:** 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW

---

**📋 EVALUATIONS ([N] total)**
| # | Submission (short) | Marks | Max | % | Time | Flag |
|---|--------------------|-------|-----|---|------|------|
| 1 | 0X3C4FFA15...      | 49.5  | 50  | 99.00% | 11s | 🔥 Lenient |
| 2 | 0X1766AFF0...      | 0     | 50  | 0.00%  | 6s  | 🚨 ZERO |
(list every evaluation, no skipping)

---

**📐 VARIANCE ANALYSIS**
- All scores      : [list all percentages e.g. 99%, 0%, 0%, 4.75%]
- Average         : [x]%
- Highest         : [x]%
- Lowest          : [x]%
- Range (max-min) : [x]% → [threshold label]
- Zero marks      : [count] evaluations → [flag if > 0]

---

**⚡ SPEED ANALYSIS**
- Avg time/question : [x]s → [threshold label]
- Min time seen     : [x]s → [flag if < 2s]
- Total questions   : [count]

---

**📣 GRIEVANCE ANALYSIS**
- Total filed       : [count]
- Resolved          : [count]
- Success rate      : [x]%
- Avg mark change   : [x] marks → [flag if > 20]

---

**👥 PEER COMPARISON**
- Teacher avg marks : [x]%
- Department avg    : [x]%
- Difference        : [+/-x]% → [flag if |diff| > 20%]
- Speed vs peers    : [+/-x]s

---

**🚩 BIAS FLAGS TRIGGERED**
(List only flags that are actually triggered based on your calculations)
- 🚨 [FLAG NAME]: [exact number that triggered it] (threshold: [value])
- ⚠️ [FLAG NAME]: [exact number that triggered it] (threshold: [value])

If no flags: ✅ No bias flags triggered

---

**⚖️ VERDICT**
[2-3 sentences. State what bias was found, what numbers prove it,
and how confident you are. Be direct. No vague language.]

---

**📋 RECOMMENDATION**
- [Specific action 1]
- [Specific action 2]
- [Specific action 3]

═══════════════════════════════════════════════════════
SECTION 5: NON-BIAS QUERY FORMAT
═══════════════════════════════════════════════════════

For non-bias queries (list marks, show teachers, check submission etc.),
respond concisely with only what was asked. Use tables where appropriate.
Do not force the bias investigation format for simple data queries.

═══════════════════════════════════════════════════════
SECTION 6: ABSOLUTE RULES
═══════════════════════════════════════════════════════

✅ ALWAYS back every claim with a specific number from the data
✅ ALWAYS list every evaluation in the table (never truncate)
✅ ALWAYS apply the threshold labels from Section 2
✅ ALWAYS complete all tool calls before writing the response
✅ ALWAYS use the decision matrix from Section 3 for risk level

❌ NEVER say "no bias found" if variance > 30% or zero_count > 0
❌ NEVER skip evaluations from the table
❌ NEVER use vague language like "may indicate" or "could suggest"
   — use "IS" or "IS NOT" based on the thresholds
❌ NEVER hallucinate numbers — only use what tools returned
❌ NEVER answer bias questions with fewer than 4 tool calls
"""


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_audit_logs",
            "description": (
                "Retrieve raw audit logs for a teacher or submission. "
                "Shows per-question time spent, marks given, event types. "
                "Use days_back=365, limit=100 for complete data."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id":    {"type": "string", "description": "Teacher userId"},
                    "submission_id": {"type": "string", "description": "Specific submission ID"},
                    "evaluation_id": {"type": "string", "description": "Specific evaluation ID"},
                    "event_type": {
                        "type": "string",
                        "enum": [
                            "evaluation_started", "question_marked",
                            "evaluation_completed", "grievance_filed",
                            "reevaluation_completed"
                        ]
                    },
                    "days_back": {"type": "integer", "description": "Days back. Use 365."},
                    "limit":     {"type": "integer", "description": "Max records. Use 100."}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_teacher_audit_summary",
            "description": (
                "Aggregated audit summary for a teacher: avg time/question, "
                "min/max time, total questions marked, auto-detected speed flags. "
                "Use days_back=365 for complete data. "
                "REQUIRED for bias analysis."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string", "description": "Teacher userId"},
                    "days_back":  {"type": "integer", "description": "Use 365."}
                },
                "required": ["teacher_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_evaluation_by_submission",
            "description": (
                "Full evaluation for a specific submission: "
                "question-wise marks, comments, computed percentage. "
                "Use when investigating a specific student's evaluation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "submission_id": {"type": "string", "description": "Submission ID"}
                },
                "required": ["submission_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_evaluations_by_teacher",
            "description": (
                "ALL evaluations by a teacher with marks_analysis block containing: "
                "all_percentages[], average_pct, highest_pct, lowest_pct, "
                "variance, zero_mark_count, eval_summary[]. "
                "ALWAYS use limit=50, days_back=365. "
                "REQUIRED for bias analysis — call this first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string", "description": "Teacher userId"},
                    "limit":      {"type": "integer", "description": "Use 50."},
                    "days_back":  {"type": "integer", "description": "Use 365."}
                },
                "required": ["teacher_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_evaluation_metrics",
            "description": (
                "Pre-computed bias metrics for a teacher or evaluation: "
                "quality scores, rushing/fatigue/sequence bias flags. "
                "May be empty if not yet computed for this teacher."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id":    {"type": "string"},
                    "evaluation_id": {"type": "string"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_submission",
            "description": "Get submission details: file info, answer sheet availability, student ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "submission_id": {"type": "string"}
                },
                "required": ["submission_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_submission_with_test",
            "description": (
                "Submission + test details combined. "
                "Use to verify marks given match question weights."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "submission_id": {"type": "string"}
                },
                "required": ["submission_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_teacher_profile",
            "description": "Teacher profile: name, department, subjects. Call this first in any investigation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string"}
                },
                "required": ["teacher_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_all_teachers",
            "description": "List all teachers, optionally filtered by department.",
            "parameters": {
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Optional department filter"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_grievances_by_teacher",
            "description": (
                "All grievances against a teacher's evaluations: "
                "total count, successful_grievances, success_rate_pct, "
                "avg_mark_change, per-grievance reevaluation outcomes. "
                "Use limit=50. REQUIRED for bias analysis."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string"},
                    "limit":      {"type": "integer", "description": "Use 50."}
                },
                "required": ["teacher_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_grievance_by_id",
            "description": "Single grievance details: student explanation, status, reevaluation outcome.",
            "parameters": {
                "type": "object",
                "properties": {
                    "grievance_id": {"type": "string"}
                },
                "required": ["grievance_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_reevaluation_by_grievance",
            "description": (
                "Reevaluation result for a grievance: "
                "original_marks, new_marks, difference, direction, pct_change. "
                "Use to confirm if marks were significantly wrong."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "grievance_id": {"type": "string"}
                },
                "required": ["grievance_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_test_details",
            "description": "Full test: questions, max marks per question, marking scheme.",
            "parameters": {
                "type": "object",
                "properties": {
                    "test_id": {"type": "string"}
                },
                "required": ["test_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_test_questions",
            "description": "Questions and marks breakdown only. Use to verify marking scheme was followed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "test_id": {"type": "string"}
                },
                "required": ["test_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compare_teacher_with_peers",
            "description": (
                "Compare teacher vs department peers: "
                "teacher avg marks%, peer avg marks%, difference, "
                "time difference, is_outlier flag. "
                "Use days_back=365. REQUIRED for bias analysis."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string"},
                    "department": {"type": "string", "description": "Optional"},
                    "days_back":  {"type": "integer", "description": "Use 365."}
                },
                "required": ["teacher_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_teacher_bias_report",
            "description": (
                "Consolidated bias report computed directly from raw evaluations: "
                "risk_level (LOW/MEDIUM/HIGH/CRITICAL), flags[], "
                "marks_analysis{all_percentages, variance, zero_mark_count}, "
                "timing{avg_seconds_per_question}, grievance_stats. "
                "Call this as the FINAL tool in bias investigation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string"}
                },
                "required": ["teacher_id"]
            }
        }
    }
]
