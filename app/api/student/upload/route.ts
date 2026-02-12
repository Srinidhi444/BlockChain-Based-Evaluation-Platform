import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import Test from '@/lib/db/models/Test';
import Submission from '@/lib/db/models/Submission';
import { getUserFromHeaders, isStudent } from '@/lib/utils/auth';
import { generateSubmissionId } from '@/lib/utils/idGenerator';
import { commitSubmissionToBlockchain } from '@/lib/blockchain/examContract';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const currentUser = getUserFromHeaders(request.headers);

    if (!currentUser || !isStudent(currentUser)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const testId = formData.get('testId') as string;
    const file = formData.get('answerSheet') as File;

    if (!testId || !file) {
      return NextResponse.json(
        { error: 'Test ID and answer sheet are required' },
        { status: 400 }
      );
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File exceeds 10MB limit' },
        { status: 400 }
      );
    }

    await connectDB();

    const student = await User.findOne({ userId: currentUser.userId });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const test = await Test.findOne({ testId });
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (
      test.department !== student.department ||
      test.year !== student.year ||
      (test.division !== 'ALL' && test.division !== student.division)
    ) {
      return NextResponse.json(
        { error: 'Not authorized for this test' },
        { status: 403 }
      );
    }

    const existing = await Submission.findOne({
      studentId: currentUser.userId,
      testId
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Already submitted for this test' },
        { status: 400 }
      );
    }

    // File → Buffer
    // File → Buffer
const buffer = Buffer.from(await file.arrayBuffer());

const fileHash = crypto
  .createHash('sha256')
  .update(buffer)
  .digest('hex');

const submissionId = generateSubmissionId(
  currentUser.userId,
  testId,
  Date.now()
);

// TODO: Replace this with S3 / Cloud storage in production
const fileBase64 = buffer.toString('base64');
const fileUrl = `data:${file.type};base64,${fileBase64}`;

// 1️⃣ Commit to blockchain FIRST
const txHash = await commitSubmissionToBlockchain(
  test.blockchainExamId,
  submissionId,
  fileHash
);

// 2️⃣ Only if blockchain succeeds → save to DB
const submission = await Submission.create({
  submissionId,
  blockchainExamId: test.blockchainExamId,
  testId,
  studentId: currentUser.userId,
  department: student.department,
  year: student.year,
  division: student.division,
  subject: test.subject,
  answerSheetUrl: fileUrl,
  fileHash,
  fileName: file.name,
  fileType: file.type,
  fileSize: file.size,
  blockchainTxHash: txHash,
  status: 'uploaded'
});


    return NextResponse.json(
      {
        success: true,
        message: 'Submission uploaded and recorded on blockchain',
        data: {
          submissionId,
          blockchainExamId: test.blockchainExamId,
          blockchainTxHash: txHash,
          fileHash
        }
      },
      { status: 201 }
    );

  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}
