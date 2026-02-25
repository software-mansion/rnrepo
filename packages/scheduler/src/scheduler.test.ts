import { test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import type { LibraryConfig } from './types';
import * as npmModule from './npm';
import * as supabaseModule from '@rnrepo/database';
import * as githubModule from './github';
import type { NpmVersionInfo } from './npm';
import * as rnrepoConfig from '@rnrepo/config';

// Suppress console.log during tests
const originalLog = console.log;
const originalError = console.error;

// Mock the modules
const mockFindMatchingVersionsFromNPM = mock();
const mockIsBuildAlreadyScheduled = mock();
const mockCreateBuildRecord = mock();
const mockScheduleLibraryBuild = mock();

// Mock react-native-versions.json
const mockReactNativeVersions = [
  '0.78.3',
  '0.79.7',
  '0.80.2',
  '0.81.5',
  '0.82.1',
];
mock.module('@rnrepo/config', () => ({
  ...rnrepoConfig,
  reactNativeVersions: mockReactNativeVersions,
}));

beforeEach(async () => {
  // Suppress console output during tests
  console.log = () => {};
  console.error = () => {};

  // Reset all mocks
  mockFindMatchingVersionsFromNPM.mockReset();
  mockIsBuildAlreadyScheduled.mockReset();
  mockCreateBuildRecord.mockReset();
  mockScheduleLibraryBuild.mockReset();

  // Setup default mock implementations
  mockScheduleLibraryBuild.mockResolvedValue(undefined); // Dispatch succeeds by default
  mockIsBuildAlreadyScheduled.mockResolvedValue(false); // Not already scheduled by default
  mockCreateBuildRecord.mockResolvedValue(undefined); // Create record succeeds by default
  mockFindMatchingVersionsFromNPM.mockResolvedValue([]); // No versions by default

  // Mock the modules
  spyOn(npmModule, 'findMatchingVersionsFromNPM').mockImplementation(
    mockFindMatchingVersionsFromNPM
  );
  spyOn(supabaseModule, 'isBuildAlreadyScheduled').mockImplementation(
    mockIsBuildAlreadyScheduled
  );
  spyOn(supabaseModule, 'createBuildRecord').mockImplementation(
    mockCreateBuildRecord
  );
  spyOn(githubModule, 'scheduleLibraryBuild').mockImplementation(
    mockScheduleLibraryBuild
  );

  // Note: We'll pass rnVersions as a parameter to processLibrary instead of mocking the import
});

afterEach(() => {
  // Restore console
  console.log = originalLog;
  console.error = originalError;

  // Restore all mocks to prevent interference with other test files
  (
    npmModule.findMatchingVersionsFromNPM as unknown as {
      mockRestore?: () => void;
    }
  ).mockRestore?.();
  (
    supabaseModule.isBuildAlreadyScheduled as unknown as {
      mockRestore?: () => void;
    }
  ).mockRestore?.();
  (
    supabaseModule.createBuildRecord as unknown as { mockRestore?: () => void }
  ).mockRestore?.();
  (
    githubModule.scheduleLibraryBuild as unknown as { mockRestore?: () => void }
  ).mockRestore?.();
});

test('processLibrary - schedules builds for valid combinations', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.79.0',
  };

  const matchingVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
    { version: '1.1.0', publishDate: new Date('2024-01-20') },
  ];
  const matchingVersionsRN: NpmVersionInfo[] = [
    { version: '0.79.7', publishDate: new Date('2025-01-15') },
    { version: '0.80.2', publishDate: new Date('2025-01-20') },
    { version: '0.81.5', publishDate: new Date('2025-01-25') },
    { version: '0.82.1', publishDate: new Date('2025-01-30') },
  ];

  // processLibrary calls findMatchingVersionsFromNPM for each platform:
  // - react-native-worklets
  // - library
  // - react-native
  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // Android: worklets
    .mockResolvedValueOnce(matchingVersions) // Android: library
    .mockResolvedValueOnce(matchingVersionsRN) // Android: react-native
    .mockResolvedValueOnce([]) // iOS: worklets
    .mockResolvedValueOnce(matchingVersions) // iOS: library
    .mockResolvedValueOnce(matchingVersionsRN); // iOS: react-native

  // Import and call processLibrary with mocked RN versions
  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should schedule for each combination that passes all checks
  // 2 platforms (android, ios) * 2 package versions * 4 matching RN versions = 16 builds
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(16);
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledTimes(6);
  // Supabase checks: Only checked for RN versions that match pattern
  // 2 platforms * 2 versions * 4 matching RN versions = 16 checks (not 20, because 0.78.3 is filtered out)
  expect(mockIsBuildAlreadyScheduled).toHaveBeenCalledTimes(16);
  // Build record creation: 2 platforms * 2 versions * 4 matching RN versions = 16 records (only for unscheduled builds)
  expect(mockCreateBuildRecord).toHaveBeenCalledTimes(16);
});

