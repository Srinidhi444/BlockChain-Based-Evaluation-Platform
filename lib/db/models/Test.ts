import mongoose, { Schema, Model } from 'mongoose';
import { ITest, IQuestion } from '@/lib/types';
import crypto from 'crypto';
const QuestionSchema = new Schema<IQuestion>(
  {
    questionNumber: {
      type: Number,
      required: [true, 'Question number is required'],
      min: [1, 'Question number must be at least 1']
    },
    marks: {
      type: Number,
      required: [true, 'Marks are required'],
      min: [0, 'Marks cannot be negative']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    }
  },
  { _id: false }
);

const TestSchema = new Schema<ITest>(
  {
    testId: {
      type: String,
      required: [true, 'Test ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      // More flexible regex: allows alphanumeric department codes
      match: [/^TEST_[A-Z0-9]+_\d+_\d+$/, 'Invalid Test ID format']
    },
    title: {
      type: String,
      required: [true, 'Test title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1, 'Year must be between 1 and 4'],
      max: [4, 'Year must be between 1 and 4']
    },
    division: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'ALL',
      maxlength: [10, 'Division cannot exceed 10 characters']
    },
    totalMarks: {
      type: Number,
      required: [true, 'Total marks are required'],
      min: [1, 'Total marks must be at least 1']
    },
    questions: {
      type: [QuestionSchema],
      required: [true, 'Questions are required'],
      validate: {
        validator: function(questions: IQuestion[]) {
          return questions.length > 0;
        },
        message: 'At least one question is required'
      }
    },
    uploadedBy: {
      type: String,
      required: [true, 'Uploader ID is required'],
      trim: true,
      uppercase: true
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      match: [/^\d{4}-\d{2}$/, 'Academic year format must be YYYY-YY (e.g., 2025-26)']
    },
    examType: {
      type: String,
      enum: ['midterm', 'endsem', 'assignment', 'quiz'],
      required: [true, 'Exam type is required'],
      default: 'midterm'
    },
    examDate: {
      type: Date,
      required: [true, 'Exam date is required']
    },
    blockchainExamId: {
      type: Number,
      unique: true,
      default: 0,
    }
  },
  {
    timestamps: true,
    collection: 'tests'
  }
);


// Indexes for efficient queries
TestSchema.index({ testId: 1 });
TestSchema.index({ department: 1, year: 1, division: 1 });
TestSchema.index({ subject: 1, department: 1 });
TestSchema.index({ uploadedBy: 1 });
TestSchema.index({ academicYear: 1, examType: 1 });
TestSchema.index({ examDate: -1 });

// Virtual to check if test is active/upcoming
TestSchema.virtual('isUpcoming').get(function(this: ITest) {
  return new Date(this.examDate) > new Date();
});

// Virtual to check if test is expired
TestSchema.virtual('isExpired').get(function(this: ITest) {
  const daysSinceExam = (Date.now() - new Date(this.examDate).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceExam > 30; // Tests expire after 30 days
});
TestSchema.pre('save', function (next) {
  // Generate blockchainExamId only if not set or still 0
  if (!this.blockchainExamId || this.blockchainExamId === 0) {
    const hash = crypto
      .createHash('sha256')
      .update(this._id.toString())
      .digest('hex');

    const blockchainExamId =
      parseInt(hash.slice(0, 12), 16) % Number.MAX_SAFE_INTEGER;

    this.blockchainExamId = blockchainExamId;
  }

  next();
});

// Pre-save hook to validate total marks match sum of question marks
TestSchema.pre('save', function(next) {
  const sumOfQuestionMarks = this.questions.reduce((sum, q) => sum + q.marks, 0);
  
  if (sumOfQuestionMarks !== this.totalMarks) {
    return next(new Error(`Total marks (${this.totalMarks}) must equal sum of question marks (${sumOfQuestionMarks})`));
  }
  
  // Validate unique question numbers
  const questionNumbers = this.questions.map(q => q.questionNumber);
  const uniqueNumbers = new Set(questionNumbers);
  
  if (questionNumbers.length !== uniqueNumbers.size) {
    return next(new Error('Question numbers must be unique'));
  }
  
  next();
});

// Static method to find tests by class
TestSchema.statics.findByClass = function(
  department: string,
  year: number,
  division?: string
) {
  const query: any = {
    department,
    year,
    $or: [
      { division: 'ALL' },
      ...(division ? [{ division }] : [])
    ]
  };
  
  return this.find(query).sort({ examDate: -1 });
};

// Static method to find tests by teacher
TestSchema.statics.findByTeacher = function(teacherId: string) {
  return this.find({ uploadedBy: teacherId }).sort({ createdAt: -1 });
};

// Static method to find active tests (for submissions)
TestSchema.statics.findActiveTests = function(
  department: string,
  year: number,
  division: string
) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.find({
    department,
    year,
    $or: [
      { division: 'ALL' },
      { division }
    ],
    examDate: { $gte: thirtyDaysAgo }
  }).sort({ examDate: -1 });
};

// Instance method to get question by number
TestSchema.methods.getQuestion = function(questionNumber: number): IQuestion | null {
  return this.questions.find((q: IQuestion) => q.questionNumber === questionNumber) || null;
};

// Instance method to check if division can access this test
TestSchema.methods.isAccessibleByDivision = function(division: string): boolean {
  return this.division === 'ALL' || this.division === division;
};

// Prevent model recompilation in development
const Test: Model<ITest> = mongoose.models.Test || mongoose.model<ITest>('Test', TestSchema);

export default Test;
