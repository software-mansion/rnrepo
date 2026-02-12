import * as fs from 'fs';
import withRNRepoPlugin from '../src/withRNRepoPlugin';

// Mock the config plugins
jest.mock('@expo/config-plugins', () => ({
  withProjectBuildGradle: jest.fn((config, cb) => cb(config)),
  withAppBuildGradle: jest.fn((config, cb) => cb(config)),
  withDangerousMod: jest.fn((config, [platform, cb]) => {
    if (platform === 'ios') cb(config);
    return config;
  }),
}));

// 1. Mock the entire module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// 2. To get TypeScript types on the mocked functions
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('withRNRepoPlugin', () => {
  const mockConfig = {
    name: 'test-app',
    slug: 'test-app',
    modResults: { contents: '' },
    modRequest: { platformProjectRoot: '/root/ios' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Android: Project Build Gradle', () => {
    it('should add classpath dependency and maven repository', () => {
      mockConfig.modResults.contents = `
        buildscript {
            dependencies {
                classpath("com.android.tools.build:gradle:7.4.2")
            }
        }
        apply plugin: "com.facebook.react.rootproject"
      `;

      withRNRepoPlugin(mockConfig);

      expect(mockConfig.modResults.contents).toContain('def rnrepoDir = new File');
      expect(mockConfig.modResults.contents).toContain('repositories {');
      expect(mockConfig.modResults.contents).toContain('https://packages.rnrepo.org/releases');
    });

    it('should not duplicate classpath if already present', () => {
      const withClasspath = `
        buildscript {
            dependencies {
                classpath("com.android.tools.build:gradle:7.4.2")
                def rnrepoDir = new File(
                   providers.exec {
                     workingDir(rootDir)
                     commandLine("node", "--print", "require.resolve('@rnrepo/build-tools/package.json')")
                   }.standardOutput.asText.get().trim()
                 ).getParentFile().absolutePath
                 classpath fileTree(dir: "\${rnrepoDir}/gradle-plugin/build/libs", include: ["prebuilds-plugin-*.jar"])
            }
        }
        apply plugin: "com.facebook.react.rootproject"
      `;

      mockConfig.modResults.contents = withClasspath;
      withRNRepoPlugin(mockConfig);

      const classpathCount = (mockConfig.modResults.contents.match(/def rnrepoDir/g) || []).length;
      expect(classpathCount).toBe(1);
    });

    it('should add maven repository to allprojects block', () => {
      mockConfig.modResults.contents = `
        buildscript {
            repositories {
                google()
                mavenCentral()
            }
            dependencies {
                classpath("com.android.tools.build:gradle:7.4.2")
            }
        }
        apply plugin: "com.facebook.react.rootproject"
      `;

      withRNRepoPlugin(mockConfig);

      expect(mockConfig.modResults.contents).toContain('allprojects {');
      expect(mockConfig.modResults.contents).toContain('maven { url "https://packages.rnrepo.org/releases" }');
    });

    it('should not duplicate maven repository', () => {
      mockConfig.modResults.contents = `
        buildscript {
            repositories {
                google()
                mavenCentral()
            }
        }
        
        allprojects {
            repositories {
                maven { url "https://packages.rnrepo.org/releases" }
            }
        }
        
        apply plugin: "com.facebook.react.rootproject"
      `;

      withRNRepoPlugin(mockConfig);
      const mavenCount = (mockConfig.modResults.contents.match(/packages\.rnrepo\.org/g) || []).length;

      expect(mavenCount).toBe(1);
    });
  });

  describe('Android: App Build Gradle', () => {
    it('should apply the rnrepo plugin after the react plugin', () => {
      mockConfig.modResults.contents = 'apply plugin: "com.facebook.react"';

      withRNRepoPlugin(mockConfig);

      expect(mockConfig.modResults.contents).toContain(
        'apply plugin: "com.facebook.react"\napply plugin: "org.rnrepo.tools.prebuilds-plugin"'
      );
    });

    it('should not duplicate rnrepo plugin', () => {
      mockConfig.modResults.contents = `
        apply plugin: "com.android.application"
        apply plugin: "com.facebook.react"
        apply plugin: "org.rnrepo.tools.prebuilds-plugin"
      `;

      withRNRepoPlugin(mockConfig);

      const rnrepoCount = (mockConfig.modResults.contents.match(/org\.rnrepo\.tools\.prebuilds-plugin/g) || []).length;
      expect(rnrepoCount).toBe(1);
    });

    it('should place rnrepo plugin after the facebook react plugin', () => {
      mockConfig.modResults.contents = `
        apply plugin: "com.android.application"
        apply plugin: "com.facebook.react"
        apply plugin: "kotlin-android"
      `;

      withRNRepoPlugin(mockConfig);

      const facebookIndex = mockConfig.modResults.contents.indexOf('com.facebook.react');
      const rnrepoIndex = mockConfig.modResults.contents.indexOf('org.rnrepo.tools.prebuilds-plugin');

      expect(facebookIndex).toBeLessThan(rnrepoIndex);
      expect(facebookIndex).toBeGreaterThan(-1);
    });

    it('should handle multiple plugin declarations', () => {
      mockConfig.modResults.contents = `
        apply plugin: "com.android.application"
        apply plugin: "com.facebook.react"
        apply plugin: "kotlin-android"
        apply plugin: "com.google.gms.google-services"
      `;

      withRNRepoPlugin(mockConfig);

      expect(mockConfig.modResults.contents).toContain('org.rnrepo.tools.prebuilds-plugin');
      // Ensure other plugins are still there
      expect(mockConfig.modResults.contents).toContain('com.android.application');
      expect(mockConfig.modResults.contents).toContain('com.google.gms.google-services');
    });
  });

  describe('iOS: Podfile (Dangerous Mod)', () => {
    it('should inject ruby require and post_install hook into Podfile', async () => {
      const mockPodfile = `target 'testapp' do\n  post_install do |installer|\n  end\nend`;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(mockPodfile);

      await withRNRepoPlugin(mockConfig);

      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const writtenContent = String(writeCall[1]);

      expect(writtenContent).toContain('require Pod::Executable.execute_command');
      expect(writtenContent).toContain('rnrepo_post_install(installer)');
    });

    it('should place require statement before target definition', async () => {
      const mockPodfile = `
platform :ios, podfile_platforms[:ios]

target 'testapp' do
  post_install do |installer|
  end
end`;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(mockPodfile);

      await withRNRepoPlugin(mockConfig);

      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const writtenContent = String(writeCall[1]);

      const requireIndex = writtenContent.indexOf('require Pod::Executable.execute_command');
      const targetIndex = writtenContent.indexOf("target 'testapp'");

      expect(requireIndex).toBeGreaterThan(-1);
      expect(targetIndex).toBeGreaterThan(-1);
      expect(requireIndex).toBeLessThan(targetIndex);
    });

    it('should place rnrepo_post_install inside post_install block', async () => {
      const mockPodfile = `target 'testapp' do
  config = use_native_modules!
  
  use_react_native!(
    :path => config[:reactNativePath],
  )

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end`;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(mockPodfile);

      await withRNRepoPlugin(mockConfig);

      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const writtenContent = String(writeCall[1]);

      const postInstallIndex = writtenContent.indexOf('post_install do |installer|');
      const rnrepoPostInstallIndex = writtenContent.indexOf('rnrepo_post_install(installer)');

      expect(postInstallIndex).toBeGreaterThan(-1);
      expect(rnrepoPostInstallIndex).toBeGreaterThan(-1);
      expect(postInstallIndex).toBeLessThan(rnrepoPostInstallIndex);
    });

    it('should not duplicate require if already present', async () => {
      const mockPodfile = `require Pod::Executable.execute_command('node', ['-p',
  'require.resolve(
  "@rnrepo/build-tools/cocoapods-plugin/lib/plugin.rb",
  {paths: [process.argv[1]]},
)', __dir__]).strip

target 'testapp' do
  post_install do |installer|
    rnrepo_post_install(installer)
  end
end`;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(mockPodfile);

      await withRNRepoPlugin(mockConfig);

      const requireCount = (mockPodfile.match(/@rnrepo\/build-tools\/cocoapods-plugin/g) || []).length;
      expect(requireCount).toBe(1);
    });

    it('should not write file if Podfile does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      await withRNRepoPlugin(mockConfig);

      expect(mockedFs.readFileSync).not.toHaveBeenCalled();
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should not write file if content did not change', async () => {
      const mockPodfile = `require Pod::Executable.execute_command('node', ['-p',
  'require.resolve(
  "@rnrepo/build-tools/cocoapods-plugin/lib/plugin.rb",
  {paths: [process.argv[1]]},
)', __dir__]).strip

target 'testapp' do
  post_install do |installer|
    rnrepo_post_install(installer)
  end
end`;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(mockPodfile);

      // Clear any previous mock calls
      mockedFs.writeFileSync.mockClear();

      await withRNRepoPlugin(mockConfig);

      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Integration: Full Plugin Execution', () => {
    it('should preserve existing content while adding modifications', () => {
      const originalContent = `buildscript {
    ext {
        buildToolsVersion = "33.0.0"
        minSdkVersion = 21
        compileSdkVersion = 34
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:7.4.2")
        classpath("com.facebook.react:react-native-gradle-plugin")
    }
}
apply plugin: "com.facebook.react.rootproject"`;

      mockConfig.modResults.contents = originalContent;

      withRNRepoPlugin(mockConfig);

      expect(mockConfig.modResults.contents).toContain('buildToolsVersion = "33.0.0"');
      expect(mockConfig.modResults.contents).toContain('minSdkVersion = 21');
      expect(mockConfig.modResults.contents).toContain('compileSdkVersion = 34');
      expect(mockConfig.modResults.contents).toContain('google()');
      expect(mockConfig.modResults.contents).toContain('mavenCentral()');
      expect(mockConfig.modResults.contents).toContain('com.facebook.react:react-native-gradle-plugin');
    });
  });
});