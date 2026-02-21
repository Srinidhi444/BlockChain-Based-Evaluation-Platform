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
    const currentUser = getUserFromHeaders(request.headers);
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only teachers can submit re-evaluations.' },
        { status: 401 }
      );
    }

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

    if (!grievanceId || !questionMarks || questionMarks.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields', required: ['grievanceId', 'questionMarks'] },
        { status: 400 }
      );
    }

    if (!sessionStartTime || !sessionEndTime) {
      return NextResponse.json(
        { error: 'Session start and end times are required for re-evaluation' },
        { status: 400 }
      );
    }

    await connectDB();

    const teacher = await User.findOne({ userId: currentUser.userId });
    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    const grievance = await Grievance.findOne({ grievanceId });
    if (!grievance) {
      return NextResponse.json({ error: 'Grievance not found' }, { status: 404 });
    }

    if (grievance.assignedTeacherId !== currentUser.userId) {
      return NextResponse.json(
        { error: 'You are not assigned to this grievance' },
        { status: 403 }
      );
    }

    // ── IDEMPOTENCY CHECK ──────────────────────────────────────────────────────
    // If a reevaluation already exists in DB (from a previous partial-failure run),
    // heal the grievance status and return success instead of crashing.
    const existingReeval = await ReEvaluation.findOne({ grievanceId });
    if (existingReeval) {
      console.log('ℹ️ Reevaluation already exists for:', grievanceId, '— healing grievance status');

      if (grievance.status !== 'completed' && grievance.status !== 'resolved') {
        grievance.status = 'completed';
        grievance.reevaluationId = existingReeval.reevaluationId;
        grievance.completedAt = existingReeval.newEvaluatedAt || new Date();
        await grievance.save();
        console.log('✅ Grievance status healed:', grievanceId);
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Re-evaluation already submitted successfully',
          data: {
            reevaluation: {
              reevaluationId:              existingReeval.reevaluationId,
              grievanceId:                 existingReeval.grievanceId,
              submissionId:                existingReeval.submissionId,
              originalTotalMarksObtained:  existingReeval.originalTotalMarksObtained,
              newTotalMarksObtained:       existingReeval.newTotalMarksObtained,
              totalDifference:             existingReeval.totalDifference,
              originalPercentage:          existingReeval.originalPercentage,
              newPercentage:               existingReeval.newPercentage,
              percentageDifference:        existingReeval.percentageDifference,
              comparisonData:              existingReeval.comparisonData,
              resultHash:                  existingReeval.resultHash,
            },
            sessionId: clientSessionId || generateSessionId(),
          },
        },
        { status: 200 }
      );
    }
    // ──────────────────────────────────────────────────────────────────────────

    // Grievance already properly completed — block duplicate submission
    if (grievance.status === 'completed' || grievance.status === 'resolved') {
      return NextResponse.json(
        { error: 'This grievance has already been completed' },
        { status: 400 }
      );
    }

    const originalEvaluation = await Evaluation.findOne({
      evaluationId: grievance.originalEvaluationId,
    });
    if (!originalEvaluation) {
      return NextResponse.json({ error: 'Original evaluation not found' }, { status: 404 });
    }

    const submission = await Submission.findOne({ submissionId: grievance.submissionId });
    const test       = await Test.findOne({ testId: grievance.testId });
    if (!submission || !test) {
      return NextResponse.json({ error: 'Submission or test not found' }, { status: 404 });
    }

    const newTotalMarksObtained = questionMarks.reduce((s, q) => s + (q.marksObtained || 0), 0);
    const newTotalMarks         = questionMarks.reduce((s, q) => s + q.maxMarks, 0);
    const newPercentage         = newTotalMarks > 0 ? (newTotalMarksObtained / newTotalMarks) * 100 : 0;

    if (newTotalMarks !== originalEvaluation.totalMarks) {
      return NextResponse.json(
        { error: 'Total marks do not match original evaluation' },
        { status: 400 }
      );
    }

    const evaluationData = {
      submissionId: grievance.submissionId,
      teacherId: currentUser.userId,
      questionMarks: questionMarks.map(q => ({
        questionNumber: q.questionNumber,
        marksObtained:  q.marksObtained,
      })),
      totalMarksObtained: newTotalMarksObtained,
      evaluatedAt: new Date(),
    };
    const resultHash = generateEvaluationHash(evaluationData);
    const sessionId  = clientSessionId || generateSessionId();

    const userAgent  = request.headers.get('user-agent') || 'Unknown';
    const deviceInfo = userAgent.substring(0, 200);
    const ipAddress  =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'Unknown';

    // Audit: start
    await logAuditEvent({
      eventType:    AuditEventType.REEVALUATION_STARTED,
      userId:       currentUser.userId,
      userRole:     'teacher',
      userName:     teacher.name,
      department:   teacher.department,
      sessionId,
      submissionId: grievance.submissionId,
      testId:       grievance.testId,
      studentId:    grievance.studentId,
      studentName:  grievance.studentName,
      grievanceId,
      grievanceType: grievance.grievanceType,
      subject:      submission.subject,
      year:         submission.year,
      division:     submission.division,
      academicYear: test.academicYear,
      deviceInfo,
      ipAddress,
    });

    const timestamp      = Date.now();
    const reevaluationId = `REEVAL_${grievanceId}_${timestamp}`;

    const comparisonData = originalEvaluation.questionMarks.map((oldQ: any) => {
      const newQ = questionMarks.find(q => q.questionNumber === oldQ.questionNumber);
      return {
        questionNumber:    oldQ.questionNumber,
        maxMarks:          oldQ.maxMarks,
        oldMarksObtained:  oldQ.marksObtained,
        newMarksObtained:  newQ ? newQ.marksObtained : oldQ.marksObtained,
        oldComment:        oldQ.comment || '',
        newComment:        newQ ? newQ.comment || '' : '',
        difference:        (newQ ? newQ.marksObtained : oldQ.marksObtained) - oldQ.marksObtained,
      };
    });

    const totalDifference      = newTotalMarksObtained - originalEvaluation.totalMarksObtained;
    const percentageDifference = newPercentage - originalEvaluation.percentage;

    // Audit: per-question
    if (questionTimings && questionTimings.length > 0) {
      let cumulativeTime = 0;
      for (const timing of questionTimings) {
        const questionMark = questionMarks.find(q => q.questionNumber === timing.questionNumber);
        if (!questionMark) continue;
        cumulativeTime += timing.timeSpent || 0;
        await logAuditEvent({
          eventType:        AuditEventType.REEVALUATION_QUESTION_MARKED,
          userId:           currentUser.userId,
          userRole:         'teacher',
          userName:         teacher.name,
          department:       teacher.department,
          sessionId,
          submissionId:     grievance.submissionId,
          testId:           grievance.testId,
          studentId:        grievance.studentId,
          evaluationId:     reevaluationId,
          grievanceId,
          questionNumber:   timing.questionNumber,
          marksAwarded:     questionMark.marksObtained,
          maxMarks:         questionMark.maxMarks,
          comment:          questionMark.comment,
          timeSpent:        timing.timeSpent || 0,
          cumulativeTime,
          questionSequence: timing.sequenceOrder || 0,
          subject:          submission.subject,
        });
      }
    }

    // ── CREATE REEVALUATION (safe upsert — never throws duplicate key) ─────────
    const reevaluation = await ReEvaluation.findOneAndUpdate(
      { grievanceId },
      {
        $setOnInsert: {
          reevaluationId,
          grievanceId,
          submissionId:               grievance.submissionId,
          testId:                     grievance.testId,
          studentId:                  grievance.studentId,
          originalEvaluationId:       originalEvaluation.evaluationId,
          originalTeacherId:          originalEvaluation.teacherId,
          originalTeacherName:        originalEvaluation.teacherName,
          originalQuestionMarks:      originalEvaluation.questionMarks,
          originalTotalMarksObtained: originalEvaluation.totalMarksObtained,
          originalTotalMarks:         originalEvaluation.totalMarks,
          originalPercentage:         originalEvaluation.percentage,
          originalRemarks:            originalEvaluation.remarks || '',
          originalEvaluatedAt:        originalEvaluation.evaluatedAt,
          newTeacherId:               currentUser.userId,
          newTeacherName:             teacher.name,
          newQuestionMarks:           questionMarks,
          newTotalMarksObtained,
          newTotalMarks,
          newPercentage,
          newRemarks:                 remarks || '',
          newEvaluatedAt:             new Date(),
          comparisonData,
          totalDifference,
          percentageDifference,
          isApproved:                 true,
          approvedBy:                 currentUser.userId,
          approvedAt:                 new Date(),
          resultHash,
          blockchainVerified:         false,
        },
      },
      { upsert: true, new: true }
    );
    // ──────────────────────────────────────────────────────────────────────────

    console.log('✅ Re-evaluation saved:', reevaluationId);
    console.log('   Original marks:', originalEvaluation.totalMarksObtained);
    console.log('   New marks:',      newTotalMarksObtained);
    console.log('   Difference:',     totalDifference);

    // Audit: completion — wrapped independently so a logging failure
    // doesn't prevent the grievance status from being updated
    try {
      const questionMarksData = questionMarks.map((qm, index) => {
        const timing = questionTimings?.find(t => t.questionNumber === qm.questionNumber) || {};
        return {
          questionNumber: qm.questionNumber,
          maxMarks:       qm.maxMarks,
          marksAwarded:   qm.marksObtained,
          comment:        qm.comment || '',
          timeSpent:      (timing as any).timeSpent || 0,
          markedAt:       (timing as any).markedAt ? new Date((timing as any).markedAt) : new Date(),
          sequenceOrder:  (timing as any).sequenceOrder || index + 1,
        };
      });

      await logReEvaluationComplete({
        sessionData: {
          evaluationId:       reevaluationId,
          submissionId:       grievance.submissionId,
          testId:             grievance.testId,
          teacherId:          currentUser.userId,
          teacherName:        teacher.name,
          studentId:          grievance.studentId,
          studentName:        grievance.studentName,
          department:         teacher.department,
          subject:            submission.subject,
          year:               submission.year,
          division:           submission.division,
          academicYear:       test.academicYear,
          sessionId,
          sessionStartTime:   new Date(sessionStartTime),
          sessionEndTime:     new Date(sessionEndTime),
          questionMarks:      questionMarksData,
          totalMarksAwarded:  newTotalMarksObtained,
          totalMaxMarks:      newTotalMarks,
          isReevaluation:     true,
          originalEvaluationId: originalEvaluation.evaluationId,
          grievanceId,
        },
        originalMarks:      originalEvaluation.totalMarksObtained,
        newMarks:           newTotalMarksObtained,
        originalTeacherId:  originalEvaluation.teacherId,
      });
    } catch (auditErr) {
      // Audit logging failure should NOT block the grievance from being marked complete
      console.warn('⚠️ Audit completion log failed (non-fatal):', auditErr);
    }

    // ── UPDATE GRIEVANCE STATUS — always runs, even if audit logging failed ───
    grievance.status        = 'completed';
    grievance.reevaluationId = reevaluationId;
    grievance.completedAt   = new Date();
    await grievance.save();
    console.log('✅ Grievance completed:', grievanceId);
    // ──────────────────────────────────────────────────────────────────────────

    return NextResponse.json(
      {
        success: true,
        message: 'Re-evaluation submitted successfully',
        data: {
          reevaluation: {
            reevaluationId:             reevaluation.reevaluationId,
            grievanceId:                reevaluation.grievanceId,
            submissionId:               reevaluation.submissionId,
            originalTotalMarksObtained: reevaluation.originalTotalMarksObtained,
            newTotalMarksObtained:      reevaluation.newTotalMarksObtained,
            totalDifference:            reevaluation.totalDifference,
            originalPercentage:         reevaluation.originalPercentage,
            newPercentage:              reevaluation.newPercentage,
            percentageDifference:       reevaluation.percentageDifference,
            comparisonData:             reevaluation.comparisonData,
            resultHash:                 reevaluation.resultHash,
          },
          sessionId,
        },
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('❌ Re-evaluate error:', error);

    // Handle duplicate key as last-resort fallback (should be caught by idempotency check above)
    if (error.code === 11000 && error.keyPattern?.grievanceId) {
      return NextResponse.json(
        { error: 'Re-evaluation already exists for this grievance. Please refresh the page.' },
        { status: 409 }
      );
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}