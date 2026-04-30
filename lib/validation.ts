// Input validation and sanitization utilities

/**
 * Sanitize text input by trimming whitespace and removing potentially harmful characters
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 10000); // Limit to 10k characters max
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate username format (alphanumeric, underscores, 3-30 chars)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Password validation with complexity requirements
 */
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }

  // Check for common weak passwords
  const weakPasswords = [
    'password', '12345678', 'qwerty', 'letmein', 'welcome',
    'password1', 'Password1', '123456789', 'admin123'
  ];
  if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password is too common');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate and sanitize notes/bio text
 */
export function sanitizeNotes(notes: string, maxLength: number = 500): string {
  if (!notes) return '';
  return sanitizeText(notes).slice(0, maxLength);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate image file
 */
export interface ImageValidation {
  isValid: boolean;
  error?: string;
}

export function validateImageFile(
  uri: string,
  fileSize?: number,
  maxSizeMB: number = 10
): ImageValidation {
  // Check file extension
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
  const extension = uri.split('.').pop()?.toLowerCase();

  if (!extension || !validExtensions.includes(extension)) {
    return {
      isValid: false,
      error: 'Please select a valid image (JPG, PNG, or WEBP)',
    };
  }

  // Check file size if provided
  if (fileSize && fileSize > maxSizeMB * 1024 * 1024) {
    return {
      isValid: false,
      error: `Image must be smaller than ${maxSizeMB}MB`,
    };
  }

  return { isValid: true };
}

/**
 * Sanitize name input
 */
export function sanitizeName(name: string): string {
  if (!name) return '';
  return sanitizeText(name)
    .replace(/[^a-zA-Z\s'-]/g, '') // Only allow letters, spaces, hyphens, apostrophes
    .slice(0, 100);
}
