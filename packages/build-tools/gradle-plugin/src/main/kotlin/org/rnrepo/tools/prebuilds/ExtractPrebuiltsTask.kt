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

        val headersOutputDir = File(outDir, "headers")
        headersOutputDir.mkdirs()

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

            // Merge headers into the shared output directory (kept for packages whose redirected cmake
            // exposes them via PUBLIC include dirs).
            val headersSourceDir = File(extractionDir, "assets/headers")
            if (headersSourceDir.exists()) {
                project.copy {
                    it.from(headersSourceDir)
                    it.into(headersOutputDir)
                }
            } else {
                project.logger.warn("RNRepo: No headers in assets/headers for $moduleName")
            }

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
                    project.logger.info("RNRepo: No $currentBuildType codegen library found for $abi in $moduleName")
                }
            }

            if (!foundAnyLib) {
                // Header-only prebuilt (no compiled .a). The autolinking entry stays pointed at the
                // package's own jni CMakeLists, which compiles BOTH the package sources and the generated
                // codegen sources (Props.cpp / EventEmitters.cpp / <name>-generated.cpp …) globbed from
                // <pkg>/build/generated/source/codegen/jni — the directory codegen would normally populate.
                // Since we deliberately do not run the codegen generator locally, drop the prebuilt codegen
                // tree shipped in the AAR (assets/codegen-jni, .h + .cpp) straight into that directory so
                // the package compiles them. Headers alone are not enough — without the .cpp the linker
                // fails on undefined codegen symbols.
                val codegenSrcDir = File(extractionDir, "assets/codegen-jni")
                if (!codegenSrcDir.exists()) {
                    throw GradleException(
                        "RNRepo: header-only codegen prebuilt $moduleName does not contain assets/codegen-jni " +
                            "(generated codegen sources). Rebuild the AAR with a builder that packages them.",
                    )
                }
                val targetProject = project.rootProject.findProject(":$moduleName")
                if (targetProject == null) {
                    throw GradleException(
                        "RNRepo: $moduleName is a header-only codegen prebuilt but its Gradle project " +
                            "(:$moduleName) could not be found to place the generated codegen sources",
                    )
                }
                val codegenJniDir = File(targetProject.projectDir, "build/generated/source/codegen/jni")
                codegenJniDir.mkdirs()
                project.copy {
                    it.from(codegenSrcDir)
                    it.into(codegenJniDir)
                }
                project.logger.lifecycle(
                    "RNRepo: $moduleName has no prebuilt .a — placed prebuilt codegen sources into ${codegenJniDir.absolutePath}",
                )
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
        // Remove any stale output from a previous run. The presence of this file is the signal that
        // tells PrebuildsPlugin to redirect React Native's autolinking input here, so it must exist
        // only when we actually rewrote cmake paths below. In every early-return case we leave it
        // absent so React Native keeps using its own, untouched autolinking.json.
        if (outputFile.exists()) outputFile.delete()

        val inputFile = autolinkInputFile.orNull?.asFile
        if (inputFile == null || !inputFile.exists()) {
            project.logger.warn(
                "RNRepo: autolinking.json not found, skipping cmake path injection — React Native will use its own " +
                    "autolinking config and prebuilt codegen will be ignored, so the build will be slower",
            )
            return
        }

        if (cmakeListsByCodegenName.isEmpty()) {
            // Nothing to redirect (e.g. every codegen package was header-only); leave React Native on
            // its own autolinking.json rather than handing it an identical copy.
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

        outputFile.parentFile.mkdirs()
        outputFile.writeText(JsonOutput.prettyPrint(JsonOutput.toJson(json)))
        project.logger.lifecycle("RNRepo: Wrote transformed autolinking.json (${rewrittenLibraries.size} cmake paths redirected)")
    }
}
