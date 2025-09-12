package com.swmansion.buildle.buildleplugin

import org.gradle.api.*
import org.gradle.api.tasks.*
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths

open class BuildleExtension {
    var packages: List<String> = listOf()
    var aarsDir: String = "android/libs"
}

class AarAutomationPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create("buildle", BuildleExtension::class.java)
        
        project.tasks.register("setupAars") { task ->
            task.group = "aar"
            task.description = "Generate configuration files for AAR automation"
            
            task.doLast {
                setupAarAutomation(project, extension)
            }
        }
        
        project.afterEvaluate {
            configureAndroidBuild(project, extension)
        }
    }
    
    private fun configureAndroidBuild(project: Project, extension: BuildleExtension) {
        project.subprojects.forEach { subproject ->
            if (subproject.name == "app") {
                subproject.pluginManager.withPlugin("com.android.application") {
                    configureAppProject(subproject, extension)
                }
            }
        }
    }
    
    private fun configureAppProject(subproject: Project, extension: BuildleExtension) {
        val android = subproject.extensions.getByName("android")
        try {
            val defaultConfig = android.javaClass.getMethod("getDefaultConfig").invoke(android)
            val buildConfigFieldMethod = defaultConfig.javaClass.getMethod("buildConfigField", String::class.java, String::class.java, String::class.java)
            buildConfigFieldMethod.invoke(defaultConfig, "boolean", "USE_PREBUILT_AARS", "true")
            subproject.logger.info("Added USE_PREBUILT_AARS BuildConfig field")
        } catch (e: Exception) {
            subproject.logger.warn("Could not add BUILD_CONFIG field: ${e.message}")
        }
        
        subproject.repositories.apply {
            flatDir { flatDir ->
                flatDir.dirs("libs")
                flatDir.name = "appLibsDir"
            }
            val parentLibsPath = File(subproject.rootDir, extension.aarsDir).absolutePath
            flatDir { flatDir ->
                flatDir.dirs(parentLibsPath)
                flatDir.name = "parentLibsDir"
            }
        }
        
        val dependencies = subproject.dependencies
        extension.packages.forEach { packageName ->
            val gradleProjectName = convertToGradleProjectName(packageName)
            
            val appLibsAar = File(subproject.projectDir, "libs/${gradleProjectName}.aar")
            val parentLibsAar = File(subproject.rootDir, "${extension.aarsDir}/${gradleProjectName}.aar")
            
            val aarFile = when {
                appLibsAar.exists() -> appLibsAar
                parentLibsAar.exists() -> parentLibsAar
                else -> null
            }
            
            if (aarFile != null) {
                val relativePath = aarFile.relativeTo(subproject.projectDir).path
                dependencies.add("implementation", subproject.files(relativePath))
                subproject.logger.info("Added AAR dependency: $relativePath")
                
                addTransitiveDependencies(subproject, packageName, dependencies)
            } else {
                subproject.logger.warn("AAR file not found for package: $packageName")
            }
        }
    }
    
    private fun addTransitiveDependencies(subproject: Project, packageName: String, dependencies: org.gradle.api.artifacts.dsl.DependencyHandler) {
        try {
            val reactNativeRoot = if (subproject.rootDir.name == "android") {
                subproject.rootDir.parentFile
            } else {
                subproject.rootDir
            }
            
            val packageBuildGradle = File(reactNativeRoot, "node_modules/$packageName/android/build.gradle")
            if (!packageBuildGradle.exists()) {
                subproject.logger.warn("Could not find build.gradle for $packageName to extract dependencies")
                return
            }
            
            val buildGradleContent = packageBuildGradle.readText()
            
            val variables = mutableMapOf<String, String>()
            val variablePattern = Regex("def\\s+(\\w+)\\s*=\\s*['\"]([^'\"]+)['\"]")
            variablePattern.findAll(buildGradleContent).forEach { match ->
                variables[match.groupValues[1]] = match.groupValues[2]
            }
            
            val implementationPatterns = listOf(
                Regex("implementation\\s+['\"]([^'\"]+)['\"]"),
                Regex("implementation\\s*\\(['\"]([^'\"]+)['\"]\\)")
            )
            
            val addedDeps = mutableSetOf<String>()
            implementationPatterns.forEach { pattern ->
                pattern.findAll(buildGradleContent).forEach { match ->
                    var dependency = match.groupValues[1]
                    
                    val variableSubstitution = Regex("\\$\\{(\\w+)\\}")
                    dependency = variableSubstitution.replace(dependency) { variableMatch ->
                        variables[variableMatch.groupValues[1]] ?: variableMatch.value
                    }
                    
                    if (!dependency.contains("react-native") && 
                        !dependency.contains("facebook.react") &&
                        !dependency.startsWith(":") &&
                        !dependency.endsWith(":+") &&
                        addedDeps.add(dependency)) {
                        
                        dependencies.add("implementation", dependency)
                        subproject.logger.info("Added transitive dependency for $packageName: $dependency")
                    }
                }
            }
            
        } catch (e: Exception) {
            subproject.logger.warn("Failed to add transitive dependencies for $packageName: ${e.message}")
        }
    }
    
    private fun setupAarAutomation(project: Project, extension: BuildleExtension) {
        println("Setting up AAR automation...")
        
        generateReactNativeConfig(project, extension)
        updateMainApplication(project, extension)
        patchAutolinkingForNewArchitecture(project)
        
        println("AAR automation setup completed!")
    }
    
    private fun generateReactNativeConfig(project: Project, extension: BuildleExtension) {
        val reactNativeRoot = if (project.rootDir.name == "android") {
            project.rootDir.parentFile
        } else {
            project.rootDir
        }
        
        val configFile = File(reactNativeRoot, "react-native.config.js")
        
        if (extension.packages.isEmpty()) {
            if (configFile.exists()) {
                configFile.delete()
                println("Removed react-native.config.js (no packages configured)")
            }
            return
        }
        
        val configContent = buildString {
            appendLine("// Disable autolinking for AAR packages")
            appendLine("module.exports = {")
            appendLine("  dependencies: {")
            
            extension.packages.forEach { packageName ->
                appendLine("    \"$packageName\": {")
                appendLine("      \"platforms\": {")
                appendLine("      \"android\": null")
                appendLine("    }")
                appendLine("    }${if (packageName != extension.packages.last()) "," else ""}")
            }
            
            appendLine("  }")
            appendLine("};")
        }
        
        configFile.writeText(configContent)
        println("Generated react-native.config.js")
    }
    
    private fun updateMainApplication(project: Project, extension: BuildleExtension) {
        val mainApplicationFile = findMainApplicationFile(project)
        
        if (mainApplicationFile == null) {
            println("MainApplication.kt not found - skipping package registration")
            return
        }
        
        val originalContent = mainApplicationFile.readText()
        var modifiedContent = originalContent
        
        modifiedContent = removeExistingAarBlock(modifiedContent)
        
        if (extension.packages.isNotEmpty()) {
            val packageRegistrations = generatePackageRegistrations(project, extension)
            if (packageRegistrations.isNotEmpty()) {
                val aarBlock = """
                    
                    // AAR automation - auto-generated package registration
                    if (BuildConfig.USE_PREBUILT_AARS) {
                      try {
$packageRegistrations
                      } catch (e: Exception) {
                        android.util.Log.e("MainApplication", "Failed to load pre-built AAR packages: ${'$'}{e.message}")
                      }
                    }"""
                
                val applyPattern = Regex("(PackageList\\(this\\)\\.packages\\.apply\\s*\\{.*?// add\\(MyReactNativePackage\\(\\)\\).*?)(\\s*\\})", RegexOption.DOT_MATCHES_ALL)
                val applyMatch = applyPattern.find(modifiedContent)
                
                if (applyMatch != null) {
                    val beforeClosing = applyMatch.groupValues[1]
                    val closingBrace = applyMatch.groupValues[2]
                    modifiedContent = modifiedContent.replace(applyMatch.value, "$beforeClosing$aarBlock$closingBrace")
                } else {
                    println("Could not find PackageList(this).packages.apply pattern to insert AAR automation")
                }
            }
        }
        
        if (modifiedContent != originalContent) {
            mainApplicationFile.writeText(modifiedContent)
            println("Updated MainApplication.kt with package registrations")
        }
    }
    
    private fun findMainApplicationFile(project: Project): File? {
        val reactNativeRoot = if (project.rootDir.name == "android") {
            project.rootDir.parentFile
        } else {
            project.rootDir
        }
        
        val appDir = File(reactNativeRoot, "android/app/src/main")
        return appDir.walkTopDown()
            .filter { it.isFile && it.name == "MainApplication.kt" }
            .firstOrNull()
    }
    
    private fun removeExistingAarBlock(content: String): String {
        val blockPattern = Regex("\\s*// AAR automation - auto-generated package registration.*?\\}\\s*\\}", RegexOption.DOT_MATCHES_ALL)
        return blockPattern.replace(content, "")
    }
    
    private fun generatePackageRegistrations(project: Project, extension: BuildleExtension): String {
        val reactNativeRoot = if (project.rootDir.name == "android") {
            project.rootDir.parentFile
        } else {
            project.rootDir
        }
        
        val registrations = extension.packages.mapNotNull { packageName ->
            val packageClass = detectReactPackageClass(reactNativeRoot, packageName)
            packageClass?.let { className ->
                val varName = convertToGradleProjectName(packageName).replace("-", "").replace("_", "").replace("@", "").replace("/", "")
                """            val ${varName}Class = Class.forName("$className")
            add(${varName}Class.newInstance() as ReactPackage)"""
            }
        }.joinToString("\n")
        
        return registrations
    }
    
    private fun detectReactPackageClass(reactNativeRoot: File, packageName: String): String? {
        val packagePath = File(reactNativeRoot, "node_modules/$packageName/android")
        if (!packagePath.exists()) return null
        
        val patterns = listOf(
            ".*Package\\.java$",
            ".*ReactPackage\\.java$", 
            ".*NativePackage\\.java$",
            ".*Package\\.kt$",
            ".*ReactPackage\\.kt$",
            ".*NativePackage\\.kt$"
        )
        
        val sourceDirs = packagePath.listFiles()?.filter { it.isDirectory && it.name.startsWith("src") }?.flatMap { srcDir ->
            srcDir.walkTopDown().filter { it.isDirectory && it.name == "java" }.map { 
                it.relativeTo(packagePath).path 
            }
        } ?: listOf("src/main/java", "src/paper/java", "src/fabric/java")
        
        
        for (sourceDir in sourceDirs) {
            val srcPath = File(packagePath, sourceDir)
            if (!srcPath.exists()) continue
            
            srcPath.walkTopDown().forEach { file ->
                if (file.isFile && patterns.any { pattern -> 
                    file.name.matches(Regex(pattern))
                }) {
                    try {
                        val content = file.readText()
                        val packagePattern = Regex("package\\s+([a-zA-Z0-9_.]+)")
                        val packageMatch = packagePattern.find(content)
                        
                        if (packageMatch != null) {
                            val packageNameInFile = packageMatch.groupValues[1]
                            
                            val classPatterns = listOf(
                                Regex("public\\s+class\\s+(\\w+)\\s+extends\\s+BaseReactPackage"),
                                Regex("class\\s+(\\w+)\\s+extends\\s+BaseReactPackage"),
                                Regex("public\\s+class\\s+(\\w+)\\s+.*implements.*ReactPackage"),
                                Regex("public\\s+class\\s+(\\w+)\\s+.*ReactPackage"),
                                Regex("class\\s+(\\w+)\\s+.*implements.*ReactPackage"),
                                Regex("class\\s+(\\w+)\\s+.*ReactPackage"),
                                Regex("class\\s+(\\w+)\\s*:\\s*BaseReactPackage"),
                                Regex("class\\s+(\\w+)\\s*:\\s*ReactPackage"),
                                Regex("class\\s+(\\w+)\\s+.*:\\s*BaseReactPackage"),
                                Regex("class\\s+(\\w+)\\s+.*:\\s*ReactPackage")
                            )
                            
                            for (classPattern in classPatterns) {
                                val classMatch = classPattern.find(content)
                                if (classMatch != null) {
                                    val className = classMatch.groupValues[1]
                                    val fullClassName = "$packageNameInFile.$className"
                                    println("Detected ReactPackage: $fullClassName")
                                    return fullClassName
                                }
                            }
                        }
                    } catch (e: Exception) {
                    }
                }
            }
        }
        
        println("Could not detect ReactPackage class for $packageName")
        return null
    }
    
    private fun convertToGradleProjectName(packageName: String): String {
        return packageName
            .removePrefix("@")
            .replace("/", "_")
    }
    
    private fun patchAutolinkingForNewArchitecture(project: Project) {
        project.logger.info("AAR packages configured")
    }
}