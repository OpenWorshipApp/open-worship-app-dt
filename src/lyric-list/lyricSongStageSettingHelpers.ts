/**
 * ONE song's own stage setting: what the song asks of every stage it is drawn
 * on, kept in the song's file (`Lyric`'s `stageSetting`), not in a setting.
 *
 * Today that is a font. A song made from a PowerPoint keeps the face its
 * slides were set in (asked for 2026-11-10: _preserve font-family in stage
 * setting for the lyric_, chosen as "per song, every stage"), while every
 * other song keeps the app-wide font (`getOpenLyricFontSetting`). Open Lyric
 * text has no font directive -- its `Config` fence takes a closed list of
 * fields -- so the file carries it beside `content`.
 *
 * The font is needed SYNCHRONOUSLY, on the per-slide path:
 * `LyricAppDocumentStageAbstract.basicOpenLyricOptions` is a getter that the
 * element-map cache key and the warm-deck key are built from, and it runs in
 * the screen window too, where no previewer has loaded the song. So the stage
 * awaits `ensureLyricStageSetting` once at the start of each async entry point
 * (`getStageSlides`, `getSlides`, `getSlideById`) and the getter only PEEKS.
 *
 * Must stay a LEAF with NO imports at all: `LyricAppDocumentStageAbstract`
 * imports it, and that class's tests stub `./LyricAppDocument` as `class {}`
 * in node env (see `lyricStageStyleHelpers.ts` for the cycle this keeps out
 * of). The file is read through a reader `Lyric.ts` registers when it loads
 * -- the same inverted dependency as `setLyricAppDocumentGetter` -- so where
 * nothing registered one (a unit test), a song simply has no font of its own.
 */

export type LyricStageSettingType = {
    fontFamily?: string;
};

type MemoEntryType = {
    fontFamily: string | null;
    readAt: number;
    isStale: boolean;
};

type ReaderType = (filePath: string) => Promise<LyricStageSettingType | null>;

// Long enough that a song being clicked through is read once; short enough
// that nothing lives on (CLAUDE.md: caches are short-lived). The same window
// as the element-map cache the font is keyed into.
const FRESH_MS = 10_000;
// Bounded like the parse memo: a church opens a handful of songs at a time.
const MAX_SONGS = 16;
// A font name goes into CSS (`genFormControlFontCss`, open-lyric's
// `font-family`), so only what a family name is made of: letters, marks,
// digits, spaces, `-`, `_`, `.`. No quote, semicolon, brace or slash can
// close the rule it is written into.
const FONT_FAMILY_PATTERN = /^[\p{L}\p{M}\p{N} ._-]+$/u;
export const MAX_FONT_FAMILY_LENGTH = 64;

const memo = new Map<string, MemoEntryType>();
const reading = new Map<string, Promise<string | null>>();
let reader: ReaderType | null = null;

export function setLyricStageSettingReader(newReader: ReaderType | null) {
    reader = newReader;
}

export function toValidLyricFontFamily(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const fontFamily = value
        .replace(/^["'\s]+|["'\s]+$/g, '')
        .replace(/\s+/g, ' ');
    if (
        fontFamily === '' ||
        fontFamily.length > MAX_FONT_FAMILY_LENGTH ||
        !FONT_FAMILY_PATTERN.test(fontFamily)
    ) {
        return null;
    }
    return fontFamily;
}

/**
 * The setting as it may be written to the file: unknown keys dropped, a font
 * that could not be a family name dropped, `null` when nothing is left (the
 * file then carries no `stageSetting` at all).
 */
export function toValidLyricStageSetting(
    value: unknown,
): LyricStageSettingType | null {
    if (value === null || typeof value !== 'object') {
        return null;
    }
    const fontFamily = toValidLyricFontFamily(
        (value as LyricStageSettingType).fontFamily,
    );
    return fontFamily === null ? null : { fontFamily };
}

function remember(filePath: string, fontFamily: string | null) {
    memo.delete(filePath);
    memo.set(filePath, { fontFamily, readAt: Date.now(), isStale: false });
    while (memo.size > MAX_SONGS) {
        const oldest = memo.keys().next().value;
        if (oldest === undefined) {
            break;
        }
        memo.delete(oldest);
    }
}

// Registered BEFORE open-lyric measures anything: a face nobody on the page
// has used yet is not loaded, and open-lyric freezes each line into pixel
// boxes measured in whatever face is ready (see `initOpenLyric`). Guarded --
// a screen window, a test, a family the system does not have.
async function loadFontFace(fontFamily: string) {
    try {
        const fonts = (globalThis as any).document?.fonts;
        if (fonts && typeof fonts.load === 'function') {
            await fonts.load(`16px "${fontFamily}"`);
        }
    } catch (_error) {
        // A family that cannot be loaded draws in the fallback; nothing to do.
    }
}

async function readFontFamily(filePath: string) {
    if (reader === null) {
        return null;
    }
    try {
        const setting = await reader(filePath);
        return toValidLyricStageSetting(setting)?.fontFamily ?? null;
    } catch (_error) {
        return null;
    }
}

/**
 * Makes `peekLyricSongFontFamily(filePath)` current. Cheap when it already
 * is: a song is read at most once per `FRESH_MS`, and again at once after
 * an edit marked it stale (the previewer's `update` handler, through the
 * stages' `clearCache`). Reads in flight are shared.
 */
export async function ensureLyricStageSetting(filePath: string) {
    const entry = memo.get(filePath);
    if (
        entry !== undefined &&
        !entry.isStale &&
        Date.now() - entry.readAt < FRESH_MS
    ) {
        return entry.fontFamily;
    }
    const inFlight = reading.get(filePath);
    if (inFlight !== undefined) {
        return await inFlight;
    }
    const promise = (async () => {
        const fontFamily = await readFontFamily(filePath);
        if (fontFamily !== null) {
            await loadFontFace(fontFamily);
        }
        remember(filePath, fontFamily);
        return fontFamily;
    })();
    reading.set(filePath, promise);
    try {
        return await promise;
    } finally {
        reading.delete(filePath);
    }
}

/** The song's own font as last read, without reading. `null`: none. */
export function peekLyricSongFontFamily(filePath: string) {
    return memo.get(filePath)?.fontFamily ?? null;
}

/**
 * The song was edited: the next `ensure` reads it again. The last value is
 * kept meanwhile, so a slide built in between draws as before rather than in
 * the app font for one frame.
 */
export function markLyricStageSettingStale(filePath: string) {
    const entry = memo.get(filePath);
    if (entry !== undefined) {
        entry.isStale = true;
    }
}

/** What the file was just written with, so no read has to follow a write. */
export function setLyricStageSettingMemo(
    filePath: string,
    setting: LyricStageSettingType | null,
) {
    remember(filePath, toValidLyricStageSetting(setting)?.fontFamily ?? null);
}

/**
 * The `font-family` value a song is drawn with. open-lyric's `fontFamily`
 * option REPLACES the whole stack, so the song's own face goes first and the
 * app-wide one stays behind it: a face missing on this computer falls back
 * to the font every other song uses, not to the browser's default.
 */
export function toLyricFontFamilyStack(
    songFontFamily: string | null,
    appFontFamily: string | undefined,
) {
    if (songFontFamily === null) {
        return appFontFamily;
    }
    const app = (appFontFamily ?? '').trim();
    const song = `"${songFontFamily}"`;
    return app === '' ? song : `${song}, ${app}`;
}

/** For tests only: forget everything. */
export function resetLyricStageSettingMemo() {
    memo.clear();
    reading.clear();
}
