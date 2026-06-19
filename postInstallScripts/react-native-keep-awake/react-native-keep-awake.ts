import fs from 'fs';

export default async function preInstallSetup(): Promise<void> {
    console.log(`Running pre-install setup for react-native-keep-awake...`);
    
    // change jcenter() to mavenCentral() in node_modules/react-native-keep-awake/android/build.gradle
    const filePath = 'node_modules/react-native-keep-awake/android/build.gradle';
    
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
        fs.writeFileSync(filePath, content, 'utf8');
    }
    
    console.log(`✓ Pre-install setup for react-native-keep-awake completed.`);
};

try {
    await preInstallSetup();
} catch (error) {
    console.error('Error during pre-install setup:', error);
    throw error;
}
