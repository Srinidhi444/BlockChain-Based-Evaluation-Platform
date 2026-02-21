from db import get_collection, serialize_doc


def get_submission(submission_id: str) -> dict:
    """
    Get a submission document including the answer sheet URL.

    Args:
        submission_id: The submission ID

    Returns:
        Submission details with file info and answer sheet URL
    """
    try:
        col = get_collection("submissions")
        doc = col.find_one({"submissionId": submission_id})

        if not doc:
            return {
                "success": False,
                "message": f"No submission found: {submission_id}",
            }

        s = serialize_doc(doc)

        # Add file size in MB
        file_size = s.get("fileSize", 0)
        s["fileSizeMB"] = round(file_size / (1024 * 1024), 2) if file_size else 0

        # Summarize answer sheet info (don't send full base64 URL)
        url = s.get("answerSheetUrl", "")
        if url.startswith("data:"):
            s["answerSheetUrl"]     = "[Base64 encoded file - too large to display]"
            s["answerSheetAvailable"] = True
        elif url.startswith("http"):
            s["answerSheetAvailable"] = True
        else:
            s["answerSheetAvailable"] = False

        return {"success": True, "submission": s}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_submission_with_test(submission_id: str) -> dict:
    """
    Get submission combined with its test details.
    Useful for verifying if marks given match the question weights.

    Args:
        submission_id: The submission ID

    Returns:
        Combined submission + test document
    """
    try:
        sub_col  = get_collection("submissions")
        test_col = get_collection("tests")

        sub = sub_col.find_one({"submissionId": submission_id})
        if not sub:
            return {
                "success": False,
                "message": f"Submission not found: {submission_id}",
            }

        s = serialize_doc(sub)

        # Strip base64 answer sheet
        url = s.get("answerSheetUrl", "")
        if url.startswith("data:"):
            s["answerSheetUrl"] = "[Base64 file - available for download]"

        # Get associated test
        test = test_col.find_one({"testId": s.get("testId")})
        t    = serialize_doc(test) if test else None

        # Remove answer sheet from test too if present
        if t:
            t.pop("answerSheetUrl", None)

        return {
            "success":    True,
            "submission": s,
            "test":       t,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
