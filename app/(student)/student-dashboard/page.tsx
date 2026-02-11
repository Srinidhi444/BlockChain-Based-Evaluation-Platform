'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface User {
  userId: string;
  name: string;
  email: string;
  department: string;
  year: number;
  division: string;
}

interface Stats {
  totalSubmissions: number;
  evaluatedSubmissions: number;
  pendingResults: number;
}

export default function StudentDashboard() {
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
      
      // Fetch student stats
      const statsResponse = await fetch('/api/student/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data.stats);
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
      <nav className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-primary-600">
              Student Dashboard
            </h1>
            <div className="flex items-center gap-4">
              <Link href="/upload" className="btn btn-primary">
                Upload Answer Sheet
              </Link>
              <Link href="/results" className="btn btn-outline">
                View Results
              </Link>
              <button onClick={handleLogout} className="text-secondary-600 hover:text-secondary-900">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-secondary-900 mb-2">
            Welcome, {user?.name}!
          </h2>
          <p className="text-secondary-600">
            {user?.department} • Year {user?.year}, Division {user?.division}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
            <div className="text-3xl font-bold mb-2">{stats?.totalSubmissions || 0}</div>
            <div className="text-primary-100">Total Submissions</div>
          </div>
          
          <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
            <div className="text-3xl font-bold mb-2">{stats?.evaluatedSubmissions || 0}</div>
            <div className="text-success-100">Evaluated</div>
          </div>
          
          <div className="card bg-gradient-to-br from-warning-500 to-warning-600 text-white">
            <div className="text-3xl font-bold mb-2">{stats?.pendingResults || 0}</div>
            <div className="text-warning-100">Pending Results</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link href="/upload" className="card-hover text-center">
            <div className="text-5xl mb-4">📤</div>
            <h3 className="font-semibold text-lg mb-2">Upload Answer Sheet</h3>
            <p className="text-sm text-secondary-600">
              Submit your answer sheet for evaluation
            </p>
          </Link>
          
          <Link href="/results" className="card-hover text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="font-semibold text-lg mb-2">View Results</h3>
            <p className="text-sm text-secondary-600">
              Check your evaluated answer sheets
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
