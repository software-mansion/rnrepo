import semver from 'semver';

export interface NpmVersionInfo {
  version: string;
  publishDate: Date;
  downloadsLastWeek?: number;
}

interface NpmRegistryResponse {
  'dist-tags': { latest: string; [key: string]: string };
  time: {
    created: string;
    modified: string;
    [version: string]: string;
  };
  versions: {
    [version: string]: {
      version: string;
      dist: {
        tarball: string;
      };
    };
  };
}

const packageVersionsCache = new Map<string, Promise<NpmVersionInfo[]>>();

export function packageVersionsCacheClear(): void {
  packageVersionsCache.clear();
}

export function matchesVersionPattern(
  version: string,
  pattern: string | string[]
): boolean {
  const patterns = Array.isArray(pattern) ? pattern : [pattern];

  return patterns.some((p) => {
    // Handle wildcard patterns like "3.*"
    if (p.includes('*')) {
      const regexPattern = p.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(version) && semver.valid(version) !== null;
    }

    // Handle semver ranges like ">=2.24.0"
    try {
      return semver.satisfies(version, p);
    } catch {
      // If semver parsing fails, try exact match
      return version === p;
    }
  });
}

async function fetchDownloadsLastWeek(packageName: string): Promise<Map<string, number>> {
  const registryUrl = `https://api.npmjs.org/versions/${packageName.replace('/', '%2f')}/last-week`;
  try {
    const response = await fetch(registryUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch download stats for ${packageName}: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return new Map<string, number>(Object.entries(data.downloads));
  } catch (error) {
    console.error(`Error fetching download stats for ${packageName}:`, error);
    return new Map<string, number>();
  }
}

export async function fetchNpmPackageVersions(
  packageName: string
): Promise<NpmVersionInfo[]> {
  const cached = packageVersionsCache.get(packageName);
  if (cached) return cached;

  const promise = (async () => {
    const registryUrl = `https://registry.npmjs.org/${packageName}`;

    try {
      const response = await fetch(registryUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${packageName}: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as NpmRegistryResponse;
      const downloadsLastWeekMap = await fetchDownloadsLastWeek(packageName);
      const versions: NpmVersionInfo[] = [];

      for (const [key, timeString] of Object.entries(data.time)) {
        if (key === 'created' || key === 'modified') {
          continue;
        }

        if (semver.valid(key)) {
          versions.push({
            version: key,
            publishDate: new Date(timeString),
            downloadsLastWeek: downloadsLastWeekMap.get(key),
          });
        }
      }

      return versions;
    } catch (error) {
      console.error(`Error fetching ${packageName}:`, error);
      throw error;
    }
  })();

  packageVersionsCache.set(packageName, promise);
  return promise;
}

/**
 * Finds matching NPM package versions based on version matcher and publishedAfterDate.
 * Returns versions sorted by publish date (oldest first).
 * Does not check build status - that should be done separately in the scheduler using Supabase.
 */
export async function findMatchingVersionsFromNPM(
  packageName: string,
  versionMatcher: string | string[] | undefined,
  options?: {
    publishedAfterDate?: string,
    downloadsThreshold?: number,
  }
): Promise<NpmVersionInfo[]> {
  if (!versionMatcher) return [];
  const allVersions = await fetchNpmPackageVersions(packageName);

  let minPublishDate: Date | null = null;
  if (options?.publishedAfterDate) {
    const dateStr = options.publishedAfterDate.trim();
    const dateParts = dateStr.split('-').map(Number);
    if (dateParts.length === 3) {
      minPublishDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      minPublishDate.setHours(0, 0, 0, 0);
    } else {
      console.warn(
        `Invalid publishedAfterDate format: ${options.publishedAfterDate}, expected YYYY-MM-DD`
      );
    }
  }

  return allVersions
    .filter((v) => !semver.prerelease(v.version))
    .filter((v) => matchesVersionPattern(v.version, versionMatcher))
    .filter((v) => {
      if (minPublishDate) {
        const publishDate = new Date(v.publishDate);
        publishDate.setHours(0, 0, 0, 0);
        return publishDate >= minPublishDate;
      }
      return true;
    })
    .filter(v => (v.downloadsLastWeek ?? 0) >= (options?.downloadsThreshold ?? 0))
    .sort((a, b) => a.publishDate.getTime() - b.publishDate.getTime());
}
