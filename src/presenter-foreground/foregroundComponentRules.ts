import { dirSourceSettingNames } from '../helper/constants';
import type { ForegroundComponentKeyType } from './foregroundComponentKeys';
import { genStopwatchHistorySettingName } from './stopwatchHistoryHelpers';

/**
 * What each foreground component keeps, said ONCE: where its Properties are
 * filed, which of the shared Properties rows it has, and the settings one of
 * its sessions owns beyond them.
 *
 * Each panel used to spell these out for itself, and that was fine while a
 * panel was the only thing that ever wrote a session. The help window's
 * assistant writes them too now (2026-11-09: _chatbot can help modify any
 * foreground component_), and a key the assistant spelled one way and the
 * panel another would be a change the panel never shows -- or a quick text
 * that comes up in a different size from the one its panel would put up. So
 * the panels read their flags and their keys from here, and so does the
 * assistant's worker (`agentForegroundHelpers.ts`).
 *
 * Pure: settings NAMES only, no setting read, no React.
 */

/** The four switches `useForegroundPropsSetting` takes. */
export type ForegroundPropsFlagsType = {
    /** The Properties panel's own Font Size row. */
    isFontSize: boolean;
    /** Position, width, scale and opacity. */
    isGeometry: boolean;
    /** Font, weight, text and backing colours, blur. */
    isCommonStyle: boolean;
    /** The blend-mode picker (the widgets that put up a picture). */
    isBlendMode: boolean;
    /**
     * Margins in place of Width (Quick Text): the side margins are the
     * width, and a top or bottom margin in % of the screen's height.
     */
    isMargin?: boolean;
};

export type ForegroundComponentRuleType = {
    /**
     * Whether the panel keeps a sessions strip. Camera Show and Screen Show do
     * not: their Properties belong to each device or each source screen.
     */
    hasSessions: boolean;
    /**
     * The Properties prefix of ONE session. Absent where the Properties belong
     * to an item instead -- a clock, a camera, a screen -- or where there are
     * none (Long Text Show).
     */
    toSessionPrefix?: (suffix: string) => string;
    /** The Properties prefix of one item: `time-<id>`, `camera-<id>`. */
    toItemPrefix?: (itemId: string) => string;
    /** Absent for Long Text Show, which has no Properties at all. */
    flags?: ForegroundPropsFlagsType;
    /** The settings a session owns beyond its Properties. */
    toOwnSettingNames: (suffix: string) => string[];
};

const TEXT_FLAGS: ForegroundPropsFlagsType = {
    isFontSize: true,
    isGeometry: true,
    isCommonStyle: true,
    isBlendMode: false,
};

// A marquee is a band across the whole screen: no place to move it to, and
// its own Font Size row (0 = fit the band) instead of the Properties one.
const MARQUEE_FLAGS: ForegroundPropsFlagsType = {
    isFontSize: false,
    isGeometry: false,
    isCommonStyle: true,
    isBlendMode: false,
};

// A clock's Font Size row is its own panel's (`ForegroundTimeComp` has had
// it from the start); this said it had none, so the assistant and the
// presets left a clock at the 100px default, wider than its box.
const CLOCK_FLAGS: ForegroundPropsFlagsType = {
    isFontSize: true,
    isGeometry: true,
    isCommonStyle: true,
    isBlendMode: false,
};

// A clip, a picture, a page or another screen has no words of its own: no
// font or colour rows, and the blend mode is the point of the widget.
const PICTURE_FLAGS: ForegroundPropsFlagsType = {
    isFontSize: false,
    isGeometry: true,
    isCommonStyle: false,
    isBlendMode: true,
};

// The camera keeps the text rows: a talking head shown with a tinted backing
// is what the panel has always done.
const CAMERA_FLAGS: ForegroundPropsFlagsType = {
    isFontSize: false,
    isGeometry: true,
    isCommonStyle: true,
    isBlendMode: true,
};

function genMarqueeOwnSettingNames(target: string, suffix: string) {
    return [
        `foreground-${target}-setting${suffix}`,
        `foreground-${target}-font-size${suffix}`,
        `foreground-${target}-speed-percentage${suffix}`,
    ];
}

function genMediaRule(
    kind: 'video' | 'image' | 'web',
    dirSettingName: string,
): ForegroundComponentRuleType {
    return {
        hasSessions: true,
        toSessionPrefix: (suffix) => {
            return `${kind}-show${suffix}`;
        },
        flags: PICTURE_FLAGS,
        toOwnSettingNames: (suffix) => {
            return [`${dirSettingName}${suffix}`];
        },
    };
}

export const FOREGROUND_COMPONENT_RULE_MAP: Record<
    ForegroundComponentKeyType,
    ForegroundComponentRuleType
