import { test, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  matchesVersionPattern,
  findOldestMatchingVersionNotOnMaven,
  fetchNpmPackageVersions,
} from './npm';
import { clearMavenCache } from './maven';

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

test('matchesVersionPattern - exact match', () => {
  expect(matchesVersionPattern('1.0.0', '1.0.0')).toBe(true);
  expect(matchesVersionPattern('2.5.3', '1.0.0')).toBe(false);
});

test('matchesVersionPattern - wildcard patterns', () => {
  expect(matchesVersionPattern('1.2.3', '1.*')).toBe(true);
  expect(matchesVersionPattern('1.5.0', '1.*')).toBe(true);
  expect(matchesVersionPattern('2.0.0', '1.*')).toBe(false);
  expect(matchesVersionPattern('1.2.3', '1.2.*')).toBe(true);
  expect(matchesVersionPattern('1.3.0', '1.2.*')).toBe(false);
});

test('matchesVersionPattern - semver ranges', () => {
  expect(matchesVersionPattern('2.24.0', '>=2.24.0')).toBe(true);
  expect(matchesVersionPattern('2.25.0', '>=2.24.0')).toBe(true);
  expect(matchesVersionPattern('2.23.0', '>=2.24.0')).toBe(false);
  expect(matchesVersionPattern('2.24.0', '<3.0.0')).toBe(true);
  expect(matchesVersionPattern('3.0.0', '<3.0.0')).toBe(false);
});

test('matchesVersionPattern - array of patterns', () => {
  expect(matchesVersionPattern('1.0.0', ['1.*', '2.*'])).toBe(true);
  expect(matchesVersionPattern('2.0.0', ['1.*', '2.*'])).toBe(true);
  expect(matchesVersionPattern('3.0.0', ['1.*', '2.*'])).toBe(false);
});

test('matchesVersionPattern - invalid semver returns false for wildcards', () => {
  expect(matchesVersionPattern('not-a-version', '1.*')).toBe(false);
  expect(matchesVersionPattern('invalid', '*')).toBe(false);
});

test('fetchNpmPackageVersions - extracts versions with publish dates', async () => {
  const mockResponse = {
    time: {
      created: '2020-01-01T00:00:00.000Z',
      modified: '2023-01-01T00:00:00.000Z',
      '1.0.0': '2021-01-15T10:00:00.000Z',
      '2.0.0': '2021-01-10T10:00:00.000Z', // Earlier date
      '2.1.0': '2021-01-20T10:00:00.000Z',
    },
    versions: {
      '1.0.0': { version: '1.0.0', dist: { tarball: 'url' } },
      '2.1.0': { version: '2.1.0', dist: { tarball: 'url' } },
      '2.0.0': { version: '2.0.0', dist: { tarball: 'url' } },
    },
    'dist-tags': { latest: '2.1.0' },
  };

  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockResponse,
  } as Response);

  const versions = await fetchNpmPackageVersions('test-package');

  expect(versions).toHaveLength(3);
  expect(versions.map((v) => v.version)).toContain('1.0.0');
  expect(versions.map((v) => v.version)).toContain('2.0.0');
  expect(versions.map((v) => v.version)).toContain('2.1.0');

  // Verify publish dates are correctly extracted
  const v1 = versions.find((v) => v.version === '1.0.0');
  expect(v1?.publishDate.getTime()).toBe(new Date('2021-01-15T10:00:00.000Z').getTime());

  const v2 = versions.find((v) => v.version === '2.0.0');
  expect(v2?.publishDate.getTime()).toBe(new Date('2021-01-10T10:00:00.000Z').getTime());
});

test('fetchNpmPackageVersions - skips metadata fields and invalid semver', async () => {
  const mockResponse = {
    time: {
      created: '2020-01-01T00:00:00.000Z',
      modified: '2023-01-01T00:00:00.000Z',
      '1.0.0': '2021-01-15T10:00:00.000Z',
      'invalid-version': '2021-01-16T10:00:00.000Z',
      '2.0.0': '2021-01-10T10:00:00.000Z',
    },
    versions: {},
    'dist-tags': { latest: '2.0.0' },
  };

  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockResponse,
  } as Response);

  const versions = await fetchNpmPackageVersions('test-package');

  // Should only include valid semver versions, skipping 'created', 'modified', and 'invalid-version'
  expect(versions).toHaveLength(2);
  expect(versions.map((v) => v.version)).not.toContain('created');
  expect(versions.map((v) => v.version)).not.toContain('modified');
  expect(versions.map((v) => v.version)).not.toContain('invalid-version');
});

test('fetchNpmPackageVersions - handles HTTP errors', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 404,
    statusText: 'Not Found',
  } as Response);

  await expect(fetchNpmPackageVersions('nonexistent')).rejects.toThrow(
    'Failed to fetch nonexistent: 404 Not Found'
  );
});

