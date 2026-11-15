// The stay-awake toggle in the header of the Presenter and of the Screen Mirror
// page. Shared names and pure helpers only: no Electron, renderer or filesystem
// dependency, so the main process, which holds the OS request, and the icon
// that switches it read ONE key and ONE default -- the icon can never say
// something the process is not doing.

// A setting of the data folder (`DATA_DIR_SETTING_NAME_LIST` in
// `dataDirSettingProtocol.ts`): `<data folder>/local-storage/stay-awake`,
// read through the client-setting door like any other.
export const STAY_AWAKE_SETTING_NAME = 'stay-awake';

const UNTIL_VALUE_PATTERN = /^\d+$/;

// A value of digits alone is a timed choice (the user, 2026-11-15: _add timer
// to stay-awake, for user's option over infinite awaking_; the cup's menu
// offers 30 minutes to 4 hours): the moment, in epoch
// milliseconds, the computer may sleep again. Nothing is written when it comes
// -- a moment already past reads as off, to the main process and to the icon
// alike, so neither has to tell the other.
export function toStayAwakeUntil(value: string | null) {
    if (value === null || !UNTIL_VALUE_PATTERN.test(value)) {
        return null;
    }
    return Number(value);
}

// On unless switched off. Anything but an explicit `false` or a timed choice
// -- nothing written yet, a value blanked by hand -- keeps the computer awake:
// a service that goes dark because a setting could not be read is the worse of
// the two mistakes. A timed choice keeps it awake until its moment.
export function toIsStayAwake(value: string | null, now = Date.now()) {
    if (value === 'false') {
        return false;
    }
    const until = toStayAwakeUntil(value);
    return until === null || until > now;
}

export function toStayAwakeValueForMinutes(minutes: number, now = Date.now()) {
    return `${now + minutes * 60_000}`;
}

// The longest a timer waits (~24.8 days): a longer delay -- a value written by
// hand -- would fire at once, so the wait is capped and its end checks again.
const MAX_TIMER_MS = 2 ** 31 - 1;

export function toStayAwakeTimerDelay(until: number, now = Date.now()) {
    return Math.min(Math.max(until - now, 0), MAX_TIMER_MS);
}
