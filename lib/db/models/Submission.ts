import mongoose, { Schema, Model } from 'mongoose';
import { ISubmission } from '@/lib/types';
import crypto from 'crypto';

const SubmissionSchema = new Schema<ISubmission>(
  {
    submissionId: {
      type: String,
      required: [true, 'Submission ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    blockchainExamId: {
      type: Number,
      required: true,
      index: true
    },
    testId: {
      type: String,
      required: [true, 'Test ID is required'],
      trim: true,
      uppercase: true,
      index: true
    },
    studentId: {
      type: String,
      required: [true, 'Student ID is required'],
      trim: true,
      uppercase: true,
      match: [/^ST\d{7}$/, 'Invalid Student ID format'],
      index: true
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1, 'Year must be between 1 and 4'],
      max: [4, 'Year must be between 1 and 4'],
      index: true
    },
    division: {
      type: String,
      required: [true, 'Division is required'],
      trim: true,
      uppercase: true,
      index: true
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      index: true
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true
    },
    answerSheetUrl: {
      type: String,
      required: [true, 'Answer sheet URL is required'],
      trim: true
    },
    fileHash: {
      type: String,
      required: [true, 'File hash is required'],
      trim: true,
      length: [64, 'SHA-256 hash must be 64 characters']
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size cannot be negative']
    },
    fileType: {
      type: String,
      required: [true, 'File type is required'],
      enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
      default: 'application/pdf'
    },
    status: {
      type: String,
      enum: ['uploaded', 'under_evaluation', 'evaluated', 'published'],
      default: 'uploaded',
      index: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    },
    blockchainTxHash: {
      type: String,
      trim: true,
      default: null
    },
  },
  {
    timestamps: true,
    collection: 'submissions'
  }
);

// Compound indexes for complex queries
SubmissionSchema.index({ testId: 1, studentId: 1 }, { unique: true }); // Prevent duplicate submissions
SubmissionSchema.index({ department: 1, year: 1, division: 1, subject: 1 });
SubmissionSchema.index({ status: 1, uploadedAt: -1 });
SubmissionSchema.index({ studentId: 1, uploadedAt: -1 });

// Virtual for anonymized student identifier (for blind evaluation)
SubmissionSchema.virtual('anonymousId').get(function() {
  return 'SUB_' + crypto
    .createHash('sha256')
    .update(this.submissionId)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
});

// Virtual to check if submission is recent (within 7 days)
SubmissionSchema.virtual('isRecent').get(function(this: ISubmission) {
  const daysSinceUpload = (Date.now() - new Date(this.uploadedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceUpload <= 7;
});

// Pre-save hook to validate submission
SubmissionSchema.pre('save', function(next) {
  // Validate file hash is SHA-256 format (64 hex characters)
  if (this.fileHash && !/^[a-f0-9]{64}$/i.test(this.fileHash)) {
    return next(new Error('Invalid SHA-256 hash format'));
  }
  
  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (this.fileSize > maxSize) {
    return next(new Error('File size cannot exceed 10MB'));
  }
  
  next();
});

// Static method to find submissions by test
SubmissionSchema.statics.findByTest = function(testId: string) {
  return this.find({ testId }).sort({ uploadedAt: -1 });
};

// Static method to find submissions by student
SubmissionSchema.statics.findByStudent = function(studentId: string) {
  return this.find({ studentId }).sort({ uploadedAt: -1 });
};

// Static method to find pending evaluations for a teacher
SubmissionSchema.statics.findPendingForTeacher = function(
  department: string,
  subjects: string[]
) {
  return this.find({
    department,
    subject: { $in: subjects },
    status: { $in: ['uploaded', 'under_evaluation'] }
  }).sort({ uploadedAt: 1 }); // Oldest first
};

// Static method to find submissions by class and subject
SubmissionSchema.statics.findByClassAndSubject = function(
  department: string,
  year: number,
  division: string,
  subject: string
) {
  return this.find({
    department,
    year,
    division,
    subject
  }).sort({ uploadedAt: -1 });
};

// Static method to get submission statistics
SubmissionSchema.statics.getStats = async function(filters: {
  department?: string;
  year?: number;
  division?: string;
  subject?: string;
  testId?: string;
}) {
  const query: any = {};
  if (filters.department) query.department = filters.department;
  if (filters.year) query.year = filters.year;
  if (filters.division) query.division = filters.division;
  if (filters.subject) query.subject = filters.subject;
  if (filters.testId) query.testId = filters.testId;
  
  const totalSubmissions = await this.countDocuments(query);
  const uploadedCount = await this.countDocuments({ ...query, status: 'uploaded' });
  const underEvaluationCount = await this.countDocuments({ ...query, status: 'under_evaluation' });
  const evaluatedCount = await this.countDocuments({ ...query, status: 'evaluated' });
  const publishedCount = await this.countDocuments({ ...query, status: 'published' });
  
  return {
    total: totalSubmissions,
    uploaded: uploadedCount,
    underEvaluation: underEvaluationCount,
    evaluated: evaluatedCount,
    published: publishedCount
  };
};

// Instance method to update status
SubmissionSchema.methods.updateStatus = async function(newStatus: string) {
  const validTransitions: Record<string, string[]> = {
    'uploaded': ['under_evaluation'],
    'under_evaluation': ['uploaded', 'evaluated'],
    'evaluated': ['published'],
    'published': []
  };
  
  const allowedStatuses = validTransitions[this.status] || [];
  
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  return this.save();
};

// Instance method to mark as blockchain verified
SubmissionSchema.methods.markBlockchainVerified = async function(txHash: string) {
  this.blockchainTxHash = txHash;
  this.blockchainVerified = true;
  return this.save();
};

// Prevent model recompilation in development
const Submission: Model<ISubmission> = mongoose.models.Submission || mongoose.model<ISubmission>('Submission', SubmissionSchema);

export default Submission;
