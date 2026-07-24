import { test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Point the codegen module at a temporary allow-list before importing it.
const dir = mkdtempSync(join(tmpdir(), 'codegen-test-'));
const file = join(dir, 'codegen_urls.txt');

const base = 'https://packages.rnrepo.org/releases/org/rnrepo/public';
const lines = [
  // @maplibre/maplibre-react-native 11.3.6 rn0.81.0 (aar + companions)
  `${base}/maplibre_maplibre-react-native/11.3.6/maplibre_maplibre-react-native-11.3.6-rn0.81.0-codegen.aar`,
  `${base}/maplibre_maplibre-react-native/11.3.6/maplibre_maplibre-react-native-11.3.6-rn0.81.0-codegen.aar.md5`,
  `${base}/maplibre_maplibre-react-native/11.3.6/maplibre_maplibre-react-native-11.3.6-rn0.81.0-codegen.aar.sha1`,
  // same package, different rn version
  `${base}/maplibre_maplibre-react-native/11.3.6/maplibre_maplibre-react-native-11.3.6-rn0.82.0-codegen.aar`,
  // a plain (unscoped) package
  `${base}/react-native-image-crop-picker/0.51.0/react-native-image-crop-picker-0.51.0-rn0.81.0-codegen.aar`,
];
writeFileSync(file, lines.join('\n') + '\n', 'utf8');
process.env.CODEGEN_URLS_FILE = file;

const {
  hasCodegenForPackage,
  hasCodegenArtifact,
  removeCodegenArtifact,
} = await import('./codegen');

test('hasCodegenForPackage matches by (maven-mapped) package name', () => {
  expect(hasCodegenForPackage('@maplibre/maplibre-react-native')).toBe(true);
  expect(hasCodegenForPackage('react-native-image-crop-picker')).toBe(true);
  expect(hasCodegenForPackage('react-native-does-not-exist')).toBe(false);
});

test('hasCodegenArtifact matches an exact name/version/rn combination', () => {
  expect(
    hasCodegenArtifact('@maplibre/maplibre-react-native', '11.3.6', '0.81.0')
  ).toBe(true);
  // wrong rn version
  expect(
    hasCodegenArtifact('@maplibre/maplibre-react-native', '11.3.6', '0.83.0')
  ).toBe(false);
  // wrong package version
  expect(
    hasCodegenArtifact('@maplibre/maplibre-react-native', '9.9.9', '0.81.0')
  ).toBe(false);
});

test('removeCodegenArtifact deletes the combo (and its companions) from the file, but the gate snapshot is unchanged', () => {
  removeCodegenArtifact('@maplibre/maplibre-react-native', '11.3.6', '0.81.0');

  const remaining = readFileSync(file, 'utf8');
  // all three rn0.81.0 lines for maplibre are gone
  expect(remaining).not.toContain('maplibre-react-native-11.3.6-rn0.81.0');
  // the other maplibre rn version and the other package remain
  expect(remaining).toContain('maplibre-react-native-11.3.6-rn0.82.0');
  expect(remaining).toContain('react-native-image-crop-picker-0.51.0-rn0.81.0');

  // Gate still reports true (immutable start-of-run snapshot) so the second
  // platform pass for the same combo is not skipped.
  expect(
    hasCodegenArtifact('@maplibre/maplibre-react-native', '11.3.6', '0.81.0')
  ).toBe(true);
});

test('removeCodegenArtifact is idempotent', () => {
  const before = readFileSync(file, 'utf8');
  removeCodegenArtifact('@maplibre/maplibre-react-native', '11.3.6', '0.81.0');
  const after = readFileSync(file, 'utf8');
  expect(after).toBe(before);
});
