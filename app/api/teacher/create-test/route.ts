import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import Test from '@/lib/db/models/Test';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';
import { validateRequestBody, createTestSchema } from '@/lib/utils/validation';
import { generateTestId } from '@/lib/utils/idGenerator';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only teachers can create tests.' },
        { status: 401 }
      );
    }
    
    // Validate request body
    const validation = await validateRequestBody(request, createTestSchema);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }
    
    const data = validation.data;
    
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
    
    // Verify teacher can create test for this subject
    if (!teacher.subjects.includes(data.subject)) {
      return NextResponse.json(
        { error: `You are not authorized to create tests for ${data.subject}` },
        { status: 403 }
      );
    }
    
    // Generate test ID
    const testId = generateTestId(data.department, data.year);
    
    // Create test
    const test = await Test.create({
      testId,
      title: data.title,
      subject: data.subject,
      department: data.department,
      year: data.year,
      division: data.division,
      totalMarks: data.totalMarks,
      questions: data.questions,
      uploadedBy: currentUser.userId,
      academicYear: data.academicYear,
      examType: data.examType,
      examDate: new Date(data.examDate),
    });
    
    return NextResponse.json(
      {
        success: true,
        message: 'Test created successfully',
        data: {
          test: {
            testId: test.testId,
            title: test.title,
            subject: test.subject,
            department: test.department,
            year: test.year,
            division: test.division,
            totalMarks: test.totalMarks,
            questionsCount: test.questions.length,
            examDate: test.examDate,
          },
        },
      },
      { status: 201 }
    );
    
  } catch (error: any) {
    console.error('Create test error:', error);
    
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
