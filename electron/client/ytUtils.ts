import { unlocking } from '../electronHelpers';

let timeOutId: NodeJS.Timeout | null = null;
let cached: { binaryPath: string; ytDlpWrap: any } | null = null;
function scheduleRelease() {
    if (timeOutId !== null) {
        clearTimeout(timeOutId);
    }
    timeOutId = setTimeout(() => {
        if (timeOutId === null) {
            return;
        }
        timeOutId = null;
        cached = null;
    }, 10e3); // 10 seconds timeout
}
/**
 * The binary path comes from the CALLER: yt-dlp, its ffmpeg and the QuickJS
 * runtime are no longer bundled, they are installed on demand into the user's
 * data directory (`src/helper/extra-bin/`), which this preload module cannot
 * resolve — it has no access to the renderer's storage helpers.
 *
 * That also means the 10-second cache has to be keyed on the path: a user who
 * reinstalls or relocates the pack between two downloads must not be served a
 * helper still pointing at the old one.
 */
async function getYTHelper(ytDlpBinPath: string) {
    return unlocking('getYTHelper', async () => {
        scheduleRelease();
        if (cached !== null && cached.binaryPath === ytDlpBinPath) {
            return cached.ytDlpWrap;
        }
        const YTDlpWrap = require('yt-dlp-wrap').default;
        const ytDlpWrap = new YTDlpWrap(ytDlpBinPath);
        cached = { binaryPath: ytDlpBinPath, ytDlpWrap };
        return ytDlpWrap;
    });
}

export const ytUtils = {
    getYTHelper,
};
