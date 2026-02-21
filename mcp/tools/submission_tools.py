from db import get_collection, serialize_doc, serialize_docs
from datetime import datetime


# ──────────────────────────────────────────────────────────────
# PUBLIC TOOLS
# ──────────────────────────────────────────────────────────────

def get_submission(submission_id: str) -> dict:
    """
    Get a submission document including status, file info,
    evaluation status, and grievance existence check.
    """
    try:
        sub_col  = get_collection("submissions")
        eval_col = get_collection("evaluations")
        grv_col  = get_collection("grievances")

        doc = sub_col.find_one({"submissionId": submission_id})
        if not doc:
            return {
                "success": False,
                "message": f"No submission found: {submission_id}",
            }

        s = serialize_doc(doc)

        # ── File info ─────────────────────────────────────────
        file_size = s.get("fileSize", 0)
        s["fileSizeMB"] = round(file_size / (1024 * 1024), 2) if file_size else 0

        # Strip base64 — never send to LLM
        url = s.get("answerSheetUrl", "")
        if url.startswith("data:"):
            s["answerSheetUrl"]       = "[Base64 encoded — available for download]"
            s["answerSheetAvailable"] = True
        elif url.startswith("http"):
            s["answerSheetAvailable"] = True
        else:
            s["answerSheetAvailable"] = False

        # ── Evaluation status check ✅ NEW ────────────────────
        eval_doc = eval_col.find_one(
            {"submissionId": submission_id},
            {"teacherId": 1, "teacherName": 1, "totalMarksObtained": 1,
             "totalMarks": 1, "percentage": 1, "blockchainVerified": 1,
             "isDraft": 1, "evaluatedAt": 1}
        )

        if eval_doc:
            ev = serialize_doc(eval_doc)
            total_a = ev.get("totalMarksObtained", 0)
            total_m = ev.get("totalMarks", 0)
            pct     = round((total_a / total_m * 100), 2) if total_m > 0 else 0

            s["evaluation_status"] = {
                "evaluated":          True,
                "teacher_id":         ev.get("teacherId"),
                "teacher_name":       ev.get("teacherName"),
                "marks_obtained":     total_a,
                "total_marks":        total_m,
                "percentage":         pct,
                "is_draft":           ev.get("isDraft", False),
                "blockchain_verified": ev.get("blockchainVerified", False),
                "evaluated_at":       ev.get("evaluatedAt"),
                # ✅ Integrity flag
                "blockchain_flag": (
                    "🚨 CRITICAL: Unverified eval with zero marks"
                    if not ev.get("blockchainVerified") and total_a == 0
                    else "⚠️ Evaluation not blockchain verified"
                    if not ev.get("blockchainVerified")
                    else None
                ),
            }
        else:
            s["evaluation_status"] = {
                "evaluated": False,
                "message":   "This submission has not been evaluated yet.",
            }

        # ── Grievance check ✅ NEW ────────────────────────────
        grievance = grv_col.find_one(
            {"submissionId": submission_id},
            {"grievanceId": 1, "status": 1, "reason": 1, "filedAt": 1}
        )

        if grievance:
            g = serialize_doc(grievance)
            s["grievance_status"] = {
                "has_grievance": True,
                "grievance_id":  g.get("grievanceId") or str(g.get("_id")),
                "status":        g.get("status"),
                "reason":        g.get("reason", ""),
                "filed_at":      g.get("filedAt"),
            }
        else:
            s["grievance_status"] = {"has_grievance": False}

        return {"success": True, "submission": s}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_submission_with_test(submission_id: str) -> dict:
    """
    Get submission combined with its test details.
    Now includes full marks-vs-scheme validation:
    cross-checks every question's marks given against
    the test's max marks per question to detect violations.
    """
    try:
        sub_col  = get_collection("submissions")
        test_col = get_collection("tests")
        eval_col = get_collection("evaluations")

        # ── Submission ────────────────────────────────────────
        sub = sub_col.find_one({"submissionId": submission_id})
        if not sub:
            return {
                "success": False,
                "message": f"Submission not found: {submission_id}",
            }

        s = serialize_doc(sub)

        # Strip base64
        url = s.get("answerSheetUrl", "")
        if url.startswith("data:"):
            s["answerSheetUrl"] = "[Base64 file — available for download]"

        # ── Test ──────────────────────────────────────────────
        test = test_col.find_one({"testId": s.get("testId")})
        t    = serialize_doc(test) if test else None
        if t:
            t.pop("answerSheetUrl", None)

        # ── Evaluation ────────────────────────────────────────
        eval_doc = eval_col.find_one({"submissionId": submission_id})
        ev       = serialize_doc(eval_doc) if eval_doc else None

        # ── Marks-vs-scheme validation ✅ NEW ─────────────────
        scheme_validation = None
        if t and ev:
            scheme_validation = _validate_marks_against_scheme(t, ev)

        # ── Submission timeline ✅ NEW ────────────────────────
        timeline = _build_submission_timeline(s, ev)

        return {
            "success":          True,
            "submission":       s,
            "test":             t,
            "evaluation":       ev,
            "scheme_validation": scheme_validation,  # ✅ NEW
            "timeline":         timeline,             # ✅ NEW
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# ──────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ──────────────────────────────────────────────────────────────

def _validate_marks_against_scheme(test: dict, evaluation: dict) -> dict:
    """
    Cross-check every question's marks given in the evaluation
    against the test's defined max marks per question.

    Detects:
    - Marks awarded exceeding the question's max marks (over-marking)
    - Questions completely skipped (not marked at all)
    - Zero marks given for a question (flag individually)
    - Questions where max marks don't match test scheme
    """
    questions = test.get("questions", [])
    given     = evaluation.get("questionMarks", [])

    if not questions:
        return {
            "available": False,
            "reason":    "Test has no questions defined in schema",
        }
    if not given:
        return {
            "available": False,
            "reason":    "Evaluation has no questionMarks data",
        }

    # Build lookup: questionNumber → max marks from TEST schema
    scheme_map = {}
    for q in questions:
        qnum = q.get("questionNumber") or q.get("number")
        mmax = q.get("marks") or q.get("maxMarks")
        if qnum is not None and mmax is not None:
            scheme_map[qnum] = mmax

    # Build lookup: questionNumber → marks given in EVALUATION
    given_map = {}
    for g in given:
        qnum = g.get("questionNumber")
        if qnum is not None:
            given_map[qnum] = {
                "marksObtained": g.get("marksObtained", 0),
                "maxMarks":      g.get("maxMarks", 0),
                "comment":       g.get("comment", ""),
            }

    violations      = []
    warnings        = []
    question_report = []
    total_scheme_max = 0
    total_given      = 0

    for qnum, scheme_max in scheme_map.items():
        total_scheme_max += scheme_max
        given_data = given_map.get(qnum)

        if given_data is None:
            # Question completely skipped
            violations.append({
                "type":            "SKIPPED_QUESTION",
                "severity":        "HIGH",
                "question_number": qnum,
                "message":         f"Q{qnum} not found in evaluation — question was skipped",
            })
            question_report.append({
                "question_number":  qnum,
                "scheme_max":       scheme_max,
                "marks_given":      None,
                "eval_max":         None,
                "status":           "❌ SKIPPED",
            })
            continue

        marks_given = given_data["marksObtained"]
        eval_max    = given_data["maxMarks"]
        total_given += marks_given

        q_flags  = []
        q_status = "✅ OK"

        # Over-marking: marks given > scheme max
        if marks_given > scheme_max:
            violations.append({
                "type":            "OVER_MARKED",
                "severity":        "CRITICAL",
                "question_number": qnum,
                "marks_given":     marks_given,
                "scheme_max":      scheme_max,
                "excess":          marks_given - scheme_max,
                "message": (
                    f"Q{qnum}: {marks_given} marks given but max is {scheme_max} "
                    f"— over-marked by {marks_given - scheme_max}"
                ),
            })
            q_flags.append("🚨 OVER-MARKED")
            q_status = "🚨 OVER-MARKED"

        # Eval max doesn't match scheme max
        if eval_max != scheme_max:
            warnings.append({
                "type":            "SCHEME_MISMATCH",
                "severity":        "MEDIUM",
                "question_number": qnum,
                "eval_max":        eval_max,
                "scheme_max":      scheme_max,
                "message": (
                    f"Q{qnum}: eval recorded max={eval_max} "
                    f"but test scheme says max={scheme_max}"
                ),
            })
            q_flags.append(f"⚠️ Max mismatch: eval={eval_max} vs scheme={scheme_max}")
            if q_status == "✅ OK":
                q_status = "⚠️ SCHEME MISMATCH"

        # Zero marks
        if marks_given == 0 and scheme_max > 0:
            warnings.append({
                "type":            "ZERO_MARKS",
                "severity":        "HIGH" if not q_flags else "MEDIUM",
                "question_number": qnum,
                "message":         f"Q{qnum}: 0 marks given (max: {scheme_max})",
            })
            q_flags.append("🚨 ZERO marks given")
            if q_status == "✅ OK":
                q_status = "⚠️ ZERO"

        pct = round((marks_given / scheme_max * 100), 2) if scheme_max > 0 else 0

        question_report.append({
            "question_number": qnum,
            "scheme_max":      scheme_max,
            "eval_max":        eval_max,
            "marks_given":     marks_given,
            "percentage":      pct,
            "flags":           q_flags,
            "status":          q_status,
        })

    # Questions in evaluation but NOT in test scheme
    for qnum, gdata in given_map.items():
        if qnum not in scheme_map:
            warnings.append({
                "type":            "EXTRA_QUESTION",
                "severity":        "MEDIUM",
                "question_number": qnum,
                "message": (
                    f"Q{qnum} exists in evaluation but not in test scheme — "
                    f"phantom question marked"
                ),
            })

    # Overall verdict
    critical_count = sum(1 for v in violations if v.get("severity") == "CRITICAL")
    high_count     = sum(1 for v in violations if v.get("severity") == "HIGH")

    if critical_count > 0:
        overall_verdict = f"🚨 CRITICAL: {critical_count} critical violation(s) found"
    elif high_count > 0 or len(violations) >= 2:
        overall_verdict = f"⚠️ HIGH: {len(violations)} violation(s) detected"
    elif len(warnings) > 2:
        overall_verdict = f"⚠️ MEDIUM: {len(warnings)} warning(s) detected"
    elif not violations and not warnings:
        overall_verdict = "✅ CLEAN: Evaluation matches test scheme perfectly"
    else:
        overall_verdict = f"ℹ️ {len(warnings)} minor warning(s) — review recommended"

    return {
        "available":          True,
        "overall_verdict":    overall_verdict,
        "total_questions":    len(scheme_map),
        "total_scheme_max":   total_scheme_max,
        "total_marks_given":  total_given,
        "violations":         violations,          # CRITICAL/HIGH issues
        "warnings":           warnings,            # MEDIUM issues
        "violation_count":    len(violations),
        "warning_count":      len(warnings),
        "question_report":    question_report,     # per-question breakdown
    }


def _build_submission_timeline(
    submission: dict,
    evaluation: dict | None,
) -> list:
    """
    Build a chronological timeline of key events for this submission:
    uploaded → evaluated → grievance filed → reevaluated.
    Helps LLM reason about timing gaps (e.g. evaluated too fast).
    """
    timeline = []

    uploaded_at = submission.get("uploadedAt") or submission.get("createdAt")
    if uploaded_at:
        timeline.append({
            "event":     "📤 Submission uploaded",
            "timestamp": uploaded_at,
        })

    if evaluation:
        evaluated_at = evaluation.get("evaluatedAt")
        if evaluated_at:
            timeline.append({
                "event":     "📝 Evaluation completed",
                "timestamp": evaluated_at,
            })

            # Time gap between upload and evaluation
            if uploaded_at and evaluated_at:
                try:
                    # Handle both string and datetime
                    if isinstance(uploaded_at, str):
                        up = datetime.fromisoformat(uploaded_at.replace("Z", "+00:00"))
                    else:
                        up = uploaded_at
                    if isinstance(evaluated_at, str):
                        ev = datetime.fromisoformat(evaluated_at.replace("Z", "+00:00"))
                    else:
                        ev = evaluated_at

                    gap_seconds = abs((ev - up).total_seconds())
                    gap_minutes = round(gap_seconds / 60, 1)

                    timeline.append({
                        "event": (
                            f"⏱ Upload→Evaluation gap: {gap_minutes} min"
                            + (" 🚨 Suspiciously fast" if gap_minutes < 2 else "")
                        ),
                        "timestamp": None,
                        "gap_minutes": gap_minutes,
                        "suspicious":  gap_minutes < 2,
                    })
                except Exception:
                    pass

        if evaluation.get("isDraft"):
            timeline.append({
                "event":     "📋 Evaluation saved as DRAFT (not finalised)",
                "timestamp": evaluation.get("evaluatedAt"),
            })

        if not evaluation.get("blockchainVerified", True):
            timeline.append({
                "event":     "❌ Blockchain verification MISSING",
                "timestamp": None,
            })

    return timeline
