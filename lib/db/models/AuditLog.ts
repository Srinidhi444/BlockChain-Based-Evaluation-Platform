import mongoose, { Schema, Model } from 'mongoose';

// Event types for comprehensive audit tracking
export enum AuditEventType {
  // Evaluation Events
  EVALUATION_STARTED = 'evaluation_started',
  QUESTION_MARKED = 'question_marked',
  EVALUATION_DRAFT_SAVED = 'evaluation_draft_saved',
  EVALUATION_COMPLETED = 'evaluation_completed',
  EVALUATION_PUBLISHED = 'evaluation_published',
  
  // Grievance Events
  GRIEVANCE_FILED = 'grievance_filed',
  GRIEVANCE_VIEWED = 'grievance_viewed',
  GRIEVANCE_ASSIGNED = 'grievance_assigned',
  REEVALUATION_STARTED = 'reevaluation_started',
  REEVALUATION_QUESTION_MARKED = 'reevaluation_question_marked',
  REEVALUATION_COMPLETED = 'reevaluation_completed',
  
  // Access Events
  SUBMISSION_ACCESSED = 'submission_accessed',
  ANSWER_SHEET_VIEWED = 'answer_sheet_viewed',
  
  // System Events
  LOGIN = 'login',
  LOGOUT = 'logout',
}

// Marking pattern classification
export enum MarkingPattern {
  STRICT = 'strict',        // Marks < 60% of max
  LENIENT = 'lenient',      // Marks > 85% of max
  MODERATE = 'moderate',    // Marks between 60-85%
  ZERO = 'zero',           // Zero marks awarded
  FULL = 'full',           // Full marks awarded
}

// Sentiment analysis for comments
export enum CommentSentiment {
  POSITIVE = 'positive',    // Encouraging/supportive
  NEGATIVE = 'negative',    // Critical/harsh
  NEUTRAL = 'neutral',      // Factual/objective
  NONE = 'none',           // No comment
}

export interface IAuditLog {
  _id: string;
  
  // Event Identification
  auditId: string;          // Unique audit log ID
  eventType: AuditEventType;
  timestamp: Date;
  
  // User Context
  userId: string;           // User performing the action
  userRole: 'teacher' | 'student' | 'admin';
  userName: string;
  department: string;
  
  // Evaluation Context
  submissionId?: string;
  testId?: string;
  studentId?: string;       // Student being evaluated
  studentName?: string;
  evaluationId?: string;
  
  // Question-Level Metrics (for question_marked events)
  questionNumber?: number;
  marksAwarded?: number;
  maxMarks?: number;
  markingPercentage?: number;  // (marksAwarded / maxMarks) * 100
  comment?: string;
  commentLength?: number;
  commentSentiment?: CommentSentiment;
  
  // Time Tracking (for bias detection)
  timeSpent?: number;          // Time in seconds
  cumulativeTime?: number;     // Total time spent on evaluation so far
  questionSequence?: number;   // Order in which question was marked (1st, 2nd, 3rd...)
  
  // Session Context
  sessionId: string;           // Unique per evaluation session
  deviceInfo?: string;         // Browser/device details
  ipAddress?: string;
  
  // Behavioral Indicators
  markingPattern?: MarkingPattern;
  averageTimePerQuestion?: number;
  markingSpeed?: number;       // Questions per minute
  fatigueIndex?: number;       // 0-100 (higher = more fatigued)
  
  // Re-evaluation Specific
  grievanceId?: string;
  grievanceType?: 'calculation_error' | 'reevaluation';
  originalMarks?: number;
  newMarks?: number;
  marksDifference?: number;
  percentageDifference?: number;
  originalTeacherId?: string;
  newTeacherId?: string;
  
  // Bias Indicators (calculated)
  isOutlier?: boolean;          // Statistical outlier in marking
  deviationFromMean?: number;   // How far from average marks
  consistencyScore?: number;    // 0-100 (higher = more consistent)
  
  // Metadata
  subject?: string;
  year?: number;
  division?: string;
  academicYear?: string;
  
