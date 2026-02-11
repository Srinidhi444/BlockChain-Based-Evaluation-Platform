import { NextResponse } from 'next/server';
import { clearTokenCookie } from '@/lib/utils/auth';

export async function POST() {
  try {
    // Create response
    const response = NextResponse.json(
      {
        success: true,
        message: 'Logout successful',
      },
      { status: 200 }
    );
    
    // Clear token cookie
    response.headers.set('Set-Cookie', clearTokenCookie());
    
    return response;
    
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
