/**
 * A FOREGROUND line of a presenting flow -- a countdown before the service, a
 * clock, a notice board, a marquee -- as the help window's assistant writes
 * one (2026-11-07, a presenting flow's **Open in Chatbot**; the user chose
 * _Foreground presets_ for what the assistant may change). The row stores the
 * very payload the Foreground panel puts on a drag
 * (`genForegroundDragInf`), so a line written here replays through
 * `applyForegroundDragData` exactly as a dragged one does.
 *
 * Only the widgets that are WORDS and NUMBERS: a video, a picture, a camera,
 * another screen or a web page is a thing the person picks in the panel, and
 * a model naming one would be naming a file or a device it cannot see.
 *
 * Pure: no store, no file, no `tran`. Every rule a test.
 */
import { COUNTDOWN_LEAD_SECOND } from '../presenter-foreground/foregroundDragHelpers';
import {
    QUICK_TEXT_DEFAULT_DELAY_SECOND,
    QUICK_TEXT_DEFAULT_LIVE_SECOND,
} from '../presenter-foreground/foregroundComponentRules';

export const AGENT_FLOW_FOREGROUND_WIDGETS = [
    'countdown',
    'stopwatch',
    'time',
    'message',
    'marquee-top',
    'marquee-bottom',
    'quick-text',
] as const;

export type AgentFlowForegroundWidgetType =
    (typeof AGENT_FLOW_FOREGROUND_WIDGETS)[number];

/**
 * What each widget takes, said the way the assistant is told it. The first
 * line is the SHAPE: a small model had written `seconds` beside `foreground`
 * eleven times running and never inside it (EC-469).
 */
export const AGENT_FLOW_FOREGROUND_FIELD_TEXT_LIST = [
    'a line is add {foreground: {widget, …its fields}}, e.g. {foreground: ' +
        '{widget: "countdown", seconds: 300}}',
    'countdown: seconds (its length) or dateTime (ISO, counts to it), autoStart',
    'stopwatch: autoStart',
    'time: utcOffset (hours), title (a city), is24Hour',
    'message: text (one message), or texts (several shown in turn) with intervalSecond',
    'marquee-top / marquee-bottom: text, speed (10-1000, 100 is normal)',
    'quick-text: text (markdown), delaySecond, liveSecond (how long it stays)',
];

const PICKED_WIDGET_LIST = ['video', 'image', 'camera', 'screen', 'web'];

// The fields each widget reads -- the ones taken from beside `foreground`
// when a model wrote them there.
const WIDGET_FIELD_KEY_MAP: Record<AgentFlowForegroundWidgetType, string[]> = {
    countdown: ['seconds', 'dateTime', 'autoStart'],
    stopwatch: ['autoStart'],
    time: ['utcOffset', 'title', 'is24Hour'],
    message: ['text', 'texts', 'intervalSecond'],
    'marquee-top': ['text', 'speed'],
    'marquee-bottom': ['text', 'speed'],
    'quick-text': ['text', 'delaySecond', 'liveSecond'],
};

function checkIsWidgetName(value: unknown) {
    return (
        typeof value === 'string' &&
        ((AGENT_FLOW_FOREGROUND_WIDGETS as readonly string[]).includes(value) ||
            PICKED_WIDGET_LIST.includes(value))
    );
}

/**
 * The widget and fields of a foreground line, read the way models write one
 * (2026-11-10, EC-469: a running order built from an order of service was
 * refused twice over, every call the same three shapes): as asked,
 * `{widget: "countdown", seconds: 300}`; the widget as the KEY,
 * `{countdown: {seconds: 300}}`; the widget alone as a word, `"countdown"`;
 * and the widget's own fields written BESIDE `foreground`, in `beside` (the
 * `add` it came in), which a field inside wins over. Null when it names no
 * widget at all -- the caller's refusal says the shape.
 */
export function readAgentForegroundSpec(
    foreground: unknown,
    beside: Record<string, unknown> = {},
): { widget: unknown; fields: Record<string, unknown> } | null {
    let widget: unknown;
    let fields: Record<string, unknown>;
    if (typeof foreground === 'string') {
        widget = foreground.trim();
        fields = {};
    } else if (foreground !== null && typeof foreground === 'object') {
        const { widget: named, ...rest } = foreground as Record<
            string,
            unknown
        >;
        const keys = Object.keys(rest);
        const inner = keys.length === 1 ? rest[keys[0]] : undefined;
        if (
            named === undefined &&
            keys.length === 1 &&
            checkIsWidgetName(keys[0])
        ) {
            widget = keys[0];
            const isTextWidget =
                WIDGET_FIELD_KEY_MAP[
                    widget as AgentFlowForegroundWidgetType
                ]?.includes('text') === true;
            // `{message: "Potluck after the service"}`: its words;
            // `{countdown: 300}`: its length.
            fields =
                inner !== null && typeof inner === 'object'
                    ? { ...(inner as Record<string, unknown>) }
                    : typeof inner === 'string' && isTextWidget
                      ? { text: inner }
                      : typeof inner === 'number' && widget === 'countdown'
                        ? { seconds: inner }
                        : {};
        } else {
            widget = named;
            fields = rest;
        }
    } else {
        return null;
    }
    const keyList =
        WIDGET_FIELD_KEY_MAP[widget as AgentFlowForegroundWidgetType] ?? [];
    for (const key of keyList) {
        if (fields[key] === undefined && beside[key] !== undefined) {
            fields[key] = beside[key];
        }
    }
    return { widget, fields };
}

