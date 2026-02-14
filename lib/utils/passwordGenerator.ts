/**
 * Generate a random secure password
 * Format: 8 characters with mix of uppercase, lowercase, numbers, and symbols
 * Example: aB3$xY9z
 */
export function generateRandomPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill rest with random characters
  for (let i = password.length; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Generate a memorable password (easier for students to type)
 * Format: Word + Number + Symbol
 * Example: Tiger@2024
 */
export function generateMemorablePassword(): string {
  const words = [
    'Tiger', 'Eagle', 'Shark', 'Panda', 'Falcon',
    'Wolf', 'Bear', 'Lion', 'Dragon', 'Phoenix',
    'Storm', 'Flash', 'Blaze', 'Frost', 'Thunder'
  ];
  
  const symbols = ['@', '#', '$', '!', '*'];
  
  const word = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  
  return `${word}${symbol}${number}`;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  message: string;
} {
  if (password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long'
    };
  }
  
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return {
      isValid: false,
      message: 'Password must contain uppercase, lowercase, and numbers'
    };
  }
  
  return {
    isValid: true,
    message: 'Password is strong'
  };
}
