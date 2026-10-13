package org.rnrepo.tools.prebuilds

import groovy.json.JsonSlurper
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.gradle.api.GradleException
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.lang.reflect.InvocationTargetException

/**
 * Covers https://github.com/software-mansion/rnrepo/issues/444: the cmake path RNRepo injects into
 * React Native's autolinking.json is pasted verbatim into Android-autolinking.cmake, so it has to
 * use forward slashes on every host — a Windows path with backslashes breaks CMake parsing there.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ExtractPrebuiltsTaskTest {
    @TempDir
    lateinit var testDir: File

    @Test
    fun `toCmakePath converts Windows separators to forward slashes`() {
        val windowsPath =
            """C:\Projects\mobile_app\android\app\build\generated\rnrepo\prebuilts\artifacts""" +
                """\react-native-worklets\assets\cmake\CMakeLists.txt"""

        val cmakePath = ExtractPrebuiltsTask.toCmakePath(windowsPath, separator = '\\')

        assertThat(cmakePath).isEqualTo(
            "C:/Projects/mobile_app/android/app/build/generated/rnrepo/prebuilts/artifacts" +
                "/react-native-worklets/assets/cmake/CMakeLists.txt",
        )
    }

    @Test
    fun `toCmakePath leaves POSIX paths untouched`() {
        val posixPath = "/app/android/app/build/generated/rnrepo/prebuilts/artifacts/react-native-worklets/assets/cmake/CMakeLists.txt"

        assertThat(ExtractPrebuiltsTask.toCmakePath(posixPath, separator = '/')).isEqualTo(posixPath)
    }

    @Test
    fun `transformed autolinking config points at the prebuilt cmake file with forward slashes`() {
        // Given
        val task = newTask()
        val inputFile = File(testDir, "autolinking.json").apply { writeText(AUTOLINKING_JSON) }
        val outputFile = File(testDir, "rnrepo/autolinking.json")
        val prebuiltCmakeLists =
            File(testDir, "prebuilts/artifacts/react-native-worklets/assets/cmake/CMakeLists.txt").apply {
                parentFile.mkdirs()
                writeText("# prebuilt codegen")
            }
        task.autolinkInputFile.set(inputFile)
        task.transformedAutolinkFile.set(outputFile)

        // When
        transformAutolinkingConfig(task, mapOf("rnworklets" to prebuiltCmakeLists))

        // Then
        assertThat(outputFile).exists()
        val written = androidPlatform(outputFile, "react-native-worklets")["cmakeListsPath"] as String
        assertThat(written).doesNotContain("\\")
        assertThat(written).isEqualTo(prebuiltCmakeLists.absolutePath.replace(File.separatorChar, '/'))
        // Dependencies without a prebuilt codegen keep whatever React Native generated for them
        assertThat(androidPlatform(outputFile, "react-native-screens")["cmakeListsPath"])
            .isEqualTo("/app/node_modules/react-native-screens/android/src/main/jni/CMakeLists.txt")
    }

    @Test
    fun `fails when a prebuilt codegen library has no autolinking entry to redirect`() {
        // Given
        val task = newTask()
        task.autolinkInputFile.set(File(testDir, "autolinking.json").apply { writeText(AUTOLINKING_JSON) })
        task.transformedAutolinkFile.set(File(testDir, "rnrepo/autolinking.json"))
        val orphanCmakeLists = File(testDir, "orphan/CMakeLists.txt").apply { parentFile.mkdirs() }

        // When / Then
        assertThatThrownBy { transformAutolinkingConfig(task, mapOf("rnorphan" to orphanCmakeLists)) }
            .isInstanceOf(GradleException::class.java)
            .hasMessageContaining("rnorphan")
    }

    private fun newTask(): ExtractPrebuiltsTask {
        val project = ProjectBuilder.builder().withProjectDir(testDir).build()
        return project.tasks.register("extractCodegenPrebuilts", ExtractPrebuiltsTask::class.java).get()
    }

    private fun transformAutolinkingConfig(
        task: ExtractPrebuiltsTask,
        cmakeListsByCodegenName: Map<String, File>,
    ) {
        val method = ExtractPrebuiltsTask::class.java.getDeclaredMethod("transformAutolinkingConfig", Map::class.java)
        method.isAccessible = true
        try {
            method.invoke(task, cmakeListsByCodegenName)
        } catch (e: InvocationTargetException) {
            throw e.targetException
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun androidPlatform(
        autolinkingFile: File,
        dependency: String,
    ): Map<String, Any?> {
        val json = JsonSlurper().parse(autolinkingFile) as Map<String, Any?>
        val dependencies = json["dependencies"] as Map<String, Any?>
        val platforms = (dependencies[dependency] as Map<String, Any?>)["platforms"] as Map<String, Any?>
        return platforms["android"] as Map<String, Any?>
    }

    private companion object {
        val AUTOLINKING_JSON =
            """
            {
              "dependencies": {
                "react-native-worklets": {
                  "root": "/app/node_modules/react-native-worklets",
                  "platforms": {
                    "android": {
                      "sourceDir": "/app/node_modules/react-native-worklets/android",
                      "libraryName": "rnworklets",
                      "cmakeListsPath": "/app/node_modules/react-native-worklets/android/build/generated/source/codegen/jni/CMakeLists.txt"
                    }
                  }
                },
                "react-native-screens": {
                  "root": "/app/node_modules/react-native-screens",
                  "platforms": {
                    "android": {
                      "sourceDir": "/app/node_modules/react-native-screens/android",
                      "libraryName": "rnscreens",
                      "cmakeListsPath": "/app/node_modules/react-native-screens/android/src/main/jni/CMakeLists.txt"
                    }
                  }
                }
              }
            }
            """.trimIndent()
    }
}
