/**
 * The times a stopwatch session has been reset from -- the speaker's
 * testimony that ran 7:42, the offering that took 3:10 -- kept so the number
 * is not lost the moment the clock goes back to zero.
 *
 * Kept per SESSION in one setting, newest first and capped: it is read on
 * every mount of the panel and written on every Reset, so it must stay a
 * short list rather than a log that grows for as long as the app is used.
 */
export type StopwatchHistoryEntryType = {
    /** What the stopwatch read when Reset was pressed. */
    elapsedMillisecond: number;
    /** When it was reset, as epoch milliseconds. */
    endedAt: number;
};

export const STOPWATCH_HISTORY_LIMIT = 20;

export function genStopwatchHistorySettingName(suffix: string) {
    return `foreground-stopwatch-history-setting${suffix}`;
}

/** The saved list, keeping only well-formed entries -- the setting is a file. */
export function parseStopwatchHistory(
    text: string | null,
): StopwatchHistoryEntryType[] {
    if (!text) {
        return [];
    }
    try {
        const list = JSON.parse(text);
        if (!Array.isArray(list)) {
            return [];
        }
        return list
            .filter((entry) => {
                return (
                    entry !== null &&
                    typeof entry === 'object' &&
                    Number.isFinite(entry.elapsedMillisecond) &&
                    entry.elapsedMillisecond >= 0 &&
                    Number.isFinite(entry.endedAt)
                );
            })
            .map((entry) => {
                return {
                    elapsedMillisecond: entry.elapsedMillisecond,
                    endedAt: entry.endedAt,
                };
            })
            .slice(0, STOPWATCH_HISTORY_LIMIT);
    } catch {
        return [];
    }
}

/**
 * The list with this reset's time on top. A reading under one second shows
 * as `00:00:00` and is not kept -- it is a Reset pressed by accident, not a
 * time anyone timed.
 */
export function addStopwatchHistoryEntry(
    list: StopwatchHistoryEntryType[],
    entry: StopwatchHistoryEntryType,
) {
    if (!(entry.elapsedMillisecond >= 1000)) {
        return list;
    }
    return [entry, ...list].slice(0, STOPWATCH_HISTORY_LIMIT);
}

function checkCanFormatDates(locale: string) {
    try {
        return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0;
    } catch (_error) {
        return false;
    }
}

function padTwo(value: number) {
    return String(value).padStart(2, '0');
}

/**
 * `10:42 AM` today, `Oct 3, 10:42 AM` on another day -- in `locale`, the
 * app's own language. Left to the system (`[]`), a Khmer panel read
 * "Oct 4, 7:57 AM" under Khmer headings, because the system is English on
 * most of the machines it runs on. A taken param, not read here, so this file
 * stays free of the language module and its settings store.
 *
 * A locale `Intl` cannot format gets NUMBERS only -- `07:57` today,
 * `04/10 07:57` on another day, day first and a 24-hour clock -- which read
 * the same in any language. That is Khmer in the app: Electron ships
 * Chromium's trimmed ICU data, which has none, and asked for `km-KH` it
 * quietly answers in English (Node, which runs the tests, has it all).
 */
export function toStopwatchHistoryWhenText(
    endedAt: number,
    now = Date.now(),
    locale?: string,
) {
    const date = new Date(endedAt);
    const isToday = date.toDateString() === new Date(now).toDateString();
    if (locale !== undefined && !checkCanFormatDates(locale)) {
        const time = `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
        if (isToday) {
            return time;
        }
        return `${padTwo(date.getDate())}/${padTwo(date.getMonth() + 1)} ${time}`;
    }
    const locales = locale === undefined ? [] : [locale];
    const time = date.toLocaleTimeString(locales, {
        hour: 'numeric',
        minute: '2-digit',
    });
    if (isToday) {
        return time;
    }
    return `${date.toLocaleDateString(locales, {
        month: 'short',
        day: 'numeric',
    })}, ${time}`;
}
