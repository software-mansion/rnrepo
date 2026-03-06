import { $ } from 'bun';

const COMPATIBILITY_MATRIX = [
  {
    rn: ['0.80', '0.81', '0.82', '0.83', '0.84'],
    reanimated: '4.2.2',
    worklets: '0.7.3'
  },
  {
    rn: ['0.77', '0.78', '0.79'],
    reanimated: '4.1.6', 
    worklets: '0.6.1'
  }
];

export default async function postInstallSetup(): Promise<void> {
    console.log(`Running post-install setup for react-native-gesture-handler...`);
    
    const rnVersion = await getPackageVersion('react-native');
    console.log(`Detected React Native version: ${rnVersion}`);
    const { reanimatedVersion, workletsVersion } = getReanimatedAndWorkletsVersion(rnVersion);
    // Support RN-GH only with reanimated
    await $`bun install react-native-reanimated@${reanimatedVersion} --save-exact`.quiet();
    console.log(`✓ Installed react-native-reanimated@${reanimatedVersion}`);
    await $`bun install react-native-worklets@${workletsVersion} --save-exact`.quiet();
    console.log(`✓ Installed react-native-worklets@${workletsVersion}`);
    // Patch react-native-gesture-handler to avoid issues with react-native-svg
    await $`bun install react-native-svg`.quiet();
    console.log('✓ Installed react-native-svg');
    const patchPath = __dirname + '/react-native-gesture-handler.patch';
    const packagePath = './node_modules/react-native-gesture-handler';
    await $`/usr/bin/patch -p1 -i ${patchPath}`.cwd(packagePath).quiet();
    console.log('✓ Patched react-native-gesture-handler for SVG compatibility');
    
    console.log(`✓ Post-install setup for react-native-gesture-handler completed.`);
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

function getReanimatedAndWorkletsVersion(rnVersion: string): { reanimatedVersion: string; workletsVersion: string } {
    const majorMinor = rnVersion.split('.').slice(0, 2).join('.');
    const config = COMPATIBILITY_MATRIX.find(m => m.rn.includes(majorMinor));
    if (!config) {
        throw new Error(`Unsupported React Native version: ${rnVersion}. Please check the compatibility matrix.`);
    }
    return { reanimatedVersion: config.reanimated, workletsVersion: config.worklets };
}

try {
    await postInstallSetup();
} catch (error) {
    console.error('Error during post-install setup:', error);
    throw error;
}
