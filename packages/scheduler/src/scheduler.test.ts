import { test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import type { LibraryConfig } from './types';
import * as npmModule from './npm';
import * as supabaseModule from '@rnrepo/database';
import * as githubModule from './github';
import type { NpmVersionInfo } from './npm';

// Suppress console.log during tests
const originalLog = console.log;
const originalError = console.error;

// Mock the modules
  const mockFindMatchingVersionsFromNPM = mock();
  const mockIsBuildAlreadyScheduled = mock();
  const mockCreateBuildRecord = mock();
  const mockScheduleLibraryBuild = mock();
  const mockMatchesVersionPattern = mock();

// Mock react-native-versions.json
const mockReactNativeVersions = ['0.78.3', '0.79.7', '0.80.2', '0.81.5', '0.82.1'];

beforeEach(async () => {
  // Suppress console output during tests
  console.log = () => {};
  console.error = () => {};

  // Reset all mocks
  mockFindMatchingVersionsFromNPM.mockReset();
  mockIsBuildAlreadyScheduled.mockReset();
  mockCreateBuildRecord.mockReset();
  mockScheduleLibraryBuild.mockReset();
  mockMatchesVersionPattern.mockReset();

  // Setup default mock implementations
  mockScheduleLibraryBuild.mockResolvedValue(undefined); // Dispatch succeeds by default
  mockIsBuildAlreadyScheduled.mockResolvedValue(false); // Not already scheduled by default
  mockCreateBuildRecord.mockResolvedValue(undefined); // Create record succeeds by default
  mockMatchesVersionPattern.mockImplementation((version: string, pattern: string | string[]) => {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    return patterns.some((p) => {
      if (p.includes('*')) {
        const regexPattern = p.replace(/\./g, '\\.').replace(/\*/g, '.*');
        return new RegExp(`^${regexPattern}$`).test(version);
      }
      if (p.startsWith('>=')) {
        return version >= p.slice(2);
      }
      return version === p;
    });
  });

  // Mock the modules
  spyOn(npmModule, 'findMatchingVersionsFromNPM').mockImplementation(
    mockFindMatchingVersionsFromNPM
  );
  spyOn(npmModule, 'matchesVersionPattern').mockImplementation(mockMatchesVersionPattern);
  spyOn(supabaseModule, 'isBuildAlreadyScheduled').mockImplementation(mockIsBuildAlreadyScheduled);
  spyOn(supabaseModule, 'createBuildRecord').mockImplementation(mockCreateBuildRecord);
  spyOn(githubModule, 'scheduleLibraryBuild').mockImplementation(mockScheduleLibraryBuild);

  // Note: We'll pass rnVersions as a parameter to processLibrary instead of mocking the import
});

afterEach(() => {
  // Restore console
  console.log = originalLog;
  console.error = originalError;

  // Restore all mocks to prevent interference with other test files
  if (npmModule.findMatchingVersionsFromNPM.mockRestore) {
    npmModule.findMatchingVersionsFromNPM.mockRestore();
  }
  if (npmModule.matchesVersionPattern.mockRestore) {
    npmModule.matchesVersionPattern.mockRestore();
  }
  if (supabaseModule.isBuildAlreadyScheduled.mockRestore) {
    supabaseModule.isBuildAlreadyScheduled.mockRestore();
  }
  if (supabaseModule.createBuildRecord.mockRestore) {
    supabaseModule.createBuildRecord.mockRestore();
  }
  if (githubModule.scheduleLibraryBuild.mockRestore) {
    githubModule.scheduleLibraryBuild.mockRestore();
  }
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

  // Mock to return matchingVersions for both Android and iOS (4 platform calls)
  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // First call for Android worklets returns no versions
    .mockResolvedValueOnce(matchingVersions) // First call for Android libraryName
    .mockResolvedValueOnce([]) // Second call for iOS worklets returns no versions
    .mockResolvedValueOnce(matchingVersions); // Second call for iOS libraryName

  // Mock matchesVersionPattern for RN versions
  mockMatchesVersionPattern.mockImplementation((version: string, pattern?: string | string[]) => {
    // If pattern is provided, use it; otherwise default behavior
    if (pattern) {
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      return patterns.some((p) => {
        if (p.includes('*')) {
          const regexPattern = p.replace(/\./g, '\\.').replace(/\*/g, '.*');
          return new RegExp(`^${regexPattern}$`).test(version);
        }
        if (p.startsWith('>=')) {
          return version >= p.slice(2);
        }
        return version === p;
      });
    }
    // Default: >=0.79.0 matches 0.79.7, 0.80.2, 0.81.5, 0.82.1
    return version >= '0.79.0';
  });

  // Import and call processLibrary with mocked RN versions
  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config, mockReactNativeVersions);

  // Should schedule for each combination that passes all checks
  // 2 platforms (android, ios) * 2 package versions * 4 matching RN versions = 16 builds
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(16);
  // findMatchingVersionsFromNPM called 4 times: 2 platforms * (library + worklets)
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledTimes(4);
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
      }
    ]
  };

  const matchingVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];

  mockFindMatchingVersionsFromNPM.mockResolvedValue(matchingVersions);
  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.79.0');

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config, mockReactNativeVersions);

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

