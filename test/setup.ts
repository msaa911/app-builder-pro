import { vi } from 'vitest'
import React from 'react';
import '@testing-library/jest-dom';

// ===== Global AuthContext mock — AUTH-007 =====
// Default: authenticated user. Individual tests can override via vi.mock() in their file.
vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TestUser',
      },
    },
    session: { access_token: 'test-token' },
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    loginWithOAuth: vi.fn(),
    logout: vi.fn(),
    error: null,
    clearError: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock localStorage with actual storage implementation for jsdom
const createStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(key => delete store[key]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};

// Create storage instances that can be used for spying
const localStorageInstance = createStorageMock();
const sessionStorageInstance = createStorageMock();

// Use Object.defineProperty to allow proper spying while maintaining the mock behavior
Object.defineProperty(global, 'localStorage', {
  configurable: true,
  get: () => localStorageInstance,
});

Object.defineProperty(global, 'sessionStorage', {
  configurable: true,
  get: () => sessionStorageInstance,
});

// Mock fetch
global.fetch = vi.fn()

// Mock window.location
delete (window as any).location
window.location = { href: '', origin: 'http://localhost' } as Location

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock Element.prototype.scrollIntoView
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}