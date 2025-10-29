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
import com.android.build.gradle.internal.tasks.factory.dependsOn

class PackageItem(val name: String, val version: String, var module: String = "") {
    init { 
        if (module.isEmpty()) {
            module = name
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PackageItem) return false

        if (name != other.name) return false
        if (version != other.version) return false
        if (module != other.module) return false

        return true
    }

    override fun hashCode(): Int {
        var result = name.hashCode()
        result = 31 * result + version.hashCode()
        result = 31 * result + module.hashCode()
        return result
    }
}


open class BuildleExtension {
    var packages: List<PackageItem> = listOf()
    var reactNativeVersion: String = ""
}

class AarAutomationPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val gradleStartTaskName = project.gradle.startParameter.taskNames
        if (gradleStartTaskName.any { it.contains("assemble") || it.contains("build") }) {
            val extension = project.extensions.create("buildle", BuildleExtension::class.java)
            println("Start BUILDLE ")
            
            // Add SWM Maven repository with AAR artifacts
            project.repositories.apply {
                maven { repo ->
                    repo.name = "reposiliteRepositoryReleases"
                    repo.url = URI("https://repo.swmtest.xyz/releases")
                }
            }

            // Check what packages are in project and which are we supporting
            findPackagesWithVersions(project, extension)

            // Add dependencies for supported packages 
            extension.packages.forEach { packageItem ->
                println("RAD Adding dependency for ${packageItem.name} version ${packageItem.version}")
                project.dependencies.add("implementation", "com.swmansion:${packageItem.module}:${packageItem.version}-rn${extension.reactNativeVersion}")
            }

            // Add pickFirsts due to duplicates of libworklets.so from reanimated .aar and worklets
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
                    } ?: run {
                        project.logger.warn("The Android Gradle Plugin is not applied to this project.")
                    }
                }
            }

            // Add dependency on generating codegen schema for each library so that task is not dropped
            extension.packages.forEach { packageItem ->
                println("Adding dependency on task :${packageItem.name}:generateCodegenArtifactsFromSchema")
                project.tasks.named("preBuild", Task::class.java).dependsOn(":${packageItem.name}:generateCodegenArtifactsFromSchema")
            }

            // Add substitution for supported packages 
            project.afterEvaluate {
                extension.packages.forEach { packageItem ->
                    println("Adding substitution for ${packageItem.name}")
                    project.configurations.all { config ->
                        config.resolutionStrategy.dependencySubstitution {
                            it.substitute(it.project(":${packageItem.name}"))
                                .using(it.module("com.swmansion:${packageItem.module}:${packageItem.version}-rn${extension.reactNativeVersion}"))
                        }
                    }
                }
            }
        }
    }

    /**
    * Checks if a specific package is available in the remote repository.
    *
    * This function performs a HEAD request to determine if the specified package version is present for the given React Native (RN) version.
    *
    * @param packageName The name of the package to check.
    * @param packageVersion The version of the package.
    * @param RNVersion The React Native version that the package is intended for.
    *
    * @return True if the package is available, false otherwise.
    */
    private fun isPackageAvailable(
        packageName: String, 
        packageVersion: String, 
        RNVersion: String
    ): Boolean {
        val cachePath = System.getProperty("user.home") + "/.gradle/caches/modules-2/files-2.1"
        val groupPath = "com.swmansion/$packageName"
        val artifactPath = "${packageVersion}-rn$RNVersion"
        
        // Construct the local path expected for the .aar file in cache
        val filePathInCache = "$cachePath/$groupPath/$artifactPath"
        val cacheFile = File(filePathInCache)
        // Check if the directory for this package and version exists in the cache
        if (cacheFile.exists() && cacheFile.isDirectory) {
 
            // If the directory exists, we presume the AAR is cached correctly (could extend to check for file)
            return true
        }

        val urlString = "https://repo.swmtest.xyz/releases/com/swmansion/${packageName}/${packageVersion}-rn${RNVersion}/${packageName}-${packageVersion}-rn${RNVersion}.aar"
        return try {
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "HEAD"
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            val responseCode = connection.responseCode
            connection.disconnect()
            return responseCode == HttpURLConnection.HTTP_OK
        } catch (e: Exception) {
            return false
        }
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

        // find react-native version
        val rnPackageJsonFile = File(node_modulesDir, "react-native/package.json")
        if (!rnPackageJsonFile.exists()) {
            println("react-native package.json not found in node_modules/react-native")
            return
        }
        try {
            val json = JsonSlurper().parse(rnPackageJsonFile) as Map<String, Any>
            val rnVersion = json["version"] as? String
            if (rnVersion != null) {
                extension.reactNativeVersion = rnVersion
                println("Detected React Native version: $rnVersion")
            } else {
                println("Could not find version field in react-native package.json")
                return
            }
        } catch (e: Exception) {
            println("Error parsing react-native package.json: ${e.message}")
            return
        }

        val packagesWithVersions = mutableListOf<PackageItem>()
        node_modulesDir.listFiles()?.forEach { packageDir ->
            if (!packageDir.isDirectory) return@forEach
            val packageJsonFile = File(packageDir, "package.json")
            val androidDir = File(packageDir, "android")
            if (!packageJsonFile.exists() || !androidDir.exists()) return@forEach
            try {
                val json = JsonSlurper().parse(packageJsonFile) as Map<String, Any>
                val packageName = json["name"] as? String
                val packageVersion = json["version"] as? String
                if (packageName != null && packageVersion != null) {
                    if (isPackageAvailable(packageName, packageVersion, extension.reactNativeVersion)) {
                        packagesWithVersions.add(PackageItem(packageName, packageVersion))
                        println("Found supported package: $packageName version $packageVersion")
                    }
                }
            } catch (e: Exception) {}
        }

        // gesture-handler and reanimated share common interfaces, so if both are present then we need to use other aar file
        // todo GH&svg common interfaces
        val gestureHandlerItem = packagesWithVersions.find { it.name == "react-native-gesture-handler" }
        val hasReanimated = packagesWithVersions.any { it.name == "react-native-reanimated" }
        if (gestureHandlerItem != null && hasReanimated) {
            gestureHandlerItem.module = "react-native-gesture-handler-reanimated"
        }
        extension.packages = packagesWithVersions
    }
}