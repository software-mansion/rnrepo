import { test, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  matchesVersionPattern,
  findMatchingVersionsFromNPM,
  fetchNpmPackageVersions,
  SchedulerCacheClear,
} from './npm';

// Mock fetch globally
const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof mock>;

beforeEach(() => {
  SchedulerCacheClear();
  mockFetch = mock(() => {
    throw new Error('fetch not mocked');
  });
  globalThis.fetch = mockFetch as typeof fetch;
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

  const mockDownloadsResponse = {
    downloads: {
      '1.0.0': 1000,
      '2.0.0': 2000,
      '2.1.0': 3000,
    },
  };

  // First call: registry.npmjs.org (fetchNpmPackageVersions)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockResponse,
  } as Response);

  // Second call: api.npmjs.org (fetchDownloadsLastWeek)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockDownloadsResponse,
  } as Response);

  const versions = await fetchNpmPackageVersions('test-package');

  expect(versions).toHaveLength(3);
  expect(versions.map((v) => v.version)).toContain('1.0.0');
  expect(versions.map((v) => v.version)).toContain('2.0.0');
  expect(versions.map((v) => v.version)).toContain('2.1.0');

  // Verify publish dates are correctly extracted
  const v1 = versions.find((v) => v.version === '1.0.0');
  expect(v1?.publishDate.getTime()).toBe(
    new Date('2021-01-15T10:00:00.000Z').getTime()
  );
  expect(v1?.downloadsLastWeek).toBe(1000);

  const v2 = versions.find((v) => v.version === '2.0.0');
  expect(v2?.publishDate.getTime()).toBe(
    new Date('2021-01-10T10:00:00.000Z').getTime()
  );
  expect(v2?.downloadsLastWeek).toBe(2000);
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

  const mockDownloadsResponse = {
    downloads: {
      '1.0.0': 1000,
      '2.0.0': 2000,
    },
  };

  // First call: registry.npmjs.org (fetchNpmPackageVersions)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockResponse,
  } as Response);

  // Second call: api.npmjs.org (fetchDownloadsLastWeek)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockDownloadsResponse,
  } as Response);

  const versions = await fetchNpmPackageVersions('test-package');

  // Should only include valid semver versions, skipping 'created', 'modified', and 'invalid-version'
  expect(versions).toHaveLength(2);
  expect(versions.map((v) => v.version)).not.toContain('created');
  expect(versions.map((v) => v.version)).not.toContain('modified');
  expect(versions.map((v) => v.version)).not.toContain('invalid-version');
});

test('fetchNpmPackageVersions - handles HTTP errors', async () => {
  // Suppress console.error for this test since we're testing error handling
  const originalConsoleError = console.error;
  console.error = () => {}; // Suppress error output

  try {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    await expect(fetchNpmPackageVersions('nonexistent')).rejects.toThrow(
      'Failed to fetch nonexistent: 404 Not Found'
    );
  } finally {
    // Restore console.error
    console.error = originalConsoleError;
  }
});

test('fetchNpmPackageVersions - handles fetchDownloadsLastWeek errors gracefully', async () => {
  // Suppress console.error for this test since we're testing error handling
  const originalConsoleError = console.error;
  console.error = () => {}; // Suppress error output

  try {
    const mockResponse = {
      time: {
        created: '2020-01-01T00:00:00.000Z',
        modified: '2023-01-01T00:00:00.000Z',
        '1.0.0': '2021-01-15T10:00:00.000Z',
      },
      versions: {
        '1.0.0': { version: '1.0.0', dist: { tarball: 'url' } },
      },
      'dist-tags': { latest: '1.0.0' },
    };

    // First call: registry.npmjs.org succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    // Second call: api.npmjs.org fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const versions = await fetchNpmPackageVersions('test-package');

    // Should still return versions even if downloads fetch fails
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('1.0.0');
    // downloadsLastWeek should be undefined due to the error
    expect(versions[0].downloadsLastWeek).toBeUndefined();
  } finally {
    // Restore console.error
    console.error = originalConsoleError;
  }
});

