import semver from 'semver';

export interface NpmVersionInfo {
  version: string;
  publishDate: Date;
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

export async function fetchNpmPackageVersions(
  packageName: string
): Promise<NpmVersionInfo[]> {
  const registryUrl = `https://registry.npmjs.org/${packageName}`;

  try {
    const response = await fetch(registryUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${packageName}: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as NpmRegistryResponse;
    const versions: NpmVersionInfo[] = [];

    for (const [key, timeString] of Object.entries(data.time)) {
      if (key === 'created' || key === 'modified') {
        continue;
      }

      if (semver.valid(key)) {
        versions.push({
          version: key,
          publishDate: new Date(timeString),
        });
      }
    }

    return versions;
  } catch (error) {
    console.error(`Error fetching ${packageName}:`, error);
    throw error;
  }
}

/**
 * Finds matching NPM package versions based on version matcher and publishedAfterDate.
 * Returns versions sorted by publish date (oldest first).
 * Does not check build status - that should be done separately in the scheduler using Supabase.
 */
export async function findMatchingVersionsFromNPM(
  packageName: string,
  versionMatcher: string | string[] | undefined,
  publishedAfterDate?: string
): Promise<NpmVersionInfo[]> {
  if (!versionMatcher) return [];
  const allVersions = await fetchNpmPackageVersions(packageName);

  let minPublishDate: Date | null = null;
  if (publishedAfterDate) {
    const dateStr = publishedAfterDate.trim();
    const dateParts = dateStr.split('-').map(Number);
    if (dateParts.length === 3) {
      minPublishDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      minPublishDate.setHours(0, 0, 0, 0);
    } else {
      console.warn(
        `Invalid publishedAfterDate format: ${publishedAfterDate}, expected YYYY-MM-DD`
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
    .sort((a, b) => a.publishDate.getTime() - b.publishDate.getTime());
}
