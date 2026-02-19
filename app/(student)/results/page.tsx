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

interface Grievance {
  grievanceId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  grievanceType: 'calculation_error' | 'reevaluation';
  filedAt: string;
}

interface ReEvaluation {
  reevaluationId: string;
  originalTotalMarksObtained: number;
  newTotalMarksObtained: number;
  originalPercentage: number;
  newPercentage: number;
  totalDifference: number;
  percentageDifference: number;
  comparisonData: Array<{
    questionNumber: number;
    maxMarks: number;
    oldMarksObtained: number;
    newMarksObtained: number;
    difference: number;
  }>;
  newRemarks?: string;
}

// ── NEW: blockchain verification types ──────────────────
type BlockchainStatus = 'verified' | 'tampered' | 'not_found' | 'error' | 'loading' | 'idle';

interface BlockchainVerification {
  status: BlockchainStatus;
  recomputedHash?: string;
  onChainEvaluationHash?: string;
  message?: string;
}
// ────────────────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionIdParam = searchParams.get('submissionId');

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [grievance, setGrievance] = useState<Grievance | null>(null);
  const [reevaluation, setReEvaluation] = useState<ReEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [error, setError] = useState('');

  // ── NEW: blockchain state ──────────────────────────────
  const [blockchainVerification, setBlockchainVerification] =
    useState<BlockchainVerification>({ status: 'idle' });
  // ──────────────────────────────────────────────────────

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    if (submissionIdParam && submissions.length > 0) {
      const submission = submissions.find(
        (s) => s.submissionId === submissionIdParam
      );
      if (
        submission &&
        (submission.status === 'evaluated' || submission.status === 'published')
      ) {
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
      const evaluatedSubmissions = data.data.submissions.filter(
        (s: Submission) =>
          s.status === 'evaluated' || s.status === 'published'
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
      setGrievance(null);
      setReEvaluation(null);
      // ── NEW: reset blockchain on every new submission select ──
      setBlockchainVerification({ status: 'idle' });
      // ──────────────────────────────────────────────────────────

      const response = await fetch(
        `/api/student/results?submissionId=${submission.submissionId}`
      );
      if (!response.ok) throw new Error('Failed to fetch evaluation');
      const data = await response.json();
      setEvaluation(data.data.evaluation);

      // Check grievance
      const grievanceResponse = await fetch(
        `/api/student/grievance?submissionId=${submission.submissionId}`
      );
      if (grievanceResponse.ok) {
        const grievanceData = await grievanceResponse.json();
        if (grievanceData.data.grievance) {
          setGrievance(grievanceData.data.grievance);
          if (
            grievanceData.data.grievance.status === 'completed' &&
            grievanceData.data.grievance.reevaluationId
          ) {
            const reevalResponse = await fetch(
              `/api/student/reevaluation?submissionId=${submission.submissionId}`
            );
            if (reevalResponse.ok) {
              const reevalData = await reevalResponse.json();
              setReEvaluation(reevalData.data.reevaluation);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load evaluation details');
      setEvaluation(null);
    } finally {
      setLoadingEvaluation(false);
    }
  };

  // ── NEW: blockchain verify function ───────────────────
  const handleVerifyBlockchain = async () => {
    if (!selectedSubmission) return;
    setBlockchainVerification({ status: 'loading' });
    try {
      const res = await fetch(
        `/api/student/verify-blockchain?submissionId=${selectedSubmission.submissionId}`
      );
      const data = await res.json();
      setBlockchainVerification({
        status:                data.status,
        recomputedHash:        data.recomputedHash,
        onChainEvaluationHash: data.onChainEvaluationHash,
        message:               data.message,
      });
    } catch (err: any) {
      setBlockchainVerification({
        status:  'error',
        message: err.message || 'Verification failed',
      });
    }
  };
  // ──────────────────────────────────────────────────────

  // ── NEW: badge renderer ───────────────────────────────
  const BlockchainBadge = () => {
    const { status, recomputedHash, onChainEvaluationHash, message } =
      blockchainVerification;

    if (status === 'idle') {
      return (
        <button
          onClick={handleVerifyBlockchain}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 
                     text-white px-3 py-1.5 rounded-full text-sm font-semibold 
                     transition-all border border-white/40"
        >
          🔗 Verify on Blockchain
        </button>
      );
    }

    if (status === 'loading') {
      return (
        <div className="flex items-center gap-2 bg-white/20 text-white 
                        px-3 py-1.5 rounded-full text-sm font-semibold border border-white/40">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
          Verifying...
        </div>
      );
    }

    if (status === 'verified') {
      return (
        <div className="group relative">
          <div className="flex items-center gap-2 bg-green-500 text-white 
                          px-3 py-1.5 rounded-full text-sm font-semibold 
                          shadow-lg cursor-pointer">
            ✅ Verified on Blockchain
          </div>
          {/* Hover tooltip with hashes */}
          <div className="absolute right-0 top-10 z-50 hidden group-hover:block 
                          bg-gray-900 text-white text-xs rounded-lg p-3 w-80 shadow-xl">
            <p className="font-bold text-green-400 mb-2">✅ Hashes Match</p>
            <p className="text-gray-400 mb-1">Recomputed:</p>
            <p className="font-mono break-all text-green-300 mb-2">
              {recomputedHash}
            </p>
            <p className="text-gray-400 mb-1">On-chain:</p>
            <p className="font-mono break-all text-green-300">
              {onChainEvaluationHash}
            </p>
          </div>
        </div>
      );
    }

    if (status === 'tampered') {
      return (
        <div className="group relative">
          <div className="flex items-center gap-2 bg-red-500 text-white 
                          px-3 py-1.5 rounded-full text-sm font-semibold 
                          shadow-lg cursor-pointer animate-pulse">
            ⚠️ Tampered!
          </div>
          {/* Hover tooltip with hash mismatch */}
          <div className="absolute right-0 top-10 z-50 hidden group-hover:block 
                          bg-gray-900 text-white text-xs rounded-lg p-3 w-80 shadow-xl">
            <p className="font-bold text-red-400 mb-2">⚠️ Hash Mismatch Detected</p>
            <p className="text-gray-400 mb-1">Recomputed from DB:</p>
            <p className="font-mono break-all text-yellow-300 mb-2">
              {recomputedHash}
            </p>
            <p className="text-gray-400 mb-1">On-chain stored:</p>
            <p className="font-mono break-all text-red-400">
              {onChainEvaluationHash}
            </p>
          </div>
        </div>
      );
    }

    if (status === 'not_found') {
      return (
        <div className="flex items-center gap-2 bg-gray-400 text-white 
                        px-3 py-1.5 rounded-full text-sm font-semibold">
          📋 Not on Blockchain
        </div>
      );
    }

    // error
    return (
      <div className="flex items-center gap-2 bg-orange-500 text-white 
                      px-3 py-1.5 rounded-full text-sm font-semibold"
           title={message}>
        ❌ Verify Failed
      </div>
    );
  };
  // ──────────────────────────────────────────────────────

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: 'A+', color: 'text-success-600' };
    if (percentage >= 80) return { grade: 'A', color: 'text-success-600' };
    if (percentage >= 70) return { grade: 'B+', color: 'text-success-500' };
    if (percentage >= 60) return { grade: 'B', color: 'text-primary-600' };
    if (percentage >= 50) return { grade: 'C', color: 'text-warning-600' };
    if (percentage >= 40) return { grade: 'D', color: 'text-warning-700' };
    return { grade: 'F', color: 'text-danger-600' };
  };

  const getGrievanceStatusBadge = (status: string) => {
    const badges = {
      pending:     { text: 'Pending Review', class: 'bg-warning-100 text-warning-800' },
      in_progress: { text: 'In Progress',    class: 'bg-primary-100 text-primary-800' },
      completed:   { text: 'Completed',      class: 'bg-success-100 text-success-800' },
      rejected:    { text: 'Rejected',       class: 'bg-danger-100 text-danger-800' },
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-secondary-600">Loading results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Nav */}
      <nav className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="text-secondary-600 hover:text-secondary-900">
              ← Back to Dashboard
            </Link>
            <h1 className="text-xl font-bold text-primary-600">My Results</h1>
            <div className="w-32" />
          </div>
        </div>
      </nav>

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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
                <p className="mt-4 text-secondary-600">Loading evaluation...</p>
              </div>
            ) : evaluation ? (
              <div className="space-y-6">

                {/* Grievance Status */}
                {grievance && (
                  <div className={`card border-2 ${
                    grievance.status === 'completed'   ? 'bg-success-50 border-success-200' :
                    grievance.status === 'in_progress' ? 'bg-primary-50 border-primary-200' :
                    'bg-warning-50 border-warning-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">📝 Grievance Filed</h3>
                        <p className="text-sm text-secondary-600">
                          Type: {grievance.grievanceType === 'calculation_error'
                            ? 'Calculation Error' : 'Re-evaluation'}
                        </p>
                        <p className="text-xs text-secondary-500 mt-1">
                          Filed on {new Date(grievance.filedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold 
                        ${getGrievanceStatusBadge(grievance.status).class}`}>
                        {getGrievanceStatusBadge(grievance.status).text}
                      </span>
                    </div>
                  </div>
                )}

                {/* Re-evaluation */}
                {reevaluation && (
                  <div className="card bg-gradient-to-br from-purple-50 to-primary-50 
                                  border-2 border-purple-300">
                    <h3 className="text-lg font-semibold mb-4 text-purple-900">
                      🔄 Re-evaluation Results
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-xs text-secondary-600 mb-1">Original</p>
                        <p className="text-xl font-bold text-secondary-900">
                          {reevaluation.originalTotalMarksObtained}
                        </p>
                        <p className="text-sm text-secondary-600">
                          {reevaluation.originalPercentage.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-xs text-secondary-600 mb-1">New</p>
                        <p className="text-xl font-bold text-purple-700">
                          {reevaluation.newTotalMarksObtained}
                        </p>
                        <p className="text-sm text-purple-600">
                          {reevaluation.newPercentage.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-xs text-secondary-600 mb-1">Difference</p>
                        <p className={`text-xl font-bold ${
                          reevaluation.totalDifference > 0 ? 'text-success-600' :
                          reevaluation.totalDifference < 0 ? 'text-danger-600' :
                          'text-secondary-600'
                        }`}>
                          {reevaluation.totalDifference > 0 ? '+' : ''}
                          {reevaluation.totalDifference}
                        </p>
                        <p className={`text-sm ${
                          reevaluation.percentageDifference > 0 ? 'text-success-600' :
                          reevaluation.percentageDifference < 0 ? 'text-danger-600' :
                          'text-secondary-600'
                        }`}>
                          {reevaluation.percentageDifference > 0 ? '+' : ''}
                          {reevaluation.percentageDifference.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-purple-900">
                        Question-wise Changes:
                      </h4>
                      {reevaluation.comparisonData.map(
                        (comp) =>
                          comp.difference !== 0 && (
                            <div
                              key={comp.questionNumber}
                              className="flex justify-between items-center p-2 bg-white rounded"
                            >
                              <span className="text-sm font-medium">
                                Q{comp.questionNumber}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-secondary-600">
                                  {comp.oldMarksObtained} → {comp.newMarksObtained}
                                </span>
                                <span className={`text-sm font-bold ${
                                  comp.difference > 0 ? 'text-success-600' : 'text-danger-600'
                                }`}>
                                  ({comp.difference > 0 ? '+' : ''}{comp.difference})
                                </span>
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  </div>
                )}

                {/* ── Score Card (with blockchain badge) ── */}
                <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      {reevaluation ? 'Current Score (After Re-evaluation)' : 'Your Score'}
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* ── NEW: Blockchain badge lives here ── */}
                      <BlockchainBadge />
                      {/* ───────────────────────────────────── */}
                      {!grievance && !reevaluation && (
                        <Link
                          href={`/grievance/${selectedSubmission.submissionId}`}
                          className="bg-white text-primary-600 px-3 py-1 rounded-full 
                                     text-sm font-semibold hover:bg-primary-50 transition-colors"
                        >
                          📝 File Grievance
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-primary-100 text-sm mb-1">Marks Obtained</p>
                      <p className="text-3xl font-bold">
                        {reevaluation
                          ? reevaluation.newTotalMarksObtained
                          : evaluation.totalMarksObtained}
                        /{evaluation.totalMarks}
                      </p>
                    </div>
                    <div>
                      <p className="text-primary-100 text-sm mb-1">Percentage</p>
                      <p className="text-3xl font-bold">
                        {reevaluation
                          ? reevaluation.newPercentage.toFixed(2)
                          : evaluation.percentage.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-primary-100 text-sm mb-1">Grade</p>
                      <p className="text-3xl font-bold">
                        {getGrade(
                          reevaluation
                            ? reevaluation.newPercentage
                            : evaluation.percentage
                        ).grade}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Question-wise Breakdown */}
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Question-wise Breakdown</h3>
                  <div className="space-y-3">
                    {evaluation.questionMarks.map((qm) => {
                      const reevalQ = reevaluation?.comparisonData.find(
                        (c) => c.questionNumber === qm.questionNumber
                      );
                      const currentMarks = reevalQ ? reevalQ.newMarksObtained : qm.marksObtained;
                      return (
                        <div
                          key={qm.questionNumber}
                          className="p-4 bg-secondary-50 rounded-lg border border-secondary-200"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium">Question {qm.questionNumber}</span>
                            <div className="text-right">
                              <span className="font-semibold">
                                {currentMarks}/{qm.maxMarks}
                              </span>
                              {reevalQ && reevalQ.difference !== 0 && (
                                <p className={`text-xs font-bold mt-1 ${
                                  reevalQ.difference > 0 ? 'text-success-600' : 'text-danger-600'
                                }`}>
                                  ({reevalQ.difference > 0 ? '+' : ''}{reevalQ.difference})
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-secondary-200 rounded-full h-2 mb-2">
                            <div
                              className={`h-2 rounded-full ${
                                (currentMarks / qm.maxMarks) * 100 >= 70
                                  ? 'bg-success-500'
                                  : (currentMarks / qm.maxMarks) * 100 >= 40
                                  ? 'bg-warning-500'
                                  : 'bg-danger-500'
                              }`}
                              style={{ width: `${(currentMarks / qm.maxMarks) * 100}%` }}
                            />
                          </div>
                          {qm.comment && (
                            <p className="text-sm text-secondary-600 italic mt-2">
                              💬 {qm.comment}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Teacher Remarks */}
                {(evaluation.remarks || reevaluation?.newRemarks) && (
                  <div className="card bg-primary-50 border border-primary-200">
                    <h3 className="text-lg font-semibold mb-3">Teacher's Remarks</h3>
                    {reevaluation?.newRemarks && (
                      <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded">
                        <p className="text-xs font-semibold text-purple-800 mb-1">
                          Re-evaluation Remarks:
                        </p>
                        <p className="text-secondary-700">{reevaluation.newRemarks}</p>
                      </div>
                    )}
                    {evaluation.remarks && (
                      <div>
                        <p className="text-xs font-semibold text-secondary-600 mb-1">
                          Original Remarks:
                        </p>
                        <p className="text-secondary-700">{evaluation.remarks}</p>
                      </div>
                    )}
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

                {/* Answer Sheet */}
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
