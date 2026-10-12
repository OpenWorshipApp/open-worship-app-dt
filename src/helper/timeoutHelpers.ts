export function genTimeoutAttempt(
    timeMilliseconds: number = 1e3,
    shouldWait = true,
) {
    let timeoutId: any = null;
    let lastSchedule = Date.now() - timeMilliseconds - 1;
    const caller = function (func: () => void, isImmediate: boolean = false) {
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
    return caller;
}

/**
 * At most one run per window, and always the LAST one asked for: the first
 * call runs at once, the calls landing inside the window collapse into the
 * one that runs as it closes. For work that should FOLLOW a drag -- a slider
 * the projector tracks -- where `genTimeoutAttempt` would hold everything
 * back until the hand stops.
 */
export function genThrottleAttempt(timeMilliseconds: number) {
    let timeoutId: any = null;
    let pendingFunc: (() => void) | null = null;
    const openWindow = () => {
        timeoutId = setTimeout(() => {
            timeoutId = null;
            if (pendingFunc === null) {
                return;
            }
            const func = pendingFunc;
            pendingFunc = null;
            openWindow();
            func();
        }, timeMilliseconds);
    };
    return function (func: () => void) {
        if (timeoutId !== null) {
            pendingFunc = func;
            return;
        }
        openWindow();
        func();
    };
}
