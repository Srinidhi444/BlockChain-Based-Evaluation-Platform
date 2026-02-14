import { z } from 'zod';
import { UserRole } from '@/lib/types';

/**
 * Validation schemas using Zod
 */

// User ID validation regex
const USER_ID_REGEX = /^(ST|TCH|ADM)\d{7}$/;
const TEST_ID_REGEX = /^TEST_[A-Z]+_\d{4}_\d+$/;

// ==================== Auth Schemas ====================

export const loginSchema = z.object({
  userId: z.string()
    .min(1, 'User ID is required')
    .regex(USER_ID_REGEX, 'Invalid User ID format (e.g., ST2026001, TCH2026001)'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password cannot exceed 100 characters')
});

export const registerSchema = z.object({
  userId: z.string()
    .regex(USER_ID_REGEX, 'Invalid User ID format'),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password cannot exceed 100 characters'),
  role: z.nativeEnum(UserRole),
  department: z.string()
    .min(2, 'Department is required')
    .optional(),
  year: z.number()
    .min(1, 'Year must be between 1 and 4')
    .max(4, 'Year must be between 1 and 4')
    .optional(),
  division: z.string()
    .length(1, 'Division must be a single character')
    .toUpperCase()
    .optional(),
  subjects: z.array(z.string()).optional()
}).refine(
  (data) => {
    // Students must have department, year, and division
    if (data.role === UserRole.STUDENT) {
      return data.department && data.year && data.division;
    }
    return true;
  },
  {
    message: 'Students must have department, year, and division',
    path: ['role']
  }
).refine(
  (data) => {
    // Teachers must have department and subjects
    if (data.role === UserRole.TEACHER) {
      return data.department && data.subjects && data.subjects.length > 0;
    }
    return true;
  },
  {
    message: 'Teachers must have department and at least one subject',
    path: ['role']
  }
);

// ==================== Test Schemas ====================

export const questionSchema = z.object({
  questionNumber: z.number()
    .min(1, 'Question number must be at least 1'),
  marks: z.number()
    .min(0, 'Marks cannot be negative'),
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
});

export const createTestSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .trim(),
  subject: z.string()
    .min(2, 'Subject is required')
    .trim(),
  department: z.string()
    .min(2, 'Department is required')
    .trim(),
  year: z.number()
    .min(1, 'Year must be between 1 and 4')
    .max(4, 'Year must be between 1 and 4'),
  division: z.string()
    .trim()
    .toUpperCase()
    .default('ALL'),
  totalMarks: z.number()
    .min(1, 'Total marks must be at least 1'),
  questions: z.array(questionSchema)
    .min(1, 'At least one question is required'),
  academicYear: z.string()
    .regex(/^\d{4}-\d{2}$/, 'Academic year format must be YYYY-YY (e.g., 2025-26)'),
  examType: z.enum(['midterm', 'endsem', 'assignment', 'quiz']),
  examDate: z.string()
    .or(z.date())
}).refine(
  (data) => {
    // Validate that totalMarks equals sum of question marks
    const sumOfQuestionMarks = data.questions.reduce((sum, q) => sum + q.marks, 0);
    return sumOfQuestionMarks === data.totalMarks;
  },
  {
    message: 'Total marks must equal sum of question marks',
    path: ['totalMarks']
  }
).refine(
  (data) => {
    // Validate unique question numbers
    const questionNumbers = data.questions.map(q => q.questionNumber);
    const uniqueNumbers = new Set(questionNumbers);
    return questionNumbers.length === uniqueNumbers.size;
  },
  {
    message: 'Question numbers must be unique',
    path: ['questions']
  }
);

// ==================== Submission Schemas ====================

export const createSubmissionSchema = z.object({
  testId: z.string()
    .regex(TEST_ID_REGEX, 'Invalid Test ID format'),
  fileHash: z.string()
    .length(64, 'SHA-256 hash must be 64 characters')
    .regex(/^[a-f0-9]{64}$/i, 'Invalid SHA-256 hash format'),
  fileSize: z.number()
    .min(1, 'File size must be greater than 0')
    .max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
  fileType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']),
  answerSheetUrl: z.string()
    .url('Invalid URL format')
    .or(z.string().startsWith('/'))
});

