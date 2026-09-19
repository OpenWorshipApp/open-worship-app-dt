import { ipcRenderer, shell } from 'electron';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

import {
    commitHash,
    isDev,
    isWindows,
    isWindowsStore,
    isMac,
    isLinux,
    is64System,
    isArm64,
    isUbuntu,
    isFedora,
    isGlassCapable,
} from '../electronHelpers';

function generateFileMD5(filePath: string) {
    return new Promise((resolve, reject) => {
        const hash = createHash('md5');
        const stream = createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
}

function generateMD5(input: string): string {
    return createHash('md5').update(input).digest('hex');
}

function openFile(filePath: string) {
    // `shell.openPath` takes the path as-is — no shell command string to
    // inject into via quotes/ampersands in file names — and is cross-platform.
    shell.openPath(filePath).then((errorMessage) => {
        if (errorMessage) {
            console.error(`Error opening file: ${errorMessage}`);
            return;
        }
        console.log('File opened with default application.');
    });
}

const systemUtils = {
    // Through MAIN, not `clipboard.writeText` here: Electron exposes the
    // clipboard module to the main process only (it is absent from both the
    // `Common` and `Renderer` export sets), so reaching it from this side
    // threw `Cannot read properties of undefined (reading 'writeText')` — an
    // uncaught error, which this app answers with "Reload is needed". `shell`
    // below is a `Common` export and stays where it is.
    copyToClipboard(str: string) {
        ipcRenderer.send('main:app:copy-to-clipboard', str);
    },
    openFile,
    commitHash,
    isDev,
    isWindows,
    isWindowsStore,
    isMac,
    isLinux,
    isUbuntu,
    isFedora,
    isGlassCapable,
    is64System,
    isArm64,
    generateFileMD5,
    generateMD5,
};

export default systemUtils;
