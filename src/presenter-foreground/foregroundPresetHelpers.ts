import { getSetting, setSetting } from '../helper/settingHelpers';
import type { AppColorType } from '../others/color/colorHelpers';
import {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_TEXT_COLOR,
    genCommonStyleSettingNames,
    genDecorationSettingName,
    genPropsSettingNames,
} from './foregroundStyleSettingNames';
import {
    type ForegroundDecorationType,
    genDecorationDefault,
} from './foregroundDecorationHelpers';
import {
    type ForegroundColorModeType,
    checkIsForegroundColorMode,
    genForegroundContrastColors,
    toForegroundColorMode,
} from './foregroundContrastHelpers';
import {
    QUICK_TEXT_EXAMPLE_MAP,
    type QuickTextFormatType,
    checkIsQuickTextUntouched,
    fitQuickTextFontSize,
    formatQuickTextMarkdown,
    genQuickTextReadingSeconds,
} from './quickTextFormatHelpers';

/**
 * Presets: a whole LOOK made for one job, one press away in the Properties
 * block of every foreground component (2026-11-09, the user: _add quick text
 * properties preset for me for the use cases like bible verse, speaker, song
 * title, event session, ..._, then _add preset to all properties in all
 * foreground components_, _preset should be part of properties block_).
 *
 * A preset writes the settings the Properties block itself writes -- where
 * the box sits, its size, colours, frame and dressing -- and nothing the
 * operator chose for themselves: never the words, never the font (a face
 * picked for the language's script stays), never the transition or the
 * layer. Only the rows the component HAS are written (`flags`, exactly what
 * the panel hands `useForegroundPropsSetting`), so a marquee is never given a
 * place on the screen it does not take, nor a picture a text colour.
 *
 * Every preset with words goes on in Dark or Light (the same day, the user:
 * _all foreground properties preset should support dark/light mode_ ... _and
 * apply to the preset_): its colours are written for a dark slide, and on
 * the Light side they are put through `genForegroundContrastColors` -- the
 * box lighter, the words darker, each its own colour still. The side is
 * the one the session's words are on now, so a box turned Light stays Light
 * from one preset to the next.
 *
 * Sizes are screen pixels, like the boxes they land in.
 */

export type ForegroundPresetFlagsType = {
    isFontSize: boolean;
    isGeometry: boolean;
    isCommonStyle: boolean;
    /** Quick Text's Margin row: a preset sets its top / bottom margin too. */
    isMargin?: boolean;
};

export type ForegroundPresetIdType =
    | 'bible-verse'
    | 'speaker'
    | 'song-title'
    | 'sermon-title'
    | 'event-session'
    | 'announcement'
    | 'top-banner'
    | 'bottom-banner'
    | 'urgent-alert'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'center'
    | 'full-screen'
    | 'picture-in-picture';

type HorizontalAlignmentType = 'left' | 'center' | 'right';
type VerticalAlignmentType = 'start' | 'center' | 'end';

export type ForegroundPresetLookType = {
    widthPercentage?: number;
    horizontalAlignment?: HorizontalAlignmentType;
    verticalAlignment?: VerticalAlignmentType;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    roundSizePixel?: number;
    fontSize?: number;
    /** On the Dark side; the Light one is worked out from them. */
    color?: AppColorType;
    backgroundColor?: AppColorType;
    backdropFilter?: number;
    decoration?: Partial<ForegroundDecorationType>;
};

export type ForegroundPresetType = {
    id: ForegroundPresetIdType;
    /** A Bootstrap icon name, without its `bi-` prefix. */
    iconName: string;
    look: ForegroundPresetLookType;
    /**
     * The component's OWN settings a preset sets beside the look -- how long
     * a quick text stays, how fast a marquee runs -- for the session whose
     * key suffix this is.
     */
    genOwnWrites?: (suffix: string) => [string, string][];
};

// ------------------------------------------------------------- the looks

const WHITE: AppColorType = '#FFFFFF';

/**
 * A quick text preset sets how long it stays AND how its words are set
 * (`quickTextFormatHelpers`): the session's words, read as they are now,
 * written back in the preset's format -- every word kept.
 */
