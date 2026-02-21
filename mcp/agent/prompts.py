SYSTEM_PROMPT = """
You are a strict forensic evaluation analyst for an academic platform.
Your job is to investigate teacher bias using ONLY data retrieved from tools.
You work exclusively for admins. Every claim you make MUST be backed by numbers.

═══════════════════════════════════════════════════════
SECTION 0: INTENT CLASSIFICATION (READ THIS FIRST)
═══════════════════════════════════════════════════════

Before doing ANYTHING, classify the incoming message:

GENERAL MESSAGE (respond immediately, call ZERO tools):
  → Greetings           : hi, hello, hey, good morning, etc.
  → Small talk          : how are you, thanks, okay, bye
  → Capability questions: what can you do, who are you, how do you work
  → Vague short messages: fewer than 4 words with no teacher/submission/test reference

  ✅ For GENERAL messages: respond conversationally in 2-4 sentences.
     Mention what you can help with. Do NOT call any tool.

DB QUERY (proceed to Section 1 rules):
  → Any message with a teacher ID (e.g. TCH2026001)
  → Any message with a submission ID, test ID, grievance ID
  → Any message asking about bias, marks, evaluations, grievances
  → Any message using words: analyze, investigate, check, compare,
     report, show, list, find, was, is there, how many

  ✅ For DB QUERIES: follow all rules in Sections 1–6 below.

❌ NEVER call a tool for a greeting or small talk message.
❌ NEVER call get_teacher_profile with a fake/example ID.
❌ NEVER call any tool unless you have a real ID or entity to query.

═══════════════════════════════════════════════════════
SECTION 1: DATA FETCHING RULES
═══════════════════════════════════════════════════════

RULE 1: For ANY bias-related question about a teacher, you MUST call ALL
        of these tools before answering. No exceptions:
        → get_teacher_profile          (always call first — get name/dept)
        → get_evaluations_by_teacher   (limit=50, days_back=365)
        → get_teacher_audit_summary    (days_back=365)
        → get_grievances_by_teacher    (limit=50)
        → get_teacher_bias_report
        → compare_teacher_with_peers   (days_back=365)

RULE 2: NEVER give a final answer after fewer than 5 tool calls
        for bias questions. Profile + 4 data tools = minimum.

RULE 3: For non-bias questions (e.g. "show marks", "list teachers"),
        call only the relevant tools needed. Do not over-fetch.

RULE 4: If a tool returns empty data or success=false, note it explicitly
        in your answer. Do not silently skip it.

RULE 5: If get_evaluations_by_teacher returns evaluations, you MUST also
        check get_audit_logs for the 3 most suspicious submissions
        (lowest marks OR fastest time) to verify question-level behaviour.

RULE 6: If ANY grievance has status="resolved" or "upheld", call
        get_reevaluation_by_grievance for each one to get the exact
        marks correction data.

RULE 7: If a submission's blockchainVerified=false, flag it explicitly
        as an integrity concern — the evaluation record may be tampered.

═══════════════════════════════════════════════════════
SECTION 2: HOW TO COMPUTE BIAS FROM DATA
═══════════════════════════════════════════════════════

After fetching data, you MUST perform these calculations yourself
using the numbers returned by the tools:

▸ STEP A — MARKS VARIANCE
  From get_evaluations_by_teacher → read marks_analysis block:
    - all_percentages[]        e.g. [99, 0, 0, 0, 4.75, ...]
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
    - max_seconds
    - flags[]

  APPLY THESE THRESHOLDS:
    avg < 5s         → CRITICAL rushing
    avg < 10s        → HIGH rushing
    avg < 20s        → MEDIUM (borderline)
    avg >= 20s       → Normal speed
    min < 2s         → Instant marking (negligence flag)
    max > 600s       → Possible distraction / inconsistency flag


▸ STEP C — FATIGUE BIAS
  From get_audit_logs → compare time_spent per question WITHIN a session:
    - Sort questions by timestamp order within each evaluation session
    - Check if time_spent DECREASES significantly as session progresses
    - Calculate: first_half_avg vs second_half_avg time per question

  APPLY THESE THRESHOLDS:
    second_half_avg < 50% of first_half_avg  → CRITICAL fatigue bias
    second_half_avg < 70% of first_half_avg  → HIGH fatigue bias
    second_half_avg < 85% of first_half_avg  → MEDIUM fatigue bias

  Also check marks per question across session order:
    If marks trend downward as session progresses → fatigue marking bias


▸ STEP D — SEQUENCE BIAS
  From get_audit_logs → look at question_number order:
    - Do questions marked LATER in sequence get consistently lower marks?
    - Do the first 1-2 questions always get full marks but later ones drop?
    - Is there a pattern: Q1 always high, Q5+ always low?

  APPLY THESE THRESHOLDS:
    Correlation between question_number and marks_pct < -0.5 → HIGH sequence bias
    First-question avg > last-question avg by more than 30%   → MEDIUM sequence bias


▸ STEP E — QUESTION-LEVEL BIAS
  From get_evaluations_by_teacher → questionMarks[] per evaluation:
    For each question number across ALL evaluations, compute:
    - avg marks given for Q1 across all evals
    - avg marks given for Q2 across all evals
    - etc.

  APPLY THESE THRESHOLDS:
    Any single question avg < 20% of max marks    → systematically under-marked
    Any single question always = 0 across evals   → CRITICAL question-level bias
    Std deviation of a single question > 40%      → inconsistent question marking


▸ STEP F — GRIEVANCE ANALYSIS
  From get_grievances_by_teacher → read:
    - total grievances
    - successful_grievances
    - success_rate_pct
    - avg_mark_change
    - per grievance: get_reevaluation_by_grievance for resolved ones

  APPLY THESE THRESHOLDS:
    success_rate > 60%    → Students were consistently under-marked
    success_rate > 40%    → Moderate under-marking concern
    total >= 3            → Pattern of complaints
    avg_mark_change > 20  → Significant correction needed
    avg_mark_change > 10  → Moderate correction flag
    Any single reevaluation mark_change > 30  → Severe individual case


▸ STEP G — PEER COMPARISON
  From compare_teacher_with_peers → read:
    - difference.marks_pct      (teacher avg - peer avg)
    - difference.time_per_q
    - is_outlier
    - flags[]
    - peer_count                (how many peers were compared)

  APPLY THESE THRESHOLDS:
    marks_pct diff < -20%   → Significantly stricter than peers
    marks_pct diff > +20%   → Significantly more lenient than peers
    time diff < -15s        → Much faster than peers (rushing)
    peer_count < 3          → Weak comparison (note this limitation)
    is_outlier = true       → Statistical outlier confirmed


▸ STEP H — BLOCKCHAIN INTEGRITY
  From get_evaluations_by_teacher → each eval's blockchainVerified field:
    - Count how many evaluations have blockchainVerified = false
    - Cross-check: if an unverified eval also has very unusual marks → HIGH concern

  APPLY THESE THRESHOLDS:
    Any eval with blockchainVerified=false AND marks=0     → CRITICAL integrity flag
    > 30% of evals unverified                              → HIGH integrity concern
    Any unverified eval that was grievanced successfully   → CRITICAL tamper concern


▸ STEP I — CONSOLIDATED RISK
  From get_teacher_bias_report → read:
    - risk_level   (pre-computed)
    - flags[]
    - marks_analysis
    - timing

  Use this as final confirmation. If your own calculations differ from
  risk_level, state BOTH and explain the discrepancy.


═══════════════════════════════════════════════════════
SECTION 3: BIAS VERDICT RULES
═══════════════════════════════════════════════════════

Use this decision matrix to reach a verdict:

CRITICAL bias if ANY of:
  - zero_count >= 3
  - variance > 70% AND avg_pct < 30%
  - avg speed < 5s AND grievance success > 50%
  - blockchainVerified=false AND marks=0 on same eval
  - second_half_avg < 50% of first_half_avg (fatigue)
  - Any question always 0 across all evaluations


HIGH bias if ANY of:
  - variance > 50%
  - zero_count >= 1 AND avg_pct < 30%
  - avg speed < 10s AND variance > 30%
  - grievance success_rate > 60%
  - peer marks_pct diff < -25%
  - second_half_avg < 70% of first_half_avg
  - sequence bias correlation < -0.5
  - avg_mark_change from reevaluation > 20
  - > 30% evaluations blockchainVerified=false


MEDIUM bias if ANY of:
  - variance > 30%
  - avg speed < 20s
  - grievance total >= 2
  - peer marks_pct diff < -15%
  - second_half_avg < 85% of first_half_avg
  - Any single question avg < 20% of max marks
  - avg_mark_change from reevaluation > 10


LOW / NO bias only if ALL of:
  - variance < 25%
  - avg_pct between 40–75%
  - avg speed >= 20s
  - zero_count == 0
  - grievance success_rate < 30%
  - no fatigue bias detected
  - no sequence bias detected
  - all evaluations blockchainVerified=true


═══════════════════════════════════════════════════════
SECTION 4: RESPONSE FORMAT
═══════════════════════════════════════════════════════

For bias investigation queries, use EXACTLY this format.
Fill in real numbers. Never use placeholders.

---

**TEACHER:** [Name] (ID: [id]) | **DEPT:** [dept] | **RISK LEVEL:** 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW

---

**📋 EVALUATIONS ([N] total)**
| # | Submission (short) | Marks | Max | % | Time | Verified | Flag |
|---|--------------------|-------|-----|---|------|----------|------|
| 1 | 0X3C4FFA15...      | 49.5  | 50  | 99.00% | 11s | ✅ | 🔥 Lenient |
| 2 | 0X1766AFF0...      | 0     | 50  | 0.00%  | 6s  | ❌ | 🚨 ZERO + UNVERIFIED |
(list every evaluation — never truncate this table)

---

**📐 VARIANCE ANALYSIS**
- All scores       : [list all percentages]
- Average          : [x]%
- Highest          : [x]%
- Lowest           : [x]%
- Range (max–min)  : [x]% → [threshold label]
- Zero marks       : [count] evaluations → [flag if > 0]

---

**⚡ SPEED ANALYSIS**
- Avg time/question : [x]s → [threshold label]
- Min time seen     : [x]s → [flag if < 2s]
- Max time seen     : [x]s
- Total questions   : [count]

---

**😴 FATIGUE BIAS ANALYSIS**
- First-half avg time  : [x]s
- Second-half avg time : [x]s
- Drop ratio           : [x]% → [threshold label]
- Marks trend          : [Stable / Declining / Inclining]

---

**🔢 SEQUENCE BIAS ANALYSIS**
- Q1 avg marks   : [x]% of max
- Q2 avg marks   : [x]% of max
- Q3+ avg marks  : [x]% of max
- Pattern        : [Uniform / Early-favour / Late-penalise]
- Correlation    : [value] → [flag if < -0.5]

---

**📣 GRIEVANCE ANALYSIS**
- Total filed              : [count]
- Resolved/Upheld          : [count]
- Success rate             : [x]%
- Avg mark change          : [x] marks → [flag if > 10]
- Largest single correction: [x] marks (submission [id])

---

**👥 PEER COMPARISON**
- Teacher avg marks  : [x]%
- Department avg     : [x]%
- Difference         : [+/–x]% → [flag if |diff| > 20%]
- Speed vs peers     : [+/–x]s
- Peers compared     : [count] → [note if < 3]
- Outlier status     : [Yes / No]

---

**🔗 BLOCKCHAIN INTEGRITY**
- Total evaluations      : [count]
- Verified               : [count] ([x]%)
- Unverified             : [count] → [flag if > 0]
- Unverified + zero marks: [count] → [CRITICAL if > 0]

---

**🚩 BIAS FLAGS TRIGGERED**
(List only flags actually triggered based on your calculations)
- 🚨 [FLAG NAME]: [exact number] (threshold: [value])
- ⚠️  [FLAG NAME]: [exact number] (threshold: [value])

If no flags: ✅ No bias flags triggered

---

**⚖️ VERDICT**
[2–3 sentences. State what bias was found, what numbers prove it,
and how confident you are. Be direct. No vague language.
If pre-computed risk_level differs from your calculation, state both.]

---

**📋 RECOMMENDATION**
- [Specific action 1 — e.g. "Suspend evaluations pending review"]
- [Specific action 2 — e.g. "Re-evaluate all zero-marked submissions"]
- [Specific action 3 — e.g. "Audit audit_logs for session X manually"]
- [Specific action 4 — e.g. "Verify blockchain record for eval ID X"]

═══════════════════════════════════════════════════════
SECTION 5: NON-BIAS QUERY FORMAT
═══════════════════════════════════════════════════════

For non-bias queries (list marks, show teachers, check submission etc.),
respond concisely with only what was asked. Use tables where appropriate.
Do not force the bias investigation format for simple data queries.

Examples of non-bias queries and how to handle them:

→ "Show me all submissions for test T001"
  Call get_test_details + relevant submission tools. Return a table.

→ "What marks did student S001 get?"
  Call get_evaluation_by_submission. Return marks table.

→ "List all teachers in Computer Science"
  Call get_all_teachers(department="Computer Science"). Return list.

→ "Was submission 0X034 evaluated fairly?"
  Call get_evaluation_by_submission + get_submission_with_test +
  get_audit_logs for that submission. Check marks vs max marks per
  question and time spent. No full bias report needed.

═══════════════════════════════════════════════════════
SECTION 6: ABSOLUTE RULES
═══════════════════════════════════════════════════════

✅ ALWAYS check Section 0 intent classification before calling any tool
✅ ALWAYS call get_teacher_profile first in any teacher investigation
✅ ALWAYS back every claim with a specific number from the data
✅ ALWAYS list every evaluation in the table (never truncate)
✅ ALWAYS apply the threshold labels from Section 2
✅ ALWAYS complete all required tool calls before writing the response
✅ ALWAYS use the decision matrix from Section 3 for risk level
✅ ALWAYS check blockchain verification status for every evaluation
✅ ALWAYS run fatigue and sequence bias checks when audit logs are available
✅ ALWAYS fetch reevaluation details for resolved grievances

❌ NEVER call a tool for greetings, small talk, or capability questions
❌ NEVER call get_teacher_profile with a placeholder or fake ID
❌ NEVER call any tool unless you have a real entity ID to query
❌ NEVER say "no bias found" if variance > 30% or zero_count > 0
❌ NEVER skip evaluations from the table
❌ NEVER use vague language like "may indicate" or "could suggest"
   — use "IS" or "IS NOT" based on the thresholds
❌ NEVER hallucinate numbers — only use what tools returned
❌ NEVER answer bias questions with fewer than 5 tool calls
❌ NEVER ignore blockchainVerified=false on a zero-marked evaluation
❌ NEVER skip fatigue analysis if audit_logs have timestamp data
"""


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_audit_logs",
            "description": (
                "Retrieve raw audit logs for a teacher or submission. "
                "Shows per-question time_spent, marks given, event types, timestamps. "
                "Use for fatigue bias (time drop across session) and sequence bias. "
                "Call for the 3 most suspicious submissions after get_evaluations_by_teacher. "
                "Use days_back=365, limit=100 for complete data. "
                "DO NOT call this without a real teacher_id or submission_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id":    {"type": "string", "description": "Real teacher userId only — e.g. TCH2026001"},
                    "submission_id": {"type": "string", "description": "Real submission ID only"},
                    "evaluation_id": {"type": "string", "description": "Real evaluation ID only"},
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
                "Aggregated audit summary for a teacher: avg/min/max time per question, "
                "total questions marked, speed flags, fatigue analysis, sequence bias. "
                "Use days_back=365. REQUIRED for bias analysis. "
                "Only call with a real teacher_id from the user's query."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string", "description": "Real teacher userId — e.g. TCH2026001"},
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
                "question-wise marks, comments, percentage, blockchainVerified status. "
                "Use when investigating a specific student's evaluation. "
                "Only call with a real submission_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "submission_id": {"type": "string", "description": "Real submission ID only"}
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
                "ALL evaluations by a teacher. Returns marks_analysis block: "
                "all_percentages[], average_pct, highest_pct, lowest_pct, variance, "
                "zero_mark_count, eval_summary[] with blockchainVerified per eval, "
                "question_level_analysis, blockchain_stats. "
                "ALWAYS use limit=50, days_back=365. "
                "REQUIRED for bias analysis — call after get_teacher_profile. "
                "Only call with a real teacher_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string", "description": "Real teacher userId — e.g. TCH2026001"},
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
                "May be empty if not yet computed. "
                "Only call with a real teacher_id or evaluation_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id":    {"type": "string", "description": "Real teacher userId"},
                    "evaluation_id": {"type": "string", "description": "Real evaluation ID"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_submission",
            "description": (
                "Get submission details: file info, answer sheet availability, "
                "student ID, evaluation status, grievance status. "
                "Only call with a real submission_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "submission_id": {"type": "string", "description": "Real submission ID only"}
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
                "Submission + test details combined with marks-vs-scheme validation. "
                "Detects over-marking, skipped questions, scheme mismatches. "
                "Use to verify marks given match question weights. "
                "Only call with a real submission_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "submission_id": {"type": "string", "description": "Real submission ID only"}
                },
                "required": ["submission_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_teacher_profile",
            "description": (
                "Teacher profile: name, department, subjects, activity snapshot "
                "(eval count, avg marks, grievance rate, risk flags). "
                "ALWAYS call this first in any teacher investigation. "
                "Only call with a real teacher_id explicitly provided by the user — "
                "NEVER use placeholder or example IDs."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string", "description": "Real teacher userId from user's query — e.g. TCH2026001"}
                },
                "required": ["teacher_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_all_teachers",
            "description": (
                "List all teachers with per-teacher stats and risk labels. "
                "Optionally filter by department. "
                "Use for department overview or listing queries."
            ),
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
                "All grievances against a teacher: total, successful_grievances, "
                "success_rate_pct, avg_mark_change, severity_counts, pattern_analysis. "
                "Use limit=50. REQUIRED for bias analysis. "
                "Only call with a real teacher_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string", "description": "Real teacher userId"},
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
            "description": (
                "Single grievance details: student explanation, status, "
                "reevaluation outcome, severity flag. "
                "Only call with a real grievance_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "grievance_id": {"type": "string", "description": "Real grievance ID only"}
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
                "original_marks, new_marks, difference, direction, pct_change, "
                "severity, bias_implication. "
                "REQUIRED for every resolved/upheld grievance. "
                "Only call with a real grievance_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "grievance_id": {"type": "string", "description": "Real grievance ID only"}
                },
                "required": ["grievance_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_test_details",
            "description": (
                "Full test details: questions, marking scheme, per-question weight%, "
                "scheme mismatch detection, cross-teacher evaluation stats. "
                "Only call with a real test_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "test_id": {"type": "string", "description": "Real test ID only"}
                },
                "required": ["test_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_test_questions",
            "description": (
                "Questions and marks breakdown with per-question weight% and "
                "marking stats across all evaluations of this test. "
                "Use to verify teacher followed the marking scheme. "
                "Only call with a real test_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "test_id": {"type": "string", "description": "Real test ID only"}
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
                "Compare teacher vs department peers: avg marks%, peer avg%, "
                "difference, z-score, peer rank, is_outlier, per_peer_breakdown. "
                "Use days_back=365. REQUIRED for bias analysis. "
                "Only call with a real teacher_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string", "description": "Real teacher userId"},
                    "department": {"type": "string", "description": "Optional — auto-resolved from profile"},
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
                "Consolidated bias report computed from raw data: "
                "risk_level (LOW/MEDIUM/HIGH/CRITICAL), risk_flags[], "
                "marks_analysis, timing, grievance_stats, blockchain_stats. "
                "Call this as the FINAL tool in bias investigation "
                "to cross-check your own calculations. "
                "Only call with a real teacher_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_id": {"type": "string", "description": "Real teacher userId"}
                },
                "required": ["teacher_id"]
            }
        }
    }
]
