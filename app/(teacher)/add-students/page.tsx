'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface StudentFormData {
  name: string;
  email: string;
  department: string;
  year: number;
  division: string;
}

interface CreatedStudent {
  userId: string;
  password: string;
  name: string;
  email: string;
  emailSent: boolean;
}

export default function AddStudentsPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState<StudentFormData>({
    name: '',
    email: '',
    department: '',
    year: 1,
    division: 'A',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null);
  
  // Department options
  const departments = [
    'Computer Science',
    'Information Technology',
    'Electronics',
    'Mechanical',
    'Civil',
    'Electrical',
    'Chemical',
  ];
  
  // Division options
  const divisions = ['A', 'B', 'C', 'D', 'E'];
  
  // Year options
  const years = [1, 2, 3, 4];
  
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) : value,
    }));
    setError('');
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Validate all fields
    if (!formData.name || !formData.email || !formData.department) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setCreatedStudent(null);
      
      const response = await fetch('/api/teacher/add-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add student');
      }
      
      // Store created student credentials
      setCreatedStudent({
        userId: data.data.credentials.userId,
        password: data.data.credentials.password,
        name: data.data.student.name,
        email: data.data.student.email,
        emailSent: data.data.credentials.emailSent,
      });
      
      setSuccess(data.message);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        department: formData.department, // Keep department same
        year: formData.year, // Keep year same
        division: formData.division, // Keep division same
      });
      
    } catch (err: any) {
      setError(err.message || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };
  
  const copyCredentials = () => {
    if (!createdStudent) return;
    
    const text = `Student Login Credentials\n\nName: ${createdStudent.name}\nUser ID: ${createdStudent.userId}\nPassword: ${createdStudent.password}\nEmail: ${createdStudent.email}`;
    
    navigator.clipboard.writeText(text);
    alert('Credentials copied to clipboard!');
  };
  
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
              Add Students
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Add Student Form */}
          <div className="card">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-secondary-900 mb-2">
                Add New Student
              </h2>
              <p className="text-sm text-secondary-600">
                Enter student details to create their account. Credentials will be sent to their email automatically.
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Full Name <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Enter student's full name"
                  required
                />
              </div>
              
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  College Email <span className="text-danger-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="student@college.edu"
                  required
                />
                <p className="text-xs text-secondary-500 mt-1">
                  Credentials will be sent to this email
                </p>
              </div>
              
              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Department <span className="text-danger-500">*</span>
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="input"
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Year and Division */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Year <span className="text-danger-500">*</span>
                  </label>
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    className="input"
                    required
                  >
                    {years.map(year => (
                      <option key={year} value={year}>
                        Year {year}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Division <span className="text-danger-500">*</span>
                  </label>
                  <select
                    name="division"
                    value={formData.division}
                    onChange={handleInputChange}
                    className="input"
                    required
                  >
                    {divisions.map(div => (
                      <option key={div} value={div}>
                        Division {div}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Error Message */}
              {error && (
                <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                  <p className="text-danger-700 text-sm">{error}</p>
                </div>
              )}
              
              {/* Success Message */}
              {success && (
                <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
                  <p className="text-success-700 text-sm">{success}</p>
                </div>
              )}
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating Student...
                  </span>
                ) : (
                  '➕ Add Student'
                )}
              </button>
            </form>
          </div>
          
          {/* Right: Created Student Info */}
          <div>
            {/* Instructions Card */}
            <div className="card mb-6">
              <h3 className="text-lg font-semibold text-secondary-900 mb-3">
                📋 Instructions
              </h3>
              <ul className="space-y-2 text-sm text-secondary-700">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">1.</span>
                  <span>Fill in the student's details in the form</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">2.</span>
                  <span>Use their official college email address</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">3.</span>
                  <span>Click "Add Student" to create their account</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">4.</span>
                  <span>Login credentials will be auto-generated and sent via email</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">5.</span>
                  <span>You can also copy and share credentials manually if needed</span>
                </li>
              </ul>
            </div>
            
            {/* Created Student Credentials */}
            {createdStudent && (
              <div className="card bg-gradient-to-br from-success-50 to-primary-50 border-2 border-success-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-success-900">
                    ✅ Student Created!
                  </h3>
                  {createdStudent.emailSent ? (
                    <span className="text-xs bg-success-600 text-white px-3 py-1 rounded-full">
                      📧 Email Sent
                    </span>
                  ) : (
                    <span className="text-xs bg-warning-600 text-white px-3 py-1 rounded-full">
                      ⚠️ Email Not Sent
                    </span>
                  )}
                </div>
                
                <div className="bg-white rounded-lg p-4 space-y-3 border border-success-200">
                  <div>
                    <p className="text-xs text-secondary-600 mb-1">Student Name</p>
                    <p className="font-semibold text-secondary-900">{createdStudent.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-secondary-600 mb-1">Email</p>
                    <p className="font-semibold text-secondary-900">{createdStudent.email}</p>
                  </div>
                  
                  <div className="pt-3 border-t border-secondary-200">
                    <p className="text-xs text-secondary-600 mb-2">Login Credentials</p>
                    
                    <div className="bg-secondary-50 rounded p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-secondary-600">User ID:</span>
                        <span className="font-mono font-bold text-primary-700">
                          {createdStudent.userId}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-secondary-600">Password:</span>
                        <span className="font-mono font-bold text-primary-700">
                          {createdStudent.password}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={copyCredentials}
                  className="btn btn-outline w-full mt-4"
                >
                  📋 Copy Credentials
                </button>
                
                {!createdStudent.emailSent && (
                  <div className="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                    <p className="text-xs text-warning-800">
                      <strong>⚠️ Note:</strong> Email could not be sent. Please share these credentials with the student manually.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Stats Card */}
            {!createdStudent && (
              <div className="card bg-gradient-to-br from-primary-50 to-secondary-50">
                <h3 className="text-lg font-semibold text-secondary-900 mb-3">
                  ℹ️ What Happens Next?
                </h3>
                <ul className="space-y-2 text-sm text-secondary-700">
                  <li className="flex items-start gap-2">
                    <span>🔑</span>
                    <span>A unique User ID and password will be generated automatically</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>📧</span>
                    <span>Credentials will be sent to the student's email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>👤</span>
                    <span>Student can login immediately using their credentials</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>🔒</span>
                    <span>Student should change their password on first login</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
