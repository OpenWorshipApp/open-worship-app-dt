import type { LocaleType } from '../lang/langHelpers';
import { sanitizeCssValue } from '../helper/sanitizeHelpers';
import { SCREEN_FONT_FAMILY } from './screenFontFamily';
import type { BibleItemRenderingType } from './bibleScreenComps';
import type {
    LongTextDataType,
    LongTextItemDataType,
} from './screenTypeHelpers';

// What `ScreenLongTextManager` draws, whatever it came from: columns of
// numbered sections under a title. A Bible passage is one source of it (a
// column per version, a section per verse) and a long text -- a song in
// several languages -- is the other. The Bible's own persisted shape is left
// exactly as it was; `toLongTextColumns` reads either one into this.
//
// A leaf: every screen manager loads it, so it imports no module of its own
// weight -- the language layer least of all (types only), which is why the
// one check that needs it takes it as an argument.

export const longTextTextAlignList = ['left', 'center', 'right'] as const;
export type LongTextTextAlignType = (typeof longTextTextAlignList)[number];

/**
 * What ONE column says about itself, over the screen's own text style. Every
 * key is present only while it is set: the on-screen data is compared and
 * persisted as JSON, and a key holding `undefined` is a different object from
 * one without it.
 */
export type LongTextColumnStyleType = {
    fontFamily?: string;
    // '100' .. '900'
    fontWeight?: string;
    // #rrggbb or #rrggbbaa
    color?: string;
    // Of the screen's text size; 1 is never stored.
    fontSizeScale?: number;
    textAlign?: LongTextTextAlignType;
};

export type LongTextSectionType = {
    num: string;
    text: string;
    // The row's identity ACROSS columns: the same section of every language
    // carries the same key, as the same verse of every Bible does.
    key: string;
    // A Bible verse's own key in its own version; nothing else has one.
    verseKey?: string;
};

export type LongTextColumnType = {
    locale: LocaleType;
    // What the header's chip reads: the Bible key, or the language code.
    code: string;
    title: string;
    sections: LongTextSectionType[];
    style?: LongTextColumnStyleType;
};

export const MIN_LONG_TEXT_FONT_SIZE_SCALE = 0.5;
export const MAX_LONG_TEXT_FONT_SIZE_SCALE = 2;
const MAX_FONT_FAMILY_LENGTH = 100;
const FONT_WEIGHT_PATTERN = /^[1-9]00$/;
const HEX_COLOR_PATTERN = /^#(?:[\da-f]{6}|[\da-f]{8})$/i;

/**
 * A section's key. ASCII on purpose, and short: a viewer on a virtual display
 * sends the row it tapped back, and `electron/virtualDisplayProtocol.ts` only
 * lets a key of word characters, spaces and `.:-` through.
 */
export function toLongTextSectionKey(index: number) {
    return `lt-${index + 1}`;
}

function readFontFamily(value: unknown) {
    if (typeof value !== 'string') {
        return '';
    }
    // Written between double quotes into a `style`: what could close the
    // string or the declaration comes off, and a comment opener is refused
    // whole (unclosed, it would swallow whatever is written after it).
    const fontFamily = sanitizeCssValue(value).replaceAll(/\s+/g, ' ').trim();
    if (
        fontFamily.includes('/*') ||
        fontFamily.length > MAX_FONT_FAMILY_LENGTH
    ) {
        return '';
    }
    return fontFamily;
}

function readFontSizeScale(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 1;
    }
    const scale = Math.min(
        MAX_LONG_TEXT_FONT_SIZE_SCALE,
        Math.max(MIN_LONG_TEXT_FONT_SIZE_SCALE, value),
    );
    return Math.round(scale * 100) / 100;
}

/**
 * A column's style as it may be drawn: only the keys that hold a usable value,
 * and `undefined` when none does. The one reader for the panel, for a style
 * arriving from a setting file or a Screen Mirror peer, and for the renderer
 * -- all of it ends up inside a `<style>` or a `style` attribute.
 */