test('processLibrary - skips disabled platforms', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.79.0',
    android: false, // Disable Android
    ios: [
      {
        versionMatcher: '1.*',
        reactNativeVersion: '>=0.79.0',
      },
    ],
  };

  const matchingVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];
  const matchingVersionsRN: NpmVersionInfo[] = [
    { version: '0.79.7', publishDate: new Date('2025-01-15') },
    { version: '0.80.2', publishDate: new Date('2025-01-20') },
    { version: '0.81.5', publishDate: new Date('2025-01-25') },
    { version: '0.82.1', publishDate: new Date('2025-01-30') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // iOS: worklets
    .mockResolvedValueOnce(matchingVersions) // iOS: library
    .mockResolvedValueOnce(matchingVersionsRN); // iOS: react-native
  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should only schedule for iOS, not Android
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(4); // 1 version * 4 matching RN versions
  // Verify all calls are for iOS platform
  for (const call of mockScheduleLibraryBuild.mock.calls) {
    expect(call[2]).toBe('ios');
  }
});

test('processLibrary - skips when versionMatcher is missing', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    reactNativeVersion: '>=0.79.0',
    // No versionMatcher
  };

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should not schedule anything
  expect(mockFindMatchingVersionsFromNPM).not.toHaveBeenCalled();
  expect(mockScheduleLibraryBuild).not.toHaveBeenCalled();
});

test('processLibrary - skips combinations already scheduled', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.79.0',
  };

  const matchingVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];
  const matchingVersionsRN: NpmVersionInfo[] = [
    { version: '0.79.7', publishDate: new Date('2025-01-15') },
    { version: '0.80.2', publishDate: new Date('2025-01-20') },
    { version: '0.81.5', publishDate: new Date('2025-01-25') },
    { version: '0.82.1', publishDate: new Date('2025-01-30') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // Android: worklets
    .mockResolvedValueOnce(matchingVersions) // Android: library
    .mockResolvedValueOnce(matchingVersionsRN) // Android: react-native
    .mockResolvedValueOnce([]) // iOS: worklets
    .mockResolvedValueOnce(matchingVersions) // iOS: library
    .mockResolvedValueOnce(matchingVersionsRN); // iOS: react-native
  // Mock that all combinations are already scheduled
  mockIsBuildAlreadyScheduled.mockResolvedValue(true);

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should not schedule anything since all are already scheduled
  expect(mockScheduleLibraryBuild).not.toHaveBeenCalled();
  expect(mockCreateBuildRecord).not.toHaveBeenCalled(); // Not created if already scheduled
});

test('processLibrary - skips combinations already scheduled', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.79.0',
  };

  const matchingVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];
  const matchingVersionsRN: NpmVersionInfo[] = [
    { version: '0.79.7', publishDate: new Date('2025-01-15') },
    { version: '0.80.2', publishDate: new Date('2025-01-20') },
    { version: '0.81.5', publishDate: new Date('2025-01-25') },
    { version: '0.82.1', publishDate: new Date('2025-01-30') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // Android: worklets
    .mockResolvedValueOnce(matchingVersions) // Android: library
    .mockResolvedValueOnce(matchingVersionsRN) // Android: react-native
    .mockResolvedValueOnce([]) // iOS: worklets
    .mockResolvedValueOnce(matchingVersions) // iOS: library
    .mockResolvedValueOnce(matchingVersionsRN); // iOS: react-native
  // Mock that all combinations are already scheduled
  mockIsBuildAlreadyScheduled.mockResolvedValue(true);

  // Suppress console.log for this test
  const originalLog = console.log;
  console.log = () => {};

  try {
    const { processLibrary } = await import('./scheduler');
    await processLibrary(libraryName, config);

    // Should not schedule anything since all are already scheduled
    // 2 platforms (android, ios) * 1 version * 4 matching RN versions = 8 checks
    expect(mockScheduleLibraryBuild).not.toHaveBeenCalled();
    expect(mockIsBuildAlreadyScheduled).toHaveBeenCalledTimes(8); // Checked for each platform + RN version combination
  } finally {
    console.log = originalLog;
  }
});

