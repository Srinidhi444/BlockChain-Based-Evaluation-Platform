import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { getUserFromHeaders, isAdmin } from '@/lib/utils/auth';
import { generateStudentId } from '@/lib/utils/idGenerator';
import { generateMemorablePassword } from '@/lib/utils/passwordGenerator';
import { sendStudentCredentials } from '@/lib/utils/email';
import bcrypt from 'bcryptjs';

interface StudentRow {
  name: string;
  email: string;
  department: string;
  year: number;
  division: string;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getUserFromHeaders(request.headers);

    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins can bulk-import students.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { students }: { students: StudentRow[] } = body;

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: 'No students provided. Send a non-empty "students" array.' },
        { status: 400 }
      );
    }

    if (students.length > 500) {
      return NextResponse.json(
        { error: 'Maximum 500 students can be imported at once.' },
        { status: 400 }
      );
    }

    await connectDB();

    const results: {
      row: number;
      success: boolean;
      skipped?: boolean;
      name?: string;
      email?: string;
      userId?: string;
      password?: string;
      emailSent?: boolean;
      error?: string;
    }[] = [];

    for (let i = 0; i < students.length; i++) {
      const { name, email, department, year, division } = students[i];

      // Validate required fields
      if (!name || !email || !department || !year || !division) {
        results.push({ row: i + 1, success: false, name, email, error: 'Missing required fields (name, email, department, year, division)' });
        continue;
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        results.push({ row: i + 1, success: false, name, email, error: 'Invalid email format' });
        continue;
      }

      // Validate year
      const yearNum = Number(year);
      if (isNaN(yearNum) || yearNum < 1 || yearNum > 4) {
        results.push({ row: i + 1, success: false, name, email, error: 'Year must be between 1 and 4' });
        continue;
      }

      // Validate division
      const divUpper = String(division).toUpperCase().trim();
      if (!/^[A-Z]$/.test(divUpper)) {
        results.push({ row: i + 1, success: false, name, email, error: 'Division must be a single letter (A-Z)' });
        continue;
      }

      // Check email uniqueness
      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        results.push({ row: i + 1, success: false, skipped: true, name, email, error: 'Email already exists' });
        continue;
      }

      // Generate unique student ID
      let userId = generateStudentId();
      let existingId = await User.findOne({ userId });
      let attempts = 0;
      while (existingId && attempts < 5) {
        userId = generateStudentId();
        existingId = await User.findOne({ userId });
        attempts++;
      }
      if (existingId) {
        results.push({ row: i + 1, success: false, name, email, error: 'Failed to generate unique student ID' });
        continue;
      }

      // Generate password and hash it
      const plainPassword = generateMemorablePassword();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);

      // Create student
      try {
        await User.create({
          userId,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: 'student',
          department: department.trim(),
          year: yearNum,
          division: divUpper,
          subjects: [],
        });
      } catch (createErr: any) {
        results.push({ row: i + 1, success: false, name, email, error: createErr.message || 'DB error' });
        continue;
      }

      // Send credentials email
      const emailResult = await sendStudentCredentials(
        email.toLowerCase().trim(),
        name.trim(),
        userId,
        plainPassword,
        'Admin'
      );

      results.push({
        row: i + 1,
        success: true,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        userId,
        password: plainPassword,
        emailSent: emailResult.success,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const skipCount    = results.filter(r => r.skipped).length;
    const failCount    = results.filter(r => !r.success && !r.skipped).length;

    return NextResponse.json(
      {
        success: true,
        message: `Import complete. ${successCount} created, ${skipCount} skipped, ${failCount} failed.`,
        data: { results, successCount, skipCount, failCount },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ Bulk import error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
