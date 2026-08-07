/**
 * Arming a run action with a CLOCK TIME rather than with a number of seconds.
 *
 * A service does not run on stopwatches. "Go on by yourself in ten seconds" is
 * what a slide wants; "be off this notice board by 7:05" is what the START of a
 * service wants, and counting the seconds to it by hand is exactly the sum an
 * operator should not be doing mid-service.
 *
 * Stored as `HH:mm` in 24-hour form — the same shape `<input type="time">`
 * speaks, and the only one that is unambiguous in a file that may be opened in
 * any language. It is a TIME OF DAY, not a date: a run sheet is written for the
 * day it is used, and the day it lands on is the day it is fired.
 *
 * Pure, and free of every UI import, because `PlaylistItem` (which draws the
 * row and validates the entry) and `playlistAutoNextHelpers` (which counts down
 * to it) both need it.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Whether a stored value is a time this app wrote — and could write again. */
export function checkIsValidPlaylistActionTime(value: any): value is string {
    return typeof value === 'string' && TIME_PATTERN.test(value);
}

/**
 * The stored 24-hour time as it is READ: `19:30` shown as `7:30 PM`.
 *
 * Written out here rather than left to `toLocaleTimeString`, which would answer
 * in the SYSTEM's language and format — a run sheet reading `19:30` in one place
 * and `७:३० अपराह्न` in another, from the same file, is the confusion this
 * avoids. 12-hour with an explicit AM/PM is what the operator typed in the
 * question, so it is what the row says back.
 */
export function toPlaylistActionTimeLabel(time: string) {
    if (!checkIsValidPlaylistActionTime(time)) {
        return time;
    }
    const [hourText, minuteText] = time.split(':');
    const hour = parseInt(hourText, 10);
    const suffix = hour < 12 ? 'AM' : 'PM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minuteText} ${suffix}`;
}

/** A `Date` written back as the `HH:mm` this module stores. */
export function toPlaylistActionTime(date: Date) {
    const pad = (value: number) => {
        return `${value}`.padStart(2, '0');
    };
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * When this time of day next comes round — as a timestamp — or null when it has
 * already gone by.
 *
 * TODAY only: it deliberately does NOT roll over to tomorrow. A time that has
 * passed is an operator looking at a run sheet written for a service that has
 * already started, and the honest answer is to say so (they can re-arm it) — a
 * silent twenty-three-hour countdown behind a run sheet is the one outcome
 * nobody would ever want.
 *
 * `fromTime` is passed in rather than read from the clock here so this stays
 * pure and the tests can stand anywhere in the day.
 */
export function toPlaylistActionDueTime(
    time: string,
    fromTime: number,
): number | null {
    if (!checkIsValidPlaylistActionTime(time)) {
        return null;
    }
    const [hourText, minuteText] = time.split(':');
    const dueDate = new Date(fromTime);
    dueDate.setHours(
        parseInt(hourText, 10),
        parseInt(minuteText, 10),
        // To the top of the minute: the operator asked for 7:05, not for
        // "7:05 plus however many seconds were on the clock when they typed it".
        0,
        0,
    );
    const dueTime = dueDate.getTime();
    return dueTime > fromTime ? dueTime : null;
}
