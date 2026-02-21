from db import get_collection, serialize_doc, serialize_docs
from datetime import datetime, timedelta
from collections import defaultdict


# ──────────────────────────────────────────────────────────────
# PUBLIC TOOLS
# ──────────────────────────────────────────────────────────────

def get_evaluation_by_submission(submission_id: str) -> dict:
    """
    Get the evaluation document for a specific submission.
    Now includes blockchain verification status and question-level flags.
    """
    try:
        col = get_collection("evaluations")
        doc = col.find_one({"submissionId": submission_id})

        if not doc:
            return {
                "success": False,
                "message": f"No evaluation found for submission {submission_id}",
            }

        s   = serialize_doc(doc)
        qms = s.get("questionMarks", [])

        total_awarded = sum(q.get("marksObtained", 0) for q in qms)
        total_max     = sum(q.get("maxMarks", 0)      for q in qms)
        pct           = (total_awarded / total_max * 100) if total_max > 0 else 0

        # ✅ Per-question breakdown with flags
        question_breakdown = []
        for q in qms:
            q_max     = q.get("maxMarks", 0)
            q_awarded = q.get("marksObtained", 0)
            q_pct     = round((q_awarded / q_max * 100), 2) if q_max else 0

            # Per-question flags
            q_flags = []
            if q_awarded == 0 and q_max > 0:
                q_flags.append("🚨 ZERO marks given")
            if q_pct == 100:
                q_flags.append("🔥 Full marks given")
            if q_pct < 20 and q_max > 0:
                q_flags.append("⚠️ Very low marks (<20%)")

            question_breakdown.append({
                "questionNumber": q.get("questionNumber"),
                "marksObtained":  q_awarded,
                "maxMarks":       q_max,
                "percentage":     q_pct,
                "comment":        q.get("comment", ""),
                "flags":          q_flags,
            })

        # ✅ Blockchain integrity check
        blockchain_verified = s.get("blockchainVerified", False)
        blockchain_flag     = None
        if not blockchain_verified:
            if total_awarded == 0:
                blockchain_flag = "🚨 CRITICAL: Unverified evaluation with zero marks"
            else:
                blockchain_flag = "⚠️ Evaluation not blockchain verified — integrity concern"

        s["computed"] = {
            "total_marks_obtained": total_awarded,
            "total_max_marks":      total_max,
            "percentage":           round(pct, 2),
            "grade":                _get_grade(pct),
            "question_breakdown":   question_breakdown,
        }

        # ✅ Surface blockchain status clearly
        s["blockchain_verified"] = blockchain_verified
        if blockchain_flag:
            s["blockchain_flag"] = blockchain_flag

        return {"success": True, "evaluation": s}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_evaluations_by_teacher(
    teacher_id: str,
    limit: int = 50,
    days_back: int = 365,
) -> dict:
    """
    Get all evaluations done by a specific teacher.
    Now includes full marks_analysis block, question-level bias aggregation,
    blockchain integrity stats, and per-eval summary for the LLM report table.
    """
    try:
        col   = get_collection("evaluations")
        since = datetime.utcnow() - timedelta(days=days_back)

        docs = list(
            col.find({
                "teacherId": teacher_id,
                "evaluatedAt": {"$gte": since},
            })
            .sort("evaluatedAt", -1)
            .limit(limit)
        )

        if not docs:
            return {
                "success":    True,
                "teacher_id": teacher_id,
                "message":    "No evaluations found for this teacher.",
                "total":      0,
                "evaluations": [],
                "marks_analysis": {},
                "question_level_analysis": {},
                "blockchain_stats": {},
                "eval_summary": [],
            }

        serialized = serialize_docs(docs)

        # ── Per-eval stats ────────────────────────────────────
        percentages        = []
        zero_mark_count    = 0
        eval_summary       = []

        # ✅ Question-level aggregation across all evals
        # q_data[qnum] = list of (marksObtained, maxMarks)
        q_data = defaultdict(list)

        # ✅ Blockchain tracking
        verified_count   = 0
        unverified_evals = []

        for ev in serialized:
            qms     = ev.get("questionMarks", [])
            total_a = sum(q.get("marksObtained", 0) for q in qms)
            total_m = sum(q.get("maxMarks", 0)      for q in qms)
            pct     = round((total_a / total_m * 100), 2) if total_m > 0 else 0

            ev["_pct"] = pct
            percentages.append(pct)

            if total_a == 0 and total_m > 0:
                zero_mark_count += 1

            # Blockchain
            bc_verified = ev.get("blockchainVerified", False)
            if bc_verified:
                verified_count += 1
            else:
                unverified_evals.append({
                    "evaluation_id":  ev.get("_id") or ev.get("evaluationId"),
                    "submission_id":  ev.get("submissionId"),
                    "marks_pct":      pct,
                    "is_zero_marked": total_a == 0,
                    "critical_flag":  (not bc_verified and total_a == 0),
                })

            # Per-question data collection
            for q in qms:
                qnum  = q.get("questionNumber")
                q_max = q.get("maxMarks", 0)
                q_got = q.get("marksObtained", 0)
                if qnum is not None and q_max > 0:
                    q_data[qnum].append((q_got, q_max))

            # Eval summary row (for LLM report table)
            eval_flags = []
            if total_a == 0 and total_m > 0:
                eval_flags.append("🚨 ZERO")
            if pct >= 95:
                eval_flags.append("🔥 Lenient")
            if pct < 20:
                eval_flags.append("⚠️ Very strict")
            if not bc_verified:
                eval_flags.append("❌ Unverified")

            eval_summary.append({
                "evaluation_id":     ev.get("_id") or ev.get("evaluationId"),
                "submission_id":     str(ev.get("submissionId", ""))[:12] + "...",
                "submission_id_full": ev.get("submissionId"),
                "marks_obtained":    total_a,
                "total_marks":       total_m,
                "percentage":        pct,
                "evaluated_at":      ev.get("evaluatedAt"),
                "blockchain_verified": bc_verified,
                "flags":             eval_flags,
            })

        # ── marks_analysis block ──────────────────────────────
        avg_pct  = round(sum(percentages) / len(percentages), 2) if percentages else 0
        variance = round(max(percentages) - min(percentages), 2) if percentages else 0

        # Strictness/leniency label
        strictness_label = _get_strictness_label(avg_pct)
        variance_label   = _get_variance_label(variance)

        marks_analysis = {
            "all_percentages":  [round(p, 2) for p in percentages],
            "average_pct":      avg_pct,
            "highest_pct":      round(max(percentages), 2) if percentages else 0,
            "lowest_pct":       round(min(percentages), 2) if percentages else 0,
            "variance":         variance,
            "zero_mark_count":  zero_mark_count,
            "strictness_label": strictness_label,
            "variance_label":   variance_label,
            "std_deviation":    _std_dev(percentages),
        }

        # ── Question-level bias aggregation ──────────────────
        question_level_analysis = _compute_question_level_bias(q_data)

        # ── Blockchain stats ──────────────────────────────────
        total_evals     = len(serialized)
        unverified_count = total_evals - verified_count
        unverified_pct   = round((unverified_count / total_evals * 100), 2) if total_evals else 0

        bc_flags = []
        critical_unverified = [e for e in unverified_evals if e["critical_flag"]]
        if critical_unverified:
            bc_flags.append(
                f"🚨 CRITICAL: {len(critical_unverified)} unverified eval(s) "
                f"with zero marks — possible tamper"
            )
        if unverified_pct > 30:
            bc_flags.append(
                f"⚠️ HIGH: {unverified_pct}% of evaluations are not blockchain verified"
            )
        elif unverified_count > 0:
            bc_flags.append(
                f"⚠️ {unverified_count} evaluation(s) not blockchain verified"
            )

        blockchain_stats = {
            "total_evaluations":    total_evals,
            "verified_count":       verified_count,
            "verified_pct":         round(verified_count / total_evals * 100, 2) if total_evals else 0,
            "unverified_count":     unverified_count,
            "unverified_pct":       unverified_pct,
            "unverified_evals":     unverified_evals,
            "critical_unverified":  len(critical_unverified),
            "flags":                bc_flags,
        }

        return {
            "success":                  True,
            "teacher_id":               teacher_id,
            "total":                    total_evals,
            "period_days":              days_back,
            "marks_analysis":           marks_analysis,           # ✅ full block
            "question_level_analysis":  question_level_analysis,  # ✅ NEW
            "blockchain_stats":         blockchain_stats,          # ✅ NEW
            "eval_summary":             eval_summary,              # ✅ for LLM table
            "evaluations":              serialized,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_evaluation_metrics(
    teacher_id: str = None,
    evaluation_id: str = None,
) -> dict:
    """
    Get pre-computed bias/quality metrics for a teacher or evaluation.
    Now surfaces all bias indicator types clearly.
    """
    try:
        col   = get_collection("evaluation_metrics")
        query = {}

        if teacher_id:
            query["teacherId"] = teacher_id
        if evaluation_id:
            query["evaluationId"] = evaluation_id

        docs = list(col.find(query).sort("createdAt", -1).limit(20))

        if not docs:
            return {
                "success": False,
                "message": "No metrics found. May not be computed yet for this teacher.",
            }

        serialized = serialize_docs(docs)

        # ── Aggregate bias indicators ─────────────────────────
        all_flags      = []
        quality_scores = []
        bias_summary   = {
            "fatigue_count":       0,
            "rushing_count":       0,
            "sequence_bias_count": 0,
        }

        for m in serialized:
            bi  = m.get("biasIndicators", {})
            eid = m.get("evaluationId", "?")

            if bi.get("fatigueDetected"):
                all_flags.append(f"😴 Fatigue detected in eval {eid}")
                bias_summary["fatigue_count"] += 1

            if bi.get("rushingDetected"):
                all_flags.append(
                    f"⚡ Rushing detected in eval {eid} "
                    f"(avg {bi.get('avgTimePerQuestion', '?')}s/q)"
                )
                bias_summary["rushing_count"] += 1

            if bi.get("hasSequenceBias"):
                all_flags.append(
                    f"🔢 Sequence bias ({bi.get('sequenceBiasTrend', '?')}) "
                    f"in eval {eid}"
                )
                bias_summary["sequence_bias_count"] += 1

            qs = m.get("evaluationQualityScore")
            if qs is not None:
                quality_scores.append(qs)

        avg_quality = (
            round(sum(quality_scores) / len(quality_scores), 2)
            if quality_scores else None
        )

        # Quality label
        quality_label = None
        if avg_quality is not None:
            if avg_quality >= 80:
                quality_label = "✅ Good quality"
            elif avg_quality >= 60:
                quality_label = "⚠️ Moderate quality"
            else:
                quality_label = "🚨 Poor quality"

        return {
            "success":           True,
            "total_found":       len(serialized),
            "avg_quality_score": avg_quality,
            "quality_label":     quality_label,
            "bias_summary":      bias_summary,
            "all_bias_flags":    all_flags,
            "metrics":           serialized,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# ──────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ──────────────────────────────────────────────────────────────

def _compute_question_level_bias(
    q_data: dict,  # {qnum: [(marksObtained, maxMarks), ...]}
) -> dict:
    """
    For each question number, compute avg marks%, std deviation,
    always-zero flag, and systematic under-marking flag.
    """
    if not q_data:
        return {"available": False, "reason": "No question-level data"}

    per_question = {}
    flagged_questions = []

    for qnum, entries in sorted(q_data.items()):
        pcts = [
            round((got / mx * 100), 2)
            for got, mx in entries
            if mx > 0
        ]
        if not pcts:
            continue

        avg_pct     = round(sum(pcts) / len(pcts), 2)
        std_dev_val = _std_dev(pcts)
        always_zero = all(p == 0 for p in pcts)
        always_full = all(p == 100 for p in pcts)

        q_flags = []
        if always_zero:
            q_flags.append(f"🚨 CRITICAL: Q{qnum} always 0 across all evaluations")
        if avg_pct < 20:
            q_flags.append(f"⚠️ Q{qnum} avg < 20% — systematically under-marked")
        if std_dev_val > 40:
            q_flags.append(f"⚠️ Q{qnum} std_dev={std_dev_val}% — highly inconsistent")
        if always_full:
            q_flags.append(f"🔥 Q{qnum} always full marks — possibly not being evaluated")

        per_question[str(qnum)] = {
            "avg_marks_pct":   avg_pct,
            "std_deviation":   std_dev_val,
            "sample_count":    len(pcts),
            "all_pcts":        pcts,
            "always_zero":     always_zero,
            "always_full":     always_full,
            "flags":           q_flags,
        }

        if q_flags:
            flagged_questions.append({
                "question_number": qnum,
                "avg_marks_pct":   avg_pct,
                "flags":           q_flags,
            })

    return {
        "available":         True,
        "per_question":      per_question,
        "flagged_questions": flagged_questions,
        "total_flagged":     len(flagged_questions),
    }


def _std_dev(values: list) -> float:
    """Compute population standard deviation — no numpy needed."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return round(variance ** 0.5, 2)


def _get_grade(pct: float) -> str:
    if pct >= 90: return "A+"
    if pct >= 80: return "A"
    if pct >= 70: return "B+"
    if pct >= 60: return "B"
    if pct >= 50: return "C"
    if pct >= 40: return "D"
    return "F"


def _get_strictness_label(avg_pct: float) -> str:
    if avg_pct < 25:  return "🚨 Severely strict (<25%)"
    if avg_pct < 40:  return "⚠️ Strict (<40%)"
    if avg_pct > 90:  return "⚠️ Severely lenient (>90%)"
    if avg_pct > 75:  return "⚠️ Lenient (>75%)"
    return "✅ Normal range (40–75%)"


def _get_variance_label(variance: float) -> str:
    if variance > 70: return "🚨 CRITICAL inconsistency (>70%)"
    if variance > 50: return "⚠️ HIGH inconsistency (>50%)"
    if variance > 30: return "⚠️ MEDIUM inconsistency (>30%)"
    return "✅ Low variance (<30%)"