function genQuickTextOwnWrites({
    seconds,
    format,
    example,
    fit,
}: {
    /** Or worked out from the words the box will hold. */
    seconds: number | ((text: string) => number);
    format: QuickTextFormatType;
    /** Written when the box has nothing of the person's in it yet. */
    example: string;
    fit?: { base: number; min: number };
}) {
    return (suffix: string): [string, string][] => {
        const textKey = `foreground-quick-text-setting${suffix}`;
        const current = getSetting(textKey);
        const text = checkIsQuickTextUntouched(current) ? example : current!;
        const liveSeconds =
            typeof seconds === 'number' ? seconds : seconds(text);
        const writes: [string, string][] = [
            [`foreground-quick-text-time-to-live${suffix}`, `${liveSeconds}`],
            [textKey, formatQuickTextMarkdown(text, format)],
        ];
        if (fit !== undefined) {
            // After the look's own size: a long passage is set smaller.
            writes.push([
                `quick-text${suffix}-setting-show-widget-font-size`,
                `${fitQuickTextFontSize(text, fit.base, fit.min)}`,
            ]);
        }
        return writes;
    };
}

const BIBLE_VERSE_LOOK: ForegroundPresetLookType = {
    // A band across the bottom, edge to edge, long enough to be read aloud,
    // its words set left: the user's own Matthew 3:3-5 session, taken as the
    // default (2026-11-09, _bible preset: text 45px, align left with full_).
    widthPercentage: 100,
    horizontalAlignment: 'center',
    verticalAlignment: 'end',
    offsetX: 0,
    // Flush on the bottom edge: no gap under the band (the user).
    offsetY: 0,
    roundSizePixel: 16,
    fontSize: 45,
    color: WHITE,
    backgroundColor: '#000000B3',
    backdropFilter: 6,
    decoration: {
        shadow: 'soft',
        padding: 1,
        textAlign: 'left',
        lineHeight: 1.35,
        textShadow: 'soft',
    },
};

const SPEAKER_LOOK: ForegroundPresetLookType = {
    // A name tag, bottom left, clear of a centred verse or lyric.
    widthPercentage: 40,
    horizontalAlignment: 'left',
    verticalAlignment: 'end',
    offsetX: 60,
    offsetY: 70,
    roundSizePixel: 8,
    fontSize: 40,
    color: WHITE,
    backgroundColor: '#1D4ED8E6',
    backdropFilter: 0,
    decoration: { shadow: 'medium', padding: 0.5, textAlign: 'left' },
};

const SONG_TITLE_LOOK: ForegroundPresetLookType = {
    // A quiet corner label: the song is the slide, this only names it.
    widthPercentage: 45,
    horizontalAlignment: 'left',
    verticalAlignment: 'start',
    offsetX: 60,
    offsetY: 50,
    roundSizePixel: 10,
    fontSize: 34,
    color: WHITE,
    backgroundColor: '#00000099',
    backdropFilter: 6,
    decoration: { shadow: 'soft', padding: 0.45, textAlign: 'left' },
};

const SERMON_TITLE_LOOK: ForegroundPresetLookType = {
    // The middle of the screen, large, for the moment the sermon starts.
    widthPercentage: 75,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    offsetX: 0,
    offsetY: 0,
    roundSizePixel: 20,
    fontSize: 64,
    color: WHITE,
    backgroundColor: '#0F172ACC',
    backdropFilter: 8,
    decoration: {
        shadow: 'strong',
        padding: 0.7,
        textAlign: 'center',
        letterSpacing: 0.02,
        textShadow: 'soft',
    },
};

const EVENT_SESSION_LOOK: ForegroundPresetLookType = {
    // A banner across the top: what part of the day this is.
    widthPercentage: 70,
    horizontalAlignment: 'center',
    verticalAlignment: 'start',
    offsetX: 0,
    offsetY: 40,
    roundSizePixel: 12,
    fontSize: 40,
    color: WHITE,
    backgroundColor: '#0F766EE6',
    backdropFilter: 0,
    decoration: {
        shadow: 'medium',
        padding: 0.5,
        textAlign: 'center',
        letterSpacing: 0.08,
        isUppercase: true,
    },
};

const ANNOUNCEMENT_LOOK: ForegroundPresetLookType = {
    // A notice nobody can miss, framed, in the middle.
    widthPercentage: 80,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    offsetX: 0,
    offsetY: 0,
    roundSizePixel: 16,
    fontSize: 52,
    color: WHITE,
    backgroundColor: '#B45309E6',
    backdropFilter: 0,
    decoration: {
        borderStyle: 'solid',
        borderWidth: 3,
        borderColor: '#FFFFFFB3',
        shadow: 'strong',
        padding: 0.7,
        textAlign: 'center',
    },
};

