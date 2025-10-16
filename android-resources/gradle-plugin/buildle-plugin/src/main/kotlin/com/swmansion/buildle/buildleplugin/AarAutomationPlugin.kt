package com.swmansion.buildle.buildleplugin

import org.gradle.api.*
import org.gradle.api.tasks.*
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import groovy.json.JsonSlurper
import org.gradle.api.artifacts.*
import org.gradle.api.artifacts.repositories.MavenArtifactRepository
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.* // Import DSL extensions for dependencies and properties
import java.net.URI
import org.gradle.api.artifacts.Configuration
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import com.android.build.gradle.AppExtension
import com.android.build.gradle.BaseExtension 

open class PackageItem(val name: String, val version: String) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PackageItem) return false

        if (name != other.name) return false
        if (version != other.version) return false

        return true
    }

    override fun hashCode(): Int {
        var result = name.hashCode()
        result = 31 * result + version.hashCode()
        return result
    }
}


open class BuildleExtension {
    var packages: List<PackageItem> = listOf()
    var reactNativeVersion: String = ""
    var supportedPackages: Set<PackageItem> = emptySet()
}

class AarAutomationPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create("buildle", BuildleExtension::class.java)
        println("Start BUILDLE")
        
        // Add SWM Maven repository with AAR artifacts
        project.repositories.apply {
            maven { repo ->
                repo.name = "reposiliteRepositoryReleases"
                repo.url = URI("https://repo.swmtest.xyz/releases")
            }
        }

        // Check what packages are in project and which are we supporting
        findPackagesWithVersions(project, extension)
        fetchSupportedPackages(project, extension)
        filterUnsupportedPackages(extension)

        // Add dependencies for supported packages 
        extension.packages.forEach { packageItem ->
            println("RAD Adding dependency for ${packageItem.name} version ${packageItem.version}")
            //project.dependencies.add("implementation", "com.swmansion:${packageItem.name}:${packageItem.version}-rn${extension.reactNativeVersion}")
            project.dependencies.add("implementation", "com.swmansion:${packageItem.name}:${packageItem.version}-rn${extension.reactNativeVersion}@aar")
        }
 
        // Add substitution for supported packages 

        extension.packages.forEach { packageItem ->
            if (packageItem.name == "react-native-reanimated") {
                val androidExtension = project.extensions.getByName("android") as? BaseExtension
                androidExtension?.let { android ->
                    val packagingOptions = android.packagingOptions
                    val excludedPatterns = packagingOptions.excludes

                    packagingOptions.apply {
                        pickFirsts += "lib/arm64-v8a/libworklets.so"
                        pickFirsts += "lib/armeabi-v7a/libworklets.so"
                        pickFirsts += "lib/x86/libworklets.so"
                        pickFirsts += "lib/x86_64/libworklets.so"
                    }
                    // 
                } ?: run {
                    project.logger.warn("The Android Gradle Plugin is not applied to this project.")
                }
            }
        }

        project.afterEvaluate {
            extension.packages.forEach { packageItem ->
                println("Adding substitution for ${packageItem.name}")
                project.configurations.all { config ->
                    config.resolutionStrategy.dependencySubstitution {
                        it.substitute(it.project(":${packageItem.name}"))
                            .using(it.module("com.swmansion:${packageItem.name}:${packageItem.version}-rn${extension.reactNativeVersion}@aar"))
                            //.using(it.module("com.swmansion:${packageItem.name}:${packageItem.version}-rn${extension.reactNativeVersion}"))
                    }
                }
            }
        }
    }

    private fun fetchSupportedPackages(project: Project, extension: BuildleExtension) {
        val configName = "downloadSupportedPackages"
        val downloadConfig: Configuration = project.configurations.maybeCreate(configName).apply {
            isTransitive = false
        }

        project.dependencies.add(configName, "com.swmansion:supported-packages:1.0.0@json")
        try {
            val resolvedFiles = downloadConfig.resolve() 
            if (resolvedFiles.isEmpty()) {
                throw IllegalStateException("Nie znaleziono artefaktu: supported-packages.json")
            }
            
            // read json to extension.supportedPackages
            val jsonfile = resolvedFiles.first()
            val json = JsonSlurper().parse(jsonfile) as Map<String, Map<String, String>>
            val supportedPackages = mutableSetOf<PackageItem>()
            val supportedForReactNativeVersion = json[extension.reactNativeVersion] ?: emptyMap()
            supportedForReactNativeVersion.forEach { (name, version) ->
                supportedPackages.add(PackageItem(name, version))
            }
            extension.supportedPackages = supportedPackages
        } catch (e: Exception) {
            project.logger.error("Błąd podczas pobierania artefaktu supported-packages: ${e.message}", e)
        } finally {
            project.configurations.remove(downloadConfig)
        }

    }

    private fun filterUnsupportedPackages(extension: BuildleExtension) {
        extension.packages = extension.packages.intersect(extension.supportedPackages).toList()
        println("Filtered packages: ${extension.packages.map { "${it.name}@${it.version}" }}")
    }

    private fun findPackagesWithVersions(rootProject: Project, extension: BuildleExtension) {
        val reactNativeRoot = if (rootProject.rootDir.name == "android") {
            rootProject.rootDir.parentFile
        } else {
            rootProject.rootDir
        }

        // iter over node_modules/<package>/package.json
        val node_modulesDir = File(reactNativeRoot, "node_modules")
        if (!node_modulesDir.exists()) {
            println("node_modules directory not found: ${node_modulesDir.absolutePath}. Run your command from YourProjectDir or YourProjectDir/android")
            return
        }

        val packagesWithVersions = mutableListOf<PackageItem>()
        node_modulesDir.listFiles()?.forEach { packageDir ->
            if (!packageDir.isDirectory) return@forEach
            val packageJsonFile = File(packageDir, "package.json")
            if (!packageJsonFile.exists()) return@forEach
            try {
                val json = JsonSlurper().parse(packageJsonFile) as Map<String, Any>
                val packageName = json["name"] as? String
                val packageVersion = json["version"] as? String
                if (packageName != null && packageVersion != null) {
                    if (packageName == "react-native") {
                        extension.reactNativeVersion = packageVersion
                        println("Set reactNativeVersion to ${extension.reactNativeVersion}")
                    } else {
                        packagesWithVersions.add(PackageItem(packageName, packageVersion))
                    }
                }
            } catch (e: Exception) {}
        }
        extension.packages = packagesWithVersions
    }
}