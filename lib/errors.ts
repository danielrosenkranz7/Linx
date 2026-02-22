import { toast } from './toast';

// Map common error codes/messages to user-friendly messages
const errorMessages: Record<string, string> = {
  // Auth errors
  'Invalid login credentials': 'Incorrect email or password',
  'Email not confirmed': 'Please check your email to confirm your account',
  'User already registered': 'An account with this email already exists',
  'Password should be at least 6 characters': 'Password must be at least 6 characters',

  // Network errors
  'Failed to fetch': 'No internet connection. Please check your network.',
  'Network request failed': 'No internet connection. Please check your network.',
  'TypeError: Network request failed': 'No internet connection. Please check your network.',

  // Supabase errors
  'JWT expired': 'Your session has expired. Please log in again.',
  'Invalid JWT': 'Your session has expired. Please log in again.',
  'row-level security': 'You don\'t have permission to do that.',

  // Storage errors
  'Payload too large': 'File is too large. Please choose a smaller file.',
  'Invalid file type': 'This file type is not supported.',
};

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Something went wrong';

  // Handle string errors
  if (typeof error === 'string') {
    return matchError(error);
  }

  // Handle Error objects
  if (error instanceof Error) {
    return matchError(error.message);
  }

  // Handle Supabase error objects
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (err.message && typeof err.message === 'string') {
      return matchError(err.message);
    }
    if (err.error_description && typeof err.error_description === 'string') {
      return matchError(err.error_description);
    }
  }

  return 'Something went wrong. Please try again.';
}

function matchError(message: string): string {
  // Check for exact matches
  if (errorMessages[message]) {
    return errorMessages[message];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(errorMessages)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Return a cleaned up version of the original message
  // Remove technical prefixes and make it more readable
  const cleaned = message
    .replace(/^(Error:|Exception:|Failed:)\s*/i, '')
    .replace(/\.$/, '');

  // If it's still too technical, return generic message
  if (cleaned.includes('undefined') || cleaned.includes('null') || cleaned.length > 100) {
    return 'Something went wrong. Please try again.';
  }

  return cleaned;
}

export function handleError(error: unknown, context?: string): void {
  const message = getErrorMessage(error);
  console.error(context ? `${context}:` : 'Error:', error);
  toast.error(message);
}

export function handleSuccess(message: string): void {
  toast.success(message);
}