function genBannerLook(
    verticalAlignment: VerticalAlignmentType,
): ForegroundPresetLookType {
    // Edge to edge, square, flush with the screen's edge.
    return {
        widthPercentage: 100,
        horizontalAlignment: 'center',
        verticalAlignment,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        roundSizePixel: 0,
        fontSize: 44,
        color: WHITE,
        backgroundColor: '#000000CC',
        backdropFilter: 6,
        decoration: { shadow: 'none', padding: 0.5, textAlign: 'center' },
    };
}

/**
 * A small box in a corner -- a timer or a clock. Its size is the FONT, set
 * here like every preset's: left as it was, a clock kept the panel's 100px
 * default and its digits ran out of a 22% box (2026-11-09, the user's
 * picture of the Time's Bottom Right: _the preset set shorter width, make
 * sure all preset define well styling_). The width is what 40px digits take
 * on a 1920px screen, with room; on a smaller screen the box still never
 * draws narrower than its digits (`genHtmlForegroundTime`).
 */
function genCornerLook(
    horizontalAlignment: HorizontalAlignmentType,
    verticalAlignment: VerticalAlignmentType,
    widthPercentage: number,
): ForegroundPresetLookType {
    return {
        widthPercentage,
        horizontalAlignment,
        verticalAlignment,
        offsetX: 40,
        offsetY: 40,
        scale: 1,
        roundSizePixel: 12,
        fontSize: 40,
        color: WHITE,
        backgroundColor: '#000000B3',
        backdropFilter: 6,
        decoration: { shadow: 'medium', padding: 0.3, textAlign: 'center' },
    };
}

const BIG_CENTER_LOOK: ForegroundPresetLookType = {
    // Large in the middle: a countdown to the start, the time for everyone.
    // Large by its font, not by `scale`: scaled up, the digits were drawn
    // small and stretched, and the box grew past the width it was given.
    widthPercentage: 60,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    roundSizePixel: 24,
    fontSize: 120,
    color: WHITE,
    backgroundColor: '#0F172ACC',
    backdropFilter: 8,
    decoration: { shadow: 'strong', padding: 0.4, textAlign: 'center' },
};

const FULL_SCREEN_LOOK: ForegroundPresetLookType = {
    widthPercentage: 100,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    roundSizePixel: 0,
    decoration: { shadow: 'none', borderStyle: 'none' },
};

const PICTURE_IN_PICTURE_LOOK: ForegroundPresetLookType = {
    // A third of the width, bottom right, lifted off the slide.
    widthPercentage: 30,
    horizontalAlignment: 'right',
    verticalAlignment: 'end',
    offsetX: 40,
    offsetY: 40,
    scale: 1,
    roundSizePixel: 12,
    decoration: { shadow: 'strong', borderStyle: 'none' },
};

const LOGO_CORNER_LOOK: ForegroundPresetLookType = {
    // Small, top right, no shadow: a logo or a live badge.
    widthPercentage: 14,
    horizontalAlignment: 'right',
    verticalAlignment: 'start',
    offsetX: 30,
    offsetY: 30,
    scale: 1,
    roundSizePixel: 8,
    decoration: { shadow: 'none', borderStyle: 'none' },
};

const PICTURE_CENTER_LOOK: ForegroundPresetLookType = {
    widthPercentage: 60,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    roundSizePixel: 16,
    decoration: { shadow: 'strong', borderStyle: 'none' },
};

function genMarqueeSpeedWrites(target: string, speedPercentage: number) {
    return (suffix: string): [string, string][] => {
        return [
            [
                `foreground-${target}-speed-percentage${suffix}`,
                `${speedPercentage}`,
            ],
        ];
    };
}

function genMarqueePresets(target: string): ForegroundPresetType[] {
    // A marquee is a band of the screen's width: only its colours, frame
    // and speed are its own to change. It had Dark and Light presets of its
    // own; every preset has both sides now, so they became the switch.
    return [
        {
            id: 'announcement',
            iconName: 'megaphone',
            look: {
                roundSizePixel: 0,
                color: WHITE,
                backgroundColor: '#000000CC',
                backdropFilter: 6,
                decoration: { shadow: 'none', borderStyle: 'none' },
            },
            genOwnWrites: genMarqueeSpeedWrites(target, 100),
        },
        {
            // Slower, so a verse can be read as it goes by.
            id: 'bible-verse',
            iconName: 'book',
            look: {
                roundSizePixel: 0,
                color: WHITE,
                backgroundColor: '#0F172AD9',
                backdropFilter: 6,
                decoration: {
                    shadow: 'none',
                    borderStyle: 'none',
                    textShadow: 'soft',
                },
            },
            genOwnWrites: genMarqueeSpeedWrites(target, 70),
        },
        {
            id: 'urgent-alert',
            iconName: 'exclamation-triangle',
            look: {
                roundSizePixel: 0,
                color: WHITE,
                backgroundColor: '#B91C1CF2',
                backdropFilter: 0,
                decoration: {
                    shadow: 'medium',
                    borderStyle: 'none',
                    isUppercase: true,
                },
            },
            genOwnWrites: genMarqueeSpeedWrites(target, 130),
        },
    ];
}

