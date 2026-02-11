import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import Submission from '@/lib/db/models/Submission';
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
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // e.g., "uploaded,under_evaluation"
    const subject = searchParams.get('subject');
    const year = searchParams.get('year');
    const division = searchParams.get('division');
    const limit = parseInt(searchParams.get('limit') || '100');
    
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
    
    // Build query
    const query: any = {
      department: teacher.department,
      subject: { $in: teacher.subjects }
    };
    
    // Add filters
    if (status) {
      const statuses = status.split(',');
      query.status = { $in: statuses };
    }
    
    if (subject) {
      query.subject = subject;
    }
    
    if (year) {
      query.year = parseInt(year);
    }
    
    if (division) {
      query.division = division;
    }
    
    // Fetch submissions
    const submissions = await Submission.find(query)
      .sort({ uploadedAt: 1 }) // Oldest first for evaluation queue
      .limit(limit);
    
    return NextResponse.json(
      {
        success: true,
        data: {
          submissions,
          total: submissions.length,
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('Fetch submissions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
