/**
 * vercelApi service tests
 *
 * Tests Vercel REST API client:
 * - createDeployment request shape and auth header
 * - pollDeployment loop, timeout, error states
 * - CORS error handling
 *
 * @module services/deploy/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDeployment, pollDeployment } from '../vercelApi';
import type { VercelDeploymentFile } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('vercelApi', () => {
  const mockToken = 'test-vercel-token-123';
  const mockFiles: VercelDeploymentFile[] = [
    { file: 'index.html', data: btoa('<html></html>'), encoding: 'base64' },
    { file: 'src/App.tsx', data: btoa('export default function App() {}'), encoding: 'base64' },
  ];

  describe('createDeployment', () => {
    it('should POST to /v13/deployments with correct shape and auth header', async () => {
      const mockResponse = {
        id: 'dep_123',
        url: 'https://my-app.vercel.app',
        state: 'BUILDING',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await createDeployment(mockToken, mockFiles, 'my-app');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.vercel.com/v13/deployments');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe(`Bearer ${mockToken}`);
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.name).toBe('my-app');
      expect(body.target).toBe('production');
      expect(body.files).toEqual(mockFiles);
    });

    it('should throw with error message when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Invalid token' } }),
      });

      await expect(createDeployment(mockToken, mockFiles, 'my-app')).rejects.toThrow(
        'Vercel API error: 401 Unauthorized - Invalid token'
      );
    });

    it('should throw on network failure (e.g., CORS blocked)', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(createDeployment(mockToken, mockFiles, 'my-app')).rejects.toThrow(
        'Network error'
      );
    });

    it('should default project name if not provided', async () => {
      const mockResponse = { id: 'dep_456', url: 'https://app.vercel.app', state: 'QUEUED' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await createDeployment(mockToken, mockFiles);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.name).toMatch(/^app-/);
    });
  });

  describe('pollDeployment', () => {
    it('should return URL when deployment state is READY', async () => {
      // First poll: BUILDING, second poll: READY
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ id: 'dep_123', url: 'https://my-app.vercel.app', state: 'BUILDING' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ id: 'dep_123', url: 'https://my-app.vercel.app', state: 'READY' }),
        });

      const result = await pollDeployment('dep_123', mockToken, { maxAttempts: 5, intervalMs: 10 });

      expect(result.url).toBe('https://my-app.vercel.app');
      expect(result.state).toBe('READY');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw when deployment state is ERROR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'dep_123', url: '', state: 'ERROR' }),
      });

      await expect(
        pollDeployment('dep_123', mockToken, { maxAttempts: 5, intervalMs: 10 })
      ).rejects.toThrow('Deployment failed');
    });

    it('should throw on poll timeout after max attempts', async () => {
      // Always return BUILDING (never READY)
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'dep_123', url: '', state: 'BUILDING' }),
      });

      await expect(
        pollDeployment('dep_123', mockToken, { maxAttempts: 3, intervalMs: 10 })
      ).rejects.toThrow('Deployment timed out');
    });

    it('should include Authorization header in poll requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ id: 'dep_123', url: 'https://app.vercel.app', state: 'READY' }),
      });

      await pollDeployment('dep_123', mockToken, { maxAttempts: 5, intervalMs: 10 });

      const options = mockFetch.mock.calls[0][1];
      expect(options.headers['Authorization']).toBe(`Bearer ${mockToken}`);
    });

    it('should throw when deployment state is CANCELED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'dep_123', url: '', state: 'CANCELED' }),
      });

      await expect(
        pollDeployment('dep_123', mockToken, { maxAttempts: 5, intervalMs: 10 })
      ).rejects.toThrow('canceled');
    });

    it('should handle JSON parse failure in error response (falls back to statusText)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('invalid json')),
      });

      await expect(createDeployment(mockToken, mockFiles, 'my-app')).rejects.toThrow(
        'Vercel API error: 500 Internal Server Error - Internal Server Error'
      );
    });

    it('should use Unknown error when both json parse fails and statusText is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: '',
        json: () => Promise.reject(new Error('invalid json')),
      });

      await expect(createDeployment(mockToken, mockFiles, 'my-app')).rejects.toThrow(
        'Unknown error'
      );
    });

    it('should throw on non-ok poll response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: { message: 'Access denied' } }),
      });

      await expect(
        pollDeployment('dep_123', mockToken, { maxAttempts: 5, intervalMs: 10 })
      ).rejects.toThrow('Vercel API error');
    });

    it('should handle JSON parse failure in poll error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('invalid json')),
      });

      await expect(
        pollDeployment('dep_123', mockToken, { maxAttempts: 5, intervalMs: 10 })
      ).rejects.toThrow('Internal Server Error');
    });

    it('should use Unknown error in poll when both json parse and statusText fail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: '',
        json: () => Promise.reject(new Error('invalid json')),
      });

      await expect(
        pollDeployment('dep_123', mockToken, { maxAttempts: 5, intervalMs: 10 })
      ).rejects.toThrow('Unknown error');
    });
  });
});
