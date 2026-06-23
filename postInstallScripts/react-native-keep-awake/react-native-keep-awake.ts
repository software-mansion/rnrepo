import fs from 'fs';

export default async function postInstallSetup(): Promise<void> {
    console.log(`Running post-install setup for react-native-keep-awake...`);
    
    // change jcenter() to mavenCentral() in node_modules/react-native-keep-awake/android/build.gradle
    const filePath = 'node_modules/react-native-keep-awake/android/build.gradle';
    
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
        fs.writeFileSync(filePath, content, 'utf8');
    }
    
    console.log(`✓ Post-install setup for react-native-keep-awake completed.`);
};

try {
    await postInstallSetup();
} catch (error) {
    console.error('Error during post-install setup:', error);
    throw error;
}
