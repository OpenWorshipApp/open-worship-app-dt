import { toOfficeColor, toOfficeColorWords } from './officeXmlLookHelpers';

/**
 * A deck's THEME, as PowerPoint's Design tab changes it (2026-11-21, the
 * goal _chatbot can change do everything on a given pptx_: the theme and
 * the slide master were the last of a deck's looks refused). `theme:
 * {colors, headingFont, bodyFont}` rewrites the theme part each slide master
 * uses: a colour slot's value, the Latin face of its heading and body
 * fonts. Every word, shape and table that takes the theme's colours or
 * fonts follows; words given a colour or a font of their own keep it. Pure.
 */

// The words a slot is asked by, to its element in `a:clrScheme`, in the
// order PowerPoint's Customize Colors lists them.
const THEME_COLOR_SLOT_LIST: {
    slot: string;
    element: string;
    words: string;
}[] = [
    { slot: 'dark1', element: 'dk1', words: 'text dark 1' },
    { slot: 'light1', element: 'lt1', words: 'background light 1' },
    { slot: 'dark2', element: 'dk2', words: 'text dark 2' },
    { slot: 'light2', element: 'lt2', words: 'background light 2' },
    { slot: 'accent1', element: 'accent1', words: 'accent 1' },
    { slot: 'accent2', element: 'accent2', words: 'accent 2' },
    { slot: 'accent3', element: 'accent3', words: 'accent 3' },
    { slot: 'accent4', element: 'accent4', words: 'accent 4' },
    { slot: 'accent5', element: 'accent5', words: 'accent 5' },
    { slot: 'accent6', element: 'accent6', words: 'accent 6' },
    { slot: 'link', element: 'hlink', words: 'link' },
    { slot: 'followedLink', element: 'folHlink', words: 'followed link' },
];

export const OFFICE_THEME_COLOR_SLOT_LIST = THEME_COLOR_SLOT_LIST.map((one) => {
    return one.slot;
});

export type OfficeThemeAskType = {
    colors: { element: string; words: string; hex: string }[];
    headingFont: string | null;
    bodyFont: string | null;
};

const MAX_FONT_NAME_CHARS = 64;

function readFontName(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }
    const name = value.trim();
    return name !== '' &&
        name.length <= MAX_FONT_NAME_CHARS &&
        !/[<>&"\\/\p{Cc}]/u.test(name)
        ? name
        : null;
}

/** `theme` as a change gives it, checked whole; a reason when it is not one. */
export function readOfficeThemeAsk(
    value: unknown,
): { ask: OfficeThemeAskType } | { reason: string } {
    const shape =
        '`theme` is {colors: {accent1: "navy", …}, headingFont, bodyFont}: ' +
        `its colour slots ${OFFICE_THEME_COLOR_SLOT_LIST.join(', ')}.`;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { reason: shape };
    }
    const asked = value as Record<string, unknown>;
    const unknownKey = Object.keys(asked).find((key) => {
        return !['colors', 'headingFont', 'bodyFont'].includes(key);
    });
    if (unknownKey !== undefined) {
        return {
            reason: `\`theme\` has no ${JSON.stringify(unknownKey)}. ${shape}`,
        };
    }
    const colors: OfficeThemeAskType['colors'] = [];
    if (asked.colors !== undefined) {
        if (
            typeof asked.colors !== 'object' ||
            asked.colors === null ||
            Array.isArray(asked.colors)
        ) {
            return { reason: shape };
        }
        for (const [slot, color] of Object.entries(asked.colors)) {
            const found = THEME_COLOR_SLOT_LIST.find((one) => {
                return one.slot === slot;
            });
            if (found === undefined) {
                return {
                    reason: `The theme has no colour ${JSON.stringify(slot)}. ${shape}`,
                };
            }
            const hex = toOfficeColor(color);
            if (hex === null) {
                return {
                    reason:
                        `${JSON.stringify(color)} is not a colour: write it ` +
                        'as #RRGGBB or a colour\'s English name ("navy").',
                };
            }
            colors.push({ element: found.element, words: found.words, hex });
        }
    }
    const fonts = { headingFont: null, bodyFont: null } as Record<
        'headingFont' | 'bodyFont',
        string | null
    >;
    for (const key of ['headingFont', 'bodyFont'] as const) {
        if (asked[key] === undefined) {
            continue;
        }
        const name = readFontName(asked[key]);
        if (name === null) {
            return {
                reason: `\`theme.${key}\` is a font's name, ${MAX_FONT_NAME_CHARS} characters at most.`,
            };
        }
        fonts[key] = name;
    }
    if (
        colors.length === 0 &&
        fonts.headingFont === null &&
        fonts.bodyFont === null
    ) {
        return { reason: shape };
    }
    return { ask: { colors, ...fonts } };
}

function escapeAttribute(value: string) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * The theme part with the change made, or null when it holds no colour
 * scheme or font scheme to change.
 */
export function applyOfficeThemeXml(xml: string, ask: OfficeThemeAskType) {
    let out = xml;
    for (const color of ask.colors) {
        const pattern = new RegExp(
            `(<a:${color.element}>)[\\s\\S]*?(</a:${color.element}>)`,
        );
        if (!pattern.test(out)) {
            return null;
        }
        out = out.replace(pattern, `$1<a:srgbClr val="${color.hex}"/>$2`);
    }
    const fontList = [
        ['majorFont', ask.headingFont],
        ['minorFont', ask.bodyFont],
    ] as const;
    for (const [element, name] of fontList) {
        if (name === null) {
            continue;
        }
        const pattern = new RegExp(
            `(<a:${element}>[\\s\\S]*?)<a:latin\\b[^>]*?/>`,
        );
        if (!pattern.test(out)) {
            return null;
        }
        // the old face's panose and charset describe it, not the new one
        out = out.replace(
            pattern,
            `$1<a:latin typeface="${escapeAttribute(name)}"/>`,
        );
    }
    return out;
}

/** The change said back, in one sentence. */
export function toOfficeThemeWords(ask: OfficeThemeAskType) {
    const parts: string[] = [];
    if (ask.headingFont !== null) {
        parts.push(`headings in ${ask.headingFont}`);
    }
    if (ask.bodyFont !== null) {
        parts.push(`body text in ${ask.bodyFont}`);
    }
    for (const color of ask.colors) {
        parts.push(`${color.words} ${toOfficeColorWords(color.hex)}`);
    }
    return (
        `The deck's theme now has ${parts.join(', ')}: every slide, ` +
        'shape and table that takes the theme follows it; words given a ' +
        'colour or a font of their own keep it.'
    );
}
