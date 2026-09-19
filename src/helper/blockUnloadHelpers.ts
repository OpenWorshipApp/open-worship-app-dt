import { genTimeoutAttempt } from './timeoutHelpers';

// Electron shows no native beforeunload dialog, so the app's convention is to
// block the unload with a warning toast and let the user force-leave by
// attempting more than FORCE_LEAVE_ATTEMPT_COUNT times before the counter
// resets.
const FORCE_LEAVE_ATTEMPT_COUNT = 3;
const ATTEMPT_RESET_MILLISECONDS = 3000;

export function genBlockUnload(
    showWarning: () => void,
    checkShouldBlock?: () => boolean,
) {
    const attemptTimeout = genTimeoutAttempt(ATTEMPT_RESET_MILLISECONDS);
    let attemptCount = 0;
    return function blockUnload(event: BeforeUnloadEvent) {
        if (checkShouldBlock !== undefined && !checkShouldBlock()) {
            window.removeEventListener('beforeunload', blockUnload);
            return;
        }
        attemptTimeout(() => {
            attemptCount = 0;
        });
        attemptCount++;
        if (attemptCount > FORCE_LEAVE_ATTEMPT_COUNT) {
            window.removeEventListener('beforeunload', blockUnload);
            return;
        }
        event.preventDefault();
        showWarning();
    };
}