const MAX_TEXT_LENGTH = 2000;
const MAX_MESSAGE_COUNT = 20;
const MIN_SPEED = 10;
const MAX_SPEED = 1000;
// A day: a countdown longer than that is a date, and the form for a date is
// `dateTime`.
const MAX_DURATION_SECOND = 24 * 3600;

type ResultType = { data: Record<string, unknown> } | { reason: string };

function fail(reason: string): ResultType {
    return { reason };
}

function checkIsPositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function checkIsTextField(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
}

function toCleanText(value: string) {
    return value.slice(0, MAX_TEXT_LENGTH);
}

/** Whether a widget is one of the ones the person picks in the panel. */
export function checkIsPickedForegroundWidget(widget: unknown) {
    return typeof widget === 'string' && PICKED_WIDGET_LIST.includes(widget);
}

/** The look a new line borrows: its layer, its transition and its style. */
export function pickForegroundLook(data: unknown) {
    if (data === null || typeof data !== 'object') {
        return {};
    }
    const { extraStyle, transitionEffect, isBehind } = data as any;
    return {
        ...(extraStyle !== null && typeof extraStyle === 'object'
            ? { extraStyle }
            : {}),
        ...(transitionEffect === undefined ? {} : { transitionEffect }),
        ...(isBehind === true ? { isBehind: true } : {}),
    };
}

/** This device's offset from UTC in hours, as the Time panel starts on. */
function getDeviceUtcOffset() {
    return -new Date().getTimezoneOffset() / 60;
}

export type AgentForegroundBaseType = {
    /** The line's own payload, when one is being CHANGED. */
    existing?: Record<string, unknown> | null;
    /** A line of the same widget whose look a NEW one borrows. */
    lookFrom?: Record<string, unknown> | null;
};

/**
 * The payload a foreground line stores, from what the assistant asked for.
 * A line being CHANGED keeps everything but the fields given, its look
 * included. A NEW one borrows the look (layer, transition, style) of
 * `lookFrom` -- the newest line of the same widget in the sheet, so a second
 * countdown looks like the first -- else has none of its own and takes the
 * screen's. `genId` makes a clock's id (a uuid, as the panel's).
 */
