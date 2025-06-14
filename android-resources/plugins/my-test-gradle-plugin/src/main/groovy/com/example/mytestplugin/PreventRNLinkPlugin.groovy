package com.example.mytestplugin

import org.gradle.api.Plugin
import org.gradle.api.Project
// import org.gradle.api.initialization.Settings

class PreventRNLinkPlugin implements Plugin<Project> {
    // void apply(Settings settings) {
    //     println "✅ PreventRNLinkPlugin is ok..."
        
    //     File settingsFile = settings.settingsDir.toPath().resolve("settings.gradle").toFile()
    //     if (!settingsFile.exists()) {
    //         println "⚠️ settings.gradle not found."
    //         return
    //     }

    //     def content = settingsFile.text
    //     List<String> librariesToExclude = ['react-native-svg']

    //     librariesToExclude.each { lib ->
    //         // Escape characters and match includeBuild calls
    //         String pattern = /includeBuild\(['"]\.\.\/node_modules\/${lib}['"]\)/
    //         content = content.replaceFirst(pattern, "// Excluded by plugin: ${lib}")
    //     }

    //     settingsFile.text = content
    // }
    void apply(Project project) {
        println "✅ PreventRNLinkPlugin is ok..."
        // Logic to exclude the library
        project.afterEvaluate {
            println "🟡 Running..."
            it.configurations.all { config ->
                println "Config: " + config
                config.exclude group: 'com.horcrux.svg', module: 'react-native-svg'
            
                println "🔍 Inspecting configuration: ${config.name}"
                config.dependencies.forEach {
                    println "  📦 Dependency: ${it.group}:${it.name}:${it.version}"
                }
            
            }
        }
    }
}