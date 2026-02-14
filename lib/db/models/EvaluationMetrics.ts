import mongoose, { Schema, Model } from 'mongoose';

/**
 * EvaluationMetrics - Aggregated metrics per evaluation session
 * This complements AuditLog by storing session-level analytics
 */

export interface IQuestionMetric {
  questionNumber: number;
  maxMarks: number;
  marksAwarded: number;
  percentage: number;
  timeSpent: number;              // Seconds spent on this question
  comment?: string;
  commentLength: number;
  markingPattern: 'strict' | 'lenient' | 'moderate' | 'zero' | 'full';
  markedAt: Date;
  sequenceOrder: number;          // Order in which it was marked (1st, 2nd, 3rd...)
}

export interface ITimeDistribution {
  firstQuarter: number;           // Time spent on first 25% questions
  secondQuarter: number;
  thirdQuarter: number;
  fourthQuarter: number;
  averagePerQuarter: number[];
}

export interface IMarkingDistribution {
  zeroMarks: number;              // Count of questions with 0 marks
  fullMarks: number;              // Count of questions with full marks
  partialMarks: number;           // Count of questions with partial marks
  belowAverage: number;           // Below 50%
  average: number;                // 50-75%
  aboveAverage: number;           // Above 75%
}

export interface IBiasIndicators {
  // Consistency Metrics
  markingConsistency: number;     // 0-100 (standard deviation based)
  timeConsistency: number;        // 0-100 (how consistent time per question)
  
  // Pattern Detection
  hasSequenceBias: boolean;       // Marks drop/increase as evaluation progresses
  sequenceBiasTrend: 'increasing' | 'decreasing' | 'neutral';
  
  // Fatigue Indicators
  fatigueDetected: boolean;
  fatigueStartPoint?: number;     // Question number where fatigue starts
  fatigueScore: number;           // 0-100 (higher = more fatigued)
  
  // Speed Indicators
  rushingDetected: boolean;       // Too fast marking
  averageTimePerQuestion: number;
  minTimeSpent: number;
  maxTimeSpent: number;
  
  // Quality Indicators
  commentQuality: number;         // 0-100 (based on length and presence)
  commentRate: number;            // Percentage of questions with comments
  
  // Statistical Outliers
  outlierCount: number;           // Number of outlier marks
  outlierQuestions: number[];     // Question numbers that are outliers
}

export interface IEvaluationMetrics {
  _id: string;
  
  // Identification
  metricsId: string;              // Unique metrics ID
  evaluationId: string;           // Links to Evaluation
  submissionId: string;
  testId: string;
  
  // User Context
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  
  // Context
  department: string;
  subject: string;
  year: number;
  division: string;
  academicYear: string;
  
  // Session Info
  sessionId: string;
  sessionStartTime: Date;
  sessionEndTime: Date;
  totalSessionDuration: number;   // Seconds
  
  // Overall Metrics
  totalQuestions: number;
  totalMarksAwarded: number;
  totalMaxMarks: number;
  overallPercentage: number;
  
  // Question-Level Metrics
  questionMetrics: IQuestionMetric[];
  
  // Time Analysis
  timeDistribution: ITimeDistribution;
  averageTimePerQuestion: number;
  medianTimePerQuestion: number;
  totalEvaluationTime: number;
  
  // Marking Pattern Analysis
  markingDistribution: IMarkingDistribution;
  strictnessScore: number;        // 0-100 (0 = very lenient, 100 = very strict)
  leniencyScore: number;          // 0-100 (0 = very strict, 100 = very lenient)
  
  // Comment Analysis
  totalComments: number;
  averageCommentLength: number;
  commentCoverage: number;        // Percentage of questions with comments
  
  // Sentiment Distribution
  positiveComments: number;
  negativeComments: number;
  neutralComments: number;
  noComments: number;
  
  // Bias Indicators
  biasIndicators: IBiasIndicators;
  
  // Quality Scores
  evaluationQualityScore: number;  // 0-100 (composite score)
  thoroughnessScore: number;       // 0-100 (based on time and comments)
  
  // Comparative Metrics (set later by bias detector)
  deviationFromDepartmentAverage?: number;
  deviationFromSubjectAverage?: number;
  teacherAverageComparison?: number;  // How this compares to teacher's own average
  
  // Flags for Review
  flaggedForReview: boolean;
  flagReasons: string[];
  
