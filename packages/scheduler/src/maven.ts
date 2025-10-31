// Maven stores artifacts under the following URL. For each package and react-native
// version, artifacts are stored under path like: REPO_URL_PREFIX/some-npm-package-name/4.18.1-rn0.79.0
const MAVEN_REPO_BASE_URL = 'https://repo.swmtest.xyz/releases/com/swmansion/';
const MAVEN_API_BASE_URL =
  'https://repo.swmtest.xyz/api/maven/versions/releases/com/swmansion/';

// Cache Maven artifacts per package using the JSON API
const mavenArtifactsCache: Record<string, Set<string> | null> = {};

// Export for testing - allows clearing cache between tests
export function clearMavenCache() {
  Object.keys(mavenArtifactsCache).forEach((key) => {
    delete mavenArtifactsCache[key];
  });
}

export async function fetchMavenArtifacts(
  packageName: string
): Promise<Set<string> | null> {
  if (packageName in mavenArtifactsCache)
    return mavenArtifactsCache[packageName] ?? null;
  const url = `${MAVEN_API_BASE_URL}${packageName}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${packageName}: ${res.status} ${res.statusText}`
      );
    }
    const json = (await res.json()) as { versions?: unknown };
    // versions on Maven have combined package and RN version in a format like "4.18.1-rn0.79.0"
    // we keep the full artifact names (package version + RN version combination)
    const versions = Array.isArray(json.versions)
      ? (json.versions as unknown[])
          .map((v) => String(v).trim())
          .filter((v) => v !== undefined)
      : [];
    const set = new Set<string>(versions);
    mavenArtifactsCache[packageName] = set;
    return set;
  } catch (error) {
    console.error(`Error fetching ${packageName}:`, error);
    mavenArtifactsCache[packageName] = null;
    return null;
  }
}

export function makeMavenArtifactName(pkgVersion: string, rnVersion: string): string {
  return `${pkgVersion}-rn${rnVersion}`;
}

export async function isOnMaven(
  packageName: string,
  pkgVersion: string
): Promise<boolean> {
  const artifacts = await fetchMavenArtifacts(packageName);
  if (!artifacts) return false;
  // Check if any artifact starts with the package version (e.g., "4.18.1" matches "4.18.1-rn0.79.0")
  for (const artifact of artifacts) {
    if (artifact.startsWith(`${pkgVersion}-rn`)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a specific combination of package version and React Native version exists on Maven.
 */
export async function isCombinationOnMaven(
  packageName: string,
  pkgVersion: string,
  rnVersion: string
): Promise<boolean> {
  const artifacts = await fetchMavenArtifacts(packageName);
  if (!artifacts) return false;
  const artifactName = makeMavenArtifactName(pkgVersion, rnVersion);
  return artifacts.has(artifactName);
}

