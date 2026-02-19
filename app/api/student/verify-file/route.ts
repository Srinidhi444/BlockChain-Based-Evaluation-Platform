// /api/verify/file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Submission from '@/lib/db/models/Submission';
import Test from '@/lib/db/models/Test';
import { verifyFileHashOnBlockchain } from '@/lib/utils/hash';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const submissionId = formData.get('submissionId') as string;
    const file = formData.get('file') as File;

    if (!submissionId || !file) {
      return NextResponse.json(
        { error: 'submissionId and file are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const submission = await Submission.findOne({ submissionId });
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const test = await Test.findOne({ testId: submission.testId });
    if (!test || !test.blockchainExamId) {
      return NextResponse.json({
        status: 'not_found',
        message: 'No blockchain exam ID found for this test',
      });
    }

    // Convert file to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // ✅ Verify file hash on blockchain with 0x normalization
    const result = await verifyFileHashOnBlockchain({
      blockchainExamId: test.blockchainExamId,
      submissionId,
      fileBuffer,
    });

    return NextResponse.json({
      status:          result.status,
      recomputedHash:  result.recomputedHash,
      onChainFileHash: result.onChainFileHash,
    });

  } catch (err: any) {
    console.error('File hash verify error:', err);
    return NextResponse.json(
      { status: 'error', message: err.message },
      { status: 500 }
    );
  }
}
