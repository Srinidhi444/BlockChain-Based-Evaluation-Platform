from .audit_tools import (
    get_audit_logs,
    get_teacher_audit_summary,
)
from .evaluation_tools import (
    get_evaluation_by_submission,
    get_evaluations_by_teacher,
    get_evaluation_metrics,
)
from .submission_tools import (
    get_submission,
    get_submission_with_test,
)
from .teacher_tools import (
    get_teacher_profile,
    get_all_teachers,
)
from .grievance_tools import (
    get_grievances_by_teacher,
    get_grievance_by_id,
    get_reevaluation_by_grievance,
)
from .test_tools import (
    get_test_details,
    get_test_questions,
)
from .comparison_tools import (
    compare_teacher_with_peers,
    get_teacher_bias_report,
)

# Master tool registry - used by the agent
ALL_TOOLS = {
    "get_audit_logs":                get_audit_logs,
    "get_teacher_audit_summary":     get_teacher_audit_summary,
    "get_evaluation_by_submission":  get_evaluation_by_submission,
    "get_evaluations_by_teacher":    get_evaluations_by_teacher,
    "get_evaluation_metrics":        get_evaluation_metrics,
    "get_submission":                get_submission,
    "get_submission_with_test":      get_submission_with_test,
    "get_teacher_profile":           get_teacher_profile,
    "get_all_teachers":              get_all_teachers,
    "get_grievances_by_teacher":     get_grievances_by_teacher,
    "get_grievance_by_id":           get_grievance_by_id,
    "get_reevaluation_by_grievance": get_reevaluation_by_grievance,
    "get_test_details":              get_test_details,
    "get_test_questions":            get_test_questions,
    "compare_teacher_with_peers":    compare_teacher_with_peers,
    "get_teacher_bias_report":       get_teacher_bias_report,
}
