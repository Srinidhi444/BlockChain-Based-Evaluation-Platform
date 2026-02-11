'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Question {
  questionNumber: number;
  marks: number;
  description: string;
}

export default function CreateTestPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    department: '',
    year: 1,
    division: 'ALL',
    academicYear: '2025-26',
    examType: 'midterm',
    examDate: '',
    totalMarks: 0,
  });
  
  const [questions, setQuestions] = useState<Question[]>([
    { questionNumber: 1, marks: 0, description: '' }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) : value
    }));
  };

  const handleQuestionChange = (index: number, field: keyof Question, value: string | number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: field === 'marks' || field === 'questionNumber' ? Number(value) : value
    };
    setQuestions(updatedQuestions);
    
    // Auto-calculate total marks
    const total = updatedQuestions.reduce((sum, q) => sum + q.marks, 0);
    setFormData(prev => ({ ...prev, totalMarks: total }));
  };

  const addQuestion = () => {
    const newQuestionNumber = questions.length + 1;
    setQuestions([...questions, { questionNumber: newQuestionNumber, marks: 0, description: '' }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    const updatedQuestions = questions.filter((_, i) => i !== index);
    // Renumber questions
    const renumberedQuestions = updatedQuestions.map((q, i) => ({
      ...q,
      questionNumber: i + 1
    }));
    setQuestions(renumberedQuestions);
    
    // Recalculate total
    const total = renumberedQuestions.reduce((sum, q) => sum + q.marks, 0);
    setFormData(prev => ({ ...prev, totalMarks: total }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate
    if (questions.some(q => q.marks <= 0)) {
      setError('All questions must have marks greater than 0');
      return;
    }
    
    if (formData.totalMarks === 0) {
      setError('Total marks must be greater than 0');
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/teacher/create-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          questions
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create test');
      }
      
      setSuccess('Test created successfully!');
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create test');
    } finally {
      setLoading(false);
    }
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
              Create Test
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <h2 className="text-2xl font-bold text-secondary-900 mb-6">
            Create Question Paper
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-danger-700 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-success-50 border border-success-200 rounded-lg">
              <p className="text-success-700 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Test Title <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="input"
                  placeholder="e.g., Data Structures Mid-term"
                  value={formData.title}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Subject <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  required
                  className="input"
                  placeholder="e.g., Data Structures"
                  value={formData.subject}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Department <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  name="department"
                  required
                  className="input"
                  placeholder="e.g., Computer Science"
                  value={formData.department}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Year <span className="text-danger-500">*</span>
                </label>
                <select
                  name="year"
                  required
                  className="input"
                  value={formData.year}
                  onChange={handleInputChange}
                >
                  <option value={1}>First Year</option>
                  <option value={2}>Second Year</option>
                  <option value={3}>Third Year</option>
                  <option value={4}>Fourth Year</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Division
                </label>
                <input
                  type="text"
                  name="division"
                  className="input"
                  placeholder="A, B, C or ALL"
                  value={formData.division}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Academic Year <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  name="academicYear"
                  required
                  className="input"
                  placeholder="2025-26"
                  value={formData.academicYear}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Exam Type <span className="text-danger-500">*</span>
                </label>
                <select
                  name="examType"
                  required
                  className="input"
                  value={formData.examType}
                  onChange={handleInputChange}
                >
                  <option value="midterm">Mid-term</option>
                  <option value="endsem">End Semester</option>
                  <option value="assignment">Assignment</option>
                  <option value="quiz">Quiz</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Exam Date <span className="text-danger-500">*</span>
                </label>
                <input
                  type="date"
                  name="examDate"
                  required
                  className="input"
                  value={formData.examDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Questions Section */}
            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Questions</h3>
                <div className="text-sm text-secondary-600">
                  Total Marks: <span className="font-bold text-primary-600">{formData.totalMarks}</span>
                </div>
              </div>

              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={index} className="p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-medium">Question {question.questionNumber}</span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          className="text-danger-600 hover:text-danger-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          placeholder="Question description (optional)"
                          className="input"
                          value={question.description}
                          onChange={(e) => handleQuestionChange(index, 'description', e.target.value)}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Marks"
                          className="input"
                          min="0"
                          required
                          value={question.marks || ''}
                          onChange={(e) => handleQuestionChange(index, 'marks', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addQuestion}
                className="mt-4 btn btn-outline w-full"
              >
                + Add Question
              </button>
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-6 border-t">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary flex-1 py-3 text-lg"
              >
                {loading ? 'Creating Test...' : 'Create Test'}
              </button>
              
              <Link href="/dashboard" className="btn btn-outline py-3 px-6">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
