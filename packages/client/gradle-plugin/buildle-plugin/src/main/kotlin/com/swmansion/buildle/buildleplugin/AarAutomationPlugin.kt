package com.swmansion.buildle.buildleplugin

import org.gradle.api.*
import org.gradle.api.artifacts.*
import org.gradle.api.artifacts.repositories.MavenArtifactRepository
import org.gradle.api.tasks.*
import groovy.json.JsonSlurper
import org.gradle.kotlin.dsl.*
import java.io.File
import java.net.*
import java.nio.file.*
import java.util.concurrent.TimeUnit
import com.android.build.gradle.*
import com.android.build.gradle.internal.tasks.factory.dependsOn
import org.gradle.api.logging.Logger
import org.gradle.api.logging.Logging

data class PackageItem(val name: String, val version: String, var module: String = name)

open class BuildleExtension {
    var packages: List<PackageItem> = listOf()
    var reactNativeVersion: String = ""
    var denyList: Set<String> = setOf()
}

class AarAutomationPlugin : Plugin<Project> {
    private val logger: Logger = Logging.getLogger("AarAutomationPlugin")
    // config for denyList
    private val CONFIG_FILE_NAME = "rnrepo.config.json"
    // remote repo URL with AARs
    private val REMOTE_REPO_NAME = "reposiliteRepositoryReleases"
    private val REMOTE_REPO_URL = "https://repo.swmtest.xyz/releases"


    override fun apply(project: Project) {
        if (shouldPluginExecute(project)) {
            val extension = project.extensions.create("buildle", BuildleExtension::class.java)
            println("RNRepo Plugin has been applied to project!")
            
            // Add SWM Maven repository with AAR artifacts
            project.repositories.apply {
                maven { repo ->
                    repo.name = REMOTE_REPO_NAME
                    repo.url = URI(REMOTE_REPO_URL)
                }
            }

            // Check what packages are in project and which are we supporting
            loadDenyList(project.rootProject, extension)
            findPackagesWithVersions(project, extension)

            // Add dependencies for supported packages 
            extension.packages.forEach { packageItem ->
                project.logger.info("[RNRepo] Adding dependency for ${packageItem.name} version ${packageItem.version}")
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
                // val subproject = project.rootProject.findProject(":${packageItem.name}")
                // val codegenTaskName = "generateCodegenArtifactsFromSchema"
                // val codegenTaskExists = subproject?.tasks?.findByName(codegenTaskName) != null
                // if (codegenTaskExists) {
                //     project.logger.info("Adding dependency on task :${packageItem.name}:$codegenTaskName")
                //     project.tasks.named("preBuild", Task::class.java).configure { it.dependsOn(":${packageItem.name}:$codegenTaskName") }
                // }

                // if (packageItem.name.contains("expo")) return@forEach // todo - investigate or drop expo packages
                // keeping this code for reference if above doesn't work as expected
                project.logger.info("[RNRepo] Adding dependency on task :${packageItem.name}:generateCodegenArtifactsFromSchema")
                project.tasks.named("preBuild", Task::class.java).dependsOn(":${packageItem.name}:generateCodegenArtifactsFromSchema")
            }

            // Add substitution for supported packages 
            project.afterEvaluate {
                extension.packages.forEach { packageItem ->
                    val module = "com.swmansion:${packageItem.module}:${packageItem.version}-rn${extension.reactNativeVersion}"
                    project.logger.info("[RNRepo] Adding substitution for ${packageItem.name} using $module")
                    project.configurations.all { config ->
                        config.resolutionStrategy.dependencySubstitution {
                            it.substitute(it.project(":${packageItem.name}"))
                                .using(it.module(module))
                        }
                    }
                }
            }
        }
    }

