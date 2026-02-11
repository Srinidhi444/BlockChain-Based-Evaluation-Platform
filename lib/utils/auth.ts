import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWTPayload, UserRole } from '@/lib/types';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined');
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hashed password
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Supports: "Bearer <token>" or just "<token>"
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

/**
 * Extract token from cookies
 */
export function extractTokenFromCookies(cookies: string | null): string | null {
  if (!cookies) return null;
  
  const tokenCookie = cookies
    .split(';')
    .find(c => c.trim().startsWith('token='));
  
  if (!tokenCookie) return null;
  
  return tokenCookie.split('=')[1];
}

/**
 * Get user from request headers
 * Checks both Authorization header and cookies
 */
export function getUserFromHeaders(headers: Headers): JWTPayload | null {
  // Try Authorization header first
  const authHeader = headers.get('authorization');
  let token = extractTokenFromHeader(authHeader);
  
  // If no token in header, try cookies
  if (!token) {
    const cookies = headers.get('cookie');
    token = extractTokenFromCookies(cookies);
  }
  
  if (!token) return null;
  
  return verifyToken(token);
}

/**
 * Check if user has required role
 */
export function hasRole(user: JWTPayload, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(user.role);
}

/**
 * Check if user is student
 */
export function isStudent(user: JWTPayload): boolean {
  return user.role === UserRole.STUDENT;
}

/**
 * Check if user is teacher
 */
export function isTeacher(user: JWTPayload): boolean {
  return user.role === UserRole.TEACHER;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: JWTPayload): boolean {
  return user.role === UserRole.ADMIN;
}

/**
 * Validate password strength
 * Requirements: At least 6 characters
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (password.length > 100) {
    errors.push('Password cannot exceed 100 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create HTTP-only cookie string for token
 * In development: SameSite=Lax, no HttpOnly for easier debugging
 * In production: SameSite=Lax, HttpOnly, Secure
 */
export function createTokenCookie(token: string): string {
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production: HttpOnly + Secure for maximum security
    return `token=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
  } else {
    // Development: No HttpOnly (for debugging), SameSite=Lax (allows redirects)
    return `token=${token}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  }
}

/**
 * Create cookie string to clear token
 */
export function clearTokenCookie(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return 'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure';
  } else {
    return 'token=; Path=/; Max-Age=0; SameSite=Lax';
  }
}

/**
 * Generate random password (for initial user creation)
 */
export function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}

/**
 * Sanitize user data (remove sensitive fields)
 */
export function sanitizeUser(user: any): any {
  const { password, ...safeUser } = user._doc || user;
  return safeUser;
}
