import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { getUserFromHeaders } from '@/lib/utils/auth';
import {
  generateTeacherBiasReport,
  generateDepartmentBiasReport,
  generateGrievanceAnalysisReport,
  getHighBiasTeachers,
} from '@/lib/utils/biasDetector';

/**
 * GET /api/admin/bias-report
 * Generate comprehensive bias analysis reports
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
    
    const reportType = searchParams.get('type') || 'overview'; // 'overview', 'teacher', 'department', 'grievance', 'high_bias'
    const teacherId = searchParams.get('teacherId');
    const department = searchParams.get('department');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const threshold = parseInt(searchParams.get('threshold') || '50');
    
    const dateFromObj = dateFrom ? new Date(dateFrom) : undefined;
    const dateToObj = dateTo ? new Date(dateTo) : undefined;
    
    console.log(`📊 Generating bias report: type=${reportType}`);
    
    switch (reportType) {
      case 'teacher': {
        if (!teacherId) {
          return NextResponse.json(
            { error: 'teacherId is required for teacher bias report' },
            { status: 400 }
          );
        }
        
        const report = await generateTeacherBiasReport(
          teacherId,
          dateFromObj,
          dateToObj
        );
        
        if (!report) {
          return NextResponse.json(
            { error: 'No data found for this teacher' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          {
            success: true,
            data: {
              reportType: 'teacher',
              report,
            },
          },
          { status: 200 }
        );
      }
      
      case 'department': {
        if (!department) {
          return NextResponse.json(
            { error: 'department is required for department bias report' },
            { status: 400 }
          );
        }
        
        const report = await generateDepartmentBiasReport(
          department,
          dateFromObj,
          dateToObj
        );
        
        if (!report) {
          return NextResponse.json(
            { error: 'No data found for this department' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          {
            success: true,
            data: {
              reportType: 'department',
              report,
            },
          },
          { status: 200 }
        );
      }
      
      case 'grievance': {
        const report = await generateGrievanceAnalysisReport(
          dateFromObj,
          dateToObj
        );
        
        if (!report) {
          return NextResponse.json(
            { error: 'No grievance data found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          {
            success: true,
            data: {
              reportType: 'grievance',
              report,
            },
          },
          { status: 200 }
        );
      }
      
      case 'high_bias': {
        const teachers = await getHighBiasTeachers(threshold);
        
        return NextResponse.json(
          {
            success: true,
            data: {
              reportType: 'high_bias',
              threshold,
              totalTeachers: teachers.length,
              teachers,
            },
          },
          { status: 200 }
        );
      }
      
      case 'overview':
      default: {
        // Generate comprehensive overview with all report types
        const [
          grievanceReport,
          highBiasTeachers,
        ] = await Promise.all([
          generateGrievanceAnalysisReport(dateFromObj, dateToObj),
          getHighBiasTeachers(threshold),
        ]);
        
        return NextResponse.json(
          {
            success: true,
            data: {
              reportType: 'overview',
              dateRange: {
                from: dateFromObj || 'all time',
                to: dateToObj || 'present',
              },
              grievanceAnalysis: grievanceReport,
              highBiasTeachers: {
                threshold,
                count: highBiasTeachers.length,
                teachers: highBiasTeachers.slice(0, 10), // Top 10
              },
              summary: {
                totalGrievances: grievanceReport?.totalGrievances || 0,
                grievanceSuccessRate: grievanceReport 
                  ? ((grievanceReport.marksIncreased / grievanceReport.totalGrievances) * 100).toFixed(2)
                  : '0.00',
                teachersAtRisk: highBiasTeachers.length,
                criticalCases: highBiasTeachers.filter(t => t.biasScore >= 75).length,
              },
            },
          },
          { status: 200 }
        );
      }
    }
    
  } catch (error: any) {
    console.error('❌ Generate bias report error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/bias-report/batch
 * Generate multiple bias reports in batch
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
    
    const body = await request.json();
    const { 
      teacherIds, 
      departments, 
      dateFrom, 
      dateTo,
      includeGrievanceAnalysis = true,
    } = body;
    
    const dateFromObj = dateFrom ? new Date(dateFrom) : undefined;
    const dateToObj = dateTo ? new Date(dateTo) : undefined;
    
    console.log('📊 Generating batch bias reports...');
    
    const reports: any = {
      teachers: [],
      departments: [],
      grievanceAnalysis: null,
    };
    
    // Generate teacher reports
    if (teacherIds && Array.isArray(teacherIds) && teacherIds.length > 0) {
      console.log(`Generating reports for ${teacherIds.length} teachers...`);
      
      const teacherReports = await Promise.all(
        teacherIds.map(id => generateTeacherBiasReport(id, dateFromObj, dateToObj))
      );
      
      reports.teachers = teacherReports.filter(r => r !== null);
    }
    
    // Generate department reports
    if (departments && Array.isArray(departments) && departments.length > 0) {
      console.log(`Generating reports for ${departments.length} departments...`);
      
      const deptReports = await Promise.all(
        departments.map(dept => generateDepartmentBiasReport(dept, dateFromObj, dateToObj))
      );
      
      reports.departments = deptReports.filter(r => r !== null);
    }
    
    // Generate grievance analysis
    if (includeGrievanceAnalysis) {
      console.log('Generating grievance analysis...');
      reports.grievanceAnalysis = await generateGrievanceAnalysisReport(dateFromObj, dateToObj);
    }
    
    // Generate summary statistics
    const summary = {
      teachersAnalyzed: reports.teachers.length,
      departmentsAnalyzed: reports.departments.length,
      averageBiasScore: reports.teachers.length > 0
        ? reports.teachers.reduce((sum: number, r: any) => sum + r.biasScore, 0) / reports.teachers.length
        : 0,
      teachersAtRisk: reports.teachers.filter((r: any) => r.biasRiskLevel === 'high' || r.biasRiskLevel === 'critical').length,
      criticalTeachers: reports.teachers.filter((r: any) => r.biasRiskLevel === 'critical').length,
    };
    
    console.log('✅ Batch bias reports generated successfully');
    
    return NextResponse.json(
      {
        success: true,
        data: {
          reports,
          summary,
          dateRange: {
            from: dateFromObj || 'all time',
            to: dateToObj || 'present',
          },
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('❌ Generate batch bias reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/bias-report/export
 * Export bias report as CSV/JSON
 */
