from db import get_collection, serialize_doc, serialize_docs
from collections import defaultdict


# ──────────────────────────────────────────────────────────────
# PUBLIC TOOLS
# ──────────────────────────────────────────────────────────────

def get_grievances_by_teacher(
    teacher_id: str,
    limit: int = 50,
) -> dict:
    """
    Get all grievances filed against a specific teacher's evaluations.
    Now includes reevaluation pattern analysis, severity scoring,
    per-submission breakdown, and full mark change stats.
    """
    try:
        grv_col   = get_collection("grievances")
        reval_col = get_collection("reevaluations")
        eval_col  = get_collection("evaluations")

        # ── Get submission IDs evaluated by this teacher ──────
        evals = list(eval_col.find(
            {"teacherId": teacher_id},
            {"submissionId": 1, "_id": 0}
        ))
        sub_ids = [e["submissionId"] for e in evals if e.get("submissionId")]

        if not sub_ids:
            return {
                "success":    True,
                "teacher_id": teacher_id,
                "message":    "No evaluations found for this teacher — cannot look up grievances.",
                "total":      0,
                "grievances": [],
                "grievance_stats": {},
            }

        # ── Fetch grievances against those submissions ────────
        grievances = list(
            grv_col.find({"submissionId": {"$in": sub_ids}})
                   .sort("filedAt", -1)
                   .limit(limit)
        )

        if not grievances:
            return {
                "success":    True,
                "teacher_id": teacher_id,
                "message":    "No grievances found for this teacher's evaluations.",
                "total":      0,
                "grievances": [],
                "grievance_stats": {
                    "total":            0,
                    "success_rate_pct": 0,
                    "avg_mark_change":  0,
                },
            }

        serialized = serialize_docs(grievances)

        # ── Enrich each grievance with reevaluation outcome ───
        successful         = 0
        total_mark_change  = 0
        mark_changes       = []
        status_counts      = defaultdict(int)
        severity_counts    = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        largest_change     = {"value": 0, "grievance_id": None, "submission_id": None}
        per_submission     = {}   # submissionId → grievance + outcome summary

        for g in serialized:
            gid = g.get("grievanceId") or str(g.get("_id", ""))
            sid = g.get("submissionId")

            status = g.get("status", "unknown")
            status_counts[status] += 1

            # ── Fetch reevaluation ────────────────────────────
            reval_doc = reval_col.find_one({"grievanceId": gid})

            if reval_doc:
                r      = serialize_doc(reval_doc)
                orig   = r.get("originalMarks", 0)
                new    = r.get("newMarks", 0)
                diff   = new - orig
                abs_diff = abs(diff)

                # Severity of this individual correction
                severity = _mark_change_severity(abs_diff)
                severity_counts[severity] += 1

                # Direction
                direction = (
                    "increased" if diff > 0
                    else "decreased" if diff < 0
                    else "unchanged"
                )

                pct_change = round((diff / orig * 100), 2) if orig > 0 else 0

                g["reevaluation_outcome"] = {
                    "reevaluation_id": r.get("_id") or r.get("reevaluationId"),
                    "original_marks":  orig,
                    "new_marks":       new,
                    "difference":      diff,
                    "abs_difference":  abs_diff,
                    "direction":       direction,
                    "pct_change":      pct_change,
                    "marks_changed":   diff != 0,
                    "severity":        severity,
                    "severity_flag":   _severity_flag(severity, abs_diff),
                }

                if diff != 0:
                    successful        += 1
                    total_mark_change += abs_diff
                    mark_changes.append(abs_diff)

                    # Track largest single correction
                    if abs_diff > largest_change["value"]:
                        largest_change = {
                            "value":         abs_diff,
                            "grievance_id":  gid,
                            "submission_id": sid,
                            "direction":     direction,
                            "pct_change":    pct_change,
                        }

            else:
                g["reevaluation_outcome"] = None

            # ── Per-submission summary ────────────────────────
            if sid:
                per_submission[sid] = {
                    "grievance_id":  gid,
                    "status":        status,
                    "reason":        g.get("reason", ""),
                    "filed_at":      g.get("filedAt"),
                    "mark_change":   g.get("reevaluation_outcome", {}).get("difference") if g.get("reevaluation_outcome") else None,
                    "severity":      g.get("reevaluation_outcome", {}).get("severity")   if g.get("reevaluation_outcome") else None,
                }

        total          = len(serialized)
        success_rate   = round((successful / total * 100), 2) if total > 0 else 0
        avg_change     = round(total_mark_change / successful, 2) if successful > 0 else 0
        max_change     = max(mark_changes) if mark_changes else 0

        # ── Pattern analysis ✅ NEW ───────────────────────────
        pattern_analysis = _compute_grievance_pattern(
            serialized         = serialized,
            success_rate       = success_rate,
            avg_change         = avg_change,
            total              = total,
            largest_change     = largest_change,
            severity_counts    = severity_counts,
        )

        # ── Aggregate flags ───────────────────────────────────
        flags = []
        if success_rate > 60:
            flags.append(
                f"🚨 HIGH: {success_rate}% grievance success rate — "
                f"students consistently under-marked (threshold: >60%)"
            )
        elif success_rate > 40:
            flags.append(
                f"⚠️ MEDIUM: {success_rate}% grievance success rate "
                f"(threshold: >40%)"
            )
        if avg_change > 20:
            flags.append(
                f"🚨 HIGH: avg mark change={avg_change} after reevaluation "
                f"(threshold: >20)"
            )
        elif avg_change > 10:
            flags.append(
                f"⚠️ MEDIUM: avg mark change={avg_change} after reevaluation "
                f"(threshold: >10)"
            )
        if total >= 3:
            flags.append(
                f"⚠️ Pattern: {total} grievances filed (threshold: ≥3)"
            )
        if largest_change["value"] > 30:
            flags.append(
                f"🚨 CRITICAL single correction: {largest_change['value']} marks "
                f"on submission {largest_change.get('submission_id')} "
                f"(threshold: >30)"
            )
        if severity_counts["CRITICAL"] > 0:
            flags.append(
                f"🚨 {severity_counts['CRITICAL']} CRITICAL severity correction(s) found"
            )

        return {
            "success":    True,
            "teacher_id": teacher_id,
            "total":      total,

            # ── Core stats (what prompts.py reads) ────────────
            "successful_grievances": successful,
            "success_rate_pct":      success_rate,
            "avg_mark_change":       avg_change,
            "max_mark_change":       max_change,
            "largest_single_correction": largest_change,

            # ── Breakdowns ────────────────────────────────────
            "status_counts":    dict(status_counts),
            "severity_counts":  severity_counts,        # ✅ NEW
            "pattern_analysis": pattern_analysis,       # ✅ NEW
            "per_submission":   per_submission,         # ✅ NEW
            "flags":            flags,
            "grievances":       serialized,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_grievance_by_id(grievance_id: str) -> dict:
    """
    Get a specific grievance by ID.
    Now includes full reevaluation comparison and severity flag.
    """
    try:
        grv_col   = get_collection("grievances")
        reval_col = get_collection("reevaluations")

        doc = grv_col.find_one({"grievanceId": grievance_id})
        if not doc:
            # Fallback: try _id
            doc = grv_col.find_one({"_id": grievance_id})
        if not doc:
            return {
                "success": False,
                "message": f"Grievance not found: {grievance_id}",
            }

        g = serialize_doc(doc)

        # ── Attach reevaluation ───────────────────────────────
        reval_doc = reval_col.find_one({"grievanceId": grievance_id})
        if reval_doc:
            r        = serialize_doc(reval_doc)
            orig     = r.get("originalMarks", 0)
            new      = r.get("newMarks", 0)
            diff     = new - orig
            abs_diff = abs(diff)
            severity = _mark_change_severity(abs_diff)

            r["analysis"] = {
                "marks_difference":   diff,
                "abs_difference":     abs_diff,
                "direction":          "increased" if diff > 0 else "decreased" if diff < 0 else "unchanged",
                "pct_change":         round((diff / orig * 100), 2) if orig > 0 else 0,
                "significant_change": abs_diff > 10,
                "severity":           severity,
                "severity_flag":      _severity_flag(severity, abs_diff),
            }
            g["reevaluation"] = r
        else:
            g["reevaluation"] = None

        return {"success": True, "grievance": g}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_reevaluation_by_grievance(grievance_id: str) -> dict:
    """
    Get reevaluation result for a given grievance.
    Now includes severity scoring and bias implication.
    """
    try:
        col = get_collection("reevaluations")
        doc = col.find_one({"grievanceId": grievance_id})

        if not doc:
            return {
                "success": False,
                "message": f"No reevaluation found for grievance: {grievance_id}",
            }

        r        = serialize_doc(doc)
        orig     = r.get("originalMarks", 0)
        new      = r.get("newMarks", 0)
        diff     = new - orig
        abs_diff = abs(diff)
        severity = _mark_change_severity(abs_diff)

        # Bias implication
        if abs_diff > 30:
            bias_implication = (
                "🚨 CRITICAL: Original marks were severely wrong — "
                "strong evidence of deliberate under/over marking"
            )
        elif abs_diff > 20:
            bias_implication = (
                "⚠️ HIGH: Significant marking error — "
                "likely bias or negligence in original evaluation"
            )
        elif abs_diff > 10:
            bias_implication = (
                "⚠️ MEDIUM: Moderate marking error — "
                "original evaluation was inaccurate"
            )
        else:
            bias_implication = (
                "ℹ️ LOW: Minor correction — "
                "may be within acceptable margin of error"
            )

        r["analysis"] = {
            "original_marks":   orig,
            "new_marks":        new,
            "marks_difference": diff,
            "abs_difference":   abs_diff,
            "direction":        "increased" if diff > 0 else "decreased" if diff < 0 else "unchanged",
            "pct_change":       round((diff / orig * 100), 2) if orig > 0 else 0,
            "significant_change": abs_diff > 10,
            "severity":         severity,
            "severity_flag":    _severity_flag(severity, abs_diff),
            "bias_implication": bias_implication,   # ✅ NEW
        }

        return {"success": True, "reevaluation": r}

    except Exception as e:
        return {"success": False, "error": str(e)}


# ──────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ──────────────────────────────────────────────────────────────

def _mark_change_severity(abs_diff: float) -> str:
    """Classify the severity of a mark change after reevaluation."""
    if abs_diff > 30:  return "CRITICAL"
    if abs_diff > 20:  return "HIGH"
    if abs_diff > 10:  return "MEDIUM"
    return "LOW"


def _severity_flag(severity: str, abs_diff: float) -> str:
    flags = {
        "CRITICAL": f"🚨 CRITICAL correction: {abs_diff} marks changed",
        "HIGH":     f"⚠️ HIGH correction: {abs_diff} marks changed",
        "MEDIUM":   f"⚠️ MEDIUM correction: {abs_diff} marks changed",
        "LOW":      f"ℹ️ LOW correction: {abs_diff} marks changed",
    }
    return flags.get(severity, "")


def _compute_grievance_pattern(
    serialized: list,
    success_rate: float,
    avg_change: float,
    total: int,
    largest_change: dict,
    severity_counts: dict,
) -> dict:
    """
    Analyse the pattern of grievances to detect systemic under-marking
    vs isolated incidents. Checks for:
    - Repeated grievances on same subject/test
    - Time clustering (many grievances in short period)
    - Consistent under-marking direction (all mark increases)
    """
    if not serialized:
        return {"available": False}

    # Direction analysis — are all corrections upward (under-marking)?
    directions = []
    for g in serialized:
        outcome = g.get("reevaluation_outcome")
        if outcome and outcome.get("marks_changed"):
            directions.append(outcome.get("direction"))

    upward_count   = directions.count("increased")
    downward_count = directions.count("decreased")
    total_resolved = len(directions)

    all_upward = (
        total_resolved > 0 and downward_count == 0
    )
    mostly_upward = (
        total_resolved > 0 and
        upward_count / total_resolved >= 0.75
    )

    # Reason clustering — are students complaining about same thing?
    reason_counts = defaultdict(int)
    for g in serialized:
        reason = g.get("reason", "").strip().lower()
        if reason:
            reason_counts[reason] += 1

    top_reasons = sorted(
        reason_counts.items(),
        key=lambda x: x[1],
        reverse=True
    )[:3]

    # Pattern verdict
    if all_upward and total >= 3 and avg_change > 15:
        pattern_verdict = (
            "🚨 SYSTEMIC UNDER-MARKING: All reevaluations corrected marks "
            "upward — teacher consistently under-marks students"
        )
        pattern_level = "CRITICAL"
    elif mostly_upward and total >= 2:
        pattern_verdict = (
            "⚠️ PROBABLE UNDER-MARKING: Most corrections were upward — "
            "strong pattern of under-marking"
        )
        pattern_level = "HIGH"
    elif total >= 3 and success_rate > 50:
        pattern_verdict = (
            "⚠️ RECURRING PATTERN: Multiple successful grievances indicate "
            "consistent evaluation errors"
        )
        pattern_level = "MEDIUM"
    elif total == 0:
        pattern_verdict = "✅ No grievances — no pattern to analyse"
        pattern_level   = "NONE"
    else:
        pattern_verdict = "ℹ️ Isolated incidents — no clear systemic pattern"
        pattern_level   = "LOW"

    return {
        "available":       True,
        "pattern_verdict": pattern_verdict,
        "pattern_level":   pattern_level,
        "direction_analysis": {
            "total_resolved":  total_resolved,
            "upward_count":    upward_count,
            "downward_count":  downward_count,
            "all_upward":      all_upward,
            "mostly_upward":   mostly_upward,
        },
        "top_complaint_reasons": top_reasons,
        "largest_correction":    largest_change,
        "severity_distribution": severity_counts,
    }
