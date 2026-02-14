import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Grievance from '@/lib/db/models/Grievance';
import Submission from '@/lib/db/models/Submission';
import Evaluation from '@/lib/db/models/Evaluation';
import Test from '@/lib/db/models/Test';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only teachers can access grievances.' },
        { status: 401 }
      );
    }
    
    // Connect to database
    await connectDB();
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    
    // Build query - find grievances assigned to this teacher
    const query: any = { assignedTeacherId: currentUser.userId };
    
    if (status) {
      query.status = status;
    }
    
    if (type) {
      query.grievanceType = type;
    }
    
    // Fetch grievances
    const grievances = await Grievance.find(query).sort({ filedAt: -1 });
    
    // Fetch additional details for each grievance
    const grievancesWithDetails = await Promise.all(
      grievances.map(async (grievance) => {
        // Get submission details
        const submission = await Submission.findOne({ 
          submissionId: grievance.submissionId 
        });
        
        // Get test details
        const test = await Test.findOne({ 
          testId: grievance.testId 
        });
        
        // Get original evaluation
        const originalEvaluation = await Evaluation.findOne({ 
          evaluationId: grievance.originalEvaluationId 
        });
        
        return {
          grievance: {
            grievanceId: grievance.grievanceId,
            submissionId: grievance.submissionId,
            testId: grievance.testId,
            studentId: grievance.studentId,
            studentName: grievance.studentName,
            grievanceType: grievance.grievanceType,
            questionNumber: grievance.questionNumber,
            explanation: grievance.explanation,
            status: grievance.status,
            filedAt: grievance.filedAt,
            assignedAt: grievance.assignedAt,
            completedAt: grievance.completedAt,
          },
          submission: submission ? {
            answerSheetUrl: submission.answerSheetUrl,
            fileName: submission.fileName,
            fileType: submission.fileType,
            fileSize: submission.fileSize,
            uploadedAt: submission.uploadedAt,
          } : null,
          test: test ? {
            title: test.title,
            subject: test.subject,
            totalMarks: test.totalMarks,
            questions: test.questions,
          } : null,
          originalEvaluation: originalEvaluation ? {
            evaluationId: originalEvaluation.evaluationId,
            teacherId: originalEvaluation.teacherId,
            teacherName: originalEvaluation.teacherName,
            questionMarks: originalEvaluation.questionMarks,
            totalMarksObtained: originalEvaluation.totalMarksObtained,
            totalMarks: originalEvaluation.totalMarks,
            percentage: originalEvaluation.percentage,
            remarks: originalEvaluation.remarks,
            evaluatedAt: originalEvaluation.evaluatedAt,
          } : null,
        };
      })
    );
    
    // Get statistics
    const stats = {
      total: grievances.length,
      pending: grievances.filter(g => g.status === 'pending').length,
      inProgress: grievances.filter(g => g.status === 'in_progress').length,
      completed: grievances.filter(g => g.status === 'completed').length,
      rejected: grievances.filter(g => g.status === 'rejected').length,
      calculationError: grievances.filter(g => g.grievanceType === 'calculation_error').length,
      reevaluation: grievances.filter(g => g.grievanceType === 'reevaluation').length,
    };
    
    return NextResponse.json(
      {
        success: true,
        data: {
          grievances: grievancesWithDetails,
          stats,
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('❌ Fetch teacher grievances error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update grievance status (mark as in-progress)
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { grievanceId, status } = body;
    
    if (!grievanceId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: grievanceId, status' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await connectDB();
    
    // Find grievance
    const grievance = await Grievance.findOne({ grievanceId });
    
    if (!grievance) {
      return NextResponse.json(
        { error: 'Grievance not found' },
        { status: 404 }
      );
    }
    
    // Verify teacher is assigned to this grievance
    if (grievance.assignedTeacherId !== currentUser.userId) {
      return NextResponse.json(
        { error: 'You are not assigned to this grievance' },
        { status: 403 }
      );
    }
    
    // Update status
    if (status === 'in_progress' && grievance.status === 'pending') {
      grievance.status = 'in_progress';
      grievance.assignedAt = new Date();
      await grievance.save();
      
      console.log('✅ Grievance marked as in-progress:', grievanceId);
      
      return NextResponse.json(
        {
          success: true,
          message: 'Grievance status updated to in-progress',
          data: { grievance },
        },
        { status: 200 }
      );
    }
    
    return NextResponse.json(
      { error: 'Invalid status transition' },
      { status: 400 }
    );
    
  } catch (error: any) {
    console.error('❌ Update grievance error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
