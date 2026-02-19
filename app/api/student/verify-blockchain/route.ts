import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Evaluation from '@/lib/db/models/Evaluation';
import Submission from '@/lib/db/models/Submission';
import Test from '@/lib/db/models/Test';
import { verifyEvaluationOnBlockchain } from '@/lib/utils/hash';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get('submissionId');

    if (!submissionId) {
      return NextResponse.json(
        { error: 'submissionId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // 1) Get submission → to get testId
    const submission = await Submission.findOne({ submissionId });
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // 2) Get evaluation
    const evaluation = await Evaluation.findOne({ submissionId });
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    // 3) Get test → to get blockchainExamId
    const test = await Test.findOne({ testId: submission.testId });
    if (!test || !test.blockchainExamId) {
      return NextResponse.json({
        status: 'not_found',
        message: 'No blockchain exam ID found for this test',
      });
    }

    // 4) Build evaluationData exactly as it was at commit time
    const evaluationData = {
      submissionId,
      teacherId:          evaluation.teacherId,
      questionMarks:      evaluation.questionMarks.map((q: any) => ({
        questionNumber: q.questionNumber,
        marksObtained:  q.marksObtained,
      })),
      totalMarksObtained: evaluation.totalMarksObtained,
      evaluatedAt:        new Date(evaluation.evaluatedAt),
    };

    // 5) Verify on blockchain
    const result = await verifyEvaluationOnBlockchain({
      blockchainExamId: test.blockchainExamId,
      submissionId,
      evaluationData,
    });

    return NextResponse.json({
      status:                result.status,
      recomputedHash:        result.recomputedHash,
      onChainEvaluationHash: result.onChainEvaluationHash,
    });

  } catch (err: any) {
    console.error('Blockchain verify error:', err);
    return NextResponse.json(
      { status: 'error', message: err.message },
      { status: 500 }
    );
  }
}
