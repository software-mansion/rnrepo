package org.rnrepo.tools.prebuilds

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
import org.gradle.api.artifacts.dsl.RepositoryHandler

data class PackageItem(val name: String, val version: String, var classifier: String = "")

/**
 * Logger wrapper that automatically prefixes all messages with [RNRepo 📦]
 */
private class PrefixedLogger(private val delegate: Logger) {
    fun info(message: String) = delegate.info("[RNRepo 📦] $message")
    fun lifecycle(message: String) = delegate.lifecycle("[RNRepo 📦] $message")
    fun warn(message: String) = delegate.warn("[RNRepo 📦] $message")
    fun error(message: String) = delegate.error("[RNRepo 📦] $message")
    fun debug(message: String) = delegate.debug("[RNRepo 📦] $message")
}

open class PackagesManager {
    var projectPackages: Set<PackageItem> = mutableSetOf()
    var supportedPackages: Set<PackageItem> = mutableSetOf()
    var reactNativeVersion: String = ""
    var denyList: Set<String> = setOf()
}

class PrebuildsPlugin : Plugin<Project> {
    private val logger: PrefixedLogger = PrefixedLogger(Logging.getLogger("PrebuildsPlugin"))
    private var REACT_NATIVE_ROOT_DIR: File? = null
    // config for denyList
    private val CONFIG_FILE_NAME = "rnrepo.config.json"

    override fun apply(project: Project) {
        if (shouldPluginExecute(project)) {
            val extension = project.extensions.create("rnrepo", PackagesManager::class.java)
            logger.lifecycle("RN Repo plugin v${BuildConstants.PLUGIN_VERSION} is enabled")

            // Check what packages are in project and which are we supporting
            REACT_NATIVE_ROOT_DIR = getReactNativeRoot(project)
            if (!getReactNativeVersion(extension)) {
                logger.error("Could not determine React Native version, aborting RNRepo plugin setup.")
                return
            }
            getProjectPackages(project.rootProject.allprojects, extension)
            loadDenyList(extension)
            setupSupportedPackages(project, extension)

            // Setup
            extension.supportedPackages.forEach { packageItem ->
                addDependency(project, "implementation", "org.rnrepo.public:${packageItem.name}:${packageItem.version}:rn${extension.reactNativeVersion}${packageItem.classifier}@aar")
            }

            // Add pickFirsts due to duplicates of libworklets.so from reanimated .aar and worklets
            extension.supportedPackages.forEach { packageItem ->
                if (packageItem.name == "react-native-reanimated") {
                    val androidExtension = project.extensions.getByName("android") as? BaseExtension
                    androidExtension?.let { android ->
                        val packagingOptions = android.packagingOptions

                        packagingOptions.apply {
                            jniLibs.pickFirsts += "lib/arm64-v8a/libworklets.so"
                            jniLibs.pickFirsts += "lib/armeabi-v7a/libworklets.so"
                            jniLibs.pickFirsts += "lib/x86/libworklets.so"
                            jniLibs.pickFirsts += "lib/x86_64/libworklets.so"
                        }
                    } ?: run {
                        logger.warn("The Android Gradle Plugin is not applied to this project.")
                    }
                }
            }

            // Add dependency on generating codegen schema for each library so that task is not dropped
            extension.supportedPackages.forEach { packageItem ->
                val codegenTaskName = "generateCodegenArtifactsFromSchema"
                project.evaluationDependsOn(":${packageItem.name}")
                project.afterEvaluate {
                    try {
                        val libraryProject = project.project(":${packageItem.name}")
                        val libraryCodegenTaskProvider = libraryProject.tasks.named(codegenTaskName)
                        val appPreBuildTaskProvider = project.tasks.named("preBuild")
                        appPreBuildTaskProvider.configure {
                            it.dependsOn(libraryCodegenTaskProvider)
                        }
                        logger.lifecycle("✅ Successfully linked ${packageItem.name}:${codegenTaskName} to ${project.name}:preBuild")
                    } catch (e: Exception) {
                        logger.lifecycle("⚠️ Failed to find or link task :${packageItem.name}:$codegenTaskName. Error: ${e.message}")
                    }
                }
            }

            // Add substitution for supported packages for all projects and all configurations
            project.rootProject.allprojects.forEach { subproject ->
                if (subproject == project.rootProject) return@forEach   
                val substitutionAction = Action<Project> { evaluatedProject ->
                    extension.supportedPackages.forEach { packageItem ->
                        val module = "org.rnrepo.public:${packageItem.name}:${packageItem.version}"
                        evaluatedProject.configurations.all { config ->
                            config.resolutionStrategy.dependencySubstitution { substitutions ->
                                substitutions.all { dependencySubstitution ->
                                    if (dependencySubstitution.requested.displayName.contains("${packageItem.name}")) {
                                        dependencySubstitution.useTarget(substitutions.module(module))
                                        dependencySubstitution.artifactSelection {
                                            it.selectArtifact("aar", "aar", "rn${extension.reactNativeVersion}${packageItem.classifier}")
                                        }
                                        logger.info("Adding substitution for ${packageItem.name} using $module in config ${config.name} of project ${evaluatedProject.name}")
                                    }
                                }
                            }
                        }
                    }
                }
                substitutionAction.execute(subproject)
                // TODO(radoslawrolka): keeping in case of issues with afterEvaluate
                // if (subproject.state.executed) {
                //     substitutionAction.execute(subproject)
                // } else {
                //     subproject.afterEvaluate(substitutionAction)
                // }
            }
        }
    }