test('processLibrary - filters by RN version pattern', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.81.0', // Only 0.81.5 and 0.82.1 should match
  };

  const matchingVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];
  const matchingVersionsRN: NpmVersionInfo[] = [
    { version: '0.79.7', publishDate: new Date('2025-01-15') },
    { version: '0.80.2', publishDate: new Date('2025-01-20') },
    { version: '0.81.5', publishDate: new Date('2025-01-25') },
    { version: '0.82.1', publishDate: new Date('2025-01-30') },
  ];

  const rnOnly081Plus = matchingVersionsRN.filter((v) =>
    ['0.81.5', '0.82.1'].includes(v.version)
  );

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // Android: worklets
    .mockResolvedValueOnce(matchingVersions) // Android: library
    .mockResolvedValueOnce(rnOnly081Plus) // Android: react-native
    .mockResolvedValueOnce([]) // iOS: worklets
    .mockResolvedValueOnce(matchingVersions) // iOS: library
    .mockResolvedValueOnce(rnOnly081Plus); // iOS: react-native

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should only schedule for 2 RN versions (0.81.5 and 0.82.1) * 2 platforms = 4 builds
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(4);
  // Verify the RN versions in the calls
  const calls = mockScheduleLibraryBuild.mock.calls;
  const rnVersions = calls.map((call) => call[3] as string);
  expect(rnVersions.filter((v: string) => v === '0.81.5')).toHaveLength(2); // Android + iOS
  expect(rnVersions.filter((v: string) => v === '0.82.1')).toHaveLength(2); // Android + iOS
  expect(rnVersions).not.toContain('0.79.7');
});

test('processLibrary - uses platform-specific versionMatcher', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*', // Library-level
    reactNativeVersion: '>=0.79.0',
    android: [
      {
        versionMatcher: '2.*', // Platform-specific override
        reactNativeVersion: '>=0.79.0',
      },
    ],
  };

  const androidVersions: NpmVersionInfo[] = [
    { version: '2.0.0', publishDate: new Date('2024-01-15') },
  ];
  const iosVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];
  const matchingVersionsRN: NpmVersionInfo[] = [
    { version: '0.79.7', publishDate: new Date('2025-01-15') },
    { version: '0.80.2', publishDate: new Date('2025-01-20') },
    { version: '0.81.5', publishDate: new Date('2025-01-25') },
    { version: '0.82.1', publishDate: new Date('2025-01-30') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // Android: worklets
    .mockResolvedValueOnce(androidVersions) // Android: library
    .mockResolvedValueOnce(matchingVersionsRN) // Android: react-native
    .mockResolvedValueOnce([]) // iOS: worklets
    .mockResolvedValueOnce(iosVersions) // iOS: library
    .mockResolvedValueOnce(matchingVersionsRN); // iOS: react-native

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should schedule for both platforms
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(8); // 4 RN versions for each platform
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledTimes(6);
});

test('processLibrary - uses platform-specific publishedAfterDate', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.79.0',
    publishedAfterDate: '2024-01-01', // Library-level
    android: [
      {
        versionMatcher: '1.*',
        reactNativeVersion: '>=0.79.0',
        publishedAfterDate: '2024-02-01', // Platform-specific override
      },
    ],
  };

  const androidVersions: NpmVersionInfo[] = [
    { version: '1.5.0', publishDate: new Date('2024-02-15') },
  ];
  const iosVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];
  const matchingVersionsRN: NpmVersionInfo[] = [
    { version: '0.79.7', publishDate: new Date('2025-01-15') },
    { version: '0.80.2', publishDate: new Date('2025-01-20') },
    { version: '0.81.5', publishDate: new Date('2025-01-25') },
    { version: '0.82.1', publishDate: new Date('2025-01-30') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // Android: worklets
    .mockResolvedValueOnce(androidVersions) // Android: library
    .mockResolvedValueOnce(matchingVersionsRN) // Android: react-native
    .mockResolvedValueOnce([]) // iOS: worklets
    .mockResolvedValueOnce(iosVersions) // iOS: library
    .mockResolvedValueOnce(matchingVersionsRN); // iOS: react-native

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledTimes(6);
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledWith(
    libraryName,
    '1.*',
    {
      publishedAfterDate: '2024-02-01',
      weeklyDownloadsThreshold: 10000,
    }
  );
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledWith(
    libraryName,
    '1.*',
    {
      publishedAfterDate: '2024-01-01',
      weeklyDownloadsThreshold: 10000,
    }
  );
});

test('processLibrary - handles multiple package versions correctly', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.81.0',
  };

  const matchingVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
    { version: '1.1.0', publishDate: new Date('2024-01-20') },
    { version: '1.2.0', publishDate: new Date('2024-01-25') },
  ];
  const matchingVersionsRN: NpmVersionInfo[] = [
    { version: '0.81.5', publishDate: new Date('2025-01-25') },
    { version: '0.82.1', publishDate: new Date('2025-01-30') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // Android: worklets
    .mockResolvedValueOnce(matchingVersions) // Android: library
    .mockResolvedValueOnce(matchingVersionsRN) // Android: react-native
    .mockResolvedValueOnce([]) // iOS: worklets
    .mockResolvedValueOnce(matchingVersions) // iOS: library
    .mockResolvedValueOnce(matchingVersionsRN); // iOS: react-native

  // Mock that 1.0.0 is already scheduled, but others are not
  mockIsBuildAlreadyScheduled.mockImplementation(
    (pkg: string, version: string, _rn: string, _platform: string) => {
      return version === '1.0.0';
    }
  );

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should schedule for 1.1.0 and 1.2.0, each with 2 RN versions * 2 platforms = 8 builds
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(8);
  // Verify all calls are for versions 1.1.0 or 1.2.0
  const calls = mockScheduleLibraryBuild.mock.calls;
  const versions = calls.map((call) => call[1] as string);
  expect(versions).not.toContain('1.0.0');
  expect(versions.filter((v: string) => v === '1.1.0')).toHaveLength(4); // 2 RN versions * 2 platforms
  expect(versions.filter((v: string) => v === '1.2.0')).toHaveLength(4); // 2 RN versions * 2 platforms
});

