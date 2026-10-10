import { powerSaveBlocker } from 'electron';

/**
 * A display that sleeps, or a machine that suspends, mid-service blanks the
 * screen in front of everyone. Each holder -- a showing screen window, a
 * screen presented through Screen Mirror, the main window while it is on the
 * Presenter or the Screen Mirror guest page (unless its stay-awake toggle is
 * off) -- gets its own switch and asks the OS to keep the display awake for
 * exactly as long as it needs. Electron folds every request into one, so the
 * OS may sleep again only once the last holder lets go.
 */
export function genKeepAwake() {
    let blockerId: number | null = null;
    return (isAwake: boolean) => {
        if (isAwake && blockerId === null) {
            blockerId = powerSaveBlocker.start('prevent-display-sleep');
        } else if (!isAwake && blockerId !== null) {
            powerSaveBlocker.stop(blockerId);
            blockerId = null;
        }
    };
}
