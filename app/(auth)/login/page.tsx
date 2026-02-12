'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    userId: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDebugInfo('');
    setLoading(true);

    try {
      console.log('=== LOGIN ATTEMPT ===');
      console.log('1. Submitting credentials...');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important for cookies!
        body: JSON.stringify(formData),
      });

      console.log('2. Response status:', response.status);
      
      const data = await response.json();
      console.log('3. Response data:', data);

      if (!response.ok) {
        console.log(data.error ? `Login failed: ${data.error}` : 'Login failed with unknown error');
        throw new Error(data.error || 'Login failed');
      }

      console.log('4. Login successful!');
      console.log('5. User role:', data.data.user.role);
      
      // Check if cookie was set
      const allCookies = document.cookie;
      console.log('6. Current cookies:', allCookies);
      
      const hasToken = allCookies.includes('token=');
      console.log('7. Has token cookie?', hasToken);
      
      setDebugInfo(`✅ Login successful! Role: ${data.data.user.role}`);
      
      // Wait a bit for cookie to be set, then redirect
      console.log('8. Redirecting to /dashboard in 1 second...');
      
      setTimeout(() => {
        console.log('9. Executing redirect now...');
        window.location.href = '/dashboard';
      }, 1000);
      
    } catch (err: any) {
      console.error('❌ Login error:', err);
      setError(err.message || 'An error occurred during login');
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-secondary-900 mb-2">
          Welcome Back
        </h2>
        <p className="text-secondary-600">
          Sign in to your account to continue
        </p>
      </div>

      {debugInfo && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm font-medium">{debugInfo}</p>
          <p className="text-green-600 text-xs mt-1">Check console (F12) for details</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg">
          <p className="text-danger-700 text-sm font-medium">⚠️ {error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="userId" className="block text-sm font-medium text-secondary-700 mb-2">
            User ID
          </label>
          <input
            id="userId"
            name="userId"
            type="text"
            required
            className="input"
            placeholder="ST2026001 or TCH2026001"
            value={formData.userId}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-secondary-700 mb-2">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="input"
            placeholder="password123"
            value={formData.password}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full py-3 text-lg"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/" className="text-sm text-primary-600 hover:text-primary-700">
          ← Back to Home
        </Link>
      </div>

      <div className="mt-8 pt-6 border-t border-secondary-200 text-xs">
        <p className="text-center text-secondary-600 mb-2">Test Credentials:</p>
        <div className="bg-secondary-50 p-2 rounded">
          <p>Student: <code>ST2026001 / password123</code></p>
          <p>Teacher: <code>TCH2026001 / password123</code></p>
        </div>
      </div>
    </div>
  );
}
