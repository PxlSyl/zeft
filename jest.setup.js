// This file allows adding additional configurations for Jest

// Enable jest-dom matchers to make React testing easier
require('@testing-library/jest-dom');

// Suppress logs during tests
global.console = {
    ...global.console,
    // Don't display non-critical messages during tests
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Keep warnings and errors visible
    warn: global.console.warn,
    error: global.console.error,
}; 