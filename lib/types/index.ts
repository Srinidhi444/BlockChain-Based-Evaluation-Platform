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

// Dashboard Stats Types
export interface StudentStats {
  totalSubmissions: number;
  evaluatedSubmissions: number;
  pendingSubmissions: number;
  averageMarks: number;
}

export interface TeacherStats {
  totalSubmissions: number;
  evaluatedSubmissions: number;
  pendingSubmissions: number;
  testsCreated: number;
}

// File Upload Types
export interface FileUploadResult {
  url: string;
  hash: string;
  size: number;
  type: string;
}

// Add Student Types (NEW)
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
