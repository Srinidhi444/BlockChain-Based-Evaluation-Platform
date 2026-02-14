import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import AuditLog, { AuditEventType } from '@/lib/db/models/AuditLog';
import { getUserFromHeaders } from '@/lib/utils/auth';

/**
 * GET /api/admin/audit-logs
 * Fetch audit logs with advanced filtering and pagination
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    
    // Filtering parameters
    const eventType = searchParams.get('eventType');
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('userRole');
    const department = searchParams.get('department');
    const subject = searchParams.get('subject');
    const submissionId = searchParams.get('submissionId');
    const testId = searchParams.get('testId');
    const studentId = searchParams.get('studentId');
    const evaluationId = searchParams.get('evaluationId');
    const grievanceId = searchParams.get('grievanceId');
    const sessionId = searchParams.get('sessionId');
    const flaggedOnly = searchParams.get('flaggedOnly') === 'true';
    
    // Date range
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    
    // Sorting
    const sortBy = searchParams.get('sortBy') || 'timestamp';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
    
    // Build query
    const query: any = {};
    
    if (eventType) {
      query.eventType = eventType;
    }
    
    if (userId) {
      query.userId = userId.toUpperCase();
    }
    
    if (userRole) {
      query.userRole = userRole;
    }
    
    if (department) {
      query.department = department;
    }
    
    if (subject) {
      query.subject = subject;
    }
    
    if (submissionId) {
      query.submissionId = { $regex: new RegExp(submissionId, 'i') };
    }
    
    if (testId) {
      query.testId = { $regex: new RegExp(testId, 'i') };
    }
    
    if (studentId) {
      query.studentId = studentId.toUpperCase();
    }
    
    if (evaluationId) {
      query.evaluationId = { $regex: new RegExp(evaluationId, 'i') };
    }
    
    if (grievanceId) {
      query.grievanceId = { $regex: new RegExp(grievanceId, 'i') };
    }
    
    if (sessionId) {
      query.sessionId = sessionId;
    }
    
    if (flaggedOnly) {
      query.isOutlier = true;
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) {
        query.timestamp.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.timestamp.$lte = new Date(dateTo);
      }
    }
    
    // Execute query with pagination
    const [logs, totalCount] = await Promise.all([
      AuditLog.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // Get summary statistics
    const stats = await AuditLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        },
      },
    ]);
    
    const eventTypeCounts = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {} as Record<string, number>);
    
    return NextResponse.json(
      {
        success: true,
        data: {
          logs,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage,
            hasPrevPage,
          },
          stats: {
            totalLogs: totalCount,
            eventTypeCounts,
          },
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('❌ Fetch audit logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/audit-logs/stats
 * Get aggregate statistics for audit logs
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = getUserFromHeaders(request.headers);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Parse request body for custom aggregation
    const body = await request.json();
    const { 
      dateFrom, 
      dateTo, 
      department, 
      subject,
      aggregationType = 'summary' // 'summary', 'by_teacher', 'by_student', 'by_department'
    } = body;
    
    // Build base query
    const matchQuery: any = {};
    
    if (dateFrom || dateTo) {
      matchQuery.timestamp = {};
      if (dateFrom) matchQuery.timestamp.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.timestamp.$lte = new Date(dateTo);
    }
    
    if (department) matchQuery.department = department;
    if (subject) matchQuery.subject = subject;
    
    let aggregationPipeline: any[] = [{ $match: matchQuery }];
    
    switch (aggregationType) {
      case 'by_teacher':
        aggregationPipeline.push(
          {
            $match: { userRole: 'teacher' }
          },
          {
            $group: {
              _id: '$userId',
              userName: { $first: '$userName' },
              department: { $first: '$department' },
              totalEvents: { $sum: 1 },
              totalEvaluations: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', AuditEventType.EVALUATION_COMPLETED] }, 1, 0]
                }
              },
              totalQuestions: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', AuditEventType.QUESTION_MARKED] }, 1, 0]
                }
              },
              averageTimePerQuestion: { $avg: '$timeSpent' },
              totalGrievances: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', AuditEventType.REEVALUATION_COMPLETED] }, 1, 0]
                }
              },
            }
          },
          { $sort: { totalEvaluations: -1 } }
        );
        break;
        
      case 'by_student':
        aggregationPipeline.push(
          {
            $match: { studentId: { $exists: true, $ne: null } }
          },
          {
            $group: {
              _id: '$studentId',
              studentName: { $first: '$studentName' },
              department: { $first: '$department' },
              totalEvaluations: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', AuditEventType.EVALUATION_COMPLETED] }, 1, 0]
                }
              },
              totalGrievancesFiled: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', AuditEventType.GRIEVANCE_FILED] }, 1, 0]
                }
              },
              averageMarks: { $avg: '$marksAwarded' },
            }
          },
          { $sort: { totalEvaluations: -1 } }
        );
        break;
        
      case 'by_department':
        aggregationPipeline.push(
          {
            $group: {
              _id: '$department',
              totalEvents: { $sum: 1 },
              totalEvaluations: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', AuditEventType.EVALUATION_COMPLETED] }, 1, 0]
                }
              },
              totalGrievances: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', AuditEventType.GRIEVANCE_FILED] }, 1, 0]
                }
              },
              averageMarks: { $avg: '$marksAwarded' },
              averageTimePerQuestion: { $avg: '$timeSpent' },
            }
          },
          { $sort: { totalEvaluations: -1 } }
        );
        break;
        
      default: // 'summary'
        aggregationPipeline = [
          { $match: matchQuery },
          {
            $facet: {
              eventTypeCounts: [
                {
                  $group: {
                    _id: '$eventType',
                    count: { $sum: 1 }
                  }
                }
              ],
              userRoleCounts: [
                {
                  $group: {
                    _id: '$userRole',
                    count: { $sum: 1 }
                  }
                }
              ],
              departmentCounts: [
                {
                  $group: {
                    _id: '$department',
                    count: { $sum: 1 }
                  }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
              ],
              markingPatternCounts: [
                {
                  $match: { markingPattern: { $exists: true } }
                },
                {
                  $group: {
                    _id: '$markingPattern',
                    count: { $sum: 1 }
                  }
                }
              ],
              averageMetrics: [
                {
                  $group: {
                    _id: null,
                    avgTimeSpent: { $avg: '$timeSpent' },
                    avgMarksAwarded: { $avg: '$marksAwarded' },
                    totalOutliers: { $sum: { $cond: ['$isOutlier', 1, 0] } }
                  }
                }
              ]
            }
          }
        ];
    }
    
    const results = await AuditLog.aggregate(aggregationPipeline);
    
    return NextResponse.json(
      {
        success: true,
        data: {
          aggregationType,
          results: results.length > 0 ? results : [],
          query: matchQuery,
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('❌ Aggregate audit logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
