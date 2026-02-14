// User Types
export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin'
}

export interface IUser {
  _id: string;
  userId: string; // Unique login ID (e.g., ST2024001, TCH2024001)
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department?: string;
  year?: number; // For students (1-4)
  division?: string; // A, B, C, etc.
  subjects?: string[]; // For teachers - subjects they can evaluate
  createdAt: Date;
  updatedAt: Date;
}

// Test (Question Paper) Types
export interface ITest {
  _id: string;
  testId: string; // Auto-generated: TEST_DEPT_YEAR_TIMESTAMP (e.g., TEST_CSE_2026_1707654321)
  title: string;
  subject: string;
  department: string;
  year: number;
  division?: string; // Optional: specific division or "ALL"
  totalMarks: number;
  questions: IQuestion[];
  uploadedBy: string; // Teacher userId
  academicYear: string; // e.g., "2025-26"
  examType: 'midterm' | 'endsem' | 'assignment' | 'quiz';
  examDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuestion {
  questionNumber: number;
  marks: number;
  description?: string; // Optional question text
}

// Submission (Student Answer Sheet) Types
export interface ISubmission {
  _id: string;
  submissionId: string; // Auto-generated: STUDENTID_TESTID_TIMESTAMP
  testId: string; // Links to Test
  studentId: string; // User.userId (e.g., ST2024001)
  studentName: string; // For display only (anonymized during evaluation)
  department: string;
  year: number;
  division: string;
  subject: string;
  
  // File details
  fileName: string; // Added for display
  answerSheetUrl: string; // PDF/Image URL
  fileHash: string; // SHA-256 hash for blockchain
  fileSize: number;
  fileType: string;
  
  // Status tracking
  status: 'uploaded' | 'under_evaluation' | 'evaluated' | 'published';
  uploadedAt: Date;
  
  // Blockchain (for later)
  blockchainTxHash?: string;
  blockchainVerified: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// Evaluation (Teacher Marks) Types
export interface IEvaluation {
  _id: string;
  evaluationId: string; // Auto-generated: EVAL_SUBMISSIONID_TEACHERID
  submissionId: string; // Links to Submission
  testId: string;
  teacherId: string; // User.userId
  teacherName: string;
  
  // Marks breakdown
  questionMarks: IQuestionMark[];
  totalMarksObtained: number;
  totalMarks: number;
  percentage: number;
  
  // Comments
  remarks?: string;
  
  // Status
  isDraft: boolean; // True if teacher is still evaluating
  evaluatedAt?: Date;
  
  // Blockchain (for later)
  resultHash: string; // Hash of final marks
  blockchainTxHash?: string;
  blockchainVerified: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuestionMark {
  questionNumber: number;
  maxMarks: number;
  marksObtained: number;
  comment?: string;
}

// Grievance Types (NEW)
export interface IGrievance {
  _id: string;
  grievanceId: string; // Format: GRV_SUBMISSIONID_TIMESTAMP
  submissionId: string;
  testId: string;
  studentId: string;
  studentName: string;
  
  grievanceType: 'calculation_error' | 'reevaluation';
  questionNumber?: number;
  explanation: string;
  
  originalTeacherId: string;
  assignedTeacherId: string;
  
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  
  originalEvaluationId: string;
  reevaluationId?: string;
  
  filedAt: Date;
  assignedAt?: Date;
  completedAt?: Date;
  
  adminNotes?: string;
  rejectionReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Re-evaluation Types (NEW)
export interface IQuestionMarkComparison {
  questionNumber: number;
  maxMarks: number;
  oldMarksObtained: number;
  newMarksObtained: number;
  oldComment?: string;
  newComment?: string;
  difference: number;
}

export interface IReEvaluation {
  _id: string;
  reevaluationId: string; // Format: REEVAL_GRIEVANCEID_TIMESTAMP
  grievanceId: string;
  submissionId: string;
  testId: string;
  studentId: string;
  
  // Original evaluation
  originalEvaluationId: string;
  originalTeacherId: string;
  originalTeacherName: string;
  originalQuestionMarks: IQuestionMark[];
  originalTotalMarksObtained: number;
  originalTotalMarks: number;
  originalPercentage: number;
  originalRemarks?: string;
  originalEvaluatedAt: Date;
  
  // New evaluation
  newTeacherId: string;
  newTeacherName: string;
  newQuestionMarks: IQuestionMark[];
  newTotalMarksObtained: number;
  newTotalMarks: number;
  newPercentage: number;
  newRemarks?: string;
  newEvaluatedAt: Date;
  
  // Comparison
  comparisonData: IQuestionMarkComparison[];
  totalDifference: number;
  percentageDifference: number;
  
