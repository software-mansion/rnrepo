package com.example.mytestplugin

import org.gradle.api.Plugin
import org.gradle.api.Project
import groovy.json.JsonSlurper
import groovy.json.JsonBuilder
import java.nio.file.Files
import java.nio.file.Paths

class PreventRNLinkPlugin implements Plugin<Project> {
    void apply(Project project) {
        project.tasks.register("removeReanimatedDependency") {
            doLast {
                def path = Paths.get(project.rootDir.path, "build/generated/autolinking/autolinking.json")
                def file = path.toFile()
 
                if (file.exists()) {
                    def jsonSlurper = new JsonSlurper()
                    def originalJson = jsonSlurper.parse(file) 
                    def json = originalJson.toMutableMap()
                    def originalDependencies = json["dependencies"]
                    originalDependencies?.let {
                        def dependencies = it.toMutableMap()
                        dependencies.remove("react-native-reanimated")
                        json["dependencies"] = dependencies
                        println("MODIFIED: " + json["dependencies"])
                        def modifiedJsonString = new JsonBuilder(json).toPrettyString()
                        Files.write(path, modifiedJsonString.bytes)
                        println("Modified JSON saved.")
                    }
                } else {
                    println("The specified JSON file does not exist: ${file.path}")
                }
            }
        }
    }
}