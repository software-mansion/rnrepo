package com.example.mytestplugin

import groovy.json.JsonSlurper
import org.gradle.api.Plugin
import org.gradle.api.Project
import java.io.File

class PreventRNLinkPlugin implements Plugin<Project> {
    void apply(Project project) {
        project.plugins.withId('com.android.application') {
            project.afterEvaluate {
                handleAutoLinking(project)
            }
        }
    }

    void handleAutoLinking(Project project) {
        File inputFile = project.rootProject.layout.buildDirectory
                                .file("generated/autolinking/autolinking.json")
                                .get().asFile
        
        Map dependencyInfo = getGradleDependenciesToApply(inputFile)
        List<Map.Entry<String, String>> dependenciesToApply = dependencyInfo.dependenciesToApply
        List<String> dependenciesToRemove = dependencyInfo.dependenciesToRemove

        // Exclude dependencies
        project.configurations.all { config ->
            dependenciesToRemove.each { depName ->
                config.exclude module: depName.replaceAll(":", "")
            }
        }
    
        
        // Add only maven dependencies
        dependenciesToApply.each { Map.Entry<String, String> dependencyEntry ->
            String configuration = dependencyEntry.key
            String path = dependencyEntry.value
            project.dependencies.add(configuration, dependencyEntry.value)
        }
    }

    Map getGradleDependenciesToApply(File inputFile) {
        def model = new JsonSlurper().parse(inputFile)
        def result = []
        def dependenciesToRemove = []
        
        model.dependencies.each { depName, depDetails ->
            if (depDetails.platforms?.android) {
                String dependencyConfiguration = depDetails.platforms.android.dependencyConfiguration ?: 'implementation'
                String mavenDependency = depDetails.platforms.android.mavenDependency
                if (mavenDependency) {
                    result << new AbstractMap.SimpleEntry(dependencyConfiguration, mavenDependency)
                    dependenciesToRemove << depName
                }
            }
        }
        return [dependenciesToApply: result, dependenciesToRemove: dependenciesToRemove]
    }
}