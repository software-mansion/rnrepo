import { test, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  fetchMavenArtifacts,
  isOnMaven,
  isCombinationOnMaven,
  makeMavenArtifactName,
  clearMavenCache,
} from './maven';

// Mock fetch globally
const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof mock>;

beforeEach(() => {
  mockFetch = mock(() => {
    throw new Error('fetch not mocked');
  });
  globalThis.fetch = mockFetch as typeof fetch;
  clearMavenCache(); // Clear cache between tests
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('fetchMavenArtifacts - keeps full artifact names', async () => {
  // Maven versions are like "1.0.0-rn0.79.0", we keep the full artifact names
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      versions: ['1.0.0-rn0.79.0', '1.0.0-rn0.80.0', '2.0.0-rn0.79.0'],
    }),
  } as Response);

  const artifacts = await fetchMavenArtifacts('test-package');

  expect(artifacts).not.toBeNull();
  expect(artifacts?.has('1.0.0-rn0.79.0')).toBe(true);
  expect(artifacts?.has('1.0.0-rn0.80.0')).toBe(true);
  expect(artifacts?.has('2.0.0-rn0.79.0')).toBe(true);
  expect(artifacts?.has('1.0.0')).toBe(false); // Should keep full names, not extract base version
});

test('fetchMavenArtifacts - caches results', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ versions: ['1.0.0-rn0.79.0'] }),
  } as Response);

  const first = await fetchMavenArtifacts('test-package');
  const second = await fetchMavenArtifacts('test-package');

  // Should only call fetch once due to caching
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(first).toEqual(second);
});

test('fetchMavenArtifacts - handles errors and caches null', async () => {
  // Suppress console.error for this test since we're testing error handling
  const originalConsoleError = console.error;
  console.error = () => {}; // Suppress error output

  try {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    const first = await fetchMavenArtifacts('nonexistent');
    const second = await fetchMavenArtifacts('nonexistent');

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1); // Cached after first call
  } finally {
    // Restore console.error
    console.error = originalConsoleError;
  }
});

test('isOnMaven - returns true when version exists', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      versions: ['1.0.0-rn0.79.0', '2.0.0-rn0.80.0'],
    }),
  } as Response);

  const result = await isOnMaven('test-package', '1.0.0');
  expect(result).toBe(true);
});

test('isOnMaven - returns false when version does not exist', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      versions: ['1.0.0-rn0.79.0'],
    }),
  } as Response);

  const result = await isOnMaven('test-package', '2.0.0');
  expect(result).toBe(false);
});

test('isOnMaven - returns false when Maven fetch fails', async () => {
  // Suppress console.error for this test since we're testing error handling
  const originalConsoleError = console.error;
  console.error = () => {}; // Suppress error output

  try {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response);

    const result = await isOnMaven('test-package', '1.0.0');
    expect(result).toBe(false);
  } finally {
    // Restore console.error
    console.error = originalConsoleError;
  }
});

test('isCombinationOnMaven - returns true when exact combination exists', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      versions: ['1.0.0-rn0.79.0', '1.0.0-rn0.80.0', '2.0.0-rn0.79.0'],
    }),
  } as Response);

  const result = await isCombinationOnMaven('test-package', '1.0.0', '0.79.0');
  expect(result).toBe(true);
});

test('isCombinationOnMaven - returns false when combination does not exist', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      versions: ['1.0.0-rn0.79.0', '1.0.0-rn0.80.0'],
    }),
  } as Response);

  const result = await isCombinationOnMaven('test-package', '1.0.0', '0.81.0');
  expect(result).toBe(false);
});

test('isCombinationOnMaven - returns false when package version exists but different RN version', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      versions: ['1.0.0-rn0.79.0'],
    }),
  } as Response);

  const result = await isCombinationOnMaven('test-package', '1.0.0', '0.80.0');
  expect(result).toBe(false); // Same package version but different RN version
});

test('isCombinationOnMaven - returns false when Maven fetch fails', async () => {
  // Suppress console.error for this test since we're testing error handling
  const originalConsoleError = console.error;
  console.error = () => {}; // Suppress error output

  try {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response);

    const result = await isCombinationOnMaven('test-package', '1.0.0', '0.79.0');
    expect(result).toBe(false);
  } finally {
    // Restore console.error
    console.error = originalConsoleError;
  }
});

test('makeMavenArtifactName - creates correct artifact name format', () => {
  expect(makeMavenArtifactName('1.0.0', '0.79.0')).toBe('1.0.0-rn0.79.0');
  expect(makeMavenArtifactName('2.5.3', '0.81.5')).toBe('2.5.3-rn0.81.5');
});
