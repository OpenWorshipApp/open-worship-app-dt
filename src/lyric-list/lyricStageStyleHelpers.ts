import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';

/**
 * How ONE stage renders its slides.
 *
 * Margin, opacity, font boost and theme used to be four hard-coded fields on
 * `LyricAppDocument` that nothing ever assigned, so every song on every stage
 * came out looking the same. They live here instead so the Stage
 * Previewer's gear panel can change them, and so the SCREEN window can read
 * them — it builds stage documents on demand, with no previewer component
 * mounted, exactly like `getOpenLyricFontSetting`.
 *
 * This module must stay a LEAF: `LyricAppDocument` imports it, and
 * `LyricAppDocument` is the bottom of the
 * `lyricHelpers -> LyricAppDocumentStage0 -> LyricAppDocumentStageAbstract ->
 * LyricAppDocument` cycle. Importing anything from `./` here closes that cycle
 * and kills the stage classes with "Cannot access 'LyricAppDocument' before
 * initialization". `../helper/settingHelpers` is the only value import allowed.
 */
export type LyricStageBoxVerticalAlignmentType = 'start' | 'center' | 'end';
export type LyricStageBoxHorizontalAlignmentType = 'left' | 'center' | 'right';
const BOX_VERTICAL_ALIGNMENT_LIST: readonly string[] = [
    'start',
    'center',
    'end',
];
const BOX_HORIZONTAL_ALIGNMENT_LIST: readonly string[] = [
    'left',
    'center',
    'right',
];

export type LyricStageStyleType = {
    // The slide's margin: how much of the display's WIDTH (horizontal) and
    // HEIGHT (vertical) is left outside the lyric box, both sides together —
    // 0 is a box as big as the slide, 99 a box 1% of it, so every value of
    // the 0-99 slider is a box. A share of the axis rather than a side
    // measured on the width (what the single `paddingPercentage` of "Slide
    // Padding" was), since a side of more than half the height left no box.
    marginHorizontalPercentage: number;
    marginVerticalPercentage: number;
    // Linked, moving one slider moves the other to the same value.
    isMarginLinked: boolean;
    // Where the lyric BOX sits on the slide: one of the Position pad's nine
    // cells, always one. The margins give the box its size; this only moves
    // it. Middle center (the default) is a margin on every side, as it has
    // always been; any other cell slides the same box until it touches the
    // edge(s) the cell names (see `LyricAppDocument.canvasItemBounds`).
    boxVerticalAlignment: LyricStageBoxVerticalAlignmentType;
    boxHorizontalAlignment: LyricStageBoxHorizontalAlignmentType;
    // Stored as an INTEGER percentage rather than the 0..1 open-lyric wants:
    // `AppRangeComp` parses its own input with `parseInt` whatever `step` says,
    // so a fractional slider value cannot survive a drag anyway. See
    // `toOpenLyricBackgroundAlpha`.
    backgroundAlphaPercentage: number;
    extraFontSize: number;
    theme: 'light' | 'dark';
    customCss: string;
};

export type LyricStageStyleRangeType = {
    min: number;
    max: number;
    step: number;
};

// The values the four fields were hard-coded to. The margin's 2 is the old
// 1% a side: exactly that across, and on a 16:9 screen a little less down
// (2% of the height where it was 3.6%), which a linked pair has to give up.
export const LYRIC_STAGE_STYLE_DEFAULT: Readonly<LyricStageStyleType> = {
    marginHorizontalPercentage: 2,
    marginVerticalPercentage: 2,
    isMarginLinked: true,
    boxVerticalAlignment: 'center',
    boxHorizontalAlignment: 'center',
    backgroundAlphaPercentage: 50,
    extraFontSize: 45,
    theme: 'light',
    customCss: '',
};

