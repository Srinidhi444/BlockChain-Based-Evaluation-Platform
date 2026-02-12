'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Test {
  _id: string;
  testId: string;
  title: string;
  subject: string;
  department: string;
  examType: string;
  examDate: string;
  totalMarks: number;
}

export default function UploadPage() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [blockchainInfo, setBlockchainInfo] = useState<{
  submissionId: string;
  blockchainTxHash: string;
  fileHash: string;
} | null>(null);


  useEffect(() => {
    fetchAvailableTests();
  }, []);

  const fetchAvailableTests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/student/available-tests');
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch tests');
      }
      
      const data = await response.json();
      setTests(data.data.tests);
    } catch (err: any) {
      setError(err.message || 'Failed to load available tests');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) {
      setFile(null);
      setFilePreview(null);
      return;
    }
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Only PDF, JPEG, and PNG files are allowed');
      setFile(null);
      return;
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setError(`File size (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`);
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
    setError('');
    
    // Generate preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockchainInfo(null);

    if (!selectedTest) {
      setError('Please select a test');
      return;
    }
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    try {
      setUploading(true);
      setError('');
      setSuccess('');
      
      // Create FormData
      const formData = new FormData();
      formData.append('testId', selectedTest.testId);
      formData.append('answerSheet', file);
      
      console.log('Uploading:', {
        testId: selectedTest.testId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
      // Upload to server
      const response = await fetch('/api/student/upload', {
        method: 'POST',
        body: formData,
        // DON'T set Content-Type - browser sets it automatically with boundary
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('Upload failed full response:', data);

          throw new Error(data.error || 'Upload failed' );
        }

      const { submissionId, blockchainTxHash, fileHash } = data.data;

        setBlockchainInfo({
          submissionId,
          blockchainTxHash,
          fileHash
        });

        setSuccess('✅ Submission recorded on blockchain successfully!');

      
      // Reset form
      setFile(null);
      setFilePreview(null);
      setSelectedTest(null);
      
      // Refresh tests list
      fetchAvailableTests();
      
    
      
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload answer sheet');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-secondary-600">Loading available tests...</p>
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
              <Link href="/student-dashboard" className="text-secondary-600 hover:text-secondary-900">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-xl font-bold text-primary-600">
              Upload Answer Sheet
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <h2 className="text-2xl font-bold text-secondary-900 mb-6">
            Submit Your Answer Sheet
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-danger-700 text-sm font-medium">⚠️ {error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-success-50 border border-success-200 rounded-lg">
              <p className="text-success-700 text-sm font-medium">{success}</p>
            </div>
          )}
           {blockchainInfo && (
                <div className="mb-6 p-4 bg-secondary-50 border border-secondary-200 rounded-lg">
                  <h4 className="font-semibold text-secondary-900 mb-2">
                    🔗 Blockchain Verification Details
                  </h4>

                  <div className="text-sm space-y-2">
                    <p>
                      <span className="font-medium">Submission ID:</span>
                      <br />
                      {blockchainInfo.submissionId}
                    </p>

                    <p>
                      <span className="font-medium">File Hash (SHA-256):</span>
                      <br />
                      <span className="break-all">{blockchainInfo.fileHash}</span>
                    </p>

                    <p>
                      <span className="font-medium">Transaction Hash:</span>
                      <br />
                      <a
                        href={`https://sepolia.etherscan.io/tx/${blockchainInfo.blockchainTxHash}`}
                        target="_blank"
                        className="text-primary-600 underline break-all"
                      >
                        {blockchainInfo.blockchainTxHash}
                      </a>
                    </p>
                  </div>
                </div>
              )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Select Test */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Select Test <span className="text-danger-500">*</span>
              </label>
              
              {tests.length === 0 ? (
                <div className="p-6 bg-warning-50 border border-warning-200 rounded-lg text-center">
                  <p className="text-warning-800 font-medium">No tests available for submission at this time.</p>
                  <p className="text-sm text-warning-600 mt-2">
                    Check back later or contact your teacher.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {tests.map((test) => (
                    <div
                      key={test._id}
                      onClick={() => setSelectedTest(test)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedTest?._id === test._id
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-secondary-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-secondary-900">{test.title}</h3>
                          <p className="text-sm text-secondary-600 mt-1">
                            {test.subject} • {test.examType.toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-secondary-600">Total Marks</p>
                          <p className="font-semibold text-secondary-900">{test.totalMarks}</p>
                        </div>
                      </div>
                      <p className="text-xs text-secondary-500 mt-2">
                        Exam Date: {new Date(test.examDate).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Upload Answer Sheet <span className="text-danger-500">*</span>
              </label>
              
              <div className="border-2 border-dashed border-secondary-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  accept="application/pdf,image/jpeg,image/png,image/jpg"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={tests.length === 0}
                />
                
                <label
                  htmlFor="file-upload"
                  className={`cursor-pointer ${tests.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {file ? (
                    <div>
                      <div className="text-4xl mb-3">
                        {file.type === 'application/pdf' ? '📄' : '🖼️'}
                      </div>
                      <p className="font-medium text-secondary-900">{file.name}</p>
                      <p className="text-sm text-secondary-600 mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFile(null);
                          setFilePreview(null);
                        }}
                        className="mt-4 text-sm text-danger-600 hover:text-danger-700 font-medium"
                      >
                        Remove File
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-3">📁</div>
                      <p className="text-secondary-900 font-medium mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-sm text-secondary-600">
                        PDF, JPEG, PNG up to 10MB
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* Image Preview */}
              {filePreview && (
                <div className="mt-4">
                  <p className="text-sm text-secondary-700 mb-2 font-medium">Preview:</p>
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg border border-secondary-300 shadow-sm"
                  />
                </div>
              )}
            </div>

            {/* Important Notes */}
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <h4 className="font-semibold text-primary-900 mb-2 flex items-center">
                <span className="text-xl mr-2">📌</span>
                Important Notes:
              </h4>
              <ul className="text-sm text-primary-800 space-y-1.5 ml-7">
                <li>• Ensure your answer sheet is clear and readable</li>
                <li>• A unique hash will be generated to ensure integrity</li>
                <li>• This hash will be stored on blockchain for immutability</li>
                <li>• You cannot modify the submission after upload</li>
                <li>• Evaluation will be done anonymously by teachers</li>
              </ul>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={!selectedTest || !file || uploading}
                className="btn btn-primary flex-1 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  '📤 Submit Answer Sheet'
                )}
              </button>
              
              <Link
                href="/student-dashboard"
                className="btn btn-outline py-3 px-6"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
     

    </div>
    
  );
}
