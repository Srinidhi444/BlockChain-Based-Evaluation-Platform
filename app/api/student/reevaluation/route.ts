import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import ReEvaluation from '@/lib/db/models/ReEvaluation';
import Grievance from '@/lib/db/models/Grievance';
import { getUserFromHeaders } from '@/lib/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || currentUser.role !== 'student') {
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
        { error: 'submissionId is required' },
        { status: 400 }
      );
    }
    
    console.log('🔍 Looking for re-evaluation for submission:', submissionId);
    
    // Connect to database
    await connectDB();
    
    // Find grievance for this submission (case-insensitive)
    const escapedSubmissionId = submissionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const grievance = await Grievance.findOne({
      submissionId: { $regex: new RegExp(`^${escapedSubmissionId}$`, 'i') },
      studentId: currentUser.userId,
      status: 'completed'
    });
    
    if (!grievance || !grievance.reevaluationId) {
      console.log('❌ No completed re-evaluation found for submission:', submissionId);
      return NextResponse.json(
        { error: 'Re-evaluation not found' },
        { status: 404 }
      );
    }
    
    console.log('✅ Found grievance with reevaluationId:', grievance.reevaluationId);
    
    // Find re-evaluation
    const reevaluation = await ReEvaluation.findOne({
      reevaluationId: grievance.reevaluationId
    });
    
    if (!reevaluation) {
      console.log('❌ Re-evaluation not found:', grievance.reevaluationId);
      return NextResponse.json(
        { error: 'Re-evaluation data not found' },
        { status: 404 }
      );
    }
    
    console.log('✅ Re-evaluation found successfully');
    
    return NextResponse.json(
      {
        success: true,
        data: {
          reevaluation: {
            reevaluationId: reevaluation.reevaluationId,
            grievanceId: reevaluation.grievanceId,
            
            // Original marks
            originalTotalMarksObtained: reevaluation.originalTotalMarksObtained,
            originalTotalMarks: reevaluation.originalTotalMarks,
            originalPercentage: reevaluation.originalPercentage,
            originalRemarks: reevaluation.originalRemarks,
            
            // New marks
            newTotalMarksObtained: reevaluation.newTotalMarksObtained,
            newTotalMarks: reevaluation.newTotalMarks,
            newPercentage: reevaluation.newPercentage,
            newRemarks: reevaluation.newRemarks,
            
            // Differences
            totalDifference: reevaluation.totalDifference,
            percentageDifference: reevaluation.percentageDifference,
            
            // Question-wise comparison
            comparisonData: reevaluation.comparisonData,
            
            // Metadata
            newTeacherName: reevaluation.newTeacherName,
            newEvaluatedAt: reevaluation.newEvaluatedAt,
          },
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('❌ Fetch re-evaluation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
