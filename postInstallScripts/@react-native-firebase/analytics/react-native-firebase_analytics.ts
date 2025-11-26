import { $ } from 'bun';

export default async function postInstallSetup(): Promise<void> {
    console.log(`Running post-install setup for @react-native-firebase/analytics...`);
    
    const react_native_firebase_analytics_version = await getPackageVersion('@react-native-firebase/analytics');
    await $`bun install @react-native-firebase/app@${react_native_firebase_analytics_version} --save-exact`.quiet();
    
    console.log(`✓ Post-install setup for @react-native-firebase/analytics completed.`);
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
