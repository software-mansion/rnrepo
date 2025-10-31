export type Platform = 'android' | 'ios';

export interface LibraryConfig {
  versionMatcher?: string | string[];
  reactNativeVersion?: string | string[];
  android?:
    | boolean
    | {
        versionMatcher?: string | string[];
        reactNativeVersion?: string | string[];
      };
  ios?:
    | boolean
    | {
        versionMatcher?: string | string[];
        reactNativeVersion?: string | string[];
      };
}

