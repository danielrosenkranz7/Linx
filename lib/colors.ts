// Linx Color System

// Rating color thresholds: 1-4 red/orange, 4-7 yellow, 7-10 green
export const getRatingColor = (rating: number): { background: string; border: string } => {
  if (rating < 4) {
    return { background: '#fee2e2', border: '#fecaca' }; // Red/orange
  } else if (rating < 7) {
    return { background: '#fef9c3', border: '#fde047' }; // Yellow
  } else {
    return { background: '#dcfce7', border: '#86efac' }; // Green
  }
};

export const colors = {
  // Brand
  primary: '#16a34a',        // Linx green
  primaryLight: '#f0fdf4',   // Light green background
  primaryBorder: '#86efac',  // Green border

  // Neutrals
  white: '#ffffff',
  background: '#f9fafb',
  border: '#e5e7eb',
  textPrimary: '#1a1a1a',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  placeholder: '#d1d5db',

  // Semantic - Success (same as primary for consistency)
  success: '#16a34a',
  successLight: '#f0fdf4',
  successBorder: '#86efac',

  // Semantic - Error/Destructive
  error: '#dc2626',
  errorLight: '#fef2f2',
  errorBorder: '#fecaca',

  // Semantic - Warning
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  warningBorder: '#fde68a',

  // Semantic - Info
  info: '#3b82f6',
  infoLight: '#eff6ff',
  infoBorder: '#bfdbfe',
};