test('processLibrary - skips when reactNativeVersion is missing', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    // No reactNativeVersion
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

  mockFindMatchingVersionsFromNPM.mockResolvedValue(matchingVersions);
  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.79.0');

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

  mockFindMatchingVersionsFromNPM.mockResolvedValue(matchingVersions);
  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.79.0');

  // Mock that all combinations are already scheduled
  mockIsBuildAlreadyScheduled.mockResolvedValue(true);

  // Suppress console.log for this test
  const originalLog = console.log;
  console.log = () => {};

  try {
    const { processLibrary } = await import('./scheduler');
    await processLibrary(libraryName, config, mockReactNativeVersions);

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

  // Mock to return matchingVersions for both Android and iOS (4 platform calls)
  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // First call for Android worklets returns no versions
    .mockResolvedValueOnce(matchingVersions) // First call for Android libraryName
    .mockResolvedValueOnce([]) // Second call for iOS worklets returns no versions
    .mockResolvedValueOnce(matchingVersions); // Second call for iOS libraryName

  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.81.0');

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config, mockReactNativeVersions);

  // Should only schedule for 2 RN versions (0.81.5 and 0.82.1) * 2 platforms = 4 builds
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(4);
  // Verify the RN versions in the calls
  const calls = mockScheduleLibraryBuild.mock.calls;
  const rnVersions = calls.map((call) => call[3]);
  expect(rnVersions.filter((v) => v === '0.81.5')).toHaveLength(2); // Android + iOS
  expect(rnVersions.filter((v) => v === '0.82.1')).toHaveLength(2); // Android + iOS
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
      }
    ],
  };

  const androidVersions: NpmVersionInfo[] = [
    { version: '2.0.0', publishDate: new Date('2024-01-15') },
  ];
  const iosVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // First call for Android worklets returns no versions
    .mockResolvedValueOnce(androidVersions) // First call for Android
    .mockResolvedValueOnce([]) // Second call for iOS worklets returns no versions
    .mockResolvedValueOnce(iosVersions); // Second call for iOS

  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.79.0');

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config, mockReactNativeVersions);

  // Should schedule for both platforms
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(8); // 4 RN versions for each platform
  // Verify findMatchingVersionsFromNPM was called with different matchers
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledWith(
    libraryName,
    '2.*',
    undefined
  ); // Android
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledWith(
    libraryName,
    '1.*',
    undefined
  ); // iOS
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
      }
    ]
  };

  const androidVersions: NpmVersionInfo[] = [
    { version: '1.5.0', publishDate: new Date('2024-02-15') },
  ];
  const iosVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // First call for Android worklets returns no versions
    .mockResolvedValueOnce(androidVersions)
    .mockResolvedValueOnce([]) // Second call for iOS worklets returns no versions
    .mockResolvedValueOnce(iosVersions);

  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.79.0');

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Verify publishedAfterDate was passed correctly
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledWith(
    libraryName,
    '1.*',
    '2024-02-01'
  ); // Android with override
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledWith(
    libraryName,
    '1.*',
    '2024-01-01'
  ); // iOS with library-level
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

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce([]) // First call for Android worklets returns no versions
    .mockResolvedValueOnce(matchingVersions) // First call for Android libraryName
    .mockResolvedValueOnce([]) // Second call for iOS worklets returns no versions
    .mockResolvedValueOnce(matchingVersions); // Second call for iOS libraryName
  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.81.0');

  // Mock that 1.0.0 is already scheduled, but others are not
  mockIsBuildAlreadyScheduled.mockImplementation(
    (pkg: string, version: string, _rn: string, _platform: string) => {
      return version === '1.0.0';
    }
  );

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config, mockReactNativeVersions);

  // Should schedule for 1.1.0 and 1.2.0, each with 2 RN versions * 2 platforms = 8 builds
  expect(mockScheduleLibraryBuild).toHaveBeenCalledTimes(8);
  // Verify all calls are for versions 1.1.0 or 1.2.0
  const calls = mockScheduleLibraryBuild.mock.calls;
  const versions = calls.map((call) => call[1]);
  expect(versions).not.toContain('1.0.0');
  expect(versions.filter((v) => v === '1.1.0')).toHaveLength(4); // 2 RN versions * 2 platforms
  expect(versions.filter((v) => v === '1.2.0')).toHaveLength(4); // 2 RN versions * 2 platforms
});

test('processLibrary - logs message when no builds scheduled', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.79.0',
  };

  // No matching versions
  mockFindMatchingVersionsFromNPM.mockResolvedValue([]);

  const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should log that no builds were scheduled
  expect(consoleSpy).toHaveBeenCalledWith(' ℹ️  No builds to schedule for', libraryName);

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

  mockFindMatchingVersionsFromNPM.mockResolvedValue(matchingVersions);
  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.81.0');

  // Mock scheduleLibraryBuild to throw an error
  const error = new Error('Failed to dispatch workflow');
  mockScheduleLibraryBuild.mockRejectedValue(error);

  // Suppress console.error
  const originalError = console.error;
  console.error = () => {};

  try {
    const { processLibrary } = await import('./scheduler');
    await expect(processLibrary(libraryName, config)).rejects.toThrow('Failed to dispatch workflow');
  } finally {
    console.error = originalError;
  }
});

