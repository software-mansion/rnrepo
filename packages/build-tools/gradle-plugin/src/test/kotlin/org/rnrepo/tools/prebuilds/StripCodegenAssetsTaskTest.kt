package org.rnrepo.tools.prebuilds

import org.assertj.core.api.Assertions.assertThat
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class StripCodegenAssetsTaskTest {
    @TempDir
    lateinit var testDir: File

    private lateinit var mergedAssets: File
    private lateinit var strippedAssets: File

    @BeforeEach
    fun setUp() {
        mergedAssets = File(testDir, "merged").also { it.mkdirs() }
        strippedAssets = File(testDir, "stripped")
    }

    @Test
    fun `strips the codegen payload from the merged assets`() {
        val aar =
            aarWithAssets(
                "codegen.aar",
                "relwithdebinfo/arm64-v8a/libreact_codegen_rnscreens.a" to "static library bytes",
                "headers/react/renderer/components/rnscreens/Props.h" to "generated header",
                "meta/codegen_name.txt" to "rnscreens",
            )
        mergedAsset("relwithdebinfo/arm64-v8a/libreact_codegen_rnscreens.a", "static library bytes")
        mergedAsset("headers/react/renderer/components/rnscreens/Props.h", "generated header")
        mergedAsset("meta/codegen_name.txt", "rnscreens")

        runTask(aar)

        assertThat(strippedAssets.walkTopDown().filter { it.isFile }.toList()).isEmpty()
    }

    @Test
    fun `keeps assets the app owns`() {
        val aar = aarWithAssets("codegen.aar", "meta/codegen_name.txt" to "rnscreens")
        mergedAsset("meta/codegen_name.txt", "rnscreens")
        mergedAsset("fonts/Inter.ttf", "font bytes")

        runTask(aar)

        assertThat(strippedAsset("fonts/Inter.ttf")).exists()
        assertThat(strippedAsset("meta/codegen_name.txt")).doesNotExist()
    }

    @Test
    fun `keeps an app asset that shadows a payload path with different content`() {
        val aar = aarWithAssets("codegen.aar", "meta/npm_name.txt" to "react-native-screens")
        // The app's own asset wins the merge, so what lands here is not what we shipped.
        mergedAsset("meta/npm_name.txt", "app owned value")

        runTask(aar)

        assertThat(strippedAsset("meta/npm_name.txt")).hasContent("app owned value")
    }

    @Test
    fun `strips a path that several codegen artifacts ship with different content`() {
        // Every codegen artifact carries its own cmake/CMakeLists.txt, so only one of them can match
        // the merged file — the others must not make the task give up on it.
        val screens = aarWithAssets("screens.aar", "cmake/CMakeLists.txt" to "add_library(rnscreens)")
        val gestures = aarWithAssets("gestures.aar", "cmake/CMakeLists.txt" to "add_library(rngesturehandler)")
        mergedAsset("cmake/CMakeLists.txt", "add_library(rngesturehandler)")

        runTask(screens, gestures)

        assertThat(strippedAsset("cmake/CMakeLists.txt")).doesNotExist()
    }

    @Test
    fun `copies everything when no codegen artifacts are resolved`() {
        mergedAsset("fonts/Inter.ttf", "font bytes")

        runTask()

        assertThat(strippedAsset("fonts/Inter.ttf")).hasContent("font bytes")
    }

    private fun runTask(vararg codegenArtifacts: File) {
        val project = ProjectBuilder.builder().withProjectDir(testDir).build()
        val task = project.tasks.create("stripCodegenAssets", StripCodegenAssetsTask::class.java)
        task.codegenArtifacts.from(*codegenArtifacts)
        task.inputAssets.set(mergedAssets)
        task.outputAssets.set(strippedAssets)

        task.execute()
    }

    private fun mergedAsset(
        path: String,
        content: String,
    ) = File(mergedAssets, path).apply {
        parentFile.mkdirs()
        writeText(content)
    }

    private fun strippedAsset(path: String) = File(strippedAssets, path)

    private fun aarWithAssets(
        name: String,
        vararg assets: Pair<String, String>,
    ): File {
        val aar = File(testDir, name)
        ZipOutputStream(aar.outputStream().buffered()).use { zip ->
            zip.putNextEntry(ZipEntry("classes.jar"))
            zip.write("not an asset".toByteArray())
            zip.closeEntry()
            assets.forEach { (path, content) ->
                zip.putNextEntry(ZipEntry("assets/$path"))
                zip.write(content.toByteArray())
                zip.closeEntry()
            }
        }
        return aar
    }
}
