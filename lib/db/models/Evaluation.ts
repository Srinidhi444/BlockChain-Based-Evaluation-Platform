import mongoose, { Schema, Model } from 'mongoose';
import { IEvaluation, IQuestionMark } from '@/lib/types';

const QuestionMarkSchema = new Schema<IQuestionMark>(
  {
    questionNumber: {
      type: Number,
      required: [true, 'Question number is required'],
      min: [1, 'Question number must be at least 1']
    },
    maxMarks: {
      type: Number,
      required: [true, 'Maximum marks are required'],
      min: [0, 'Maximum marks cannot be negative']
    },
    marksObtained: {
      type: Number,
      required: [true, 'Marks obtained are required'],
      min: [0, 'Marks obtained cannot be negative'],
      validate: {
        validator: function(this: IQuestionMark, value: number) {
          return value <= this.maxMarks;
        },
        message: 'Marks obtained cannot exceed maximum marks'
      }
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Comment cannot exceed 500 characters']
    }
  },
  { _id: false }
);

const EvaluationSchema = new Schema<IEvaluation>(
  {
    evaluationId: {
      type: String,
      required: [true, 'Evaluation ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    submissionId: {
      type: String,
      required: [true, 'Submission ID is required'],
      trim: true,
      uppercase: true,
      unique: true, // One evaluation per submission
      index: true
    },
    testId: {
      type: String,
      required: [true, 'Test ID is required'],
      trim: true,
      uppercase: true,
      index: true
    },
    teacherId: {
      type: String,
      required: [true, 'Teacher ID is required'],
      trim: true,
      uppercase: true,
      match: [/^TCH\d{7}$/, 'Invalid Teacher ID format'],
      index: true
    },
    teacherName: {
      type: String,
      required: [true, 'Teacher name is required'],
      trim: true
    },
    questionMarks: {
      type: [QuestionMarkSchema],
      required: [true, 'Question marks are required'],
      validate: {
        validator: function(questions: IQuestionMark[]) {
          return questions.length > 0;
        },
        message: 'At least one question must be evaluated'
      }
    },
    totalMarksObtained: {
      type: Number,
      required: [true, 'Total marks obtained are required'],
      min: [0, 'Total marks obtained cannot be negative']
    },
    totalMarks: {
      type: Number,
      required: [true, 'Total marks are required'],
      min: [1, 'Total marks must be at least 1']
    },
    percentage: {
      type: Number,
      required: [true, 'Percentage is required'],
      min: [0, 'Percentage cannot be negative'],
      max: [100, 'Percentage cannot exceed 100']
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Remarks cannot exceed 1000 characters']
    },
    isDraft: {
      type: Boolean,
      default: true,
      index: true
    },
    evaluatedAt: {
      type: Date,
      default: null
    },
    evaluationHash: {
      type: String,
      required: function () {
        return this.isDraft === false;
      },
      trim: true,
      minlength: 64,
      maxlength: 64
    },

    blockchainTxHash: {
      type: String,
      trim: true,
      default: null
    },
   
    blockchainVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  },
  {
    timestamps: true,
    collection: 'evaluations'
  }
);


EvaluationSchema.index({ teacherId: 1, createdAt: -1 });
EvaluationSchema.index({ testId: 1, isDraft: 1 });
EvaluationSchema.index({ isDraft: 1, updatedAt: -1 });

// Virtual for grade calculation
EvaluationSchema.virtual('grade').get(function(this: IEvaluation) {
  const percentage = this.percentage;
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
});

// Virtual to check if evaluation is finalized
EvaluationSchema.virtual('isFinalized').get(function(this: IEvaluation) {
  return !this.isDraft && this.evaluatedAt !== null;
});

// Pre-save hook to validate and calculate totals
EvaluationSchema.pre('save', function(next) {
  // Calculate total marks obtained from question marks
  const calculatedTotal = this.questionMarks.reduce((sum, q) => sum + (q.marksObtained || 0), 0);
  
  if (Math.abs(calculatedTotal - this.totalMarksObtained) > 0.01) {
    return next(new Error(`Total marks obtained (${this.totalMarksObtained}) must equal sum of question marks (${calculatedTotal})`));
  }
  
  // Calculate total maximum marks
  const calculatedMaxTotal = this.questionMarks.reduce((sum, q) => sum + q.maxMarks, 0);
  
  if (Math.abs(calculatedMaxTotal - this.totalMarks) > 0.01) {
    return next(new Error(`Total marks (${this.totalMarks}) must equal sum of maximum marks (${calculatedMaxTotal})`));
  }
  
  // Validate percentage calculation
  const calculatedPercentage = (this.totalMarksObtained / this.totalMarks) * 100;
  
  if (Math.abs(calculatedPercentage - this.percentage) > 0.1) {
    return next(new Error(`Percentage (${this.percentage}) does not match calculated value (${calculatedPercentage.toFixed(2)})`));
  }
  
  // Validate unique question numbers
  const questionNumbers = this.questionMarks.map(q => q.questionNumber);
  const uniqueNumbers = new Set(questionNumbers);
  
  if (questionNumbers.length !== uniqueNumbers.size) {
    return next(new Error('Question numbers must be unique'));
  }
  
  // If finalizing (isDraft = false), set evaluatedAt
  if (!this.isDraft && !this.evaluatedAt) {
    this.evaluatedAt = new Date();
  }
  
  next();
});

// Static method to find evaluations by teacher
EvaluationSchema.statics.findByTeacher = function(teacherId: string, includeDrafts: boolean = true) {
  const query: any = { teacherId };
  if (!includeDrafts) {
    query.isDraft = false;
  }
  return this.find(query).sort({ updatedAt: -1 });
};

// Static method to find evaluations by test
EvaluationSchema.statics.findByTest = function(testId: string) {
  return this.find({ testId, isDraft: false }).sort({ evaluatedAt: -1 });
};

// Static method to get evaluation statistics
EvaluationSchema.statics.getStatsByTest = async function(testId: string) {
  const evaluations = await this.find({ testId, isDraft: false });
  
  if (evaluations.length === 0) {
    return {
      totalEvaluations: 0,
      averageMarks: 0,
      averagePercentage: 0,
      highestMarks: 0,
      lowestMarks: 0,
      passCount: 0,
      failCount: 0
    };
  }
  
  const totalMarksSum = evaluations.reduce((sum, e) => sum + e.totalMarksObtained, 0);
  const percentageSum = evaluations.reduce((sum, e) => sum + e.percentage, 0);
  const passCount = evaluations.filter(e => e.percentage >= 40).length;
  
  return {
    totalEvaluations: evaluations.length,
    averageMarks: totalMarksSum / evaluations.length,
    averagePercentage: percentageSum / evaluations.length,
    highestMarks: Math.max(...evaluations.map(e => e.totalMarksObtained)),
    lowestMarks: Math.min(...evaluations.map(e => e.totalMarksObtained)),
    passCount,
    failCount: evaluations.length - passCount
  };
};

// Static method to find drafts by teacher (for resuming evaluation)
EvaluationSchema.statics.findDraftsByTeacher = function(teacherId: string) {
  return this.find({ teacherId, isDraft: true }).sort({ updatedAt: -1 });
};

// Instance method to finalize evaluation
EvaluationSchema.methods.finalize = async function() {
  if (!this.isDraft) {
    throw new Error('Evaluation is already finalized');
  }
  
  this.isDraft = false;
  this.evaluatedAt = new Date();
  return this.save();
};

// Instance method to mark as blockchain verified
EvaluationSchema.methods.markBlockchainVerified = async function(txHash: string) {
  this.blockchainTxHash = txHash;
  this.blockchainVerified = true;
  return this.save();
};

// Instance method to update question marks (for draft editing)
EvaluationSchema.methods.updateQuestionMarks = async function(
  questionNumber: number,
  marksObtained: number,
  comment?: string
) {
  if (!this.isDraft) {
    throw new Error('Cannot update finalized evaluation');
  }
  
  const question = this.questionMarks.find(q => q.questionNumber === questionNumber);
  if (!question) {
    throw new Error(`Question ${questionNumber} not found`);
  }
  
  question.marksObtained = marksObtained;
  if (comment !== undefined) {
    question.comment = comment;
  }
  
  // Recalculate totals
  this.totalMarksObtained = this.questionMarks.reduce((sum, q) => sum + (q.marksObtained || 0), 0);
  this.percentage = (this.totalMarksObtained / this.totalMarks) * 100;
  
  return this.save();
};

// Prevent model recompilation in development
const Evaluation: Model<IEvaluation> = mongoose.models.Evaluation || mongoose.model<IEvaluation>('Evaluation', EvaluationSchema);

export default Evaluation;
