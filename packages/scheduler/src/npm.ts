import semver from 'semver';
import { isOnMaven } from './maven';

interface NpmVersionInfo {
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

    // Extract version and publish date from the time object
    for (const [key, timeString] of Object.entries(data.time)) {
      // Skip metadata fields
      if (key === 'created' || key === 'modified') {
        continue;
      }

      // Validate that it's a semver version
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

export async function findOldestMatchingVersionNotOnMaven(
  packageName: string,
  versionMatcher: string | string[] | undefined
): Promise<{ version: string; publishDate: Date } | null> {
  if (!versionMatcher) return null;
  const allVersions = await fetchNpmPackageVersions(packageName);
  const matching = allVersions
    .filter((v) => !semver.prerelease(v.version))
    .filter((v) => matchesVersionPattern(v.version, versionMatcher))
    .sort((a, b) => a.publishDate.getTime() - b.publishDate.getTime());

  for (const v of matching) {
    if (!(await isOnMaven(packageName, v.version))) {
      return v;
    }
  }
  return null;
}
