import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';

/**
 * How ONE stage renders its slides.
 *
 * These five used to be four hard-coded fields on `LyricAppDocument` that
 * nothing ever assigned, so every song on every stage came out at the same
 * padding, opacity, font boost and theme. They live here instead so the Stage
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
export type LyricStageStyleType = {
    paddingPercentage: number;
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

// The values the four fields were hard-coded to, so an install that never opens
// the panel renders byte-identically to before.
export const LYRIC_STAGE_STYLE_DEFAULT: Readonly<LyricStageStyleType> = {
    paddingPercentage: 1,
    backgroundAlphaPercentage: 50,
    extraFontSize: 45,
    theme: 'light',
    customCss: '',
};

// Every range is integer-stepped ON PURPOSE — `AppRangeComp` rounds with
// `parseInt`, so a `step` below 1 would render a slider whose value silently
// snaps. A finer knob needs a different control, not a smaller step here.
export const LYRIC_STAGE_STYLE_RANGES: Readonly<{
    paddingPercentage: LyricStageStyleRangeType;
    backgroundAlphaPercentage: LyricStageStyleRangeType;
    extraFontSize: LyricStageStyleRangeType;
}> = {
    paddingPercentage: { min: 0, max: 20, step: 1 },
    backgroundAlphaPercentage: { min: 0, max: 100, step: 1 },
    extraFontSize: { min: 0, max: 200, step: 1 },
};

/**
 * One setting per STAGE, holding the whole record — not one setting per field.
 *
 * Settings are files, and on the screen window `CacheManager.setSync` is a
 * no-op, so every `getSetting` there is a real `fsExistSync` + `fsReadSync`.
 * Five keys would be ten syscalls per options build on the renderer that has to
 * stay the fastest; one blob is two. It also makes a slider commit a single
 * write instead of up to five, so a crash mid-drag cannot leave a torn record.
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

// Per FIELD, never all-or-nothing: the record is a file a user can hand-edit,
// and one bad number must not throw away the other four values — or throw at
// all, since these are read from a render path.
function sanitize(parsed: any): LyricStageStyleType {
    if (parsed === null || typeof parsed !== 'object') {
        return { ...LYRIC_STAGE_STYLE_DEFAULT };
    }
    return {
        paddingPercentage: clampInt(
            parsed.paddingPercentage,
            LYRIC_STAGE_STYLE_RANGES.paddingPercentage,
            LYRIC_STAGE_STYLE_DEFAULT.paddingPercentage,
        ),
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
 * not a cache with a lifetime. Bounded by the registered stage classes (two
 * today), one entry each, so it cannot grow.
 */
const parsedByStage = new Map<
    string,
    { raw: string; style: LyricStageStyleType }
>();

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
    parsedByStage.set(settingName, { raw, style });
    return { ...style };
}

export function setLyricStageStyle(stage: number, style: LyricStageStyleType) {
    const settingName = toLyricStageStyleSettingName(stage);
    const sanitized = sanitize(style);
    const raw = JSON.stringify(sanitized);
    parsedByStage.set(settingName, { raw, style: sanitized });
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