  // Approval
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  
  // Blockchain
  resultHash: string;
  blockchainTxHash?: string;
  blockchainVerified: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// ==================== AUDIT SYSTEM TYPES (NEW) ====================

// Audit Event Types Enum
export enum AuditEventType {
  // Evaluation Events
  EVALUATION_STARTED = 'evaluation_started',
  EVALUATION_QUESTION_MARKED = 'evaluation_question_marked',
  EVALUATION_DRAFT_SAVED = 'evaluation_draft_saved',
  EVALUATION_COMPLETED = 'evaluation_completed',
  EVALUATION_PUBLISHED = 'evaluation_published',
  
  // Re-evaluation Events
  REEVALUATION_STARTED = 'reevaluation_started',
  REEVALUATION_QUESTION_MARKED = 'reevaluation_question_marked',
  REEVALUATION_COMPLETED = 'reevaluation_completed',
  
  // Grievance Events
  GRIEVANCE_FILED = 'grievance_filed',
  GRIEVANCE_ASSIGNED = 'grievance_assigned',
  GRIEVANCE_IN_PROGRESS = 'grievance_in_progress',
  GRIEVANCE_COMPLETED = 'grievance_completed',
  GRIEVANCE_REJECTED = 'grievance_rejected',
  GRIEVANCE_LIST_ACCESSED = 'grievance_list_accessed',
  
  // Access Events
  SUBMISSION_ACCESSED = 'submission_accessed',
  SUBMISSION_LIST_ACCESSED = 'submission_list_accessed',
  EVALUATION_ACCESSED = 'evaluation_accessed',
}

// Audit Log Interface
export interface IAuditLog {
  _id: string;
  eventId: string; // Unique event ID
  eventType: AuditEventType;
  timestamp: Date;
  
  // User Context
  userId: string;
  userRole: 'student' | 'teacher' | 'admin';
  userName?: string;
  department?: string;
  
  // Entity Context
  submissionId?: string;
  testId?: string;
  evaluationId?: string;
  grievanceId?: string;
  studentId?: string;
  studentName?: string;
  teacherId?: string;
  
  // Session Context
  sessionId?: string;
  
  // Question-Level Data (for marking events)
  questionNumber?: number;
  marksAwarded?: number;
  maxMarks?: number;
  comment?: string;
  timeSpent?: number; // Seconds spent on this question
  cumulativeTime?: number; // Total time spent so far
  questionSequence?: number; // Order in which question was marked
  
  // Evaluation Context
  totalMarksAwarded?: number;
  totalMaxMarks?: number;
  percentage?: number;
  
  // Re-evaluation Context
  originalEvaluationId?: string;
  originalTeacherId?: string;
  originalMarks?: number;
  newMarks?: number;
  marksDifference?: number;
  
  // Grievance Context
  grievanceType?: 'calculation_error' | 'reevaluation';
  assignedTeacherId?: string;
  
  // Academic Context
  subject?: string;
  year?: number;
  division?: string;
  academicYear?: string;
  
  // Device & Location Context
  ipAddress?: string;
  deviceInfo?: string;
  userAgent?: string;
  
  // Additional Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
}

// Question Timing Data
export interface IQuestionTiming {
  questionNumber: number;
  timeSpent: number; // Seconds
  markedAt: Date;
  sequenceOrder: number; // Order in which question was marked
}

// Evaluation Session Data
export interface IEvaluationSession {
  evaluationId: string;
  submissionId: string;
  testId: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName?: string;
  department: string;
  subject: string;
  year: number;
  division: string;
  academicYear: string;
  
  // Session Tracking
  sessionId: string;
  sessionStartTime: Date;
  sessionEndTime: Date;
  
  // Marks Data
  questionMarks: Array<{
    questionNumber: number;
    maxMarks: number;
    marksAwarded: number;
    comment?: string;
    timeSpent: number;
    markedAt: Date;
    sequenceOrder: number;
  }>;
  
  totalMarksAwarded: number;
  totalMaxMarks: number;
  
  // Re-evaluation Context (if applicable)
  isReevaluation?: boolean;
  originalEvaluationId?: string;
  grievanceId?: string;
}

// Bias Detection Metrics
export interface IBiasMetrics {
  teacherId: string;
  teacherName: string;
  department: string;
  subject: string;
  academicYear: string;
  
  // Evaluation Statistics
  totalEvaluations: number;
  averageMarksAwarded: number;
  averagePercentage: number;
  standardDeviation: number;
  
  // Timing Statistics
  averageTimePerSubmission: number; // Minutes
  averageTimePerQuestion: number; // Seconds
  fastestEvaluation: number; // Minutes
  slowestEvaluation: number; // Minutes
  
  // Pattern Detection
  marksDistribution: {
    range: string; // e.g., "0-20", "20-40"
    count: number;
    percentage: number;
  }[];
  
  // Grievance Statistics
  totalGrievances: number;
  grievancesAccepted: number; // Mark changes after re-evaluation
  grievancesRejected: number; // No mark changes
  averageMarkChangeOnGrievance: number;
  
  // Consistency Metrics
  consistencyScore: number; // 0-100
  biasScore: number; // 0-100 (higher = more bias detected)
  
