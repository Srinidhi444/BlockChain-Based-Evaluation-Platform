import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import Test from '@/lib/db/models/Test';
import Submission from '@/lib/db/models/Submission';
import Evaluation from '@/lib/db/models/Evaluation';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Connect to database
    await connectDB();
    
    // Get teacher details
    const teacher = await User.findOne({ userId: currentUser.userId });
    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      );
    }
    
    // Count tests created by this teacher
    const testsCreated = await Test.countDocuments({
      uploadedBy: currentUser.userId
    });
    
    // Find submissions for teacher's subjects
    const totalSubmissions = await Submission.countDocuments({
      department: teacher.department,
      subject: { $in: teacher.subjects }
    });
    
    // Count pending submissions
    const pendingSubmissions = await Submission.countDocuments({
      department: teacher.department,
      subject: { $in: teacher.subjects },
      status: { $in: ['uploaded', 'under_evaluation'] }
    });
    
    // Count evaluated submissions
    const evaluatedSubmissions = await Evaluation.countDocuments({
      teacherId: currentUser.userId,
      isDraft: false
    });
    
    const stats = {
      testsCreated,
      totalSubmissions,
      pendingSubmissions,
      evaluatedSubmissions,
    };
    
    return NextResponse.json(
      {
        success: true,
        data: { stats },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('Fetch stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
