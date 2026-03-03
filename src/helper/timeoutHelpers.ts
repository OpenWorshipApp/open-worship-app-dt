export function genTimeoutAttempt(
    timeMilliseconds: number = 1e3,
    shouldWait = true,
) {
    let timeoutId: any = null;
    let lastSchedule = Date.now() - timeMilliseconds - 1;
    return function (func: () => void, isImmediate: boolean = false) {
        if (!shouldWait && Date.now() - lastSchedule > timeMilliseconds) {
            isImmediate = true;
        }
        lastSchedule = Date.now();
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (isImmediate) {
            func();
            return;
        }
        timeoutId = setTimeout(() => {
            timeoutId = null;
            func();
        }, timeMilliseconds);
    };
}
