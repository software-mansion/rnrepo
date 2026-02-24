export interface PlatformConfigOptions {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  publishedAfterDate?: string;
  withWorkletsVersion?: string | string[];
  downloadsThreshold?: number;
}

export type PlatformConfig =
  | false
  | PlatformConfigOptions[];

export interface LibraryConfig {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  publishedAfterDate?: string;
  downloadsThreshold?: number;
  android?: PlatformConfig;
  ios?: PlatformConfig;
}

