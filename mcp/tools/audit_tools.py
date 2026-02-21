from db import get_collection, serialize_docs, serialize_doc
from datetime import datetime, timedelta


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

    Args:
        teacher_id:    Filter by teacher userId (e.g. TCH2026001)
        submission_id: Filter by specific submission
        evaluation_id: Filter by specific evaluation
        event_type:    One of: evaluation_started, question_marked,
                       evaluation_completed, grievance_filed,
                       reevaluation_completed
        days_back:     How many days back to search (default 30)
        limit:         Max records to return (default 100)

    Returns:
        dict with logs list and summary stats
    """
    try:
        col = get_collection("audit_logs")
        query = {}

        if teacher_id:
            query["userId"] = teacher_id
        if submission_id:
            query["submissionId"] = submission_id
        if evaluation_id:
            query["evaluationId"] = evaluation_id
        if event_type:
            query["eventType"] = event_type

        # Date filter
        query["timestamp"] = {
            "$gte": datetime.utcnow() - timedelta(days=days_back)
        }

        logs = list(
            col.find(query)
               .sort("timestamp", -1)
               .limit(limit)
        )
        serialized = serialize_docs(logs)

        # Build summary
        event_counts = {}
        total_time_spent = 0
        question_times = []

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
                })

        return {
            "success": True,
            "total_found": len(serialized),
            "event_counts": event_counts,
            "total_time_spent_seconds": total_time_spent,
            "question_timings": question_times,
            "logs": serialized,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_teacher_audit_summary(teacher_id: str, days_back: int = 365) -> dict:
    """
    Get a full behavioural summary for a teacher across
    all their evaluations in the given time window.

    Args:
        teacher_id: Teacher userId
        days_back:  Time window in days (default 365)

    Returns:
        dict with aggregated timing and marking behaviour
    """
    try:
        col = get_collection("audit_logs")

        since = datetime.utcnow() - timedelta(days=days_back)

        # All question_marked events for this teacher
        question_logs = list(col.find({
            "userId":    teacher_id,
            "eventType": "question_marked",
            "timestamp": {"$gte": since},
        }))

        if not question_logs:
            return {
                "success": True,
                "teacher_id": teacher_id,
                "message": "No evaluation activity found in this period.",
                "total_questions_marked": 0,
            }

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

        avg_time   = sum(times) / len(times) if times else 0
        min_time   = min(times) if times else 0
        max_time   = max(times) if times else 0
        avg_marks_pct = sum(marks_pcts) / len(marks_pcts) if marks_pcts else 0

        # Count evaluations started vs completed
        started_count = col.count_documents({
            "userId": teacher_id,
            "eventType": "evaluation_started",
            "timestamp": {"$gte": since},
        })
        completed_count = col.count_documents({
            "userId": teacher_id,
            "eventType": "evaluation_completed",
            "timestamp": {"$gte": since},
        })

        # Flag analysis
        flags = []
        if avg_time < 10:
            flags.append("⚠️ Average time per question < 10 seconds (rushing)")
        if avg_marks_pct < 30:
            flags.append("⚠️ Average marks awarded < 30% (very strict)")
        if avg_marks_pct > 90:
            flags.append("⚠️ Average marks awarded > 90% (very lenient)")
        if min_time < 5:
            flags.append("⚠️ Some questions marked in < 5 seconds")

        return {
            "success":                 True,
            "teacher_id":              teacher_id,
            "period_days":             days_back,
            "total_questions_marked":  len(question_logs),
            "evaluations_started":     started_count,
            "evaluations_completed":   completed_count,
            "timing": {
                "avg_seconds_per_question": round(avg_time, 2),
                "min_seconds":              min_time,
                "max_seconds":              max_time,
            },
            "marking": {
                "avg_marks_percentage":  round(avg_marks_pct, 2),
                "total_questions_marked": len(marks_pcts),
            },
            "flags":   flags,
            "is_flagged": len(flags) > 0,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
