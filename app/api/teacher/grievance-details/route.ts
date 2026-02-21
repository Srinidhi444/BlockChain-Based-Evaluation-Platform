import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Grievance from '@/lib/db/models/Grievance';
import Submission from '@/lib/db/models/Submission';
import Evaluation from '@/lib/db/models/Evaluation';
import Test from '@/lib/db/models/Test';
import ReEvaluation from '@/lib/db/models/ReEvaluation';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getUserFromHeaders(request.headers);

    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const grievanceId = searchParams.get('grievanceId');

    if (!grievanceId) {
      return NextResponse.json({ error: 'grievanceId is required' }, { status: 400 });
    }

    console.log('🔍 Looking for grievance:', grievanceId);

    await connectDB();

    const escapedGrievanceId = grievanceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const grievance = await Grievance.findOne({
      grievanceId: { $regex: new RegExp(`^${escapedGrievanceId}$`, 'i') },
    });

    if (!grievance) {
      console.log('❌ Grievance not found:', grievanceId);
      const allGrievances = await Grievance.find().limit(5).select('grievanceId');
      console.log('Available grievances:', allGrievances.map(g => g.grievanceId));
      return NextResponse.json({ error: 'Grievance not found' }, { status: 404 });
    }

    console.log('✅ Grievance found:', grievance.grievanceId);

    if (grievance.assignedTeacherId !== currentUser.userId) {
      return NextResponse.json(
        { error: 'You are not assigned to this grievance' },
        { status: 403 }
      );
    }

    const submission = await Submission.findOne({ submissionId: grievance.submissionId });
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const test = await Test.findOne({ testId: grievance.testId });
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    const originalEvaluation = await Evaluation.findOne({
      evaluationId: grievance.originalEvaluationId,
    });
    if (!originalEvaluation) {
      return NextResponse.json({ error: 'Original evaluation not found' }, { status: 404 });
    }

    // ── Re-evaluation lookup ───────────────────────────────────────────────────
    // Strategy 1: via reevaluationId stored on grievance (happy path)
    // Strategy 2: fallback query by grievanceId in case partial failure left
    //             grievance.reevaluationId unset but the doc was saved
    let reevaluationDoc = null;

    if (grievance.reevaluationId) {
      reevaluationDoc = await ReEvaluation.findOne({
        reevaluationId: grievance.reevaluationId,
      });
    }

    // Fallback — catches the partial-failure case
    if (!reevaluationDoc) {
      reevaluationDoc = await ReEvaluation.findOne({
        grievanceId: grievance.grievanceId,
      });
    }

    // If we found a reevaluation but grievance status is still pending/assigned,
    // heal it in-place so the frontend immediately sees it as completed
    if (
      reevaluationDoc &&
      grievance.status !== 'completed' &&
      grievance.status !== 'resolved'
    ) {
      console.log('🔧 Healing grievance status for:', grievance.grievanceId);
      grievance.status         = 'completed';
      grievance.reevaluationId = reevaluationDoc.reevaluationId;
      grievance.completedAt    = reevaluationDoc.newEvaluatedAt || new Date();
      await grievance.save();
    }

    // Shape the reevaluation response — only expose what the frontend needs
    const reevaluation = reevaluationDoc
      ? {
          reevaluationId:             reevaluationDoc.reevaluationId,
          newTeacherId:               reevaluationDoc.newTeacherId,
          newTeacherName:             reevaluationDoc.newTeacherName,
          newQuestionMarks:           reevaluationDoc.newQuestionMarks,
          newTotalMarksObtained:      reevaluationDoc.newTotalMarksObtained,
          newTotalMarks:              reevaluationDoc.newTotalMarks,
          newPercentage:              reevaluationDoc.newPercentage,
          newRemarks:                 reevaluationDoc.newRemarks || '',
          newEvaluatedAt:             reevaluationDoc.newEvaluatedAt,
          comparisonData:             reevaluationDoc.comparisonData,
          totalDifference:            reevaluationDoc.totalDifference,
          percentageDifference:       reevaluationDoc.percentageDifference,
          isApproved:                 reevaluationDoc.isApproved,
          resultHash:                 reevaluationDoc.resultHash,
        }
      : null;
    // ──────────────────────────────────────────────────────────────────────────

    return NextResponse.json(
      {
        success: true,
        data: {
          grievance: {
            grievanceId:       grievance.grievanceId,
            submissionId:      grievance.submissionId,
            testId:            grievance.testId,
            studentId:         grievance.studentId,
            studentName:       grievance.studentName,
            grievanceType:     grievance.grievanceType,
            questionNumber:    grievance.questionNumber,
            explanation:       grievance.explanation,
            originalTeacherId: grievance.originalTeacherId,
            assignedTeacherId: grievance.assignedTeacherId,
            status:            grievance.status,           // healed if needed
            reevaluationId:    grievance.reevaluationId,   // healed if needed
            filedAt:           grievance.filedAt,
            assignedAt:        grievance.assignedAt,
            completedAt:       grievance.completedAt,
          },
          submission: {
            submissionId:   submission.submissionId,
            answerSheetUrl: submission.answerSheetUrl,
            fileName:       submission.fileName,
            fileType:       submission.fileType,
            fileSize:       submission.fileSize,
            fileHash:       submission.fileHash,
            uploadedAt:     submission.uploadedAt,
          },
          test: {
            testId:      test.testId,
            title:       test.title,
            subject:     test.subject,
            department:  test.department,
            year:        test.year,
            totalMarks:  test.totalMarks,
            questions:   test.questions,
          },
          originalEvaluation: {
            evaluationId:        originalEvaluation.evaluationId,
            teacherId:           originalEvaluation.teacherId,
            teacherName:         originalEvaluation.teacherName,
            questionMarks:       originalEvaluation.questionMarks,
            totalMarksObtained:  originalEvaluation.totalMarksObtained,
            totalMarks:          originalEvaluation.totalMarks,
            percentage:          originalEvaluation.percentage,
            remarks:             originalEvaluation.remarks,
            evaluatedAt:         originalEvaluation.evaluatedAt,
          },
          reevaluation, // null when not yet done, shaped object when done
        },
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Fetch grievance details error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}