    private fun getProperty(project: Project, propertyName: String, defaultValue: String): String {
        return project.findProperty(propertyName) as? String ?: System.getenv(propertyName) ?: defaultValue
    }

    private fun addDependency(project: Project, configurationName: String, dependencyNotation: String) {
        project.dependencies.add(configurationName, dependencyNotation)
        logger.info("Added dependency: $dependencyNotation to configuration: $configurationName in project ${project.name}")
    }

    private fun addRepositoryIfNotExists(repositories: RepositoryHandler, repoUrl: String, repoName: String?) {
        val isRepositoryAdded = repositories.any { repo ->
            (repo as? MavenArtifactRepository)?.url?.toString() == repoUrl
        }
        if (!isRepositoryAdded) {
            repositories.maven { repo ->
                repo.url = URI(repoUrl)
                if (repoName != null) repo.name = repoName
            }
            logger.info("Added Maven repository: $repoUrl")
        }
    }

    /**
     * Determines whether the plugin should execute based on the current build command and environment variable.
     * By default plugin is considered as enabled.
     *
     * This function evaluates two main conditions:
     * 1. **Task command check**: Checks if the current task command includes "assemble", "build", or "install".
     *    This looks at the task names passed to Gradle at runtime to see if any involve building or assembling the project.
     *
     * 2. **Environment Variable check**: Inspects the "DISABLE_RNREPO" environment variable.
     *    The plugin execution will be enabled unless the environment variable "DISABLE_RNREPO" is set (regardless of value).
     *    If "DISABLE_RNREPO" is set to any value, the plugin execution will be disabled; if it's unset, the execution will proceed.
     *
     * @param project The Gradle project context providing access to configuration and execution parameters.
     * @return True if all conditions favor execution, otherwise false.
     */
    private fun shouldPluginExecute(project: Project): Boolean {
        val isBuildingCommand: Boolean = project.gradle.startParameter.taskNames.any {
            it.contains("assemble") || it.contains("build") || it.contains("install")
        }
        val isEnvEnabled: Boolean = System.getenv("DISABLE_RNREPO") == null
        logger.info("Building command: $isBuildingCommand, Env enabled: $isEnvEnabled")
        return isBuildingCommand && isEnvEnabled
    }

