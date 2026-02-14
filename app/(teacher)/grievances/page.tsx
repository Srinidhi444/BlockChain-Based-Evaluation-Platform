'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Grievance {
  grievanceId: string;
  submissionId: string;
  testId: string;
  studentName: string;
  grievanceType: 'calculation_error' | 'reevaluation';
  questionNumber?: number;
  explanation: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  filedAt: string;
}

interface GrievanceWithDetails {
  grievance: Grievance;
  submission: {
    answerSheetUrl: string;
    fileName: string;
    fileType: string;
    uploadedAt: string;
  } | null;
  test: {
    title: string;
    subject: string;
    totalMarks: number;
  } | null;
  originalEvaluation: {
    totalMarksObtained: number;
    totalMarks: number;
    percentage: number;
  } | null;
}

interface Stats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  rejected: number;
  calculationError: number;
  reevaluation: number;
}

export default function TeacherGrievancesPage() {
  const router = useRouter();
  const [grievances, setGrievances] = useState<GrievanceWithDetails[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    fetchGrievances();
  }, [filterStatus, filterType]);

  const fetchGrievances = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterType) params.append('type', filterType);

      const response = await fetch(`/api/teacher/grievances?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch grievances');
      }

      const data = await response.json();
      setGrievances(data.data.grievances);
      setStats(data.data.stats);

    } catch (err: any) {
      setError(err.message || 'Failed to load grievances');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-warning-100 text-warning-800 border-warning-300',
      in_progress: 'bg-primary-100 text-primary-800 border-primary-300',
      completed: 'bg-success-100 text-success-800 border-success-300',
      rejected: 'bg-danger-100 text-danger-800 border-danger-300',
    };
    return badges[status as keyof typeof badges] || 'bg-secondary-100 text-secondary-800';
  };

  const getTypeBadge = (type: string) => {
    return type === 'calculation_error'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : 'bg-purple-100 text-purple-800 border-purple-300';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-secondary-600">Loading grievances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-secondary-600 hover:text-secondary-900">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-xl font-bold text-primary-600">
              Grievances Assigned to You
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
              <div className="text-2xl font-bold mb-1">{stats.total}</div>
              <div className="text-primary-100 text-sm">Total Grievances</div>
            </div>

            <div className="card bg-gradient-to-br from-warning-500 to-warning-600 text-white">
              <div className="text-2xl font-bold mb-1">{stats.pending}</div>
              <div className="text-warning-100 text-sm">Pending</div>
            </div>

            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="text-2xl font-bold mb-1">{stats.inProgress}</div>
              <div className="text-blue-100 text-sm">In Progress</div>
            </div>

            <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
              <div className="text-2xl font-bold mb-1">{stats.completed}</div>
              <div className="text-success-100 text-sm">Completed</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input"
              >
                <option value="">All Types</option>
                <option value="calculation_error">Calculation Error</option>
                <option value="reevaluation">Re-evaluation</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterStatus('');
                  setFilterType('');
                }}
                className="btn btn-outline"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="card bg-danger-50 border-danger-200 mb-6">
            <p className="text-danger-700">{error}</p>
          </div>
        )}

        {/* Grievances List */}
        {grievances.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-2">
              No Grievances Found
            </h3>
            <p className="text-secondary-600">
              {filterStatus || filterType
                ? 'Try adjusting your filters'
                : 'No grievances have been assigned to you yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grievances.map(({ grievance, submission, test, originalEvaluation }) => (
              <div key={grievance.grievanceId} className="card hover:shadow-lg transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(
                          grievance.status
                        )}`}
                      >
                        {grievance.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeBadge(
                          grievance.grievanceType
                        )}`}
                      >
                        {grievance.grievanceType === 'calculation_error'
                          ? 'Calculation Error'
                          : 'Re-evaluation'}
                      </span>
                    </div>

                    <h3 className="font-semibold text-lg text-secondary-900 mb-1">
                      {test?.title || 'Test Title'}
                    </h3>

                    <div className="grid grid-cols-2 gap-2 text-sm text-secondary-600 mb-2">
                      <p>
                        <span className="font-medium">Student:</span> {grievance.studentName}
                      </p>
                      <p>
                        <span className="font-medium">Subject:</span> {test?.subject || 'N/A'}
                      </p>
                      {grievance.questionNumber && (
                        <p>
                          <span className="font-medium">Question:</span> #{grievance.questionNumber}
                        </p>
                      )}
                      {originalEvaluation && (
                        <p>
                          <span className="font-medium">Original Score:</span>{' '}
                          {originalEvaluation.totalMarksObtained}/{originalEvaluation.totalMarks} (
                          {originalEvaluation.percentage.toFixed(1)}%)
                        </p>
                      )}
                    </div>

                    <p className="text-sm text-secondary-700 italic line-clamp-2">
                      "{grievance.explanation}"
                    </p>

                    <p className="text-xs text-secondary-500 mt-2">
                      Filed on {new Date(grievance.filedAt).toLocaleDateString()} at{' '}
                      {new Date(grievance.filedAt).toLocaleTimeString()}
                    </p>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/reevaluate/${grievance.grievanceId}`}
                      className="btn btn-primary whitespace-nowrap"
                    >
                      {grievance.status === 'completed' ? '👁️ View' : '📝 Review & Evaluate'}
                    </Link>

                    {submission && (
                      <a
                        href={submission.answerSheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline text-sm whitespace-nowrap"
                      >
                        📄 View Answer Sheet
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
