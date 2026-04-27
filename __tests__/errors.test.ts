// Test the error message mapping logic directly
// We extract the core logic without React Native dependencies

// Replicate the error mapping logic for testing
const errorMessages: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password',
  'Email not confirmed': 'Please check your email to confirm your account',
  'User already registered': 'An account with this email already exists',
  'Password should be at least 6 characters': 'Password must be at least 6 characters',
  'Failed to fetch': 'No internet connection. Please check your network.',
  'Network request failed': 'No internet connection. Please check your network.',
  'TypeError: Network request failed': 'No internet connection. Please check your network.',
  'JWT expired': 'Your session has expired. Please log in again.',
  'Invalid JWT': 'Your session has expired. Please log in again.',
  'row-level security': "You don't have permission to do that.",
  'Payload too large': 'File is too large. Please choose a smaller file.',
  'Invalid file type': 'This file type is not supported.',
};

function matchError(message: string): string {
  if (errorMessages[message]) {
    return errorMessages[message];
  }

  for (const [key, value] of Object.entries(errorMessages)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  const cleaned = message
    .replace(/^(Error:|Exception:|Failed:)\s*/i, '')
    .replace(/\.$/, '');

  if (cleaned.includes('undefined') || cleaned.includes('null') || cleaned.length > 100) {
    return 'Something went wrong. Please try again.';
  }

  return cleaned;
}

function getErrorMessage(error: unknown): string {
  if (!error) return 'Something went wrong';

  if (typeof error === 'string') {
    return matchError(error);
  }

  if (error instanceof Error) {
    return matchError(error.message);
  }

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

describe('getErrorMessage', () => {
  it('returns generic message for null/undefined', () => {
    expect(getErrorMessage(null)).toBe('Something went wrong');
    expect(getErrorMessage(undefined)).toBe('Something went wrong');
  });

  it('handles string errors', () => {
    expect(getErrorMessage('Invalid login credentials')).toBe('Incorrect email or password');
    expect(getErrorMessage('Email not confirmed')).toBe('Please check your email to confirm your account');
  });

  it('handles Error objects', () => {
    const error = new Error('Invalid login credentials');
    expect(getErrorMessage(error)).toBe('Incorrect email or password');
  });

  it('handles Supabase-style error objects', () => {
    const error = { message: 'User already registered' };
    expect(getErrorMessage(error)).toBe('An account with this email already exists');
  });

  it('handles error_description field', () => {
    const error = { error_description: 'Password should be at least 6 characters' };
    expect(getErrorMessage(error)).toBe('Password must be at least 6 characters');
  });

  it('handles network errors', () => {
    expect(getErrorMessage('Failed to fetch')).toBe('No internet connection. Please check your network.');
    expect(getErrorMessage('Network request failed')).toBe('No internet connection. Please check your network.');
  });

  it('handles JWT errors', () => {
    expect(getErrorMessage('JWT expired')).toBe('Your session has expired. Please log in again.');
    expect(getErrorMessage('Invalid JWT')).toBe('Your session has expired. Please log in again.');
  });

  it('handles partial matches (case insensitive)', () => {
    expect(getErrorMessage('Error: INVALID LOGIN CREDENTIALS')).toBe('Incorrect email or password');
    expect(getErrorMessage('Something with jwt expired in it')).toBe('Your session has expired. Please log in again.');
  });

  it('cleans up technical error messages', () => {
    expect(getErrorMessage('Error: Something happened')).toBe('Something happened');
    expect(getErrorMessage('Exception: Database error')).toBe('Database error');
  });

  it('returns generic message for overly technical errors', () => {
    expect(getErrorMessage('undefined is not an object')).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage('Cannot read property null of undefined')).toBe('Something went wrong. Please try again.');
  });

  it('handles very long error messages', () => {
    const longError = 'A'.repeat(150);
    expect(getErrorMessage(longError)).toBe('Something went wrong. Please try again.');
  });
});
