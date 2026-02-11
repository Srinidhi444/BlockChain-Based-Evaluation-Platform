import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Test from '@/lib/db/models/Test';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Connect to database
    await connectDB();
    
    // Get all tests created by this teacher
    const tests = await Test.findByTeacher(currentUser.userId);
    
    return NextResponse.json(
      {
        success: true,
        data: {
          tests,
          total: tests.length,
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('Fetch tests error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
