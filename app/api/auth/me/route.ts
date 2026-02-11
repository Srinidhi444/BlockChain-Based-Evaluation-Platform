import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { getUserFromHeaders } from '@/lib/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Get user from token
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Connect to database
    await connectDB();
    
    // Fetch full user details
    const user = await User.findOne({ userId: currentUser.userId }).select('-password');
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: true,
        data: { user },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
