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
        
        // Configure after evaluation to ensure extension is populated
        project.afterEvaluate {
            configureAndroidBuild(project, extension)
        }
    }
    
    private fun configureAndroidBuild(project: Project, extension: BuildleExtension) {
        // Configure each subproject that matches our criteria
        project.subprojects.forEach { subproject ->
            if (subproject.name == "app") {
                // Wait for the android plugin to be applied before configuring
                subproject.pluginManager.withPlugin("com.android.application") {
                    configureAppProject(subproject, extension)
                }
            }
        }
    }
    
    private fun configureAppProject(subproject: Project, extension: BuildleExtension) {
        // Add BuildConfig field
        val android = subproject.extensions.getByName("android")
        try {
            // Use reflection to safely call buildConfigField
            val buildTypes = android.javaClass.getMethod("getBuildTypes").invoke(android)
            val debugBuildType = buildTypes.javaClass.getMethod("getByName", String::class.java).invoke(buildTypes, "debug")
            val buildConfigFieldMethod = debugBuildType.javaClass.getMethod("buildConfigField", String::class.java, String::class.java, String::class.java)
            buildConfigFieldMethod.invoke(debugBuildType, "boolean", "USE_PREBUILT_AARS", "true")
            
            val releaseBuildType = buildTypes.javaClass.getMethod("getByName", String::class.java).invoke(buildTypes, "release")
            buildConfigFieldMethod.invoke(releaseBuildType, "boolean", "USE_PREBUILT_AARS", "true")
        } catch (e: Exception) {
            subproject.logger.warn("Could not add BUILD_CONFIG field: ${e.message}")
        }
        
        // Add repositories and dependencies
        subproject.repositories.apply {
            flatDir { flatDir ->
                flatDir.dirs(extension.aarsDir)
                flatDir.name = "flatDir"
            }
            flatDir { flatDir ->
                flatDir.dirs("libs") 
                flatDir.name = "flatDir2"
            }
        }
        
        // Add AAR dependencies
        val dependencies = subproject.dependencies
        extension.packages.forEach { packageName ->
            val gradleProjectName = convertToGradleProjectName(packageName)
            val aarFile = File(subproject.rootDir, "${extension.aarsDir}/${gradleProjectName}.aar")
            
            if (aarFile.exists()) {
                dependencies.add("implementation", aarFile.nameWithoutExtension)
                subproject.logger.info("Added AAR dependency: ${aarFile.nameWithoutExtension}")
            }
        }
    }
    
    private fun setupAarAutomation(project: Project, extension: BuildleExtension) {
        println("Setting up AAR automation...")
        
        // Generate react-native.config.js
        generateReactNativeConfig(project, extension)
        
        // Update MainApplication with package registration
        updateMainApplication(project, extension)
        
        println("AAR automation setup completed!")
    }
    
    private fun generateReactNativeConfig(project: Project, extension: BuildleExtension) {
        // If we're running from the android directory, go up one level to find the React Native root
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
            appendLine("// Auto-generated config to disable autolinking for AAR packages")
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
        // Find MainApplication.kt file
        val mainApplicationFile = findMainApplicationFile(project)
        
        if (mainApplicationFile == null) {
            println("MainApplication.kt not found - skipping package registration")
            return
        }
        
        val originalContent = mainApplicationFile.readText()
        var modifiedContent = originalContent
        
        // Remove any existing AAR automation block
        modifiedContent = removeExistingAarBlock(modifiedContent)
        
        // Add new AAR automation block if we have packages
        if (extension.packages.isNotEmpty()) {
            val packageRegistrations = generatePackageRegistrations(project, extension)
            val aarBlock = """
        // AAR automation - auto-generated package registration
        if (BuildConfig.USE_PREBUILT_AARS) {
          try {
$packageRegistrations
          } catch (e: Exception) {
            android.util.Log.e("MainApplication", "Failed to load pre-built AAR packages: ${'$'}{e.message}")
          }
        }
"""
            
            // Insert inside the apply block, before the closing brace
            val applyPattern = Regex("(PackageList\\(this\\)\\.packages\\.apply\\s*\\{[^}]*?)(\\s*\\})", RegexOption.DOT_MATCHES_ALL)
            if (applyPattern.containsMatchIn(modifiedContent)) {
                modifiedContent = applyPattern.replace(modifiedContent) { matchResult ->
                    val beforeClosing = matchResult.groupValues[1]
                    val closingBrace = matchResult.groupValues[2]
                    "$beforeClosing$aarBlock$closingBrace"
                }
            } else {
                println("Could not find PackageList(this).packages.apply pattern")
            }
        }
        
        if (modifiedContent != originalContent) {
            mainApplicationFile.writeText(modifiedContent)
            println("Updated MainApplication.kt with package registrations")
        }
    }
    
    private fun findMainApplicationFile(project: Project): File? {
        // If we're running from the android directory, go up one level to find the React Native root
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
        val blockPattern = Regex("\\s*// AAR automation.*?\\}\\s*\\}\\s*\\}", RegexOption.DOT_MATCHES_ALL)
        return blockPattern.replace(content, "")
    }
    
    private fun generatePackageRegistrations(project: Project, extension: BuildleExtension): String {
        // If we're running from the android directory, go up one level to find the React Native root
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
        
        // Search patterns for React Native package classes (Java and Kotlin)
        val patterns = listOf(
            ".*Package\\.java$",
            ".*ReactPackage\\.java$", 
            ".*NativePackage\\.java$",
            ".*Package\\.kt$",
            ".*ReactPackage\\.kt$",
            ".*NativePackage\\.kt$"
        )
        
        // Search in multiple source directories - include all src subdirectories
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
                            
                            // Extract class name - more flexible patterns for Java and Kotlin
                            val classPatterns = listOf(
                                // Java patterns - extends BaseReactPackage
                                Regex("public\\s+class\\s+(\\w+)\\s+extends\\s+BaseReactPackage"),
                                Regex("class\\s+(\\w+)\\s+extends\\s+BaseReactPackage"),
                                // Java patterns - implements ReactPackage
                                Regex("public\\s+class\\s+(\\w+)\\s+.*implements.*ReactPackage"),
                                Regex("public\\s+class\\s+(\\w+)\\s+.*ReactPackage"),
                                Regex("class\\s+(\\w+)\\s+.*implements.*ReactPackage"),
                                Regex("class\\s+(\\w+)\\s+.*ReactPackage"),
                                // Kotlin patterns  
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
                        // Continue searching if file cannot be read
                    }
                }
            }
        }
        
        println("Could not detect ReactPackage class for $packageName")
        return null
    }
    
    private fun convertToGradleProjectName(packageName: String): String {
        // Convert npm package name to Gradle project name following React Native's pattern
        // @react-native-community/slider -> react-native-community_slider
        return packageName
            .removePrefix("@")        // Remove leading @
            .replace("/", "_")        // Replace / with _
    }
}