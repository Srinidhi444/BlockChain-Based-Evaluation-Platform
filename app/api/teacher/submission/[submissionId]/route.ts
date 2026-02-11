import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Submission from '@/lib/db/models/Submission';
import Test from '@/lib/db/models/Test';
import Evaluation from '@/lib/db/models/Evaluation';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Await params before accessing properties (Next.js 15 requirement)
    const { submissionId } = await params;

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

    // Get test details
    const test = await Test.findOne({ testId: submission.testId });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Check if evaluation exists (draft or finalized)
    const evaluation = await Evaluation.findOne({ submissionId });

    console.log('📋 Loaded submission:', submissionId);
    console.log('📝 Evaluation found:', evaluation ? evaluation.evaluationId : 'None');

    return NextResponse.json(
      {
        success: true,
        data: {
          submission,
          test,
          evaluation: evaluation || null, // Include evaluation if exists
        },
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Fetch submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
