import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
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
    
    // Find all submissions by this student
    const submissions = await Submission.find({
      studentId: currentUser.userId
    }).sort({ uploadedAt: -1 });
    
    return NextResponse.json(
      {
        success: true,
        data: {
          submissions,
          total: submissions.length,
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('Fetch submissions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
