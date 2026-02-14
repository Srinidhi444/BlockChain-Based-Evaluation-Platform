import mongoose, { Schema, Model } from 'mongoose';

export interface IGrievance {
  _id: string;
  grievanceId: string; // Format: GRV_SUBMISSIONID_TIMESTAMP
  submissionId: string; // Links to Submission
  testId: string;
  studentId: string;
  studentName: string;
  
  // Grievance details
  grievanceType: 'calculation_error' | 'reevaluation';
  questionNumber?: number; // Optional - specific question
  explanation: string; // Student's explanation
  
  // Assignment
  originalTeacherId: string; // Teacher who did original evaluation
  assignedTeacherId: string; // Teacher assigned for re-evaluation
  
  // Status tracking
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  
  // Result references
  originalEvaluationId: string; // Original evaluation
  reevaluationId?: string; // New re-evaluation (if completed)
  
  // Timestamps
  filedAt: Date;
  assignedAt?: Date;
  completedAt?: Date;
  
  // Admin notes
  adminNotes?: string;
  rejectionReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const GrievanceSchema = new Schema<IGrievance>(
  {
    grievanceId: {
      type: String,
      required: [true, 'Grievance ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
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
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    grievanceType: {
      type: String,
      enum: ['calculation_error', 'reevaluation'],
      required: [true, 'Grievance type is required'],
      index: true,
    },
    questionNumber: {
      type: Number,
      min: [1, 'Question number must be at least 1'],
      required: false,
    },
    explanation: {
      type: String,
      required: [true, 'Explanation is required'],
      trim: true,
      minlength: [20, 'Explanation must be at least 20 characters'],
      maxlength: [1000, 'Explanation cannot exceed 1000 characters'],
    },
    originalTeacherId: {
      type: String,
      required: [true, 'Original teacher ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    assignedTeacherId: {
      type: String,
      required: [true, 'Assigned teacher ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'rejected'],
      default: 'pending',
      index: true,
    },
    originalEvaluationId: {
      type: String,
      required: [true, 'Original evaluation ID is required'],
      trim: true,
      uppercase: true,
    },
    reevaluationId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    filedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Admin notes cannot exceed 500 characters'],
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    collection: 'grievances',
  }
);

// Indexes for efficient queries
GrievanceSchema.index({ submissionId: 1, grievanceType: 1 });
GrievanceSchema.index({ studentId: 1, status: 1 });
GrievanceSchema.index({ assignedTeacherId: 1, status: 1 });
GrievanceSchema.index({ status: 1, filedAt: -1 });

// Prevent duplicate grievances for same submission
GrievanceSchema.index(
  { submissionId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'in_progress'] }
    }
  }
);

// Virtual to check if grievance is active
GrievanceSchema.virtual('isActive').get(function(this: IGrievance) {
  return this.status === 'pending' || this.status === 'in_progress';
});

// Virtual to check if grievance is resolved
GrievanceSchema.virtual('isResolved').get(function(this: IGrievance) {
  return this.status === 'completed' || this.status === 'rejected';
});

// Static method to find grievances by teacher
GrievanceSchema.statics.findByTeacher = function(teacherId: string, status?: string) {
  const query: any = { assignedTeacherId: teacherId };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ filedAt: -1 });
};

// Static method to find grievances by student
GrievanceSchema.statics.findByStudent = function(studentId: string) {
  return this.find({ studentId }).sort({ filedAt: -1 });
};

// Static method to get pending grievances count
GrievanceSchema.statics.getPendingCount = function(teacherId: string) {
  return this.countDocuments({
    assignedTeacherId: teacherId,
    status: 'pending',
  });
};

// Instance method to assign to teacher
GrievanceSchema.methods.assignToTeacher = async function(teacherId: string) {
  this.assignedTeacherId = teacherId;
  this.status = 'in_progress';
  this.assignedAt = new Date();
  return this.save();
};

// Instance method to complete grievance
GrievanceSchema.methods.complete = async function(reevaluationId: string) {
  this.status = 'completed';
  this.reevaluationId = reevaluationId;
  this.completedAt = new Date();
  return this.save();
};

// Instance method to reject grievance
GrievanceSchema.methods.reject = async function(reason: string) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.completedAt = new Date();
  return this.save();
};

// Pre-save hook to validate
GrievanceSchema.pre('save', function(next) {
  // If calculation error, assigned teacher must be same as original
  if (this.grievanceType === 'calculation_error') {
    if (this.assignedTeacherId !== this.originalTeacherId) {
      return next(new Error('Calculation error grievances must be assigned to the original teacher'));
    }
  }
  
  // If reevaluation, assigned teacher must be different
  if (this.grievanceType === 'reevaluation') {
    if (this.assignedTeacherId === this.originalTeacherId) {
      return next(new Error('Re-evaluation grievances must be assigned to a different teacher'));
    }
  }
  
  next();
});

// Prevent model recompilation in development
const Grievance: Model<IGrievance> = 
  mongoose.models.Grievance || mongoose.model<IGrievance>('Grievance', GrievanceSchema);

export default Grievance;