test('findOldestMatchingVersionNotOnMaven - uses publish date not versions order', async () => {
  // Simulate npm returning versions in a different order than publish dates
  // versions object might have: 2.1.0, 2.0.0, 1.0.0
  // But publish dates are: 2.0.0 (oldest), 1.0.0 (middle), 2.1.0 (newest)
  const mockNpmResponse = {
    time: {
      created: '2020-01-01T00:00:00.000Z',
      modified: '2023-01-01T00:00:00.000Z',
      '1.0.0': '2021-01-15T10:00:00.000Z', // Middle date
      '2.0.0': '2021-01-10T10:00:00.000Z', // OLDEST - should be returned
      '2.1.0': '2021-01-20T10:00:00.000Z', // Newest date
    },
    versions: {
      '2.1.0': { version: '2.1.0', dist: { tarball: 'url' } },
      '2.0.0': { version: '2.0.0', dist: { tarball: 'url' } },
      '1.0.0': { version: '1.0.0', dist: { tarball: 'url' } },
    },
    'dist-tags': { latest: '2.1.0' },
  };

  // Mock Maven to return empty (nothing is on Maven)
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockNpmResponse,
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ versions: [] }),
    } as Response);

  const result = await findOldestMatchingVersionNotOnMaven('test-package-date-order', '>=1.0.0');

  expect(result).not.toBeNull();
  expect(result?.version).toBe('2.0.0'); // Should be 2.0.0 (oldest by publish date), NOT 1.0.0 or 2.1.0
  expect(result?.publishDate.getTime()).toBe(new Date('2021-01-10T10:00:00.000Z').getTime());
});

test('findOldestMatchingVersionNotOnMaven - filters out prerelease versions', async () => {
  const mockNpmResponse = {
    time: {
      created: '2020-01-01T00:00:00.000Z',
      modified: '2023-01-01T00:00:00.000Z',
      '1.0.0': '2021-01-10T10:00:00.000Z',
      '1.0.0-beta.1': '2021-01-08T10:00:00.000Z', // Earlier but prerelease
      '1.0.0-alpha.1': '2021-01-05T10:00:00.000Z', // Earliest but prerelease
    },
    versions: {},
    'dist-tags': { latest: '1.0.0' },
  };

  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockNpmResponse,
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ versions: [] }),
    } as Response);

  const result = await findOldestMatchingVersionNotOnMaven('test-package', '*');

  expect(result).not.toBeNull();
  expect(result?.version).toBe('1.0.0'); // Should skip prerelease versions
});

test('findOldestMatchingVersionNotOnMaven - filters by version matcher', async () => {
  const mockNpmResponse = {
    time: {
      created: '2020-01-01T00:00:00.000Z',
      modified: '2023-01-01T00:00:00.000Z',
      '1.0.0': '2021-01-10T10:00:00.000Z',
      '2.0.0': '2021-01-15T10:00:00.000Z',
      '3.0.0': '2021-01-05T10:00:00.000Z', // Earliest but doesn't match
    },
    versions: {},
    'dist-tags': { latest: '3.0.0' },
  };

  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockNpmResponse,
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ versions: [] }),
    } as Response);

  const result = await findOldestMatchingVersionNotOnMaven('test-package', '2.*');

  expect(result).not.toBeNull();
  expect(result?.version).toBe('2.0.0'); // Should match 2.* pattern and be oldest matching
});

test('findOldestMatchingVersionNotOnMaven - returns null when all versions are on Maven', async () => {
  const mockNpmResponse = {
    time: {
      created: '2020-01-01T00:00:00.000Z',
      modified: '2023-01-01T00:00:00.000Z',
      '1.0.0': '2021-01-10T10:00:00.000Z',
      '2.0.0': '2021-01-15T10:00:00.000Z',
    },
    versions: {},
    'dist-tags': { latest: '2.0.0' },
  };

  // Mock Maven to return both versions in the combined format (will be extracted)
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockNpmResponse,
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ versions: ['1.0.0-rn0.79.0', '2.0.0-rn0.80.0'] }),
    } as Response);

  const result = await findOldestMatchingVersionNotOnMaven('test-package-all-on-maven', '*');

  expect(result).toBeNull();
});

test('findOldestMatchingVersionNotOnMaven - returns first version not on Maven', async () => {
  const mockNpmResponse = {
    time: {
      created: '2020-01-01T00:00:00.000Z',
      modified: '2023-01-01T00:00:00.000Z',
      '1.0.0': '2021-01-10T10:00:00.000Z', // Oldest, on Maven
      '2.0.0': '2021-01-15T10:00:00.000Z', // Middle, NOT on Maven - should return this
      '3.0.0': '2021-01-20T10:00:00.000Z', // Newest, not on Maven
    },
    versions: {},
    'dist-tags': { latest: '3.0.0' },
  };

  // Mock Maven to return only 1.0.0 in combined format
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockNpmResponse,
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ versions: ['1.0.0-rn0.79.0'] }),
    } as Response);

  const result = await findOldestMatchingVersionNotOnMaven('test-package-partial-maven', '*');

  expect(result).not.toBeNull();
  expect(result?.version).toBe('2.0.0'); // Should return oldest NOT on Maven
});

test('findOldestMatchingVersionNotOnMaven - returns null when versionMatcher is undefined', async () => {
  const result = await findOldestMatchingVersionNotOnMaven('test-package', undefined);
  expect(result).toBeNull();
});
