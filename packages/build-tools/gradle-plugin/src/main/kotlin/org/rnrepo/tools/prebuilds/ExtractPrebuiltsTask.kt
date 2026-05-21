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
            // Extract inside outputDir so cmake file's CMAKE_CURRENT_LIST_DIR paths are self-contained
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
                throw GradleException("RNRepo: Codegen prebuilt $moduleName does not contain codegen_name.txt")
            }

            val codegenName = metaFile.readText().trim()
            // release builds use RelWithDebInfo cmake type — artifacts are stored under relwithdebinfo/
            val currentBuildType = if (buildType.get() == "release") "relwithdebinfo" else buildType.get()
            var foundAnyLib = false

            abis.forEach { abi ->
                val hasLib =
                    project
                        .fileTree(extractionDir) {
                            it.include("**/assets/$currentBuildType/$abi/**/libreact_codegen_$codegenName.a")
                        }.firstOrNull() != null

                if (hasLib) {
                    foundAnyLib = true
                } else {
                    project.logger.warn("RNRepo: No $currentBuildType codegen library found for $abi in $moduleName")
                }
            }

            if (!foundAnyLib) {
                project.logger.lifecycle("RNRepo: Skipping $moduleName — no .a files found for $currentBuildType")
                return@forEach
            }

            if (!File(extractionDir, "assets/headers").exists()) {
                project.logger.warn("RNRepo: No headers in assets/headers for $moduleName, skipping")
                return@forEach
            }

            val cmakeLists = File(extractionDir, "assets/cmake/CMakeLists.txt")
            if (!cmakeLists.exists()) {
                throw GradleException("RNRepo: Codegen prebuilt $moduleName does not contain assets/cmake/CMakeLists.txt")
            }

            val npmNameFile = File(extractionDir, "assets/meta/npm_name.txt")
            val displayName = if (npmNameFile.exists()) npmNameFile.readText().trim() else moduleName
            project.logger.lifecycle("RNRepo: Registered prebuilt codegen for $displayName (codegen: $codegenName)")

            cmakeListsByCodegenName[codegenName] = cmakeLists
        }

        transformAutolinkingConfig(cmakeListsByCodegenName)
    }

    @Suppress("UNCHECKED_CAST")
    private fun transformAutolinkingConfig(cmakeListsByCodegenName: Map<String, File>) {
        val outputFile = transformedAutolinkFile.get().asFile
        outputFile.parentFile.mkdirs()

        val inputFile = autolinkInputFile.orNull?.asFile
        if (inputFile == null || !inputFile.exists()) {
            project.logger.warn(
                "RNRepo: autolinking.json not found, skipping cmake path injection — prebuilt codegen will be ignored, build time will be longer",
            )
            // Always produce the declared output so downstream tasks don't fail on a missing input
            outputFile.writeText("{\"dependencies\":{}}")
            return
        }

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
            project.logger.lifecycle("RNRepo: Redirected cmake for $libraryName → prebuilt at ${cmakeLists.absolutePath}")
        }

        val missingLibraries = cmakeListsByCodegenName.keys - rewrittenLibraries
        if (missingLibraries.isNotEmpty()) {
            throw GradleException(
                "RNRepo: Could not find autolinking entries for prebuilt codegen libraries: " +
                    missingLibraries.joinToString(", "),
            )
        }

        outputFile.writeText(JsonOutput.prettyPrint(JsonOutput.toJson(json)))
        project.logger.lifecycle("RNRepo: Wrote transformed autolinking.json (${rewrittenLibraries.size} cmake paths redirected)")
    }
}
