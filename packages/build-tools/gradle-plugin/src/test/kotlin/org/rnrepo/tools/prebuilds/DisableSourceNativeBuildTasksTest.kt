package org.rnrepo.tools.prebuilds

import org.assertj.core.api.Assertions.assertThat
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.io.TempDir
import java.io.File

/**
 * Covers https://github.com/software-mansion/rnrepo/issues/451: substituting a package's JVM
 * dependency with its prebuilt AAR must also stop that package's own source subproject from
 * running its now-unused native (CMake/prefab) build.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DisableSourceNativeBuildTasksTest {
    @TempDir
    lateinit var testDir: File

    private lateinit var plugin: PrebuildsPlugin

    @BeforeEach
    fun setUp() {
        plugin = PrebuildsPlugin()
    }

    private fun nativeTaskNames() =
        listOf(
            "configureCMakeDebug",
            "configureCMakeRelWithDebInfo",
            "buildCMakeDebug",
            "externalNativeBuildRelease",
            "prefabReleasePackage",
        )

    @Test
    fun `disables every CMake, externalNativeBuild and prefab task of a substituted package's subproject`() {
        // Given
        val rootProject = ProjectBuilder.builder().withProjectDir(testDir).build()
        val libraryProject =
            ProjectBuilder
                .builder()
                .withParent(rootProject)
                .withName("react-native-reanimated")
                .build()
        val nativeTasks = nativeTaskNames().map { libraryProject.tasks.register(it) }
        val codegenTask = libraryProject.tasks.register("generateCodegenArtifactsFromSchema")

        val supportedPackages =
            setOf(
                PackageItem(name = "react-native-reanimated", version = "4.3.2", npmName = "react-native-reanimated"),
            )

        // When
        invokePrivateMethod<Unit>(
            plugin,
            "disableSourceNativeBuildTasksForSubstitutedPackages",
            arrayOf(org.gradle.api.Project::class.java, Set::class.java),
            rootProject,
            supportedPackages,
        )

        // Then: every CMake/externalNativeBuild/prefab task is disabled
        nativeTasks.forEach { assertThat(it.get().enabled).isFalse() }
        // Codegen still needs to run from source, so it must stay untouched
        assertThat(codegenTask.get().enabled).isTrue()
    }

    @Test
    fun `does nothing when the supported package has no matching subproject`() {
        // Given
        val rootProject = ProjectBuilder.builder().withProjectDir(testDir).build()
        val supportedPackages =
            setOf(
                PackageItem(name = "react-native-screens", version = "3.20.0", npmName = "react-native-screens"),
            )

        // When / Then: no exception for a supported package with no corresponding subproject
        invokePrivateMethod<Unit>(
            plugin,
            "disableSourceNativeBuildTasksForSubstitutedPackages",
            arrayOf(org.gradle.api.Project::class.java, Set::class.java),
            rootProject,
            supportedPackages,
        )
    }

    @Test
    fun `leaves unrelated tasks of the subproject untouched`() {
        // Given
        val rootProject = ProjectBuilder.builder().withProjectDir(testDir).build()
        val libraryProject =
            ProjectBuilder
                .builder()
                .withParent(rootProject)
                .withName("react-native-worklets")
                .build()
        val unrelatedTask = libraryProject.tasks.register("preBuild")
        val prefabTask = libraryProject.tasks.register("prefabDebugPackage")

        val supportedPackages =
            setOf(
                PackageItem(name = "react-native-worklets", version = "0.8.3", npmName = "react-native-worklets"),
            )

        // When
        invokePrivateMethod<Unit>(
            plugin,
            "disableSourceNativeBuildTasksForSubstitutedPackages",
            arrayOf(org.gradle.api.Project::class.java, Set::class.java),
            rootProject,
            supportedPackages,
        )

        // Then
        assertThat(prefabTask.get().enabled).isFalse()
        assertThat(unrelatedTask.get().enabled).isTrue()
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> invokePrivateMethod(
        target: Any,
        methodName: String,
        parameterTypes: Array<Class<*>>,
        vararg args: Any,
    ): T {
        val method = target.javaClass.getDeclaredMethod(methodName, *parameterTypes)
        method.isAccessible = true
        return method.invoke(target, *args) as T
    }
}
