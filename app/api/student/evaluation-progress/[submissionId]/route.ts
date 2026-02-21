import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { getUserFromHeaders, isStudent } from '@/lib/utils/auth';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

const getModels = () => {
  const schema = () => new mongoose.Schema({}, { strict: false });

  const Submission  = mongoose.models.Submission
    || mongoose.model('Submission',  schema(), 'submissions');
  const Test        = mongoose.models.Test
    || mongoose.model('Test',        schema(), 'tests');
  const User        = mongoose.models.User
    || mongoose.model('User',        schema(), 'users');
  const AuditLog    = mongoose.models.AuditLog
    || mongoose.model('AuditLog',    schema(), 'audit_logs');
  const Evaluation  = mongoose.models.Evaluation
    || mongoose.model('Evaluation',  schema(), 'evaluations');
  const Grievance   = mongoose.models.Grievance
    || mongoose.model('Grievance',   schema(), 'grievances');
  const Reevaluation = mongoose.models.Reevaluation
    || mongoose.model('Reevaluation', schema(), 'reevaluations');

  return { Submission, Test, User, AuditLog, Evaluation, Grievance, Reevaluation };
};

interface TimelineEvent {
  id:              string;
  event:           string;
  timestamp:       string | null;
  label:           string;
  detail:          string;
  status:          'done' | 'in_progress' | 'pending';
  questionNumber?: number;
  timeSpent?:      number;
  marksAwarded?:   number;
  maxMarks?:       number;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> }
) {
  try {
    await connectDB();

    const { submissionId } = await context.params;

    if (!submissionId) {
      return NextResponse.json(
        { error: 'Submission ID is required' },
        { status: 400 }
      );
    }

    const currentUser = getUserFromHeaders(request.headers);
    if (!currentUser || !isStudent(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const {
      Submission, Test, User,
      AuditLog, Evaluation, Grievance, Reevaluation,
    } = getModels();

    // ── 1. Submission ─────────────────────────────────────
    const submission = await Submission.findOne(
      { submissionId }
    ).lean() as any;

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // ── 2. Evaluation ─────────────────────────────────────
    // Fields confirmed: teacherId, teacherName, questionMarks[],
    //   totalMarksObtained, totalMarks, isDraft, evaluatedAt
    const evaluation = await Evaluation.findOne(
      { submissionId }
    ).lean() as any;

    // ── 3. Test ───────────────────────────────────────────
    // Fields confirmed: title, subject, totalMarks, questions[]
    const testId = submission.testId || evaluation?.testId;
    const test   = testId
      ? await Test.findOne({ testId }).lean() as any
      : null;

    // questions[] length = actual question count
    const totalQuestions: number =
      test?.questions?.length        ||
      evaluation?.questionMarks?.length ||
      0;

    const maxMarks: number =
      test?.totalMarks               ||
      evaluation?.totalMarks         ||
      0;

    // ── 4. Teacher ────────────────────────────────────────
    // teacherName is directly on evaluation — use it as fallback
    // teacherId format is "TCH2026001" — matches userId field
    const teacherIdRaw =
      evaluation?.teacherId          ||
      submission.assignedTeacherId   ||
      submission.teacherId           ||
      null;

    const teacherNameFallback = evaluation?.teacherName || null;

    let teacher: any = null;
    if (teacherIdRaw) {
      try {
        teacher = await User.findOne(
          {
            $or: [
              { userId:    teacherIdRaw },
              { teacherId: teacherIdRaw },
            ],
          },
          { name: 1, userId: 1, department: 1, _id: 0 }
        ).lean();
      } catch {
        teacher = null;
      }
    }

    // ✅ Use teacherName directly from evaluation if User lookup fails
    const teacherDisplay = teacher
      ? { name: teacher.name, userId: teacher.userId, department: teacher.department || '' }
      : teacherNameFallback
      ? { name: teacherNameFallback, userId: teacherIdRaw || '', department: '' }
      : null;

    // ── 5. Audit Logs ─────────────────────────────────────
    const auditLogs = await AuditLog.find({ submissionId })
      .sort({ timestamp: 1 })
      .lean() as any[];

    // ── 6. Grievance ──────────────────────────────────────
    const grievance = await Grievance.findOne(
      { submissionId }
    ).lean() as any;

    // ── 7. Reevaluation ───────────────────────────────────
    let reevaluation: any = null;
    if (grievance?.grievanceId) {
      reevaluation = await Reevaluation.findOne(
        { grievanceId: grievance.grievanceId }
      ).lean();
    }

    // ── 8. Resolve completion ─────────────────────────────
    // DB has no status field — use isDraft===false + evaluatedAt
    const completedLog = auditLogs.find(
      (l) => l.eventType === 'evaluation_completed'
    );

    const isCompleted: boolean = !!(
      completedLog                                          ||
      (evaluation?.isDraft === false && evaluation?.evaluatedAt) ||
      (evaluation && totalQuestions > 0 &&
       evaluation.questionMarks?.length >= totalQuestions)
    );

    // ── 9. Build question maps ────────────────────────────
    // audit_logs → timing per question
    const auditQuestionMap = new Map<number, any>();
    for (const log of auditLogs) {
      if (log.eventType === 'question_marked' && log.questionNumber != null) {
        const qNum = Number(log.questionNumber);
        if (
          !auditQuestionMap.has(qNum) ||
          new Date(log.timestamp) > new Date(auditQuestionMap.get(qNum).timestamp)
        ) {
          auditQuestionMap.set(qNum, log);
        }
      }
    }

    // evaluations.questionMarks → marks per question
    // Confirmed field: marksObtained, maxMarks, questionNumber
    const evalQuestionMap = new Map<number, any>();
    if (evaluation?.questionMarks && Array.isArray(evaluation.questionMarks)) {
      evaluation.questionMarks.forEach((qm: any, index: number) => {
        const qNum = Number(qm.questionNumber ?? qm.questionNo ?? (index + 1));
        evalQuestionMap.set(qNum, qm);
      });
    }

    const resolvedTotal = Math.max(
      totalQuestions,
      auditQuestionMap.size,
      evalQuestionMap.size
    );

    const markedCount = Math.max(
      auditQuestionMap.size,
      evalQuestionMap.size
    );

    // ── 10. Build Timeline ────────────────────────────────
    const timeline: TimelineEvent[] = [];

    // Submitted
    const submittedAt =
      submission.uploadedAt  ||
      submission.submittedAt ||
      submission.createdAt;

    timeline.push({
      id:        'submitted',
      event:     'submitted',
      timestamp: submittedAt ? new Date(submittedAt).toISOString() : null,
      label:     'Answer sheet submitted',
      detail: [
        submission.originalFileName || submission.fileName || 'answer_sheet.pdf',
        submission.fileSize
          ? `${(submission.fileSize / (1024 * 1024)).toFixed(1)} MB`
          : null,
        test?.title ? `Test: ${test.title}` : null,
      ].filter(Boolean).join(' · '),
      status: 'done',
    });

    // Assigned
    const assignedLog = auditLogs.find(
      (l) => l.eventType === 'evaluation_assigned' || l.eventType === 'assigned'
    );
    const startedLog = auditLogs.find(
      (l) => l.eventType === 'evaluation_started'
    );

    if (teacherDisplay || assignedLog) {
      timeline.push({
        id:        'assigned',
        event:     'assigned',
        timestamp: assignedLog?.timestamp
          ? new Date(assignedLog.timestamp).toISOString()
          : startedLog?.timestamp
          ? new Date(startedLog.timestamp).toISOString()
          : null,
        label:  'Assigned to evaluator',
        detail: teacherDisplay
          ? `Evaluator: ${teacherDisplay.name}${
              teacherDisplay.department ? ` · ${teacherDisplay.department}` : ''
            }`
          : 'Evaluator assigned',
        status: 'done',
      });
    }

    // Evaluation Started
    if (startedLog) {
      timeline.push({
        id:        'evaluation_started',
        event:     'evaluation_started',
        timestamp: new Date(startedLog.timestamp).toISOString(),
        label:     'Evaluation started',
        detail:    teacherDisplay
          ? `${teacherDisplay.name} opened your answer sheet`
          : 'Evaluator opened your answer sheet',
        status:    'done',
      });
    } else if (evaluation) {
      timeline.push({
        id:        'evaluation_started',
        event:     'evaluation_started',
        timestamp: evaluation.createdAt
          ? new Date(evaluation.createdAt).toISOString()
          : null,
        label:  'Evaluation started',
        detail: teacherDisplay
          ? `${teacherDisplay.name} began evaluating your answer sheet`
          : 'Evaluator began evaluating your answer sheet',
        status: 'done',
      });
    }

    // Per-question events
    for (let q = 1; q <= resolvedTotal; q++) {
      const auditLog = auditQuestionMap.get(q);
      const evalMark = evalQuestionMap.get(q);
      const isMarked = !!(auditLog || evalMark);
      const isCurrentQ = q === markedCount + 1;

      if (isMarked) {
        // ✅ Confirmed field: marksObtained (not marksAwarded)
        const marksGiven: number | undefined =
          evalMark?.marksObtained != null
            ? Number(evalMark.marksObtained)
            : auditLog?.marksObtained != null
            ? Number(auditLog.marksObtained)
            : undefined;

        // ✅ Confirmed field: maxMarks
        const qMax: number | undefined =
          evalMark?.maxMarks != null
            ? Number(evalMark.maxMarks)
            : auditLog?.maxMarks != null
            ? Number(auditLog.maxMarks)
            : undefined;

        const timeSpent: number | undefined =
          auditLog?.timeSpent != null ? Number(auditLog.timeSpent)  :
          auditLog?.timeTaken != null ? Number(auditLog.timeTaken)  :
          auditLog?.duration  != null ? Number(auditLog.duration)   :
          undefined;

        const ts = auditLog?.timestamp ?? evalMark?.evaluatedAt ?? null;

        timeline.push({
          id:             `q_${q}`,
          event:          'question_marked',
          questionNumber: q,
          timestamp:      ts ? new Date(ts).toISOString() : null,
          timeSpent,
          marksAwarded:   marksGiven,   // modal uses marksAwarded field name
          maxMarks:       qMax,
          label:          `Question ${q} evaluated`,
          detail:         timeSpent != null ? `Time spent: ${timeSpent}s` : 'Marked',
          status:         'done',
        });

      } else if (isCurrentQ && !isCompleted) {
        timeline.push({
          id:             `q_${q}`,
          event:          'question_in_progress',
          questionNumber: q,
          timestamp:      null,
          label:          `Question ${q} — evaluating...`,
          detail:         'Currently under review',
          status:         'in_progress',
        });
      } else {
        timeline.push({
          id:             `q_${q}`,
          event:          'question_pending',
          questionNumber: q,
          timestamp:      null,
          label:          `Question ${q}`,
          detail:         'Waiting to be evaluated',
          status:         'pending',
        });
      }
    }

    // Evaluation Completed event
    if (isCompleted) {
      // ✅ Use totalMarksObtained directly — confirmed correct field
      const totalGiven: number | null =
        evaluation?.totalMarksObtained != null
          ? Number(evaluation.totalMarksObtained)
          : null;

      timeline.push({
        id:        'completed',
        event:     'evaluation_completed',
        timestamp: completedLog?.timestamp
          ? new Date(completedLog.timestamp).toISOString()
          : evaluation?.evaluatedAt
          ? new Date(evaluation.evaluatedAt).toISOString()
          : evaluation?.updatedAt
          ? new Date(evaluation.updatedAt).toISOString()
          : null,
        label:  'Evaluation complete',
        detail: totalGiven != null
          ? `Scored ${totalGiven}/${maxMarks} — result available`
          : 'Result is now available',
        status: 'done',
      });
    }

    // Grievance
    if (grievance) {
      timeline.push({
        id:        'grievance',
        event:     'grievance_filed',
        timestamp: grievance.filedAt || grievance.createdAt
          ? new Date(grievance.filedAt || grievance.createdAt).toISOString()
          : null,
        label:  'Grievance filed',
        detail: `Status: ${grievance.status || 'Pending'} · ${
          grievance.reason || 'Re-evaluation requested'
        }`,
        status: ['completed', 'resolved'].includes(grievance.status)
          ? 'done'
          : 'in_progress',
      });
    }

    // Reevaluation
    if (reevaluation) {
      timeline.push({
        id:        'reevaluation',
        event:     'reevaluation_completed',
        timestamp: reevaluation.completedAt || reevaluation.updatedAt
          ? new Date(
              reevaluation.completedAt || reevaluation.updatedAt
            ).toISOString()
          : null,
        label:  'Re-evaluation completed',
        detail: reevaluation.marksChange != null
          ? `Marks changed by ${reevaluation.marksChange > 0 ? '+' : ''}${reevaluation.marksChange}`
          : 'Re-evaluation done',
        status: 'done',
      });
    }

    // ── 11. Stage & progress ──────────────────────────────
    let currentStage:    string;
    let overallProgress: number;

    if (isCompleted) {
      currentStage    = 'completed';
      overallProgress = 100;
    } else if (startedLog || evaluation) {
      currentStage    = 'evaluating';
      overallProgress = resolvedTotal > 0
        ? Math.round(15 + (markedCount / resolvedTotal) * 70)
        : 50;
    } else if (teacherDisplay || assignedLog) {
      currentStage    = 'assigned';
      overallProgress = 15;
    } else {
      currentStage    = 'submitted';
      overallProgress = 5;
    }

    // ── 12. Final result marks ────────────────────────────
    // ✅ Use totalMarksObtained — confirmed correct field
    const resultTotalMarks: number | null = isCompleted && evaluation
      ? evaluation.totalMarksObtained != null
        ? Number(evaluation.totalMarksObtained)
        : null
      : null;

    // ── 13. Response ──────────────────────────────────────
    return NextResponse.json({
      submissionId,
      currentStage,
      overallProgress,
      submittedAt,

      test: {
        testId:         testId || submission.testId,
        title:          test?.title   || submission.testId || 'Unknown Test',
        subject:        test?.subject || '',
        totalQuestions: resolvedTotal,
        maxMarks,
      },

      teacher: teacherDisplay,

      progress: {
        questionsMarked: markedCount,
        totalQuestions:  resolvedTotal,
        percentage:      resolvedTotal > 0
          ? Math.round((markedCount / resolvedTotal) * 100)
          : 0,
      },

      timeline,

      result: isCompleted
        ? {
            available:   true,
            totalMarks:  resultTotalMarks,
            maxMarks,
            percentage:  maxMarks > 0 && resultTotalMarks != null
              ? Math.round((resultTotalMarks / maxMarks) * 100)
              : null,
            evaluatedAt: evaluation?.evaluatedAt
              || evaluation?.updatedAt
              || null,
          }
        : { available: false },

      grievance: grievance
        ? { filed: true,  status: grievance.status, reason: grievance.reason }
        : { filed: false },

      lastUpdated: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Evaluation progress error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluation progress', detail: error.message },
      { status: 500 }
    );
  }
}
