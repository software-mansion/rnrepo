package org.rnrepo.tools.prebuilds

import org.gradle.api.DefaultTask
import org.gradle.api.artifacts.Configuration
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.TaskAction
import java.io.File

abstract class ExtractPrebuiltsTask : DefaultTask() {
    @get:InputFiles
    abstract val codegenConfiguration: Property<Configuration>

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Input
    abstract val buildType: Property<String>

    @TaskAction
    fun execute() {
        val outDir = outputDir.get().asFile
        if (outDir.exists()) outDir.deleteRecursively()
        outDir.mkdirs()

        val codegenListFile = File(outDir, "codegen_libs.txt")
        val abis = listOf("arm64-v8a", "armeabi-v7a", "x86", "x86_64")
        val sb = StringBuilder()

        codegenConfiguration.get().resolvedConfiguration.resolvedArtifacts.forEach { artifact ->
            val moduleName = artifact.name
            val extractionDir = File(project.buildDir, "intermediates/rnrepo/$moduleName")

            // 1. Unpack AAR
            project.copy {
                it.from(project.zipTree(artifact.file))
                it.into(extractionDir)
            }

            // 2. Find codegen_name.txt (either in root or assets)
            val metaFile =
                File(extractionDir, "codegen_name.txt").let {
                    if (it.exists()) it else File(extractionDir, "assets/meta/codegen_name.txt")
                }

            if (metaFile.exists()) {
                val codegenName = metaFile.readText().trim()
                val currentBuildType = buildType.get()

                // 3. Extract static libraries (.a files) for each ABI from the correct build variant
                abis.forEach { abi ->
                    // Try variant-specific path first (new format)
                    val variantStaticLib =
                        project
                            .fileTree(extractionDir) {
                                it.include("**/assets/$currentBuildType/$abi/**/libreact_codegen_$codegenName.a")
                            }.firstOrNull()

                    if (variantStaticLib != null) {
                        val abiDest = File(outDir, abi)
                        abiDest.mkdirs()
                        project.copy {
                            it.from(variantStaticLib)
                            it.into(abiDest)
                        }
                        project.logger.lifecycle("RNRepo: Extracted $currentBuildType codegen library for $abi from $moduleName")
                    } else {
                        project.logger.warn("RNRepo: No $currentBuildType codegen library found for $abi in $moduleName")
                    }
                }

                // 4. Extract Headers from assets/headers
                val headersDir = File(outDir, "headers/$codegenName")
                headersDir.mkdirs()

                val headersSourceDir = File(extractionDir, "assets/headers")
                if (headersSourceDir.exists()) {
                    project.copy {
                        it.from(headersSourceDir)
                        it.into(headersDir)
                        it.include("**/*.h")
                    }

                    // 5. Register in manifest: name;path_to_a;path_to_headers
                    // Using a placeholder ${ANDROID_ABI} for CMake
                    val cmakeLibPath = "${outDir.absolutePath}/\${ANDROID_ABI}/libreact_codegen_$codegenName.a"
                    sb.append("$codegenName;$cmakeLibPath;${headersDir.absolutePath}\n")
                } else {
                    project.logger.lifecycle(
                        "RNRepo: Headers not found in assets/headers for $moduleName - will build codegen from sources",
                    )
                }
            }
        }
        codegenListFile.writeText(sb.toString())
    }
}