  // Re-evaluation Context (if applicable)
  isReevaluation: boolean;
  originalEvaluationId?: string;
  grievanceId?: string;
  marksChanged?: boolean;
  marksDifference?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const QuestionMetricSchema = new Schema<IQuestionMetric>(
  {
    questionNumber: { type: Number, required: true },
    maxMarks: { type: Number, required: true },
    marksAwarded: { type: Number, required: true },
    percentage: { type: Number, required: true },
    timeSpent: { type: Number, required: true },
    comment: { type: String, default: '' },
    commentLength: { type: Number, default: 0 },
    markingPattern: {
      type: String,
      enum: ['strict', 'lenient', 'moderate', 'zero', 'full'],
      required: true,
    },
    markedAt: { type: Date, required: true },
    sequenceOrder: { type: Number, required: true },
  },
  { _id: false }
);

const TimeDistributionSchema = new Schema<ITimeDistribution>(
  {
    firstQuarter: { type: Number, default: 0 },
    secondQuarter: { type: Number, default: 0 },
    thirdQuarter: { type: Number, default: 0 },
    fourthQuarter: { type: Number, default: 0 },
    averagePerQuarter: { type: [Number], default: [] },
  },
  { _id: false }
);

const MarkingDistributionSchema = new Schema<IMarkingDistribution>(
  {
    zeroMarks: { type: Number, default: 0 },
    fullMarks: { type: Number, default: 0 },
    partialMarks: { type: Number, default: 0 },
    belowAverage: { type: Number, default: 0 },
    average: { type: Number, default: 0 },
    aboveAverage: { type: Number, default: 0 },
  },
  { _id: false }
);

const BiasIndicatorsSchema = new Schema<IBiasIndicators>(
  {
    markingConsistency: { type: Number, min: 0, max: 100, default: 0 },
    timeConsistency: { type: Number, min: 0, max: 100, default: 0 },
    hasSequenceBias: { type: Boolean, default: false },
    sequenceBiasTrend: {
      type: String,
      enum: ['increasing', 'decreasing', 'neutral'],
      default: 'neutral',
    },
    fatigueDetected: { type: Boolean, default: false },
    fatigueStartPoint: { type: Number },
    fatigueScore: { type: Number, min: 0, max: 100, default: 0 },
    rushingDetected: { type: Boolean, default: false },
    averageTimePerQuestion: { type: Number, default: 0 },
    minTimeSpent: { type: Number, default: 0 },
    maxTimeSpent: { type: Number, default: 0 },
    commentQuality: { type: Number, min: 0, max: 100, default: 0 },
    commentRate: { type: Number, min: 0, max: 100, default: 0 },
    outlierCount: { type: Number, default: 0 },
    outlierQuestions: { type: [Number], default: [] },
  },
  { _id: false }
);

const EvaluationMetricsSchema = new Schema<IEvaluationMetrics>(
  {
    metricsId: {
      type: String,
      required: [true, 'Metrics ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    evaluationId: {
      type: String,
      required: [true, 'Evaluation ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    submissionId: {
      type: String,
      required: [true, 'Submission ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    testId: {
      type: String,
      required: [true, 'Test ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    
    // User Context
    teacherId: {
      type: String,
      required: [true, 'Teacher ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    teacherName: {
      type: String,
      required: [true, 'Teacher name is required'],
      trim: true,
    },
    studentId: {
      type: String,
      required: [true, 'Student ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    
    // Context
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      index: true,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: 1,
      max: 4,
      index: true,
    },
    division: {
      type: String,
      required: [true, 'Division is required'],
      trim: true,
      uppercase: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
    
    // Session Info
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      trim: true,
      index: true,
    },
    sessionStartTime: {
      type: Date,
      required: [true, 'Session start time is required'],
    },
    sessionEndTime: {
      type: Date,
      required: [true, 'Session end time is required'],
    },
    totalSessionDuration: {
      type: Number,
      required: [true, 'Total session duration is required'],
      min: 0,
    },
    
    // Overall Metrics
    totalQuestions: {
      type: Number,
      required: [true, 'Total questions is required'],
      min: 1,
    },
    totalMarksAwarded: {
      type: Number,
      required: [true, 'Total marks awarded is required'],
      min: 0,
    },
    totalMaxMarks: {
      type: Number,
      required: [true, 'Total max marks is required'],
      min: 0,
    },
    overallPercentage: {
      type: Number,
      required: [true, 'Overall percentage is required'],
      min: 0,
      max: 100,
    },
    
    // Question-Level Metrics
    questionMetrics: {
      type: [QuestionMetricSchema],
      required: [true, 'Question metrics are required'],
    },
    
    // Time Analysis
    timeDistribution: {
      type: TimeDistributionSchema,
      required: true,
    },
    averageTimePerQuestion: {
      type: Number,
      required: true,
      min: 0,
    },
    medianTimePerQuestion: {
      type: Number,
      required: true,
      min: 0,
    },
    totalEvaluationTime: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Marking Pattern Analysis
    markingDistribution: {
      type: MarkingDistributionSchema,
      required: true,
    },
    strictnessScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    leniencyScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    
    // Comment Analysis
    totalComments: {
      type: Number,
      required: true,
      min: 0,
    },
    averageCommentLength: {
      type: Number,
      required: true,
      min: 0,
    },
    commentCoverage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    
    // Sentiment Distribution
    positiveComments: { type: Number, default: 0 },
    negativeComments: { type: Number, default: 0 },
    neutralComments: { type: Number, default: 0 },
    noComments: { type: Number, default: 0 },
    
    // Bias Indicators
    biasIndicators: {
      type: BiasIndicatorsSchema,
      required: true,
    },
    
    // Quality Scores
    evaluationQualityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    thoroughnessScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    
    // Comparative Metrics
    deviationFromDepartmentAverage: { type: Number },
    deviationFromSubjectAverage: { type: Number },
    teacherAverageComparison: { type: Number },
    
    // Flags for Review
    flaggedForReview: {
      type: Boolean,
      default: false,
      index: true,
    },
    flagReasons: {
      type: [String],
      default: [],
    },
    
    // Re-evaluation Context
    isReevaluation: {
      type: Boolean,
      default: false,
      index: true,
    },
    originalEvaluationId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    grievanceId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    marksChanged: {
      type: Boolean,
      default: false,
    },
    marksDifference: {
      type: Number,
    },
  },
  {
    timestamps: true,
    collection: 'evaluation_metrics',
  }
);

// Compound Indexes
EvaluationMetricsSchema.index({ teacherId: 1, createdAt: -1 });
EvaluationMetricsSchema.index({ department: 1, subject: 1, createdAt: -1 });
EvaluationMetricsSchema.index({ testId: 1, teacherId: 1 });
EvaluationMetricsSchema.index({ flaggedForReview: 1, createdAt: -1 });
EvaluationMetricsSchema.index({ 'biasIndicators.fatigueDetected': 1 });

// Static methods for analytics

// Get teacher's average metrics
EvaluationMetricsSchema.statics.getTeacherAverages = async function(
  teacherId: string,
  dateFrom?: Date,
  dateTo?: Date
) {
  const query: any = { teacherId };
  
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = dateTo;
  }
  
  const metrics = await this.find(query);
  
  if (metrics.length === 0) return null;
  
  const avgPercentage = metrics.reduce((sum, m) => sum + m.overallPercentage, 0) / metrics.length;
  const avgTime = metrics.reduce((sum, m) => sum + m.averageTimePerQuestion, 0) / metrics.length;
  const avgStrictness = metrics.reduce((sum, m) => sum + m.strictnessScore, 0) / metrics.length;
  const avgQuality = metrics.reduce((sum, m) => sum + m.evaluationQualityScore, 0) / metrics.length;
  
  return {
    totalEvaluations: metrics.length,
    averagePercentage: avgPercentage,
    averageTimePerQuestion: avgTime,
    averageStrictness: avgStrictness,
    averageQuality: avgQuality,
    fatigueRate: (metrics.filter(m => m.biasIndicators.fatigueDetected).length / metrics.length) * 100,
  };
};

// Find flagged evaluations
EvaluationMetricsSchema.statics.getFlaggedEvaluations = async function(department?: string) {
  const query: any = { flaggedForReview: true };
  if (department) query.department = department;
  
  return this.find(query).sort({ createdAt: -1 });
};

// Prevent model recompilation
const EvaluationMetrics: Model<IEvaluationMetrics> = 
  mongoose.models.EvaluationMetrics || 
  mongoose.model<IEvaluationMetrics>('EvaluationMetrics', EvaluationMetricsSchema);

export default EvaluationMetrics;