  // Additional Context
  notes?: string;               // Any additional notes
  metadata?: Record<string, any>; // Flexible field for future data
  
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    auditId: {
      type: String,
      required: [true, 'Audit ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: Object.values(AuditEventType),
      required: [true, 'Event type is required'],
      index: true,
    },
    timestamp: {
      type: Date,
      required: [true, 'Timestamp is required'],
      default: Date.now,
      index: true,
    },
    
    // User Context
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    userRole: {
      type: String,
      enum: ['teacher', 'student', 'admin'],
      required: [true, 'User role is required'],
      index: true,
    },
    userName: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    department: {
      type: String,
      trim: true,
      index: true,
    },
    
    // Evaluation Context
    submissionId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    testId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    studentId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    studentName: {
      type: String,
      trim: true,
    },
    evaluationId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    
    // Question-Level Metrics
    questionNumber: {
      type: Number,
      min: 1,
    },
    marksAwarded: {
      type: Number,
      min: 0,
    },
    maxMarks: {
      type: Number,
      min: 0,
    },
    markingPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    comment: {
      type: String,
      trim: true,
    },
    commentLength: {
      type: Number,
      min: 0,
    },
    commentSentiment: {
      type: String,
      enum: Object.values(CommentSentiment),
    },
    
    // Time Tracking
    timeSpent: {
      type: Number,
      min: 0,
    },
    cumulativeTime: {
      type: Number,
      min: 0,
    },
    questionSequence: {
      type: Number,
      min: 1,
    },
    
    // Session Context
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      trim: true,
      index: true,
    },
    deviceInfo: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    
    // Behavioral Indicators
    markingPattern: {
      type: String,
      enum: Object.values(MarkingPattern),
    },
    averageTimePerQuestion: {
      type: Number,
      min: 0,
    },
    markingSpeed: {
      type: Number,
      min: 0,
    },
    fatigueIndex: {
      type: Number,
      min: 0,
      max: 100,
    },
    
    // Re-evaluation Specific
    grievanceId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    grievanceType: {
      type: String,
      enum: ['calculation_error', 'reevaluation'],
    },
    originalMarks: {
      type: Number,
      min: 0,
    },
    newMarks: {
      type: Number,
      min: 0,
    },
    marksDifference: {
      type: Number,
    },
    percentageDifference: {
      type: Number,
    },
    originalTeacherId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    newTeacherId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    
    // Bias Indicators
    isOutlier: {
      type: Boolean,
      default: false,
    },
    deviationFromMean: {
      type: Number,
    },
    consistencyScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    
    // Metadata
    subject: {
      type: String,
      trim: true,
      index: true,
    },
    year: {
      type: Number,
      min: 1,
      max: 4,
    },
    division: {
      type: String,
      trim: true,
      uppercase: true,
    },
    academicYear: {
      type: String,
      trim: true,
    },
    
    // Additional Context
    notes: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'audit_logs',
  }
);

// Compound Indexes for efficient querying
AuditLogSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
AuditLogSchema.index({ submissionId: 1, eventType: 1 });
AuditLogSchema.index({ studentId: 1, timestamp: -1 });
AuditLogSchema.index({ testId: 1, userId: 1 });
AuditLogSchema.index({ grievanceId: 1, eventType: 1 });
AuditLogSchema.index({ department: 1, subject: 1, timestamp: -1 });
AuditLogSchema.index({ sessionId: 1, timestamp: 1 });

// TTL Index - Auto-delete logs older than 2 years (optional)
// AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

