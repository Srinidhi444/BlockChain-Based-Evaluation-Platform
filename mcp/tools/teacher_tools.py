from db import get_collection, serialize_doc, serialize_docs


def get_teacher_profile(teacher_id: str) -> dict:
    """
    Get a teacher's profile from the users collection.

    Args:
        teacher_id: Teacher userId (e.g. TCH2026001)

    Returns:
        Teacher profile (without password)
    """
    try:
        col = get_collection("users")
        doc = col.find_one(
            {"userId": teacher_id, "role": "teacher"},
            {"password": 0}     # Never return password
        )

        if not doc:
            return {
                "success": False,
                "message": f"Teacher not found: {teacher_id}",
            }

        return {"success": True, "teacher": serialize_doc(doc)}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_all_teachers(department: str = None) -> dict:
    """
    Get all teachers, optionally filtered by department.

    Args:
        department: Filter by department name (optional)

    Returns:
        List of teacher profiles (without passwords)
    """
    try:
        col   = get_collection("users")
        query = {"role": "teacher"}

        if department:
            query["department"] = department

        docs = list(
            col.find(query, {"password": 0})
               .sort("name", 1)
        )

        if not docs:
            return {
                "success": True,
                "message": "No teachers found.",
                "teachers": [],
            }

        return {
            "success":  True,
            "total":    len(docs),
            "teachers": serialize_docs(docs),
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
