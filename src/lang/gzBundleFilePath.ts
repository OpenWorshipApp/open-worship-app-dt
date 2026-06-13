import type { AppProviderType } from '../server/appProvider';

type GzBundleType = { filePath: string; fileName: string | null };

// Read the injected provider directly (the same source `appProvider.ts` wraps)
// via a type-only import, so importing this module has no runtime side effects
// and keeps the pure lang-data modules safe to load in node-env unit tests.
function getInjectedProvider(): AppProviderType {
    return (globalThis as any).provider as AppProviderType;
}

let cachedDistDirPath: string | null = null;
function getDistDirPath(provider: AppProviderType) {
    if (cachedDistDirPath === null) {
        const appPath = provider.messageUtils.sendDataSync(
            'main:app:get-app-path',
        ) as string;
        cachedDistDirPath = provider.pathUtils.join(appPath, 'dist');
    }
    return cachedDistDirPath;
}

/**
 * Resolve a `*.gz.bundle` import to a real filesystem path Node's `fs` can open.
 *
 * - dev/tests: `fileName` is `null`, so the original source `filePath` is used.
 * - production build: the bundle was emitted into `dist`, so it is resolved
 *   against the packaged app's `dist` directory.
 */
export function resolveGzBundleFilePath(bundle: GzBundleType): string {
    if (bundle.fileName === null) {
        return bundle.filePath;
    }
    const provider = getInjectedProvider();
    return provider.pathUtils.join(getDistDirPath(provider), bundle.fileName);
}