// Pre-save hook to calculate derived fields
AuditLogSchema.pre('save', function(next) {
  // Calculate marking percentage
  if (this.marksAwarded !== undefined && this.maxMarks) {
    this.markingPercentage = (this.marksAwarded / this.maxMarks) * 100;
  }
  
  // Classify marking pattern
  if (this.markingPercentage !== undefined) {
    if (this.markingPercentage === 0) {
      this.markingPattern = MarkingPattern.ZERO;
    } else if (this.markingPercentage === 100) {
      this.markingPattern = MarkingPattern.FULL;
    } else if (this.markingPercentage < 60) {
      this.markingPattern = MarkingPattern.STRICT;
    } else if (this.markingPercentage > 85) {
      this.markingPattern = MarkingPattern.LENIENT;
    } else {
      this.markingPattern = MarkingPattern.MODERATE;
    }
  }
  
  // Calculate comment length
  if (this.comment) {
    this.commentLength = this.comment.length;
    // Simple sentiment analysis (can be enhanced with ML)
    const positiveWords = ['good', 'excellent', 'great', 'well done', 'correct', 'perfect'];
    const negativeWords = ['wrong', 'incorrect', 'poor', 'weak', 'needs improvement'];
    
    const lowerComment = this.comment.toLowerCase();
    const hasPositive = positiveWords.some(word => lowerComment.includes(word));
    const hasNegative = negativeWords.some(word => lowerComment.includes(word));
    
    if (hasPositive && !hasNegative) {
      this.commentSentiment = CommentSentiment.POSITIVE;
    } else if (hasNegative && !hasPositive) {
      this.commentSentiment = CommentSentiment.NEGATIVE;
    } else {
      this.commentSentiment = CommentSentiment.NEUTRAL;
    }
  } else {
    this.commentSentiment = CommentSentiment.NONE;
  }
  
  // Calculate marks difference for re-evaluation
  if (this.originalMarks !== undefined && this.newMarks !== undefined) {
    this.marksDifference = this.newMarks - this.originalMarks;
    
    if (this.maxMarks) {
      this.percentageDifference = (this.marksDifference / this.maxMarks) * 100;
    }
  }
  
  next();
});

// Static methods for analytics

// Get evaluation metrics for a teacher
AuditLogSchema.statics.getTeacherMetrics = async function(teacherId: string, dateFrom?: Date, dateTo?: Date) {
  const query: any = {
    userId: teacherId,
    eventType: AuditEventType.QUESTION_MARKED,
  };
  
  if (dateFrom || dateTo) {
    query.timestamp = {};
    if (dateFrom) query.timestamp.$gte = dateFrom;
    if (dateTo) query.timestamp.$lte = dateTo;
  }
  
  const logs = await this.find(query);
  
  // Calculate metrics
  const totalQuestions = logs.length;
  const totalMarks = logs.reduce((sum, log) => sum + (log.marksAwarded || 0), 0);
  const totalMaxMarks = logs.reduce((sum, log) => sum + (log.maxMarks || 0), 0);
  const averagePercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
  
  const strictCount = logs.filter(log => log.markingPattern === MarkingPattern.STRICT).length;
  const lenientCount = logs.filter(log => log.markingPattern === MarkingPattern.LENIENT).length;
  
  return {
    totalQuestions,
    averagePercentage,
    strictCount,
    lenientCount,
    strictRate: (strictCount / totalQuestions) * 100,
    lenientRate: (lenientCount / totalQuestions) * 100,
  };
};

// Get grievance success rate
AuditLogSchema.statics.getGrievanceMetrics = async function(teacherId?: string) {
  const query: any = {
    eventType: AuditEventType.REEVALUATION_COMPLETED,
  };
  
  if (teacherId) {
    query.$or = [
      { originalTeacherId: teacherId },
      { newTeacherId: teacherId },
    ];
  }
  
  const logs = await this.find(query);
  
  const marksIncreased = logs.filter(log => (log.marksDifference || 0) > 0).length;
  const marksDecreased = logs.filter(log => (log.marksDifference || 0) < 0).length;
  const marksUnchanged = logs.filter(log => (log.marksDifference || 0) === 0).length;
  
  return {
    total: logs.length,
    increased: marksIncreased,
    decreased: marksDecreased,
    unchanged: marksUnchanged,
    increaseRate: (marksIncreased / logs.length) * 100,
  };
};

// Prevent model recompilation
const AuditLog: Model<IAuditLog> = 
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