// Every range is integer-stepped ON PURPOSE — `AppRangeComp` rounds with
// `parseInt`, so a `step` below 1 would render a slider whose value silently
// snaps. A finer knob needs a different control, not a smaller step here.
export const LYRIC_STAGE_STYLE_RANGES: Readonly<{
    marginHorizontalPercentage: LyricStageStyleRangeType;
    marginVerticalPercentage: LyricStageStyleRangeType;
    backgroundAlphaPercentage: LyricStageStyleRangeType;
    extraFontSize: LyricStageStyleRangeType;
}> = {
    marginHorizontalPercentage: { min: 0, max: 99, step: 1 },
    marginVerticalPercentage: { min: 0, max: 99, step: 1 },
    backgroundAlphaPercentage: { min: 0, max: 100, step: 1 },
    extraFontSize: { min: 0, max: 200, step: 1 },
};

/**
 * One setting per STAGE, holding the whole record — not one setting per field.
 *
 * Settings are files, and on the screen window `CacheManager.setSync` is a
 * no-op, so every `getSetting` there is a real `fsExistSync` + `fsReadSync`.
 * A key per field would be over a dozen syscalls per options build on the
 * renderer that has to stay the fastest; one blob is two. It also makes a
 * slider commit a single write — linked margins move two fields at once — so
 * a crash mid-drag cannot leave a torn record.
 *
 * Deliberately NOT prefixed with `getSettingPrefix()`: the reader page would
 * then read `reader-lyric-stage-style-0` while the presenter and the screen
 * read the unprefixed one, and a projected slide would stop matching its
 * preview — the bug class coverage row SC-08 exists to catch.
 * `open-lyric-previewer-setting` is unprefixed for the same reason.
 */
export function toLyricStageStyleSettingName(stage: number) {
    return `lyric-stage-style-${stage}`;
}

function clampInt(
    value: unknown,
    range: LyricStageStyleRangeType,
    fallback: number,
) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

// A pair or the default: half a place (a vertical with no horizontal) is not
// a cell of the pad, so it reads back as Middle center, the default.
function sanitizeBoxAlignment(parsed: any) {
    const { boxVerticalAlignment, boxHorizontalAlignment } = parsed;
    if (
        BOX_VERTICAL_ALIGNMENT_LIST.includes(boxVerticalAlignment) &&
        BOX_HORIZONTAL_ALIGNMENT_LIST.includes(boxHorizontalAlignment)
    ) {
        return {
            boxVerticalAlignment:
                boxVerticalAlignment as LyricStageBoxVerticalAlignmentType,
            boxHorizontalAlignment:
                boxHorizontalAlignment as LyricStageBoxHorizontalAlignmentType,
        };
    }
    return {
        boxVerticalAlignment: LYRIC_STAGE_STYLE_DEFAULT.boxVerticalAlignment,
        boxHorizontalAlignment:
            LYRIC_STAGE_STYLE_DEFAULT.boxHorizontalAlignment,
    };
}

// Per FIELD, never all-or-nothing: the record is a file a user can hand-edit,
// and one bad number must not throw away the other values — or throw at all,
// since these are read from a render path.
function sanitize(parsed: any): LyricStageStyleType {
    if (parsed === null || typeof parsed !== 'object') {
        return { ...LYRIC_STAGE_STYLE_DEFAULT };
    }
    // A record written before the margin was split holds ONE
    // `paddingPercentage`, a side measured on the width: both sides together
    // are twice it, which is what each margin falls back to, and such a
    // record reads back linked. Never written again.
    const legacyMargin = clampInt(
        typeof parsed.paddingPercentage === 'number'
            ? parsed.paddingPercentage * 2
            : undefined,
        LYRIC_STAGE_STYLE_RANGES.marginHorizontalPercentage,
        LYRIC_STAGE_STYLE_DEFAULT.marginHorizontalPercentage,
    );
    return {
        marginHorizontalPercentage: clampInt(
            parsed.marginHorizontalPercentage,
            LYRIC_STAGE_STYLE_RANGES.marginHorizontalPercentage,
            legacyMargin,
        ),
        marginVerticalPercentage: clampInt(
            parsed.marginVerticalPercentage,
            LYRIC_STAGE_STYLE_RANGES.marginVerticalPercentage,
            legacyMargin,
        ),
        isMarginLinked: parsed.isMarginLinked !== false,
        ...sanitizeBoxAlignment(parsed),
        backgroundAlphaPercentage: clampInt(
            parsed.backgroundAlphaPercentage,
            LYRIC_STAGE_STYLE_RANGES.backgroundAlphaPercentage,
            LYRIC_STAGE_STYLE_DEFAULT.backgroundAlphaPercentage,
        ),
        extraFontSize: clampInt(
            parsed.extraFontSize,
            LYRIC_STAGE_STYLE_RANGES.extraFontSize,
            LYRIC_STAGE_STYLE_DEFAULT.extraFontSize,
        ),
        theme: parsed.theme === 'dark' ? 'dark' : 'light',
        customCss:
            typeof parsed.customCss === 'string'
                ? parsed.customCss
                : LYRIC_STAGE_STYLE_DEFAULT.customCss,
    };
}

