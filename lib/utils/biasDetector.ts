import EvaluationMetrics from '@/lib/db/models/EvaluationMetrics';
import AuditLog, { AuditEventType } from '@/lib/db/models/AuditLog';
import connectDB from '@/lib/db/mongodb';

/**
 * Bias Detector Utility
 * Advanced analytics for detecting bias patterns in evaluations
 */

export interface TeacherBiasReport {
  teacherId: string;
  teacherName: string;
  department: string;
  totalEvaluations: number;
  dateRange: { from: Date; to: Date };
  
  // Marking Patterns
  averageMarksAwarded: number;
  averagePercentage: number;
  strictnessScore: number;
  leniencyScore: number;
  consistencyScore: number;
  
  // Time Patterns
  averageTimePerQuestion: number;
  averageSessionDuration: number;
  fatigueRate: number;
  rushingRate: number;
  
  // Quality Metrics
  averageCommentCoverage: number;
  averageCommentLength: number;
  averageQualityScore: number;
  
  // Bias Indicators
  sequenceBiasRate: number;
  outlierRate: number;
  flaggedEvaluationsCount: number;
  flaggedEvaluationsRate: number;
  
  // Comparative Metrics
  deviationFromDepartmentAverage: number;
  deviationFromSubjectAverage: number;
  
  // Grievance Analysis
  totalGrievances: number;
  grievanceSuccessRate: number;
  averageMarksDifferenceInGrievances: number;
  
  // Risk Classification
  biasRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  biasScore: number; // 0-100 (higher = more bias detected)
  flagReasons: string[];
}

export interface DepartmentBiasReport {
  department: string;
  totalTeachers: number;
  totalEvaluations: number;
  dateRange: { from: Date; to: Date };
  
  // Aggregate Metrics
  averageMarksAwarded: number;
  averageStrictness: number;
  averageLeniency: number;
  
  // Teacher Comparisons
  teacherBiasScores: Array<{
    teacherId: string;
    teacherName: string;
    biasScore: number;
    riskLevel: string;
  }>;
  
  // Department-wide Patterns
  fatigueRate: number;
  grievanceRate: number;
  flaggedRate: number;
  
  // Fairness Metrics
  fairnessIndex: number; // 0-100 (higher = more fair)
  consistencyIndex: number; // 0-100 (higher = more consistent)
}

export interface GrievanceAnalysisReport {
  totalGrievances: number;
  calculationErrors: number;
  reevaluations: number;
  
  // Outcomes
  marksIncreased: number;
  marksDecreased: number;
  marksUnchanged: number;
  
  // Success Rates
  calculationErrorSuccessRate: number;
  reevaluationSuccessRate: number;
  
  // Teacher Analysis
  teachersWithHighGrievanceRate: Array<{
    teacherId: string;
    teacherName: string;
    grievanceCount: number;
    successRate: number;
  }>;
  
