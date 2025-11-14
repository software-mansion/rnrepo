import type { Platform } from '@rnrepo/database';

export type PackageInfo = {
  name: string;
  version: string;
}

export interface PlatformConfigOptions {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  publishedAfterDate?: string;
  requiredDependency?: PackageInfo[];
  additionalDependency?: PackageInfo[];
}

export type PlatformConfig =
  | boolean
  | PlatformConfigOptions[];

export interface LibraryConfig {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  publishedAfterDate?: string;
  android?: PlatformConfig;
  ios?: PlatformConfig;
}

