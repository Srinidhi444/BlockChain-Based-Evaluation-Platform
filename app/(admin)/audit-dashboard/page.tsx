'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FloatingChat from "@/components/FloatingChat";
import Link from 'next/link';

interface AuditLog {
  auditId: string;
  eventType: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  department: string;
  submissionId?: string;
  questionNumber?: number;
  marksAwarded?: number;
  timeSpent?: number;
  markingPattern?: string;
}

interface TeacherBias {
  teacherId: string;
  teacherName: string;
  biasScore: number;
  riskLevel: string;
}

interface BiasOverview {
  totalGrievances: number;
  grievanceSuccessRate: string;
  teachersAtRisk: number;
  criticalCases: number;
}

interface Stats {
  totalLogs: number;
  eventTypeCounts: Record<string, number>;
}

export default function AuditDashboard() {
  const router = useRouter();
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [biasOverview, setBiasOverview] = useState<BiasOverview | null>(null);
  const [highBiasTeachers, setHighBiasTeachers] = useState<TeacherBias[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [eventType, setEventType] = useState('');
  const [department, setDepartment] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [activeTab, setActiveTab] = useState<'logs' | 'bias' | 'grievances'>('logs');

  useEffect(() => {
    fetchDashboardData();
  }, [currentPage, eventType, department, dateFrom, dateTo]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Build query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });
      
      if (eventType) params.append('eventType', eventType);
      if (department) params.append('department', department);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      // Fetch audit logs
      const logsResponse = await fetch(`/api/admin/audit-logs?${params}`);
      
      if (!logsResponse.ok) {
        if (logsResponse.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch audit logs');
      }
      
      const logsData = await logsResponse.json();
      setLogs(logsData.data.logs);
      setStats(logsData.data.stats);
      
      // Fetch bias overview
      const biasParams = new URLSearchParams({ type: 'overview' });
      if (dateFrom) biasParams.append('dateFrom', dateFrom);
      if (dateTo) biasParams.append('dateTo', dateTo);
      
      const biasResponse = await fetch(`/api/admin/bias-report?${biasParams}`);
      
      if (biasResponse.ok) {
        const biasData = await biasResponse.json();
        setBiasOverview(biasData.data.summary);
        setHighBiasTeachers(biasData.data.highBiasTeachers.teachers);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ type: 'overview', format: 'csv' });
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      const response = await fetch('/api/admin/bias-report/export', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'overview',
          format: 'csv',
          dateFrom,
          dateTo,
        }),
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_report_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert('Report exported successfully!');
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'text-danger-600 bg-danger-100';
      case 'high': return 'text-warning-600 bg-warning-100';
      case 'medium': return 'text-primary-600 bg-primary-100';
      default: return 'text-success-600 bg-success-100';
    }
  };

  const formatEventType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-secondary-600">Loading audit dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin-dashboard" className="text-secondary-600 hover:text-secondary-900">
                ← Back to Admin Dashboard
              </Link>
            </div>
            <h1 className="text-xl font-bold text-primary-600">
              Audit & Bias Detection Dashboard
            </h1>
            <button
              onClick={handleExportCSV}
              className="btn btn-outline text-sm"
            >
              📥 Export CSV
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {biasOverview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
              <div className="text-3xl font-bold mb-2">{biasOverview.totalGrievances}</div>
              <div className="text-primary-100">Total Grievances</div>
            </div>
            
            <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
              <div className="text-3xl font-bold mb-2">{biasOverview.grievanceSuccessRate}%</div>
              <div className="text-success-100">Success Rate</div>
            </div>
            
            <div className="card bg-gradient-to-br from-warning-500 to-warning-600 text-white">
              <div className="text-3xl font-bold mb-2">{biasOverview.teachersAtRisk}</div>
              <div className="text-warning-100">Teachers at Risk</div>
            </div>
            
            <div className="card bg-gradient-to-br from-danger-500 to-danger-600 text-white">
              <div className="text-3xl font-bold mb-2">{biasOverview.criticalCases}</div>
              <div className="text-danger-100">Critical Cases</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="card mb-6">
          <div className="flex gap-4 border-b border-secondary-200 pb-4">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                activeTab === 'logs'
                  ? 'bg-primary-600 text-white'
                  : 'text-secondary-600 hover:bg-secondary-100'
              }`}
            >
              📋 Audit Logs
            </button>
            <button
              onClick={() => setActiveTab('bias')}
              className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                activeTab === 'bias'
                  ? 'bg-primary-600 text-white'
                  : 'text-secondary-600 hover:bg-secondary-100'
              }`}
            >
              ⚠️ Bias Detection
            </button>
            <button
              onClick={() => setActiveTab('grievances')}
              className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                activeTab === 'grievances'
                  ? 'bg-primary-600 text-white'
                  : 'text-secondary-600 hover:bg-secondary-100'
              }`}
            >
              📊 Grievance Analytics
            </button>
          </div>

          {/* Filters */}
          <div className="grid md:grid-cols-4 gap-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Event Type
              </label>
              <select
                className="input"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="">All Events</option>
                <option value="evaluation_started">Evaluation Started</option>
                <option value="question_marked">Question Marked</option>
                <option value="evaluation_completed">Evaluation Completed</option>
                <option value="grievance_filed">Grievance Filed</option>
                <option value="reevaluation_completed">Re-evaluation Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Department
              </label>
              <input
                type="text"
                className="input"
                placeholder="Filter by department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Date From
              </label>
              <input
                type="date"
                className="input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Date To
              </label>
              <input
                type="date"
                className="input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'logs' && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Audit Logs</h3>
            
            {error && (
              <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg mb-4">
                <p className="text-danger-700 text-sm">{error}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Timestamp</th>
                    <th className="px-4 py-3 text-left">Event Type</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    <th className="px-4 py-3 text-left">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-secondary-500">
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.auditId} className="hover:bg-secondary-50">
                        <td className="px-4 py-3">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge badge-primary">
                            {formatEventType(log.eventType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{log.userName}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${
                            log.userRole === 'teacher' ? 'badge-success' :
                            log.userRole === 'student' ? 'badge-primary' :
                            'badge-secondary'
                          }`}>
                            {log.userRole}
                          </span>
                        </td>
                        <td className="px-4 py-3">{log.department}</td>
                        <td className="px-4 py-3 text-xs">
                          {log.questionNumber && `Q${log.questionNumber} `}
                          {log.marksAwarded !== undefined && `(${log.marksAwarded} marks) `}
                          {log.timeSpent && `${log.timeSpent}s`}
                          {log.markingPattern && (
                            <span className={`ml-2 badge ${
                              log.markingPattern === 'strict' ? 'badge-danger' :
                              log.markingPattern === 'lenient' ? 'badge-success' :
                              'badge-secondary'
                            }`}>
                              {log.markingPattern}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {stats && (
              <div className="mt-6 p-4 bg-secondary-50 rounded-lg">
                <h4 className="font-semibold mb-3">Event Type Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(stats.eventTypeCounts).map(([type, count]) => (
                    <div key={type} className="text-sm">
                      <span className="text-secondary-600">{formatEventType(type)}:</span>
                      <span className="font-bold ml-2">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bias' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">High Bias Risk Teachers</h3>
              
              {highBiasTeachers.length === 0 ? (
                <div className="text-center py-8 text-secondary-500">
                  <div className="text-4xl mb-3">✅</div>
                  <p>No high-risk teachers detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {highBiasTeachers.map((teacher) => (
                    <div
                      key={teacher.teacherId}
                      className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg border-2 border-secondary-200"
                    >
                      <div>
                        <p className="font-semibold">{teacher.teacherName}</p>
                        <p className="text-sm text-secondary-600">{teacher.teacherId}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">{teacher.biasScore.toFixed(1)}</p>
                          <p className="text-xs text-secondary-600">Bias Score</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          getRiskColor(teacher.riskLevel)
                        }`}>
                          {teacher.riskLevel.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'grievances' && biasOverview && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Grievance Analytics</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-secondary-50 rounded-lg">
                <h4 className="font-semibold mb-3">Overall Statistics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Total Grievances:</span>
                    <span className="font-bold">{biasOverview.totalGrievances}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Success Rate:</span>
                    <span className="font-bold text-success-600">
                      {biasOverview.grievanceSuccessRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Teachers at Risk:</span>
                    <span className="font-bold text-warning-600">
                      {biasOverview.teachersAtRisk}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-danger-50 rounded-lg">
                <h4 className="font-semibold mb-3 text-danger-800">Critical Cases</h4>
                <div className="text-center">
                  <p className="text-4xl font-bold text-danger-600 mb-2">
                    {biasOverview.criticalCases}
                  </p>
                  <p className="text-sm text-danger-700">
                    Require immediate review
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <FloatingChat />
    </div>
  );
}
