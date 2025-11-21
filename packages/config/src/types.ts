export interface PlatformConfigOptions {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  publishedAfterDate?: string;
  withWorkletsVersion?: string | string[];
}

export type PlatformConfig =
  | false
  | PlatformConfigOptions[];

export interface LibraryConfig {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  publishedAfterDate?: string;
  android?: PlatformConfig;
  ios?: PlatformConfig;
}

