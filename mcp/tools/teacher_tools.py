from db import get_collection, serialize_doc, serialize_docs
from datetime import datetime, timedelta
from collections import defaultdict


# ──────────────────────────────────────────────────────────────
# PUBLIC TOOLS
# ──────────────────────────────────────────────────────────────

def get_teacher_profile(teacher_id: str) -> dict:
    """
    Get a teacher's profile enriched with evaluation activity summary,
    grievance count, risk snapshot, and blockchain integrity stats.
    """
    try:
        users_col  = get_collection("users")
        eval_col   = get_collection("evaluations")
        grv_col    = get_collection("grievances")
        audit_col  = get_collection("audit_logs")

        doc = users_col.find_one(
            {"userId": teacher_id, "role": "teacher"},
            {"password": 0, "__v": 0}
        )

        if not doc:
            return {
                "success": False,
                "message": f"Teacher not found: {teacher_id}",
            }

        teacher = serialize_doc(doc)

        # ── Evaluation activity snapshot ──────────────────────
        since_1yr = datetime.utcnow() - timedelta(days=365)

        evals = list(eval_col.find(
            {"teacherId": teacher_id, "evaluatedAt": {"$gte": since_1yr}},
            {"questionMarks": 1, "blockchainVerified": 1,
             "submissionId": 1, "evaluatedAt": 1}
        ))

        total_evals     = len(evals)
        sub_ids         = [e.get("submissionId") for e in evals if e.get("submissionId")]
        percentages     = []
        zero_count      = 0
        unverified_count = 0

        for ev in evals:
            qms     = ev.get("questionMarks", [])
            total_a = sum(q.get("marksObtained", 0) for q in qms)
            total_m = sum(q.get("maxMarks", 0)      for q in qms)
            if total_m > 0:
                percentages.append((total_a / total_m) * 100)
            if total_a == 0 and total_m > 0:
                zero_count += 1
            if not ev.get("blockchainVerified", True):
                unverified_count += 1

        avg_marks_pct = (
            round(sum(percentages) / len(percentages), 2)
            if percentages else None
        )

        # ── Grievance snapshot ────────────────────────────────
        total_grievances = grv_col.count_documents(
            {"submissionId": {"$in": sub_ids}}
        ) if sub_ids else 0

        resolved_grievances = grv_col.count_documents({
            "submissionId": {"$in": sub_ids},
            "status": {"$in": ["completed", "resolved", "upheld"]},
        }) if sub_ids else 0

        grievance_rate = (
            round(resolved_grievances / total_grievances * 100, 2)
            if total_grievances > 0 else 0
        )

        # ── Speed snapshot ────────────────────────────────────
        q_logs = list(audit_col.find(
            {"userId": teacher_id, "eventType": "question_marked"},
            {"timeSpent": 1}
        ).limit(200))
        times    = [l["timeSpent"] for l in q_logs if l.get("timeSpent") is not None]
        avg_time = round(sum(times) / len(times), 2) if times else None

        # ── Quick risk snapshot ───────────────────────────────
        risk_flags = []
        if zero_count >= 3:
            risk_flags.append(f"🚨 {zero_count} zero-marked evaluations")
        if avg_time and avg_time < 10:
            risk_flags.append(f"⚠️ Avg marking speed {avg_time}s/question")
        if grievance_rate > 50:
            risk_flags.append(f"⚠️ {grievance_rate}% grievance success rate")
        if unverified_count > 0:
            risk_flags.append(f"⚠️ {unverified_count} unverified evaluations")

        teacher["activity_snapshot"] = {
            "total_evaluations_1yr":  total_evals,
            "avg_marks_pct":          avg_marks_pct,
            "zero_marked_count":      zero_count,
            "avg_time_per_question":  avg_time,
            "total_grievances":       total_grievances,
            "resolved_grievances":    resolved_grievances,
            "grievance_success_rate": grievance_rate,
            "unverified_evals":       unverified_count,
            "quick_risk_flags":       risk_flags,
            "has_risk_flags":         len(risk_flags) > 0,
        }

        return {"success": True, "teacher": teacher}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_all_teachers(department: str = None) -> dict:
    """
    Get all teachers optionally filtered by department.
    Now includes per-teacher evaluation activity, grievance count,
    avg marks%, and risk flag count — for quick department-wide overview.
    """
    try:
        users_col = get_collection("users")
        eval_col  = get_collection("evaluations")
        grv_col   = get_collection("grievances")

        query = {"role": "teacher"}
        if department:
            query["department"] = department

        docs = list(
            users_col.find(query, {"password": 0, "__v": 0})
                     .sort("name", 1)
        )

        if not docs:
            return {
                "success":  True,
                "message":  "No teachers found.",
                "total":    0,
                "teachers": [],
            }

        serialized = serialize_docs(docs)
        since_1yr  = datetime.utcnow() - timedelta(days=365)

        # ── Enrich each teacher with mini stats ───────────────
        for teacher in serialized:
            tid = teacher.get("userId")
            if not tid:
                continue

            # Eval count + avg marks
            evals = list(eval_col.find(
                {"teacherId": tid, "evaluatedAt": {"$gte": since_1yr}},
                {"questionMarks": 1, "blockchainVerified": 1, "submissionId": 1}
            ))

            sub_ids     = [e.get("submissionId") for e in evals if e.get("submissionId")]
            pcts        = []
            zero_count  = 0
            unverified  = 0

            for ev in evals:
                qms     = ev.get("questionMarks", [])
                total_a = sum(q.get("marksObtained", 0) for q in qms)
                total_m = sum(q.get("maxMarks", 0)      for q in qms)
                if total_m > 0:
                    pcts.append((total_a / total_m) * 100)
                if total_a == 0 and total_m > 0:
                    zero_count += 1
                if not ev.get("blockchainVerified", True):
                    unverified += 1

            avg_pct = round(sum(pcts) / len(pcts), 2) if pcts else None

            # Grievance count
            grv_count = grv_col.count_documents(
                {"submissionId": {"$in": sub_ids}}
            ) if sub_ids else 0

            # Quick risk label
            risk_label = _quick_risk_label(
                avg_pct     = avg_pct,
                zero_count  = zero_count,
                grv_count   = grv_count,
                unverified  = unverified,
            )

            teacher["_stats"] = {
                "total_evals_1yr": len(evals),
                "avg_marks_pct":   avg_pct,
                "zero_count":      zero_count,
                "grievance_count": grv_count,
                "unverified_evals": unverified,
                "risk_label":      risk_label,
            }

        # ── Department-level summary ✅ NEW ───────────────────
        dept_summary = _compute_department_summary(serialized, department)

        return {
            "success":          True,
            "total":            len(serialized),
            "department":       department or "All departments",
            "department_summary": dept_summary,    # ✅ NEW
            "teachers":         serialized,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# ──────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ──────────────────────────────────────────────────────────────

def _quick_risk_label(
    avg_pct: float | None,
    zero_count: int,
    grv_count: int,
    unverified: int,
) -> str:
    """
    Fast risk label for teacher list view.
    Not a full bias report — just a quick indicator.
    """
    if zero_count >= 3:
        return "🔴 HIGH RISK"
    if avg_pct is not None and avg_pct < 25:
        return "🔴 HIGH RISK"
    if grv_count >= 3 or (avg_pct is not None and avg_pct < 40):
        return "🟠 MEDIUM RISK"
    if unverified > 0 or grv_count >= 1:
        return "🟡 LOW RISK"
    if avg_pct is None:
        return "⚪ NO DATA"
    return "🟢 CLEAR"


def _compute_department_summary(
    teachers: list,
    department: str | None,
) -> dict:
    """
    Aggregate stats across all teachers in the department:
    - avg marks% across department
    - how many teachers are flagged
    - strictest and most lenient teacher
    - department-wide grievance count
    """
    if not teachers:
        return {"available": False}

    pcts          = []
    total_evals   = 0
    total_grv     = 0
    flagged       = 0
    teachers_data = []

    for t in teachers:
        stats = t.get("_stats", {})
        avg   = stats.get("avg_marks_pct")
        tid   = t.get("userId")
        name  = t.get("name", tid)

        total_evals += stats.get("total_evals_1yr", 0)
        total_grv   += stats.get("grievance_count", 0)

        risk = stats.get("risk_label", "")
        if "RISK" in risk:
            flagged += 1

        if avg is not None:
            pcts.append(avg)
            teachers_data.append({"teacher_id": tid, "name": name, "avg_pct": avg})

    dept_avg = round(sum(pcts) / len(pcts), 2) if pcts else None

    strictest  = min(teachers_data, key=lambda x: x["avg_pct"]) if teachers_data else None
    most_lenient = max(teachers_data, key=lambda x: x["avg_pct"]) if teachers_data else None

    return {
        "available":           True,
        "department":          department or "All",
        "total_teachers":      len(teachers),
        "total_evals_1yr":     total_evals,
        "total_grievances":    total_grv,
        "dept_avg_marks_pct":  dept_avg,
        "flagged_teachers":    flagged,
        "flagged_pct":         round(flagged / len(teachers) * 100, 2) if teachers else 0,
        "strictest_teacher":   strictest,
        "most_lenient_teacher": most_lenient,
    }
