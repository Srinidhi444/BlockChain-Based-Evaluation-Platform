import mongoose, { Schema, Model } from 'mongoose';

// Question mark structure (same as Evaluation)
export interface IQuestionMarkComparison {
  questionNumber: number;
  maxMarks: number;
  oldMarksObtained: number;
  newMarksObtained: number;
  oldComment?: string;
  newComment?: string;
  difference: number; // newMarks - oldMarks
}

export interface IReEvaluation {
  _id: string;
  reevaluationId: string; // Format: REEVAL_GRIEVANCEID_TIMESTAMP
  grievanceId: string; // Links to Grievance
  submissionId: string; // Links to Submission
  testId: string;
  studentId: string;
  
  // Original evaluation data
  originalEvaluationId: string;
  originalTeacherId: string;
  originalTeacherName: string;
  originalQuestionMarks: Array<{
    questionNumber: number;
    maxMarks: number;
    marksObtained: number;
    comment?: string;
  }>;
  originalTotalMarksObtained: number;
  originalTotalMarks: number;
  originalPercentage: number;
  originalRemarks?: string;
  originalEvaluatedAt: Date;
  
  // New evaluation data
  newTeacherId: string;
  newTeacherName: string;
  newQuestionMarks: Array<{
    questionNumber: number;
    maxMarks: number;
    marksObtained: number;
    comment?: string;
  }>;
  newTotalMarksObtained: number;
  newTotalMarks: number;
  newPercentage: number;
  newRemarks?: string;
  newEvaluatedAt: Date;
  
  // Comparison data
  comparisonData: IQuestionMarkComparison[];
  totalDifference: number; // newTotal - oldTotal
  percentageDifference: number; // newPercentage - oldPercentage
  
  // Status
  isApproved: boolean; // Admin approval (optional)
  approvedBy?: string;
  approvedAt?: Date;
  
