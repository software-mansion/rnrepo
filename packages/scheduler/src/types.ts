export type { Platform } from '@rnrepo/database';

export interface LibraryConfig {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  publishedAfterDate?: string;
  android?:
    | boolean
    | {
        versionMatcher?: string | string[];
        reactNativeVersion?: string | string[];
        publishedAfterDate?: string;
      };
  ios?:
    | boolean
    | {
        versionMatcher?: string | string[];
        reactNativeVersion?: string | string[];
        publishedAfterDate?: string;
      };
}