    /**
     * Determines whether the plugin should execute based on the current build command and environment variable.
     * By default plugin is considered as enabled.
     *
     * This function evaluates three main conditions:
     * 1. **Task command check**: Checks if the current task command includes "assemble" or "build".
     *    This looks at the task names passed to Gradle at runtime to see if any involve building or assembling the project.
     *
     * 2. **Environment Variable check**: Inspects the "DISABLE_BUILDLE" environment variable.
     *    The plugin execution will be enabled unless the environment variable "DISABLE_BUILDLE" is explicitly set to "true" (ignoring case).
     *    If "DISABLE_BUILDLE" is set to "true", the plugin execution will be disabled; if it's unset or set to any other value, the execution will proceed.
     *
     * 3. **System Property check**: Looks at the "DISABLE_BUILDLE" system property.
     *    Similar to the environment variable, if the system property "DISABLE_BUILDLE" is set to "true" (case insensitive), the plugin will not execute.
     *    By default, if this property is not set, it defaults to "false", thereby enabling the plugin execution.
     *
     * @param project The Gradle project context providing access to configuration and execution parameters.
     * @return True if all conditions favor execution, otherwise false.
     */
    private fun shouldPluginExecute(project: Project): Boolean {
        val isBuildingCommand: Boolean = project.gradle.startParameter.taskNames.any {
            it.contains("assemble") || it.contains("build") || it.contains("install")}
        val isEnvEnabled: Boolean = System.getenv("DISABLE_BUILDLE")?.equals("true", ignoreCase = true)?.not() ?: true
        val isPropertyEnabled: Boolean = System.getProperty("DISABLE_BUILDLE", "false").equals("true", ignoreCase = true).not()
        project.logger.debug("[RNRepo] Building command: $isBuildingCommand, Env enabled: $isEnvEnabled, Property enabled: $isPropertyEnabled")
        return isBuildingCommand && isEnvEnabled && isPropertyEnabled
    }

    /**
     * Retrieves the root directory of the React Native project.
     *
     * @param rootProject The Gradle root project context, usually named ':'.
     * @return The root directory of the React Native project as a [File] object.
     */
    private fun getReactNativeRoot(rootProject: Project): File {
        return if (rootProject.rootDir.name == "android") rootProject.rootDir.parentFile else rootProject.rootDir
    }

    /**
     * Loads the deny list from the configuration file located in the React Native root directory.
     *
     * @param project The Gradle project context.
     * @param extension The BuildleExtension instance where the deny list will be stored.
     */
    private fun loadDenyList(project: Project, extension: BuildleExtension) {
        val reactNativeRoot = getReactNativeRoot(project.rootProject)
        val configFile = File(reactNativeRoot, CONFIG_FILE_NAME)
        if (!configFile.exists()) {
            project.logger.info("[RNRepo] Config file $CONFIG_FILE_NAME not found in React Native root: ${reactNativeRoot.absolutePath}. Using empty deny list.")
            return
        }
        try {
            val json = JsonSlurper().parse(configFile) as Map<String, Any>
            val denyList = json["denyList"] as? List<String>
            if (denyList != null) {
                project.logger.info("[RNRepo] Loaded deny list from config: $denyList")
                extension.denyList = denyList.toSet()
            } else {
                project.logger.info("[RNRepo] No denyList found in config file. Using empty deny list.")
            }
        } catch (e: Exception) {
            project.logger.error("[RNRepo] Error parsing $CONFIG_FILE_NAME: ${e.message}. Using empty deny list.")
        }
    }
    
    /**
     * Checks if a specific package is not in the deny list.
     *
     * @param packageName The name of the package to check.
     * @param extension The BuildleExtension instance containing the deny list.
     *
     * @return True if the package is not denied, false otherwise.
     */
    private fun isPackageNotDenied(
        packageName: String,
        extension: BuildleExtension
    ): Boolean {
        if (extension.denyList.contains(packageName)) {
            logger.info("[RNRepo] Package $packageName is in deny list, skipping in RNRepo.")
            return false
        }
        return true
    }

