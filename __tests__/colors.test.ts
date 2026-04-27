import { getRatingColor, colors } from '../lib/colors';

describe('getRatingColor', () => {
  it('returns red/orange colors for ratings below 4', () => {
    expect(getRatingColor(1)).toEqual({ background: '#fee2e2', border: '#fecaca' });
    expect(getRatingColor(2.5)).toEqual({ background: '#fee2e2', border: '#fecaca' });
    expect(getRatingColor(3.9)).toEqual({ background: '#fee2e2', border: '#fecaca' });
  });

  it('returns yellow colors for ratings between 4 and 7', () => {
    expect(getRatingColor(4)).toEqual({ background: '#fef9c3', border: '#fde047' });
    expect(getRatingColor(5.5)).toEqual({ background: '#fef9c3', border: '#fde047' });
    expect(getRatingColor(6.9)).toEqual({ background: '#fef9c3', border: '#fde047' });
  });

  it('returns green colors for ratings 7 and above', () => {
    expect(getRatingColor(7)).toEqual({ background: '#dcfce7', border: '#86efac' });
    expect(getRatingColor(8.5)).toEqual({ background: '#dcfce7', border: '#86efac' });
    expect(getRatingColor(10)).toEqual({ background: '#dcfce7', border: '#86efac' });
  });

  it('handles edge cases', () => {
    expect(getRatingColor(0)).toEqual({ background: '#fee2e2', border: '#fecaca' });
    expect(getRatingColor(-1)).toEqual({ background: '#fee2e2', border: '#fecaca' });
  });
});

describe('colors object', () => {
  it('has primary brand colors', () => {
    expect(colors.primary).toBe('#16a34a');
    expect(colors.primaryLight).toBe('#f0fdf4');
    expect(colors.primaryBorder).toBe('#86efac');
  });

  it('has semantic colors', () => {
    expect(colors.success).toBe('#16a34a');
    expect(colors.error).toBe('#dc2626');
    expect(colors.warning).toBe('#f59e0b');
    expect(colors.info).toBe('#3b82f6');
  });

  it('has neutral colors', () => {
    expect(colors.white).toBe('#ffffff');
    expect(colors.textPrimary).toBe('#1a1a1a');
    expect(colors.textSecondary).toBe('#6b7280');
  });
});
