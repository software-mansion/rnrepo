package org.rnrepo.tools.prebuilds

import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.artifacts.Configuration
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import java.io.File

abstract class ExtractPrebuiltsTask : DefaultTask() {
    @get:InputFiles
    abstract val codegenConfiguration: Property<Configuration>

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Input
    abstract val buildType: Property<String>

    @get:InputFile
    @get:Optional
    abstract val autolinkInputFile: RegularFileProperty

    @get:OutputFile
    abstract val transformedAutolinkFile: RegularFileProperty

    @TaskAction
    fun execute() {
        val outDir = outputDir.get().asFile
        if (outDir.exists()) outDir.deleteRecursively()
        outDir.mkdirs()

        val abis = listOf("arm64-v8a", "armeabi-v7a", "x86", "x86_64")
        val cmakeListsByCodegenName = mutableMapOf<String, File>()

        codegenConfiguration.get().resolvedConfiguration.resolvedArtifacts.forEach { artifact ->
            val moduleName = artifact.name
            val extractionDir = File(outDir, "artifacts/$moduleName")

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

            if (!metaFile.exists()) {
                throw GradleException("RNRepo: Codegen prebuilt $moduleName does not contain codegen metadata")
            }

            val codegenName = metaFile.readText().trim()
            val currentBuildType = buildType.get()

            // 3. Validate static libraries (.a files) for each ABI from the correct build variant
            abis.forEach { abi ->
                val variantStaticLib =
                    project
                        .fileTree(extractionDir) {
                            it.include("**/assets/$currentBuildType/$abi/**/libreact_codegen_$codegenName.a")
                        }.firstOrNull()

                if (variantStaticLib == null) {
                    throw GradleException(
                        "RNRepo: Codegen prebuilt $moduleName does not contain $currentBuildType library for $abi",
                    )
                }
            }

            val headersSourceDir = File(extractionDir, "assets/headers")
            if (!headersSourceDir.exists()) {
                throw GradleException("RNRepo: Codegen prebuilt $moduleName does not contain packaged headers")
            }

            val cmakeLists = File(extractionDir, "assets/cmake/CMakeLists.txt")
            if (!cmakeLists.exists()) {
                throw GradleException(
                    "RNRepo: Codegen prebuilt $moduleName does not contain assets/cmake/CMakeLists.txt",
                )
            }

            cmakeListsByCodegenName[codegenName] = cmakeLists
        }
        transformAutolinkingConfig(cmakeListsByCodegenName)
    }

    @Suppress("UNCHECKED_CAST")
    private fun transformAutolinkingConfig(cmakeListsByCodegenName: Map<String, File>) {
        val inputFile = autolinkInputFile.get().asFile
        if (!inputFile.exists()) {
            throw GradleException("RNRepo: React Native autolinking input file not found at ${inputFile.absolutePath}")
        }

        val outputFile = transformedAutolinkFile.get().asFile
        outputFile.parentFile.mkdirs()

        if (cmakeListsByCodegenName.isEmpty()) {
            inputFile.copyTo(outputFile, overwrite = true)
            return
        }

        val json = JsonSlurper().parse(inputFile) as MutableMap<String, Any?>
        val dependencies = json["dependencies"] as? Map<String, Any?> ?: emptyMap()
        val rewrittenLibraries = mutableSetOf<String>()

        dependencies.values.forEach { dependency ->
            val dependencyMap = dependency as? MutableMap<String, Any?> ?: return@forEach
            val platforms = dependencyMap["platforms"] as? MutableMap<String, Any?> ?: return@forEach
            val android = platforms["android"] as? MutableMap<String, Any?> ?: return@forEach
            val libraryName = android["libraryName"] as? String ?: return@forEach
            val cmakeLists = cmakeListsByCodegenName[libraryName] ?: return@forEach

            android["cmakeListsPath"] = cmakeLists.absolutePath
            rewrittenLibraries.add(libraryName)
        }

        val missingLibraries = cmakeListsByCodegenName.keys - rewrittenLibraries
        if (missingLibraries.isNotEmpty()) {
            throw GradleException(
                "RNRepo: Could not find matching React Native autolinking entries for prebuilt codegen libraries: " +
                    missingLibraries.joinToString(", "),
            )
        }

        outputFile.writeText(JsonOutput.prettyPrint(JsonOutput.toJson(json)))
    }
}