/**
 * Skips the `JSON.parse`, NOT the read.
 *
 * `getLyricStageStyle` is called from `canvasItemBounds` and
 * `basicOpenLyricOptions`, which run per slide, so re-parsing the same string
 * every time is pure waste. `getSetting` is still called on every read, so a
 * change written by another window is picked up at once — this is a parse memo,
 * not a cache with a lifetime.
 *
 * It used to be bounded by the two registered stage classes. Stage numbers have
 * no ceiling now (a screen's `St:` increments as far as anyone presses), so the
 * bound is explicit: past `MAX_PARSED_STAGE_COUNT` the oldest entry goes. A
 * dropped entry costs one `JSON.parse` of a record this small, never a wrong
 * answer.
 */
const MAX_PARSED_STAGE_COUNT = 16;
const parsedByStage = new Map<
    string,
    { raw: string; style: LyricStageStyleType }
>();

function rememberParsedStage(
    settingName: string,
    raw: string,
    style: LyricStageStyleType,
) {
    // Delete first so a re-read moves the entry to the end of the insertion
    // order, which is what makes the eviction below least-recently-used.
    parsedByStage.delete(settingName);
    parsedByStage.set(settingName, { raw, style });
    while (parsedByStage.size > MAX_PARSED_STAGE_COUNT) {
        const oldestKey = parsedByStage.keys().next().value;
        if (oldestKey === undefined) {
            break;
        }
        parsedByStage.delete(oldestKey);
    }
}

export function getLyricStageStyle(stage: number): LyricStageStyleType {
    const settingName = toLyricStageStyleSettingName(stage);
    const raw = getSetting(settingName) ?? '';
    if (raw.trim() === '') {
        parsedByStage.delete(settingName);
        return { ...LYRIC_STAGE_STYLE_DEFAULT };
    }
    const cached = parsedByStage.get(settingName);
    if (cached !== undefined && cached.raw === raw) {
        return { ...cached.style };
    }
    let style: LyricStageStyleType;
    try {
        style = sanitize(JSON.parse(raw));
    } catch (_error) {
        // A corrupt file is not worth a console error on every slide; the
        // defaults are a working answer and the panel rewrites the file the
        // moment anyone touches it.
        style = { ...LYRIC_STAGE_STYLE_DEFAULT };
    }
    rememberParsedStage(settingName, raw, style);
    return { ...style };
}

export function setLyricStageStyle(stage: number, style: LyricStageStyleType) {
    const settingName = toLyricStageStyleSettingName(stage);
    const sanitized = sanitize(style);
    const raw = JSON.stringify(sanitized);
    rememberParsedStage(settingName, raw, sanitized);
    setSetting(settingName, raw);
}

/**
 * Back to the defaults by DELETING the file, not by writing a defaults blob —
 * a key that is gone reads back as "never customized", which is also what a
 * fresh install looks like, and it leaves nothing behind on machines that are
 * usually tight on disk.
 */
export function resetLyricStageStyle(stage: number) {
    const settingName = toLyricStageStyleSettingName(stage);
    parsedByStage.delete(settingName);
    removeSetting(settingName);
}

/** The `0`..`1` open-lyric's `backgroundAlpha` option wants. */
export function toOpenLyricBackgroundAlpha(style: LyricStageStyleType) {
    return style.backgroundAlphaPercentage / 100;
}
