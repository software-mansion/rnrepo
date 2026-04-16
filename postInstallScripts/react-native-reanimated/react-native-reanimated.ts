import { $ } from 'bun';
import semver from 'semver';

const COMPATIBILITY_MATRIX = [
  {
    reanimated: '>=4.3.0 <4.4.0',
    worklets: '0.8.1'
  },
];

export default async function postInstallSetup(): Promise<void> {
    console.log(`Running post-install setup for react-native-reanimated...`);
    
    const reanimatedVersion = await getPackageVersion('react-native-reanimated');
    console.log(`Detected react-native-reanimated version: ${reanimatedVersion}`);
    const workletsVersion = COMPATIBILITY_MATRIX.find(m => semver.satisfies(reanimatedVersion, m.reanimated))?.worklets;
    if (!workletsVersion) {
        throw new Error(`Unsupported react-native-reanimated version: ${reanimatedVersion}. Please check the compatibility matrix.`);
    }
    // install react-native-worklets
    await $`bun install react-native-worklets@${workletsVersion} --save-exact`.quiet();
    console.log(`✓ Installed react-native-worklets@${workletsVersion}`);
 
    console.log(`✓ Post-install setup for react-native-reanimated completed.`);
};

async function getPackageVersion(packageName: string): Promise<string> {
    const packageJsonPath = `node_modules/${packageName}/package.json`;
    try {
        const packageJson = JSON.parse(await Bun.file(packageJsonPath).text());
        return packageJson.version;
    } catch (error) {
        console.error(`Error retrieving version for package ${packageName}:`, error);
        throw error;
    }
}

try {
    await postInstallSetup();
} catch (error) {
    console.error('Error during post-install setup:', error);
    throw error;
}