export const submissionFiltersSchema = z.object({
  department: z.string().optional(),
  year: z.number().min(1).max(4).optional(),
  division: z.string().optional(),
  subject: z.string().optional(),
  testId: z.string().optional(),
  status: z.enum(['uploaded', 'under_evaluation', 'evaluated', 'published']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
});

// ==================== Evaluation Schemas ====================

export const questionMarkSchema = z.object({
  questionNumber: z.number()
    .min(1, 'Question number must be at least 1'),
  maxMarks: z.number()
    .min(0, 'Maximum marks cannot be negative'),
  marksObtained: z.number()
    .min(0, 'Marks obtained cannot be negative'),
  comment: z.string()
    .max(500, 'Comment cannot exceed 500 characters')
    .optional()
}).refine(
  (data) => data.marksObtained <= data.maxMarks,
  {
    message: 'Marks obtained cannot exceed maximum marks',
    path: ['marksObtained']
  }
);

// ==================== Audit Schemas (NEW) ====================

export const questionTimingSchema = z.object({
  questionNumber: z.number()
    .min(1, 'Question number must be at least 1'),
  timeSpent: z.number()
    .min(0, 'Time spent cannot be negative')
    .max(3600, 'Time spent cannot exceed 1 hour per question'), // 1 hour max per question
  markedAt: z.string()
    .or(z.date())
    .optional(),
  sequenceOrder: z.number()
    .min(1, 'Sequence order must be at least 1')
    .optional()
});

export const createEvaluationSchema = z.object({
  submissionId: z.string()
    .min(1, 'Submission ID is required'),
  questionMarks: z.array(questionMarkSchema)
    .min(1, 'At least one question must be evaluated'),
  remarks: z.string()
    .max(1000, 'Remarks cannot exceed 1000 characters')
    .optional(),
  isDraft: z.boolean().default(true),
  
  // ✅ NEW: Audit tracking fields
  sessionId: z.string()
    .optional(),
  sessionStartTime: z.string()
    .or(z.date())
    .optional(),
  sessionEndTime: z.string()
    .or(z.date())
    .optional(),
  questionTimings: z.array(questionTimingSchema)
    .optional()
}).refine(
  (data) => {
    // Validate unique question numbers
    const questionNumbers = data.questionMarks.map(q => q.questionNumber);
    const uniqueNumbers = new Set(questionNumbers);
    return questionNumbers.length === uniqueNumbers.size;
  },
  {
    message: 'Question numbers must be unique',
    path: ['questionMarks']
  }
).refine(
  (data) => {
    // If not draft, session times are required
    if (!data.isDraft) {
      return data.sessionStartTime && data.sessionEndTime;
    }
    return true;
  },
  {
    message: 'Session start and end times are required for final submission',
    path: ['isDraft']
  }
).refine(
  (data) => {
    // If question timings provided, they should match question marks
    if (data.questionTimings && data.questionTimings.length > 0) {
      const timingQuestions = data.questionTimings.map(t => t.questionNumber);
      const markedQuestions = data.questionMarks.map(q => q.questionNumber);
      
      return timingQuestions.every(tq => markedQuestions.includes(tq));
    }
    return true;
  },
  {
    message: 'Question timings must correspond to marked questions',
    path: ['questionTimings']
  }
);

export const updateQuestionMarkSchema = z.object({
  questionNumber: z.number().min(1),
  marksObtained: z.number().min(0),
  comment: z.string().max(500).optional()
});

// ==================== Grievance Schemas (NEW) ====================

export const createGrievanceSchema = z.object({
  submissionId: z.string()
    .min(1, 'Submission ID is required'),
  grievanceType: z.enum(['calculation_error', 'reevaluation']),
  questionNumber: z.number()
    .min(1)
    .optional(),
  explanation: z.string()
    .min(20, 'Explanation must be at least 20 characters')
    .max(1000, 'Explanation cannot exceed 1000 characters')
    .trim()
});

export const createReEvaluationSchema = z.object({
  grievanceId: z.string()
    .min(1, 'Grievance ID is required'),
  questionMarks: z.array(questionMarkSchema)
    .min(1, 'At least one question must be evaluated'),
  remarks: z.string()
    .max(1000, 'Remarks cannot exceed 1000 characters')
    .optional(),
  
  // ✅ Audit tracking fields
  sessionId: z.string()
    .optional(),
  sessionStartTime: z.string()
    .or(z.date())
    .optional(),
  sessionEndTime: z.string()
    .or(z.date())
    .optional(),
  questionTimings: z.array(questionTimingSchema)
    .optional()
}).refine(
  (data) => {
    // Session times are required for re-evaluation
    return data.sessionStartTime && data.sessionEndTime;
  },
  {
    message: 'Session start and end times are required for re-evaluation',
    path: ['sessionStartTime']
  }
);

// ==================== File Upload Schemas ====================

export const fileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File size cannot exceed 10MB')
    .refine(
      (file) => ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.type),
      'File type must be PDF, JPEG, or PNG'
    )
});

// ==================== Helper Functions ====================

/**
 * Validate data against schema and return parsed result
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

/**
 * Validate request body and return formatted errors
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; errors: string[] }> {
  try {
    const body = await request.json();
    return validateData(schema, body);
  } catch (error) {
    return { success: false, errors: ['Invalid JSON in request body'] };
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: string[] } {
  const params: Record<string, any> = {};
  
  searchParams.forEach((value, key) => {
    // Try to parse numbers
    if (!isNaN(Number(value))) {
      params[key] = Number(value);
    } else {
      params[key] = value;
    }
  });
  
  return validateData(schema, params);
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.errors.map(err => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  });
}