const TIMER_PRESET_LIST: readonly ForegroundPresetType[] = [
    {
        id: 'top-right',
        iconName: 'arrow-up-right-square',
        look: genCornerLook('right', 'start', 22),
    },
    {
        id: 'bottom-right',
        iconName: 'arrow-down-right-square',
        look: genCornerLook('right', 'end', 22),
    },
    { id: 'center', iconName: 'bullseye', look: BIG_CENTER_LOOK },
    {
        id: 'bottom-banner',
        iconName: 'layout-text-window-reverse',
        look: genBannerLook('end'),
    },
];

const PICTURE_PRESET_LIST: readonly ForegroundPresetType[] = [
    { id: 'full-screen', iconName: 'fullscreen', look: FULL_SCREEN_LOOK },
    {
        id: 'picture-in-picture',
        iconName: 'pip',
        look: PICTURE_IN_PICTURE_LOOK,
    },
    { id: 'center', iconName: 'bullseye', look: PICTURE_CENTER_LOOK },
    {
        id: 'top-right',
        iconName: 'arrow-up-right-square',
        look: LOGO_CORNER_LOOK,
    },
];

/** The presets of each foreground component, by its widget key. */
export const FOREGROUND_PRESET_MAP: Readonly<
    Record<string, readonly ForegroundPresetType[]>
> = {
    'quick-text': [
        {
            id: 'bible-verse',
            iconName: 'book',
            look: BIBLE_VERSE_LOOK,
            genOwnWrites: genQuickTextOwnWrites({
                // As long as the passage takes to read aloud.
                seconds: genQuickTextReadingSeconds,
                // The reference as a `### ` heading (the user, 2026-11-09).
                format: { title: 'h3', isBodyItalic: false },
                example: QUICK_TEXT_EXAMPLE_MAP['bible-verse'],
                fit: { base: 45, min: 28 },
            }),
        },
        {
            id: 'speaker',
            iconName: 'person-badge',
            look: SPEAKER_LOOK,
            genOwnWrites: genQuickTextOwnWrites({
                seconds: 10,
                format: { title: 'h3', isBodyItalic: false },
                example: QUICK_TEXT_EXAMPLE_MAP['speaker'],
            }),
        },
        {
            id: 'song-title',
            iconName: 'music-note-beamed',
            look: SONG_TITLE_LOOK,
            genOwnWrites: genQuickTextOwnWrites({
                seconds: 8,
                format: { title: 'bold', isBodyItalic: true },
                example: QUICK_TEXT_EXAMPLE_MAP['song-title'],
            }),
        },
        {
            id: 'sermon-title',
            iconName: 'mic',
            look: SERMON_TITLE_LOOK,
            genOwnWrites: genQuickTextOwnWrites({
                seconds: 10,
                format: { title: 'h2', isBodyItalic: true },
                example: QUICK_TEXT_EXAMPLE_MAP['sermon-title'],
            }),
        },
        {
            id: 'event-session',
            iconName: 'calendar-event',
            look: EVENT_SESSION_LOOK,
            genOwnWrites: genQuickTextOwnWrites({
                seconds: 10,
                format: { title: 'h3', isBodyItalic: false },
                example: QUICK_TEXT_EXAMPLE_MAP['event-session'],
            }),
        },
        {
            id: 'announcement',
            iconName: 'megaphone',
            look: ANNOUNCEMENT_LOOK,
            genOwnWrites: genQuickTextOwnWrites({
                seconds: 12,
                format: { title: 'h2', isBodyItalic: false },
                example: QUICK_TEXT_EXAMPLE_MAP['announcement'],
            }),
        },
    ],
    message: [
        { id: 'announcement', iconName: 'megaphone', look: ANNOUNCEMENT_LOOK },
        {
            id: 'event-session',
            iconName: 'calendar-event',
            look: EVENT_SESSION_LOOK,
        },
        {
            id: 'top-banner',
            iconName: 'layout-text-window',
            look: genBannerLook('start'),
        },
        {
            id: 'bottom-banner',
            iconName: 'layout-text-window-reverse',
            look: genBannerLook('end'),
        },
    ],
    'marquee-top': genMarqueePresets('marquee-top'),
    'marquee-bottom': genMarqueePresets('marquee-bottom'),
    countdown: TIMER_PRESET_LIST,
    stopwatch: TIMER_PRESET_LIST,
    time: [
        {
            id: 'top-left',
            iconName: 'arrow-up-left-square',
            look: genCornerLook('left', 'start', 22),
        },
        {
            id: 'top-right',
            iconName: 'arrow-up-right-square',
            look: genCornerLook('right', 'start', 22),
        },
        {
            id: 'bottom-right',
            iconName: 'arrow-down-right-square',
            look: genCornerLook('right', 'end', 22),
        },
        { id: 'center', iconName: 'bullseye', look: BIG_CENTER_LOOK },
    ],
    video: PICTURE_PRESET_LIST,
    image: PICTURE_PRESET_LIST,
    web: PICTURE_PRESET_LIST,
    screen: PICTURE_PRESET_LIST,
    camera: [
        { id: 'full-screen', iconName: 'fullscreen', look: FULL_SCREEN_LOOK },
        {
            id: 'picture-in-picture',
            iconName: 'pip',
            look: PICTURE_IN_PICTURE_LOOK,
        },
        {
            id: 'bottom-left',
            iconName: 'arrow-down-left-square',
            look: { ...PICTURE_IN_PICTURE_LOOK, horizontalAlignment: 'left' },
        },
    ],
};

