/**
 * Type representing the builder scripts arguments.
 */
export type BuildArgs = {
    libraryName: string;
    libraryVersion: string;
    reactNativeVersion: string;
    workDir: string;
    workletsVersion?: string;
};

/**
 * Parses command-line arguments to extract build parameters.
 * @param processArgv - The process.argv array
 * @returns An object containing the parsed build arguments
 * @throws Error if required arguments are missing
 */
export function parseArgs(processArgv: string[]): BuildArgs {
    const scriptName = processArgv[1];
    const args = processArgv.slice(2);
    if (args.length < 4) {
        throw new Error(`Usage: bun run ${scriptName} <library-name> <library-version> <react-native-version> <work-dir> [<worklets-version>]`);
    }
    return {
        libraryName: args[0],
        libraryVersion: args[1],
        reactNativeVersion: args[2],
        workDir: args[3],
        workletsVersion: args[4],
    };
}

/**
 * Prints the build arguments in a formatted manner.
 * @param args - The build arguments
 * @param platform - The target platform ('android' or 'ios')
 */
export function printArgs(args: BuildArgs, platform: 'android' | 'ios'): void {
    console.log(`📦 Building ${platform} library:`);
    console.log(`   Library: ${args.libraryName}@${args.libraryVersion}`);
    console.log(`   React Native: ${args.reactNativeVersion}`);
    if (args.workletsVersion) {
        console.log(`   Worklets Version: ${args.workletsVersion}`);
    }
}
    
/**
 * Constructs the GitHub build URL from environment variables.
 * @param serverUrl - The GitHub server URL
 * @param repository - The GitHub repository name
 * @param runId - The GitHub Actions run ID
 * @returns The constructed GitHub build URL
 * @throws Error if any of the required environment variables are missing
 */
export function getGithubBuildUrl(serverUrl: string | undefined, repository: string | undefined, runId: string | undefined): string {
    if (!serverUrl || !repository || !runId) {
        console.warn('Warning: Missing GitHub environment variables for build URL construction: ', { serverUrl, repository, runId });
        return "EMPTY_GITHUB_BUILD_URL";
    }
    return `${serverUrl}/${repository}/actions/runs/${runId}`;
}
