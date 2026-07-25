import ProgressBarEventListener from '../event/ProgressBarEventListener';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

export function showProgressBar(progressKey: string) {
    ProgressBarEventListener.showProgressBar(progressKey);
}

export function hideProgressBar(progressKey: string) {
    ProgressBarEventListener.hideProgressBar(progressKey);
}

function applyProgressBarMessage(message: string) {
    for (const element of document.querySelectorAll(
        '.progress-bar-content-text',
    )) {
        if (element instanceof HTMLElement) {
            element.textContent = message;
        }
    }
}

const attemptTimeout = genTimeoutAttempt(3000);
export function showProgressBarMessage(...args: any[]) {
    const message = args.join(' ').trim();
    applyProgressBarMessage(message);
    // Clear the message after a while; the timeout callback must not call
    // showProgressBarMessage again or it would reschedule itself forever.
    attemptTimeout(() => {
        applyProgressBarMessage('');
    });
}