export function genAgentForegroundData(
    widget: unknown,
    fields: Record<string, unknown>,
    { existing = null, lookFrom = null }: AgentForegroundBaseType,
    genId: () => string,
): ResultType {
    if (checkIsPickedForegroundWidget(widget)) {
        return fail(
            `A "${widget}" line is one the person picks in the Foreground ` +
                'panel and drags into the presenting flow -- it cannot be ' +
                'added from words.',
        );
    }
    if (
        typeof widget !== 'string' ||
        !(AGENT_FLOW_FOREGROUND_WIDGETS as readonly string[]).includes(widget)
    ) {
        return fail(
            '`widget` is one of ' +
                `${AGENT_FLOW_FOREGROUND_WIDGETS.join(', ')}.`,
        );
    }
    const isNew = existing === null;
    const data: Record<string, unknown> = isNew
        ? pickForegroundLook(lookFrom)
        : { ...existing };
    if (widget === 'countdown') {
        if (fields.seconds !== undefined && fields.dateTime !== undefined) {
            return fail(
                'A countdown has a length (`seconds`) or a time to count ' +
                    'to (`dateTime`), never both.',
            );
        }
        if (fields.seconds !== undefined) {
            if (
                !checkIsPositiveNumber(fields.seconds) ||
                fields.seconds > MAX_DURATION_SECOND
            ) {
                return fail(
                    '`seconds` is the countdown length in seconds -- 300 is ' +
                        'five minutes -- up to a day.',
                );
            }
            // Written with the lead second every row carries, which every
            // reader of a row takes back off.
            data.durationSecond =
                Math.round(fields.seconds) + COUNTDOWN_LEAD_SECOND;
            delete data.dateTime;
        } else if (fields.dateTime !== undefined) {
            const date = new Date(String(fields.dateTime));
            if (
                typeof fields.dateTime !== 'string' ||
                Number.isNaN(date.getTime())
            ) {
                return fail(
                    '`dateTime` is a date and time to count to, such as ' +
                        '"2026-11-15T10:00".',
                );
            }
            data.dateTime = date.toJSON();
            delete data.durationSecond;
        } else if (isNew) {
            return fail(
                'Say how long the countdown runs, INSIDE `foreground`: ' +
                    '{widget: "countdown", seconds: 300} is five minutes; ' +
                    'or the time it counts to, as `dateTime`.',
            );
        }
        if (fields.autoStart !== undefined) {
            data.isAutoStart = fields.autoStart !== false;
        } else if (isNew) {
            data.isAutoStart = true;
        }
        return { data };
    }
    if (widget === 'stopwatch') {
        if (fields.autoStart !== undefined) {
            data.isAutoStart = fields.autoStart !== false;
        } else if (isNew) {
            data.isAutoStart = true;
        }
        return { data };
    }
    if (widget === 'time') {
        if (isNew) {
            data.id = genId();
        }
        if (fields.utcOffset !== undefined) {
            const offset = fields.utcOffset;
            if (
                typeof offset !== 'number' ||
                !Number.isFinite(offset) ||
                offset < -12 ||
                offset > 14
            ) {
                return fail(
                    '`utcOffset` is hours from UTC, -12 to 14 (7 is ' +
                        'Cambodia, -5 New York in winter).',
                );
            }
            data.timezoneMinuteOffset = offset;
        } else if (isNew) {
            data.timezoneMinuteOffset = getDeviceUtcOffset();
        }
        if (fields.title !== undefined) {
            data.title = checkIsTextField(fields.title)
                ? toCleanText(fields.title.trim()).slice(0, 80)
                : null;
        } else if (isNew) {
            data.title = null;
        }
        if (fields.is24Hour !== undefined) {
            data.is24HourFormat = fields.is24Hour === true;
        } else if (isNew) {
            data.is24HourFormat = false;
        }
        return { data };
    }
    if (widget === 'message') {
        if (fields.text !== undefined && fields.texts !== undefined) {
            return fail(
                'Give one message as `text`, or several shown in turn as ' +
                    '`texts`.',
            );
        }
        if (fields.text !== undefined) {
            if (!checkIsTextField(fields.text)) {
                return fail('`text` is the message, words and all.');
            }
            // One editor's message: its lines, never moving.
            data.textList = toCleanText(fields.text)
                .split(/\r?\n/)
                .map((line) => {
                    return line.trim();
                })
                .filter((line) => {
                    return line !== '';
                });
            data.intervalSecond = null;
        } else if (fields.texts !== undefined) {
            const textList = Array.isArray(fields.texts)
                ? fields.texts.filter(checkIsTextField).map((text) => {
                      return toCleanText(text.trim());
                  })
                : [];
            if (textList.length === 0 || textList.length > MAX_MESSAGE_COUNT) {
                return fail(
                    `\`texts\` is 1 to ${MAX_MESSAGE_COUNT} messages, each ` +
                        'shown in turn.',
                );
            }
            data.textList = textList;
            data.intervalSecond =
                textList.length > 1
                    ? checkIsPositiveNumber(fields.intervalSecond)
                        ? Math.round(fields.intervalSecond)
                        : 10
                    : null;
        } else if (isNew) {
            return fail('Say what the message says (`text`).');
        } else if (fields.intervalSecond !== undefined) {
            if (!checkIsPositiveNumber(fields.intervalSecond)) {
                return fail('`intervalSecond` is how long each message holds.');
            }
            data.intervalSecond = Math.round(fields.intervalSecond);
        }
        return { data };
    }
    if (widget === 'marquee-top' || widget === 'marquee-bottom') {
        if (fields.text !== undefined) {
            if (!checkIsTextField(fields.text)) {
                return fail('`text` is the words that scroll across.');
            }
            data.text = toCleanText(fields.text.replace(/\s*\r?\n\s*/g, ' '));
        } else if (isNew) {
            return fail('Say what scrolls across (`text`).');
        }
        if (fields.speed !== undefined) {
            if (
                typeof fields.speed !== 'number' ||
                fields.speed < MIN_SPEED ||
                fields.speed > MAX_SPEED
            ) {
                return fail(
                    `\`speed\` is ${MIN_SPEED} to ${MAX_SPEED}; 100 is the ` +
                        'normal pace, 200 twice as fast.',
                );
            }
            data.speedPercentage = Math.round(fields.speed);
        } else if (isNew) {
            data.speedPercentage = 100;
        }
        return { data };
    }
    // quick-text
    if (fields.text !== undefined) {
        if (!checkIsTextField(fields.text)) {
            return fail('`text` is the words, in markdown.');
        }
        data.markdownText = toCleanText(fields.text);
    } else if (isNew) {
        return fail('Say what the quick text says (`text`).');
    }
    if (fields.delaySecond !== undefined) {
        if (
            typeof fields.delaySecond !== 'number' ||
            !Number.isFinite(fields.delaySecond) ||
            fields.delaySecond < 0
        ) {
            return fail('`delaySecond` is seconds before it shows, 0 or more.');
        }
        data.timeSecondDelay = fields.delaySecond;
    } else if (isNew) {
        data.timeSecondDelay = QUICK_TEXT_DEFAULT_DELAY_SECOND;
    }
    if (fields.liveSecond !== undefined) {
        if (!checkIsPositiveNumber(fields.liveSecond)) {
            return fail('`liveSecond` is how many seconds it stays up.');
        }
        data.timeSecondToLive = fields.liveSecond;
        // Seconds asked for are how long it stays: no longer until hidden.
        delete data.isInfinite;
    } else if (isNew) {
        data.timeSecondToLive = QUICK_TEXT_DEFAULT_LIVE_SECOND;
    }
    return { data };
}
