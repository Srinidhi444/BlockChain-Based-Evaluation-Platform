import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Grievance from '@/lib/db/models/Grievance';
import Evaluation from '@/lib/db/models/Evaluation';
import ReEvaluation from '@/lib/db/models/ReEvaluation';
import User from '@/lib/db/models/User';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';
import { generateEvaluationHash } from '@/lib/utils/hash';

interface ReEvaluateRequest {
  grievanceId: string;
  questionMarks: Array<{
    questionNumber: number;
    maxMarks: number;
    marksObtained: number;
    comment?: string;
  }>;
  remarks?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only teachers can submit re-evaluations.' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body: ReEvaluateRequest = await request.json();
    const { grievanceId, questionMarks, remarks } = body;
    
    // Validate required fields
    if (!grievanceId || !questionMarks || questionMarks.length === 0) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['grievanceId', 'questionMarks']
        },
        { status: 400 }
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
    
    // Check if already completed
    if (grievance.status === 'completed') {
      return NextResponse.json(
        { error: 'This grievance has already been completed' },
        { status: 400 }
      );
    }
    
    // Get original evaluation
    const originalEvaluation = await Evaluation.findOne({ 
      evaluationId: grievance.originalEvaluationId 
    });
    
    if (!originalEvaluation) {
      return NextResponse.json(
        { error: 'Original evaluation not found' },
        { status: 404 }
      );
    }
    
    // Calculate new totals
    const newTotalMarksObtained = questionMarks.reduce(
      (sum, q) => sum + (q.marksObtained || 0), 
      0
    );
    const newTotalMarks = questionMarks.reduce(
      (sum, q) => sum + q.maxMarks, 
      0
    );
    const newPercentage = newTotalMarks > 0 
      ? (newTotalMarksObtained / newTotalMarks) * 100 
      : 0;
    
    // Verify total marks match
    if (newTotalMarks !== originalEvaluation.totalMarks) {
      return NextResponse.json(
        { error: 'Total marks do not match original evaluation' },
        { status: 400 }
      );
    }
    
    // Generate re-evaluation hash
    const evaluationData = {
      submissionId: grievance.submissionId,
      teacherId: currentUser.userId,
      questionMarks: questionMarks.map(q => ({
        questionNumber: q.questionNumber,
        marksObtained: q.marksObtained
      })),
      totalMarksObtained: newTotalMarksObtained,
      evaluatedAt: new Date()
    };
    const resultHash = generateEvaluationHash(evaluationData);
    
    // Generate re-evaluation ID
    const timestamp = Date.now();
    const reevaluationId = `REEVAL_${grievanceId}_${timestamp}`;
    
    // Create comparison data
    const comparisonData = originalEvaluation.questionMarks.map((oldQ) => {
      const newQ = questionMarks.find(q => q.questionNumber === oldQ.questionNumber);
      
      return {
        questionNumber: oldQ.questionNumber,
        maxMarks: oldQ.maxMarks,
        oldMarksObtained: oldQ.marksObtained,
        newMarksObtained: newQ ? newQ.marksObtained : oldQ.marksObtained,
        oldComment: oldQ.comment || '',
        newComment: newQ ? newQ.comment || '' : '',
        difference: (newQ ? newQ.marksObtained : oldQ.marksObtained) - oldQ.marksObtained,
      };
    });
    
    const totalDifference = newTotalMarksObtained - originalEvaluation.totalMarksObtained;
    const percentageDifference = newPercentage - originalEvaluation.percentage;
    
    // Create re-evaluation record
    const reevaluation = await ReEvaluation.create({
      reevaluationId,
      grievanceId,
      submissionId: grievance.submissionId,
      testId: grievance.testId,
      studentId: grievance.studentId,
      
      // Original evaluation data
      originalEvaluationId: originalEvaluation.evaluationId,
      originalTeacherId: originalEvaluation.teacherId,
      originalTeacherName: originalEvaluation.teacherName,
      originalQuestionMarks: originalEvaluation.questionMarks,
      originalTotalMarksObtained: originalEvaluation.totalMarksObtained,
      originalTotalMarks: originalEvaluation.totalMarks,
      originalPercentage: originalEvaluation.percentage,
      originalRemarks: originalEvaluation.remarks || '',
      originalEvaluatedAt: originalEvaluation.evaluatedAt,
      
      // New evaluation data
      newTeacherId: currentUser.userId,
      newTeacherName: teacher.name,
      newQuestionMarks: questionMarks,
      newTotalMarksObtained,
      newTotalMarks,
      newPercentage,
      newRemarks: remarks || '',
      newEvaluatedAt: new Date(),
      
      // Comparison
      comparisonData,
      totalDifference,
      percentageDifference,
      
      // Approval (auto-approve)
      isApproved: true,
      approvedBy: currentUser.userId,
      approvedAt: new Date(),
      
      // Blockchain
      resultHash,
      blockchainVerified: false,
    });
    
    console.log('✅ Re-evaluation created:', reevaluationId);
    console.log('   Total difference:', totalDifference);
    console.log('   Percentage difference:', percentageDifference.toFixed(2) + '%');
    
    // Update grievance status
    grievance.status = 'completed';
    grievance.reevaluationId = reevaluationId;
    grievance.completedAt = new Date();
    await grievance.save();
    
    console.log('✅ Grievance completed:', grievanceId);
    
    // TODO: Send notification to student
    
    return NextResponse.json(
      {
        success: true,
        message: 'Re-evaluation submitted successfully',
        data: {
          reevaluation: {
            reevaluationId: reevaluation.reevaluationId,
            grievanceId: reevaluation.grievanceId,
            submissionId: reevaluation.submissionId,
            
            originalTotalMarksObtained: reevaluation.originalTotalMarksObtained,
            newTotalMarksObtained: reevaluation.newTotalMarksObtained,
            totalDifference: reevaluation.totalDifference,
            
            originalPercentage: reevaluation.originalPercentage,
            newPercentage: reevaluation.newPercentage,
            percentageDifference: reevaluation.percentageDifference,
            
            comparisonData: reevaluation.comparisonData,
            resultHash: reevaluation.resultHash,
          },
        },
      },
      { status: 201 }
    );
    
  } catch (error: any) {
    console.error('❌ Re-evaluate error:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