> = {
    message: {
        hasSessions: true,
        toSessionPrefix: (suffix) => {
            return `message${suffix}`;
        },
        flags: TEXT_FLAGS,
        toOwnSettingNames: (suffix) => {
            return [
                `foreground-message-setting${suffix}`,
                `foreground-message-is-rotating${suffix}`,
                `foreground-message-interval${suffix}`,
            ];
        },
    },
    'marquee-top': {
        hasSessions: true,
        toSessionPrefix: (suffix) => {
            return `marquee-top${suffix}`;
        },
        flags: MARQUEE_FLAGS,
        toOwnSettingNames: (suffix) => {
            return genMarqueeOwnSettingNames('marquee-top', suffix);
        },
    },
    'marquee-bottom': {
        hasSessions: true,
        toSessionPrefix: (suffix) => {
            return `marquee-bottom${suffix}`;
        },
        flags: MARQUEE_FLAGS,
        toOwnSettingNames: (suffix) => {
            return genMarqueeOwnSettingNames('marquee-bottom', suffix);
        },
    },
    'quick-text': {
        hasSessions: true,
        toSessionPrefix: (suffix) => {
            return `quick-text${suffix}`;
        },
        flags: { ...TEXT_FLAGS, isMargin: true },
        toOwnSettingNames: (suffix) => {
            return [
                `foreground-quick-text-setting${suffix}`,
                `foreground-quick-text-time-delay${suffix}`,
                `foreground-quick-text-time-to-live${suffix}`,
            ];
        },
    },
    'long-text': {
        hasSessions: true,
        toOwnSettingNames: (suffix) => {
            return [`long-text-setting${suffix}`];
        },
    },
    countdown: {
        hasSessions: true,
        toSessionPrefix: (suffix) => {
            return `countdown${suffix}`;
        },
        flags: TEXT_FLAGS,
        // The names this widget has always written (`foreground-date`, not
        // `foreground-countdown-date`): the Default session's suffix is the
        // empty string, and renaming them would lose every countdown already
        // set up.
        toOwnSettingNames: (suffix) => {
            return [
                `foreground-date-setting${suffix}`,
                `foreground-time-setting${suffix}`,
                `foreground-hours-setting${suffix}`,
                `foreground-minutes-setting${suffix}`,
                `foreground-seconds-setting${suffix}`,
                `foreground-countdown-auto-start-setting${suffix}`,
            ];
        },
    },
    stopwatch: {
        hasSessions: true,
        toSessionPrefix: (suffix) => {
            return `stopwatch${suffix}`;
        },
        flags: TEXT_FLAGS,
        toOwnSettingNames: (suffix) => {
            return [
                `foreground-stopwatch-auto-start-setting${suffix}`,
                genStopwatchHistorySettingName(suffix),
            ];
        },
    },
    time: {
        hasSessions: true,
        toItemPrefix: (clockId) => {
            return `time-${clockId}`;
        },
        flags: CLOCK_FLAGS,
        // The clocks' own keys are swept by the panel, which knows the list.
        toOwnSettingNames: (suffix) => {
            return [toClockIdListSettingName(suffix)];
        },
    },
    video: genMediaRule('video', dirSourceSettingNames.FOREGROUND_VIDEO),
    image: genMediaRule('image', dirSourceSettingNames.FOREGROUND_IMAGE),
    // The same folder the Background Webs tab lists: a page put up is the
    // same page whichever layer it lands on.
    web: genMediaRule('web', dirSourceSettingNames.BACKGROUND_WEB),
    camera: {
        hasSessions: false,
        toItemPrefix: (deviceId) => {
            return `camera-${deviceId}`;
        },
        flags: CAMERA_FLAGS,
        toOwnSettingNames: () => {
            return [];
        },
    },
    screen: {
        hasSessions: false,
        // `screen-show-`, never `screen-`: those keys belong to the screen
        // that OWNS them and are swept when that screen is deleted.
        toItemPrefix: (screenId) => {
            return `screen-show-${screenId}`;
        },
        flags: PICTURE_FLAGS,
        toOwnSettingNames: () => {
            return [];
        },
    },
};

/**
 * The sessions strip of a foreground component. `foreground-<key>`, never the
 * bare key: `image` is both Image Show and the Background Images tab, and the
 * two must not share a list. `foregroundSessionHelpers` re-exports it.
 */
export function toForegroundSessionsTarget(widgetKey: string) {
    return `foreground-${widgetKey}`;
}

/** Where one session's clocks are listed (a JSON list of clock ids). */
export function toClockIdListSettingName(suffix: string) {
    return `foreground-time-id-list${suffix}`;
}

/** Every setting ONE clock owns beyond its Properties. */
export function genClockOwnSettingNames(clockId: string) {
    return {
        cityName: `foreground-city-name-setting-${clockId}`,
        hourOffset: `foreground-timezone-minute-offset-setting-${clockId}`,
        zoneName: `foreground-timezone-name-setting-${clockId}`,
        is24HourFormat: `foreground-time-is-24-hour-format-setting-${clockId}`,
    };
}

/** The panel's flags for a component (Long Text Show has none). */
export function getForegroundPropsFlags(key: ForegroundComponentKeyType) {
    return FOREGROUND_COMPONENT_RULE_MAP[key].flags ?? null;
}

export function genForegroundOwnSettingNames(
    key: ForegroundComponentKeyType,
    suffix: string,
) {
    return FOREGROUND_COMPONENT_RULE_MAP[key].toOwnSettingNames(suffix);
}
