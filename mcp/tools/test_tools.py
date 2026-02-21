from db import get_collection, serialize_doc, serialize_docs
from collections import defaultdict


# ──────────────────────────────────────────────────────────────
# PUBLIC TOOLS
# ──────────────────────────────────────────────────────────────

def get_test_details(test_id: str) -> dict:
    """
    Get full test details including questions, marking scheme,
    per-question weight%, scheme mismatch detection, and
    cross-teacher evaluation stats for this test.
    """
    try:
        col      = get_collection("tests")
        eval_col = get_collection("evaluations")

        doc = col.find_one({"testId": test_id})
        if not doc:
            return {
                "success": False,
                "message": f"Test not found: {test_id}",
            }

        t         = serialize_doc(doc)
        questions = t.get("questions", [])

        # ── Computed totals ───────────────────────────────────
        scheme_total   = sum(
            q.get("marks", 0) or q.get("maxMarks", 0)
            for q in questions
        )
        declared_total = t.get("totalMarks", 0)

        # Flag if declared total doesn't match sum of question marks
        total_mismatch = (
            declared_total > 0 and
            scheme_total   > 0 and
            declared_total != scheme_total
        )

        t["computed_total_marks"] = scheme_total
        t["total_marks_mismatch"] = total_mismatch
        if total_mismatch:
            t["total_mismatch_flag"] = (
                f"⚠️ Declared totalMarks={declared_total} "
                f"but sum of question marks={scheme_total} "
                f"— scheme inconsistency"
            )

        # ── Per-question scheme summary ✅ NEW ────────────────
        question_scheme = []
        for q in questions:
            qnum = q.get("questionNumber") or q.get("number")
            qmax = q.get("marks") or q.get("maxMarks", 0)
            qpct = round((qmax / scheme_total * 100), 2) if scheme_total > 0 else 0
            question_scheme.append({
                "question_number": qnum,
                "max_marks":       qmax,
                "weight_pct":      qpct,
                "description":     q.get("description", q.get("text", "")),
            })

        t["question_scheme"] = question_scheme

        # ── Cross-teacher evaluation stats ✅ NEW ─────────────
        cross_teacher_stats = _compute_cross_teacher_stats(test_id, eval_col)
        t["cross_teacher_stats"] = cross_teacher_stats

        # Strip large embedded content — never send to LLM
        for q in t.get("questions", []):
            q.pop("answerKey",    None)
            q.pop("sampleAnswer", None)

        return {"success": True, "test": t}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_test_questions(test_id: str) -> dict:
    """
    Get questions and marks breakdown for a test.
    Now includes per-question weight%, scheme mismatch flags,
    heavy-weight question flags, and how each question was
    marked across all evaluations of this test.
    """
    try:
        col      = get_collection("tests")
        eval_col = get_collection("evaluations")
        sub_col  = get_collection("submissions")

        doc = col.find_one(
            {"testId": test_id},
            {"questions": 1, "title": 1, "subject": 1, "totalMarks": 1, "testId": 1}
        )
        if not doc:
            return {
                "success": False,
                "message": f"Test not found: {test_id}",
            }

        t         = serialize_doc(doc)
        questions = t.get("questions", [])

        # ── Scheme totals ─────────────────────────────────────
        scheme_total   = sum(
            q.get("marks", 0) or q.get("maxMarks", 0)
            for q in questions
        )
        declared_total = t.get("totalMarks", 0)

        # ── Per-question breakdown ✅ ENRICHED ────────────────
        question_breakdown = []
        for q in questions:
            qnum = q.get("questionNumber") or q.get("number")
            qmax = q.get("marks") or q.get("maxMarks", 0)
            qpct = round((qmax / scheme_total * 100), 2) if scheme_total > 0 else 0
            question_breakdown.append({
                "question_number": qnum,
                "max_marks":       qmax,
                "weight_pct":      qpct,
                "description":     q.get("description", q.get("text", "")),
            })

        # ── Submission IDs for this test ──────────────────────
        sub_ids = [
            s["submissionId"]
            for s in sub_col.find(
                {"testId": test_id},
                {"submissionId": 1}
            )
            if s.get("submissionId")
        ]

        # ── Marking stats across all evaluations ✅ NEW ───────
        marking_stats = None
        if sub_ids:
            marking_stats = _compute_test_marking_stats(
                sub_ids, eval_col, question_breakdown
            )

        # ── Flags ─────────────────────────────────────────────
        flags = []

        if declared_total > 0 and scheme_total > 0 and declared_total != scheme_total:
            flags.append(
                f"⚠️ SCHEME MISMATCH: declared totalMarks={declared_total} "
                f"vs sum of questions={scheme_total}"
            )

        # Heavy-weight questions — bias here has outsized impact
        for q in question_breakdown:
            if q["weight_pct"] > 40:
                flags.append(
                    f"⚠️ Q{q['question_number']} carries {q['weight_pct']}% "
                    f"of total marks — high-weight, bias here has outsized impact"
                )

        return {
            "success":        True,
            "test_id":        test_id,
            "title":          t.get("title"),
            "subject":        t.get("subject"),
            "declared_total": declared_total,
            "scheme_total":   scheme_total,
            "question_count": len(questions),
            "questions":      question_breakdown,  # ✅ enriched with weight%
            "marking_stats":  marking_stats,        # ✅ NEW
            "flags":          flags,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# ──────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ──────────────────────────────────────────────────────────────

def _compute_cross_teacher_stats(test_id: str, eval_col) -> dict:
    """
    For a given test, compare how different teachers marked it.
    Groups evaluations by teacherId, computes per-teacher avg marks%,
    flags teachers who deviate > 20% from the test average.
    Reveals if one teacher marks the same test very differently from peers.
    """
    sub_col = get_collection("submissions")
    sub_ids = [
        s["submissionId"]
        for s in sub_col.find(
            {"testId": test_id},
            {"submissionId": 1}
        )
        if s.get("submissionId")
    ]

    if not sub_ids:
        return {
            "available": False,
            "reason":    "No submissions found for this test",
        }

    evals = list(eval_col.find(
        {"submissionId": {"$in": sub_ids}},
        {"teacherId": 1, "teacherName": 1,
         "questionMarks": 1, "blockchainVerified": 1}
    ))

    if not evals:
        return {
            "available": False,
            "reason":    "No evaluations found for this test's submissions",
        }

    # ── Group by teacher ──────────────────────────────────────
    teacher_data = defaultdict(lambda: {
        "name":       None,
        "pcts":       [],
        "zero_count": 0,
        "unverified": 0,
    })

    for ev in evals:
        tid = ev.get("teacherId", "unknown")
        qms = ev.get("questionMarks", [])
        ta  = sum(q.get("marksObtained", 0) for q in qms)
        tm  = sum(q.get("maxMarks", 0)      for q in qms)
        pct = round((ta / tm * 100), 2) if tm > 0 else 0

        teacher_data[tid]["name"] = ev.get("teacherName", tid)
        teacher_data[tid]["pcts"].append(pct)

        if ta == 0 and tm > 0:
            teacher_data[tid]["zero_count"] += 1
        if not ev.get("blockchainVerified", True):
            teacher_data[tid]["unverified"] += 1

    # ── Per-teacher summary ───────────────────────────────────
    per_teacher = []
    all_avgs    = []

    for tid, data in teacher_data.items():
        pcts    = data["pcts"]
        avg_pct = round(sum(pcts) / len(pcts), 2) if pcts else 0
        all_avgs.append(avg_pct)

        per_teacher.append({
            "teacher_id":    tid,
            "teacher_name":  data["name"],
            "eval_count":    len(pcts),
            "avg_marks_pct": avg_pct,
            "zero_count":    data["zero_count"],
            "unverified":    data["unverified"],
        })

    # Sort strictest first
    per_teacher.sort(key=lambda x: x["avg_marks_pct"])

    # Overall test avg
    test_avg = round(sum(all_avgs) / len(all_avgs), 2) if all_avgs else 0

    # ── Flag outliers vs test avg ─────────────────────────────
    outlier_flags = []
    for t in per_teacher:
        diff = round(t["avg_marks_pct"] - test_avg, 2)
        t["diff_from_test_avg"] = diff

        if diff < -20:
            t["outlier_flag"] = f"⚠️ {abs(diff)}% below test avg — significantly stricter"
            outlier_flags.append(
                f"⚠️ {t['teacher_name']} ({t['teacher_id']}) marks "
                f"{abs(diff)}% below test avg"
            )
        elif diff > 20:
            t["outlier_flag"] = f"⚠️ {diff}% above test avg — significantly more lenient"
            outlier_flags.append(
                f"⚠️ {t['teacher_name']} ({t['teacher_id']}) marks "
                f"{diff}% above test avg"
            )
        else:
            t["outlier_flag"] = None

    return {
        "available":            True,
        "total_evaluations":    len(evals),
        "teacher_count":        len(per_teacher),
        "test_avg_marks_pct":   test_avg,
        "per_teacher":          per_teacher,
        "outlier_flags":        outlier_flags,
        "strictest_teacher":    per_teacher[0]  if per_teacher else None,
        "most_lenient_teacher": per_teacher[-1] if per_teacher else None,
    }


def _compute_test_marking_stats(
    sub_ids: list,
    eval_col,
    question_breakdown: list,
) -> dict:
    """
    Across all evaluations of this test compute:
    - overall avg marks%
    - per-question avg marks%, zero count, variance
    - which questions are most commonly zero-marked
    - which questions have highest variance across evaluations
    """
    evals = list(eval_col.find(
        {"submissionId": {"$in": sub_ids}},
        {"questionMarks": 1, "teacherId": 1}
    ))

    if not evals:
        return {"available": False, "reason": "No evaluations found"}

    # ── Overall pct ───────────────────────────────────────────
    overall_pcts = []
    q_data       = defaultdict(list)   # qnum → [(got, max), ...]

    for ev in evals:
        qms = ev.get("questionMarks", [])
        ta  = sum(q.get("marksObtained", 0) for q in qms)
        tm  = sum(q.get("maxMarks", 0)      for q in qms)
        if tm > 0:
            overall_pcts.append((ta / tm) * 100)

        for q in qms:
            qnum = q.get("questionNumber")
            qmax = q.get("maxMarks", 0)
            qgot = q.get("marksObtained", 0)
            if qnum is not None and qmax > 0:
                q_data[qnum].append((qgot, qmax))

    overall_avg = (
        round(sum(overall_pcts) / len(overall_pcts), 2)
        if overall_pcts else 0
    )

    # ── Per-question stats ────────────────────────────────────
    per_question_stats = []
    for q in question_breakdown:
        qnum = q["question_number"]
        data = q_data.get(qnum, [])

        if not data:
            per_question_stats.append({
                "question_number": qnum,
                "max_marks":       q["max_marks"],
                "avg_marks_pct":   None,
                "zero_count":      0,
                "variance":        None,
                "sample_count":    0,
                "flags":           [],
            })
            continue

        pcts       = [round((got / mx * 100), 2) for got, mx in data if mx > 0]
        avg_pct    = round(sum(pcts) / len(pcts), 2) if pcts else 0
        zero_count = sum(1 for got, _ in data if got == 0)
        variance   = (
            round(max(pcts) - min(pcts), 2)
            if len(pcts) > 1 else 0
        )

        q_flags = []
        if zero_count >= 2:
            q_flags.append(
                f"🚨 Zero-marked {zero_count} times across evaluations"
            )
        if avg_pct < 20:
            q_flags.append(
                "⚠️ Avg < 20% — consistently under-marked on this test"
            )
        if variance > 50:
            q_flags.append(
                f"⚠️ High variance {variance}% — marked very inconsistently"
            )

        per_question_stats.append({
            "question_number": qnum,
            "max_marks":       q["max_marks"],
            "avg_marks_pct":   avg_pct,
            "zero_count":      zero_count,
            "variance":        variance,
            "sample_count":    len(pcts),
            "flags":           q_flags,
        })

    # Most problematic questions (flagged)
    flagged_questions = [
        q for q in per_question_stats if q.get("flags")
    ]

    return {
        "available":            True,
        "total_evaluations":    len(evals),
        "overall_avg_pct":      overall_avg,
        "per_question_stats":   per_question_stats,
        "flagged_questions":    flagged_questions,
        "total_flagged":        len(flagged_questions),
    }
