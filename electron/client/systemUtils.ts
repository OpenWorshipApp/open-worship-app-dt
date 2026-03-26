import { clipboard } from 'electron';
import { createHash } from 'node:crypto';
import { exec } from 'node:child_process';

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
} from '../electronHelpers';

function generateMD5(input: string): string {
    return createHash('md5').update(input).digest('hex');
}

function openFile(filePath: string) {
    let command;
    if (process.platform === 'win32') {
        command = `start "" "${filePath}"`;
    } else if (process.platform === 'darwin') {
        command = `open "${filePath}"`;
    } else {
        command = `xdg-open "${filePath}"`;
    }
    exec(command, (err) => {
        if (err) {
            console.error(`Error opening file: ${err}`);
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
    is64System,
    isArm64,
    generateMD5,
};

export default systemUtils;
