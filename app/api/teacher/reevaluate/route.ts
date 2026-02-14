import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Grievance from '@/lib/db/models/Grievance';
import Evaluation from '@/lib/db/models/Evaluation';
import ReEvaluation from '@/lib/db/models/ReEvaluation';
import Submission from '@/lib/db/models/Submission';
import Test from '@/lib/db/models/Test';
import User from '@/lib/db/models/User';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';
import { generateEvaluationHash } from '@/lib/utils/hash';
import {
  generateSessionId,
  logEvaluationStart,
  logQuestionMarked,
  logReEvaluationComplete,
} from '@/lib/utils/auditLogger';
import { AuditEventType } from '@/lib/db/models/AuditLog';
import { logAuditEvent } from '@/lib/utils/auditLogger';

interface ReEvaluateRequest {
  grievanceId: string;
  questionMarks: Array<{
    questionNumber: number;
    maxMarks: number;
    marksObtained: number;
    comment?: string;
  }>;
  remarks?: string;
  
  // ✅ NEW: Audit tracking fields
  sessionId?: string;
  sessionStartTime?: string | Date;
  sessionEndTime?: string | Date;
  questionTimings?: Array<{
    questionNumber: number;
    timeSpent: number;
    markedAt: string | Date;
    sequenceOrder: number;
  }>;
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
    const { 
      grievanceId, 
      questionMarks, 
      remarks,
      sessionId: clientSessionId,
      sessionStartTime,
      sessionEndTime,
      questionTimings,
    } = body;
    
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
    
    // Validate session times for re-evaluation
    if (!sessionStartTime || !sessionEndTime) {
      return NextResponse.json(
        { error: 'Session start and end times are required for re-evaluation' },
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
    
    // Get submission and test for audit context
    const submission = await Submission.findOne({ submissionId: grievance.submissionId });
    const test = await Test.findOne({ testId: grievance.testId });
    
    if (!submission || !test) {
      return NextResponse.json(
        { error: 'Submission or test not found' },
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
    
    // Generate session ID for audit tracking
    const sessionId = clientSessionId || generateSessionId();
    
    // Get device info and IP for audit
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const deviceInfo = userAgent.substring(0, 200);
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'Unknown';
    
    // 📊 AUDIT: Log re-evaluation start
    await logAuditEvent({
      eventType: AuditEventType.REEVALUATION_STARTED,
      userId: currentUser.userId,
      userRole: 'teacher',
      userName: teacher.name,
      department: teacher.department,
      sessionId,
      submissionId: grievance.submissionId,
      testId: grievance.testId,
      studentId: grievance.studentId,
      studentName: grievance.studentName,
      grievanceId,
      grievanceType: grievance.grievanceType,
      subject: submission.subject,
      year: submission.year,
      division: submission.division,
      academicYear: test.academicYear,
      deviceInfo,
      ipAddress,
    });
    
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
    
    // 📊 AUDIT: Log question-by-question re-evaluation
    if (questionTimings && questionTimings.length > 0) {
      let cumulativeTime = 0;
      
      for (const timing of questionTimings) {
        const questionMark = questionMarks.find(q => q.questionNumber === timing.questionNumber);
        if (!questionMark) continue;
        
        cumulativeTime += timing.timeSpent || 0;
        
        await logAuditEvent({
          eventType: AuditEventType.REEVALUATION_QUESTION_MARKED,
          userId: currentUser.userId,
          userRole: 'teacher',
          userName: teacher.name,
          department: teacher.department,
          sessionId,
          submissionId: grievance.submissionId,
          testId: grievance.testId,
          studentId: grievance.studentId,
          evaluationId: reevaluationId,
          grievanceId,
          questionNumber: timing.questionNumber,
          marksAwarded: questionMark.marksObtained,
          maxMarks: questionMark.maxMarks,
          comment: questionMark.comment,
          timeSpent: timing.timeSpent || 0,
          cumulativeTime,
          questionSequence: timing.sequenceOrder || 0,
          subject: submission.subject,
        });
      }
    }
    
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
    console.log('   Original marks:', originalEvaluation.totalMarksObtained);
    console.log('   New marks:', newTotalMarksObtained);
    console.log('   Total difference:', totalDifference);
    console.log('   Percentage difference:', percentageDifference.toFixed(2) + '%');
    
    // 📊 AUDIT: Log re-evaluation completion with comprehensive metrics
    const questionMarksData = questionMarks.map((qm, index) => {
      const timing = questionTimings?.find(t => t.questionNumber === qm.questionNumber) || {};
      
      return {
        questionNumber: qm.questionNumber,
        maxMarks: qm.maxMarks,
        marksAwarded: qm.marksObtained,
        comment: qm.comment || '',
        timeSpent: timing.timeSpent || 0,
        markedAt: timing.markedAt ? new Date(timing.markedAt) : new Date(),
        sequenceOrder: timing.sequenceOrder || index + 1,
      };
    });
    
    await logReEvaluationComplete({
      sessionData: {
        evaluationId: reevaluationId,
        submissionId: grievance.submissionId,
        testId: grievance.testId,
        teacherId: currentUser.userId,
        teacherName: teacher.name,
        studentId: grievance.studentId,
        studentName: grievance.studentName,
        department: teacher.department,
        subject: submission.subject,
        year: submission.year,
        division: submission.division,
        academicYear: test.academicYear,
        sessionId,
        sessionStartTime: new Date(sessionStartTime),
        sessionEndTime: new Date(sessionEndTime),
        questionMarks: questionMarksData,
        totalMarksAwarded: newTotalMarksObtained,
        totalMaxMarks: newTotalMarks,
        isReevaluation: true,
        originalEvaluationId: originalEvaluation.evaluationId,
        grievanceId,
      },
      originalMarks: originalEvaluation.totalMarksObtained,
      newMarks: newTotalMarksObtained,
      originalTeacherId: originalEvaluation.teacherId,
    });
    
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
          sessionId, // Return sessionId for client tracking
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
