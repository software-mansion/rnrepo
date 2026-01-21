allprojects {
    val defaultRnrepoUrl = System.getProperty("url") ?: "https://packages.rnrepo.org/releases"

    repositories {
        mavenCentral()
        google()
        maven { url = uri(defaultRnrepoUrl) }
    }

    configurations.create("zipDownload") {
        isCanBeConsumed = false
        isCanBeResolved = true
    }

    fun getArgument(property: String): String =
        System.getProperty(property) 
            ?: project.findProperty(property) as? String
            ?: throw GradleException("Argument '$property' not provided. Use: gradle downloadArtifact -Dpackage='<pkg>' -Dversion='<version>' -DrnVersion='<rn-version>' -Dconfiguration='<release|debug>'")
    
    fun checkLibOnMaven(packageName: String, version: String, fullNotation: String): Boolean {
        // Construct the artifact URL: https://repo.url/releases/org/rnrepo/public/{package}/{version}/{artifact}-{version}-{suffix}.xcframework.zip
        // https://repo.swmtest.xyz/releases/org/rnrepo/public/react-native-svg/15.14.0/react-native-svg-15.14.0-rn0.81.4-debug.xcframework.zip
        val classifier = fullNotation.substringAfterLast(":")
        val artifactUrl = "$defaultRnrepoUrl/org/rnrepo/public/$packageName/$version/$packageName-$version-$classifier.xcframework.zip"
        
        return try {
            val connection = java.net.URL(artifactUrl).openConnection() as java.net.HttpURLConnection
            connection.requestMethod = "HEAD"
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            
            val responseCode = connection.responseCode
            logger.info("[📦 RNRepo] HEAD request to $artifactUrl - Response: $responseCode")
            
            connection.disconnect()
            responseCode in 200..299
        } catch (e: Exception) {
            logger.warn("[📦 RNRepo] Failed to check artifact availability at $artifactUrl: ${e.message}")
            false
        }
    }

    // Task that accepts string arguments and downloads zip from Maven
    // Run: gradle downloadArtifact -Dpackage='<pkg>' -Dversion='<version>' -DrnVersion='<rn-version>' -Dconfiguration='<release|debug>' [-DworkletsVersion='<version>'] [-Durl='<rnrepo-url>']
    tasks.register("downloadArtifact") {
        doLast {
            val packageName = getArgument("package")
            val version = getArgument("version")
            val rnVersion = getArgument("rnVersion")
            val configuration = getArgument("configuration")
            val workletsVersion = System.getProperty("workletsVersion") ?: project.findProperty("workletsVersion") as? String
            
            val workletsSuffix = if (!workletsVersion.isNullOrEmpty()) "-worklets$workletsVersion" else ""
            val fullNotation = "org.rnrepo.public:$packageName:$version:rn$rnVersion$workletsSuffix-$configuration"
            
            if (!checkLibOnMaven(packageName, version, fullNotation)) {
                logger.warn("[📦 RNRepo] Artifact $fullNotation not found on Maven repository.")
                return@doLast
            }

            logger.info("[📦 RNRepo] Downloading $packageName version $version with RN version $rnVersion")
            dependencies {
                add("zipDownload", "$fullNotation.xcframework@zip")
            }
            
            val resolvedFiles = configurations["zipDownload"].resolve()
            if (resolvedFiles.isEmpty()) {
                throw GradleException("No artifacts found for dependency: $fullNotation")
            }
            
            resolvedFiles.forEach { file ->
                logger.info("[📦 RNRepo] $fullNotation downloaded to: ${file.absolutePath}")
                // Output the file path for external scripts to consume
                println("DOWNLOADED_FILE:${file.absolutePath}")
            }
        }
    }
}
