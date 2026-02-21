from db import get_collection, serialize_doc, serialize_docs
from datetime import datetime, timedelta


def get_evaluation_by_submission(submission_id: str) -> dict:
    """
    Get the evaluation document for a specific submission.

    Args:
        submission_id: The submission ID (e.g. 0X034...)

    Returns:
        Full evaluation document with question marks
    """
    try:
        col  = get_collection("evaluations")
        doc  = col.find_one({"submissionId": submission_id})

        if not doc:
            return {
                "success": False,
                "message": f"No evaluation found for submission {submission_id}",
            }

        s = serialize_doc(doc)

        # Add computed fields
        qms = s.get("questionMarks", [])
        total_awarded  = sum(q.get("marksObtained", 0) for q in qms)
        total_max      = sum(q.get("maxMarks", 0) for q in qms)
        pct            = (total_awarded / total_max * 100) if total_max > 0 else 0

        s["computed"] = {
            "total_marks_obtained": total_awarded,
            "total_max_marks":      total_max,
            "percentage":           round(pct, 2),
            "grade": _get_grade(pct),
            "question_breakdown": [
                {
                    "questionNumber": q.get("questionNumber"),
                    "marksObtained":  q.get("marksObtained"),
                    "maxMarks":       q.get("maxMarks"),
                    "percentage":     round(
                        (q.get("marksObtained", 0) / q["maxMarks"] * 100), 2
                    ) if q.get("maxMarks") else 0,
                    "comment":        q.get("comment", ""),
                }
                for q in qms
            ],
        }
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

    Args:
        teacher_id: Teacher userId
        limit:      Max records (default 20)
        days_back:  Time window (default 90 days)

    Returns:
        List of evaluations with stats
    """
    try:
        col = get_collection("evaluations")
        since = datetime.utcnow() - timedelta(days=days_back)

        docs = list(
            col.find({
                "teacherId": teacher_id,
                "createdAt": {"$gte": since},
            })
            .sort("createdAt", -1)
            .limit(limit)
        )

        if not docs:
            return {
                "success": True,
                "teacher_id": teacher_id,
                "message": "No evaluations found for this teacher.",
                "evaluations": [],
            }

        serialized = serialize_docs(docs)

        # Compute stats per evaluation
        percentages = []
        for ev in serialized:
            qms = ev.get("questionMarks", [])
            total_a = sum(q.get("marksObtained", 0) for q in qms)
            total_m = sum(q.get("maxMarks", 0) for q in qms)
            pct     = (total_a / total_m * 100) if total_m > 0 else 0
            ev["_pct"] = round(pct, 2)
            percentages.append(pct)

        avg_pct = sum(percentages) / len(percentages) if percentages else 0

        return {
            "success":          True,
            "teacher_id":       teacher_id,
            "total_found":      len(serialized),
            "avg_marks_pct":    round(avg_pct, 2),
            "evaluations":      serialized,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_evaluation_metrics(
    teacher_id: str = None,
    evaluation_id: str = None,
) -> dict:
    """
    Get bias/quality metrics for a teacher or specific evaluation.

    Args:
        teacher_id:    Filter by teacher
        evaluation_id: Filter by specific evaluation

    Returns:
        Metrics with bias indicators and quality scores
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
                "message": "No metrics found for given filters.",
            }

        serialized = serialize_docs(docs)

        # Aggregate bias indicators across all metrics
        all_flags = []
        quality_scores = []
        for m in serialized:
            bi = m.get("biasIndicators", {})
            if bi.get("fatigueDetected"):
                all_flags.append(f"Fatigue in eval {m.get('evaluationId')}")
            if bi.get("rushingDetected"):
                all_flags.append(f"Rushing in eval {m.get('evaluationId')}")
            if bi.get("hasSequenceBias"):
                all_flags.append(
                    f"Sequence bias ({bi.get('sequenceBiasTrend')}) "
                    f"in eval {m.get('evaluationId')}"
                )
            qs = m.get("evaluationQualityScore")
            if qs is not None:
                quality_scores.append(qs)

        avg_quality = (
            sum(quality_scores) / len(quality_scores)
            if quality_scores else None
        )

        return {
            "success":           True,
            "total_found":       len(serialized),
            "avg_quality_score": round(avg_quality, 2) if avg_quality else None,
            "all_bias_flags":    all_flags,
            "metrics":           serialized,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def _get_grade(pct: float) -> str:
    if pct >= 90: return "A+"
    if pct >= 80: return "A"
    if pct >= 70: return "B+"
    if pct >= 60: return "B"
    if pct >= 50: return "C"
    if pct >= 40: return "D"
    return "F"