  // Time-based Patterns
  evaluationsByTimeOfDay: {
    hour: number;
    count: number;
    averageMarks: number;
  }[];
  
  // Student-based Patterns
  evaluationsByStudentYear: {
    year: number;
    count: number;
    averageMarks: number;
  }[];
}

// ==================== API TYPES WITH AUDIT ====================

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Auth Types
export interface LoginCredentials {
  userId: string;
  password: string;
}

export interface RegisterData {
  userId: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department?: string;
  year?: number;
  division?: string;
  subjects?: string[];
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Filter Types
export interface SubmissionFilters {
  department?: string;
  year?: number;
  division?: string;
  subject?: string;
  testId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface GrievanceFilters {
  status?: 'pending' | 'in_progress' | 'completed' | 'rejected';
  grievanceType?: 'calculation_error' | 'reevaluation';
  studentId?: string;
  teacherId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Dashboard Stats Types
export interface StudentStats {
  totalSubmissions: number;
  evaluatedSubmissions: number;
  pendingSubmissions: number;
  averageMarks: number;
  grievancesFiled?: number;
  grievancesCompleted?: number;
}

export interface TeacherStats {
  totalSubmissions: number;
  evaluatedSubmissions: number;
  pendingSubmissions: number;
  testsCreated: number;
  pendingGrievances?: number;
  completedGrievances?: number;
  averageEvaluationTime?: number; // Minutes (NEW)
  biasScore?: number; // 0-100 (NEW)
}

// File Upload Types
export interface FileUploadResult {
  url: string;
  hash: string;
  size: number;
  type: string;
}

// Add Student Types
export interface AddStudentRequest {
  name: string;
  email: string;
  department: string;
  year: number;
  division: string;
  subjects?: string[];
}

export interface AddStudentResponse {
  success: boolean;
  message: string;
  data: {
    student: {
      userId: string;
      name: string;
      email: string;
      department: string;
      year: number;
      division: string;
      subjects: string[];
    };
    credentials: {
      userId: string;
      password: string;
      emailSent: boolean;
    };
  };
}

// Grievance Request/Response Types
export interface FileGrievanceRequest {
  submissionId: string;
  grievanceType: 'calculation_error' | 'reevaluation';
  questionNumber?: number;
  explanation: string;
}

export interface FileGrievanceResponse {
  success: boolean;
  message: string;
  data: {
    grievance: {
      grievanceId: string;
      submissionId: string;
      grievanceType: string;
      status: string;
      filedAt: Date;
      assignedTeacherId: string;
    };
  };
}

// Re-evaluation Request/Response (with audit)
export interface ReEvaluateRequest {
  grievanceId: string;
  questionMarks: IQuestionMark[];
  remarks?: string;
  
  // ✅ NEW: Audit tracking fields
  sessionId?: string;
  sessionStartTime?: string | Date;
  sessionEndTime?: string | Date;
  questionTimings?: IQuestionTiming[];
}

export interface ReEvaluateResponse {
  success: boolean;
  message: string;
  data: {
    reevaluation: {
      reevaluationId: string;
      grievanceId: string;
      submissionId: string;
      originalTotalMarksObtained: number;
      newTotalMarksObtained: number;
      totalDifference: number;
      originalPercentage: number;
      newPercentage: number;
      percentageDifference: number;
      comparisonData: IQuestionMarkComparison[];
      resultHash: string;
    };
    sessionId?: string; // ✅ NEW: Return sessionId for tracking
  };
}

// Evaluation Request (with audit)
export interface CreateEvaluationRequest {
  submissionId: string;
  questionMarks: IQuestionMark[];
  remarks?: string;
  isDraft?: boolean;
  
  // ✅ NEW: Audit tracking fields
  sessionId?: string;
  sessionStartTime?: string | Date;
  sessionEndTime?: string | Date;
  questionTimings?: IQuestionTiming[];
}

export interface CreateEvaluationResponse {
  success: boolean;
  message: string;
  data: {
    evaluation: {
      evaluationId: string;
      submissionId: string;
      totalMarksObtained: number;
      totalMarks: number;
      percentage: number;
      isDraft: boolean;
      resultHash: string;
    };
    sessionId?: string; // ✅ NEW: Return sessionId for tracking
  };
}

// Audit Query Filters (NEW)
export interface AuditLogFilters {
  eventType?: AuditEventType | AuditEventType[];
  userId?: string;
  userRole?: 'student' | 'teacher' | 'admin';
  department?: string;
  subject?: string;
  testId?: string;
  submissionId?: string;
  evaluationId?: string;
  grievanceId?: string;
  sessionId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  limit?: number;
  skip?: number;
}

// Bias Analysis Request (NEW)
export interface BiasAnalysisRequest {
  teacherId?: string;
  department?: string;
  subject?: string;
  academicYear?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
}

export interface BiasAnalysisResponse {
  success: boolean;
  data: {
    metrics: IBiasMetrics;
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
}