export function readLongTextColumnStyle(
    value: unknown,
): LongTextColumnStyleType | undefined {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const raw = value as { [key: string]: unknown };
    const fontFamily = readFontFamily(raw.fontFamily);
    const fontWeight =
        typeof raw.fontWeight === 'string' &&
        FONT_WEIGHT_PATTERN.test(raw.fontWeight)
            ? raw.fontWeight
            : '';
    const color =
        typeof raw.color === 'string' && HEX_COLOR_PATTERN.test(raw.color)
            ? raw.color
            : '';
    const fontSizeScale = readFontSizeScale(raw.fontSizeScale);
    const textAlign = longTextTextAlignList.find((align) => {
        return align === raw.textAlign;
    });
    const style: LongTextColumnStyleType = {
        ...(fontFamily === '' ? {} : { fontFamily }),
        ...(fontWeight === '' ? {} : { fontWeight }),
        ...(color === '' ? {} : { color }),
        ...(fontSizeScale === 1 ? {} : { fontSizeScale }),
        ...(textAlign === undefined ? {} : { textAlign }),
    };
    return Object.keys(style).length === 0 ? undefined : style;
}

export function checkIsLongTextData(
    data: LongTextDataType | null | undefined,
): data is LongTextItemDataType {
    return data?.type === 'long-text';
}

/**
 * The Bible's own payload, for the readers that are only about a Bible.
 * Whatever is not a long text is read as one, as it always was: the layer
 * held nothing else before, and a reader here never asked the type.
 */
export function getBibleItemData(data: LongTextDataType | null | undefined) {
    if (data === null || data === undefined || checkIsLongTextData(data)) {
        return undefined;
    }
    return data.bibleItemData;
}

function checkIsValidSection(section: any) {
    return (
        typeof section?.num === 'string' &&
        typeof section.text === 'string' &&
        typeof section.key === 'string'
    );
}

function checkIsValidColumn(
    column: any,
    checkIsValidLocale: (locale: string) => boolean,
) {
    return (
        typeof column?.locale === 'string' &&
        checkIsValidLocale(column.locale) &&
        typeof column.code === 'string' &&
        typeof column.title === 'string' &&
        Array.isArray(column.sections) &&
        column.sections.every(checkIsValidSection)
    );
}

/** The `longTextData` of a persisted or received `'long-text'` entry. */
export function checkIsValidLongTextData(
    value: unknown,
    checkIsValidLocale: (locale: string) => boolean,
) {
    const longTextData = value as any;
    return (
        typeof longTextData?.sourceId === 'string' &&
        Array.isArray(longTextData.renderedList) &&
        longTextData.renderedList.every((column: any) => {
            return checkIsValidColumn(column, checkIsValidLocale);
        })
    );
}

/** Several Bibles, as columns: a column per version, a section per verse. */
export function toBibleLongTextColumns(
    renderedList: BibleItemRenderingType[],
): LongTextColumnType[] {
    return renderedList.map(({ locale, bibleKey, title, verses }) => {
        return {
            locale,
            code: bibleKey,
            title,
            sections: verses.map(({ num, text, verseKey, kjvVerseKey }) => {
                return { num, text, key: kjvVerseKey, verseKey };
            }),
        };
    });
}

/** Either source, as the columns the table draws. */
export function toLongTextColumns(
    data: LongTextDataType,
): LongTextColumnType[] {
    if (checkIsLongTextData(data)) {
        return data.longTextData.renderedList;
    }
    return toBibleLongTextColumns(getBibleItemData(data)?.renderedList ?? []);
}

// What marks the table of a long text, for the one rule that is its own
// (`ScreenBibleComp`): a section is several lines, and keeps its breaks.
export const SCREEN_LONG_TEXT_CLASSNAME = 'screen-long-text';

