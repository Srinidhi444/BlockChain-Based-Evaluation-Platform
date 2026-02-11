'use client';

import { useEffect, useState } from 'react';

export default function TestCookie() {
  const [cookies, setCookies] = useState('');
  const [apiResult, setApiResult] = useState('');

  useEffect(() => {
    setCookies(document.cookie || 'No cookies found');
  }, []);

  const testLogin = async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        userId: 'ST2026001',
        password: 'password123'
      })
    });

    const data = await response.json();
    setApiResult(JSON.stringify(data, null, 2));
    
    // Wait 1 second, then check cookies again
    setTimeout(() => {
      setCookies(document.cookie || 'No cookies found');
    }, 1000);
  };

  const testMe = async () => {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    const data = await response.json();
    setApiResult(JSON.stringify(data, null, 2));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Cookie Test</h1>

        <div className="space-y-4 mb-6">
          <button
            onClick={testLogin}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Test Login
          </button>
          
          <button
            onClick={testMe}
            className="px-4 py-2 bg-green-600 text-white rounded ml-4"
          >
            Test /api/auth/me
          </button>
          
          <button
            onClick={() => setCookies(document.cookie)}
            className="px-4 py-2 bg-gray-600 text-white rounded ml-4"
          >
            Refresh Cookies
          </button>
        </div>

        <div className="bg-white p-4 rounded shadow mb-4">
          <h2 className="font-bold mb-2">Current Cookies:</h2>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
            {cookies}
          </pre>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2">API Result:</h2>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
            {apiResult || 'Click a button to test'}
          </pre>
        </div>
      </div>
    </div>
  );
}
