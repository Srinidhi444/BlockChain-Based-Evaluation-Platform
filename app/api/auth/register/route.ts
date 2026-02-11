import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { hashPassword, generateToken, createTokenCookie } from '@/lib/utils/auth';
import { validateRequestBody, registerSchema } from '@/lib/utils/validation';

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequestBody(request, registerSchema);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }
    
    const data = validation.data;
    
    // Connect to database
    await connectDB();
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { userId: data.userId.toUpperCase() },
        { email: data.email.toLowerCase() }
      ]
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this ID or email already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const hashedPassword = await hashPassword(data.password);
    
    // Create new user
    const user = await User.create({
      userId: data.userId.toUpperCase(),
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: data.role,
      department: data.department,
      year: data.year,
      division: data.division?.toUpperCase(),
      subjects: data.subjects,
    });
    
    // Generate JWT token
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });
    
    // Remove password from user object
    const safeUser = user.toSafeObject();
    
    // Create response
    const response = NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        data: {
          user: safeUser,
          token,
        },
      },
      { status: 201 }
    );
    
    // Set HTTP-only cookie
    response.headers.set('Set-Cookie', createTokenCookie(token));
    
    return response;
    
  } catch (error: any) {
    console.error('Registration error:', error);
    
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