    /**
     * Checks if a specific package is available in the remote repository.
     *
     * This function performs a HEAD request to determine if the specified package version is present for the given React Native (RN) version.
     *
     * @param gradlePackageName The name of the package to check.
     * @param packageVersion The version of the package.
     * @param RNVersion The React Native version that the package is intended for.
     *
     * @return True if the package is available, false otherwise.
     */
    private fun isPackageAvailable(
        gradlePackageName: String, 
        packageVersion: String, 
        RNVersion: String
    ): Boolean {
        val cachePath = System.getProperty("user.home") + "/.gradle/caches/modules-2/files-2.1"
        val groupPath = "com.swmansion/$gradlePackageName"
        val artifactPath = "${packageVersion}-rn$RNVersion"
        
        // Construct the local path expected for the .aar file in cache
        val filePathInCache = "$cachePath/$groupPath/$artifactPath"
        val cacheFile = File(filePathInCache)
        // Check if the directory for this package and version exists in the cache
        if (cacheFile.exists() && cacheFile.isDirectory) {
            logger.info("[RNRepo] Package $gradlePackageName version $packageVersion is cached in Gradle cache.")
            return true
        }

        val urlString = "https://repo.swmtest.xyz/releases/com/swmansion/${gradlePackageName}/${packageVersion}-rn${RNVersion}/${gradlePackageName}-${packageVersion}-rn${RNVersion}.aar"
        var connection: HttpURLConnection? = null
        return try {
            connection = URL(urlString).openConnection() as HttpURLConnection
            connection.requestMethod = "HEAD"
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            logger.info("[RNRepo] Checking availability of package $gradlePackageName version $packageVersion at $urlString")
            connection.responseCode == HttpURLConnection.HTTP_OK
        } catch (e: Exception) {
            logger.error("[RNRepo] Error checking package availability for $gradlePackageName version $packageVersion: ${e.message}")
            false
        } finally {
            connection?.disconnect()
        }
    }

    private fun traversePackagesDir(dir: File, packagesList: MutableList<PackageItem>, extension: BuildleExtension) {
        dir.listFiles()?.forEach { file ->
            if (!file.isDirectory) return@forEach
            val packageJsonFile = File(file, "package.json")
            val androidDir = File(file, "android")
            if (!packageJsonFile.exists() || !androidDir.exists()) {
                traversePackagesDir(file, packagesList, extension)
                return@forEach
            }
            try {
                logger.info("[RNRepo] Found package.json in ${file.name}")
                val json = JsonSlurper().parse(packageJsonFile) as Map<String, Any>
                val packageName = json["name"] as? String
                val packageVersion = json["version"] as? String
                if (packageName != null && packageVersion != null) {
                    val gradlePackageName = packageName.replace("@", "").replace("/", "_")
                    if (isPackageAvailable(gradlePackageName, packageVersion, extension.reactNativeVersion) &&
                        isPackageNotDenied(packageName, extension)) {
                        packagesList.add(PackageItem(gradlePackageName, packageVersion))
                        logger.info("[RNRepo] Found supported package: $packageName version $packageVersion")
                    }
                }
            } catch (e: Exception) {
                logger.error("[RNRepo] Error parsing package.json in ${file.name}: ${e.message}")
            }
        }
    }

    private fun findPackagesWithVersions(rootProject: Project, extension: BuildleExtension) {
        val reactNativeRoot = getReactNativeRoot(rootProject)

        // iter over node_modules/<package>/package.json
        val node_modulesDir = File(reactNativeRoot, "node_modules")
        if (!node_modulesDir.exists()) {
            logger.error("[RNRepo] node_modules directory not found: ${node_modulesDir.absolutePath}. Run your command from YourProjectDir or YourProjectDir/android")
            return
        }

        // find react-native version
        val rnPackageJsonFile = File(node_modulesDir, "react-native/package.json")
        if (!rnPackageJsonFile.exists()) {
            logger.error("[RNRepo] react-native package.json not found in node_modules/react-native")
            return
        }
        try {
            val json = JsonSlurper().parse(rnPackageJsonFile) as Map<String, Any>
            val rnVersion = json["version"] as? String
            if (rnVersion != null) {
                extension.reactNativeVersion = rnVersion
                logger.info("[RNRepo] Detected React Native version: $rnVersion")
            } else {
                logger.error("[RNRepo] Could not find version field in react-native package.json")
                return
            }
        } catch (e: Exception) {
            logger.error("[RNRepo] Error parsing react-native package.json: ${e.message}")
            return
        }

        val packagesWithVersions = mutableListOf<PackageItem>()
        traversePackagesDir(node_modulesDir, packagesWithVersions, extension)

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