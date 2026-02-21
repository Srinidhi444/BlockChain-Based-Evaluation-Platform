from db import get_collection, serialize_docs, serialize_doc
from datetime import datetime, timedelta
from collections import defaultdict


def get_audit_logs(
    teacher_id: str = None,
    submission_id: str = None,
    evaluation_id: str = None,
    event_type: str = None,
    days_back: int = 365,
    limit: int = 100,
) -> dict:
    """
    Retrieve audit logs from audit_logs collection.
    Filter by teacher, submission, evaluation, or event type.
    Now includes fatigue analysis, sequence bias, and session grouping.
    """
    try:
        col   = get_collection("audit_logs")
        query = {}

        if teacher_id:
            query["userId"] = teacher_id
        if submission_id:
            query["submissionId"] = submission_id
        if evaluation_id:
            query["evaluationId"] = evaluation_id
        if event_type:
            query["eventType"] = event_type

        query["timestamp"] = {
            "$gte": datetime.utcnow() - timedelta(days=days_back)
        }

        # ✅ Sort ASC for session-order analysis (fatigue/sequence)
        logs = list(
            col.find(query)
               .sort("timestamp", 1)
               .limit(limit)
        )
        serialized = serialize_docs(logs)

        # ── Basic summary ─────────────────────────────────────
        event_counts     = {}
        total_time_spent = 0
        question_times   = []

        for log in serialized:
            et = log.get("eventType", "unknown")
            event_counts[et] = event_counts.get(et, 0) + 1

            if log.get("timeSpent"):
                total_time_spent += log["timeSpent"]
                question_times.append({
                    "questionNumber": log.get("questionNumber"),
                    "timeSpent":      log.get("timeSpent"),
                    "marksAwarded":   log.get("marksAwarded"),
                    "maxMarks":       log.get("maxMarks"),
                    "submissionId":   log.get("submissionId"),
                    "timestamp":      log.get("timestamp"),   # ✅ NEW
                })

        # ── Fatigue analysis ──────────────────────────────────
        fatigue_analysis = _compute_fatigue_analysis(question_times)

        # ── Sequence bias analysis ────────────────────────────
        sequence_analysis = _compute_sequence_bias(question_times)

        # ── Per-session grouping ──────────────────────────────
        session_breakdown = _compute_session_breakdown(serialized)

        return {
            "success":                  True,
            "total_found":              len(serialized),
            "event_counts":             event_counts,
            "total_time_spent_seconds": total_time_spent,
            "question_timings":         question_times,
            "fatigue_analysis":         fatigue_analysis,    # ✅ NEW
            "sequence_analysis":        sequence_analysis,   # ✅ NEW
            "session_breakdown":        session_breakdown,   # ✅ NEW
            "logs":                     serialized,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# ──────────────────────────────────────────────────────────────
# PRIVATE HELPERS — Fatigue, Sequence, Session
# ──────────────────────────────────────────────────────────────

def _compute_fatigue_analysis(question_times: list) -> dict:
    """
    Detect fatigue bias: does the teacher spend significantly less
    time (and give lower marks) as a session progresses?

    Uses all question_marked events in chronological order.
    Splits into first-half and second-half by position.
    """
    if len(question_times) < 4:
        return {
            "available": False,
            "reason": "Not enough questions to compute fatigue (need >= 4)",
        }

    mid   = len(question_times) // 2
    first = question_times[:mid]
    last  = question_times[mid:]

    first_times = [q["timeSpent"] for q in first if q.get("timeSpent")]
    last_times  = [q["timeSpent"] for q in last  if q.get("timeSpent")]

    if not first_times or not last_times:
        return {"available": False, "reason": "timeSpent data missing"}

    first_avg = sum(first_times) / len(first_times)
    last_avg  = sum(last_times)  / len(last_times)

    # Drop ratio: how much did speed drop
    drop_ratio    = (last_avg / first_avg * 100) if first_avg > 0 else 100
    time_drop_pct = round(100 - drop_ratio, 2)

    # Fatigue level from prompts thresholds
    if drop_ratio < 50:
        fatigue_level = "CRITICAL"
        fatigue_flag  = "🚨 CRITICAL fatigue — second half < 50% of first half speed"
    elif drop_ratio < 70:
        fatigue_level = "HIGH"
        fatigue_flag  = "⚠️ HIGH fatigue — second half < 70% of first half speed"
    elif drop_ratio < 85:
        fatigue_level = "MEDIUM"
        fatigue_flag  = "⚠️ MEDIUM fatigue — second half < 85% of first half speed"
    else:
        fatigue_level = "NONE"
        fatigue_flag  = None

    # Marks trend across session
    first_marks = [
        (q["marksAwarded"] / q["maxMarks"] * 100)
        for q in first
        if q.get("marksAwarded") is not None and q.get("maxMarks")
    ]
    last_marks = [
        (q["marksAwarded"] / q["maxMarks"] * 100)
        for q in last
        if q.get("marksAwarded") is not None and q.get("maxMarks")
    ]

    first_marks_avg = round(sum(first_marks) / len(first_marks), 2) if first_marks else None
    last_marks_avg  = round(sum(last_marks)  / len(last_marks),  2) if last_marks  else None

    if first_marks_avg and last_marks_avg:
        if last_marks_avg < first_marks_avg - 15:
            marks_trend = "Declining"
        elif last_marks_avg > first_marks_avg + 15:
            marks_trend = "Inclining"
        else:
            marks_trend = "Stable"
    else:
        marks_trend = "Insufficient data"

    result = {
        "available":          True,
        "total_questions":    len(question_times),
        "first_half_count":   len(first),
        "second_half_count":  len(last),
        "first_half_avg_time": round(first_avg, 2),
        "second_half_avg_time": round(last_avg, 2),
        "time_drop_pct":      time_drop_pct,
        "drop_ratio_pct":     round(drop_ratio, 2),
        "fatigue_level":      fatigue_level,
        "first_half_avg_marks_pct":  first_marks_avg,
        "second_half_avg_marks_pct": last_marks_avg,
        "marks_trend":        marks_trend,
    }

    if fatigue_flag:
        result["flag"] = fatigue_flag

    return result


def _compute_sequence_bias(question_times: list) -> dict:
    """
    Detect sequence bias: do later question numbers consistently
    receive lower marks than earlier ones?

    Groups by question_number and computes avg marks% per question.
    Also computes Pearson correlation between q_number and marks%.
    """
    if not question_times:
        return {"available": False, "reason": "No question timing data"}

    # Group by question number
    q_marks = defaultdict(list)
    for q in question_times:
        qnum = q.get("questionNumber")
        if qnum is not None and q.get("marksAwarded") is not None and q.get("maxMarks"):
            pct = (q["marksAwarded"] / q["maxMarks"]) * 100
            q_marks[qnum].append(pct)

    if len(q_marks) < 2:
        return {"available": False, "reason": "Need >= 2 distinct question numbers"}

    # Per-question averages
    per_question = {}
    for qnum, pcts in sorted(q_marks.items()):
        per_question[str(qnum)] = {
            "avg_marks_pct": round(sum(pcts) / len(pcts), 2),
            "sample_count":  len(pcts),
            "always_zero":   all(p == 0 for p in pcts),
        }

    # Pearson correlation between question_number and avg_marks_pct
    q_nums  = sorted(q_marks.keys())
    avgs    = [sum(q_marks[q]) / len(q_marks[q]) for q in q_nums]
    corr    = _pearson_correlation(
        [float(q) for q in q_nums],
        avgs,
    )

    # First vs last question comparison
    first_q_avg = avgs[0]  if avgs else None
    last_q_avg  = avgs[-1] if avgs else None
    first_last_diff = (
        round(first_q_avg - last_q_avg, 2)
        if first_q_avg is not None and last_q_avg is not None
        else None
    )

    # Pattern detection
    if corr is not None and corr < -0.5:
        pattern = "Late-penalise"
        bias_flag = f"⚠️ HIGH sequence bias — correlation={round(corr, 3)} (threshold: -0.5)"
        bias_level = "HIGH"
    elif first_last_diff is not None and first_last_diff > 30:
        pattern = "Early-favour"
        bias_flag = f"⚠️ MEDIUM sequence bias — Q1 avg is {first_last_diff}% higher than last Q"
        bias_level = "MEDIUM"
    else:
        pattern   = "Uniform"
        bias_flag = None
        bias_level = "NONE"

    # Always-zero question flags
    always_zero_qs = [
        qnum for qnum, data in per_question.items()
        if data["always_zero"]
    ]

    result = {
        "available":           True,
        "per_question_avg":    per_question,
        "correlation":         round(corr, 4) if corr is not None else None,
        "first_question_avg":  round(first_q_avg, 2) if first_q_avg is not None else None,
        "last_question_avg":   round(last_q_avg,  2) if last_q_avg  is not None else None,
        "first_last_diff_pct": first_last_diff,
        "pattern":             pattern,
        "sequence_bias_level": bias_level,
    }

    if always_zero_qs:
        result["always_zero_questions"] = always_zero_qs
        result["always_zero_flag"] = (
            f"🚨 CRITICAL — Questions {always_zero_qs} always marked 0 across all evaluations"
        )

    if bias_flag:
        result["flag"] = bias_flag

    return result


def _compute_session_breakdown(logs: list) -> list:
    """
    Group logs by submissionId to give per-session stats:
    total time, question count, avg time, marks pattern.
    Useful for spotting individual sessions where rushing occurred.
    """
    sessions = defaultdict(lambda: {
        "questions": [],
        "times":     [],
        "marks_pcts": [],
        "started_at": None,
        "completed_at": None,
    })

    for log in logs:
        sid = log.get("submissionId")
        if not sid:
            continue

        et = log.get("eventType")
        if et == "evaluation_started":
            sessions[sid]["started_at"] = log.get("timestamp")
        elif et == "evaluation_completed":
            sessions[sid]["completed_at"] = log.get("timestamp")
        elif et == "question_marked":
            ts   = log.get("timeSpent")
            maw  = log.get("marksAwarded")
            maxm = log.get("maxMarks")
            qnum = log.get("questionNumber")

            if ts:
                sessions[sid]["times"].append(ts)
            if maw is not None and maxm and maxm > 0:
                sessions[sid]["marks_pcts"].append(
                    round((maw / maxm) * 100, 2)
                )
            sessions[sid]["questions"].append(qnum)

    breakdown = []
    for sid, data in sessions.items():
        times      = data["times"]
        marks_pcts = data["marks_pcts"]

        avg_time   = round(sum(times) / len(times), 2) if times else None
        avg_marks  = round(sum(marks_pcts) / len(marks_pcts), 2) if marks_pcts else None

        # Per-session speed flag
        speed_flag = None
        if avg_time is not None:
            if avg_time < 5:
                speed_flag = "🚨 CRITICAL rushing"
            elif avg_time < 10:
                speed_flag = "⚠️ HIGH rushing"
            elif avg_time < 20:
                speed_flag = "⚠️ MEDIUM speed"

        breakdown.append({
            "submission_id":        sid,
            "question_count":       len(data["questions"]),
            "avg_time_per_question": avg_time,
            "avg_marks_pct":        avg_marks,
            "started_at":           data["started_at"],
            "completed_at":         data["completed_at"],
            "speed_flag":           speed_flag,
        })

    # Sort by avg_time ascending (fastest sessions first)
    breakdown.sort(key=lambda x: x["avg_time_per_question"] or 999)
    return breakdown


def _pearson_correlation(x: list, y: list) -> float | None:
    """Compute Pearson r between two equal-length lists."""
    n = len(x)
    if n < 2 or len(y) != n:
        return None

    mean_x = sum(x) / n
    mean_y = sum(y) / n

    num   = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    den_x = sum((xi - mean_x) ** 2 for xi in x) ** 0.5
    den_y = sum((yi - mean_y) ** 2 for yi in y) ** 0.5

    if den_x == 0 or den_y == 0:
        return None

    return round(num / (den_x * den_y), 4)


# ──────────────────────────────────────────────────────────────


def get_teacher_audit_summary(teacher_id: str, days_back: int = 365) -> dict:
    """
    Full behavioural summary for a teacher across all evaluations.
    Now includes fatigue analysis, sequence bias, and per-session breakdown.
    """
    try:
        col   = get_collection("audit_logs")
        since = datetime.utcnow() - timedelta(days=days_back)

        # ✅ Sort ASC for chronological session analysis
        question_logs = list(col.find({
            "userId":    teacher_id,
            "eventType": "question_marked",
            "timestamp": {"$gte": since},
        }).sort("timestamp", 1))

        if not question_logs:
            return {
                "success":               True,
                "teacher_id":            teacher_id,
                "message":               "No evaluation activity found in this period.",
                "total_questions_marked": 0,
            }

        # ── Timing stats ──────────────────────────────────────
        times = [
            log["timeSpent"]
            for log in question_logs
            if log.get("timeSpent") is not None
        ]

        marks_pcts = []
        for log in question_logs:
            if log.get("maxMarks") and log["maxMarks"] > 0:
                pct = (log.get("marksAwarded", 0) / log["maxMarks"]) * 100
                marks_pcts.append(pct)

        avg_time      = sum(times)      / len(times)      if times      else 0
        avg_marks_pct = sum(marks_pcts) / len(marks_pcts) if marks_pcts else 0
        min_time      = min(times) if times else 0
        max_time      = max(times) if times else 0

        # ── Evaluation counts ─────────────────────────────────
        started_count = col.count_documents({
            "userId":    teacher_id,
            "eventType": "evaluation_started",
            "timestamp": {"$gte": since},
        })
        completed_count = col.count_documents({
            "userId":    teacher_id,
            "eventType": "evaluation_completed",
            "timestamp": {"$gte": since},
        })

        # ── Flags (speed + marking) ───────────────────────────
        flags = []
        if avg_time < 5:
            flags.append("🚨 CRITICAL: Avg time/question < 5s (severe rushing)")
        elif avg_time < 10:
            flags.append("⚠️ HIGH: Avg time/question < 10s (rushing)")
        elif avg_time < 20:
            flags.append("⚠️ MEDIUM: Avg time/question < 20s (borderline)")
        if min_time < 2:
            flags.append("🚨 CRITICAL: Some questions marked in < 2s (instant marking)")
        elif min_time < 5:
            flags.append("⚠️ Some questions marked in < 5s")
        if avg_marks_pct < 25:
            flags.append("🚨 CRITICAL: Avg marks < 25% (severely strict)")
        elif avg_marks_pct < 40:
            flags.append("⚠️ HIGH: Avg marks < 40% (strict)")
        if avg_marks_pct > 90:
            flags.append("⚠️ HIGH: Avg marks > 90% (very lenient)")
        elif avg_marks_pct > 75:
            flags.append("⚠️ MEDIUM: Avg marks > 75% (lenient)")
        if max_time > 600:
            flags.append("⚠️ Some questions took > 600s (possible distraction)")

        # ── Fatigue & sequence analysis ───────────────────────
        question_times_list = [
            {
                "questionNumber": log.get("questionNumber"),
                "timeSpent":      log.get("timeSpent"),
                "marksAwarded":   log.get("marksAwarded"),
                "maxMarks":       log.get("maxMarks"),
                "submissionId":   log.get("submissionId"),
                "timestamp":      log.get("timestamp"),
            }
            for log in question_logs
        ]

        fatigue_analysis  = _compute_fatigue_analysis(question_times_list)
        sequence_analysis = _compute_sequence_bias(question_times_list)

        # Add fatigue/sequence flags to main flags list
        if fatigue_analysis.get("flag"):
            flags.append(fatigue_analysis["flag"])
        if sequence_analysis.get("flag"):
            flags.append(sequence_analysis["flag"])
        if sequence_analysis.get("always_zero_flag"):
            flags.append(sequence_analysis["always_zero_flag"])

        # ── Per-session breakdown ─────────────────────────────
        all_logs_for_teacher = list(col.find({
            "userId":    teacher_id,
            "timestamp": {"$gte": since},
        }).sort("timestamp", 1))

        session_breakdown = _compute_session_breakdown(
            serialize_docs(all_logs_for_teacher)
        )

        # Fastest sessions (top 5 — most suspicious)
        fastest_sessions = session_breakdown[:5]

        return {
            "success":                  True,
            "teacher_id":               teacher_id,
            "period_days":              days_back,
            "total_questions_marked":   len(question_logs),
            "evaluations_started":      started_count,
            "evaluations_completed":    completed_count,
            "timing": {
                "avg_seconds_per_question": round(avg_time, 2),
                "min_seconds":              min_time,
                "max_seconds":              max_time,
            },
            "marking": {
                "avg_marks_percentage":   round(avg_marks_pct, 2),
                "total_questions_marked": len(marks_pcts),
            },
            "fatigue_analysis":          fatigue_analysis,    # ✅ NEW
            "sequence_analysis":         sequence_analysis,   # ✅ NEW
            "fastest_sessions":          fastest_sessions,    # ✅ NEW
            "flags":                     flags,
            "is_flagged":                len(flags) > 0,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
