// Minimal setup for utility function testing
// We're testing lib/ utilities only, not React Native components

// Silence console in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};
