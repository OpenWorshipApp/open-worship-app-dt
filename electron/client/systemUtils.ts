import { clipboard } from 'electron';
import { createHash } from 'crypto';

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

const systemUtils = {
    copyToClipboard(str: string) {
        clipboard.writeText(str);
    },
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
