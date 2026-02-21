from db import get_collection, serialize_docs
from datetime import datetime, timedelta


def compare_teacher_with_peers(
    teacher_id: str,
    department: str = None,
    days_back: int = 90,
) -> dict:
    """
    Compare a teacher's marking patterns against all peer teachers.
    Detects if a teacher is an outlier (too strict or too lenient).

    Args:
        teacher_id: The teacher to investigate
        department: Limit peers to this department (optional)
        days_back:  Time window (default 90 days)

    Returns:
        Comparison stats: teacher vs peer average
    """
    try:
        metrics_col = get_collection("evaluation_metrics")
        users_col   = get_collection("users")
        since       = datetime.utcnow() - timedelta(days=days_back)

        # Get peer teacher IDs in same department
        query = {"role": "teacher"}
        if department:
            query["department"] = department
        peers = list(users_col.find(query, {"userId": 1}))
        peer_ids = [p["userId"] for p in peers]

        # Aggregate metrics for ALL teachers
        peer_metrics = list(
            metrics_col.find({
                "teacherId": {"$in": peer_ids},
                "createdAt": {"$gte": since},
            })
        )

        # Separate target teacher from peers
        target_metrics = [
            m for m in peer_metrics if m["teacherId"] == teacher_id
        ]
        other_metrics = [
            m for m in peer_metrics if m["teacherId"] != teacher_id
        ]

        def avg_pct(metrics_list):
            pcts = [m.get("overallPercentage", 0) for m in metrics_list]
            return round(sum(pcts) / len(pcts), 2) if pcts else 0

        def avg_time(metrics_list):
            times = [m.get("averageTimePerQuestion", 0) for m in metrics_list]
            return round(sum(times) / len(times), 2) if times else 0

        def avg_quality(metrics_list):
            scores = [m.get("evaluationQualityScore", 0) for m in metrics_list]
            return round(sum(scores) / len(scores), 2) if scores else 0

        target_avg_pct     = avg_pct(target_metrics)
        peer_avg_pct       = avg_pct(other_metrics)
        target_avg_time    = avg_time(target_metrics)
        peer_avg_time      = avg_time(other_metrics)
        target_avg_quality = avg_quality(target_metrics)
        peer_avg_quality   = avg_quality(other_metrics)

        pct_diff  = target_avg_pct  - peer_avg_pct
        time_diff = target_avg_time - peer_avg_time

        # Flags
        flags = []
        if abs(pct_diff) > 20:
            direction = "lenient" if pct_diff > 0 else "strict"
            flags.append(
                f"⚠️ Teacher marks {abs(round(pct_diff, 1))}% "
                f"{direction} vs peer average"
            )
        if time_diff < -15:
            flags.append(
                f"⚠️ Teacher spends {abs(round(time_diff, 1))}s "
                f"less per question than peers"
            )
        if target_avg_quality < peer_avg_quality - 15:
            flags.append(
                f"⚠️ Quality score {round(target_avg_quality, 1)} "
                f"vs peer average {round(peer_avg_quality, 1)}"
            )

        return {
            "success":     True,
            "teacher_id":  teacher_id,
            "period_days": days_back,
            "teacher": {
                "avg_marks_pct":    target_avg_pct,
                "avg_time_per_q":   target_avg_time,
                "avg_quality_score":target_avg_quality,
                "total_evaluations":len(target_metrics),
            },
            "peer_average": {
                "avg_marks_pct":    peer_avg_pct,
                "avg_time_per_q":   peer_avg_time,
                "avg_quality_score":peer_avg_quality,
                "total_evaluations":len(other_metrics),
            },
            "difference": {
                "marks_pct":   round(pct_diff, 2),
                "time_per_q":  round(time_diff, 2),
            },
            "flags":       flags,
            "is_outlier":  len(flags) > 0,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_teacher_bias_report(teacher_id: str) -> dict:
    """
    Full consolidated bias report for a teacher combining
    all available data sources.

    Args:
        teacher_id: Teacher userId

    Returns:
        Comprehensive bias report with risk level
    """
    try:
        metrics_col  = get_collection("evaluation_metrics")
        grv_col      = get_collection("grievances")
        eval_col     = get_collection("evaluations")

        # Get all metrics for teacher
        metrics = list(
            metrics_col.find({"teacherId": teacher_id})
                       .sort("createdAt", -1)
                       .limit(50)
        )

        # Grievance stats
        evals = list(eval_col.find(
            {"teacherId": teacher_id},
            {"submissionId": 1}
        ))
        sub_ids = [e["submissionId"] for e in evals]
        total_grievances = grv_col.count_documents(
            {"submissionId": {"$in": sub_ids}}
        )
        resolved_grievances = grv_col.count_documents({
            "submissionId": {"$in": sub_ids},
            "status": "completed",
        })

        # Aggregate bias flags
        flag_counts = {}
        quality_scores = []
        flagged_count = 0

        for m in metrics:
            if m.get("flaggedForReview"):
                flagged_count += 1
            for reason in m.get("flagReasons", []):
                flag_counts[reason] = flag_counts.get(reason, 0) + 1
            qs = m.get("evaluationQualityScore")
            if qs:
                quality_scores.append(qs)

        avg_quality = (
            sum(quality_scores) / len(quality_scores)
            if quality_scores else 0
        )
        flag_rate = (
            (flagged_count / len(metrics) * 100)
            if metrics else 0
        )

        # Risk level
        if flag_rate > 60 or total_grievances > 5:
            risk_level = "HIGH"
        elif flag_rate > 30 or total_grievances > 2:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "success":            True,
            "teacher_id":         teacher_id,
            "risk_level":         risk_level,
            "total_evaluations":  len(metrics),
            "flagged_evaluations":flagged_count,
            "flag_rate_pct":      round(flag_rate, 2),
            "avg_quality_score":  round(avg_quality, 2),
            "top_flag_reasons":   sorted(
                flag_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5],
            "grievance_stats": {
                "total":    total_grievances,
                "resolved": resolved_grievances,
            },
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
