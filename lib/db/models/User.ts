import mongoose, { Schema, Model } from 'mongoose';
import { IUser, UserRole } from '@/lib/types';

const UserSchema = new Schema<IUser>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^(ST|TCH|ADM)\d{7}$/, 'Invalid User ID format']
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters']
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: [true, 'Role is required'],
      default: UserRole.STUDENT
    },
    department: {
      type: String,
      trim: true,
      required: function(this: IUser) {
        return this.role === UserRole.STUDENT || this.role === UserRole.TEACHER;
      }
    },
    year: {
      type: Number,
      min: [1, 'Year must be between 1 and 4'],
      max: [4, 'Year must be between 1 and 4'],
      required: function(this: IUser) {
        return this.role === UserRole.STUDENT;
      }
    },
    division: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [1, 'Division must be a single character'],
      required: function(this: IUser) {
        return this.role === UserRole.STUDENT;
      }
    },
    subjects: {
      type: [String],
      default: [],
      required: function(this: IUser) {
        return this.role === UserRole.TEACHER;
      }
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

// Indexes for faster queries
UserSchema.index({ userId: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ department: 1, year: 1, division: 1 });

// Virtual for student full identifier
UserSchema.virtual('studentIdentifier').get(function(this: IUser) {
  if (this.role === UserRole.STUDENT) {
    return `${this.department}-${this.year}${this.division}`;
  }
  return null;
});

// Method to check if user is authorized for a department/subject
UserSchema.methods.canEvaluate = function(department: string, subject: string): boolean {
  if (this.role !== UserRole.TEACHER) return false;
  return this.department === department && this.subjects.includes(subject);
};

// Method to sanitize user data (remove password)
UserSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Pre-save hook to validate data consistency
UserSchema.pre('save', function(next) {
  // Students must have year and division
  if (this.role === UserRole.STUDENT) {
    if (!this.year || !this.division) {
      return next(new Error('Students must have year and division'));
    }
  }
  
  // Teachers must have subjects
  if (this.role === UserRole.TEACHER) {
    if (!this.subjects || this.subjects.length === 0) {
      return next(new Error('Teachers must have at least one subject'));
    }
  }
  
  next();
});

// Static method to find students by class
UserSchema.statics.findByClass = function(
  department: string,
  year: number,
  division: string
) {
  return this.find({
    role: UserRole.STUDENT,
    department,
    year,
    division
  }).select('-password');
};

// Static method to find teachers by department and subject
UserSchema.statics.findTeachersBySubject = function(
  department: string,
  subject: string
) {
  return this.find({
    role: UserRole.TEACHER,
    department,
    subjects: subject
  }).select('-password');
};

// Prevent model recompilation in development
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