  // Result hash (for blockchain)
  resultHash: string;
  blockchainTxHash?: string;
  blockchainVerified: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const ReEvaluationSchema = new Schema<IReEvaluation>(
  {
    reevaluationId: {
      type: String,
      required: [true, 'Re-evaluation ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    grievanceId: {
      type: String,
      required: [true, 'Grievance ID is required'],
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
    studentId: {
      type: String,
      required: [true, 'Student ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    
    // Original evaluation
    originalEvaluationId: {
      type: String,
      required: [true, 'Original evaluation ID is required'],
      trim: true,
      uppercase: true,
    },
    originalTeacherId: {
      type: String,
      required: [true, 'Original teacher ID is required'],
      trim: true,
      uppercase: true,
    },
    originalTeacherName: {
      type: String,
      required: [true, 'Original teacher name is required'],
      trim: true,
    },
    originalQuestionMarks: {
      type: [{
        questionNumber: { type: Number, required: true },
        maxMarks: { type: Number, required: true },
        marksObtained: { type: Number, required: true },
        comment: { type: String, default: '' },
      }],
      required: [true, 'Original question marks are required'],
      _id: false,
    },
    originalTotalMarksObtained: {
      type: Number,
      required: [true, 'Original total marks obtained is required'],
    },
    originalTotalMarks: {
      type: Number,
      required: [true, 'Original total marks is required'],
    },
    originalPercentage: {
      type: Number,
      required: [true, 'Original percentage is required'],
    },
    originalRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    originalEvaluatedAt: {
      type: Date,
      required: [true, 'Original evaluation date is required'],
    },
    
    // New evaluation
    newTeacherId: {
      type: String,
      required: [true, 'New teacher ID is required'],
      trim: true,
      uppercase: true,
    },
    newTeacherName: {
      type: String,
      required: [true, 'New teacher name is required'],
      trim: true,
    },
    newQuestionMarks: {
      type: [{
        questionNumber: { type: Number, required: true },
        maxMarks: { type: Number, required: true },
        marksObtained: { type: Number, required: true },
        comment: { type: String, default: '' },
      }],
      required: [true, 'New question marks are required'],
      _id: false,
    },
    newTotalMarksObtained: {
      type: Number,
      required: [true, 'New total marks obtained is required'],
    },
    newTotalMarks: {
      type: Number,
      required: [true, 'New total marks is required'],
    },
    newPercentage: {
      type: Number,
      required: [true, 'New percentage is required'],
    },
    newRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    newEvaluatedAt: {
      type: Date,
      required: [true, 'New evaluation date is required'],
      default: Date.now,
    },
    
    // Comparison
    comparisonData: {
      type: [{
        questionNumber: { type: Number, required: true },
        maxMarks: { type: Number, required: true },
        oldMarksObtained: { type: Number, required: true },
        newMarksObtained: { type: Number, required: true },
        oldComment: { type: String, default: '' },
        newComment: { type: String, default: '' },
        difference: { type: Number, required: true },
      }],
      required: [true, 'Comparison data is required'],
      _id: false,
    },
    totalDifference: {
      type: Number,
      required: [true, 'Total difference is required'],
    },
    percentageDifference: {
      type: Number,
      required: [true, 'Percentage difference is required'],
    },
    
    // Approval
    isApproved: {
      type: Boolean,
      default: true, // Auto-approve by default
    },
    approvedBy: {
      type: String,
      trim: true,
      uppercase: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    
    // Blockchain
    resultHash: {
      type: String,
      required: [true, 'Result hash is required'],
      trim: true,
      length: [64, 'SHA-256 hash must be 64 characters'],
    },
    blockchainTxHash: {
      type: String,
      trim: true,
      default: null,
    },
    blockchainVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'reevaluations',
  }
);

// Indexes
ReEvaluationSchema.index({ grievanceId: 1 }, { unique: true });
ReEvaluationSchema.index({ submissionId: 1 });
ReEvaluationSchema.index({ studentId: 1, createdAt: -1 });
ReEvaluationSchema.index({ newTeacherId: 1, createdAt: -1 });

// Virtual for grade comparison
ReEvaluationSchema.virtual('oldGrade').get(function(this: IReEvaluation) {
  const p = this.originalPercentage;
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C';
  if (p >= 40) return 'D';
  return 'F';
});

ReEvaluationSchema.virtual('newGrade').get(function(this: IReEvaluation) {
  const p = this.newPercentage;
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C';
  if (p >= 40) return 'D';
  return 'F';
});

// Virtual to check if marks improved
ReEvaluationSchema.virtual('isImproved').get(function(this: IReEvaluation) {
  return this.totalDifference > 0;
});

// Static method to find by student
ReEvaluationSchema.statics.findByStudent = function(studentId: string) {
  return this.find({ studentId }).sort({ createdAt: -1 });
};

// Static method to find by submission
ReEvaluationSchema.statics.findBySubmission = function(submissionId: string) {
  return this.findOne({ submissionId });
};

// Instance method to approve
ReEvaluationSchema.methods.approve = async function(approvedBy: string) {
  this.isApproved = true;
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  return this.save();
};

// Pre-save hook to auto-calculate comparison data
ReEvaluationSchema.pre('save', function(next) {
  // Calculate comparison data if not provided
  if (!this.comparisonData || this.comparisonData.length === 0) {
    this.comparisonData = this.originalQuestionMarks.map((oldQ) => {
      const newQ = this.newQuestionMarks.find(
        (q) => q.questionNumber === oldQ.questionNumber
      );
      
      return {
        questionNumber: oldQ.questionNumber,
        maxMarks: oldQ.maxMarks,
        oldMarksObtained: oldQ.marksObtained,
        newMarksObtained: newQ ? newQ.marksObtained : oldQ.marksObtained,
        oldComment: oldQ.comment || '',
        newComment: newQ ? newQ.comment || '' : '',
        difference: (newQ ? newQ.marksObtained : oldQ.marksObtained) - oldQ.marksObtained,
      };
    });
  }
  
  // Calculate total difference
  this.totalDifference = this.newTotalMarksObtained - this.originalTotalMarksObtained;
  this.percentageDifference = this.newPercentage - this.originalPercentage;
  
  next();
});

// Prevent model recompilation
const ReEvaluation: Model<IReEvaluation> = 
  mongoose.models.ReEvaluation || mongoose.model<IReEvaluation>('ReEvaluation', ReEvaluationSchema);

export default ReEvaluation;
