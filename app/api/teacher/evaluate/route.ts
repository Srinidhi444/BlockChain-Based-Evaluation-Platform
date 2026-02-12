import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import Submission from '@/lib/db/models/Submission';
import Test from '@/lib/db/models/Test';
import Evaluation from '@/lib/db/models/Evaluation';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';
import { validateRequestBody, createEvaluationSchema } from '@/lib/utils/validation';
import { generateEvaluationId } from '@/lib/utils/idGenerator';
import { generateEvaluationHash } from '@/lib/utils/hash';
import { commitEvaluationToBlockchain } from '@/lib/blockchain/examContract' ;

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only teachers can evaluate submissions.' },
        { status: 401 }
      );
    }
    
    // Validate request body
    const validation = await validateRequestBody(request, createEvaluationSchema);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }
    
    const { submissionId, questionMarks, remarks, isDraft } = validation.data;
    
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
  
    
    // Find submission
    const submission = await Submission.findOne({ submissionId });
    console.log("this is the db submission id ",submission);
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }
    
    // Verify teacher can evaluate this submission
    if (
      submission.department !== teacher.department ||
      !teacher.subjects.includes(submission.subject)
    ) {
      return NextResponse.json(
        { error: 'You are not authorized to evaluate this submission' },
        { status: 403 }
      );
    }
    
    // Check if submission is already finalized
    const existingFinalizedEvaluation = await Evaluation.findOne({ 
      submissionId, 
      isDraft: false 
    });
    
    if (existingFinalizedEvaluation) {
      return NextResponse.json(
        { error: 'This submission has already been finalized and cannot be modified' },
        { status: 409 }
      );
    }
    
    // Find associated test
    const test = await Test.findOne({ testId: submission.testId });
    
    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }
    
    // Calculate totals
    const totalMarksObtained = questionMarks.reduce(
      (sum, q) => sum + (q.marksObtained || 0), 
      0
    );
    const totalMarks = questionMarks.reduce(
      (sum, q) => sum + q.maxMarks, 
      0
    );
    const percentage = totalMarks > 0 ? (totalMarksObtained / totalMarks) * 100 : 0;
    
    // Verify total marks match test
    if (totalMarks !== test.totalMarks) {
      return NextResponse.json(
        { error: `Total marks (${totalMarks}) do not match test configuration (${test.totalMarks})` },
        { status: 400 }
      );
    }
    
    // Generate evaluation hash
    const evaluationData = {
      submissionId,
      teacherId: currentUser.userId,
      questionMarks: questionMarks.map(q => ({
        questionNumber: q.questionNumber,
        marksObtained: q.marksObtained
      })),
      totalMarksObtained,
      evaluatedAt: isDraft ? null : new Date()
    };
    const evaluationHash = generateEvaluationHash(evaluationData);
    
    // Check if draft exists (look for any evaluation - draft or not)
    const existingEvaluation = await Evaluation.findOne({ submissionId });
    
    let evaluation;
    
    if (existingEvaluation) {

  // Update existing evaluation
  existingEvaluation.questionMarks = questionMarks;
  existingEvaluation.totalMarksObtained = totalMarksObtained;
  existingEvaluation.totalMarks = totalMarks;
  existingEvaluation.percentage = percentage;
  existingEvaluation.remarks = remarks || '';
  existingEvaluation.isDraft = isDraft;
  existingEvaluation.evaluationHash = evaluationHash;

  if (!isDraft) {
    existingEvaluation.evaluatedAt = new Date();

    // 🔐 Commit to blockchain FIRST
    const blockchainTxHash = await commitEvaluationToBlockchain(
      test.blockchainExamId,
      submissionId,
      evaluationHash
    );

    existingEvaluation.blockchainTxHash = blockchainTxHash;
    existingEvaluation.blockchainVerified = true;

    submission.status = 'evaluated';
    await submission.save();
  }

  evaluation = await existingEvaluation.save();

} else {

  const evaluationId = generateEvaluationId(submissionId, currentUser.userId);

  evaluation = new Evaluation({
    evaluationId,
    submissionId,
    testId: submission.testId,
    teacherId: currentUser.userId,
    teacherName: teacher.name,
    questionMarks,
    totalMarksObtained,
    totalMarks,
    percentage,
    remarks: remarks || '',
    isDraft,
    evaluatedAt: isDraft ? null : new Date(),
    evaluationHash,
    blockchainVerified: false,
  });

  if (!isDraft) {

    // 🔐 Commit to blockchain FIRST
    const blockchainTxHash = await commitEvaluationToBlockchain(
      test.blockchainExamId,
      submissionId,
      evaluationHash
    );

    evaluation.blockchainTxHash = blockchainTxHash;
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

    
    return NextResponse.json(
      {
        success: true,
        message: isDraft ? 'Draft saved successfully' : 'Evaluation finalized successfully',
        data: {
          evaluation: {
            evaluationId: evaluation.evaluationId,
            submissionId: evaluation.submissionId,
            totalMarksObtained: evaluation.totalMarksObtained,
            totalMarks: evaluation.totalMarks,
            percentage: evaluation.percentage,
            isDraft: evaluation.isDraft,
            evaluationHash: evaluation.evaluationHash,
            questionMarks: evaluation.questionMarks,
            remarks: evaluation.remarks,
          },
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('❌ Evaluate error:', error);
    
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
