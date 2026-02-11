import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode for better error detection
  reactStrictMode: true,
  
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  
  // Experimental features (if needed)
  experimental: {
    // Enable if you want to use server actions
    serverActions: {
      bodySizeLimit: '10mb', // For file uploads
    },
  },
};

export default nextConfig;
