import CryptoJS from 'crypto-js';

/**
 * Hash Utilities for File Integrity and Blockchain Storage
 */

/**
 * Generate SHA-256 hash from file buffer
 * Used for answer sheet integrity verification
 */
export function generateFileHash(fileBuffer: ArrayBuffer): string {
  const wordArray = CryptoJS.lib.WordArray.create(fileBuffer as any);
  const hash = CryptoJS.SHA256(wordArray);
  return hash.toString(CryptoJS.enc.Hex);
}

/**
 * Generate SHA-256 hash from base64 string
 * Alternative method for file hashing
 */
export function generateFileHashFromBase64(base64String: string): string {
  const hash = CryptoJS.SHA256(base64String);
  return hash.toString(CryptoJS.enc.Hex);
}

/**
 * Generate hash from evaluation data
 * Used to store immutable evaluation results on blockchain
 */
import crypto from "crypto";

export function generateEvaluationHash(evaluationData: {
  submissionId: string;
  teacherId: string;
  questionMarks: Array<{ questionNumber: number; marksObtained: number }>;
  totalMarksObtained: number;
  evaluatedAt: Date;
}): string {

  // Sort questionMarks to ensure deterministic order
  const sortedQuestionMarks = [...evaluationData.questionMarks].sort(
    (a, b) => a.questionNumber - b.questionNumber
  );

  const canonicalData = {
    submissionId: evaluationData.submissionId,
    teacherId: evaluationData.teacherId,
    questionMarks: sortedQuestionMarks,
    totalMarksObtained: evaluationData.totalMarksObtained,
    evaluatedAt: evaluationData.evaluatedAt
  ? evaluationData.evaluatedAt.toISOString()
  : null

  };

  const dataString = JSON.stringify(canonicalData);

  return crypto
    .createHash("sha256")
    .update(dataString)
    .digest("hex");
}


/**
 * Generate hash for test (question paper)
 * Optional: Can be used to verify question paper integrity
 */
export function generateTestHash(testData: {
  testId: string;
  title: string;
  subject: string;
  questions: Array<{ questionNumber: number; marks: number }>;
  totalMarks: number;
}): string {
  const dataString = JSON.stringify({
    testId: testData.testId,
    title: testData.title,
    subject: testData.subject,
    questions: testData.questions,
    totalMarks: testData.totalMarks
  });
  
  const hash = CryptoJS.SHA256(dataString);
  return hash.toString(CryptoJS.enc.Hex);
}

/**
 * Verify file hash matches stored hash
 * Returns true if file hasn't been tampered with
 */
export function verifyFileHash(
  fileBuffer: ArrayBuffer,
  storedHash: string
): boolean {
  const currentHash = generateFileHash(fileBuffer);
  return currentHash === storedHash;
}

/**
 * Verify evaluation hash
 * Ensures evaluation data hasn't been modified
 */
export function verifyEvaluationHash(
  evaluationData: {
    submissionId: string;
    teacherId: string;
    questionMarks: Array<{ questionNumber: number; marksObtained: number }>;
    totalMarksObtained: number;
    evaluatedAt: Date;
  },
  storedHash: string
): boolean {
  const currentHash = generateEvaluationHash(evaluationData);
  return currentHash === storedHash;
}

/**
 * Generate a unique hash for any object
 * General purpose hashing utility
 */
export function generateObjectHash(obj: any): string {
  const dataString = JSON.stringify(obj);
  const hash = CryptoJS.SHA256(dataString);
  return hash.toString(CryptoJS.enc.Hex);
}

/**
 * Convert File object to ArrayBuffer
 * Helper for browser file uploads
 */
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert File to base64 string
 * Alternative helper for file handling
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Generate hash from File directly
 * Convenience method combining file reading and hashing
 */
export async function generateHashFromFile(file: File): Promise<string> {
  const arrayBuffer = await fileToArrayBuffer(file);
  return generateFileHash(arrayBuffer);
}
