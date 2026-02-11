import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Answer Sheet Evaluation System',
  description: 'Blockchain-based transparent answer sheet evaluation platform for students and teachers',
  keywords: ['education', 'evaluation', 'blockchain', 'answer sheets', 'transparency'],
  authors: [{ name: 'Your Institution' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0ea5e9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-secondary-50">
        {children}
      </body>
    </html>
  );
}
