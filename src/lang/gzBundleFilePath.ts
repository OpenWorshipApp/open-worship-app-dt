import appProvider from '../server/appProvider';

// Deliberately does NOT import `../server/fileHelpers`: that module evaluates
// `appProvider.pathUtils.sep` and calls `freezeObject` at load time, and this
// file sits in `langHelpers`' import graph, which nearly every screen module
// reaches. Joining through `appProvider.pathUtils` directly keeps the graph
// side-effect free until a bundle path is actually asked for.
let cachedDistDirPath: string | null = null;
function getDistDirPath() {
    if (cachedDistDirPath === null) {
        const appPath = appProvider.messageUtils.sendDataSync(
            'main:app:get-app-path',
        ) as string;
        cachedDistDirPath = appProvider.pathUtils.join(appPath, 'dist');
    }
    return cachedDistDirPath;
}

export function resolveGzBundleFilePath(bundle: {
    filePath: string;
    fileName: string | null;
}): string {
    if (bundle.fileName === null) {
        return bundle.filePath;
    }
    return appProvider.pathUtils.join(getDistDirPath(), bundle.fileName);
}
