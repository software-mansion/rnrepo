package org.rnrepo.tools.prebuilds

import io.mockk.*
import org.assertj.core.api.Assertions.*
import org.gradle.api.Project
import org.gradle.api.artifacts.dsl.RepositoryHandler
import org.gradle.api.artifacts.repositories.MavenArtifactRepository
import org.gradle.api.logging.Logger
import org.gradle.api.logging.Logging
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.io.TempDir
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.lang.System
import io.mockk.mockkStatic
import io.mockk.every
 
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PrebuildsPluginHelperMethodsTest {

    // private lateinit var project: Project
    private lateinit var mockProject: Project
    private lateinit var plugin: PrebuildsPlugin
    private lateinit var mockLogger: Logger
    
    @TempDir
    lateinit var tempDir: File

    @BeforeEach
    fun setUp() {
        mockProject = mockk<Project>()
        plugin = PrebuildsPlugin()
        mockLogger = mockk<Logger>(relaxed = true)

        every { mockProject.logger } returns mockLogger
    }

    fun setupPluginExecution(taskNames: List<String>, disableRnrepoValue: String?): Project {
        val mockGradle = mockk<org.gradle.api.invocation.Gradle>()
        val mockStartParameter = mockk<org.gradle.StartParameter>()
        
        every { mockProject.gradle } returns mockGradle
        every { mockGradle.startParameter } returns mockStartParameter
        every { mockStartParameter.taskNames } returns taskNames
        every { mockProject.findProperty("DISABLE_RNREPO") } returns disableRnrepoValue

        return mockProject
    }

    @Test
    fun `shouldPluginExecute should return true when assemble* task have no DISABLE_RNREPO variables`() {
        // Given
        val mockProject = setupPluginExecution(listOf("assembleDebug"), null)
        
        // When
        val result = invokePrivateMethod<Boolean>(plugin, "shouldPluginExecute", arrayOf(Project::class.java), mockProject)
        
        // Then
        assertThat(result).isTrue()
    }

    @Test
    fun `shouldPluginExecute should return true when assemble* task have DISABLE_RNREPO=true variable`() {
        // Given
        val mockProject = setupPluginExecution(listOf("assembleDebug"), "true")
        
        // When
        val result = invokePrivateMethod<Boolean>(plugin, "shouldPluginExecute", arrayOf(Project::class.java), mockProject)
        
        // Then
        assertThat(result).isFalse()
    }

    @Test
    fun `shouldPluginExecute should return false when task name does not match patterns and have no DISABLE_RNREPO variables`() {
        // Given
        val mockProject = setupPluginExecution(listOf("clearCache"), null)
        
        // When
        val result = invokePrivateMethod<Boolean>(plugin, "shouldPluginExecute", arrayOf(Project::class.java), mockProject)
        
        // Then
        assertThat(result).isFalse()
    }

    @Test
    fun `shouldPluginExecute should return false when task name does not match patterns and have DISABLE_RNREPO=true variable`() {
        // Given
        val mockProject = setupPluginExecution(listOf("clearCache"), "true")

        // When
        val result = invokePrivateMethod<Boolean>(plugin, "shouldPluginExecute", arrayOf(Project::class.java), mockProject)
        
        // Then
        assertThat(result).isFalse()
    }

    @Test
    fun `getReactNativeRoot should find React Native directory with provided REACT_NATIVE_ROOT_DIR property`() {
        // Given
        every { mockProject.findProperty("REACT_NATIVE_ROOT_DIR") } returns tempDir.absolutePath

        // When
        val result = invokePrivateMethod<File>(plugin, "getReactNativeRoot", arrayOf(Project::class.java), mockProject)

        // Then
        assertThat(result).isEqualTo(tempDir)
    }

    @Test
    fun `getReactNativeRoot should find React Native directory by traversing up when no REACT_NATIVE_ROOT_DIR`() {
        // Given
        every { mockProject.findProperty("REACT_NATIVE_ROOT_DIR") } returns null
        every { mockProject.rootProject } returns mockProject
        
        val nodeModulesDir = File(tempDir, "node_modules")
        val reactNativeDir = File(nodeModulesDir, "react-native")
        reactNativeDir.mkdirs()

        val someSubDir = File(reactNativeDir, "some/sub/dir")
        someSubDir.mkdirs()
        every { mockProject.rootDir } returns someSubDir

        // When
        val result = invokePrivateMethod<File>(plugin, "getReactNativeRoot", arrayOf(Project::class.java), mockProject)

        // Then
        assertThat(result).isEqualTo(tempDir)

        // Cleanup
        someSubDir.deleteRecursively()
        reactNativeDir.deleteRecursively()
        nodeModulesDir.deleteRecursively()
    }

    @Test
    fun `loadDenyList should parse config file correctly`() {
        // Given
        val extension = PackagesManager()
        val configFile = File(tempDir, "rnrepo.config.json")
        configFile.writeText("""
        {
            "denyList": ["react-native-vector-icons", "react-native-image-picker"]
        }
        """.trimIndent())
        every { mockProject.rootProject } returns mockProject
        setPrivateField(plugin, "REACT_NATIVE_ROOT_DIR", tempDir)
        
        // When
        invokePrivateMethod<Unit>(plugin, "loadDenyList", arrayOf(Project::class.java, PackagesManager::class.java), mockProject, extension)
        
        // Then
        assertThat(extension.denyList).containsExactlyInAnyOrder(
            "react-native-vector-icons", 
            "react-native-image-picker"
        )
    }

    @Test
    fun `loadDenyList should handle missing config file gracefully`() {
        // Given
        val extension = PackagesManager()
        every { mockProject.rootProject } returns mockProject
        
        // Mock getReactNativeRoot to return tempDir (no config file created)
        mockkObject(plugin)
        every { plugin["getReactNativeRoot"](mockProject) } returns tempDir
        
        // When
        invokePrivateMethod<Unit>(plugin, "loadDenyList", arrayOf(Project::class.java, PackagesManager::class.java), mockProject, extension)
        
        // Then
        assertThat(extension.denyList).isEmpty()
        verify { mockLogger.info(match { it.contains("Config file rnrepo.config.json not found") }) }
    }

    @Test
    fun `isPackageNotDenied should return false for denied packages`() {
        // Given
        val extension = PackagesManager()
        extension.denyList = setOf("react-native-vector-icons", "react-native-image-picker")
        
        // When
        val result1 = invokePrivateMethod<Boolean>(plugin, "isPackageNotDenied", arrayOf(String::class.java, PackagesManager::class.java), "react-native-vector-icons", extension)
        val result2 = invokePrivateMethod<Boolean>(plugin, "isPackageNotDenied", arrayOf(String::class.java, PackagesManager::class.java), "react-native-reanimated", extension)
        
        // Then
        assertThat(result1).isFalse()
        assertThat(result2).isTrue()
    }

    @Test
    fun `isSpecificCheckPassed should handle react-native-reanimated with worklets`() {
        // Given
        val extension = PackagesManager()
        val reanimatedPackage = PackageItem("react-native-reanimated", "3.5.0")
        val workletsPackage = PackageItem("react-native-worklets", "1.0.0")
        extension.projectPackages = setOf(reanimatedPackage, workletsPackage)
        
        // When
        val result = invokePrivateMethod<Boolean>(plugin, "isSpecificCheckPassed", arrayOf(PackageItem::class.java, PackagesManager::class.java), reanimatedPackage, extension)
        
        // Then
        assertThat(result).isTrue()
        assertThat(reanimatedPackage.classifier).isEqualTo("-worklets1.0.0")
    }

    @Test
    fun `isSpecificCheckPassed should handle react-native-reanimated without worklets`() {
        // Given
        val extension = PackagesManager()
        val reanimatedPackage = PackageItem("react-native-reanimated", "3.5.0")
        extension.projectPackages = setOf(reanimatedPackage)
        
        // When
        val result = invokePrivateMethod<Boolean>(plugin, "isSpecificCheckPassed", arrayOf(PackageItem::class.java, PackagesManager::class.java), reanimatedPackage, extension)
        
        // Then
        assertThat(result).isFalse()
    }

    @Test
    fun `isSpecificCheckPassed should handle react-native-gesture-handler dependencies`() {
        // Given
        val extension = PackagesManager()
        val gestureHandlerPackage = PackageItem("react-native-gesture-handler", "2.8.0")
        val reanimatedPackage = PackageItem("react-native-reanimated", "3.5.0")
        val svgPackage = PackageItem("react-native-svg", "13.0.0")
        extension.projectPackages = setOf(gestureHandlerPackage, reanimatedPackage, svgPackage)
        
        // When
        val result = invokePrivateMethod<Boolean>(plugin, "isSpecificCheckPassed", arrayOf(PackageItem::class.java, PackagesManager::class.java), gestureHandlerPackage, extension)
        
        // Then
        assertThat(result).isTrue()
    }

    @Test
    fun `getPackageNameAndVersion should parse package json correctly`() {
        // Given
        val packageJson = File(tempDir, "package.json")
        packageJson.writeText("""
            {
                "name": "@react-native-community/slider",
                "version": "4.4.2"
            }
        """.trimIndent())
        
        // When
        val result = invokePrivateMethod<PackageItem?>(plugin, "getPackageNameAndVersion", arrayOf(File::class.java), packageJson)
        
        // Then
        assertThat(result).isNotNull
        assertThat(result?.name).isEqualTo("react-native-community_slider")
        assertThat(result?.version).isEqualTo("4.4.2")
        assertThat(result?.classifier).isEmpty()
    }

    @Test
    fun `getPackageNameAndVersion should handle missing package json`() {
        // Given
        val nonExistentFile = File(tempDir, "nonexistent.json")
        
        // When
        val result = invokePrivateMethod<PackageItem?>(plugin, "getPackageNameAndVersion", arrayOf(File::class.java), nonExistentFile)
        
        // Then
        assertThat(result).isNull()
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> invokePrivateMethod(
        target: Any, 
        methodName: String,
        parameterTypes: Array<Class<*>>,
        vararg args: Any
    ): T {
        val method = target.javaClass.getDeclaredMethod(methodName, *parameterTypes)
        method.isAccessible = true
        return method.invoke(target, *args) as T
    }

    private fun setPrivateField(
        target: Any,
        fieldName: String,
        value: Any
    ) {
        val field = target.javaClass.getDeclaredField(fieldName)
        field.isAccessible = true
        field.set(target, value)
    }
}