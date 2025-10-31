import { test, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  hasRecentWorkflowRun,
  getWorkflowFile,
  setOctokit,
  createOctokit,
} from './github';
import type { Platform } from './types';

beforeEach(() => {
  // Reset octokit before each test
  setOctokit(null);
});

afterEach(() => {
  // Clean up after each test
  setOctokit(null);
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

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
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
  expect(mockListWorkflowRunsForRepo).toHaveBeenCalledTimes(1);
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

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
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
  expect(mockListWorkflowRunsForRepo).toHaveBeenCalledTimes(1);
  // Should not call getWorkflowRun anymore - we use run.name directly
  expect(
    mockOctokitInstance.rest.actions.getWorkflowRun
  ).not.toHaveBeenCalled();
});

test('hasRecentWorkflowRun - returns false when run is too old', async () => {
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  const mockListWorkflowRunsForRepo = mock(() => ({
    data: {
      workflow_runs: [
        {
          id: 123,
          name: 'Build for Android test-library@1.0.0 RN@0.79.0',
          created_at: fiveDaysAgo.toISOString(),
          event: 'workflow_dispatch',
        },
      ],
    },
  }));

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
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

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
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

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
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

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mockGetWorkflowRun,
      },
    },
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

  const mockOctokitInstance = {
    rest: {
      actions: {
        listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
        getWorkflowRun: mock(() => ({ data: {} })),
      },
    },
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
