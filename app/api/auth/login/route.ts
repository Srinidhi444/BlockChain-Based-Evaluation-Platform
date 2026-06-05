import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { comparePassword, generateToken, createTokenCookie } from '@/lib/utils/auth';
import { validateRequestBody, loginSchema } from '@/lib/utils/validation';

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequestBody(request, loginSchema);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }
    
    const { userId, password } = validation.data;
    
    // Connect to database
    await connectDB();
    
    // Find user by userId
    const user = await User.findOne({ userId: userId.toUpperCase() });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Generate JWT token
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });
    
    // Remove password from user object
    const { password: _, ...safeUser } = user.toObject();
    
    // Create response with token in cookie
    const response = NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        data: {
          user: safeUser,
          token,
        },
      },
      { status: 200 }
    );
    
    // Set HTTP-only cookie
    response.headers.set('Set-Cookie', createTokenCookie(token));
    
    return response;
    
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