export function getForegroundPresetList(widgetKey: string) {
    return FOREGROUND_PRESET_MAP[widgetKey] ?? [];
}

export function getForegroundPreset(
    widgetKey: string,
    presetId: ForegroundPresetIdType,
) {
    return getForegroundPresetList(widgetKey).find((preset) => {
        return preset.id === presetId;
    });
}

/**
 * The key suffix of the session a prefix belongs to: `quick-text-s1x` is
 * session `-s1x` of `quick-text`. A prefix that is not the widget's own (a
 * clock's `time-<id>`) has none -- such a component sets nothing of its own.
 */
export function toPresetSessionSuffix(widgetKey: string, prefix: string) {
    return prefix.startsWith(widgetKey) ? prefix.slice(widgetKey.length) : '';
}

export type ForegroundColorPairType = {
    color: string;
    backgroundColor: string;
};

/**
 * A session's words' and box's colours, as its Properties draw them: an
 * unset one is `defaultColors`' -- the app theme's side, handed in by a
 * caller that knows the theme (`getForegroundDefaultColors`), else the dark.
 */
export function readForegroundSessionColors(
    prefix: string,
    defaultColors: ForegroundColorPairType = {
        color: DEFAULT_TEXT_COLOR,
        backgroundColor: DEFAULT_BACKGROUND_COLOR,
    },
) {
    const names = genCommonStyleSettingNames(prefix);
    return {
        color: getSetting(names.color) || defaultColors.color,
        backgroundColor:
            getSetting(names.backgroundColor) || defaultColors.backgroundColor,
    };
}

/** A preset's words' and box's colours on one side; null for a picture's. */
export function genForegroundPresetColors(
    preset: ForegroundPresetType,
    mode: ForegroundColorModeType,
) {
    const { color, backgroundColor } = preset.look;
    if (color === undefined || backgroundColor === undefined) {
        return null;
    }
    return genForegroundContrastColors({ color, backgroundColor }, mode);
}

function writeValue(key: string, value: number | string | undefined) {
    if (value !== undefined) {
        setSetting(key, `${value}`);
    }
}

/**
 * Writes a preset over ONE session's look (the keys `prefix` files), and
 * its own extras, on `mode`'s side -- else the side the session's words are
 * on now, an unset colour read as `defaultColors`. Every value goes in at
 * once and synchronously, so the caller can restyle what is showing and
 * remount the panel straight after.
 */
