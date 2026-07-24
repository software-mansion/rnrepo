import { readFileSync } from 'node:fs';

/**
 * Gates scheduling to only those name/version/react-native-version combinations
 * for which a codegen artifact actually exists in the repository.
 *
 * The allow-list is `codegen_urls.txt` at the repo root (overridable via the
 * CODEGEN_URLS_FILE env var), containing artifact URLs of the form:
 *   .../public/{mavenName}/{version}/{mavenName}-{version}-rn{rnVersion}-codegen.aar[.ext]
 * where {mavenName} is the npm package name with a leading '@' removed and '/'
 * replaced by '_' (e.g. `@maplibre/maplibre-react-native` -> `maplibre_maplibre-react-native`).
 */

const CODEGEN_URLS_FILE =
  process.env.CODEGEN_URLS_FILE ??
  new URL('../../../codegen_urls.txt', import.meta.url);

// Captures {mavenName}/{version}/…-rn{rnVersion}-codegen from an artifact URL.
const URL_RE = /\/public\/([^/]+)\/([^/]+)\/[^/]*-rn([\d.]+)-codegen/;

function toMavenName(libraryName: string): string {
  return libraryName.replace(/^@/, '').replace(/\//g, '_');
}

function key(mavenName: string, version: string, rnVersion: string): string {
  return `${mavenName}|${version}|${rnVersion}`;
}

let allowedKeys: Set<string> | null = null;

function loadAllowedKeys(): Set<string> {
  if (allowedKeys) return allowedKeys;

  const keys = new Set<string>();
  let content: string;
  try {
    content = readFileSync(CODEGEN_URLS_FILE, 'utf8');
  } catch (error) {
    console.warn(
      `⚠️  Could not read codegen allow-list at ${CODEGEN_URLS_FILE}. ` +
        `No builds will be scheduled.`,
      error
    );
    allowedKeys = keys;
    return keys;
  }

  for (const line of content.split('\n')) {
    const match = line.match(URL_RE);
    if (match) {
      const [, mavenName, version, rnVersion] = match;
      keys.add(key(mavenName, version, rnVersion));
    }
  }

  console.log(
    `🔎 Loaded ${keys.size} codegen name/version/rn combination(s) from allow-list.`
  );
  allowedKeys = keys;
  return keys;
}

/**
 * Returns true if a codegen artifact exists for the given package name,
 * package version and react-native version.
 */
export function hasCodegenArtifact(
  libraryName: string,
  version: string,
  rnVersion: string
): boolean {
  return loadAllowedKeys().has(key(toMavenName(libraryName), version, rnVersion));
}
