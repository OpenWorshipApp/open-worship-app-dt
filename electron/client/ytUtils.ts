import { isWindows, toUnpackedPath, unlocking } from '../electronHelpers';
import { resolve } from 'node:path';

let timeOutId: NodeJS.Timeout | null = null;
let ytDlpWrap: any = null;
const binHelperPath = resolve(__dirname, '../../bin-helper/');
function scheduleRelease() {
    if (timeOutId !== null) {
        clearTimeout(timeOutId);
    }
    timeOutId = setTimeout(() => {
        if (timeOutId === null) {
            return;
        }
        timeOutId = null;
        ytDlpWrap = null;
    }, 10e3); // 10 seconds timeout
}
async function getYTHelper() {
    return unlocking('getYTHelper', async () => {
        scheduleRelease();
        if (ytDlpWrap !== null) {
            return ytDlpWrap;
        }
        const YTDlpWrap = require('yt-dlp-wrap').default;
        const binaryPath = toUnpackedPath(
            resolve(
                __dirname,
                binHelperPath,
                'yt/yt-dlp' + (isWindows ? '.exe' : ''),
            ),
        );
        ytDlpWrap = new YTDlpWrap(binaryPath);
        return ytDlpWrap;
    });
}
const ffmpegBinPath = toUnpackedPath(
    resolve(__dirname, binHelperPath, 'ffmpeg/bin'),
);
const denoBinPath = toUnpackedPath(
    resolve(__dirname, binHelperPath, 'deno/deno' + (isWindows ? '.exe' : '')),
);

export const ytUtils = {
    getYTHelper,
    ffmpegBinPath,
    denoBinPath,
    jsRuntimeBinPath: null,
};
