import ProgressBarEventListener from '../event/ProgressBarEventListener';
import { appLog } from '../helper/loggerHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

export function showProgressBar(progressKey: string) {
    ProgressBarEventListener.showProgressBar(progressKey);
}

export function hideProgressBar(progressKey: string) {
    ProgressBarEventListener.hideProgressBar(progressKey);
}

const attemptTimeout = genTimeoutAttempt(3000);
export function showProgressBarMessage(...args: any[]) {
    attemptTimeout(() => {
        showProgressBarMessage('');
    });
    const message = args.join(' ').trim();
    if (message) {
        appLog(message);
    }
    for (const element of document.querySelectorAll(
        '.progress-bar-content-text',
    )) {
        if (element instanceof HTMLElement) {
            element.textContent = message;
        }
    }
}