  // Average Changes
  averageMarksDifference: number;
  averagePercentageDifference: number;
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
 * Calculate bias score from multiple factors
 */
function calculateBiasScore(metrics: {
  consistencyScore: number;
  fatigueRate: number;
  rushingRate: number;
  sequenceBiasRate: number;
  outlierRate: number;
  flaggedRate: number;
  grievanceSuccessRate: number;
  deviationFromAverage: number;
}): { score: number; level: 'low' | 'medium' | 'high' | 'critical' } {
  let score = 0;
  
  // Low consistency indicates potential bias (inverse)
  score += (100 - metrics.consistencyScore) * 0.2;
  
  // High fatigue rate indicates quality issues
  score += metrics.fatigueRate * 0.15;
  
  // Rushing indicates lack of thoroughness
  score += metrics.rushingRate * 0.15;
  
  // Sequence bias indicates systematic patterns
  score += metrics.sequenceBiasRate * 0.1;
  
  // Outliers indicate inconsistency
  score += metrics.outlierRate * 0.1;
  
  // Flagged evaluations indicate issues
  score += metrics.flaggedRate * 0.15;
  
  // High grievance success rate indicates initial marking errors
  score += metrics.grievanceSuccessRate * 0.1;
  
  // Large deviation from peers indicates outlier behavior
  score += Math.abs(metrics.deviationFromAverage) * 0.05;
  
  // Classify risk level
  let level: 'low' | 'medium' | 'high' | 'critical';
  if (score < 25) level = 'low';
  else if (score < 50) level = 'medium';
  else if (score < 75) level = 'high';
  else level = 'critical';
  
  return { score: Math.min(score, 100), level };
}

/**
 * Generate comprehensive teacher bias report
 */
export async function generateTeacherBiasReport(
  teacherId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<TeacherBiasReport | null> {
  try {
    await connectDB();
    
    const query: any = { teacherId };
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = dateFrom;
      if (dateTo) query.createdAt.$lte = dateTo;
    }
    
    const metrics = await EvaluationMetrics.find(query);
    
    if (metrics.length === 0) {
      console.log(`No evaluation metrics found for teacher: ${teacherId}`);
      return null;
    }
    
    const teacherName = metrics[0].teacherName;
    const department = metrics[0].department;
    
    // Calculate aggregate metrics
    const totalEvaluations = metrics.length;
    const averageMarksAwarded = metrics.reduce((sum, m) => sum + m.totalMarksAwarded, 0) / totalEvaluations;
    const averagePercentage = metrics.reduce((sum, m) => sum + m.overallPercentage, 0) / totalEvaluations;
    const strictnessScore = metrics.reduce((sum, m) => sum + m.strictnessScore, 0) / totalEvaluations;
    const leniencyScore = metrics.reduce((sum, m) => sum + m.leniencyScore, 0) / totalEvaluations;
    const consistencyScore = metrics.reduce((sum, m) => sum + m.biasIndicators.markingConsistency, 0) / totalEvaluations;
    
    // Time patterns
    const averageTimePerQuestion = metrics.reduce((sum, m) => sum + m.averageTimePerQuestion, 0) / totalEvaluations;
    const averageSessionDuration = metrics.reduce((sum, m) => sum + m.totalSessionDuration, 0) / totalEvaluations;
    const fatigueCount = metrics.filter(m => m.biasIndicators.fatigueDetected).length;
    const fatigueRate = (fatigueCount / totalEvaluations) * 100;
    const rushingCount = metrics.filter(m => m.biasIndicators.rushingDetected).length;
    const rushingRate = (rushingCount / totalEvaluations) * 100;
    
    // Quality metrics
    const averageCommentCoverage = metrics.reduce((sum, m) => sum + m.commentCoverage, 0) / totalEvaluations;
    const averageCommentLength = metrics.reduce((sum, m) => sum + m.averageCommentLength, 0) / totalEvaluations;
    const averageQualityScore = metrics.reduce((sum, m) => sum + m.evaluationQualityScore, 0) / totalEvaluations;
    
    // Bias indicators
    const sequenceBiasCount = metrics.filter(m => m.biasIndicators.hasSequenceBias).length;
    const sequenceBiasRate = (sequenceBiasCount / totalEvaluations) * 100;
    const totalOutliers = metrics.reduce((sum, m) => sum + m.biasIndicators.outlierCount, 0);
    const outlierRate = (totalOutliers / (totalEvaluations * metrics[0].totalQuestions)) * 100;
    const flaggedEvaluationsCount = metrics.filter(m => m.flaggedForReview).length;
    const flaggedEvaluationsRate = (flaggedEvaluationsCount / totalEvaluations) * 100;
    
    // Comparative metrics
    const departmentMetrics = await EvaluationMetrics.find({ department });
    const departmentAvgPercentage = departmentMetrics.reduce((sum, m) => sum + m.overallPercentage, 0) / departmentMetrics.length;
    const deviationFromDepartmentAverage = averagePercentage - departmentAvgPercentage;
    
    const subject = metrics[0].subject;
    const subjectMetrics = await EvaluationMetrics.find({ subject });
    const subjectAvgPercentage = subjectMetrics.reduce((sum, m) => sum + m.overallPercentage, 0) / subjectMetrics.length;
    const deviationFromSubjectAverage = averagePercentage - subjectAvgPercentage;
    
    // Grievance analysis
    const grievanceLogs = await AuditLog.find({
      eventType: AuditEventType.REEVALUATION_COMPLETED,
      $or: [
        { originalTeacherId: teacherId },
        { newTeacherId: teacherId }
      ]
    });
    
    const totalGrievances = grievanceLogs.length;
    const successfulGrievances = grievanceLogs.filter(g => (g.marksDifference || 0) > 0).length;
    const grievanceSuccessRate = totalGrievances > 0 ? (successfulGrievances / totalGrievances) * 100 : 0;
    const averageMarksDifferenceInGrievances = totalGrievances > 0
      ? grievanceLogs.reduce((sum, g) => sum + Math.abs(g.marksDifference || 0), 0) / totalGrievances
      : 0;
    
    // Calculate bias score and risk level
    const { score: biasScore, level: biasRiskLevel } = calculateBiasScore({
      consistencyScore,
      fatigueRate,
      rushingRate,
      sequenceBiasRate,
      outlierRate,
      flaggedRate: flaggedEvaluationsRate,
      grievanceSuccessRate,
      deviationFromAverage: Math.abs(deviationFromDepartmentAverage),
    });
    
    // Generate flag reasons
    const flagReasons: string[] = [];
    if (biasScore > 50) flagReasons.push('High bias score detected');
    if (fatigueRate > 30) flagReasons.push(`High fatigue rate: ${fatigueRate.toFixed(1)}%`);
    if (rushingRate > 20) flagReasons.push(`Rushing detected in ${rushingRate.toFixed(1)}% of evaluations`);
    if (sequenceBiasRate > 15) flagReasons.push(`Sequence bias in ${sequenceBiasRate.toFixed(1)}% of evaluations`);
    if (flaggedEvaluationsRate > 25) flagReasons.push(`${flaggedEvaluationsRate.toFixed(1)}% evaluations flagged`);
    if (grievanceSuccessRate > 40) flagReasons.push(`High grievance success rate: ${grievanceSuccessRate.toFixed(1)}%`);
    if (Math.abs(deviationFromDepartmentAverage) > 15) {
      flagReasons.push(`Marks ${deviationFromDepartmentAverage > 0 ? 'higher' : 'lower'} than department average`);
    }
    if (averageCommentCoverage < 30) flagReasons.push('Low comment coverage');
    
    return {
      teacherId,
      teacherName,
      department,
      totalEvaluations,
      dateRange: {
        from: dateFrom || metrics[metrics.length - 1].createdAt,
        to: dateTo || metrics[0].createdAt,
      },
      averageMarksAwarded,
      averagePercentage,
      strictnessScore,
      leniencyScore,
      consistencyScore,
      averageTimePerQuestion,
      averageSessionDuration,
      fatigueRate,
      rushingRate,
      averageCommentCoverage,
      averageCommentLength,
      averageQualityScore,
      sequenceBiasRate,
      outlierRate,
      flaggedEvaluationsCount,
      flaggedEvaluationsRate,
      deviationFromDepartmentAverage,
      deviationFromSubjectAverage,
      totalGrievances,
      grievanceSuccessRate,
      averageMarksDifferenceInGrievances,
      biasRiskLevel,
      biasScore,
      flagReasons,
    };
    
  } catch (error: any) {
    console.error('❌ Error generating teacher bias report:', error.message);
    return null;
  }
}

/**
 * Generate department-wide bias report
 */
export async function generateDepartmentBiasReport(
  department: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<DepartmentBiasReport | null> {
  try {
    await connectDB();
    
    const query: any = { department };
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = dateFrom;
      if (dateTo) query.createdAt.$lte = dateTo;
    }
    
    const metrics = await EvaluationMetrics.find(query);
    
    if (metrics.length === 0) {
      console.log(`No evaluation metrics found for department: ${department}`);
      return null;
    }
    
    // Get unique teachers
    const teacherIds = [...new Set(metrics.map(m => m.teacherId))];
    const totalTeachers = teacherIds.length;
    const totalEvaluations = metrics.length;
    
    // Aggregate department metrics
    const averageMarksAwarded = metrics.reduce((sum, m) => sum + m.totalMarksAwarded, 0) / totalEvaluations;
    const averageStrictness = metrics.reduce((sum, m) => sum + m.strictnessScore, 0) / totalEvaluations;
    const averageLeniency = metrics.reduce((sum, m) => sum + m.leniencyScore, 0) / totalEvaluations;
    
    // Department-wide patterns
    const fatigueCount = metrics.filter(m => m.biasIndicators.fatigueDetected).length;
    const fatigueRate = (fatigueCount / totalEvaluations) * 100;
    
    const grievanceMetrics = await EvaluationMetrics.find({ department, isReevaluation: true });
    const grievanceRate = (grievanceMetrics.length / totalEvaluations) * 100;
    
    const flaggedCount = metrics.filter(m => m.flaggedForReview).length;
    const flaggedRate = (flaggedCount / totalEvaluations) * 100;
    
    // Calculate teacher bias scores
    const teacherBiasScores = await Promise.all(
      teacherIds.map(async (teacherId) => {
        const report = await generateTeacherBiasReport(teacherId, dateFrom, dateTo);
        return report ? {
          teacherId: report.teacherId,
          teacherName: report.teacherName,
          biasScore: report.biasScore,
          riskLevel: report.biasRiskLevel,
        } : null;
      })
    );
    
    const validTeacherScores = teacherBiasScores.filter(t => t !== null) as any[];
    
    // Calculate fairness index (inverse of bias score variance)
    const biasScores = validTeacherScores.map(t => t.biasScore);
    const biasScoreStdDev = calculateStdDev(biasScores);
    const fairnessIndex = Math.max(0, 100 - biasScoreStdDev);
    
    // Calculate consistency index
    const consistencyScores = metrics.map(m => m.biasIndicators.markingConsistency);
    const avgConsistency = consistencyScores.reduce((sum, c) => sum + c, 0) / consistencyScores.length;
    const consistencyIndex = avgConsistency;
    
    return {
      department,
      totalTeachers,
      totalEvaluations,
      dateRange: {
        from: dateFrom || metrics[metrics.length - 1].createdAt,
        to: dateTo || metrics[0].createdAt,
      },
      averageMarksAwarded,
      averageStrictness,
      averageLeniency,
      teacherBiasScores: validTeacherScores.sort((a, b) => b.biasScore - a.biasScore),
      fatigueRate,
      grievanceRate,
      flaggedRate,
      fairnessIndex,
      consistencyIndex,
    };
    
  } catch (error: any) {
    console.error('❌ Error generating department bias report:', error.message);
    return null;
  }
}

/**
 * Generate grievance analysis report
 */
export async function generateGrievanceAnalysisReport(
  dateFrom?: Date,
  dateTo?: Date
): Promise<GrievanceAnalysisReport | null> {
  try {
    await connectDB();
    
    const query: any = { eventType: AuditEventType.REEVALUATION_COMPLETED };
    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) query.timestamp.$gte = dateFrom;
      if (dateTo) query.timestamp.$lte = dateTo;
    }
    