test('processLibrary - logs message when no builds scheduled', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.79.0',
  };

  const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should log that no builds were scheduled
  expect(consoleSpy).toHaveBeenCalledWith(
    ' ℹ️  No builds to schedule for',
    libraryName
  );

  consoleSpy.mockRestore();
});

test('processLibrary - handles scheduleLibraryBuild errors', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.81.0',
  };

  const matchingVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];
  const matchingVersionsRN: NpmVersionInfo[] = [
    { version: '0.81.5', publishDate: new Date('2025-01-25') },
  ];

  // Only Android will be processed before the scheduling error rejects.
  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // Android: worklets
    .mockResolvedValueOnce(matchingVersions) // Android: library
    .mockResolvedValueOnce(matchingVersionsRN); // Android: react-native

  // Mock scheduleLibraryBuild to throw an error
  const error = new Error('Failed to dispatch workflow');
  mockScheduleLibraryBuild.mockRejectedValue(error);

  // Suppress console.error
  const originalError = console.error;
  console.error = () => {};

  try {
    const { processLibrary } = await import('./scheduler');
    await expect(processLibrary(libraryName, config)).rejects.toThrow(
      'Failed to dispatch workflow'
    );
  } finally {
    console.error = originalError;
  }
});

test('processLibrary - android worklets config uses correct ranges', async () => {
  const libraryName = 'react-native-reanimated';
  const config: LibraryConfig = {
    android: [
      {
        versionMatcher: '<4.2',
        withWorkletsVersion: ['0.5.1', '0.6.1'],
        publishedAfterDate: '2025-01-01',
      },
      {
        versionMatcher: '>=4.2',
        withWorkletsVersion: ['0.7.1'],
      },
    ],
  };

  const makeVersion = (version: string, date: string) => ({
    version,
    publishDate: new Date(date),
  });

  const matchingRNVersions: NpmVersionInfo[] = [
    makeVersion('0.78.3', '2025-01-01'),
    makeVersion('0.79.7', '2025-01-15'),
    makeVersion('0.80.2', '2025-01-20'),
    makeVersion('0.81.5', '2025-01-25'),
    makeVersion('0.82.1', '2025-01-30'),
  ];

  // Worklets + library + react-native lookups for two android config entries
  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([
      makeVersion('0.5.1', '2025-01-10'),
      makeVersion('0.6.1', '2025-02-10'),
    ]) // worklets (<4.2)
    .mockResolvedValueOnce([
      makeVersion('3.14.1', '2025-03-01'),
      makeVersion('4.1.7', '2025-03-15'),
    ]) // library (<4.2)
    .mockResolvedValueOnce(matchingRNVersions) // react-native (<4.2)
    .mockResolvedValueOnce([makeVersion('0.7.1', '2025-04-01')]) // worklets (>=4.2)
    .mockResolvedValueOnce([makeVersion('4.2.0', '2025-04-15')]) // library (>=4.2)
    .mockResolvedValueOnce(matchingRNVersions); // react-native (>=4.2)

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // 2 library versions (<4.2) * 2 worklets * 5 RN + 1 version (>=4.2) * 1 worklets * 5 RN = 25 calls
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(25);

  const calls = mockScheduleLibraryBuild.mock.calls.filter(
    (call) => call[2] === 'android'
  );
  const hasCombo = (version: string, worklets: string) =>
    calls.some((call) => call[1] === version && call[4] === worklets);

  expect(hasCombo('3.14.1', '0.6.1')).toBe(true);
  expect(hasCombo('4.1.7', '0.6.1')).toBe(true);
  expect(hasCombo('4.2.0', '0.7.1')).toBe(true);
  // Ensure >=4.2 does not pick older worklets config
  expect(hasCombo('4.2.0', '0.6.1')).toBe(false);
  // Ensure <4.2 does not pick newer worklets config
  expect(hasCombo('3.14.1', '0.7.1')).toBe(false);
  expect(hasCombo('4.1.7', '0.7.1')).toBe(false);
});
