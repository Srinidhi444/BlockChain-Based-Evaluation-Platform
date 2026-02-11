import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import Test from '@/lib/db/models/Test';
import Submission from '@/lib/db/models/Submission';
import { getUserFromHeaders, isStudent } from '@/lib/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isStudent(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Connect to database
    await connectDB();
    
    // Get student details
    const student = await User.findOne({ userId: currentUser.userId });
    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }
    
    // Find tests for student's class (within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const allTests = await Test.find({
      department: student.department,
      year: student.year,
      $or: [
        { division: 'ALL' },
        { division: student.division }
      ],
      examDate: { $gte: thirtyDaysAgo }
    }).sort({ examDate: -1 });
    
    // Get all submissions by this student
    const submissions = await Submission.find({
      studentId: currentUser.userId
    });
    
    // Filter out tests that student has already submitted
    const submittedTestIds = new Set(submissions.map(s => s.testId));
    const availableTests = allTests.filter(test => !submittedTestIds.has(test.testId));
    
    return NextResponse.json(
      {
        success: true,
        data: {
          tests: availableTests,
          total: availableTests.length,
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('Fetch available tests error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