    /**
     * Retrieves the root directory of the React Native project.
     *
     * This function first checks for a custom property "REACT_NATIVE_ROOT_DIR" in the Gradle root project.
     * If the property is not set, it traverses up the directory hierarchy starting from the
     * root project directory to find the React Native root.
     * The React Native root is identified by the presence of the "node_modules/react-native" directory.
     * If the React Native root cannot be found, an exception is thrown.
     *
     * @param rootProject The Gradle root project context, usually named ':'.
     * @return The root directory of the React Native project as a [File] object.
     */
    private fun getReactNativeRoot(project: Project): File {
        // User defined path via gradle property
        val reactNativeRootDirProperty = getProperty(project, "REACT_NATIVE_ROOT_DIR", "")
        if (reactNativeRootDirProperty != "") {
            val file = File(reactNativeRootDirProperty)
            if (file.exists() && file.isDirectory) {
                logger.lifecycle("Using REACT_NATIVE_ROOT_DIR from gradle property: $reactNativeRootDirProperty")
                return file
            } else {
                throw GradleException("[RNRepo] REACT_NATIVE_ROOT_DIR path from gradle property does not exist or is not a directory: $reactNativeRootDirProperty")
            }
        }
        // Auto-detect by traversing up the directory tree
        var currentDirName: File? = project.rootProject.rootDir
        while (currentDirName != null) {
            if (File(currentDirName, "node_modules${File.separator}react-native").exists()) {
                logger.lifecycle("Found React Native root directory at: ${currentDirName.absolutePath}")
                return currentDirName
            }
            currentDirName = currentDirName.parentFile
        }
        // We're in non standard setup, e.g. monorepo - try to use node resolver to locate the react-native package.
        val processBuilder = ProcessBuilder()
        val maybeRnPackagePath = processBuilder.apply {
            command("node", "--print", "require.resolve('react-native/package.json')")
            directory(project.rootProject.rootDir)
        }.start().inputStream.bufferedReader().readText().trim()
        if (maybeRnPackagePath.isNotEmpty() && File(maybeRnPackagePath).exists()) {
            logger.lifecycle("Found react-native package via node resolver at: $maybeRnPackagePath")
            return File(maybeRnPackagePath).parentFile.parentFile
        }
        throw GradleException("[RNRepo] Could not find React Native root directory from project root: ${project.rootProject.rootDir.absolutePath}. Please set 'REACT_NATIVE_ROOT_DIR' in gradle.properties.")
    }

    /**
     * Loads the deny list from the configuration file located in the React Native root directory.
     *
     * @param extension The PackagesManager instance where the deny list will be stored.
     */
    private fun loadDenyList(extension: PackagesManager) {
        val configFile = File(REACT_NATIVE_ROOT_DIR, CONFIG_FILE_NAME)
        if (!configFile.exists()) {
            logger.info("Config file $CONFIG_FILE_NAME not found in React Native root: ${REACT_NATIVE_ROOT_DIR?.absolutePath}. Using empty deny list.")
            return
        }
        try {
            @Suppress("UNCHECKED_CAST")
            val json = JsonSlurper().parse(configFile) as Map<String, Any>
            @Suppress("UNCHECKED_CAST")
            val denyList = json["denyList"] as? List<String>
            if (denyList != null) {
                logger.lifecycle("Loaded deny list from config: $denyList")
                extension.denyList = denyList.toSet()
            } else {
                logger.info("No denyList found in config file. Using empty deny list.")
            }
        } catch (e: Exception) {
            logger.error("Error parsing $CONFIG_FILE_NAME: ${e.message}. Using empty deny list.")
        }
    }

    /**
     * Checks if a specific package is not in the deny list.
     *
     * @param packageName The name of the package to check.
     * @param extension The PackagesManager instance containing the deny list.
     *
     * @return True if the package is not denied, false otherwise.
     */
    private fun isPackageNotDenied(
        packageName: String,
        extension: PackagesManager
    ): Boolean {
        if (extension.denyList.contains(packageName)) {
            logger.info("Package $packageName is in deny list, skipping in RNRepo.")
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
        packageItem: PackageItem,
        RNVersion: String,
        repositories: RepositoryHandler
    ): Boolean {
        val artifactDir = Paths.get(System.getProperty("user.home"), ".gradle", "caches", "modules-2", "files-2.1", "org.rnrepo.public", "${packageItem.name}", "${packageItem.version}").toFile()
        if (artifactDir.exists() && artifactDir.isDirectory) {
            val artifactName = "${packageItem.name}-${packageItem.version}-rn${RNVersion}${packageItem.classifier}.aar"
            // search for artifactName in all directories inside artifactDir
            val isArtifactCached = artifactDir.listFiles()?.any { hashDir ->
                hashDir.isDirectory && File(hashDir, artifactName).exists()
            } ?: false
            if (isArtifactCached) {
                logger.info("Package ${packageItem.name} version ${packageItem.version} is cached in Gradle cache.")
                return true
            }
        }

        // for each repository check if package exists by sending HEAD request
        repositories.forEach { repoUnchecked ->
            val repo = repoUnchecked as? MavenArtifactRepository ?: return@forEach
            if (repo.url.scheme != "http" && repo.url.scheme != "https") return@forEach
            val urlString = "${repo.url}/org/rnrepo/public/${packageItem.name}/${packageItem.version}/${packageItem.name}-${packageItem.version}-rn${RNVersion}${packageItem.classifier}.aar"
            var connection: HttpURLConnection? = null
            try {
                connection = URL(urlString).openConnection() as HttpURLConnection
                connection.requestMethod = "HEAD"
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                logger.info("Checking availability of package ${packageItem.name} version ${packageItem.version} at $urlString")
                if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                    return true
                }
            } catch (e: Exception) {
                logger.error("Error checking package availability for ${packageItem.name} version ${packageItem.version}: ${e.message}")
            } finally {
                connection?.disconnect()
            }
        }
        return false
    }

