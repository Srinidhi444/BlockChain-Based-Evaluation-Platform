'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface QuestionMark {
    questionNumber: number;
    maxMarks: number;
    marksObtained: number;
    comment?: string;
}

interface Grievance {
    grievanceId: string;
    submissionId: string;
    studentName: string;
    grievanceType: 'calculation_error' | 'reevaluation';
    questionNumber?: number;
    explanation: string;
    status: string;
    filedAt: string;
}

interface Test {
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
    answerSheetUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
}

interface OriginalEvaluation {
    evaluationId: string;
    teacherName: string;
    questionMarks: QuestionMark[];
    totalMarksObtained: number;
    totalMarks: number;
    percentage: number;
    remarks?: string;
}

export default function ReEvaluatePage() {
    const router = useRouter();
    const params = useParams();
    const grievanceId = params.grievanceId as string;

    const [grievance, setGrievance] = useState<Grievance | null>(null);
    const [test, setTest] = useState<Test | null>(null);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [originalEvaluation, setOriginalEvaluation] = useState<OriginalEvaluation | null>(null);

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

    // Calculate difference from original
    const originalTotal = originalEvaluation?.totalMarksObtained || 0;
    const difference = totalMarksObtained - originalTotal;
    const percentageDiff = percentage - (originalEvaluation?.percentage || 0);

    useEffect(() => {
        fetchGrievanceData();
    }, [grievanceId]);

    const fetchGrievanceData = async () => {
        try {
            setLoading(true);

            const response = await fetch(`/api/teacher/grievance-details?grievanceId=${grievanceId}`);


            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error('Failed to fetch grievance details');
            }

            const data = await response.json();
            setGrievance(data.data.grievance);
            setTest(data.data.test);
            setSubmission(data.data.submission);
            setOriginalEvaluation(data.data.originalEvaluation);

            // Initialize question marks from original evaluation
            const initialMarks = data.data.originalEvaluation.questionMarks.map((q: QuestionMark) => ({
                questionNumber: q.questionNumber,
                maxMarks: q.maxMarks,
                marksObtained: q.marksObtained, // Start with original marks
                comment: q.comment || '',
            }));

            setQuestionMarks(initialMarks);

        } catch (err: any) {
            setError(err.message || 'Failed to load grievance data');
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

    const handleSubmit = async () => {
        try {
            // Validate all questions are marked
            if (questionMarks.some(q => q.marksObtained === undefined || q.marksObtained === null)) {
                setError('Please mark all questions before submitting');
                return;
            }

            const confirmed = confirm(
                `Are you sure you want to submit this re-evaluation?\n\n` +
                `Original: ${originalTotal}/${totalMarks} (${originalEvaluation?.percentage.toFixed(2)}%)\n` +
                `New: ${totalMarksObtained}/${totalMarks} (${percentage.toFixed(2)}%)\n` +
                `Difference: ${difference > 0 ? '+' : ''}${difference} marks (${percentageDiff > 0 ? '+' : ''}${percentageDiff.toFixed(2)}%)\n\n` +
                `This action cannot be undone.`
            );

            if (!confirmed) return;

            setSaving(true);
            setError('');
            setSuccess('');

            const response = await fetch('/api/teacher/reevaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grievanceId,
                    questionMarks,
                    remarks,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit re-evaluation');
            }

            setSuccess('Re-evaluation submitted successfully! Redirecting...');

            setTimeout(() => {
                router.push('/grievances');
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to submit re-evaluation');
        } finally {
            setSaving(false);
        }
    };

    const isPDF = (submission: Submission) => {
        return submission.fileType === 'application/pdf' ||
            submission.answerSheetUrl.includes('data:application/pdf');
    };

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
              body { display: flex; flex-direction: column; height: 100vh; background: #f3f4f6; }
              .header { background: white; padding: 1rem; border-bottom: 1px solid #e5e7eb; }
              .content { flex: 1; overflow: auto; display: flex; justify-content: center; align-items: start; padding: 1rem; }
              embed, iframe { width: 100%; height: 100%; border: none; }
              img { max-width: 100%; height: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            </style>
          </head>
          <body>
            <div class="header"><h2>Answer Sheet - ${submission.fileName}</h2></div>
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
                    <p className="mt-4 text-secondary-600">Loading grievance...</p>
                </div>
            </div>
        );
    }

    if (!grievance || !test || !submission || !originalEvaluation) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="card max-w-md text-center">
                    <p className="text-danger-600 mb-4">Grievance not found</p>
                    <Link href="/grievances" className="btn btn-primary">
                        Back to Grievances
                    </Link>
                </div>
            </div>
        );
    }

    const isReadOnly = grievance.status === 'completed';

    return (
        <div className="min-h-screen bg-secondary-50">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b border-secondary-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/grievances" className="text-secondary-600 hover:text-secondary-900">
                                ← Back to Grievances
                            </Link>
                        </div>
                        <h1 className="text-xl font-bold text-primary-600">
                            Re-evaluate Answer Sheet
                        </h1>
                        <div className="w-32"></div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: Answer Sheet & Grievance Info */}
                    <div className="space-y-6">
                        {/* Grievance Details */}
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-3">Grievance Details</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-secondary-600">Type:</span>
                                    <span className="font-medium">
                                        {grievance.grievanceType === 'calculation_error'
                                            ? 'Calculation Error'
                                            : 'Re-evaluation Request'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-secondary-600">Student:</span>
                                    <span className="font-medium">{grievance.studentName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-secondary-600">Test:</span>
                                    <span className="font-medium">{test.title}</span>
                                </div>
                                {grievance.questionNumber && (
                                    <div className="flex justify-between">
                                        <span className="text-secondary-600">Question:</span>
                                        <span className="font-medium">#{grievance.questionNumber}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-secondary-600">Filed:</span>
                                    <span className="font-medium">
                                        {new Date(grievance.filedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                                <p className="text-sm font-semibold text-warning-800 mb-1">
                                    Student's Explanation:
                                </p>
                                <p className="text-sm text-warning-700 italic">
                                    "{grievance.explanation}"
                                </p>
                            </div>
                        </div>

                        {/* Original Evaluation */}
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-3">Original Evaluation</h3>
                            <div className="bg-secondary-50 rounded-lg p-4 mb-3">
                                <p className="text-sm text-secondary-600 mb-1">Original Score</p>
                                <p className="text-2xl font-bold text-secondary-900">
                                    {originalEvaluation.totalMarksObtained}/{originalEvaluation.totalMarks}
                                </p>
                                <p className="text-lg font-semibold text-secondary-700">
                                    {originalEvaluation.percentage.toFixed(2)}%
                                </p>
                                <p className="text-xs text-secondary-600 mt-2">
                                    Evaluated by: {originalEvaluation.teacherName}
                                </p>
                            </div>

                            {/* Original question marks */}
                            <div className="space-y-2">
                                {originalEvaluation.questionMarks.map((q) => (
                                    <div
                                        key={q.questionNumber}
                                        className={`p-2 rounded border ${grievance.questionNumber === q.questionNumber
                                                ? 'bg-warning-50 border-warning-300'
                                                : 'bg-secondary-50 border-secondary-200'
                                            }`}
                                    >
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">Q{q.questionNumber}</span>
                                            <span className="font-bold">
                                                {q.marksObtained}/{q.maxMarks}
                                            </span>
                                        </div>
                                        {q.comment && (
                                            <p className="text-xs text-secondary-600 italic mt-1">"{q.comment}"</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Answer Sheet */}
                        <div className="card sticky top-4">
                            <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                                Answer Sheet
                            </h3>

                            <div className="border-2 border-secondary-200 rounded-lg overflow-hidden bg-secondary-50">
                                {isPDF(submission) ? (
                                    <embed
                                        src={submission.answerSheetUrl}
                                        type="application/pdf"
                                        className="w-full h-[500px]"
                                        title="Answer Sheet PDF"
                                    />
                                ) : (
                                    <div className="w-full max-h-[500px] overflow-y-auto">
                                        <img
                                            src={submission.answerSheetUrl}
                                            alt="Answer Sheet"
                                            className="w-full h-auto"
                                        />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={openInNewWindow}
                                className="mt-4 w-full btn btn-outline"
                            >
                                📄 Open in New Tab
                            </button>
                        </div>
                    </div>

                    {/* Right: Re-evaluation Form */}
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

                        {/* Score Comparison */}
                        <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                            <h3 className="text-lg font-semibold mb-3">Score Comparison</h3>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-primary-100 text-sm mb-1">Original</p>
                                    <p className="text-xl font-bold">
                                        {originalEvaluation.totalMarksObtained}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-primary-100 text-sm mb-1">New</p>
                                    <p className="text-xl font-bold">{totalMarksObtained}</p>
                                </div>
                                <div>
                                    <p className="text-primary-100 text-sm mb-1">Difference</p>
                                    <p className={`text-xl font-bold ${difference > 0 ? 'text-success-200' :
                                            difference < 0 ? 'text-danger-200' :
                                                'text-white'
                                        }`}>
                                        {difference > 0 ? '+' : ''}{difference}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Question Marking */}
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-4">Re-evaluation Marks</h3>
                            <div className="space-y-4">
                                {questionMarks.map((qm, index) => {
                                    const originalQ = originalEvaluation.questionMarks.find(
                                        q => q.questionNumber === qm.questionNumber
                                    );
                                    const diff = qm.marksObtained - (originalQ?.marksObtained || 0);

                                    return (
                                        <div
                                            key={qm.questionNumber}
                                            className={`p-4 rounded-lg border-2 ${grievance.questionNumber === qm.questionNumber
                                                    ? 'bg-warning-50 border-warning-300'
                                                    : 'bg-secondary-50 border-secondary-200'
                                                }`}
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
                                                <div className="text-right">
                                                    <span className="text-sm text-secondary-600">Max: {qm.maxMarks}</span>
                                                    {diff !== 0 && (
                                                        <p className={`text-xs font-bold ${diff > 0 ? 'text-success-600' : 'text-danger-600'
                                                            }`}>
                                                            {diff > 0 ? '+' : ''}{diff}
                                                        </p>
                                                    )}
                                                </div>
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
                                                        className={`h-2 rounded-full transition-all ${(qm.marksObtained / qm.maxMarks) * 100 >= 70
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
                                    );
                                })}
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
                                placeholder="Add overall feedback for the re-evaluation..."
                            />
                        </div>

                        {/* Submit Button */}
                        {!isReadOnly && (
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="btn btn-success w-full"
                            >
                                {saving ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Submitting Re-evaluation...
                                    </span>
                                ) : (
                                    '✅ Submit Re-evaluation'
                                )}
                            </button>
                        )}

                        {isReadOnly && (
                            <div className="card bg-success-50 border border-success-200 text-center">
                                <p className="text-success-800 font-medium">
                                    ✅ This re-evaluation has been completed
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
