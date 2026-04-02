export interface PlatformConfigOptions {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  publishedAfterDate?: string;
  withWorkletsVersion?: string | string[];
  weeklyDownloadsThreshold?: number;
}

export type PlatformConfig =
  | false
  | PlatformConfigOptions[];

export interface LibraryConfig {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  publishedAfterDate?: string;
  weeklyDownloadsThreshold?: number;
  android?: PlatformConfig;
  ios?: PlatformConfig;
}

