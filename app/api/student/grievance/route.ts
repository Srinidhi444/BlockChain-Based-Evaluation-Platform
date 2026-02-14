import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Grievance from '@/lib/db/models/Grievance';
import Submission from '@/lib/db/models/Submission';
import Evaluation from '@/lib/db/models/Evaluation';
import User from '@/lib/db/models/User';
import Test from '@/lib/db/models/Test';
import { getUserFromHeaders } from '@/lib/utils/auth';
import { logAuditEvent } from '@/lib/utils/auditLogger';
import { AuditEventType } from '@/lib/db/models/AuditLog';

interface FileGrievanceRequest {
    submissionId: string;
    grievanceType: 'calculation_error' | 'reevaluation';
    questionNumber?: number;
    explanation: string;
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate user
        const currentUser = getUserFromHeaders(request.headers);

        if (!currentUser || currentUser.role !== 'student') {
            return NextResponse.json(
                { error: 'Unauthorized. Only students can file grievances.' },
                { status: 401 }
            );
        }

        // Parse request body
        const body: FileGrievanceRequest = await request.json();
        const { submissionId, grievanceType, questionNumber, explanation } = body;

        // Validate required fields
        if (!submissionId || !grievanceType || !explanation) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    required: ['submissionId', 'grievanceType', 'explanation']
                },
                { status: 400 }
            );
        }

        // Validate grievance type
        if (!['calculation_error', 'reevaluation'].includes(grievanceType)) {
            return NextResponse.json(
                { error: 'Invalid grievance type. Must be "calculation_error" or "reevaluation"' },
                { status: 400 }
            );
        }

        // Validate explanation length
        if (explanation.length < 20 || explanation.length > 1000) {
            return NextResponse.json(
                { error: 'Explanation must be between 20 and 1000 characters' },
                { status: 400 }
            );
        }

        // Connect to database
        await connectDB();

        // Find submission
        const submission = await Submission.findOne({ submissionId });

        if (!submission) {
            return NextResponse.json(
                { error: 'Submission not found' },
                { status: 404 }
            );
        }

        // Verify submission belongs to current student
        if (submission.studentId !== currentUser.userId) {
            return NextResponse.json(
                { error: 'You can only file grievance for your own submissions' },
                { status: 403 }
            );
        }

        // Check if submission is evaluated
        if (submission.status !== 'evaluated' && submission.status !== 'published') {
            return NextResponse.json(
                { error: 'Can only file grievance for evaluated submissions' },
                { status: 400 }
            );
        }

        // Find original evaluation
        const originalEvaluation = await Evaluation.findOne({ submissionId, isDraft: false });

        if (!originalEvaluation) {
            return NextResponse.json(
                { error: 'Evaluation not found for this submission' },
                { status: 404 }
            );
        }

        // Check for existing active grievance
        const existingGrievance = await Grievance.findOne({
            submissionId,
            status: { $in: ['pending', 'in_progress'] }
        });

        if (existingGrievance) {
            return NextResponse.json(
                { error: 'An active grievance already exists for this submission' },
                { status: 409 }
            );
        }

        // Validate question number if provided
        if (questionNumber) {
            const question = originalEvaluation.questionMarks.find(
                q => q.questionNumber === questionNumber
            );

            if (!question) {
                return NextResponse.json(
                    { error: `Question ${questionNumber} not found in this evaluation` },
                    { status: 400 }
                );
            }
        }

        // Get test details
        const test = await Test.findOne({ testId: submission.testId });

        if (!test) {
            return NextResponse.json(
                { error: 'Test not found' },
                { status: 404 }
            );
        }

        // Get current student details for name
        const currentStudent = await User.findOne({ userId: currentUser.userId });

        if (!currentStudent) {
            return NextResponse.json(
                { error: 'Student user not found' },
                { status: 404 }
            );
        }

        // Determine assigned teacher based on grievance type
        let assignedTeacherId: string;
        let assignedTeacherName: string;

        if (grievanceType === 'calculation_error') {
            // Same teacher
            assignedTeacherId = originalEvaluation.teacherId;
            assignedTeacherName = originalEvaluation.teacherName;
        } else {
            // Find different teacher with same subject
            const otherTeachers = await User.find({
                role: 'teacher',
                department: submission.department,
                subjects: submission.subject,
                userId: { $ne: originalEvaluation.teacherId }, // Exclude original teacher
            });

            if (otherTeachers.length === 0) {
                return NextResponse.json(
                    {
                        error: 'No other teacher available for re-evaluation. Please contact admin.',
                        detail: 'Re-evaluation requires a different teacher, but no other qualified teacher found.'
                    },
                    { status: 400 }
                );
            }

            // Assign to first available teacher (can be improved with load balancing)
            assignedTeacherId = otherTeachers[0].userId;
            assignedTeacherName = otherTeachers[0].name;
        }

        // Generate grievance ID
        const timestamp = Date.now();
        const grievanceId = `GRV_${submissionId.toUpperCase()}_${timestamp}`;

        // Get device info and IP for audit
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const deviceInfo = userAgent.substring(0, 200);
        const ipAddress = request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || 
                         'Unknown';

        // Create grievance
        const grievance = await Grievance.create({
            grievanceId,
            submissionId,
            testId: submission.testId,
            studentId: currentUser.userId,
            studentName: currentStudent.name,
            grievanceType,
            questionNumber: questionNumber || undefined,
            explanation: explanation.trim(),
            originalTeacherId: originalEvaluation.teacherId,
            assignedTeacherId,
            status: 'pending',
            originalEvaluationId: originalEvaluation.evaluationId,
            filedAt: new Date(),
        });

        console.log('✅ Grievance filed:', grievanceId);
        console.log('   Type:', grievanceType);
        console.log('   Student:', currentStudent.name);
        console.log('   Assigned to:', assignedTeacherId);

        // 📊 AUDIT: Log grievance filing
        await logAuditEvent({
            eventType: AuditEventType.GRIEVANCE_FILED,
            userId: currentUser.userId,
            userRole: 'student',
            userName: currentStudent.name,
            department: currentStudent.department,
            submissionId,
            testId: submission.testId,
            evaluationId: originalEvaluation.evaluationId,
            grievanceId,
            grievanceType,
            questionNumber: questionNumber || null,
            originalTeacherId: originalEvaluation.teacherId,
            assignedTeacherId,
            subject: submission.subject,
            year: submission.year,
            division: submission.division,
            academicYear: test.academicYear,
            deviceInfo,
            ipAddress,
            metadata: {
                originalMarks: originalEvaluation.totalMarksObtained,
                originalPercentage: originalEvaluation.percentage,
                explanationLength: explanation.length,
            },
        });

        return NextResponse.json(
            {
                success: true,
                message: 'Grievance filed successfully. You will be notified once it is reviewed.',
                data: {
                    grievance: {
                        grievanceId: grievance.grievanceId,
                        submissionId: grievance.submissionId,
                        grievanceType: grievance.grievanceType,
                        status: grievance.status,
                        filedAt: grievance.filedAt,
                        assignedTeacherId: grievance.assignedTeacherId,
                    },
                },
            },
            { status: 201 }
        );

    } catch (error: any) {
        console.error('❌ File grievance error:', error);

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
            return NextResponse.json(
                { error: 'A grievance already exists for this submission' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}

// GET - Fetch student's grievances
export async function GET(request: NextRequest) {
    try {
        // Authenticate user
        const currentUser = getUserFromHeaders(request.headers);

        if (!currentUser || currentUser.role !== 'student') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Connect to database
        await connectDB();

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const submissionId = searchParams.get('submissionId');

        // Build query
        const query: any = { studentId: currentUser.userId };

        if (status) {
            query.status = status;
        }

        if (submissionId) {
            query.submissionId = submissionId;
        }

        // Fetch grievances
        const grievances = await Grievance.find(query).sort({ filedAt: -1 });

        // 📊 AUDIT: Log grievance list access (optional, only if you want to track)
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const deviceInfo = userAgent.substring(0, 200);
        const ipAddress = request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || 
                         'Unknown';

        await logAuditEvent({
            eventType: AuditEventType.GRIEVANCE_LIST_ACCESSED,
            userId: currentUser.userId,
            userRole: 'student',
            deviceInfo,
            ipAddress,
            metadata: {
                filters: {
                    status,
                    submissionId,
                },
                resultCount: grievances.length,
            },
        });

        // If requesting single submission's grievance, return single object
        if (submissionId && grievances.length > 0) {
            return NextResponse.json(
                {
                    success: true,
                    data: {
                        grievance: grievances[0],
                    },
                },
                { status: 200 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                data: {
                    grievances,
                    count: grievances.length,
                },
            },
            { status: 200 }
        );

    } catch (error: any) {
        console.error('❌ Fetch grievances error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}
