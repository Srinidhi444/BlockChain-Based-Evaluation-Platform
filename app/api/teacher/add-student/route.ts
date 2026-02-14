import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { getUserFromHeaders, isTeacher } from '@/lib/utils/auth';
import { generateStudentId } from '@/lib/utils/idGenerator';
import { generateMemorablePassword } from '@/lib/utils/passwordGenerator';
import { sendStudentCredentials } from '@/lib/utils/email';
import bcrypt from 'bcryptjs';

interface AddStudentRequest {
  name: string;
  email: string;
  department: string;
  year: number;
  division: string;
  subjects?: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || !isTeacher(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only teachers can add students.' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body: AddStudentRequest = await request.json();
    const { name, email, department, year, division, subjects } = body;
    
    // Validate required fields
    if (!name || !email || !department || !year || !division) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['name', 'email', 'department', 'year', 'division']
        },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    // Validate year (must be 1-4)
    if (year < 1 || year > 4) {
      return NextResponse.json(
        { error: 'Year must be between 1 and 4' },
        { status: 400 }
      );
    }
    
    // Validate division format (single uppercase letter)
    if (!/^[A-Z]$/.test(division)) {
      return NextResponse.json(
        { error: 'Division must be a single uppercase letter (A-Z)' },
        { status: 400 }
      );
    }
    
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
    
    // Check if teacher belongs to same department
    if (teacher.department !== department) {
      return NextResponse.json(
        { error: 'You can only add students to your own department' },
        { status: 403 }
      );
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }
    
    // Generate student ID
    let userId = generateStudentId();
    
    // Check if userId already exists (very rare, but handle it)
    let existingUserId = await User.findOne({ userId });
    let attempts = 0;
    while (existingUserId && attempts < 5) {
      userId = generateStudentId();
      existingUserId = await User.findOne({ userId });
      attempts++;
      console.log('⚠️ Student ID collision, regenerated:', userId);
    }
    
    if (existingUserId) {
      return NextResponse.json(
        { error: 'Failed to generate unique student ID. Please try again.' },
        { status: 500 }
      );
    }
    
    // Generate random password
    const plainPassword = generateMemorablePassword();
    
    // Hash password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    
    // Prepare student subjects (use teacher's subjects or provided subjects)
    const studentSubjects = subjects && subjects.length > 0 
      ? subjects 
      : teacher.subjects;
    
    // Create student user
    const newStudent = await User.create({
      userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'student',
      department: department.trim(),
      year,
      division: division.toUpperCase(),
      subjects: studentSubjects,
    });
    
    console.log('✅ Student created:', userId);
    
    // Send credentials via email
    const emailResult = await sendStudentCredentials(
      email,
      name,
      userId,
      plainPassword,
      teacher.name
    );
    
    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: emailResult.message,
        data: {
          student: {
            userId: newStudent.userId,
            name: newStudent.name,
            email: newStudent.email,
            department: newStudent.department,
            year: newStudent.year,
            division: newStudent.division,
            subjects: newStudent.subjects,
          },
          credentials: {
            userId: userId,
            password: plainPassword, // Return in response for teacher to see
            emailSent: emailResult.success,
          },
        },
      },
      { status: 201 }
    );
    
  } catch (error: any) {
    console.error('❌ Add student error:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json(
        { error: `A user with this ${field} already exists` },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// GET method to fetch all students (for teacher to view)
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
    
    // Get teacher details
    const teacher = await User.findOne({ userId: currentUser.userId });
    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      );
    }
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const division = searchParams.get('division');
    
    // Build query
    const query: any = {
      role: 'student',
      department: teacher.department,
    };
    
    if (year) {
      query.year = parseInt(year);
    }
    
    if (division) {
      query.division = division.toUpperCase();
    }
    
    // Fetch students
    const students = await User.find(query)
      .select('-password -__v')
      .sort({ year: 1, division: 1, name: 1 });
    
    return NextResponse.json(
      {
        success: true,
        data: {
          students,
          count: students.length,
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('❌ Fetch students error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
