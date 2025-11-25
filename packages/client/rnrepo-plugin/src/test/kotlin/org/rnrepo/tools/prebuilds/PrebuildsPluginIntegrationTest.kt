package org.rnrepo.tools.prebuilds

import org.assertj.core.api.Assertions.assertThat
import org.gradle.testkit.runner.GradleRunner
import org.junit.jupiter.api.Assumptions
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.io.TempDir
import java.io.File

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PrebuildsPluginIntegrationTest {
    @TempDir
    lateinit var testProjectDir: File

    private lateinit var buildFile: File
    private lateinit var settingsFile: File

    @BeforeEach
    fun setUp() {
        buildFile = File(testProjectDir, "build.gradle")
        settingsFile = File(testProjectDir, "settings.gradle")

        settingsFile.writeText(
            """
            rootProject.name = 'test-project'
            """.trimIndent(),
        )

        // Skip tests if Android SDK is not available
        val androidHome =
            System.getenv("ANDROID_HOME")
                ?: System.getenv("ANDROID_SDK_ROOT")
                ?: (System.getProperty("user.home") + "/Library/Android/sdk")

        if (!File(androidHome).exists()) {
            Assumptions.assumeTrue(false, "Android SDK not found at $androidHome")
        }
    }

    @Test
    fun `plugin should not apply when DISABLE_RNREPO is set`() {
        // Given
        setupAndroidProject()
        addPackage("react-native", "0.72.0", addToSettings = false)
        setupBuildFile()

        // When
        val result =
            GradleRunner
                .create()
                .withProjectDir(testProjectDir)
                .withArguments("assembleDebug", "--dry-run", "--info")
                .withPluginClasspath()
                .withEnvironment(mapOf("DISABLE_RNREPO" to "true"))
                .build()

        // Then
        assertThat(result.output).contains("Env enabled: false")
    }

    @Test
    fun `plugin should load deny list from config file`() {
        // Given
        setupAndroidProject()
        addPackage("react-native", "0.72.0", addToSettings = false)

        // Create config file with deny list
        val configFile = File(testProjectDir, "rnrepo.config.json")
        configFile.writeText(
            """
            {
                "denyList": ["react-native-vector-icons", "react-native-image-picker"]
            }
            """.trimIndent(),
        )
        setupBuildFile()

        // When
        val result =
            GradleRunner
                .create()
                .withProjectDir(testProjectDir)
                .withArguments("assembleDebug", "--dry-run", "--info")
                .withPluginClasspath()
                .build()

        // Then
        assertThat(result.output).contains("Loaded deny list from config")
        assertThat(result.output).contains("react-native-vector-icons")
        assertThat(result.output).contains("react-native-image-picker")
    }

    @Test
    fun `plugin should detect React Native packages in node_modules`() {
        // Given
        setupAndroidProject()
        addPackage("react-native", "0.72.0", addToSettings = false)
        setupReactNativePackages()
        setupBuildFile()

        // When
        val result =
            GradleRunner
                .create()
                .withProjectDir(testProjectDir)
                .withArguments("assembleDebug", "--dry-run", "--info")
                .withPluginClasspath()
                .build()

        // Then
        assertThat(result.output).contains("Found package: react-native-reanimated")
        assertThat(result.output).contains("Found package: react-native-screens")
        assertThat(result.output).contains("Detected React Native version: 0.72.0")
    }

    private fun setupAndroidProject() {
        // Create minimal Android project structure
        val androidDir = File(testProjectDir, "android")
        androidDir.mkdirs()

        // Create gradle.properties for Android
        val gradleProperties = File(testProjectDir, "gradle.properties")
        gradleProperties.writeText(
            """
            android.useAndroidX=true
            android.enableJetifier=true
            """.trimIndent(),
        )

        // Create local.properties with Android SDK path
        val localProperties = File(testProjectDir, "local.properties")
        val androidHome =
            System.getenv("ANDROID_HOME")
                ?: System.getenv("ANDROID_SDK_ROOT")
                ?: (System.getProperty("user.home") + "/Library/Android/sdk") // fallback path for macOS
        localProperties.writeText(
            """
            sdk.dir=$androidHome
            """.trimIndent(),
        )
    }

    private fun setupBuildFile() {
        buildFile.writeText(
            """
            plugins {
                id 'com.android.application'
                id 'org.rnrepo.tools.prebuilds-plugin'
            }

            android {
                compileSdkVersion 34
                namespace 'com.test.app'

                defaultConfig {
                    applicationId 'com.test.app'
                    minSdkVersion 21
                    targetSdkVersion 34
                    versionCode 1
                    versionName '1.0.0'
                }
            }
            """.trimIndent(),
        )
    }

    private fun addPackage(
        packageName: String,
        version: String,
        addToSettings: Boolean = false,
    ) {
        val nodeModulesDir = File(testProjectDir, "node_modules")
        val packageDir = File(nodeModulesDir, packageName)
        packageDir.mkdirs()
        File(packageDir, "package.json").writeText(
            """
            {
                "name": "$packageName",
                "version": "$version"
            }
            """.trimIndent(),
        )
        if (!addToSettings) return
        settingsFile.appendText(
            """

            include ':$packageName'
            project(':$packageName').projectDir = file('node_modules/$packageName/android')
            """.trimIndent(),
        )
    }

    private fun setupReactNativePackages() {
        addPackage("react-native-reanimated", "3.0.0", addToSettings = true)
        addPackage("react-native-screens", "3.20.0", addToSettings = true)
        addPackage("react-native-worklets", "1.0.0", addToSettings = false)
    }
}
