'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface User {
  userId: string;
  name: string;
  email: string;
  department: string;
  subjects: string[];
}

interface Stats {
  totalSubmissions: number;
  evaluatedSubmissions: number;
  pendingSubmissions: number;
  testsCreated: number;
  pendingGrievances?: number;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const userResponse = await fetch('/api/auth/me');
      if (!userResponse.ok) {
        router.push('/login');
        return;
      }
      const userData = await userResponse.json();
      setUser(userData.data.user);
      
      const statsResponse = await fetch('/api/teacher/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data.stats);
      }
      
      // Fetch grievances count
      const grievancesResponse = await fetch('/api/teacher/grievances?status=pending');
      if (grievancesResponse.ok) {
        const grievancesData = await grievancesResponse.json();
        setStats(prev => ({
          ...prev,
          pendingGrievances: grievancesData.data.stats.pending || 0,
        } as Stats));
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-secondary-600">Loading dashboard...</p>
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
            <h1 className="text-xl font-bold text-primary-600">
              Teacher Dashboard
            </h1>
            <div className="flex items-center gap-4">
              <Link href="/create-test" className="btn btn-primary">
                Create Test
              </Link>
              <Link href="/evaluate" className="btn btn-outline">
                Evaluate
              </Link>
              <Link href="/grievances" className="btn btn-secondary relative">
                📝 Grievances
                {stats && stats.pendingGrievances && stats.pendingGrievances > 0 && (
                  <span className="absolute -top-2 -right-2 bg-danger-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {stats.pendingGrievances}
                  </span>
                )}
              </Link>
              <Link href="/add-students" className="btn btn-outline">
                ➕ Add Students
              </Link>
              <button onClick={handleLogout} className="text-secondary-600 hover:text-secondary-900">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-secondary-900 mb-2">
            Welcome, {user?.name}!
          </h2>
          <p className="text-secondary-600">
            {user?.department} • Subjects: {user?.subjects.join(', ')}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
            <div className="text-3xl font-bold mb-2">{stats?.testsCreated || 0}</div>
            <div className="text-primary-100 text-sm">Tests Created</div>
          </div>
          
          <div className="card bg-gradient-to-br from-secondary-600 to-secondary-700 text-white">
            <div className="text-3xl font-bold mb-2">{stats?.totalSubmissions || 0}</div>
            <div className="text-secondary-100 text-sm">Total Submissions</div>
          </div>
          
          <div className="card bg-gradient-to-br from-warning-500 to-warning-600 text-white">
            <div className="text-3xl font-bold mb-2">{stats?.pendingSubmissions || 0}</div>
            <div className="text-warning-100 text-sm">Pending</div>
          </div>
          
          <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
            <div className="text-3xl font-bold mb-2">{stats?.evaluatedSubmissions || 0}</div>
            <div className="text-success-100 text-sm">Evaluated</div>
          </div>
          
          {/* NEW: Grievances Card */}
          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="text-3xl font-bold mb-2">{stats?.pendingGrievances || 0}</div>
            <div className="text-purple-100 text-sm">Pending Grievances</div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Create Test Card */}
          <Link href="/create-test" className="card-hover text-center">
            <div className="text-4xl mb-3">📝</div>
            <h3 className="font-semibold text-lg mb-2">Create Test</h3>
            <p className="text-sm text-secondary-600">
              Upload question paper and marking scheme
            </p>
          </Link>
          
          {/* Evaluate Card */}
          <Link href="/evaluate" className="card-hover text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="font-semibold text-lg mb-2">Evaluate</h3>
            <p className="text-sm text-secondary-600">
              Review and mark student submissions
            </p>
          </Link>
          
          {/* Grievances Card - NEW */}
          <Link href="/grievances" className="card-hover text-center bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 relative">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="font-semibold text-lg mb-2 text-purple-700">Grievances</h3>
            <p className="text-sm text-secondary-600">
              Review and re-evaluate submissions
            </p>
            {stats && stats.pendingGrievances && stats.pendingGrievances > 0 && (
              <span className="absolute top-3 right-3 bg-danger-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {stats.pendingGrievances}
              </span>
            )}
          </Link>
          
          {/* Add Students Card */}
          <Link href="/add-students" className="card-hover text-center bg-gradient-to-br from-success-50 to-primary-50 border-2 border-success-200">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="font-semibold text-lg mb-2 text-success-700">Add Students</h3>
            <p className="text-sm text-secondary-600">
              Register new students to the platform
            </p>
          </Link>
        </div>

        {/* Recent Activity Section */}
        <div className="mt-8 card">
          <h3 className="text-xl font-semibold text-secondary-900 mb-4">
            Quick Links
          </h3>
          <div className="grid md:grid-cols-4 gap-4">
            <Link 
              href="/create-test"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors"
            >
              <span className="text-2xl">📝</span>
              <div>
                <p className="font-medium text-secondary-900">Create New Test</p>
                <p className="text-xs text-secondary-600">Set up a new exam</p>
              </div>
            </Link>
            
            <Link 
              href="/evaluate"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors"
            >
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-medium text-secondary-900">Evaluate Submissions</p>
                <p className="text-xs text-secondary-600">Mark answer sheets</p>
              </div>
            </Link>
            
            <Link 
              href="/grievances"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors relative"
            >
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-medium text-purple-700">Review Grievances</p>
                <p className="text-xs text-secondary-600">Re-evaluate submissions</p>
              </div>
              {stats && stats.pendingGrievances && stats.pendingGrievances > 0 && (
                <span className="absolute top-2 right-2 bg-danger-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {stats.pendingGrievances}
                </span>
              )}
            </Link>
            
            <Link 
              href="/add-students"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-success-50 transition-colors"
            >
              <span className="text-2xl">👥</span>
              <div>
                <p className="font-medium text-success-700">Add New Students</p>
                <p className="text-xs text-secondary-600">Register students</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
