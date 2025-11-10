/**
 * Post Install Script Interface used by build-library-android.ts
 * Each library-specific post-install script should implement this interface.
 */
export interface PostInstallScript {
    (
        appDir: string,
        workDir: string,
        libraryName: string,
        libraryVersion: string,
        reactNativeVersion: string
    ): void;
}
