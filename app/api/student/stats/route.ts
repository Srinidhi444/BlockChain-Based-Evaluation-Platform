import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Submission from '@/lib/db/models/Submission';
import Evaluation from '@/lib/db/models/Evaluation';
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
    
    // Count total submissions
    const totalSubmissions = await Submission.countDocuments({
      studentId: currentUser.userId
    });
    
    // Count evaluated submissions
    const evaluatedSubmissions = await Submission.countDocuments({
      studentId: currentUser.userId,
      status: { $in: ['evaluated', 'published'] }
    });
    
    // Count pending results
    const pendingResults = await Submission.countDocuments({
      studentId: currentUser.userId,
      status: { $in: ['uploaded', 'under_evaluation'] }
    });
    
    const stats = {
      totalSubmissions,
      evaluatedSubmissions,
      pendingResults,
    };
    
    return NextResponse.json(
      {
        success: true,
        data: { stats },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('Fetch student stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
