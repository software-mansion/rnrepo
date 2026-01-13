package org.rnrepo.tools.prebuilds

import org.gradle.api.DefaultTask
import org.gradle.api.artifacts.Configuration
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.*
import java.io.File

abstract class ExtractPrebuiltsTask : DefaultTask() {

    @get:InputFiles
    abstract val codegenConfiguration: Property<Configuration>

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

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
            val metaFile = File(extractionDir, "codegen_name.txt").let { 
                if (it.exists()) it else File(extractionDir, "assets/meta/codegen_name.txt")
            }

            if (metaFile.exists()) {
                val codegenName = metaFile.readText().trim()
                
                // 3. Extract static libraries (.a files) for each ABI
                abis.forEach { abi ->
                    val staticLib = project.fileTree(extractionDir) {
                        it.include("**/$abi/**/libreact_codegen_$codegenName.a")
                    }.firstOrNull()

                    if (staticLib != null) {
                        val abiDest = File(outDir, abi)
                        abiDest.mkdirs()
                        project.copy {
                            it.from(staticLib)
                            it.into(abiDest)
                        }
                    }
                }

                // 4. Extract Headers
                val headersDir = File(outDir, "headers/$codegenName")
                headersDir.mkdirs()
                
                // Attempt to find headers ZIP in the same version but with 'headers' classifier
                try {
                    val id = artifact.moduleVersion.id
                    val headerDep = "${id.group}:${id.name}:${id.version}:headers@zip"
                    val headerArtifact = project.configurations.detachedConfiguration(
                        project.dependencies.create(headerDep)
                    ).singleFile

                    project.copy {
                        it.from(project.zipTree(headerArtifact))
                        it.into(headersDir)
                    }
                } catch (e: Exception) {
                    project.logger.warn("RNRepo: Headers not found for $moduleName")
                }

                // 5. Register in manifest: name;path_to_a;path_to_headers
                // Using a placeholder ${ANDROID_ABI} for CMake
                val cmakeLibPath = "${outDir.absolutePath}/\${ANDROID_ABI}/libreact_codegen_$codegenName.a"
                sb.append("$codegenName;$cmakeLibPath;${headersDir.absolutePath}\n")
            }
        }
        codegenListFile.writeText(sb.toString())
    }
}
