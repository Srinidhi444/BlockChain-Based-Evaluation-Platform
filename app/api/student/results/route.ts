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
    
    // Get submissionId from query params
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submissionId');
    
    if (!submissionId) {
      return NextResponse.json(
        { error: 'Submission ID is required' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await connectDB();
    
    // Find submission
    const submission = await Submission.findOne({ submissionId });
    
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }
    
    // Verify submission belongs to current student
    if (submission.studentId !== currentUser.userId) {
      return NextResponse.json(
        { error: 'Forbidden. This submission does not belong to you.' },
        { status: 403 }
      );
    }
    
    // Check if submission is evaluated
    if (submission.status !== 'evaluated' && submission.status !== 'published') {
      return NextResponse.json(
        { error: 'This submission has not been evaluated yet' },
        { status: 400 }
      );
    }
    
    // Find evaluation
    const evaluation = await Evaluation.findOne({ submissionId, isDraft: false });
    
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: true,
        data: {
          evaluation,
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('Fetch results error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