    const grievanceLogs = await AuditLog.find(query);
    
    if (grievanceLogs.length === 0) {
      console.log('No grievance data found');
      return null;
    }
    
    const totalGrievances = grievanceLogs.length;
    const calculationErrors = grievanceLogs.filter(g => g.grievanceType === 'calculation_error').length;
    const reevaluations = grievanceLogs.filter(g => g.grievanceType === 'reevaluation').length;
    
    // Outcomes
    const marksIncreased = grievanceLogs.filter(g => (g.marksDifference || 0) > 0).length;
    const marksDecreased = grievanceLogs.filter(g => (g.marksDifference || 0) < 0).length;
    const marksUnchanged = grievanceLogs.filter(g => (g.marksDifference || 0) === 0).length;
    
    // Success rates
    const calcErrorSuccessful = grievanceLogs.filter(
      g => g.grievanceType === 'calculation_error' && (g.marksDifference || 0) !== 0
    ).length;
    const calculationErrorSuccessRate = calculationErrors > 0 ? (calcErrorSuccessful / calculationErrors) * 100 : 0;
    
    const reevalSuccessful = grievanceLogs.filter(
      g => g.grievanceType === 'reevaluation' && (g.marksDifference || 0) > 0
    ).length;
    const reevaluationSuccessRate = reevaluations > 0 ? (reevalSuccessful / reevaluations) * 100 : 0;
    
