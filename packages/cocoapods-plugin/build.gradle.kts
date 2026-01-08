repositories {
    mavenCentral()
    google()
    //maven { url = uri("https://packages.rnrepo.org/releases/") }
    maven { url = uri("https://repo.swmtest.xyz/releases/") }
}

configurations.create("zipDownload") {
    isCanBeConsumed = false
    isCanBeResolved = true
}

fun getArgument(property: String): String =
    System.getProperty(property) 
        ?: project.findProperty(property) as? String
        ?: throw GradleException("Argument '$property' not provided. Use: gradle downloadArtifact -Dpackage='<pkg>' -Dversion='<version>' -DrnVersion='<rn-version>' -Dconfiguration='<release|debug>'")

// Task that accepts string arguments and downloads zip from Maven
// Run: gradle downloadArtifact -Dpackage='<pkg>' -Dversion='<version>' -DrnVersion='<rn-version>' -Dconfiguration='<release|debug>'
tasks.register("downloadArtifact") {
    val packageName = getArgument("package")
    val version = getArgument("version")
    val rnVersion = getArgument("rnVersion")
    val configuration = getArgument("configuration")
    val fullNotation = "org.rnrepo.public:$packageName:$version:rn$rnVersion-$configuration"
    
    logger.info("[📦 RNRepo] Downloading $packageName version $version with RN version $rnVersion")
    dependencies {
        add("zipDownload", "$fullNotation@xcframework.zip")
    }
    
    val resolvedFiles = configurations["zipDownload"].resolve()
    if (resolvedFiles.isEmpty()) {
        throw GradleException("No artifacts found for dependency: $fullNotation")
    }
    
    resolvedFiles.forEach { file ->
        logger.info("[📦 RNRepo] $fullNotation downloaded to: ${file.absolutePath}")
    }
}