export async function PUT(request: NextRequest) {
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
    
    const body = await request.json();
    const { 
      reportType = 'overview',
      format = 'json', // 'json' or 'csv'
      teacherId,
      department,
      dateFrom,
      dateTo,
    } = body;
    
    const dateFromObj = dateFrom ? new Date(dateFrom) : undefined;
    const dateToObj = dateTo ? new Date(dateTo) : undefined;
    
    let reportData: any = null;
    
    // Generate report based on type
    switch (reportType) {
      case 'teacher':
        if (!teacherId) {
          return NextResponse.json(
            { error: 'teacherId is required' },
            { status: 400 }
          );
        }
        reportData = await generateTeacherBiasReport(teacherId, dateFromObj, dateToObj);
        break;
        
      case 'department':
        if (!department) {
          return NextResponse.json(
            { error: 'department is required' },
            { status: 400 }
          );
        }
        reportData = await generateDepartmentBiasReport(department, dateFromObj, dateToObj);
        break;
        
      case 'grievance':
        reportData = await generateGrievanceAnalysisReport(dateFromObj, dateToObj);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }
    
    if (!reportData) {
      return NextResponse.json(
        { error: 'No data found for export' },
        { status: 404 }
      );
    }
    
    if (format === 'csv') {
      // Convert to CSV format
      let csv = '';
      
      if (reportType === 'teacher') {
        csv = `Teacher ID,Teacher Name,Department,Total Evaluations,Average Percentage,Strictness Score,Leniency Score,Consistency Score,Fatigue Rate,Rushing Rate,Comment Coverage,Quality Score,Bias Score,Risk Level\n`;
        csv += `${reportData.teacherId},${reportData.teacherName},${reportData.department},${reportData.totalEvaluations},${reportData.averagePercentage.toFixed(2)},${reportData.strictnessScore.toFixed(2)},${reportData.leniencyScore.toFixed(2)},${reportData.consistencyScore.toFixed(2)},${reportData.fatigueRate.toFixed(2)},${reportData.rushingRate.toFixed(2)},${reportData.averageCommentCoverage.toFixed(2)},${reportData.averageQualityScore.toFixed(2)},${reportData.biasScore.toFixed(2)},${reportData.biasRiskLevel}\n`;
      } else if (reportType === 'department') {
        csv = `Department,Total Teachers,Total Evaluations,Average Marks,Average Strictness,Average Leniency,Fatigue Rate,Grievance Rate,Flagged Rate,Fairness Index,Consistency Index\n`;
        csv += `${reportData.department},${reportData.totalTeachers},${reportData.totalEvaluations},${reportData.averageMarksAwarded.toFixed(2)},${reportData.averageStrictness.toFixed(2)},${reportData.averageLeniency.toFixed(2)},${reportData.fatigueRate.toFixed(2)},${reportData.grievanceRate.toFixed(2)},${reportData.flaggedRate.toFixed(2)},${reportData.fairnessIndex.toFixed(2)},${reportData.consistencyIndex.toFixed(2)}\n`;
      } else if (reportType === 'grievance') {
        csv = `Total Grievances,Calculation Errors,Reevaluations,Marks Increased,Marks Decreased,Marks Unchanged,Calc Error Success Rate,Reevaluation Success Rate,Average Marks Difference\n`;
        csv += `${reportData.totalGrievances},${reportData.calculationErrors},${reportData.reevaluations},${reportData.marksIncreased},${reportData.marksDecreased},${reportData.marksUnchanged},${reportData.calculationErrorSuccessRate.toFixed(2)},${reportData.reevaluationSuccessRate.toFixed(2)},${reportData.averageMarksDifference.toFixed(2)}\n`;
      }
      
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="bias_report_${reportType}_${Date.now()}.csv"`,
        },
      });
    }
    
    // Return JSON format
    return NextResponse.json(
      {
        success: true,
        data: {
          reportType,
          exportedAt: new Date().toISOString(),
          dateRange: {
            from: dateFromObj || 'all time',
            to: dateToObj || 'present',
          },
          report: reportData,
        },
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('❌ Export bias report error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