    // Teacher analysis
    const teacherGrievanceCounts = new Map<string, { name: string; count: number; successful: number }>();
    
    grievanceLogs.forEach(log => {
      const teacherId = log.originalTeacherId;
      if (!teacherId) return;
      
      if (!teacherGrievanceCounts.has(teacherId)) {
        teacherGrievanceCounts.set(teacherId, {
          name: log.userName || teacherId,
          count: 0,
          successful: 0,
        });
      }
      
      const data = teacherGrievanceCounts.get(teacherId)!;
      data.count++;
      if ((log.marksDifference || 0) > 0) {
        data.successful++;
      }
    });
    
    const teachersWithHighGrievanceRate = Array.from(teacherGrievanceCounts.entries())
      .map(([teacherId, data]) => ({
        teacherId,
        teacherName: data.name,
        grievanceCount: data.count,
        successRate: (data.successful / data.count) * 100,
      }))
      .filter(t => t.grievanceCount >= 3)
      .sort((a, b) => b.grievanceCount - a.grievanceCount);
    
    // Average changes
    const totalMarksDifference = grievanceLogs.reduce((sum, g) => sum + Math.abs(g.marksDifference || 0), 0);
    const averageMarksDifference = totalMarksDifference / totalGrievances;
    
    const totalPercentageDifference = grievanceLogs.reduce((sum, g) => sum + Math.abs(g.percentageDifference || 0), 0);
    const averagePercentageDifference = totalPercentageDifference / totalGrievances;
    
