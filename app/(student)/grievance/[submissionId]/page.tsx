'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Evaluation {
    questionMarks: Array<{
        questionNumber: number;
        maxMarks: number;
        marksObtained: number;
        comment?: string;
    }>;
    totalMarksObtained: number;
    totalMarks: number;
    percentage: number;
    remarks?: string;
}

interface FormData {
    grievanceType: 'calculation_error' | 'reevaluation' | '';
    questionNumber: string;
    explanation: string;
}

export default function FileGrievancePage() {
    const router = useRouter();
    const params = useParams();
    const submissionId = params.submissionId as string;

    const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState<FormData>({
        grievanceType: '',
        questionNumber: '',
        explanation: '',
    });

    useEffect(() => {
        fetchEvaluationData();
    }, [submissionId]);

    const fetchEvaluationData = async () => {
        try {
            setLoading(true);

            // Fetch evaluation for this submission - FIXED
            const response = await fetch(`/api/student/results?submissionId=${submissionId}`);

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error('Failed to fetch evaluation');
            }

            const data = await response.json();
            setEvaluation(data.data.evaluation);

        } catch (err: any) {
            setError(err.message || 'Failed to load evaluation');
        } finally {
            setLoading(false);
        }
    };


    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        if (!formData.grievanceType) {
            setError('Please select grievance type');
            return;
        }

        if (formData.explanation.length < 20) {
            setError('Explanation must be at least 20 characters');
            return;
        }

        if (formData.explanation.length > 1000) {
            setError('Explanation cannot exceed 1000 characters');
            return;
        }

        try {
            setSubmitting(true);
            setError('');
            setSuccess('');

            const requestBody: any = {
                submissionId,
                grievanceType: formData.grievanceType,
                explanation: formData.explanation.trim(),
            };

            // Add question number if specified
            if (formData.questionNumber) {
                requestBody.questionNumber = parseInt(formData.questionNumber);
            }

            const response = await fetch('/api/student/grievance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to file grievance');
            }

            setSuccess('Grievance filed successfully! Redirecting...');

            // Redirect to results page after 2 seconds
            setTimeout(() => {
                router.push('/results');
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to file grievance');
        } finally {
            setSubmitting(false);
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

    if (!evaluation) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="card max-w-md text-center">
                    <p className="text-danger-600 mb-4">Evaluation not found</p>
                    <Link href="/results" className="btn btn-primary">
                        Back to Results
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-secondary-50">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b border-secondary-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/results" className="text-secondary-600 hover:text-secondary-900">
                                ← Back to Results
                            </Link>
                        </div>
                        <h1 className="text-xl font-bold text-primary-600">
                            File Grievance
                        </h1>
                        <div className="w-32"></div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Left: Current Marks */}
                    <div className="space-y-6">
                        <div className="card">
                            <h2 className="text-xl font-semibold text-secondary-900 mb-4">
                                Current Evaluation
                            </h2>

                            {/* Total Score */}
                            <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-lg p-4 mb-4">
                                <p className="text-sm text-primary-100 mb-1">Total Score</p>
                                <p className="text-3xl font-bold">
                                    {evaluation.totalMarksObtained}/{evaluation.totalMarks}
                                </p>
                                <p className="text-lg font-semibold mt-1">
                                    {evaluation.percentage.toFixed(2)}%
                                </p>
                            </div>

                            {/* Question-wise Marks */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-secondary-900">Question-wise Marks</h3>
                                {evaluation.questionMarks.map((q) => (
                                    <div
                                        key={q.questionNumber}
                                        className="p-3 bg-secondary-50 rounded-lg border border-secondary-200"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-semibold text-secondary-900">
                                                Question {q.questionNumber}
                                            </span>
                                            <span className="text-sm font-bold text-primary-600">
                                                {q.marksObtained}/{q.maxMarks}
                                            </span>
                                        </div>

                                        {q.comment && (
                                            <p className="text-xs text-secondary-600 italic">
                                                "{q.comment}"
                                            </p>
                                        )}

                                        {/* Progress bar */}
                                        <div className="mt-2 w-full bg-secondary-200 rounded-full h-2">
                                            <div
                                                className="h-2 rounded-full bg-primary-500"
                                                style={{ width: `${(q.marksObtained / q.maxMarks) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Remarks */}
                            {evaluation.remarks && (
                                <div className="mt-4 p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                                    <p className="text-sm font-semibold text-secondary-700 mb-1">
                                        Teacher's Remarks:
                                    </p>
                                    <p className="text-sm text-secondary-600 italic">
                                        "{evaluation.remarks}"
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Grievance Form */}
                    <div className="space-y-6">
                        <div className="card">
                            <h2 className="text-xl font-semibold text-secondary-900 mb-4">
                                Grievance Details
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Grievance Type */}
                                <div>
                                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                                        Grievance Type <span className="text-danger-500">*</span>
                                    </label>
                                    <select
                                        name="grievanceType"
                                        value={formData.grievanceType}
                                        onChange={handleInputChange}
                                        className="input"
                                        required
                                    >
                                        <option value="">Select Type</option>
                                        <option value="calculation_error">
                                            Calculation Error (Same Teacher)
                                        </option>
                                        <option value="reevaluation">
                                            Re-evaluation Request (Different Teacher)
                                        </option>
                                    </select>
                                    <p className="text-xs text-secondary-500 mt-1">
                                        {formData.grievanceType === 'calculation_error' && (
                                            'The same teacher will review for calculation mistakes'
                                        )}
                                        {formData.grievanceType === 'reevaluation' && (
                                            'A different teacher will re-evaluate your answer sheet'
                                        )}
                                    </p>
                                </div>

                                {/* Question Number (Optional) */}
                                <div>
                                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                                        Question Number (Optional)
                                    </label>
                                    <select
                                        name="questionNumber"
                                        value={formData.questionNumber}
                                        onChange={handleInputChange}
                                        className="input"
                                    >
                                        <option value="">All Questions</option>
                                        {evaluation.questionMarks.map((q) => (
                                            <option key={q.questionNumber} value={q.questionNumber}>
                                                Question {q.questionNumber} ({q.marksObtained}/{q.maxMarks})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-secondary-500 mt-1">
                                        Select a specific question or leave blank for entire evaluation
                                    </p>
                                </div>

                                {/* Explanation */}
                                <div>
                                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                                        Explanation <span className="text-danger-500">*</span>
                                    </label>
                                    <textarea
                                        name="explanation"
                                        value={formData.explanation}
                                        onChange={handleInputChange}
                                        className="input min-h-[150px]"
                                        placeholder="Explain why you believe the marks should be reviewed. Be specific and polite. (Min 20 characters)"
                                        required
                                        minLength={20}
                                        maxLength={1000}
                                    />
                                    <p className="text-xs text-secondary-500 mt-1">
                                        {formData.explanation.length}/1000 characters (minimum 20)
                                    </p>
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
                                    disabled={submitting}
                                    className="btn btn-primary w-full"
                                >
                                    {submitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Submitting Grievance...
                                        </span>
                                    ) : (
                                        '📝 Submit Grievance'
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Info Card */}
                        <div className="card bg-primary-50 border-primary-200">
                            <h3 className="font-semibold text-primary-900 mb-3">
                                ℹ️ Important Information
                            </h3>
                            <ul className="space-y-2 text-sm text-primary-800">
                                <li className="flex items-start gap-2">
                                    <span>•</span>
                                    <span>Grievances are reviewed within 3-5 working days</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span>•</span>
                                    <span>You can only file one grievance per submission</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span>•</span>
                                    <span>Re-evaluation results may increase, decrease, or remain same</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span>•</span>
                                    <span>You will be notified once the review is complete</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
