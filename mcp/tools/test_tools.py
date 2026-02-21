from db import get_collection, serialize_doc, serialize_docs


def get_test_details(test_id: str) -> dict:
    """
    Get full test details including questions and marking scheme.

    Args:
        test_id: Test ID

    Returns:
        Test document with questions and marks breakdown
    """
    try:
        col = get_collection("tests")
        doc = col.find_one({"testId": test_id})

        if not doc:
            return {
                "success": False,
                "message": f"Test not found: {test_id}",
            }

        t = serialize_doc(doc)

        # Compute total marks from questions
        questions = t.get("questions", [])
        total     = sum(q.get("marks", 0) for q in questions)
        t["computed_total_marks"] = total

        return {"success": True, "test": t}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_test_questions(test_id: str) -> dict:
    """
    Get only the questions and marks breakdown for a test.
    Useful for verifying if evaluator followed the marking scheme.

    Args:
        test_id: Test ID

    Returns:
        Questions list with marks and descriptions
    """
    try:
        col = get_collection("tests")
        doc = col.find_one(
            {"testId": test_id},
            {"questions": 1, "title": 1, "subject": 1, "totalMarks": 1}
        )

        if not doc:
            return {
                "success": False,
                "message": f"Test not found: {test_id}",
            }

        t = serialize_doc(doc)
        questions = t.get("questions", [])

        return {
            "success":     True,
            "test_id":     test_id,
            "title":       t.get("title"),
            "subject":     t.get("subject"),
            "total_marks": t.get("totalMarks"),
            "questions":   questions,
            "question_count": len(questions),
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