    return {
      totalGrievances,
      calculationErrors,
      reevaluations,
      marksIncreased,
      marksDecreased,
      marksUnchanged,
      calculationErrorSuccessRate,
      reevaluationSuccessRate,
      teachersWithHighGrievanceRate,
      averageMarksDifference,
      averagePercentageDifference,
    };
    
  } catch (error: any) {
    console.error('❌ Error generating grievance analysis report:', error.message);
    return null;
  }
}

/**
 * Get all teachers flagged for high bias
 */
export async function getHighBiasTeachers(
  threshold: number = 50
): Promise<Array<{ teacherId: string; teacherName: string; biasScore: number }>> {
  try {
    await connectDB();
    
    const metrics = await EvaluationMetrics.find().select('teacherId teacherName');
    const teacherIds = [...new Set(metrics.map(m => m.teacherId))];
    
    const reports = await Promise.all(
      teacherIds.map(id => generateTeacherBiasReport(id))
    );
    
    return reports
      .filter(r => r !== null && r.biasScore >= threshold)
      .map(r => ({
        teacherId: r!.teacherId,
        teacherName: r!.teacherName,
        biasScore: r!.biasScore,
      }))
      .sort((a, b) => b.biasScore - a.biasScore);
    
  } catch (error: any) {
    console.error('❌ Error getting high bias teachers:', error.message);
    return [];
  }
}

export default {
  generateTeacherBiasReport,
  generateDepartmentBiasReport,
  generateGrievanceAnalysisReport,
  getHighBiasTeachers,
};
