import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700">
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <div className="bg-white rounded-2xl shadow-2xl p-12">
          <h1 className="text-5xl font-bold text-secondary-900 mb-4">
            Answer Sheet Evaluation System
          </h1>
          <p className="text-xl text-secondary-600 mb-8">
            Blockchain-powered transparent and immutable evaluation platform
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 bg-primary-50 rounded-lg">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="font-semibold text-lg mb-2">Secure</h3>
              <p className="text-sm text-secondary-600">
                Answer sheets stored with blockchain hash verification
              </p>
            </div>
            
            <div className="p-6 bg-success-50 rounded-lg">
              <div className="text-4xl mb-3">👁️</div>
              <h3 className="font-semibold text-lg mb-2">Transparent</h3>
              <p className="text-sm text-secondary-600">
                Anonymous evaluation prevents bias and ensures fairness
              </p>
            </div>
            
            <div className="p-6 bg-warning-50 rounded-lg">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="font-semibold text-lg mb-2">Immutable</h3>
              <p className="text-sm text-secondary-600">
                Results stored on blockchain cannot be altered
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <Link
              href="/login"
              className="inline-block w-full md:w-auto px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Login to Get Started
            </Link>
            
            <div className="flex items-center justify-center gap-8 text-sm text-secondary-600 mt-8">
              <div>
                <span className="font-semibold text-secondary-900">Students:</span> Upload answer sheets securely
              </div>
              <div className="hidden md:block">•</div>
              <div>
                <span className="font-semibold text-secondary-900">Teachers:</span> Evaluate anonymously
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-white text-sm">
          <p>© 2026 Answer Sheet Evaluation System. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
