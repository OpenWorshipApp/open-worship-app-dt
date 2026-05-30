import { webUtils } from 'electron';
import fs from 'node:fs';

function getAppFilePath(file: File) {
    return webUtils.getPathForFile(file);
}

function injectAppFilePath(file: File) {
    const appFilePath = getAppFilePath(file);
    if (!appFilePath) {
        return;
    }
    try {
        Object.defineProperty(file, 'appFilePath', {
            configurable: true,
            value: appFilePath,
        });
    } catch {
        // File objects can be non-extensible in some browser contexts.
    }
}

function injectAppFilePaths(files: FileList | null | undefined) {
    if (files === null || files === undefined) {
        return;
    }
    for (const file of files) {
        injectAppFilePath(file);
    }
}

function injectDroppedFilePaths(event: DragEvent) {
    injectAppFilePaths(event.dataTransfer?.files);
}

function injectInsertedFilePaths(event: Event) {
    if (event.target instanceof HTMLInputElement === false) {
        return;
    }
    injectAppFilePaths(event.target.files);
}

function installAppFilePathGetter() {
    if (typeof File === 'undefined') {
        return false;
    }
    if (
        Object.getOwnPropertyDescriptor(File.prototype, 'appFilePath') !==
        undefined
    ) {
        return true;
    }
    Object.defineProperty(File.prototype, 'appFilePath', {
        configurable: true,
        get() {
            return getAppFilePath(this);
        },
    });
    return true;
}

let isAppFilePathSupportInstalled = false;
function installAppFilePathSupport() {
    if (isAppFilePathSupportInstalled) {
        return true;
    }
    if (installAppFilePathGetter() === false) {
        return false;
    }
    globalThis.document?.addEventListener(
        'drop',
        injectDroppedFilePaths,
        true,
    );
    globalThis.document?.addEventListener(
        'change',
        injectInsertedFilePaths,
        true,
    );
    isAppFilePathSupportInstalled = true;
    return true;
}

if (installAppFilePathSupport() === false) {
    globalThis.addEventListener?.(
        'DOMContentLoaded',
        installAppFilePathSupport,
        { once: true },
    );
}

const fileUtils = {
    createWriteStream: fs.createWriteStream,
    createReadStream: fs.createReadStream,
    readdir: fs.readdir,
    stat: fs.stat,
    mkdir: fs.mkdir,
    writeFile: fs.writeFile,
    rename: fs.rename,
    unlink: fs.unlink,
    rmdir: fs.rmdir,
    readFile: fs.readFile,
    readFileSync: fs.readFileSync,
    writeFileSync: fs.writeFileSync,
    unlinkSync: fs.unlinkSync,
    existsSync: fs.existsSync,
    mkdirSync: fs.mkdirSync,
    copyFile: fs.copyFile,
    watch: fs.watch,
    writeFileFromBase64Sync: (filePath: string, base64: string) => {
        if (base64.includes(',')) {
            base64 = base64.split(',')[1];
        }
        const decoded = Buffer.from(base64, 'base64');
        return fs.writeFileSync(filePath, decoded);
    },
};

export default fileUtils;
