/**
 * What a foreground session HOLDS -- a quick text's words, a countdown's
 * minutes, a marquee's line, a clock's city -- as the help window's assistant
 * writes it: the very settings the panel's own boxes write, so the panel
 * shows the words that went up and its Show button puts up the same thing
 * again (2026-11-09, the user: _start a countdown for 5 minutes_, _show top
 * marquee for a given message_, _make a quick-text for a given bible verse_).
 *
 * A verse is never the model's: `ref` is read out of the installed Bible
 * with the same resolvers the Bible door uses (`agentBibleHelpers.ts`), and a
 * quick text made from one is exactly what the Bibles list's own **Open in
 * Quick Text** makes -- its Markdown, and on a new session its Bible Verse
 * look.
 */
import { getSetting } from './settingHelpers';
import type { ForegroundComponentKeyType } from '../presenter-foreground/foregroundComponentKeys';
import { genClockOwnSettingNames } from '../presenter-foreground/foregroundComponentRules';
import type { ForegroundSettingWriteType } from './agentForegroundLookRules';
import type { AgentForegroundReasonType } from './agentForegroundComponentHelpers';
import {
    readClockIdList,
    toForegroundSessionName,
} from './agentForegroundSessionHelpers';

export type AgentForegroundContentRequestType = {
    minutes?: unknown;
    at?: unknown;
    autoStart?: unknown;
    text?: unknown;
    texts?: unknown;
    interval?: unknown;
    ref?: unknown;
    version?: unknown;
    delay?: unknown;
    seconds?: unknown;
    utcOffset?: unknown;
    title?: unknown;
    is24Hour?: unknown;
    /** `ref` read ONCE by the worker, before the session is chosen. */
    verse?: AgentForegroundVerseType;
};

export type AgentForegroundContentPlanType = {
    /** Keyed on the suffix the plan was made for. */
    writes: ForegroundSettingWriteType[];
    /** What the words or numbers are, for the answer: `5 minutes`. */
    said: string;
    /** What a NEW session of it is called: `John 3:16`, `5:00`. */
    name: string;
    /** A countdown to a time of day rather than one of a length. */
    countdownMode?: 'duration' | 'date';
    /** A verse: its title, and the Bible Verse look for a new session. */
    verseTitle?: string;
    /** A Time session's clock the change is on (a new one when absent). */
    clockId?: string;
    newClockIdList?: string[];
};

// A countdown of a quarter of a minute to a day; words of a sentence or two
// for a marquee, a few paragraphs for a quick text; a quick text that stays
// a moment to ten minutes.
const MIN_COUNTDOWN_MINUTES = 0.25;
const MAX_COUNTDOWN_MINUTES = 24 * 60;
const MAX_MARQUEE_LENGTH = 600;
const MAX_TEXT_LENGTH = 3000;
const MAX_MESSAGE_COUNT = 20;
const MAX_QUICK_TEXT_SECONDS = 600;
const MIN_INTERVAL_SECONDS = 2;
const MAX_INTERVAL_SECONDS = 600;

function fail(reason: string): AgentForegroundReasonType {
    return { reason };
}

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value: unknown) {
    const parsed =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim() !== ''
              ? Number(value)
              : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: unknown) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        if (/^(?:true|yes|on)$/i.test(value.trim())) {
            return true;
        }
        if (/^(?:false|no|off)$/i.test(value.trim())) {
            return false;
        }
    }
    return null;
}

