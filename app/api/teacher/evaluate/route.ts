import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import Submission from '@/lib/db/models/Submission';
import Test from '@/lib/db/models/Test';
import Evaluation from '@/lib/db/models/Evaluation';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';
import { validateData, createEvaluationSchema } from '@/lib/utils/validation';
import { generateEvaluationId } from '@/lib/utils/idGenerator';
import { generateEvaluationHash } from '@/lib/utils/hash';
import { commitEvaluationToBlockchain } from '@/lib/blockchain/examContract';
import {
  generateSessionId,
  logEvaluationStart,
  logQuestionMarked,
  logEvaluationComplete,
} from '@/lib/utils/auditLogger';

export async function POST(request: NextRequest) {
  try {
    const currentUser = getUserFromHeaders(request.headers);

    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only teachers can evaluate submissions.' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    console.log('📥 Received evaluation request:');
    console.log('   Body:', JSON.stringify(body, null, 2));
    console.log('   Current User:', currentUser.userId);

    const validation = validateData(createEvaluationSchema, body);

    if (!validation.success) {
      console.error('❌ Validation failed:', validation.errors);
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }

    console.log('✅ Validation passed');

    const {
      submissionId,
      questionMarks,
      remarks,
      isDraft,
      sessionId: clientSessionId,
      sessionStartTime,
      sessionEndTime,
      questionTimings,
    } = validation.data;

    await connectDB();

    const teacher = await User.findOne({ userId: currentUser.userId });
    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      );
    }

    const submission = await Submission.findOne({ submissionId });
    console.log("📋 DB submission found:", submission ? submission.submissionId : 'None');

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    if (
      submission.department !== teacher.department ||
      !teacher.subjects.includes(submission.subject)
    ) {
      return NextResponse.json(
        { error: 'You are not authorized to evaluate this submission' },
        { status: 403 }
      );
    }

    const existingFinalizedEvaluation = await Evaluation.findOne({
      submissionId,
      isDraft: false,
    });

    if (existingFinalizedEvaluation) {
      return NextResponse.json(
        { error: 'This submission has already been finalized and cannot be modified' },
        { status: 409 }
      );
    }

    const test = await Test.findOne({ testId: submission.testId });
    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    const totalMarksObtained = questionMarks.reduce(
      (sum, q) => sum + (q.marksObtained || 0),
      0
    );
    const totalMarks = questionMarks.reduce(
      (sum, q) => sum + q.maxMarks,
      0
    );
    const percentage = totalMarks > 0 ? (totalMarksObtained / totalMarks) * 100 : 0;

    console.log(`📊 Calculated: ${totalMarksObtained}/${totalMarks} (${percentage.toFixed(2)}%)`);

    if (totalMarks !== test.totalMarks) {
      return NextResponse.json(
        { error: `Total marks (${totalMarks}) do not match test configuration (${test.totalMarks})` },
        { status: 400 }
      );
    }

    // ✅ FIX: Create evaluatedAt ONCE — same reference used for hash AND saving
    const evaluatedAt = isDraft ? null : new Date();

    const evaluationData = {
      submissionId,
      teacherId: currentUser.userId,
      questionMarks: questionMarks.map(q => ({
        questionNumber: q.questionNumber,
        marksObtained:  q.marksObtained,
      })),
      totalMarksObtained,
      evaluatedAt,   // ✅ same variable
    };
    const evaluationHash = generateEvaluationHash(evaluationData);

    const sessionId  = clientSessionId || generateSessionId();
    const userAgent  = request.headers.get('user-agent') || 'Unknown';
    const deviceInfo = userAgent.substring(0, 200);
    const ipAddress  =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'Unknown';

    const existingEvaluation = await Evaluation.findOne({ submissionId });
    const isNewEvaluation    = !existingEvaluation;

    if (isNewEvaluation) {
      await logEvaluationStart({
        teacherId:   currentUser.userId,
        teacherName: teacher.name,
        submissionId,
        testId:      submission.testId,
        studentId:   submission.studentId,
        studentName: submission.studentName,
        department:  teacher.department,
        subject:     submission.subject,
        sessionId,
        deviceInfo,
        ipAddress,
      });
    }

    let evaluation;

    if (existingEvaluation) {
      console.log('📝 Updating existing evaluation');

      existingEvaluation.questionMarks       = questionMarks;
      existingEvaluation.totalMarksObtained  = totalMarksObtained;
      existingEvaluation.totalMarks          = totalMarks;
      existingEvaluation.percentage          = percentage;
      existingEvaluation.remarks             = remarks || '';
      existingEvaluation.isDraft             = isDraft;
      existingEvaluation.evaluationHash      = evaluationHash;

      if (!isDraft) {
        // ✅ FIX: use same evaluatedAt variable, not new Date()
        existingEvaluation.evaluatedAt = evaluatedAt;

        const blockchainTxHash = await commitEvaluationToBlockchain(
          test.blockchainExamId,
          submissionId,
          evaluationHash
        );

        existingEvaluation.blockchainTxHash    = blockchainTxHash;
        existingEvaluation.blockchainVerified  = true;

        submission.status = 'evaluated';
        await submission.save();
      }

      evaluation = await existingEvaluation.save();

    } else {
      console.log('✨ Creating new evaluation');

      const evaluationId = generateEvaluationId(submissionId, currentUser.userId);

      evaluation = new Evaluation({
        evaluationId,
        submissionId,
        testId:       submission.testId,
        teacherId:    currentUser.userId,
        teacherName:  teacher.name,
        questionMarks,
        totalMarksObtained,
        totalMarks,
        percentage,
        remarks:      remarks || '',
        isDraft,
        evaluatedAt,   // ✅ FIX: use same evaluatedAt variable, not new Date()
        evaluationHash,
        blockchainVerified: false,
      });

      if (!isDraft) {
        const blockchainTxHash = await commitEvaluationToBlockchain(
          test.blockchainExamId,
          submissionId,
          evaluationHash
        );

        evaluation.blockchainTxHash   = blockchainTxHash;
        evaluation.blockchainVerified = true;

        submission.status = 'evaluated';
        await submission.save();
      }

      await evaluation.save();
    }

    if (isDraft) {
      if (submission.status === 'uploaded') {
        submission.status = 'under_evaluation';
        await submission.save();
      }
    }

    if (questionTimings && questionTimings.length > 0) {
      let cumulativeTime = 0;

      for (const timing of questionTimings) {
        const questionMark = questionMarks.find(
          q => q.questionNumber === timing.questionNumber
        );
        if (!questionMark) continue;

        cumulativeTime += timing.timeSpent || 0;

        await logQuestionMarked({
          teacherId:      currentUser.userId,
          teacherName:    teacher.name,
          submissionId,
          testId:         submission.testId,
          studentId:      submission.studentId,
          evaluationId:   evaluation.evaluationId,
          department:     teacher.department,
          subject:        submission.subject,
          sessionId,
          questionNumber: timing.questionNumber,
          marksAwarded:   questionMark.marksObtained,
          maxMarks:       questionMark.maxMarks,
          comment:        questionMark.comment,
          timeSpent:      timing.timeSpent || 0,
          cumulativeTime,
          questionSequence: timing.sequenceOrder || 0,
        });
      }
    }

    if (!isDraft && sessionStartTime && sessionEndTime) {
      const questionMarksData = questionMarks.map((qm, index) => {
        const timing = questionTimings?.find(
          t => t.questionNumber === qm.questionNumber
        ) || {};

        return {
          questionNumber: qm.questionNumber,
          maxMarks:       qm.maxMarks,
          marksAwarded:   qm.marksObtained,
          comment:        qm.comment || '',
          timeSpent:      timing.timeSpent || 0,
          markedAt:       timing.markedAt ? new Date(timing.markedAt) : new Date(),
          sequenceOrder:  timing.sequenceOrder || index + 1,
        };
      });

      await logEvaluationComplete({
        evaluationId:     evaluation.evaluationId,
        submissionId,
        testId:           submission.testId,
        teacherId:        currentUser.userId,
        teacherName:      teacher.name,
        studentId:        submission.studentId,
        studentName:      submission.studentName,
        department:       teacher.department,
        subject:          submission.subject,
        year:             submission.year,
        division:         submission.division,
        academicYear:     test.academicYear,
        sessionId,
        sessionStartTime: new Date(sessionStartTime),
        sessionEndTime:   new Date(sessionEndTime),
        questionMarks:    questionMarksData,
        totalMarksAwarded: totalMarksObtained,
        totalMaxMarks:    totalMarks,
        isReevaluation:   false,
      });
    }

    console.log(`✅ Evaluation ${isDraft ? 'draft saved' : 'finalized'}:`, evaluation.evaluationId);

    return NextResponse.json(
      {
        success: true,
        message: isDraft ? 'Draft saved successfully' : 'Evaluation finalized successfully',
        data: {
          evaluation: {
            evaluationId:       evaluation.evaluationId,
            submissionId:       evaluation.submissionId,
            totalMarksObtained: evaluation.totalMarksObtained,
            totalMarks:         evaluation.totalMarks,
            percentage:         evaluation.percentage,
            isDraft:            evaluation.isDraft,
            evaluationHash:     evaluation.evaluationHash,
            questionMarks:      evaluation.questionMarks,
            remarks:            evaluation.remarks,
            blockchainTxHash:   evaluation.blockchainTxHash,
            blockchainVerified: evaluation.blockchainVerified,
          },
          sessionId,
        },
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Evaluate error:', error);
    console.error('   Stack:', error.stack);

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
