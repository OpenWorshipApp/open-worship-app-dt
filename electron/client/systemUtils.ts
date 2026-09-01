import { clipboard, shell } from 'electron';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

import {
    commitHash,
    isDev,
    isWindows,
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
    copyToClipboard(str: string) {
        clipboard.writeText(str);
    },
    openFile,
    commitHash,
    isDev,
    isWindows,
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
