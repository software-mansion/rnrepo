export type Platform = 'android' | 'ios';

export type BuildStatus = 'scheduled' | 'completed' | 'failed';

export interface BuildRecord {
  id?: number;
  package_name: string;
  version: string;
  platform: Platform;
  rn_version: string;
  worklets_version?: string | null;
  status: BuildStatus;
  retry: boolean;
  github_run_url?: string | null;
  build_duration_seconds?: number | null;
  created_at?: string;
  updated_at?: string;
}

