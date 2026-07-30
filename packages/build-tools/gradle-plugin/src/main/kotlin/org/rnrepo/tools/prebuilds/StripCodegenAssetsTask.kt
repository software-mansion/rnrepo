package org.rnrepo.tools.prebuilds

import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import java.io.File
import java.util.zip.CRC32
import java.util.zip.ZipFile

/**
 * Drops the prebuilt codegen payload from the assets that get packaged into the app.
 *
 * An AAR can only carry arbitrary files under `assets/`, so that is where the `-codegen` artifacts
 * ship their per-ABI static libraries, headers and cmake glue. [ExtractPrebuiltsTask] unzips those
 * artifacts itself from the `codegenPrebuilts` configuration, so nothing reads them from the merged
 * assets — but AGP still merges them into the APK, where they are worth hundreds of megabytes.
 *
 * Entries are matched by their exact path inside the codegen AARs rather than by name, so assets
 * that merely share a directory name with the payload (`headers/`, `meta/`, ...) survive.
 */
abstract class StripCodegenAssetsTask : DefaultTask() {
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.NAME_ONLY)
    abstract val codegenArtifacts: ConfigurableFileCollection

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val inputAssets: DirectoryProperty

    @get:OutputDirectory
    abstract val outputAssets: DirectoryProperty

    @TaskAction
    fun execute() {
        val outDir = outputAssets.get().asFile
        if (outDir.exists()) outDir.deleteRecursively()
        outDir.mkdirs()

        val inDir = inputAssets.get().asFile
        if (!inDir.isDirectory) return

        val payload = collectPayload()

        inDir.walkTopDown().filter { it.isFile }.forEach { file ->
            val relativePath = file.toRelativeString(inDir).replace(File.separatorChar, '/')
            if (payload[relativePath]?.any { it.matches(file) } == true) {
                return@forEach
            }
            val target = File(outDir, relativePath)
            target.parentFile.mkdirs()
            file.copyTo(target, overwrite = true)
        }
    }

    /**
     * Every `assets/` entry of every resolved codegen artifact, keyed by its path relative to
     * `assets/` — the exact shape the merged assets directory uses.
     */
    private fun collectPayload(): Map<String, Set<PayloadEntry>> {
        val payload = mutableMapOf<String, MutableSet<PayloadEntry>>()
        codegenArtifacts.files.forEach { artifact ->
            if (!artifact.isFile) return@forEach
            ZipFile(artifact).use { zip ->
                zip
                    .entries()
                    .asSequence()
                    .filter { !it.isDirectory && it.name.startsWith(ASSETS_PREFIX) }
                    .forEach { entry ->
                        // Every artifact ships its own cmake/meta files at the same path, so one path
                        // maps to as many candidates as there are codegen packages in the build.
                        payload
                            .getOrPut(entry.name.removePrefix(ASSETS_PREFIX)) { mutableSetOf() }
                            .add(PayloadEntry(entry.size, entry.crc))
                    }
            }
        }
        return payload
    }

    /**
     * Size and checksum of one packaged entry. A merged asset is only dropped when it is byte-for-byte
     * the entry we shipped: an app that happens to own an asset at the same path overrides the
     * library's during merging, and that file has to survive.
     */
    private data class PayloadEntry(
        val size: Long,
        val crc: Long,
    ) {
        fun matches(file: File): Boolean {
            if (file.length() != size) return false
            val checksum = CRC32()
            file.inputStream().buffered().use { stream ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                while (true) {
                    val read = stream.read(buffer)
                    if (read < 0) break
                    checksum.update(buffer, 0, read)
                }
            }
            return checksum.value == crc
        }
    }

    private companion object {
        const val ASSETS_PREFIX = "assets/"
    }
}
