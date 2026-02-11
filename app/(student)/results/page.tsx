'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Submission {
  _id: string;
  submissionId: string;
  testId: string;
  subject: string;
  status: string;
  uploadedAt: string;
  answerSheetUrl: string;
}

interface Evaluation {
  _id: string;
  evaluationId: string;
  totalMarksObtained: number;
  totalMarks: number;
  percentage: number;
  questionMarks: Array<{
    questionNumber: number;
    maxMarks: number;
    marksObtained: number;
    comment?: string;
  }>;
  remarks?: string;
  evaluatedAt: string;
  teacherName: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionIdParam = searchParams.get('submissionId');
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    if (submissionIdParam && submissions.length > 0) {
      const submission = submissions.find(s => s.submissionId === submissionIdParam);
      if (submission && (submission.status === 'evaluated' || submission.status === 'published')) {
        handleViewResult(submission);
      }
    }
  }, [submissionIdParam, submissions]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/student/submissions');
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch submissions');
      }
      
      const data = await response.json();
      // Filter only evaluated/published submissions
      const evaluatedSubmissions = data.data.submissions.filter(
        (s: Submission) => s.status === 'evaluated' || s.status === 'published'
      );
      setSubmissions(evaluatedSubmissions);
    } catch (err: any) {
      setError(err.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResult = async (submission: Submission) => {
    try {
      setLoadingEvaluation(true);
      setSelectedSubmission(submission);
      setError('');
      
      const response = await fetch(`/api/student/results?submissionId=${submission.submissionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch evaluation');
      }
      
      const data = await response.json();
      setEvaluation(data.data.evaluation);
    } catch (err: any) {
      setError(err.message || 'Failed to load evaluation details');
      setEvaluation(null);
    } finally {
      setLoadingEvaluation(false);
    }
  };

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: 'A+', color: 'text-success-600' };
    if (percentage >= 80) return { grade: 'A', color: 'text-success-600' };
    if (percentage >= 70) return { grade: 'B+', color: 'text-success-500' };
    if (percentage >= 60) return { grade: 'B', color: 'text-primary-600' };
    if (percentage >= 50) return { grade: 'C', color: 'text-warning-600' };
    if (percentage >= 40) return { grade: 'D', color: 'text-warning-700' };
    return { grade: 'F', color: 'text-danger-600' };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-secondary-600">Loading results...</p>
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
              My Results
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Submissions List */}
          <div className="md:col-span-1">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Evaluated Submissions</h2>
              
              {submissions.length === 0 ? (
                <div className="text-center py-8 text-secondary-500">
                  <div className="text-4xl mb-3">📭</div>
                  <p>No results available yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map((submission) => (
                    <button
                      key={submission._id}
                      onClick={() => handleViewResult(submission)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedSubmission?._id === submission._id
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-secondary-200 hover:border-primary-300'
                      }`}
                    >
                      <p className="font-medium text-secondary-900">{submission.subject}</p>
                      <p className="text-xs text-secondary-500 mt-1">
                        {new Date(submission.uploadedAt).toLocaleDateString()}
                      </p>
                      <span className="inline-block mt-2 badge badge-success">
                        {submission.status === 'published' ? 'Published' : 'Evaluated'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Evaluation Details */}
          <div className="md:col-span-2">
            {!selectedSubmission ? (
              <div className="card text-center py-12">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-secondary-600">Select a submission to view results</p>
              </div>
            ) : loadingEvaluation ? (
              <div className="card text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-secondary-600">Loading evaluation...</p>
              </div>
            ) : evaluation ? (
              <div className="space-y-6">
                {/* Score Card */}
                <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-primary-100 text-sm mb-1">Marks Obtained</p>
                      <p className="text-3xl font-bold">
                        {evaluation.totalMarksObtained}/{evaluation.totalMarks}
                      </p>
                    </div>
                    <div>
                      <p className="text-primary-100 text-sm mb-1">Percentage</p>
                      <p className="text-3xl font-bold">{evaluation.percentage.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-primary-100 text-sm mb-1">Grade</p>
                      <p className="text-3xl font-bold">
                        {getGrade(evaluation.percentage).grade}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Question-wise Marks */}
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Question-wise Breakdown</h3>
                  <div className="space-y-3">
                    {evaluation.questionMarks.map((qm) => (
                      <div
                        key={qm.questionNumber}
                        className="p-4 bg-secondary-50 rounded-lg border border-secondary-200"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">Question {qm.questionNumber}</span>
                          <span className="font-semibold">
                            {qm.marksObtained}/{qm.maxMarks}
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-secondary-200 rounded-full h-2 mb-2">
                          <div
                            className={`h-2 rounded-full ${
                              (qm.marksObtained / qm.maxMarks) * 100 >= 70
                                ? 'bg-success-500'
                                : (qm.marksObtained / qm.maxMarks) * 100 >= 40
                                ? 'bg-warning-500'
                                : 'bg-danger-500'
                            }`}
                            style={{ width: `${(qm.marksObtained / qm.maxMarks) * 100}%` }}
                          ></div>
                        </div>
                        
                        {qm.comment && (
                          <p className="text-sm text-secondary-600 italic mt-2">
                            💬 {qm.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Teacher Remarks */}
                {evaluation.remarks && (
                  <div className="card bg-primary-50 border border-primary-200">
                    <h3 className="text-lg font-semibold mb-3">Teacher's Remarks</h3>
                    <p className="text-secondary-700">{evaluation.remarks}</p>
                  </div>
                )}

                {/* Evaluation Info */}
                <div className="card bg-secondary-100">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-secondary-600">Evaluated By</p>
                      <p className="font-medium text-secondary-900">{evaluation.teacherName}</p>
                    </div>
                    <div>
                      <p className="text-secondary-600">Evaluated On</p>
                      <p className="font-medium text-secondary-900">
                        {new Date(evaluation.evaluatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Answer Sheet Link */}
                <div className="card">
                  <a
                    href={selectedSubmission.answerSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline w-full"
                  >
                    📄 View Submitted Answer Sheet
                  </a>
                </div>
              </div>
            ) : (
              <div className="card text-center py-12">
                <div className="text-5xl mb-4">❌</div>
                <p className="text-danger-600">{error || 'Failed to load evaluation'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
