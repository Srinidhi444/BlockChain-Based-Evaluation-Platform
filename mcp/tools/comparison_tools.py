from db import get_collection, serialize_docs, serialize_doc
from datetime import datetime, timedelta
from collections import defaultdict


# ──────────────────────────────────────────────────────────────
# PUBLIC TOOLS
# ──────────────────────────────────────────────────────────────

def compare_teacher_with_peers(
    teacher_id: str,
    department: str = None,
    days_back: int = 365,
) -> dict:
    """
    Compare a teacher's marking patterns against peer teachers.
    Now computes directly from evaluations (not metrics collection)
    for accuracy. Includes z-score outlier detection, subject-level
    comparison, and per-peer breakdown.
    """
    try:
        eval_col  = get_collection("evaluations")
        users_col = get_collection("users")
        audit_col = get_collection("audit_logs")
        since     = datetime.utcnow() - timedelta(days=days_back)

        # ── Resolve department if not provided ────────────────
        if not department:
            teacher_doc = users_col.find_one(
                {"userId": teacher_id},
                {"department": 1}
            )
            if teacher_doc:
                department = teacher_doc.get("department")

        # ── Get all teacher IDs in department ─────────────────
        peer_query = {"role": "teacher"}
        if department:
            peer_query["department"] = department

        all_teachers = list(users_col.find(
            peer_query,
            {"userId": 1, "name": 1, "department": 1}
        ))
        all_teacher_ids = [t["userId"] for t in all_teachers]
        peer_ids        = [tid for tid in all_teacher_ids if tid != teacher_id]

        if not peer_ids:
            return {
                "success":    True,
                "teacher_id": teacher_id,
                "department": department,
                "message":    "No peers found in department for comparison.",
                "peer_count": 0,
            }

        # ── Compute stats for every teacher from evaluations ──
        def _get_teacher_stats(tid: str) -> dict | None:
            docs = list(eval_col.find(
                {"teacherId": tid, "evaluatedAt": {"$gte": since}},
                {"questionMarks": 1, "blockchainVerified": 1, "submissionId": 1}
            ))
            if not docs:
                return None

            pcts = []
            for doc in docs:
                qms     = doc.get("questionMarks", [])
                total_a = sum(q.get("marksObtained", 0) for q in qms)
                total_m = sum(q.get("maxMarks", 0)      for q in qms)
                if total_m > 0:
                    pcts.append((total_a / total_m) * 100)

            if not pcts:
                return None

            # Avg time per question from audit logs
            q_logs = list(audit_col.find({
                "userId":    tid,
                "eventType": "question_marked",
                "timestamp": {"$gte": since},
            }, {"timeSpent": 1}))
            times     = [l["timeSpent"] for l in q_logs if l.get("timeSpent")]
            avg_time  = round(sum(times) / len(times), 2) if times else None

            return {
                "avg_marks_pct":    round(sum(pcts) / len(pcts), 2),
                "total_evals":      len(pcts),
                "avg_time_per_q":   avg_time,
            }

        # ── Target teacher stats ──────────────────────────────
        target_stats = _get_teacher_stats(teacher_id)

        if not target_stats:
            return {
                "success":    True,
                "teacher_id": teacher_id,
                "message":    "No evaluations found for this teacher in the period.",
                "peer_count": len(peer_ids),
            }

        # ── Peer stats ────────────────────────────────────────
        peer_stats_list = []
        peer_name_map   = {t["userId"]: t.get("name", t["userId"]) for t in all_teachers}

        for pid in peer_ids:
            stats = _get_teacher_stats(pid)
            if stats:
                peer_stats_list.append({
                    "teacher_id":    pid,
                    "teacher_name":  peer_name_map.get(pid, pid),
                    **stats,
                })

        if not peer_stats_list:
            return {
                "success":     True,
                "teacher_id":  teacher_id,
                "department":  department,
                "message":     "No peers have evaluation data in this period.",
                "peer_count":  0,
            }

        # ── Peer aggregates ───────────────────────────────────
        peer_mark_pcts  = [p["avg_marks_pct"]  for p in peer_stats_list]
        peer_times      = [p["avg_time_per_q"]  for p in peer_stats_list
                           if p["avg_time_per_q"] is not None]

        peer_avg_marks  = round(sum(peer_mark_pcts) / len(peer_mark_pcts), 2)
        peer_avg_time   = round(sum(peer_times)     / len(peer_times),     2) if peer_times else None

        pct_diff  = round(target_stats["avg_marks_pct"] - peer_avg_marks, 2)
        time_diff = (
            round(target_stats["avg_time_per_q"] - peer_avg_time, 2)
            if target_stats["avg_time_per_q"] and peer_avg_time
            else None
        )

        # ── Z-score outlier detection ✅ NEW ──────────────────
        z_score_marks = _z_score(
            target_stats["avg_marks_pct"],
            peer_mark_pcts,
        )
        is_statistical_outlier = (
            z_score_marks is not None and abs(z_score_marks) > 2.0
        )

        # ── Peer rank ✅ NEW ──────────────────────────────────
        all_avgs_sorted = sorted(
            [p["avg_marks_pct"] for p in peer_stats_list]
            + [target_stats["avg_marks_pct"]]
        )
        rank = all_avgs_sorted.index(target_stats["avg_marks_pct"]) + 1
        rank_label = (
            f"{rank} / {len(all_avgs_sorted)} "
            f"({'strictest' if rank == 1 else 'most lenient' if rank == len(all_avgs_sorted) else 'middle'})"
        )

        # ── Flags ─────────────────────────────────────────────
        flags = []

        if pct_diff < -25:
            flags.append(
                f"🚨 CRITICAL: Teacher marks {abs(pct_diff)}% stricter than peer avg "
                f"(threshold: -25%)"
            )
        elif pct_diff < -20:
            flags.append(
                f"⚠️ HIGH: Teacher marks {abs(pct_diff)}% stricter than peer avg "
                f"(threshold: -20%)"
            )
        elif pct_diff < -15:
            flags.append(
                f"⚠️ MEDIUM: Teacher marks {abs(pct_diff)}% stricter than peer avg "
                f"(threshold: -15%)"
            )
        elif pct_diff > 25:
            flags.append(
                f"⚠️ HIGH: Teacher marks {pct_diff}% more lenient than peer avg"
            )
        elif pct_diff > 20:
            flags.append(
                f"⚠️ MEDIUM: Teacher marks {pct_diff}% more lenient than peer avg"
            )

        if time_diff is not None and time_diff < -15:
            flags.append(
                f"⚠️ Teacher spends {abs(time_diff)}s less per question than peers "
                f"(threshold: -15s)"
            )

        if is_statistical_outlier:
            direction = "below" if z_score_marks < 0 else "above"
            flags.append(
                f"📊 Statistical outlier: z-score={round(z_score_marks, 2)} "
                f"({direction} peer mean by {abs(round(z_score_marks, 2))} std devs)"
            )

        if len(peer_stats_list) < 3:
            flags.append(
                f"⚠️ Weak comparison: only {len(peer_stats_list)} peer(s) — "
                f"treat comparison with caution"
            )

        # ── Strictness direction label ─────────────────────────
        if pct_diff < -20:
            direction_label = "Significantly STRICTER than peers"
        elif pct_diff < -10:
            direction_label = "Moderately stricter than peers"
        elif pct_diff > 20:
            direction_label = "Significantly MORE LENIENT than peers"
        elif pct_diff > 10:
            direction_label = "Moderately more lenient than peers"
        else:
            direction_label = "In line with peers"

        return {
            "success":     True,
            "teacher_id":  teacher_id,
            "department":  department,
            "period_days": days_back,
            "peer_count":  len(peer_stats_list),
            "teacher": {
                "avg_marks_pct":  target_stats["avg_marks_pct"],
                "avg_time_per_q": target_stats["avg_time_per_q"],
                "total_evals":    target_stats["total_evals"],
                "rank":           rank_label,
            },
            "peer_average": {
                "avg_marks_pct":  peer_avg_marks,
                "avg_time_per_q": peer_avg_time,
                "total_peers":    len(peer_stats_list),
            },
            "difference": {
                "marks_pct":       pct_diff,
                "time_per_q":      time_diff,
                "direction_label": direction_label,
            },
            "z_score_marks":         round(z_score_marks, 4) if z_score_marks is not None else None,
            "is_outlier":            len(flags) > 0,
            "is_statistical_outlier": is_statistical_outlier,
            "flags":                 flags,
            "per_peer_breakdown":    sorted(          # ✅ NEW
                peer_stats_list,
                key=lambda x: x["avg_marks_pct"]
            ),
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_teacher_bias_report(teacher_id: str) -> dict:
    """
    Full consolidated bias report for a teacher.
    Now computed directly from raw evaluations + audit logs
    instead of relying solely on evaluation_metrics collection.
    Includes CRITICAL/HIGH/MEDIUM/LOW risk using the full decision matrix.
    """
    try:
        eval_col  = get_collection("evaluations")
        audit_col = get_collection("audit_logs")
        grv_col   = get_collection("grievances")
        reeval_col = get_collection("reevaluations")

        # ── Raw evaluations ───────────────────────────────────
        evals = list(eval_col.find(
            {"teacherId": teacher_id},
            {"questionMarks": 1, "submissionId": 1,
             "blockchainVerified": 1, "evaluatedAt": 1}
        ).sort("evaluatedAt", -1).limit(50))

        if not evals:
            return {
                "success":     True,
                "teacher_id":  teacher_id,
                "risk_level":  "UNKNOWN",
                "message":     "No evaluations found for this teacher.",
            }

        # ── Marks analysis ────────────────────────────────────
        percentages     = []
        zero_mark_count = 0
        sub_ids         = []
        unverified_zero = 0

        for ev in evals:
            qms     = ev.get("questionMarks", [])
            total_a = sum(q.get("marksObtained", 0) for q in qms)
            total_m = sum(q.get("maxMarks", 0)      for q in qms)
            pct     = round((total_a / total_m * 100), 2) if total_m > 0 else 0

            percentages.append(pct)
            sub_ids.append(ev.get("submissionId"))

            if total_a == 0 and total_m > 0:
                zero_mark_count += 1

            # Unverified + zero = CRITICAL
            if not ev.get("blockchainVerified", True) and total_a == 0:
                unverified_zero += 1

        avg_pct  = round(sum(percentages) / len(percentages), 2) if percentages else 0
        variance = round(max(percentages) - min(percentages), 2) if percentages else 0

        # Blockchain stats
        unverified_count = sum(
            1 for ev in evals
            if not ev.get("blockchainVerified", True)
        )
        unverified_pct = round(unverified_count / len(evals) * 100, 2)

        marks_analysis = {
            "all_percentages":  [round(p, 2) for p in percentages],
            "average_pct":      avg_pct,
            "highest_pct":      round(max(percentages), 2),
            "lowest_pct":       round(min(percentages), 2),
            "variance":         variance,
            "zero_mark_count":  zero_mark_count,
            "variance_label":   _get_variance_label(variance),
            "strictness_label": _get_strictness_label(avg_pct),
        }

        # ── Timing analysis from audit logs ───────────────────
        q_logs = list(audit_col.find({
            "userId":    teacher_id,
            "eventType": "question_marked",
        }, {"timeSpent": 1}).limit(500))

        times    = [l["timeSpent"] for l in q_logs if l.get("timeSpent") is not None]
        avg_time = round(sum(times) / len(times), 2) if times else None
        min_time = min(times) if times else None

        timing = {
            "avg_seconds_per_question": avg_time,
            "min_seconds":              min_time,
            "total_questions_marked":   len(times),
        }

        # ── Grievance stats ───────────────────────────────────
        sub_ids_clean = [s for s in sub_ids if s]
        total_grievances = grv_col.count_documents(
            {"submissionId": {"$in": sub_ids_clean}}
        )

        # Upheld/resolved grievances
        resolved_grievances = list(grv_col.find({
            "submissionId": {"$in": sub_ids_clean},
            "status": {"$in": ["completed", "resolved", "upheld"]},
        }, {"_id": 1}))
        resolved_count = len(resolved_grievances)

        success_rate = (
            round(resolved_count / total_grievances * 100, 2)
            if total_grievances > 0 else 0
        )

        # Avg mark change from reevaluations
        reeval_ids = [str(g["_id"]) for g in resolved_grievances]
        reevals    = list(reeval_col.find(
            {"grievanceId": {"$in": reeval_ids}},
            {"marksChange": 1}
        ))
        mark_changes = [
            abs(r["marksChange"]) for r in reevals
            if r.get("marksChange") is not None
        ]
        avg_mark_change = (
            round(sum(mark_changes) / len(mark_changes), 2)
            if mark_changes else 0
        )

        grievance_stats = {
            "total":           total_grievances,
            "resolved":        resolved_count,
            "success_rate_pct": success_rate,
            "avg_mark_change": avg_mark_change,
        }

        # ── Risk level — full decision matrix ✅ UPGRADED ─────
        risk_level, risk_flags = _compute_risk_level(
            variance         = variance,
            avg_pct          = avg_pct,
            zero_mark_count  = zero_mark_count,
            avg_time         = avg_time,
            min_time         = min_time,
            success_rate     = success_rate,
            total_grievances = total_grievances,
            avg_mark_change  = avg_mark_change,
            unverified_zero  = unverified_zero,
            unverified_pct   = unverified_pct,
        )

        return {
            "success":          True,
            "teacher_id":       teacher_id,
            "risk_level":       risk_level,
            "risk_flags":       risk_flags,
            "total_evaluations": len(evals),
            "marks_analysis":   marks_analysis,
            "timing":           timing,
            "grievance_stats":  grievance_stats,
            "blockchain_stats": {
                "unverified_count": unverified_count,
                "unverified_pct":   unverified_pct,
                "unverified_zero":  unverified_zero,
            },
            "flags":            risk_flags,  # alias — LLM reads both
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# ──────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ──────────────────────────────────────────────────────────────

def _compute_risk_level(
    variance: float,
    avg_pct: float,
    zero_mark_count: int,
    avg_time: float | None,
    min_time: float | None,
    success_rate: float,
    total_grievances: int,
    avg_mark_change: float,
    unverified_zero: int,
    unverified_pct: float,
) -> tuple[str, list]:
    """
    Full decision matrix from prompts.py Section 3.
    Returns (risk_level, flags_triggered[]).
    Checks CRITICAL first, then HIGH, then MEDIUM, else LOW.
    """
    flags = []

    # ── CRITICAL triggers ─────────────────────────────────────
    if zero_mark_count >= 3:
        flags.append(
            f"🚨 CRITICAL: zero_mark_count={zero_mark_count} "
            f"(threshold: ≥3) — mass zero-marking"
        )
    if variance > 70 and avg_pct < 30:
        flags.append(
            f"🚨 CRITICAL: variance={variance}% AND avg={avg_pct}% "
            f"(threshold: variance>70% + avg<30%)"
        )
    if avg_time is not None and avg_time < 5 and success_rate > 50:
        flags.append(
            f"🚨 CRITICAL: avg_time={avg_time}s AND grievance_success={success_rate}% "
            f"(threshold: time<5s + success>50%)"
        )
    if unverified_zero > 0:
        flags.append(
            f"🚨 CRITICAL: {unverified_zero} unverified eval(s) with zero marks "
            f"— possible tamper"
        )

    if any("CRITICAL" in f for f in flags):
        return "CRITICAL", flags

    # ── HIGH triggers ─────────────────────────────────────────
    if variance > 50:
        flags.append(
            f"⚠️ HIGH: variance={variance}% (threshold: >50%)"
        )
    if zero_mark_count >= 1 and avg_pct < 30:
        flags.append(
            f"⚠️ HIGH: zero_count={zero_mark_count} AND avg={avg_pct}% "
            f"(threshold: zero≥1 + avg<30%)"
        )
    if avg_time is not None and avg_time < 10 and variance > 30:
        flags.append(
            f"⚠️ HIGH: avg_time={avg_time}s AND variance={variance}% "
            f"(threshold: time<10s + variance>30%)"
        )
    if success_rate > 60:
        flags.append(
            f"⚠️ HIGH: grievance success_rate={success_rate}% (threshold: >60%)"
        )
    if avg_mark_change > 20:
        flags.append(
            f"⚠️ HIGH: avg reevaluation mark_change={avg_mark_change} "
            f"(threshold: >20)"
        )
    if unverified_pct > 30:
        flags.append(
            f"⚠️ HIGH: {unverified_pct}% evaluations unverified (threshold: >30%)"
        )

    if any("HIGH" in f for f in flags):
        return "HIGH", flags

    # ── MEDIUM triggers ───────────────────────────────────────
    if variance > 30:
        flags.append(
            f"⚠️ MEDIUM: variance={variance}% (threshold: >30%)"
        )
    if avg_time is not None and avg_time < 20:
        flags.append(
            f"⚠️ MEDIUM: avg_time={avg_time}s (threshold: <20s)"
        )
    if total_grievances >= 2:
        flags.append(
            f"⚠️ MEDIUM: total_grievances={total_grievances} (threshold: ≥2)"
        )
    if avg_mark_change > 10:
        flags.append(
            f"⚠️ MEDIUM: avg reevaluation mark_change={avg_mark_change} "
            f"(threshold: >10)"
        )

    if any("MEDIUM" in f for f in flags):
        return "MEDIUM", flags

    # ── LOW / No bias ─────────────────────────────────────────
    flags.append("✅ No significant bias flags triggered")
    return "LOW", flags


def _z_score(value: float, population: list) -> float | None:
    """Compute z-score of value within population list."""
    n = len(population)
    if n < 2:
        return None
    mean = sum(population) / n
    std  = (sum((x - mean) ** 2 for x in population) / n) ** 0.5
    if std == 0:
        return None
    return round((value - mean) / std, 4)


def _get_variance_label(variance: float) -> str:
    if variance > 70: return "🚨 CRITICAL inconsistency (>70%)"
    if variance > 50: return "⚠️ HIGH inconsistency (>50%)"
    if variance > 30: return "⚠️ MEDIUM inconsistency (>30%)"
    return "✅ Low variance (<30%)"


def _get_strictness_label(avg_pct: float) -> str:
    if avg_pct < 25:  return "🚨 Severely strict (<25%)"
    if avg_pct < 40:  return "⚠️ Strict (<40%)"
    if avg_pct > 90:  return "⚠️ Severely lenient (>90%)"
    if avg_pct > 75:  return "⚠️ Lenient (>75%)"
    return "✅ Normal range (40–75%)"
