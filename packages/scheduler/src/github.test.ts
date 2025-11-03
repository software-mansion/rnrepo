import { test, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  hasRecentWorkflowRun,
  getWorkflowFile,
  setOctokit,
  createOctokit,
  clearWorkflowRunsCache,
} from './github';
import type { Platform } from './types';

beforeEach(() => {
  // Reset octokit and cache before each test
  setOctokit(null);
  clearWorkflowRunsCache();
});

afterEach(() => {
  // Clean up after each test
  setOctokit(null);
  clearWorkflowRunsCache();
});

test('getWorkflowFile - returns correct workflow file for platform', () => {
  expect(getWorkflowFile('android')).toBe(
    '.github/workflows/build-library-android.yml'
  );
  expect(getWorkflowFile('ios')).toBe(
    '.github/workflows/build-library-ios.yml'
  );
});

test('hasRecentWorkflowRun - returns false when no runs exist', async () => {
  const mockListWorkflowRunsForRepo = mock(() => ({
    data: { workflow_runs: [] },
  }));

  const mockPaginate = mock(() => []); // Returns empty array when paginating

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
    paginate: mockPaginate,
  };

  // Set the mock octokit instance
  setOctokit(mockOctokitInstance as any);

  const result = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    3
  );
  expect(result).toBe(false);
  // Verify paginate was called with the correct parameters
  expect(mockPaginate).toHaveBeenCalledWith(
    mockListWorkflowRunsForRepo,
    expect.objectContaining({
      owner: 'software-mansion',
      repo: 'buildle',
      branch: 'main',
      created: expect.stringMatching(/^>=\d{4}-\d{2}-\d{2}$/),
    })
  );
});

test('hasRecentWorkflowRun - returns true when matching run exists', async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const mockListWorkflowRunsForRepo = mock(() => ({
    data: {
      workflow_runs: [
        {
          id: 123,
          name: 'Build for Android test-library@1.0.0 RN@0.79.0',
          created_at: yesterday.toISOString(),
          event: 'workflow_dispatch',
        },
      ],
    },
  }));

  const mockPaginate = mock(() => [
    {
      id: 123,
      name: 'Build for Android test-library@1.0.0 RN@0.79.0',
      created_at: yesterday.toISOString(),
      event: 'workflow_dispatch',
    },
  ]);

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
    paginate: mockPaginate,
  };

  setOctokit(mockOctokitInstance as any);

  const result = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    3
  );
  expect(result).toBe(true);
  // Verify paginate was called with the correct parameters
  expect(mockPaginate).toHaveBeenCalledWith(
    mockListWorkflowRunsForRepo,
    expect.objectContaining({
      owner: 'software-mansion',
      repo: 'buildle',
      branch: 'main',
      created: expect.stringMatching(/^>=\d{4}-\d{2}-\d{2}$/),
    })
  );
  // Should not call getWorkflowRun anymore - we use run.name directly
  expect(
    mockOctokitInstance.rest.actions.getWorkflowRun
  ).not.toHaveBeenCalled();
});

test('hasRecentWorkflowRun - returns false when run is too old', async () => {
  // When filtering by date, runs that are too old won't be returned by the API
  const mockListWorkflowRunsForRepo = mock(() => ({
    data: {
      workflow_runs: [], // API returns empty because run is too old
    },
  }));

  const mockPaginate = mock(() => []); // Returns empty array when paginating
  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
    paginate: mockPaginate,
  };

  setOctokit(mockOctokitInstance as any);

  const result = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    3
  );
  expect(result).toBe(false);
  // Verify paginate was called with branch and created filters
  expect(mockPaginate).toHaveBeenCalledWith(
    mockListWorkflowRunsForRepo,
    expect.objectContaining({
      owner: 'software-mansion',
      repo: 'buildle',
      branch: 'main',
      created: expect.stringMatching(/^>=\d{4}-\d{2}-\d{2}$/),
    })
  );
});

test('hasRecentWorkflowRun - returns false when React Native version does not match', async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const mockListWorkflowRunsForRepo = mock(() => ({
    data: {
      workflow_runs: [
        {
          id: 123,
          name: 'Build for Android test-library@1.0.0 RN@0.80.0', // Different RN version
          created_at: yesterday.toISOString(),
          event: 'workflow_dispatch',
        },
      ],
    },
  }));

  const mockPaginate = mock(() => [
    {
      id: 123,
      name: 'Build for Android test-library@1.0.0 RN@0.80.0', // Different RN version
      created_at: yesterday.toISOString(),
      event: 'workflow_dispatch',
    },
  ]);
  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
    paginate: mockPaginate,
  };

  setOctokit(mockOctokitInstance as any);

  const result = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    3
  );
  expect(result).toBe(false);
});

