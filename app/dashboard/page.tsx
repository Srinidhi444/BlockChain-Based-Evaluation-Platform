'use client';

import { useEffect } from 'react';

export default function DashboardRouter() {
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          window.location.href = '/login';
          return;
        }
        
        const data = await response.json();
        const user = data.data.user;
        
        // Redirect based on role
        if (user.role === 'student') {
          window.location.href = '/student-dashboard';
        } else if (user.role === 'teacher') {
          window.location.href = '/teacher-dashboard';
        } else {
          window.location.href = '/login';
        }
        
      } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
      }
    }
    
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
        <p className="text-secondary-600 text-lg">Loading your dashboard...</p>
      </div>
    </div>
  );
}
