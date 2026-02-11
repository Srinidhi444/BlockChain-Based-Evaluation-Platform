'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Submission {
  _id: string;
  submissionId: string;
  testId: string;
  subject: string;
  department: string;
  year: number;
  division: string;
  status: string;
  uploadedAt: string;
}

export default function EvaluatePage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'uploaded,under_evaluation',
    subject: '',
    year: '',
    division: '',
  });

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, submissions]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/teacher/submissions');
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch submissions');
      }
      
      const data = await response.json();
      setSubmissions(data.data.submissions);
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = submissions;
    
    // Status filter
    if (filters.status) {
      const statuses = filters.status.split(',');
      filtered = filtered.filter(s => statuses.includes(s.status));
    }
    
    // Subject filter
    if (filters.subject) {
      filtered = filtered.filter(s => s.subject === filters.subject);
    }
    
    // Year filter
    if (filters.year) {
      filtered = filtered.filter(s => s.year === parseInt(filters.year));
    }
    
    // Division filter
    if (filters.division) {
      filtered = filtered.filter(s => s.division === filters.division);
    }
    
    setFilteredSubmissions(filtered);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploaded':
        return <span className="badge badge-secondary">New</span>;
      case 'under_evaluation':
        return <span className="badge badge-warning">In Progress</span>;
      case 'evaluated':
        return <span className="badge badge-success">Completed</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  // Get unique values for filters
  const uniqueSubjects = [...new Set(submissions.map(s => s.subject))];
  const uniqueYears = [...new Set(submissions.map(s => s.year))];
  const uniqueDivisions = [...new Set(submissions.map(s => s.division))];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-secondary-600">Loading submissions...</p>
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
              <Link href="/dashboard" className="text-secondary-600 hover:text-secondary-900">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-xl font-bold text-primary-600">
              Evaluate Submissions
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Filters</h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Status
              </label>
              <select
                className="input"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All</option>
                <option value="uploaded">New</option>
                <option value="under_evaluation">In Progress</option>
                <option value="uploaded,under_evaluation">Pending</option>
                <option value="evaluated">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Subject
              </label>
              <select
                className="input"
                value={filters.subject}
                onChange={(e) => handleFilterChange('subject', e.target.value)}
              >
                <option value="">All Subjects</option>
                {uniqueSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Year
              </label>
              <select
                className="input"
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
              >
                <option value="">All Years</option>
                {uniqueYears.map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Division
              </label>
              <select
                className="input"
                value={filters.division}
                onChange={(e) => handleFilterChange('division', e.target.value)}
              >
                <option value="">All Divisions</option>
                {uniqueDivisions.map(division => (
                  <option key={division} value={division}>Division {division}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">
              Submissions ({filteredSubmissions.length})
            </h3>
            <button
              onClick={fetchSubmissions}
              className="text-primary-600 hover:text-primary-700 text-sm"
            >
              🔄 Refresh
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-danger-700 text-sm">{error}</p>
            </div>
          )}

          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-secondary-500">
              <div className="text-5xl mb-4">
                {filters.status === 'uploaded,under_evaluation' ? '✨' : '📭'}
              </div>
              <p className="mb-2">
                {filters.status === 'uploaded,under_evaluation' 
                  ? 'All caught up! No pending evaluations.'
                  : 'No submissions found with current filters.'
                }
              </p>
              {filters.status !== '' && (
                <button
                  onClick={() => setFilters({ status: '', subject: '', year: '', division: '' })}
                  className="text-primary-600 hover:text-primary-700 text-sm mt-2"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Class</th>
                    <th>Test ID</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((submission) => (
                    <tr key={submission._id}>
                      <td className="font-medium">{submission.subject}</td>
                      <td>
                        {submission.department.substring(0, 3).toUpperCase()} - Y{submission.year}, D{submission.division}
                      </td>
                      <td className="text-xs text-secondary-500">
                        {submission.testId.slice(0, 25)}...
                      </td>
                      <td>
                        {new Date(submission.uploadedAt).toLocaleDateString()}
                      </td>
                      <td>{getStatusBadge(submission.status)}</td>
                      <td>
                        <Link
                          href={`/evaluate/${submission.submissionId}`}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          {submission.status === 'evaluated' ? 'View →' : 'Evaluate →'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
