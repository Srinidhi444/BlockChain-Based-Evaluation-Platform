import AuditLog, { AuditEventType, CommentSentiment, MarkingPattern } from '@/lib/db/models/AuditLog';
import EvaluationMetrics, { IQuestionMetric, IBiasIndicators } from '@/lib/db/models/EvaluationMetrics';
import { v4 as uuidv4 } from 'uuid';

/**
 * Audit Logger Utility
 * Centralized logging for all evaluation and grievance activities
 */

interface LogEventParams {
  eventType: AuditEventType;
  userId: string;
  userRole: 'teacher' | 'student' | 'admin';
  userName?: string;
  department?: string;
  sessionId?: string;
  submissionId?: string;
  testId?: string;
  studentId?: string;
  studentName?: string;
  evaluationId?: string;
  questionNumber?: number;
  marksAwarded?: number;
  maxMarks?: number;
  comment?: string;
  timeSpent?: number;
  cumulativeTime?: number;
  questionSequence?: number;
  grievanceId?: string;
  grievanceType?: 'calculation_error' | 'reevaluation';
  originalMarks?: number;
  newMarks?: number;
  originalTeacherId?: string;
  newTeacherId?: string;
  assignedTeacherId?: string;
  subject?: string;
  year?: number;
  division?: string;
  academicYear?: string;
  deviceInfo?: string;
  ipAddress?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

interface QuestionMarkingData {
  questionNumber: number;
  maxMarks: number;
  marksAwarded: number;
  comment?: string;
  timeSpent: number;
  markedAt: Date;
  sequenceOrder: number;
}

interface EvaluationSessionData {
  evaluationId: string;
  submissionId: string;
  testId: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName?: string; // ✅ Made optional
  department: string;
  subject: string;
  year: number;
  division: string;
  academicYear: string;
  sessionId: string;
  sessionStartTime: Date;
  sessionEndTime: Date;
  questionMarks: QuestionMarkingData[];
  totalMarksAwarded: number;
  totalMaxMarks: number;
  isReevaluation?: boolean;
  originalEvaluationId?: string;
  grievanceId?: string;
}

/**
 * Generate unique audit ID
 */
function generateAuditId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AUDIT_${timestamp}_${random}`;
}

/**
 * Generate session ID for tracking evaluation sessions
 */
export function generateSessionId(): string {
  return `SESSION_${Date.now()}_${uuidv4()}`;
}

/**
 * Log a single audit event
 */
export async function logAuditEvent(params: LogEventParams): Promise<void> {
  try {
    const auditId = generateAuditId();
    const timestamp = new Date();

    const auditLog = await AuditLog.create({
      auditId,
      eventType: params.eventType,
      timestamp,
      userId: params.userId,
      userRole: params.userRole,
      userName: params.userName,
      department: params.department,
      sessionId: params.sessionId,
      submissionId: params.submissionId,
      testId: params.testId,
      studentId: params.studentId,
      studentName: params.studentName,
      evaluationId: params.evaluationId,
      questionNumber: params.questionNumber,
      marksAwarded: params.marksAwarded,
      maxMarks: params.maxMarks,
      comment: params.comment,
      timeSpent: params.timeSpent,
      cumulativeTime: params.cumulativeTime,
      questionSequence: params.questionSequence,
      grievanceId: params.grievanceId,
      grievanceType: params.grievanceType,
      originalMarks: params.originalMarks,
      newMarks: params.newMarks,
      originalTeacherId: params.originalTeacherId,
      newTeacherId: params.newTeacherId,
      assignedTeacherId: params.assignedTeacherId,
      subject: params.subject,
      year: params.year,
      division: params.division,
      academicYear: params.academicYear,
      deviceInfo: params.deviceInfo,
      ipAddress: params.ipAddress,
      notes: params.notes,
      metadata: params.metadata,
    });

    console.log(`✅ Audit log created: ${auditId} - ${params.eventType}`);
    
  } catch (error: any) {
    console.error('❌ Failed to create audit log:', error.message);
    // Don't throw error - audit logging should not break main flow
  }
}

/**
 * Log evaluation start
 */
export async function logEvaluationStart(params: {
  teacherId: string;
  teacherName: string;
  submissionId: string;
  testId: string;
  studentId: string;
  studentName?: string; // ✅ Made optional
  department: string;
  subject: string;
  sessionId: string;
  deviceInfo?: string;
  ipAddress?: string;
}): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.EVALUATION_STARTED,
    userId: params.teacherId,
    userRole: 'teacher',
    userName: params.teacherName,
    department: params.department,
    sessionId: params.sessionId,
    submissionId: params.submissionId,
    testId: params.testId,
    studentId: params.studentId,
    studentName: params.studentName || 'Anonymous', // ✅ Fallback
    subject: params.subject,
    deviceInfo: params.deviceInfo,
    ipAddress: params.ipAddress,
  });
}

/**
 * Log question marking
 */
export async function logQuestionMarked(params: {
  teacherId: string;
  teacherName: string;
  submissionId: string;
  testId: string;
  studentId: string;
  evaluationId: string;
  department: string;
  subject: string;
  sessionId: string;
  questionNumber: number;
  marksAwarded: number;
  maxMarks: number;
  comment?: string;
  timeSpent: number;
  cumulativeTime: number;
  questionSequence: number;
}): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.QUESTION_MARKED,
    userId: params.teacherId,
    userRole: 'teacher',
    userName: params.teacherName,
    department: params.department,
    sessionId: params.sessionId,
    submissionId: params.submissionId,
    testId: params.testId,
    studentId: params.studentId,
    evaluationId: params.evaluationId,
    questionNumber: params.questionNumber,
    marksAwarded: params.marksAwarded,
    maxMarks: params.maxMarks,
    comment: params.comment,
    timeSpent: params.timeSpent,
    cumulativeTime: params.cumulativeTime,
    questionSequence: params.questionSequence,
    subject: params.subject,
  });
}

/**
 * Log evaluation completion and generate metrics
 */
export async function logEvaluationComplete(sessionData: EvaluationSessionData): Promise<void> {
  try {
    // ✅ Provide fallback for studentName
    const studentName = sessionData.studentName || 'Anonymous Student';
    
    // Log completion event
    await logAuditEvent({
      eventType: AuditEventType.EVALUATION_COMPLETED,
      userId: sessionData.teacherId,
      userRole: 'teacher',
      userName: sessionData.teacherName,
      department: sessionData.department,
      sessionId: sessionData.sessionId,
      submissionId: sessionData.submissionId,
      testId: sessionData.testId,
      studentId: sessionData.studentId,
      studentName, // ✅ Use fallback
      evaluationId: sessionData.evaluationId,
      subject: sessionData.subject,
      year: sessionData.year,
      division: sessionData.division,
      academicYear: sessionData.academicYear,
      notes: `Evaluation completed with ${sessionData.questionMarks.length} questions`,
      metadata: {
        totalMarksAwarded: sessionData.totalMarksAwarded,
        totalMaxMarks: sessionData.totalMaxMarks,
        percentage: ((sessionData.totalMarksAwarded / sessionData.totalMaxMarks) * 100).toFixed(2),
      },
    });

    // Generate comprehensive metrics with fallback
    await generateEvaluationMetrics({ ...sessionData, studentName });
    
  } catch (error: any) {
    console.error('❌ Failed to log evaluation completion:', error.message);
  }
}

/**
 * Calculate time distribution across quarters
 */
function calculateTimeDistribution(questionMetrics: IQuestionMetric[]) {
  const totalQuestions = questionMetrics.length;
  const quarterSize = Math.ceil(totalQuestions / 4);
  
  const quarters = [0, 0, 0, 0];
  
  questionMetrics.forEach((q, index) => {
    const quarterIndex = Math.min(Math.floor(index / quarterSize), 3);
    quarters[quarterIndex] += q.timeSpent;
  });
  
  return {
    firstQuarter: quarters[0],
    secondQuarter: quarters[1],
    thirdQuarter: quarters[2],
    fourthQuarter: quarters[3],
    averagePerQuarter: quarters.map(q => Math.floor(q / quarterSize)),
  };
}

/**
 * Calculate marking distribution
 */
function calculateMarkingDistribution(questionMetrics: IQuestionMetric[]) {
  let zeroMarks = 0;
  let fullMarks = 0;
  let partialMarks = 0;
  let belowAverage = 0;
  let average = 0;
  let aboveAverage = 0;
  
  questionMetrics.forEach(q => {
    if (q.percentage === 0) {
      zeroMarks++;
    } else if (q.percentage === 100) {
      fullMarks++;
    } else {
      partialMarks++;
    }
    
    if (q.percentage < 50) belowAverage++;
    else if (q.percentage <= 75) average++;
    else aboveAverage++;
  });
  
  return {
    zeroMarks,
    fullMarks,
    partialMarks,
    belowAverage,
    average,
    aboveAverage,
  };
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Detect fatigue patterns
 */
function detectFatigue(questionMetrics: IQuestionMetric[]): {
  detected: boolean;
  startPoint?: number;
  score: number;
} {
  if (questionMetrics.length < 4) {
    return { detected: false, score: 0 };
  }
  
  const halfPoint = Math.floor(questionMetrics.length / 2);
  const firstHalf = questionMetrics.slice(0, halfPoint);
  const secondHalf = questionMetrics.slice(halfPoint);
  
  const firstHalfAvgTime = firstHalf.reduce((sum, q) => sum + q.timeSpent, 0) / firstHalf.length;
  const secondHalfAvgTime = secondHalf.reduce((sum, q) => sum + q.timeSpent, 0) / secondHalf.length;
  
  const timeDecreasePercentage = ((firstHalfAvgTime - secondHalfAvgTime) / firstHalfAvgTime) * 100;
  
  // Fatigue detected if time decreases by more than 30%
  const fatigueDetected = timeDecreasePercentage > 30;
  const fatigueScore = Math.max(0, Math.min(timeDecreasePercentage, 100));
  
  return {
    detected: fatigueDetected,
    startPoint: fatigueDetected ? halfPoint + 1 : undefined,
    score: fatigueScore,
  };
}

/**
 * Detect sequence bias (marks trend)
 */
function detectSequenceBias(questionMetrics: IQuestionMetric[]): {
  hasBias: boolean;
  trend: 'increasing' | 'decreasing' | 'neutral';
} {
  if (questionMetrics.length < 3) {
    return { hasBias: false, trend: 'neutral' };
  }
  
  const percentages = questionMetrics.map(q => q.percentage);
  let increasing = 0;
  let decreasing = 0;
  
  for (let i = 1; i < percentages.length; i++) {
    if (percentages[i] > percentages[i - 1]) increasing++;
    if (percentages[i] < percentages[i - 1]) decreasing++;
  }
  
  const totalComparisons = percentages.length - 1;
  const increasingRate = (increasing / totalComparisons) * 100;
  const decreasingRate = (decreasing / totalComparisons) * 100;
  
  if (increasingRate > 70) {
    return { hasBias: true, trend: 'increasing' };
  } else if (decreasingRate > 70) {
    return { hasBias: true, trend: 'decreasing' };
  }
  
  return { hasBias: false, trend: 'neutral' };
}

/**
 * Detect statistical outliers using IQR method
 */
function detectOutliers(questionMetrics: IQuestionMetric[]): {
  count: number;
  questions: number[];
} {
  if (questionMetrics.length < 5) {
    return { count: 0, questions: [] };
  }
  
  const percentages = questionMetrics.map(q => q.percentage).sort((a, b) => a - b);
  const q1Index = Math.floor(percentages.length * 0.25);
  const q3Index = Math.floor(percentages.length * 0.75);
  
  const q1 = percentages[q1Index];
  const q3 = percentages[q3Index];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - (1.5 * iqr);
  const upperBound = q3 + (1.5 * iqr);
  
  const outliers: number[] = [];
  
  questionMetrics.forEach(q => {
    if (q.percentage < lowerBound || q.percentage > upperBound) {
      outliers.push(q.questionNumber);
    }
  });
  
  return {
    count: outliers.length,
    questions: outliers,
  };
}

/**
 * Calculate bias indicators
 */
function calculateBiasIndicators(questionMetrics: IQuestionMetric[]): IBiasIndicators {
  const percentages = questionMetrics.map(q => q.percentage);
  const times = questionMetrics.map(q => q.timeSpent);
  
  // Consistency scores (inverse of coefficient of variation)
  const percentageStdDev = calculateStdDev(percentages);
  const percentageMean = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
  const markingConsistency = percentageMean > 0 
    ? Math.max(0, 100 - ((percentageStdDev / percentageMean) * 100)) 
    : 0;
  
  const timeStdDev = calculateStdDev(times);
  const timeMean = times.reduce((sum, t) => sum + t, 0) / times.length;
  const timeConsistency = timeMean > 0 
    ? Math.max(0, 100 - ((timeStdDev / timeMean) * 100)) 
    : 0;
  
  // Fatigue detection
  const fatigue = detectFatigue(questionMetrics);
  
  // Sequence bias detection
  const sequenceBias = detectSequenceBias(questionMetrics);
  
  // Speed analysis
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const avgTime = timeMean;
  const rushingDetected = minTime < 10 && times.filter(t => t < 10).length > questionMetrics.length * 0.3;
  
  // Comment quality
  const commentsWithText = questionMetrics.filter(q => q.comment && q.comment.length > 0);
  const commentRate = (commentsWithText.length / questionMetrics.length) * 100;
  const avgCommentLength = commentsWithText.length > 0
    ? commentsWithText.reduce((sum, q) => sum + (q.commentLength || 0), 0) / commentsWithText.length
    : 0;
  const commentQuality = Math.min(100, (avgCommentLength / 50) * 50 + commentRate * 0.5);
  
  // Outliers
  const outliers = detectOutliers(questionMetrics);
  
  return {
    markingConsistency,
    timeConsistency,
    hasSequenceBias: sequenceBias.hasBias,
    sequenceBiasTrend: sequenceBias.trend,
    fatigueDetected: fatigue.detected,
    fatigueStartPoint: fatigue.startPoint,
    fatigueScore: fatigue.score,
    rushingDetected,
    averageTimePerQuestion: avgTime,
    minTimeSpent: minTime,
    maxTimeSpent: maxTime,
    commentQuality,
    commentRate,
    outlierCount: outliers.count,
    outlierQuestions: outliers.questions,
  };
}

/**
 * Generate comprehensive evaluation metrics
 */
async function generateEvaluationMetrics(sessionData: EvaluationSessionData): Promise<void> {
  try {
    const metricsId = `METRICS_${sessionData.evaluationId}`;
    
    // ✅ Ensure studentName has fallback
    const studentName = sessionData.studentName || 'Anonymous Student';
    
    // Convert question marks to question metrics format
    const questionMetrics: IQuestionMetric[] = sessionData.questionMarks.map(q => {
      const percentage = q.maxMarks > 0 ? (q.marksAwarded / q.maxMarks) * 100 : 0;
      let markingPattern: 'strict' | 'lenient' | 'moderate' | 'zero' | 'full' = 'moderate';
      
      if (percentage === 0) markingPattern = 'zero';
      else if (percentage === 100) markingPattern = 'full';
      else if (percentage < 60) markingPattern = 'strict';
      else if (percentage > 85) markingPattern = 'lenient';
      
      return {
        questionNumber: q.questionNumber,
        maxMarks: q.maxMarks,
        marksAwarded: q.marksAwarded,
        percentage,
        timeSpent: q.timeSpent,
        comment: q.comment,
        commentLength: q.comment ? q.comment.length : 0,
        markingPattern,
        markedAt: q.markedAt,
        sequenceOrder: q.sequenceOrder,
      };
    });
    
    // Calculate metrics
    const totalSessionDuration = Math.floor(
      (sessionData.sessionEndTime.getTime() - sessionData.sessionStartTime.getTime()) / 1000
    );
    
    const totalEvaluationTime = questionMetrics.reduce((sum, q) => sum + q.timeSpent, 0);
    const times = questionMetrics.map(q => q.timeSpent).sort((a, b) => a - b);
    const medianTime = times.length > 0 ? times[Math.floor(times.length / 2)] : 0;
    const avgTime = questionMetrics.length > 0 ? totalEvaluationTime / questionMetrics.length : 0;
    
    const timeDistribution = calculateTimeDistribution(questionMetrics);
    const markingDistribution = calculateMarkingDistribution(questionMetrics);
    const biasIndicators = calculateBiasIndicators(questionMetrics);
    
    // Calculate scores
    const overallPercentage = sessionData.totalMaxMarks > 0 
      ? (sessionData.totalMarksAwarded / sessionData.totalMaxMarks) * 100 
      : 0;
    const strictnessScore = 100 - overallPercentage; // Inverse of leniency
    const leniencyScore = overallPercentage;
    
    // Comment analysis
    const commentsWithText = questionMetrics.filter(q => q.comment && q.comment.length > 0);
    const totalComments = commentsWithText.length;
    const avgCommentLength = totalComments > 0
      ? commentsWithText.reduce((sum, q) => sum + q.commentLength, 0) / totalComments
      : 0;
    const commentCoverage = questionMetrics.length > 0 
      ? (totalComments / questionMetrics.length) * 100 
      : 0;
    
    // Quality scores
    const thoroughnessScore = Math.min(100, (avgTime / 60) * 30 + commentCoverage * 0.7);
    const evaluationQualityScore = (
      biasIndicators.markingConsistency * 0.4 +
      biasIndicators.commentQuality * 0.3 +
      thoroughnessScore * 0.3
    );
    
    // Flagging logic
    const flagReasons: string[] = [];
    if (biasIndicators.fatigueDetected) flagReasons.push('Fatigue detected');
    if (biasIndicators.rushingDetected) flagReasons.push('Rushing detected');
    if (biasIndicators.hasSequenceBias) flagReasons.push(`Sequence bias: ${biasIndicators.sequenceBiasTrend}`);
    if (biasIndicators.outlierCount > 2) flagReasons.push(`${biasIndicators.outlierCount} outlier marks`);
    if (avgTime < 15) flagReasons.push('Very fast marking');
    if (commentCoverage < 20) flagReasons.push('Low comment coverage');
    
    const flaggedForReview = flagReasons.length > 0;
    
    // Create metrics document
    await EvaluationMetrics.create({
      metricsId,
      evaluationId: sessionData.evaluationId,
      submissionId: sessionData.submissionId,
      testId: sessionData.testId,
      teacherId: sessionData.teacherId,
      teacherName: sessionData.teacherName,
      studentId: sessionData.studentId,
      studentName, // ✅ Use fallback
      department: sessionData.department,
      subject: sessionData.subject,
      year: sessionData.year,
      division: sessionData.division,
      academicYear: sessionData.academicYear,
      sessionId: sessionData.sessionId,
      sessionStartTime: sessionData.sessionStartTime,
      sessionEndTime: sessionData.sessionEndTime,
      totalSessionDuration,
      totalQuestions: questionMetrics.length,
      totalMarksAwarded: sessionData.totalMarksAwarded,
      totalMaxMarks: sessionData.totalMaxMarks,
      overallPercentage,
      questionMetrics,
      timeDistribution,
      averageTimePerQuestion: avgTime,
      medianTimePerQuestion: medianTime,
      totalEvaluationTime,
      markingDistribution,
      strictnessScore,
      leniencyScore,
      totalComments,
      averageCommentLength: avgCommentLength,
      commentCoverage,
      positiveComments: 0, // Will be calculated by sentiment analysis
      negativeComments: 0,
      neutralComments: 0,
      noComments: questionMetrics.length - totalComments,
      biasIndicators,
      evaluationQualityScore,
      thoroughnessScore,
      flaggedForReview,
      flagReasons,
      isReevaluation: sessionData.isReevaluation || false,
      originalEvaluationId: sessionData.originalEvaluationId,
      grievanceId: sessionData.grievanceId,
    });
    
    console.log(`✅ Evaluation metrics generated: ${metricsId}`);
    console.log(`   Quality Score: ${evaluationQualityScore.toFixed(2)}`);
    console.log(`   Thoroughness: ${thoroughnessScore.toFixed(2)}`);
    if (flaggedForReview) {
      console.log(`⚠️  Evaluation flagged for review: ${flagReasons.join(', ')}`);
    }
    
  } catch (error: any) {
    console.error('❌ Failed to generate evaluation metrics:', error.message);
    console.error('   Error details:', error);
  }
}

/**
 * Log grievance filed
 */
export async function logGrievanceFiled(params: {
  studentId: string;
  studentName: string;
  submissionId: string;
  testId: string;
  grievanceId: string;
  grievanceType: 'calculation_error' | 'reevaluation';
  department: string;
  subject: string;
}): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.GRIEVANCE_FILED,
    userId: params.studentId,
    userRole: 'student',
    userName: params.studentName,
    department: params.department,
    sessionId: generateSessionId(),
    submissionId: params.submissionId,
    testId: params.testId,
    grievanceId: params.grievanceId,
    grievanceType: params.grievanceType,
    subject: params.subject,
  });
}

/**
 * Log re-evaluation completion
 */
export async function logReEvaluationComplete(params: {
  sessionData: EvaluationSessionData;
  originalMarks: number;
  newMarks: number;
  originalTeacherId: string;
}): Promise<void> {
  // ✅ Provide fallback for studentName
  const studentName = params.sessionData.studentName || 'Anonymous Student';
  
  // Log completion event with comparison
  await logAuditEvent({
    eventType: AuditEventType.REEVALUATION_COMPLETED,
    userId: params.sessionData.teacherId,
    userRole: 'teacher',
    userName: params.sessionData.teacherName,
    department: params.sessionData.department,
    sessionId: params.sessionData.sessionId,
    submissionId: params.sessionData.submissionId,
    testId: params.sessionData.testId,
    studentId: params.sessionData.studentId,
    studentName, // ✅ Use fallback
    evaluationId: params.sessionData.evaluationId,
    grievanceId: params.sessionData.grievanceId,
    originalMarks: params.originalMarks,
    newMarks: params.newMarks,
    originalTeacherId: params.originalTeacherId,
    newTeacherId: params.sessionData.teacherId,
    subject: params.sessionData.subject,
    metadata: {
      marksDifference: params.newMarks - params.originalMarks,
      percentageDifference: ((params.newMarks - params.originalMarks) / params.sessionData.totalMaxMarks * 100).toFixed(2),
    },
  });
  
  // Generate metrics for re-evaluation with fallback
  await generateEvaluationMetrics({ ...params.sessionData, studentName });
}

export default {
  generateSessionId,
  logAuditEvent,
  logEvaluationStart,
  logQuestionMarked,
  logEvaluationComplete,
  logGrievanceFiled,
  logReEvaluationComplete,
};
