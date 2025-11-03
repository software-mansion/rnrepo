import { test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import type { LibraryConfig } from './types';
import * as npmModule from './npm';
import * as mavenModule from './maven';
import * as githubModule from './github';
import type { NpmVersionInfo } from './npm';

// Suppress console.log during tests
const originalLog = console.log;
const originalError = console.error;

// Mock the modules
  const mockFindMatchingVersionsFromNPM = mock();
  const mockIsCombinationOnMaven = mock();
  const mockHasRecentWorkflowRun = mock();
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
  mockIsCombinationOnMaven.mockReset();
  mockHasRecentWorkflowRun.mockReset();
  mockScheduleLibraryBuild.mockReset();
  mockMatchesVersionPattern.mockReset();

  // Setup default mock implementations
  mockScheduleLibraryBuild.mockResolvedValue(undefined);
  mockIsCombinationOnMaven.mockResolvedValue(false); // Not on Maven by default
  mockHasRecentWorkflowRun.mockResolvedValue(false); // No recent runs by default
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
  spyOn(mavenModule, 'isCombinationOnMaven').mockImplementation(mockIsCombinationOnMaven);
  spyOn(githubModule, 'hasRecentWorkflowRun').mockImplementation(mockHasRecentWorkflowRun);
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
  if (mavenModule.isCombinationOnMaven.mockRestore) {
    mavenModule.isCombinationOnMaven.mockRestore();
  }
  if (githubModule.hasRecentWorkflowRun.mockRestore) {
    githubModule.hasRecentWorkflowRun.mockRestore();
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

  // Mock to return matchingVersions for both Android and iOS (2 platform calls)
  mockFindMatchingVersionsFromNPM.mockResolvedValue(matchingVersions);

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
  // findMatchingVersionsFromNPM called once per platform (android, ios)
  expect(mockFindMatchingVersionsFromNPM).toHaveBeenCalledTimes(2);
  // Maven checks: Only checked for RN versions that match pattern
  // 2 platforms * 2 versions * 4 matching RN versions = 16 checks (not 20, because 0.78.3 is filtered out)
  expect(mockIsCombinationOnMaven).toHaveBeenCalledTimes(16);
  // Recent run checks: 2 platforms * 2 versions * 4 matching RN versions = 16 checks
  expect(mockHasRecentWorkflowRun).toHaveBeenCalledTimes(16);
});

test('processLibrary - skips disabled platforms', async () => {
  const libraryName = 'test-library';
  const config: LibraryConfig = {
    versionMatcher: '1.*',
    reactNativeVersion: '>=0.79.0',
    android: false, // Disable Android
    ios: {
      versionMatcher: '1.*',
      reactNativeVersion: '>=0.79.0',
    },
  };

  const matchingVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];

  mockFindMatchingVersionsFromNPM.mockResolvedValue(matchingVersions);
  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.79.0');

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

test('processLibrary - skips combinations already on Maven', async () => {
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

  // Mock that all combinations are on Maven
  mockIsCombinationOnMaven.mockResolvedValue(true);

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

  // Should not schedule anything since all are on Maven
  expect(mockScheduleLibraryBuild).not.toHaveBeenCalled();
  expect(mockHasRecentWorkflowRun).not.toHaveBeenCalled(); // Not checked if on Maven
});

test('processLibrary - skips combinations with recent workflow runs', async () => {
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

  // Mock that all combinations have recent workflow runs
  mockHasRecentWorkflowRun.mockResolvedValue(true);

  // Suppress console.log for this test
  const originalLog = console.log;
  console.log = () => {};

  try {
    const { processLibrary } = await import('./scheduler');
    await processLibrary(libraryName, config);

  // Should not schedule anything since all have recent runs
  // 2 platforms (android, ios) * 1 version * 4 matching RN versions = 8 checks
  expect(mockScheduleLibraryBuild).not.toHaveBeenCalled();
  expect(mockHasRecentWorkflowRun).toHaveBeenCalledTimes(8); // Checked for each platform + RN version combination
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

  mockFindMatchingVersionsFromNPM.mockResolvedValue(matchingVersions);
  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.81.0');

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

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
    android: {
      versionMatcher: '2.*', // Platform-specific override
      reactNativeVersion: '>=0.79.0',
    },
  };

  const androidVersions: NpmVersionInfo[] = [
    { version: '2.0.0', publishDate: new Date('2024-01-15') },
  ];
  const iosVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce(androidVersions) // First call for Android
    .mockResolvedValueOnce(iosVersions); // Second call for iOS

  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.79.0');

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

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
    android: {
      versionMatcher: '1.*',
      reactNativeVersion: '>=0.79.0',
      publishedAfterDate: '2024-02-01', // Platform-specific override
    },
  };

  const androidVersions: NpmVersionInfo[] = [
    { version: '1.5.0', publishDate: new Date('2024-02-15') },
  ];
  const iosVersions: NpmVersionInfo[] = [
    { version: '1.0.0', publishDate: new Date('2024-01-15') },
  ];

  mockFindMatchingVersionsFromNPM
    .mockResolvedValueOnce(androidVersions)
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

  mockFindMatchingVersionsFromNPM.mockResolvedValue(matchingVersions);
  mockMatchesVersionPattern.mockImplementation((version: string) => version >= '0.81.0');

  // Mock that 1.0.0 is on Maven, but others are not
  mockIsCombinationOnMaven.mockImplementation(
    (pkg: string, version: string, rn: string) => {
      return version === '1.0.0';
    }
  );

  const { processLibrary } = await import('./scheduler');
  await processLibrary(libraryName, config);

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

