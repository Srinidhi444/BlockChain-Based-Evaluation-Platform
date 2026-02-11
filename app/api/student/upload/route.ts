import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import Test from '@/lib/db/models/Test';
import Submission from '@/lib/db/models/Submission';
import { getUserFromHeaders, isStudent } from '@/lib/utils/auth';
import { generateSubmissionId } from '@/lib/utils/idGenerator';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    try {
        console.log('=== UPLOAD REQUEST START ===');

        // Authenticate user
        const currentUser = getUserFromHeaders(request.headers);

        if (!currentUser || !isStudent(currentUser)) {
            console.log('❌ Unauthorized user');
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log('✅ User authenticated:', currentUser.userId);

        // Parse form data
        let formData;
        try {
            formData = await request.formData();
        } catch (err: any) {
            console.error('❌ FormData parsing error:', err);
            return NextResponse.json(
                { error: 'Invalid form data', message: err.message },
                { status: 400 }
            );
        }

        const testId = formData.get('testId') as string;
        const file = formData.get('answerSheet') as File;

        console.log('📋 Form data:', {
            testId,
            fileName: file?.name,
            fileType: file?.type,
            fileSize: file?.size
        });

        // Validate inputs
        if (!testId) {
            return NextResponse.json(
                { error: 'Test ID is required' },
                { status: 400 }
            );
        }

        if (!file) {
            return NextResponse.json(
                { error: 'Answer sheet file is required' },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: `Invalid file type: ${file.type}. Only PDF, JPEG, and PNG are allowed` },
                { status: 400 }
            );
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit` },
                { status: 400 }
            );
        }

        // Connect to database
        console.log('🔌 Connecting to database...');
        await connectDB();
        console.log('✅ Database connected');

        // Get student details
        const student = await User.findOne({ userId: currentUser.userId });
        if (!student) {
            return NextResponse.json(
                { error: 'Student not found' },
                { status: 404 }
            );
        }
        console.log('✅ Student found:', student.name);

        // Get test details
        const test = await Test.findOne({ testId });
        if (!test) {
            return NextResponse.json(
                { error: 'Test not found' },
                { status: 404 }
            );
        }
        console.log('✅ Test found:', test.title);

        // Check if student can access this test
        if (test.department !== student.department || test.year !== student.year) {
            return NextResponse.json(
                { error: 'You are not authorized to submit for this test' },
                { status: 403 }
            );
        }

        if (test.division !== 'ALL' && test.division !== student.division) {
            return NextResponse.json(
                { error: 'This test is not for your division' },
                { status: 403 }
            );
        }

        // Check if student already submitted
        const existingSubmission = await Submission.findOne({
            studentId: currentUser.userId,
            testId,
        });

        if (existingSubmission) {
            return NextResponse.json(
                { error: 'You have already submitted for this test' },
                { status: 400 }
            );
        }

        // Convert file to buffer
        console.log('📄 Processing file...');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate file hash
        const fileHash = crypto
            .createHash('sha256')
            .update(buffer)
            .digest('hex');

        console.log('🔐 File hash generated:', fileHash.substring(0, 16) + '...');

        // Generate submission ID
        const submissionId = generateSubmissionId(currentUser.userId, testId);
        console.log('🆔 Submission ID:', submissionId);

        // Store file as base64
        const fileBase64 = buffer.toString('base64');
        const fileUrl = `data:${file.type};base64,${fileBase64}`;

        // Create submission
        // Create submission
        console.log('💾 Creating submission...');
        const submission = await Submission.create({
            submissionId,
            testId,
            studentId: currentUser.userId,
            studentName: student.name,
            department: student.department,
            year: student.year,
            division: student.division,
            subject: test.subject,
            answerSheetUrl: fileUrl,
            fileHash,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            uploadedAt: new Date(),
            status: 'uploaded',
            totalMarks: test.totalMarks,
        });


        console.log('✅ Submission created successfully!');
        console.log('=== UPLOAD REQUEST END ===');

        return NextResponse.json(
            {
                success: true,
                message: 'Answer sheet uploaded successfully',
                data: {
                    submission: {
                        submissionId: submission.submissionId,
                        testId: submission.testId,
                        status: submission.status,
                        uploadedAt: submission.uploadedAt,
                        fileHash: fileHash.substring(0, 16) + '...', // Show partial hash
                    },
                },
            },
            { status: 201 }
        );

    } catch (error: any) {
        console.error('=== UPLOAD ERROR ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('===================');

        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