function toTimeLabel(date: Date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** `5:00`, `1:30:00` -- a countdown session's name, in no language. */
export function toDurationName(totalSecond: number) {
    const hours = Math.floor(totalSecond / 3600);
    const minutes = Math.floor((totalSecond % 3600) / 60);
    const seconds = totalSecond % 60;
    const pad = (value: number) => {
        return `${value}`.padStart(2, '0');
    };
    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${minutes}:${pad(seconds)}`;
}

/**
 * A clock time today, as a person says it: "10:30", "18:30", "6:45 pm",
 * "7pm", "10.30". Null when it is not one; a reason when it has already
 * passed, because a countdown to a time gone by shows nothing useful.
 */
export function parseClockTimeToday(
    text: string,
    now: Date = new Date(),
): Date | null | AgentForegroundReasonType {
    const match =
        /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(
            text,
        );
    if (match === null) {
        return null;
    }
    let hours = Number.parseInt(match[1], 10);
    const minutes = match[2] === undefined ? 0 : Number.parseInt(match[2], 10);
    const meridiem = match[3]?.toLowerCase().replace(/\./g, '') ?? null;
    if (meridiem === null && match[2] === undefined) {
        // A bare "10" is a number of minutes, not ten o'clock.
        return null;
    }
    if (
        minutes > 59 ||
        hours > 23 ||
        (meridiem !== null && (hours < 1 || hours > 12))
    ) {
        return fail(
            `"${text.trim()}" is not a time of day. Write it as "10:30", ` +
                '"18:30" or "6:45 pm".',
        );
    }
    if (meridiem === 'pm' && hours < 12) {
        hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
        hours = 0;
    }
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() <= now.getTime()) {
        return fail(
            `${toTimeLabel(target)} has already passed today, so there is ` +
                'nothing to count down to. Give a later time, or say how ' +
                'many minutes.',
        );
    }
    return target;
}

function pad2(value: number) {
    return `${value}`.padStart(2, '0');
}

/** The panel's date and time boxes hold `YYYY-MM-DD` and `HH:MM`, local. */
function toDateBoxText(date: Date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toTimeBoxText(date: Date) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Plain words as Quick Text Markdown: only what Markdown would act on. */
export function escapeQuickTextMarkdown(text: string) {
    return text
        .replaceAll(/([\\`*_[\]<>|~])/g, String.raw`\$1`)
        .replaceAll(/^(\s*)([#>+=-])/gm, String.raw`$1\$2`)
        .replaceAll(/^(\s*\d+)([.)])/gm, String.raw`$1\$2`);
}

export type AgentForegroundVerseType = {
    title: string;
    text: string;
    markdown: string;
};

/**
 * The passage from the INSTALLED Bible -- the lookup's version unless
 * `version` names one -- or why it cannot be read.
 */
export async function readForegroundVerse(
    ref: string,
    version: unknown,
): Promise<AgentForegroundVerseType | AgentForegroundReasonType> {
    const { resolveBibleItem, resolveVersionOrder } =
        await import('./agentBibleHelpers');
    const resolved = await resolveVersionOrder(
        typeof version === 'string' && version.trim() !== ''
            ? version.trim()
            : null,
    );
    if (!('order' in resolved)) {
        return fail(
            String((resolved as any).reason ?? 'No Bible could read that.'),
        );
    }
    const bibleItem = await resolveBibleItem(ref, resolved.order);
    if (bibleItem === null) {
        return fail(
            `"${ref}" could not be read as a passage in any installed Bible. ` +
                'Write the book, chapter and verse -- "John 3:16", "Psalm ' +
                '23:1-3".',
        );
    }
    const { genBibleItemQuickTextMarkdown } =
        await import('../presenter-foreground/foregroundQuickTextOpenHelpers');
    const { title, markdown } = await genBibleItemQuickTextMarkdown(bibleItem);
    const text = (await bibleItem.toText(undefined, 'parenthesis'))
        .replace(/\s+/g, ' ')
        .trim();
    return { title, text, markdown };
}

function genTooLongReason(what: string, length: number, max: number) {
    return fail(
        `That is ${length} characters; a ${what} holds at most ${max}. ` +
            'Shorten it -- or, for a whole passage, use the Bible on the ' +
            'screen (owa_present_bible) or Long Text Show.',
    );
}

/**
 * The writes that give ONE session (`suffix`) the words or numbers asked
 * for. `null` when the ask carries none (a plain "show it", a look change).
 * The keys are the panel's, so the panel shows the same thing.
 */
export async function planForegroundContent(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundContentRequestType,
    suffix: string,
    now: Date,
): Promise<AgentForegroundContentPlanType | AgentForegroundReasonType | null> {
    const ref = toText(request.ref);
    switch (widget) {
        case 'countdown': {
            const minutes = toNumber(request.minutes);
            const at = toText(request.at);
            const autoStart = toBoolean(request.autoStart);
            const writes: ForegroundSettingWriteType[] = [];
            if (autoStart !== null) {
                writes.push({
                    key: `foreground-countdown-auto-start-setting${suffix}`,
                    value: `${autoStart}`,
                });
            }
            if (minutes !== null) {
                if (
                    minutes < MIN_COUNTDOWN_MINUTES ||
                    minutes > MAX_COUNTDOWN_MINUTES
                ) {
                    return fail(
                        'A countdown runs from a quarter of a minute to 24 ' +
                            `hours; ${minutes} minutes is outside that.`,
                    );
                }
                const totalSecond = Math.round(minutes * 60);
                writes.push(
                    {
                        key: `foreground-hours-setting${suffix}`,
                        value: `${Math.floor(totalSecond / 3600)}`,
                    },
                    {
                        key: `foreground-minutes-setting${suffix}`,
                        value: `${Math.floor((totalSecond % 3600) / 60)}`,
                    },
                    {
                        key: `foreground-seconds-setting${suffix}`,
                        value: `${totalSecond % 60}`,
                    },
                );
                return {
                    writes,
                    said: `${Math.round(minutes * 100) / 100} minutes`,
                    name: toDurationName(totalSecond),
                    countdownMode: 'duration',
                };
            }
            if (at !== '') {
                const parsed = parseClockTimeToday(at, now);
                if (parsed === null) {
                    return fail(
                        `"${at}" is not a time of day. Write it as "10:30", ` +
                            '"18:30" or "6:45 pm" -- or give a number of minutes.',
                    );
                }
                if (!(parsed instanceof Date)) {
                    return parsed;
                }
                writes.push(
                    {
                        key: `foreground-date-setting${suffix}`,
                        value: toDateBoxText(parsed),
                    },
                    {
                        key: `foreground-time-setting${suffix}`,
                        value: toTimeBoxText(parsed),
                    },
                );
                return {
                    writes,
                    said: `to ${toTimeLabel(parsed)}`,
                    name: `→ ${toTimeBoxText(parsed)}`,
                    countdownMode: 'date',
                };
            }
            return writes.length > 0 ? { writes, said: '', name: '' } : null;
        }
        case 'stopwatch': {
            const autoStart = toBoolean(request.autoStart);
            return autoStart === null
                ? null
                : {
                      writes: [
                          {
                              key: `foreground-stopwatch-auto-start-setting${suffix}`,
                              value: `${autoStart}`,
                          },
                      ],
                      said: '',
                      name: '',
                  };
        }
        case 'marquee-top':
        case 'marquee-bottom': {
            let text = toText(request.text).replace(/\s+/g, ' ');
            let name = '';
            if (ref !== '') {
                const verse = request.verse;
                if (verse === undefined) {
                    return fail('The passage was not read.');
                }
                text = `${verse.title} — ${verse.text}`;
                name = verse.title;
            }
            if (text === '') {
                return null;
            }
            if (text.length > MAX_MARQUEE_LENGTH) {
                return genTooLongReason(
                    'marquee',
                    text.length,
                    MAX_MARQUEE_LENGTH,
                );
            }
            return {
                writes: [
                    {
                        key: `foreground-${widget}-setting${suffix}`,
                        value: text,
                    },
                ],
                said: `"${text}"`,
                name: name || toForegroundSessionName(text),
                ...(name ? { verseTitle: name } : {}),
            };
        }
        case 'quick-text': {
            const writes: ForegroundSettingWriteType[] = [];
            let said = '';
            let name = '';
            let verseTitle: string | undefined;
            if (ref !== '') {
                const verse = request.verse;
                if (verse === undefined) {
                    return fail('The passage was not read.');
                }
                if (verse.markdown.length > MAX_TEXT_LENGTH) {
                    return genTooLongReason(
                        'quick text',
                        verse.markdown.length,
                        MAX_TEXT_LENGTH,
                    );
                }
                writes.push({
                    key: `foreground-quick-text-setting${suffix}`,
                    value: verse.markdown,
                });
                said = `${verse.title}: "${verse.text}"`;
                name = verse.title;
                verseTitle = verse.title;
            } else {
                const text =
                    typeof request.text === 'string' ? request.text.trim() : '';
                if (text !== '') {
                    if (text.length > MAX_TEXT_LENGTH) {
                        return genTooLongReason(
                            'quick text',
                            text.length,
                            MAX_TEXT_LENGTH,
                        );
                    }
                    writes.push({
                        key: `foreground-quick-text-setting${suffix}`,
                        value: text,
                    });
                    said = `"${toForegroundSessionName(text)}"`;
                    name = toForegroundSessionName(text);
                }
            }
            const delay = toNumber(request.delay);
            if (delay !== null) {
                if (delay < 0 || delay > MAX_QUICK_TEXT_SECONDS) {
                    return fail(
                        `delay is seconds, 0-${MAX_QUICK_TEXT_SECONDS}.`,
                    );
                }
                writes.push({
                    key: `foreground-quick-text-time-delay${suffix}`,
                    value: `${Math.round(delay)}`,
                });
            }
            const seconds = toNumber(request.seconds);
            if (seconds !== null) {
                if (seconds < 1 || seconds > MAX_QUICK_TEXT_SECONDS) {
                    return fail(
                        `seconds (how long it stays) is 1-${MAX_QUICK_TEXT_SECONDS}.`,
                    );
                }
                writes.push({
                    key: `foreground-quick-text-time-to-live${suffix}`,
                    value: `${Math.round(seconds)}`,
                });
            }
            if (writes.length === 0) {
                return null;
            }
            return {
                writes,
                said,
                name,
                ...(verseTitle ? { verseTitle } : {}),
            };
        }
        case 'message': {
            const { toStoredText } =
                await import('../presenter-foreground/ForegroundMessageComp');
            let textList: string[] = [];
            let name = '';
            let verseTitle: string | undefined;
            if (ref !== '') {
                const verse = request.verse;
                if (verse === undefined) {
                    return fail('The passage was not read.');
                }
                textList = [`${verse.title}\n${verse.text}`];
                name = verse.title;
                verseTitle = verse.title;
            } else if (Array.isArray(request.texts)) {
                textList = request.texts
                    .filter((one): one is string => {
                        return typeof one === 'string' && one.trim() !== '';
                    })
                    .map((one) => {
                        // A blank line is what separates two messages.
                        return one.trim().replace(/\n\s*\n/g, '\n');
                    });
            } else if (toText(request.text) !== '') {
                textList = [toText(request.text).replace(/\n\s*\n/g, '\n')];
            }
            const writes: ForegroundSettingWriteType[] = [];
            if (textList.length > MAX_MESSAGE_COUNT) {
                return fail(
                    `At most ${MAX_MESSAGE_COUNT} messages in a session.`,
                );
            }
            const total = textList.join('\n\n').length;
            if (total > MAX_TEXT_LENGTH) {
                return genTooLongReason('message', total, MAX_TEXT_LENGTH);
            }
            if (textList.length > 0) {
                writes.push({
                    key: `foreground-message-setting${suffix}`,
                    value: toStoredText(
                        textList.map((text, index) => {
                            return { id: `message-${index}${suffix}`, text };
                        }),
                    ),
                });
            }
            const interval = toNumber(request.interval);
            if (interval !== null) {
                if (
                    interval < MIN_INTERVAL_SECONDS ||
                    interval > MAX_INTERVAL_SECONDS
                ) {
                    return fail(
                        `interval is seconds a message stays before the next, ` +
                            `${MIN_INTERVAL_SECONDS}-${MAX_INTERVAL_SECONDS}.`,
                    );
                }
                writes.push(
                    {
                        key: `foreground-message-is-rotating${suffix}`,
                        value: 'true',
                    },
                    {
                        key: `foreground-message-interval${suffix}`,
                        value: `${Math.round(interval)}`,
                    },
                );
            } else if (textList.length > 0) {
                // Asked for words, not for a rotation: one under another.
                writes.push({
                    key: `foreground-message-is-rotating${suffix}`,
                    value: 'false',
                });
            }
            if (writes.length === 0) {
                return null;
            }
            const first = textList[0] ?? '';
            return {
                writes,
                said:
                    textList.length > 1
                        ? `${textList.length} messages`
                        : `"${toForegroundSessionName(first)}"`,
                name: name || toForegroundSessionName(first),
                ...(verseTitle ? { verseTitle } : {}),
            };
        }
        case 'time': {
            const utcOffset = toNumber(request.utcOffset);
            const title = toText(request.title);
            const is24Hour = toBoolean(request.is24Hour);
            if (utcOffset === null && title === '' && is24Hour === null) {
                return null;
            }
            if (utcOffset !== null && (utcOffset < -12 || utcOffset > 14)) {
                return fail(
                    'utcOffset is hours from UTC, -12 to 14 (e.g. 7, -5, 5.5).',
                );
            }
            if (title.length > 40) {
                return fail(
                    'title is a short name for the clock, e.g. a city.',
                );
            }
            const clockIdList = readClockIdList(suffix);
            const clockId = clockIdList[0] ?? crypto.randomUUID();
            const names = genClockOwnSettingNames(clockId);
            const writes: ForegroundSettingWriteType[] = [];
            if (clockIdList.length === 0) {
                writes.push({
                    key: `foreground-time-id-list${suffix}`,
                    value: JSON.stringify([clockId]),
                });
            }
            if (utcOffset !== null) {
                // Hours, despite the key's name -- see `ForegroundTimeComp`.
                writes.push(
                    { key: names.hourOffset, value: `${utcOffset}` },
                    // A city's zone would put its own offset back.
                    { key: names.zoneName, value: null },
                );
            }
            if (title !== '') {
                writes.push({ key: names.cityName, value: title });
            }
            if (is24Hour !== null) {
                writes.push({
                    key: names.is24HourFormat,
                    value: `${is24Hour}`,
                });
            }
            const offsetText =
                utcOffset === null
                    ? ''
                    : `UTC${utcOffset >= 0 ? '+' : ''}${utcOffset}`;
            return {
                writes,
                said:
                    [title, offsetText].filter(Boolean).join(' ') ||
                    'the clock',
                name: title || offsetText,
                clockId,
                ...(clockIdList.length === 0
                    ? { newClockIdList: [clockId] }
                    : {}),
            };
        }
        default:
            return null;
    }
}

/**
 * Whether a plan would leave `suffix`'s session as it is -- the words asked
 * for are the ones it already holds, so no new session is made for them.
 */
export function checkIsSameContent(plan: AgentForegroundContentPlanType) {
    return plan.writes.every((write) => {
        const stored = getSetting(write.key);
        // A key nobody has written reads as the panel's own default: a fresh
        // install's Default countdown IS five minutes.
        const current =
            stored === null || stored === ''
                ? (toPanelDefault(write.key) ?? stored)
                : stored;
        return (
            (current ?? null) === write.value ||
            (current === '' && write.value === null)
        );
    });
}

// What a panel's box shows for a key it has never written (the default its
// `useStateSetting…` is given), by the key's own name, whatever its suffix.
const PANEL_DEFAULT_LIST: [RegExp, string][] = [
    [/^foreground-hours-setting(?:-|$)/, '0'],
    [/^foreground-minutes-setting(?:-|$)/, '5'],
    [/^foreground-seconds-setting(?:-|$)/, '0'],
    [/^foreground-countdown-auto-start-setting(?:-|$)/, 'false'],
    [/^foreground-stopwatch-auto-start-setting(?:-|$)/, 'false'],
    [/^foreground-quick-text-time-delay(?:-|$)/, '0'],
    [/^foreground-quick-text-time-to-live(?:-|$)/, '3'],
    [/^foreground-message-is-rotating(?:-|$)/, 'false'],
    [/^foreground-message-interval(?:-|$)/, '8'],
];

export function toPanelDefault(key: string) {
    return (
        PANEL_DEFAULT_LIST.find(([pattern]) => {
            return pattern.test(key);
        })?.[1] ?? null
    );
}

/** The session's words and numbers, read back for the model. */
export function readForegroundContent(
    widget: ForegroundComponentKeyType,
    suffix: string,
): Record<string, unknown> {
    const read = (key: string) => {
        return getSetting(key) ?? undefined;
    };
    switch (widget) {
        case 'countdown':
            return {
                hours: read(`foreground-hours-setting${suffix}`) ?? '0',
                minutes: read(`foreground-minutes-setting${suffix}`) ?? '5',
                seconds: read(`foreground-seconds-setting${suffix}`) ?? '0',
                toDate: read(`foreground-date-setting${suffix}`),
                toTime: read(`foreground-time-setting${suffix}`),
                autoStart:
                    read(`foreground-countdown-auto-start-setting${suffix}`) ===
                    'true',
            };
        case 'stopwatch':
            return {
                autoStart:
                    read(`foreground-stopwatch-auto-start-setting${suffix}`) ===
                    'true',
            };
        case 'marquee-top':
        case 'marquee-bottom':
            return {
                text: read(`foreground-${widget}-setting${suffix}`) ?? '',
                fontSize:
                    Number(
                        read(`foreground-${widget}-font-size${suffix}`) ?? 0,
                    ) || 'auto',
                speed: Number(
                    read(`foreground-${widget}-speed-percentage${suffix}`) ??
                        100,
                ),
            };
        case 'quick-text':
            return {
                text: read(`foreground-quick-text-setting${suffix}`) ?? '',
                delay: Number(
                    read(`foreground-quick-text-time-delay${suffix}`) ?? 0,
                ),
                seconds: Number(
                    read(`foreground-quick-text-time-to-live${suffix}`) ?? 3,
                ),
            };
        case 'message': {
            const stored = read(`foreground-message-setting${suffix}`) ?? '';
            return {
                texts: stored
                    .split(/\n\s*\n/)
                    .map((one) => {
                        return one.trim();
                    })
                    .filter(Boolean),
                rotate:
                    read(`foreground-message-is-rotating${suffix}`) === 'true',
                interval: Number(
                    read(`foreground-message-interval${suffix}`) ?? 8,
                ),
            };
        }
        case 'time':
            return {
                clocks: readClockIdList(suffix).map((clockId) => {
                    const names = genClockOwnSettingNames(clockId);
                    return {
                        id: clockId,
                        title: read(names.cityName) || null,
                        utcOffset:
                            Number(read(names.hourOffset)) ||
                            -new Date().getTimezoneOffset() / 60,
                        is24Hour: read(names.is24HourFormat) === 'true',
                    };
                }),
            };
        default:
            return {};
    }
}
