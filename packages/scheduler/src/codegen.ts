import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Gates scheduling to only those packages / name-version-rnversion combinations
 * for which a codegen artifact exists, and consumes the allow-list as workflows
 * are created.
 *
 * The allow-list is `codegen_urls.txt` at the repo root (overridable via the
 * CODEGEN_URLS_FILE env var), containing artifact URLs of the form:
 *   .../public/{mavenName}/{version}/{mavenName}-{version}-rn{rnVersion}-codegen.aar[.ext]
 * where {mavenName} is the npm package name with a leading '@' removed and '/'
 * replaced by '_' (e.g. `@maplibre/maplibre-react-native` -> `maplibre_maplibre-react-native`).
 *
 * Gating decisions (`hasCodegenForPackage`, `hasCodegenArtifact`) are made
 * against an immutable snapshot taken when the file is first read, so they stay
 * stable across the whole run even as `removeCodegenArtifact` consumes entries
 * from the file on disk. This matters because the scheduler visits each
 * name/version/rn combination once per platform.
 */

const CODEGEN_URLS_FILE =
  process.env.CODEGEN_URLS_FILE ??
  new URL('../../../codegen_urls.txt', import.meta.url);

// Captures {mavenName}/{version}/…-rn{rnVersion}-codegen from an artifact URL.
const URL_RE = /\/public\/([^/]+)\/([^/]+)\/[^/]*-rn([\d.]+)-codegen/;

function toMavenName(libraryName: string): string {
  return libraryName.replace(/^@/, '').replace(/\//g, '_');
}

function comboKey(mavenName: string, version: string, rnVersion: string): string {
  return `${mavenName}|${version}|${rnVersion}`;
}

interface CodegenState {
  /** Immutable set of maven package names present at load time. */
  names: Set<string>;
  /** Immutable set of name|version|rn combinations present at load time. */
  combos: Set<string>;
  /** Mutable list of the file's lines, consumed by removeCodegenArtifact. */
  lines: string[];
}

let state: CodegenState | null = null;

function load(): CodegenState {
  if (state) return state;

  const names = new Set<string>();
  const combos = new Set<string>();
  let lines: string[] = [];

  try {
    lines = readFileSync(CODEGEN_URLS_FILE, 'utf8').split('\n');
  } catch (error) {
    console.warn(
      `⚠️  Could not read codegen allow-list at ${CODEGEN_URLS_FILE}. ` +
        `No builds will be scheduled.`,
      error
    );
    state = { names, combos, lines: [] };
    return state;
  }

  for (const line of lines) {
    const match = line.match(URL_RE);
    if (match) {
      const [, mavenName, version, rnVersion] = match;
      names.add(mavenName);
      combos.add(comboKey(mavenName, version, rnVersion));
    }
  }

  console.log(
    `🔎 Loaded ${combos.size} codegen combination(s) across ${names.size} package(s) from allow-list.`
  );
  state = { names, combos, lines };
  return state;
}

/**
 * Returns true if the package has any codegen artifact in the allow-list.
 * Used to skip whole packages before doing any npm lookups.
 */
export function hasCodegenForPackage(libraryName: string): boolean {
  return load().names.has(toMavenName(libraryName));
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
  return load().combos.has(comboKey(toMavenName(libraryName), version, rnVersion));
}

/**
 * Removes every allow-list entry (the .aar and its .asc/.md5/.sha1 companions)
 * for the given name/version/rn combination and persists the file. Idempotent:
 * calling it again for an already-consumed combination is a no-op.
 */
export function removeCodegenArtifact(
  libraryName: string,
  version: string,
  rnVersion: string
): void {
  const s = load();
  const mavenName = toMavenName(libraryName);

  const remaining = s.lines.filter(line => {
    const match = line.match(URL_RE);
    if (!match) return true; // keep blank lines / anything unparseable
    const [, name, ver, rn] = match;
    return !(name === mavenName && ver === version && rn === rnVersion);
  });

  if (remaining.length === s.lines.length) return; // nothing removed

  s.lines = remaining;
  const hasContent = remaining.some(line => line.trim() !== '');
  writeFileSync(
    CODEGEN_URLS_FILE,
    hasContent ? remaining.join('\n') : '',
    'utf8'
  );
}