test('findMatchingVersionsFromNPM - uses publish date not versions order', async () => {
  // Simulate npm returning versions in a different order than publish dates
  // versions object might have: 2.1.0, 2.0.0, 1.0.0
  // But publish dates are: 2.0.0 (oldest), 1.0.0 (middle), 2.1.0 (newest)
  const mockNpmResponse = {
    time: {
      created: '2020-01-01T00:00:00.000Z',
      modified: '2023-01-01T00:00:00.000Z',
      '1.0.0': '2021-01-15T10:00:00.000Z', // Middle date
      '2.0.0': '2021-01-10T10:00:00.000Z', // OLDEST - should be first in sorted result
      '2.1.0': '2021-01-20T10:00:00.000Z', // Newest date
    },
    versions: {
      '2.1.0': { version: '2.1.0', dist: { tarball: 'url' } },
      '2.0.0': { version: '2.0.0', dist: { tarball: 'url' } },
      '1.0.0': { version: '1.0.0', dist: { tarball: 'url' } },
    },
    'dist-tags': { latest: '2.1.0' },
  };

  const mockDownloadsResponse = {
    downloads: {
      '1.0.0': 1000,
      '2.0.0': 2000,
      '2.1.0': 3000,
    },
  };

  // First call: registry.npmjs.org (fetchNpmPackageVersions)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockNpmResponse,
  } as Response);

  // Second call: api.npmjs.org (fetchDownloadsLastWeek)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockDownloadsResponse,
  } as Response);

  const result = await findMatchingVersionsFromNPM(
    'test-package-date-order',
    '>=1.0.0'
  );

  expect(result).toHaveLength(3);
  // Should be sorted by publish date (oldest first)
  expect(result[0].version).toBe('2.0.0'); // Oldest by publish date
  expect(result[0].publishDate.getTime()).toBe(
    new Date('2021-01-10T10:00:00.000Z').getTime()
  );
  expect(result[1].version).toBe('1.0.0'); // Middle
  expect(result[2].version).toBe('2.1.0'); // Newest
});

test('findMatchingVersionsFromNPM - filters out prerelease versions', async () => {
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

  const mockDownloadsResponse = {
    downloads: {
      '1.0.0': 1000,
      '1.0.0-beta.1': 100,
      '1.0.0-alpha.1': 50,
    },
  };

  // First call: registry.npmjs.org (fetchNpmPackageVersions)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockNpmResponse,
  } as Response);

  // Second call: api.npmjs.org (fetchDownloadsLastWeek)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockDownloadsResponse,
  } as Response);

  const result = await findMatchingVersionsFromNPM('test-package', '*');

  expect(result).toHaveLength(1);
  expect(result[0].version).toBe('1.0.0'); // Should skip prerelease versions
});

test('findMatchingVersionsFromNPM - filters by version matcher', async () => {
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

  const mockDownloadsResponse = {
    downloads: {
      '1.0.0': 1000,
      '2.0.0': 2000,
      '3.0.0': 3000,
    },
  };

  // First call: registry.npmjs.org (fetchNpmPackageVersions)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockNpmResponse,
  } as Response);

  // Second call: api.npmjs.org (fetchDownloadsLastWeek)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockDownloadsResponse,
  } as Response);

  const result = await findMatchingVersionsFromNPM('test-package', '2.*');

  expect(result).toHaveLength(1);
  expect(result[0].version).toBe('2.0.0'); // Should match 2.* pattern
});

test('findMatchingVersionsFromNPM - filters by publishedAfterDate', async () => {
  const mockNpmResponse = {
    time: {
      created: '2020-01-01T00:00:00.000Z',
      modified: '2023-01-01T00:00:00.000Z',
      '1.0.0': '2021-01-05T10:00:00.000Z', // Before cutoff
      '2.0.0': '2021-01-10T10:00:00.000Z', // On cutoff date
      '3.0.0': '2021-01-15T10:00:00.000Z', // After cutoff
    },
    versions: {},
    'dist-tags': { latest: '3.0.0' },
  };

  const mockDownloadsResponse = {
    downloads: {
      '1.0.0': 1000,
      '2.0.0': 2000,
      '3.0.0': 3000,
    },
  };

  // First call: registry.npmjs.org (fetchNpmPackageVersions)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockNpmResponse,
  } as Response);

  // Second call: api.npmjs.org (fetchDownloadsLastWeek)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockDownloadsResponse,
  } as Response);

  const result = await findMatchingVersionsFromNPM(
    'test-package',
    '*',
    {
      publishedAfterDate: '2021-01-10',
      downloadsThreshold: 0, // No threshold for this test
    }
  );

  expect(result).toHaveLength(2);
  expect(result.map((v) => v.version)).toContain('2.0.0'); // On date
  expect(result.map((v) => v.version)).toContain('3.0.0'); // After date
  expect(result.map((v) => v.version)).not.toContain('1.0.0'); // Before date
});

test('findMatchingVersionsFromNPM - returns empty array when versionMatcher is undefined', async () => {
  const result = await findMatchingVersionsFromNPM('test-package', undefined);
  expect(result).toEqual([]);
});
