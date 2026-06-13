import appProvider from '../server/appProvider';
import { pathJoin } from '../server/fileHelpers';

let cachedDistDirPath: string | null = null;
function getDistDirPath() {
    if (cachedDistDirPath === null) {
        const appPath = appProvider.messageUtils.sendDataSync(
            'main:app:get-app-path',
        ) as string;
        cachedDistDirPath = pathJoin(appPath, 'dist');
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
    return pathJoin(getDistDirPath(), bundle.fileName);
}
