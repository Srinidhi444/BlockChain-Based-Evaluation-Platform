from db import get_collection, serialize_doc, serialize_docs


def get_grievances_by_teacher(
    teacher_id: str,
    limit: int = 20,
) -> dict:
    """
    Get all grievances filed against a specific teacher.

    Args:
        teacher_id: Teacher userId
        limit:      Max records (default 20)

    Returns:
        List of grievances with outcome info
    """
    try:
        grv_col  = get_collection("grievances")
        reval_col = get_collection("reevaluations")

        grievances = list(
            grv_col.find({"assignedTeacherId": teacher_id})
                   .sort("filedAt", -1)
                   .limit(limit)
        )

        # Also check grievances where teacher did the original evaluation
        if not grievances:
            eval_col = get_collection("evaluations")
            evals = list(eval_col.find(
                {"teacherId": teacher_id},
                {"submissionId": 1}
            ))
            sub_ids = [e["submissionId"] for e in evals]
            grievances = list(
                grv_col.find({"submissionId": {"$in": sub_ids}})
                       .sort("filedAt", -1)
                       .limit(limit)
            )

        if not grievances:
            return {
                "success":    True,
                "teacher_id": teacher_id,
                "message":    "No grievances found for this teacher.",
                "total":      0,
                "grievances": [],
            }

        serialized = serialize_docs(grievances)

        # Enrich with reevaluation outcomes
        successful = 0
        total_mark_change = 0

        for g in serialized:
            reval = reval_col.find_one(
                {"grievanceId": g.get("grievanceId")}
            )
            if reval:
                r = serialize_doc(reval)
                orig  = r.get("originalMarks", 0)
                new   = r.get("newMarks", 0)
                diff  = new - orig
                g["reevaluation_outcome"] = {
                    "original_marks": orig,
                    "new_marks":      new,
                    "difference":     diff,
                    "marks_changed":  diff != 0,
                }
                if diff != 0:
                    successful += 1
                    total_mark_change += abs(diff)
            else:
                g["reevaluation_outcome"] = None

        return {
            "success":                 True,
            "teacher_id":              teacher_id,
            "total":                   len(serialized),
            "successful_grievances":   successful,
            "success_rate_pct":        round(
                (successful / len(serialized) * 100), 2
            ) if serialized else 0,
            "avg_mark_change":         round(
                total_mark_change / successful, 2
            ) if successful else 0,
            "grievances":              serialized,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_grievance_by_id(grievance_id: str) -> dict:
    """
    Get a specific grievance by ID.

    Args:
        grievance_id: Grievance ID

    Returns:
        Full grievance document with reevaluation outcome
    """
    try:
        col   = get_collection("grievances")
        reval = get_collection("reevaluations")

        doc = col.find_one({"grievanceId": grievance_id})
        if not doc:
            return {
                "success": False,
                "message": f"Grievance not found: {grievance_id}",
            }

        g = serialize_doc(doc)

        # Attach reevaluation if exists
        r = reval.find_one({"grievanceId": grievance_id})
        g["reevaluation"] = serialize_doc(r) if r else None

        return {"success": True, "grievance": g}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_reevaluation_by_grievance(grievance_id: str) -> dict:
    """
    Get the reevaluation result for a given grievance.

    Args:
        grievance_id: Grievance ID

    Returns:
        Reevaluation document with mark comparison
    """
    try:
        col = get_collection("reevaluations")
        doc = col.find_one({"grievanceId": grievance_id})

        if not doc:
            return {
                "success": False,
                "message": f"No reevaluation found for grievance: {grievance_id}",
            }

        r = serialize_doc(doc)
        orig = r.get("originalMarks", 0)
        new  = r.get("newMarks", 0)
        diff = new - orig

        r["analysis"] = {
            "marks_difference":   diff,
            "direction":          "increased" if diff > 0 else "decreased" if diff < 0 else "unchanged",
            "significant_change": abs(diff) > 10,
            "pct_change":         round((diff / orig * 100), 2) if orig > 0 else 0,
        }

        return {"success": True, "reevaluation": r}

    except Exception as e:
        return {"success": False, "error": str(e)}
