/**
 * Generate a unique enquiry token ID
 * Format: ENQ-YYYYMMDD-XXXXXX
 */
export function generateTokenId(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const randomPart = generateRandomString(6);

  return `ENQ-${year}${month}${day}-${randomPart}`;
}

/**
 * Generate a random alphanumeric string
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