export function applyForegroundPreset({
    widgetKey,
    prefix,
    flags,
    preset,
    mode,
    defaultColors,
}: {
    widgetKey: string;
    prefix: string;
    flags: ForegroundPresetFlagsType;
    preset: ForegroundPresetType;
    mode?: ForegroundColorModeType;
    defaultColors?: ForegroundColorPairType;
}) {
    const { look } = preset;
    const names = genPropsSettingNames(prefix);
    if (flags.isGeometry) {
        if (flags.isMargin) {
            // The whole look: no margin of an earlier one left under it.
            writeValue(names.marginVerticalPercentage, 0);
        }
        writeValue(names.widthPercentage, look.widthPercentage);
        writeValue(names.scale, look.scale ?? 1);
        writeValue(names.opacityPercentage, 100);
        if (
            look.horizontalAlignment !== undefined ||
            look.verticalAlignment !== undefined
        ) {
            setSetting(
                names.alignment,
                JSON.stringify({
                    horizontalAlignment: look.horizontalAlignment ?? 'center',
                    verticalAlignment: look.verticalAlignment ?? 'center',
                }),
            );
        }
        writeValue(names.offsetX, look.offsetX);
        writeValue(names.offsetY, look.offsetY);
    }
    writeValue(names.roundSizePixel, look.roundSizePixel);
    if (flags.isFontSize) {
        writeValue(names.fontSize, look.fontSize);
    }
    if (flags.isCommonStyle) {
        const commonNames = genCommonStyleSettingNames(prefix);
        // Read BEFORE the write: the side the session is on is its words'.
        const side =
            mode ??
            toForegroundColorMode(
                readForegroundSessionColors(prefix, defaultColors).color,
            );
        const colors = genForegroundPresetColors(preset, side);
        writeValue(commonNames.color, colors?.color);
        writeValue(commonNames.backgroundColor, colors?.backgroundColor);
        writeValue(commonNames.backdropFilter, look.backdropFilter);
    }
    if (look.decoration !== undefined) {
        setSetting(
            genDecorationSettingName(prefix),
            JSON.stringify({
                ...genDecorationDefault(flags.isCommonStyle),
                ...look.decoration,
            }),
        );
    }
    const suffix = toPresetSessionSuffix(widgetKey, prefix);
    for (const [key, value] of preset.genOwnWrites?.(suffix) ?? []) {
        setSetting(key, value);
    }
}

/**
 * The Dark / Light switch, for a session no panel holds (the help window's
 * assistant): the session's own words and box made lighter or darker until
 * they contrast (`genForegroundContrastColors`). True when a colour moved.
 */
export function applyForegroundColorMode(
    prefix: string,
    mode: ForegroundColorModeType,
    defaultColors?: ForegroundColorPairType,
) {
    const current = readForegroundSessionColors(prefix, defaultColors);
    const next = genForegroundContrastColors(current, mode);
    const names = genCommonStyleSettingNames(prefix);
    let isChanged = false;
    if (next.color !== current.color) {
        setSetting(names.color, next.color);
        isChanged = true;
    }
    if (next.backgroundColor !== current.backgroundColor) {
        setSetting(names.backgroundColor, next.backgroundColor);
        isChanged = true;
    }
    return isChanged;
}

/**
 * A preset asked for in words (the help window's assistant): an id, with
 * its side before or after it (`speaker light`, `dark top-right`), or a
 * side alone (`light`) to turn the session's colours to it. Spaces stand
 * for the dashes of an id (`bible verse`). Null when it names neither a
 * preset of this component nor a side.
 */
export function readForegroundPresetAsk(
    widgetKey: string,
    text: string,
): {
    preset: ForegroundPresetType | null;
    mode: ForegroundColorModeType | null;
} | null {
    const wordList = text
        .toLowerCase()
        .trim()
        .split(/[\s:_,/]+/)
        .filter((word) => {
            return word !== '';
        });
    while (
        wordList.length > 0 &&
        ['mode', 'side', 'look'].includes(wordList.at(-1)!)
    ) {
        wordList.pop();
    }
    let mode: ForegroundColorModeType | null = null;
    const first = wordList[0];
    const last = wordList.at(-1);
    if (checkIsForegroundColorMode(first)) {
        mode = first;
        wordList.shift();
    } else if (checkIsForegroundColorMode(last)) {
        mode = last;
        wordList.pop();
    }
    let id = wordList.join('-');
    const glued = /^(.+)-(dark|light)$/.exec(id);
    if (mode === null && glued !== null) {
        id = glued[1];
        mode = glued[2] as ForegroundColorModeType;
    }
    if (id === '') {
        return mode === null ? null : { preset: null, mode };
    }
    const preset = getForegroundPreset(widgetKey, id as ForegroundPresetIdType);
    return preset === undefined ? null : { preset, mode };
}
