'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Test {
  testId: string;
  title: string;
  subject: string;
  totalMarks: number;
  questions: Array<{
    questionNumber: number;
    marks: number;
    description?: string;
  }>;
}

interface Submission {
  submissionId: string;
  testId: string;
  studentName: string;
  department: string;
  year: number;
  division: string;
  subject: string;
  answerSheetUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileHash?: string;
  uploadedAt: string;
  status: string;
}

interface QuestionMark {
  questionNumber: number;
  maxMarks: number;
  marksObtained: number;
  comment: string;
}

export default function EvaluateSubmissionPage() {
  const router = useRouter();
  const params = useParams();
  const submissionId = params.submissionId as string;
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [questionMarks, setQuestionMarks] = useState<QuestionMark[]>([]);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Calculate totals
  const totalMarksObtained = questionMarks.reduce((sum, q) => sum + (q.marksObtained || 0), 0);
  const totalMarks = questionMarks.reduce((sum, q) => sum + q.maxMarks, 0);
  const percentage = totalMarks > 0 ? (totalMarksObtained / totalMarks) * 100 : 0;

  useEffect(() => {
    fetchEvaluationData();
  }, [submissionId]);

  const fetchEvaluationData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/teacher/submission/${submissionId}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch submission details');
      }
      
      const data = await response.json();
      setSubmission(data.data.submission);
      setTest(data.data.test);
      
      // Initialize question marks from test
      const initialMarks = data.data.test.questions.map((q: any) => ({
        questionNumber: q.questionNumber,
        maxMarks: q.marks,
        marksObtained: 0,
        comment: '',
      }));
      
      // If evaluation exists (draft or viewing), load it
      if (data.data.evaluation) {
        const evaluation = data.data.evaluation;
        setQuestionMarks(evaluation.questionMarks);
        setRemarks(evaluation.remarks || '');
      } else {
        setQuestionMarks(initialMarks);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to load evaluation data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarksChange = (questionNumber: number, value: string) => {
    const marks = parseFloat(value) || 0;
    const question = questionMarks.find(q => q.questionNumber === questionNumber);
    
    if (question && marks > question.maxMarks) {
      setError(`Marks for Question ${questionNumber} cannot exceed ${question.maxMarks}`);
      return;
    }
    
    setQuestionMarks(prev =>
      prev.map(q =>
        q.questionNumber === questionNumber
          ? { ...q, marksObtained: marks }
          : q
      )
    );
    setError('');
  };

  const handleCommentChange = (questionNumber: number, value: string) => {
    setQuestionMarks(prev =>
      prev.map(q =>
        q.questionNumber === questionNumber
          ? { ...q, comment: value }
          : q
      )
    );
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const response = await fetch('/api/teacher/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          questionMarks,
          remarks,
          isDraft: true,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save draft');
      }
      
      setSuccess('Draft saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    try {
      // Validate all questions are marked
      if (questionMarks.some(q => q.marksObtained === undefined || q.marksObtained === null)) {
        setError('Please mark all questions before finalizing');
        return;
      }
      
      const confirmed = confirm(
        `Are you sure you want to finalize this evaluation?\n\n` +
        `Total: ${totalMarksObtained}/${totalMarks} (${percentage.toFixed(2)}%)\n\n` +
        `This action cannot be undone and will be stored on blockchain.`
      );
      
      if (!confirmed) return;
      
      setSaving(true);
      setError('');
      setSuccess('');
      
      const response = await fetch('/api/teacher/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          questionMarks,
          remarks,
          isDraft: false,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to finalize evaluation');
      }
      
      setSuccess('Evaluation finalized successfully! Redirecting...');
      
      setTimeout(() => {
        router.push('/evaluate');
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to finalize evaluation');
    } finally {
      setSaving(false);
    }
  };

  const getGrade = () => {
    if (percentage >= 90) return { grade: 'A+', color: 'text-success-600' };
    if (percentage >= 80) return { grade: 'A', color: 'text-success-600' };
    if (percentage >= 70) return { grade: 'B+', color: 'text-success-500' };
    if (percentage >= 60) return { grade: 'B', color: 'text-primary-600' };
    if (percentage >= 50) return { grade: 'C', color: 'text-warning-600' };
    if (percentage >= 40) return { grade: 'D', color: 'text-warning-700' };
    return { grade: 'F', color: 'text-danger-600' };
  };

  // Check if file is PDF
  const isPDF = (submission: Submission) => {
    return submission.fileType === 'application/pdf' || 
           submission.answerSheetUrl.includes('data:application/pdf');
  };

  // Open file in new window
  const openInNewWindow = () => {
    if (!submission) return;
    
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Answer Sheet - ${submission.submissionId}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                display: flex; 
                flex-direction: column; 
                height: 100vh; 
                background: #f3f4f6;
              }
              .header {
                background: white;
                padding: 1rem;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .content {
                flex: 1;
                overflow: auto;
                display: flex;
                justify-content: center;
                align-items: start;
                padding: 1rem;
              }
              embed, iframe {
                width: 100%;
                height: 100%;
                border: none;
              }
              img {
                max-width: 100%;
                height: auto;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .btn {
                padding: 0.5rem 1rem;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 0.375rem;
                cursor: pointer;
                font-size: 0.875rem;
              }
              .btn:hover { background: #2563eb; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Answer Sheet - ${submission.fileName}</h2>
              <button class="btn" onclick="window.print()">🖨️ Print</button>
            </div>
            <div class="content">
              ${isPDF(submission) 
                ? `<embed src="${submission.answerSheetUrl}" type="application/pdf" />`
                : `<img src="${submission.answerSheetUrl}" alt="Answer Sheet" />`
              }
            </div>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-secondary-600">Loading evaluation...</p>
        </div>
      </div>
    );
  }

  if (!submission || !test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <p className="text-danger-600 mb-4">Submission not found</p>
          <Link href="/evaluate" className="btn btn-primary">
            Back to Submissions
          </Link>
        </div>
      </div>
    );
  }

  const isReadOnly = submission.status === 'evaluated' || submission.status === 'published';

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/evaluate" className="text-secondary-600 hover:text-secondary-900">
                ← Back to Submissions
              </Link>
            </div>
            <h1 className="text-xl font-bold text-primary-600">
              Evaluate Answer Sheet
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Answer Sheet Viewer */}
          <div className="space-y-6">
            {/* Submission Info */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">Submission Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary-600">Student:</span>
                  <span className="font-medium">Anonymous (Blind Evaluation)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600">Test:</span>
                  <span className="font-medium">{test.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600">Subject:</span>
                  <span className="font-medium">{submission.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600">Class:</span>
                  <span className="font-medium">
                    {submission.department} - Y{submission.year}, D{submission.division}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600">Uploaded:</span>
                  <span className="font-medium">
                    {new Date(submission.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Answer Sheet Viewer */}
            <div className="card sticky top-4">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                Answer Sheet
              </h3>
              
              {/* PDF/Image Viewer */}
              <div className="border-2 border-secondary-200 rounded-lg overflow-hidden bg-secondary-50">
                {isPDF(submission) ? (
                  // PDF Viewer
                  <embed
                    src={submission.answerSheetUrl}
                    type="application/pdf"
                    className="w-full h-[600px]"
                    title="Answer Sheet PDF"
                  />
                ) : (
                  // Image Viewer with scroll
                  <div className="w-full max-h-[600px] overflow-y-auto">
                    <img
                      src={submission.answerSheetUrl}
                      alt="Answer Sheet"
                      className="w-full h-auto"
                    />
                  </div>
                )}
              </div>
              
              {/* File Info */}
              <div className="mt-4 p-3 bg-secondary-50 rounded-lg text-xs space-y-1">
                <p className="flex justify-between">
                  <span className="text-secondary-600">File:</span>
                  <span className="font-medium text-secondary-900">{submission.fileName}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-secondary-600">Size:</span>
                  <span className="font-medium text-secondary-900">
                    {(submission.fileSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-secondary-600">Type:</span>
                  <span className="font-medium text-secondary-900">{submission.fileType}</span>
                </p>
                {submission.fileHash && (
                  <p className="flex justify-between">
                    <span className="text-secondary-600">Hash:</span>
                    <span className="font-mono text-xs text-secondary-900">
                      {submission.fileHash.substring(0, 16)}...
                    </span>
                  </p>
                )}
              </div>
              
              {/* Open in New Tab Button */}
              <button
                onClick={openInNewWindow}
                className="mt-4 w-full btn btn-outline flex items-center justify-center gap-2"
              >
                <span>📄</span>
                <span>Open in New Tab</span>
              </button>
            </div>
          </div>

          {/* Right: Marking Form */}
          <div className="space-y-6">
            {/* Messages */}
            {error && (
              <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                <p className="text-danger-700 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
                <p className="text-success-700 text-sm">{success}</p>
              </div>
            )}

            {/* Score Summary */}
            <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-primary-100 text-sm mb-1">Total Marks</p>
                  <p className="text-2xl font-bold">
                    {totalMarksObtained}/{totalMarks}
                  </p>
                </div>
                <div>
                  <p className="text-primary-100 text-sm mb-1">Percentage</p>
                  <p className="text-2xl font-bold">{percentage.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-primary-100 text-sm mb-1">Grade</p>
                  <p className="text-2xl font-bold">{getGrade().grade}</p>
                </div>
              </div>
            </div>

            {/* Question Marking */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Question-wise Marking</h3>
              <div className="space-y-4">
                {questionMarks.map((qm, index) => (
                  <div
                    key={qm.questionNumber}
                    className="p-4 bg-secondary-50 rounded-lg border border-secondary-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-semibold">Question {qm.questionNumber}</span>
                        {test.questions[index]?.description && (
                          <p className="text-xs text-secondary-600 mt-1">
                            {test.questions[index].description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-secondary-600">
                        Max: {qm.maxMarks}
                      </span>
                    </div>

                    <div className="grid gap-3">
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">
                          Marks Obtained
                        </label>
                        <input
                          type="number"
                          className="input"
                          min="0"
                          max={qm.maxMarks}
                          step="0.5"
                          value={qm.marksObtained || ''}
                          onChange={(e) => handleMarksChange(qm.questionNumber, e.target.value)}
                          disabled={isReadOnly}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">
                          Comment (Optional)
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={qm.comment}
                          onChange={(e) => handleCommentChange(qm.questionNumber, e.target.value)}
                          disabled={isReadOnly}
                          placeholder="Add feedback..."
                        />
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full bg-secondary-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            (qm.marksObtained / qm.maxMarks) * 100 >= 70
                              ? 'bg-success-500'
                              : (qm.marksObtained / qm.maxMarks) * 100 >= 40
                              ? 'bg-warning-500'
                              : 'bg-danger-500'
                          }`}
                          style={{ width: `${(qm.marksObtained / qm.maxMarks) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Remarks */}
            <div className="card">
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                General Remarks (Optional)
              </label>
              <textarea
                className="input min-h-[100px]"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={isReadOnly}
                placeholder="Add overall feedback for the student..."
              />
            </div>

            {/* Action Buttons */}
            {!isReadOnly && (
              <div className="flex gap-4">
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="btn btn-secondary flex-1"
                >
                  {saving ? 'Saving...' : '💾 Save Draft'}
                </button>
                
                <button
                  onClick={handleFinalize}
                  disabled={saving}
                  className="btn btn-success flex-1"
                >
                  {saving ? 'Finalizing...' : '✅ Finalize & Submit'}
                </button>
              </div>
            )}

            {isReadOnly && (
              <div className="card bg-success-50 border border-success-200 text-center">
                <p className="text-success-800 font-medium">
                  ✅ This evaluation has been finalized
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