export function toLongTextColumnClassName(index: number) {
    return `screen-long-text-column-${index}`;
}

/**
 * A column's own family as a `font-family` value: the language's font behind
 * it for the letters it does not have (a Latin family picked for a Khmer
 * column), then the screen's stack. No `var(--bible-font-family)` in it, so
 * the family chosen for the whole screen cannot win over this column's.
 */
export function genLongTextFontFamilyCss(
    fontFamily: string,
    langFontFamily?: string,
) {
    return (
        `"${fontFamily}", ` +
        (langFontFamily ? `${langFontFamily}, ` : '') +
        SCREEN_FONT_FAMILY
    );
}

const HEADER_JUSTIFY_MAP: {
    [key in LongTextTextAlignType]: [ltr: string, rtl: string];
} = {
    left: ['flex-start', 'flex-end'],
    center: ['center', 'center'],
    right: ['flex-end', 'flex-start'],
};

/**
 * The rules of one column's own colour, weight, size and alignment -- its
 * family is said inline, where the language's font already is.
 *
 * The size is on the cells only: the header is resized on every scroll
 * (`applyHeaderEffectOnScroll`) and stays the screen's. The alignment is
 * `!important` and by class, because Bible Properties writes
 * `tr td { text-align: … !important }` and an inline style would lose to it.
 */
export function genLongTextColumnCss(
    index: number,
    style: LongTextColumnStyleType | undefined,
    isRtl: boolean,
) {
    if (style === undefined) {
        return '';
    }
    const className = toLongTextColumnClassName(index);
    const cell = `#bible-screen-view td.${className}`;
    const header = `#bible-screen-view th.${className}`;
    const sharedDeclarations: string[] = [];
    if (style.color !== undefined) {
        sharedDeclarations.push(`color: ${style.color};`);
    }
    if (style.fontWeight !== undefined) {
        sharedDeclarations.push(`font-weight: ${style.fontWeight};`);
    }
    const cellDeclarations: string[] = [];
    if (style.fontSizeScale !== undefined) {
        cellDeclarations.push(`font-size: ${style.fontSizeScale}em;`);
    }
    if (style.textAlign !== undefined) {
        cellDeclarations.push(`text-align: ${style.textAlign} !important;`);
    }
    const rules: string[] = [];
    if (sharedDeclarations.length > 0) {
        rules.push(`${cell}, ${header} { ${sharedDeclarations.join(' ')} }`);
    }
    if (cellDeclarations.length > 0) {
        rules.push(`${cell} { ${cellDeclarations.join(' ')} }`);
    }
    if (style.textAlign !== undefined) {
        const justify = HEADER_JUSTIFY_MAP[style.textAlign][isRtl ? 1 : 0];
        rules.push(`${header} > div { justify-content: ${justify}; }`);
    }
    return rules.join('\n');
}

/**
 * The same long text with its columns restyled, matched by their code. The
 * words, the scroll position and the selected row are the ones on the screen
 * -- a Properties change must not put the panel's newer text up with it.
 *
 * A code named with `undefined` loses its style; a column whose code is not
 * named at all is left as it is (its language was renamed in the panel
 * since it went up, and nothing here speaks for it any more).
 */
export function withLongTextColumnStyles(
    data: LongTextItemDataType,
    styleByCode: { [code: string]: LongTextColumnStyleType | undefined },
): LongTextItemDataType {
    return {
        ...data,
        longTextData: {
            ...data.longTextData,
            renderedList: data.longTextData.renderedList.map((column) => {
                if (!Object.hasOwn(styleByCode, column.code)) {
                    return column;
                }
                const { style: _style, ...columnWithoutStyle } = column;
                const style = readLongTextColumnStyle(styleByCode[column.code]);
                return style === undefined
                    ? columnWithoutStyle
                    : { ...columnWithoutStyle, style };
            }),
        },
    };
}