test('hasRecentWorkflowRun - handles errors gracefully and returns false', async () => {
  const mockListWorkflowRunsForRepo = mock(() => {
    throw new Error('API error');
  });

  const mockPaginate = mock(() => []);
  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
    paginate: mockPaginate,
  };

  setOctokit(mockOctokitInstance as any);

  // Suppress console.error
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const result = await hasRecentWorkflowRun(
      'test-library',
      '1.0.0',
      '0.79.0',
      'android',
      3
    );
    expect(result).toBe(false); // Should fail open
  } finally {
    console.error = originalConsoleError;
  }
});

test('hasRecentWorkflowRun - skips non-workflow_dispatch runs', async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const mockListWorkflowRunsForRepo = mock(() => ({
    data: {
      workflow_runs: [
        {
          id: 123,
          name: 'Build for Android test-library@1.0.0 RN@0.79.0',
          created_at: yesterday.toISOString(),
          event: 'push', // Not workflow_dispatch
        },
      ],
    },
  }));

  const mockGetWorkflowRun = mock(() => ({ data: {} }));

  const mockPaginate = mock(() => [
    {
      id: 123,
      name: 'Build for Android test-library@1.0.0 RN@0.79.0',
      created_at: yesterday.toISOString(),
      event: 'push', // Not workflow_dispatch
    },
  ]);

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mockGetWorkflowRun,
      },
    },
    paginate: mockPaginate,
  };

  setOctokit(mockOctokitInstance as any);

  const result = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    3
  );
  expect(result).toBe(false);
  // Should not call getWorkflowRun for non-dispatch runs
  expect(mockGetWorkflowRun).not.toHaveBeenCalled();
});

test('hasRecentWorkflowRun - returns false when platform does not match', async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const mockListWorkflowRunsForRepo = mock(() => ({
    data: {
      workflow_runs: [
        {
          id: 123,
          name: 'Build for iOS test-library@1.0.0 RN@0.79.0', // Different platform
          created_at: yesterday.toISOString(),
          event: 'workflow_dispatch',
        },
      ],
    },
  }));

  const mockPaginate = mock(() => [
    {
      id: 123,
      name: 'Build for iOS test-library@1.0.0 RN@0.79.0', // Different platform
      created_at: yesterday.toISOString(),
      event: 'workflow_dispatch',
    },
  ]);
  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
    paginate: mockPaginate,
  };

  setOctokit(mockOctokitInstance as any);

  const result = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    3
  );
  expect(result).toBe(false);
  // Verify paginate was called with branch filter set to 'main'
  expect(mockPaginate).toHaveBeenCalledWith(
    mockListWorkflowRunsForRepo,
    expect.objectContaining({
      branch: 'main',
    })
  );
});

test('hasRecentWorkflowRun - filters by main branch only', async () => {
  // API should only return runs from main branch due to branch filter
  // So even if there's a matching run on another branch, it won't be returned
  const mockListWorkflowRunsForRepo = mock(() => ({
    data: {
      workflow_runs: [], // No runs on main branch with matching criteria
    },
  }));

  const mockPaginate = mock(() => []); // Returns empty array when paginating
  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
    paginate: mockPaginate,
  };

  setOctokit(mockOctokitInstance as any);

  const result = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    3
  );
  expect(result).toBe(false);
  // Verify paginate was called with branch filter set to 'main'
  expect(mockPaginate).toHaveBeenCalledWith(
    mockListWorkflowRunsForRepo,
    expect.objectContaining({
      branch: 'main',
      created: expect.stringMatching(/^>=\d{4}-\d{2}-\d{2}$/),
    })
  );
});

test('hasRecentWorkflowRun - caches workflow runs for same date range', async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const mockRuns = [
    {
      id: 123,
      name: 'Build for Android test-library@1.0.0 RN@0.79.0',
      created_at: yesterday.toISOString(),
      event: 'workflow_dispatch',
    },
  ];

  const mockListWorkflowRunsForRepo = mock(() => ({
    data: { workflow_runs: mockRuns },
  }));

  const mockPaginate = mock(() => mockRuns);
  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
    paginate: mockPaginate,
  };

  setOctokit(mockOctokitInstance as any);

  // First call - should fetch from API
  const result1 = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    3
  );
  expect(result1).toBe(true);
  expect(mockPaginate).toHaveBeenCalledTimes(1);

  // Second call with same daysBack - should use cache
  const result2 = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    3
  );
  expect(result2).toBe(true);
  expect(mockPaginate).toHaveBeenCalledTimes(1); // Still only 1 call

  // Third call with different library - should still use cache
  const result3 = await hasRecentWorkflowRun(
    'other-library',
    '2.0.0',
    '0.80.0',
    'ios',
    3
  );
  expect(result3).toBe(false);
  expect(mockPaginate).toHaveBeenCalledTimes(1); // Still only 1 call

  // Call with different daysBack - should fetch from API again
  const result4 = await hasRecentWorkflowRun(
    'test-library',
    '1.0.0',
    '0.79.0',
    'android',
    7
  );
  expect(result4).toBe(true);
  expect(mockPaginate).toHaveBeenCalledTimes(2); // Now 2 calls
});