    private fun getPackageNameAndVersion(packageJson: File): PackageItem? {
        if (!packageJson.exists()) {
            logger.info("package.json not found at ${packageJson.absolutePath}, skipping.")
            return null
        }
        runCatching {
            @Suppress("UNCHECKED_CAST")
            val json = JsonSlurper().parse(packageJson) as Map<String, Any>
            val packageName = json["name"] as? String
            val packageVersion = json["version"] as? String
            if (packageName != null && packageVersion != null) {
                val gradlePackageName = packageName.replace("@", "").replace("/", "_")
                logger.info("Found package: $packageName version $packageVersion")
                return PackageItem(gradlePackageName, packageVersion)
            }
        }.onFailure { e ->
            logger.error("Error parsing package.json in ${packageJson.absolutePath}: ${e.message}")
        }
        return null
    }

    private fun getProjectPackages(allprojects: Set<Project>, extension: PackagesManager) {
        extension.projectPackages = allprojects
            .map { it.projectDir }
            .filter { it.absolutePath.contains("node_modules") }
            .map { File(it.parentFile, "package.json") }
            .filter { it.exists() }
            .mapNotNull { getPackageNameAndVersion(it) }
            .toSet()
    }

    private fun getReactNativeVersion(extension: PackagesManager): Boolean {
        // find react-native package.json
        val reactNativePackageJsonFile = Paths.get(REACT_NATIVE_ROOT_DIR?.absolutePath, "node_modules", "react-native", "package.json").toFile()
        if (!reactNativePackageJsonFile.exists()) {
            logger.error("react-native package.json not found in ${reactNativePackageJsonFile.absolutePath}. Try setting 'REACT_NATIVE_ROOT_DIR' in gradle.properties.")
            return false
        }
        // parse version
        val reactNativeVersionInfo = getPackageNameAndVersion(reactNativePackageJsonFile)
        return reactNativeVersionInfo?.let {
            extension.reactNativeVersion = it.version
            logger.lifecycle("Detected React Native version: ${extension.reactNativeVersion}")
            true
        } ?: run {
            logger.error("Failed to parse version from react-native package.json.")
            false
        }
    }

    private fun isSpecificCheckPassed(
        packageItem: PackageItem,
        extension: PackagesManager
    ): Boolean {
        when (packageItem.name) {
            "react-native-gesture-handler" -> {
                // Todo(rolkrado): remove svg when patch will be merged
                val dependencyPackages = listOf("react-native-reanimated", "react-native-svg")
                dependencyPackages.forEach { depName ->
                    val depItem = extension.projectPackages.find { it.name == depName }
                    if (depItem == null) {
                        logger.info("react-native-gesture-handler: Not found $depName in project, using react-native-gesture-handler from sources.")
                        return false
                    }
                }
            }
            "react-native-reanimated" -> {
                val workletsItem = extension.projectPackages.find { it.name == "react-native-worklets" }
                if (workletsItem != null) {
                    logger.info("react-native-reanimated: Found react-native-worklets@${workletsItem.version} in project, adding to classifier.")
                    packageItem.classifier += "-worklets${workletsItem.version}"
                } else {
                    logger.info("react-native-reanimated: react-native-worklets not found in project, using react-native-reanimated from sources.")
                    return false
                }
            }
        }
        return true
    }

    private fun setupSupportedPackages(project: Project, extension: PackagesManager) {
        extension.supportedPackages = extension.projectPackages.filter { packageItem ->
            isPackageNotDenied(packageItem.name, extension) &&
            isSpecificCheckPassed(packageItem, extension) &&
            isPackageAvailable(
                packageItem,
                extension.reactNativeVersion,
                project.repositories
            )
        }.toSet()
        logger.lifecycle("Found the following supported prebuilt packages: ${extension.supportedPackages.joinToString("") { "\n  - 📦 ${it.name}@${it.version}${it.classifier}" }}")
    }
}

