/**
 * ID Generator Utilities
 * Generates unique IDs for Tests, Submissions, Evaluations, and Users
 */

/**
 * Generate Test ID
 * Format: TEST_DEPT_YEAR_TIMESTAMP
 * Example: TEST_CS_2026_1707654321
 */
export function generateTestId(
  department: string,
  year: number
): string {
  const timestamp = Date.now();
  
  // Clean department: remove spaces, special chars, keep alphanumeric, uppercase
  const deptCode = department
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 20) // Limit length
    || 'DEPT'; // Fallback if empty after cleaning
  
  return `TEST_${deptCode}_${year}_${timestamp}`;
}

/**
 * Generate Submission ID
 * Format: SUB_STUDENTID_TESTID_TIMESTAMP
 * Example: SUB_ST2026001_TEST_CS_3_1707654321_1707654500
 */
export function generateSubmissionId(
  studentId: string,
  testId: string
): string {
  const timestamp = Date.now();
  return `SUB_${studentId}_${testId}_${timestamp}`;
}

/**
 * Generate Evaluation ID
 * Format: EVAL_SUBMISSIONID_TEACHERID
 * Example: EVAL_SUB_ST2026001_TEST_CS_3_1707654321_1707654500_TCH2026001
 */
export function generateEvaluationId(
  submissionId: string,
  teacherId: string
): string {
  return `EVAL_${submissionId}_${teacherId}`;
}

/**
 * Generate User ID
 * Format: ROLE_YEAR_SEQUENCE
 * Example: ST2026001, TCH2026005
 */
export function generateUserId(
  role: 'student' | 'teacher' | 'admin',
  sequence: number
): string {
  const year = new Date().getFullYear();
  const rolePrefix = role === 'student' ? 'ST' : role === 'teacher' ? 'TCH' : 'ADM';
  const paddedSequence = sequence.toString().padStart(3, '0');
  return `${rolePrefix}${year}${paddedSequence}`;
}

/**
 * Parse Test ID to extract components
 */
export function parseTestId(testId: string): {
  department: string;
  year: number;
  timestamp: number;
} | null {
  const parts = testId.split('_');
  if (parts.length !== 4 || parts[0] !== 'TEST') {
    return null;
  }
  
  return {
    department: parts[1],
    year: parseInt(parts[2]),
    timestamp: parseInt(parts[3])
  };
}

/**
 * Parse Submission ID to extract components
 */
export function parseSubmissionId(submissionId: string): {
  studentId: string;
  testId: string;
  timestamp: number;
} | null {
  const parts = submissionId.split('_');
  if (parts.length < 7 || parts[0] !== 'SUB') {
    return null;
  }
  
  // Reconstruct testId from parts[2] to second-to-last part
  const testIdEndIndex = parts.length - 1;
  const testId = parts.slice(2, testIdEndIndex).join('_');
  
  return {
    studentId: parts[1],
    testId: testId,
    timestamp: parseInt(parts[parts.length - 1])
  };
}

/**
 * Validate ID formats
 */
export function isValidTestId(testId: string): boolean {
  // More flexible: allows alphanumeric department codes
  const regex = /^TEST_[A-Z0-9]+_\d+_\d+$/;
  return regex.test(testId);
}

export function isValidSubmissionId(submissionId: string): boolean {
  const parts = submissionId.split('_');
  return parts.length >= 7 && parts[0] === 'SUB' && parts[2] === 'TEST';
}

export function isValidUserId(userId: string): boolean {
  const regex = /^(ST|TCH|ADM)\d{7}$/;
  return regex.test(userId);
}

/**
 * Generate short random ID (for internal use)
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}
