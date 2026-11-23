// How a line LOOKS in a PowerPoint or Word package, and a slide's own look:
// the colour, size, weight, slant, underline, face and highlight of a line's
// words, which way it is aligned, a slide's background and whether the show
// skips it -- changed for `owa_office_edit` (2026-11-20, the user, a deck
// attached and _change color to green_ answered "I cannot change the color
// of text or backgrounds, as that must be done directly in PowerPoint or
// Word", then the goal _chatbot can change do everything on a given pptx_).
//
// Pure, strings in and out, read with the same tag scanner as the words
// (`officeXmlEditHelpers.ts`). A look is written into the properties each
// run of the line already has (`a:rPr` / `w:rPr`), made where a run has
// none, and every other property a run carries -- a link, a language, a
// shadow -- is left as it was. Office reads the children of those
// properties in a fixed order and asks to "repair" a file that breaks it,
// so a child is put where the schema puts it (the `*_ORDER_LIST`s).

import colorList from '../others/color-list.json';
import {
    type ElementType,
    type OfficeDialectType,
    escapeXmlText,
    listChildElements,
    readParagraphFrame,
    scanTags,
    unescapeXml,
} from './officeXmlEditHelpers';

export const OFFICE_ALIGN_LIST = [
    'left',
    'center',
    'right',
    'justify',
] as const;
export type OfficeAlignType = (typeof OFFICE_ALIGN_LIST)[number];

export type OfficeLookType = {
    // `RRGGBB`
    color?: string;
    // `RRGGBB`, or null: taken off
    highlight?: string | null;
    // points
    size?: number;
    // each word's own size changed: times `scale`, plus `add` points --
    // "bigger" read against what every run already is (2026-11-20: _make
    // the words bigger_ had set a deck's 58 pt verses and 24 pt titles all
    // to 44, the verses SMALLER)
    sizeBy?: { scale: number; add: number };
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    // a line through the words (2026-11-21)
    strike?: boolean;
    // a deck's words made a link (2026-11-21): a web address, `slide:N`
    // (a jump to that slide in the show), or null: no link
    link?: string | null;
    font?: string;
    align?: OfficeAlignType;
    // a soft shadow behind the words, so they read over a picture
    // (2026-11-21: _make the words stand out from the background_)
    shadow?: boolean;
    // the space from line to line, times one line: 1, 1.5, 2
    lineSpacing?: number;
    // a bullet before each line, or none (a deck's lines only)
    bullets?: boolean;
};

// A line's own settings, never a word's: given to whole lines alone.
export const OFFICE_LINE_LOOK_KEY_LIST = [
    'align',
    'lineSpacing',
    'bullets',
] as const;

const LINE_SPACING_WORD_MAP: Record<string, number> = {
    single: 1,
    double: 2,
    'one and a half': 1.5,
};

// --- colours ---------------------------------------------------------------

// Every CSS colour name, as the app's own colour menu lists them, and its
// sixteen plain ones over them: a model says "green", "dark blue", "grey".
const COLOR_NAME_MAP: Record<string, string> = Object.fromEntries(
    [
        ...Object.entries(colorList.extension),
        ...Object.entries(colorList.main),
    ].map(([name, hex]) => {
        return [name.toLowerCase(), hex.replace(/^#/, '').toUpperCase()];
    }),
);

const COLOR_OFF_PATTERN =
    /^(?:none|no ?colou?r|no ?highlight|off|remove|clear|transparent|default|auto)$/i;

/** "none", "off", "default" … -- a highlight or a background taken off. */
export function checkIsOfficeColorOff(value: unknown) {
    return typeof value === 'string' && COLOR_OFF_PATTERN.test(value.trim());
}

/**
 * A colour as Office writes it, `RRGGBB`: `#00B050`, `00b050`, `#0b5`,
 * `rgb(0, 176, 80)` or a colour's English name. Null for anything else.
 */
export function toOfficeColor(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim();
    const long = /^#?([\da-f]{6})$/i.exec(text);
    if (long !== null) {
        return long[1].toUpperCase();
    }
    const short = /^#([\da-f]{3})$/i.exec(text);
    if (short !== null) {
        return short[1]
            .split('')
            .map((digit) => {
                return digit + digit;
            })
            .join('')
            .toUpperCase();
    }
    const rgb =
        /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(text);
    if (rgb !== null) {
        const parts = rgb.slice(1, 4).map(Number);
        return parts.every((part) => {
            return part <= 255;
        })
            ? parts
                  .map((part) => {
                      return part.toString(16).padStart(2, '0');
                  })
                  .join('')
                  .toUpperCase()
            : null;
    }
    const name = text.toLowerCase().replace(/[\s_-]+/g, '');
    return (
        COLOR_NAME_MAP[name] ??
        COLOR_NAME_MAP[name.replace(/grey/g, 'gray')] ??
        null
    );
}

// A GRADIENT (2026-11-21, the goal _chatbot can change do everything on a
// given pptx_): a slide's `background` or a box's `fill` written as colours
// joined by "to" -- "dark blue to purple", "black to #1F3864, left to
// right" -- PowerPoint's Format Background → Gradient fill, a straight
// blend, top to bottom unless a direction ends it. Carried through a change
// as ONE string, where a plain colour's `RRGGBB` goes:
// `gradient:<angle>:<RRGGBB>:<RRGGBB>…`, two to four colours.
const GRADIENT_PREFIX = 'gradient:';
const MAX_GRADIENT_COLOR_COUNT = 4;
// Office's angle for each direction: 60 000 a degree, clockwise from
// left-to-right.
const GRADIENT_DIRECTION_LIST: {
    words: string;
    angle: number;
    pattern: RegExp;
}[] = [
    {
        words: 'top to bottom',
        angle: 5400000,
        pattern: /^(?:top to bottom|downwards?|down|vertical(?:ly)?)$/i,
    },
    {
        words: 'bottom to top',
        angle: 16200000,
        pattern: /^(?:bottom to top|upwards?|up)$/i,
    },
    {
        words: 'left to right',
        angle: 0,
        pattern: /^(?:left to right|across|sideways|horizontal(?:ly)?)$/i,
    },
    { words: 'right to left', angle: 10800000, pattern: /^right to left$/i },
    {
        words: 'corner to corner',
        angle: 2700000,
        pattern: /^(?:diagonal(?:ly)?|corner to corner)$/i,
    },
];
const GRADIENT_DIRECTION_TAIL_PATTERN =
    /[\s,;(]+(top to bottom|bottom to top|left to right|right to left|corner to corner|downwards?|upwards?|down|up|across|sideways|horizontal(?:ly)?|vertical(?:ly)?|diagonal(?:ly)?)\)?\s*$/i;
// Between two colours: "to", "then", "and", an arrow, a comma outside
// `rgb(…)`.
const GRADIENT_JOIN_PATTERN =
    /\s+(?:to|then|and|into)\s+|\s*(?:→|->)\s*|\s*,\s*(?![^(]*\))/i;

/**
 * A gradient as a change carries it (`gradient:<angle>:<RRGGBB>…`), from
 * colours joined by "to" with an optional direction at the end; null when
 * the words are not two to four colours.
 */
export function toOfficeGradient(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    let text = value
        .trim()
        .replace(/^(?:an?\s+)?gradient(?:\s+fill)?\s*(?:of|from|:)?\s*/i, '')
        .replace(/^from\s+/i, '');
    let angle = GRADIENT_DIRECTION_LIST[0].angle;
    const tail = GRADIENT_DIRECTION_TAIL_PATTERN.exec(text);
    if (tail !== null) {
        const direction = GRADIENT_DIRECTION_LIST.find((one) => {
            return one.pattern.test(tail[1]);
        });
        angle = direction?.angle ?? angle;
        text = text.slice(0, tail.index);
    }
    const colors = text.split(GRADIENT_JOIN_PATTERN).map((part) => {
        return toOfficeColor(part);
    });
    if (
        colors.length < 2 ||
        colors.length > MAX_GRADIENT_COLOR_COUNT ||
        colors.includes(null)
    ) {
        return null;
    }
    return `${GRADIENT_PREFIX}${angle}:${colors.join(':')}`;
}

function readOfficeGradient(value: string) {
    if (!value.startsWith(GRADIENT_PREFIX)) {
        return null;
    }
    const [angle, ...colors] = value.slice(GRADIENT_PREFIX.length).split(':');
    return { angle: Number(angle), colors };
}

const PATTERN_PREFIX = 'pattern:';
// A pattern's words to Office's preset (`a:pattFill prst`), the plain ones
// a volunteer says; the first is the one said back.
const PATTERN_WORD_LIST: { words: string; prst: string; pattern: RegExp }[] = [
    {
        words: 'vertical stripes',
        prst: 'dkVert',
        pattern: /^vertical (?:stripes?|lines?)$/,
    },
    {
        words: 'diagonal stripes',
        prst: 'wdDnDiag',
        pattern: /^diagonal (?:stripes?|lines?)$/,
    },
    {
        words: 'stripes',
        prst: 'dkHorz',
        pattern: /^(?:horizontal )?(?:stripes?|striped|lines?)$/,
    },
    {
        words: 'dots',
        prst: 'pct20',
        pattern: /^(?:polka )?(?:dots?|dotted|spots?|spotted)$/,
    },
    {
        words: 'checks',
        prst: 'lgCheck',
        pattern: /^(?:checks?|checked|checkered|chequered|checkerboard)$/,
    },
    {
        words: 'a small grid',
        prst: 'smGrid',
        pattern: /^small grid$/,
    },
    { words: 'a grid', prst: 'lgGrid', pattern: /^(?:large )?grid$/ },
    {
        words: 'diagonal crosshatch',
        prst: 'diagCross',
        pattern: /^diagonal cross ?hatch(?:ed|ing)?$/,
    },
    {
        words: 'crosshatch',
        prst: 'cross',
        pattern: /^cross ?hatch(?:ed|ing)?$/,
    },
    { words: 'bricks', prst: 'horzBrick', pattern: /^bricks?$/ },
    { words: 'diamonds', prst: 'solidDmnd', pattern: /^diamonds?$/ },
    { words: 'confetti', prst: 'lgConfetti', pattern: /^confetti$/ },
    { words: 'waves', prst: 'wave', pattern: /^(?:waves?|wavy)$/ },
    { words: 'zigzag', prst: 'zigZag', pattern: /^zig ?zags?$/ },
    { words: 'plaid', prst: 'plaid', pattern: /^(?:plaid|tartan)$/ },
    { words: 'weave', prst: 'weave', pattern: /^(?:weave|woven)$/ },
    { words: 'trellis', prst: 'trellis', pattern: /^trellis$/ },
    { words: 'shingles', prst: 'shingle', pattern: /^shingles?$/ },
];

function findPatternWords(words: string) {
    const text = words.trim().toLowerCase().replace(/\s+/g, ' ');
    return (
        PATTERN_WORD_LIST.find((one) => {
            return one.pattern.test(text);
        }) ?? null
    );
}

/**
 * A pattern as a change carries it (`pattern:<prst>:<RRGGBB>:<RRGGBB>`),
 * from "navy stripes on white", "stripes of navy on white", "red and white
 * checks" or "red dots" (on white); null when the words are not one.
 */
export function toOfficePattern(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value
        .trim()
        .replace(/^(?:an?\s+)?pattern(?:ed)?(?:\s+fill)?\s*(?:of|:)?\s*/i, '')
        .replace(/^an?\s+/i, '');
    const genFill = (
        patternWords: string,
        fgWords: string,
        bgWords: string,
    ) => {
        const found = findPatternWords(patternWords);
        const fg = toOfficeColor(fgWords.trim());
        const bg = toOfficeColor(bgWords.trim());
        return found === null || fg === null || bg === null
            ? null
            : `${PATTERN_PREFIX}${found.prst}:${fg}:${bg}`;
    };
    // "stripes of navy on white"
    const ofForm = /^(.+?)\s+of\s+(.+?)(?:\s+(?:on|over)\s+(.+))?$/i.exec(text);
    if (ofForm !== null) {
        const made = genFill(ofForm[1], ofForm[2], ofForm[3] ?? 'white');
        if (made !== null) {
            return made;
        }
    }
    // "navy stripes on white", "red and white checks", "red dots"
    const onForm = /^(.+?)(?:\s+(?:on|over)\s+(.+))?$/i.exec(text);
    if (onForm === null) {
        return null;
    }
    const head = onForm[1].trim().split(/\s+/);
    for (let cut = 1; cut < head.length; cut++) {
        const colorWords = head.slice(0, cut).join(' ');
        const patternWords = head.slice(cut).join(' ');
        if (findPatternWords(patternWords) === null) {
            continue;
        }
        const pair = /^(.+?)\s+(?:and|&)\s+(.+)$/i.exec(colorWords);
        if (pair !== null && onForm[2] === undefined) {
            return genFill(patternWords, pair[1], pair[2]);
        }
        return genFill(patternWords, colorWords, onForm[2] ?? 'white');
    }
    return null;
}

function readOfficePattern(value: string) {
    if (!value.startsWith(PATTERN_PREFIX)) {
        return null;
    }
    const [prst, fg, bg] = value.slice(PATTERN_PREFIX.length).split(':');
    return { prst, fg, bg };
}

/**
 * A colour, else a gradient (`toOfficeGradient`), else a pattern
 * (`toOfficePattern`); null for none of them.
 */
export function toOfficeFill(value: unknown): string | null {
    return (
        toOfficeColor(value) ??
        toOfficeGradient(value) ??
        toOfficePattern(value)
    );
}

/**
 * A fill's `a:solidFill` or, for a gradient, its `a:gradFill`, every colour
 * `transparency` % see-through when given.
 */
export function genOfficeFillXml(fill: string, transparency?: number) {
    const alpha =
        transparency === undefined || transparency === 0
            ? null
            : String((100 - transparency) * 1000);
    const genColor = (hex: string) => {
        return (
            `<a:srgbClr val="${hex}"` +
            (alpha === null ? '/>' : `><a:alpha val="${alpha}"/></a:srgbClr>`)
        );
    };
    const pattern = readOfficePattern(fill);
    if (pattern !== null) {
        return (
            `<a:pattFill prst="${pattern.prst}">` +
            `<a:fgClr>${genColor(pattern.fg)}</a:fgClr>` +
            `<a:bgClr>${genColor(pattern.bg)}</a:bgClr></a:pattFill>`
        );
    }
    const gradient = readOfficeGradient(fill);
    if (gradient === null) {
        return `<a:solidFill>${genColor(fill)}</a:solidFill>`;
    }
    const last = gradient.colors.length - 1;
    return (
        '<a:gradFill rotWithShape="1"><a:gsLst>' +
        gradient.colors
            .map((hex, index) => {
                return (
                    `<a:gs pos="${Math.round((index * 100000) / last)}">` +
                    `${genColor(hex)}</a:gs>`
                );
            })
            .join('') +
        `</a:gsLst><a:lin ang="${gradient.angle}" scaled="0"/></a:gradFill>`
    );
}

/** A fill said back: a colour's words, or "a blend of blue … to purple …, top to bottom". */
export function toOfficeFillWords(fill: string) {
    const pattern = readOfficePattern(fill);
    if (pattern !== null) {
        const found = PATTERN_WORD_LIST.find((one) => {
            return one.prst === pattern.prst;
        });
        return (
            `a pattern of ${found?.words ?? pattern.prst} in ` +
            `${toOfficeColorWords(pattern.fg)} on ` +
            `${toOfficeColorWords(pattern.bg)}`
        );
    }
    const gradient = readOfficeGradient(fill);
    if (gradient === null) {
        return toOfficeColorWords(fill);
    }
    const direction = GRADIENT_DIRECTION_LIST.find((one) => {
        return one.angle === gradient.angle;
    });
    return (
        `a blend of ${gradient.colors.map(toOfficeColorWords).join(' to ')}` +
        (direction === undefined ? '' : `, ${direction.words}`)
    );
}

/** A colour said back: its plain name when it has one, else `#RRGGBB`. */
export function toOfficeColorWords(hex: string) {
    const named = Object.entries(colorList.main).find(([, value]) => {
        return value.replace(/^#/, '').toUpperCase() === hex;
    });
    return named === undefined ? `#${hex}` : `${named[0]} (#${hex})`;
}

function genColorReason(key: string, value: unknown) {
    return (
        `\`${key}\` ${JSON.stringify(value)} is not a colour: write it as ` +
        '#RRGGBB (green is #00B050) or a colour\'s English name ("dark ' +
        'blue").'
    );
}

// --- a look asked for --------------------------------------------------------

const ALIGN_WORD_MAP: Record<string, OfficeAlignType> = {
    left: 'left',
    start: 'left',
    center: 'center',
    centre: 'center',
    centered: 'center',
    centred: 'center',
    middle: 'center',
    right: 'right',
    end: 'right',
    justify: 'justify',
    justified: 'justify',
    both: 'justify',
};

const SIZE_WORD_MAP: Record<string, number> = {
    bigger: 1.2,
    larger: 1.2,
    smaller: 1 / 1.2,
};

/**
 * A size asked for against each word's own: "+20%" / "120%" (times 1.2),
 * "-10%", "+4" / "-2pt" (points added), "bigger" / "smaller". Null for a
 * plain size (`40`, "40pt") or nothing readable.
 */
function readSizeBy(value: unknown): { scale: number; add: number } | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim().toLowerCase();
    if (Object.hasOwn(SIZE_WORD_MAP, text)) {
        return { scale: SIZE_WORD_MAP[text], add: 0 };
    }
    const percent = /^([+-]?)(\d+(?:\.\d+)?)\s*%$/.exec(text);
    if (percent !== null) {
        const amount = Number(percent[2]) / 100;
        const scale =
            percent[1] === ''
                ? amount
                : 1 + (percent[1] === '-' ? -1 : 1) * amount;
        return scale > 0 && scale <= 10 ? { scale, add: 0 } : null;
    }
    const points = /^([+-])(\d+(?:\.\d+)?)\s*(?:pt|points?)?$/.exec(text);
    if (points !== null) {
        const add = (points[1] === '-' ? -1 : 1) * Number(points[2]);
        return Math.abs(add) <= 400 ? { scale: 1, add } : null;
    }
    return null;
}

/** A size changed as `sizeBy` asks, in points, kept to 1-400 by halves. */
function toChangedSize(
    current: number,
    sizeBy: { scale: number; add: number },
) {
    const size = current * sizeBy.scale + sizeBy.add;
    return Math.min(400, Math.max(1, Math.round(size * 2) / 2));
}

/**
 * The look a change asks for -- null when it asks for none -- or why it
 * cannot be written.
 */
/**
 * What a `link` asks for: a web address (a bare "www." one made https), a
 * slide to jump to as `slide:N`, null for none -- or undefined when it is
 * neither. Never a script, a file or anything but the web and mail.
 */
export function toOfficeLinkTarget(value: unknown): string | null | undefined {
    if (value === null) {
        return null;
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) && value > 0
            ? `slide:${value}`
            : undefined;
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    const text = value.trim();
    if (/^(?:none|off|no|remove)$/i.test(text) || text === '') {
        return null;
    }
    const slide = /^(?:slide\s*)?(\d{1,4})$/i.exec(text)?.[1];
    if (slide !== undefined) {
        return Number(slide) > 0 ? `slide:${Number(slide)}` : undefined;
    }
    if (text.length > 2000 || /[\s<>"]/.test(text)) {
        return undefined;
    }
    if (/^(?:https?:\/\/[^/]|mailto:[^@]+@)/i.test(text)) {
        return text;
    }
    if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]\S*)?$/i.test(text)) {
        return `https://${text}`;
    }
    return undefined;
}

const LINK_TOKEN_PREFIX = 'owaLink';

/** A link's place-keeping relationship id, its target in hex. */
export function toOfficeLinkToken(target: string) {
    return (
        LINK_TOKEN_PREFIX +
        [...new TextEncoder().encode(target)]
            .map((byte) => {
                return byte.toString(16).padStart(2, '0');
            })
            .join('')
    );
}

/** Every link token in a part's XML, with its target. */
export function listOfficeLinkTokens(xml: string) {
    const out = new Map<string, string>();
    const pattern = new RegExp(
        `r:id="(${LINK_TOKEN_PREFIX}((?:[0-9a-f]{2})+))"`,
        'g',
    );
    for (const matched of xml.matchAll(pattern)) {
        const bytes = (matched[2].match(/../g) ?? []).map((pair) => {
            return parseInt(pair, 16);
        });
        out.set(matched[1], new TextDecoder().decode(new Uint8Array(bytes)));
    }
    return out;
}

export function readOfficeLook(
    change: Record<string, unknown>,
): { look: OfficeLookType | null } | { reason: string } {
    const look: OfficeLookType = {};
    if (change.color !== undefined) {
        const color = toOfficeColor(change.color);
        if (color === null) {
            return { reason: genColorReason('color', change.color) };
        }
        look.color = color;
    }
    if (change.highlight !== undefined) {
        if (checkIsOfficeColorOff(change.highlight)) {
            look.highlight = null;
        } else {
            const color = toOfficeColor(change.highlight);
            if (color === null) {
                return {
                    reason: genColorReason('highlight', change.highlight),
                };
            }
            look.highlight = color;
        }
    }
    if (change.size !== undefined) {
        const sizeBy = readSizeBy(change.size);
        if (sizeBy !== null) {
            look.sizeBy = sizeBy;
        } else {
            const size =
                typeof change.size === 'number'
                    ? change.size
                    : Number(
                          String(change.size)
                              .trim()
                              .replace(/\s*(?:pt|points?)$/i, ''),
                      );
            if (!Number.isFinite(size) || size < 1 || size > 400) {
                return {
                    reason:
                        "`size` is the words' size in points (1 to 400), " +
                        'or a change of each word\'s own size: "+20%", ' +
                        '"-10%", "+4" (points).',
                };
            }
            // Word keeps half points, PowerPoint hundredths: both hold a half
            look.size = Math.round(size * 2) / 2;
        }
    }
    for (const key of [
        'bold',
        'italic',
        'underline',
        'strike',
        'shadow',
        'bullets',
    ] as const) {
        if (change[key] === undefined) {
            continue;
        }
        if (typeof change[key] !== 'boolean') {
            return { reason: `\`${key}\` is true or false.` };
        }
        look[key] = change[key];
    }
    if (change.link !== undefined) {
        const link = toOfficeLinkTarget(change.link);
        if (link === undefined) {
            return {
                reason:
                    '`link` is a web address (https://…, mailto:…), ' +
                    '"slide 3" to jump to a slide in the show, or "none".',
            };
        }
        look.link = link;
    }
    if (change.font !== undefined) {
        const font = typeof change.font === 'string' ? change.font.trim() : '';
        if (font === '' || font.length > 80 || /[<>&"]/.test(font)) {
            return {
                reason:
                    "`font` is a font's name as PowerPoint or Word lists " +
                    'it, e.g. "Arial".',
            };
        }
        look.font = font;
    }
    if (change.align !== undefined) {
        const align =
            ALIGN_WORD_MAP[String(change.align).trim().toLowerCase()] ?? null;
        if (align === null) {
            return {
                reason: `\`align\` is one of ${OFFICE_ALIGN_LIST.join(', ')}.`,
            };
        }
        look.align = align;
    }
    if (change.lineSpacing !== undefined) {
        const word = String(change.lineSpacing).trim().toLowerCase();
        const spacing =
            LINE_SPACING_WORD_MAP[word] ??
            Number(word.replace(/\s*(?:x|times|lines?)$/, ''));
        if (!Number.isFinite(spacing) || spacing < 0.5 || spacing > 5) {
            return {
                reason:
                    '`lineSpacing` is the space from line to line, times ' +
                    'one line: 1 (single), 1.5, 2 (double), up to 5.',
            };
        }
        look.lineSpacing = Math.round(spacing * 100) / 100;
    }
    return { look: Object.keys(look).length === 0 ? null : look };
}

/** A look said back in a few words: "colour green (#008000), 40 pt, bold". */
export function describeOfficeLook(look: OfficeLookType) {
    const words: string[] = [];
    if (look.color !== undefined) {
        words.push(`colour ${toOfficeColorWords(look.color)}`);
    }
    if (look.highlight !== undefined) {
        words.push(
            look.highlight === null
                ? 'no highlight'
                : `highlight ${toOfficeColorWords(look.highlight)}`,
        );
    }
    if (look.size !== undefined) {
        words.push(`${look.size} pt`);
    }
    if (look.sizeBy !== undefined) {
        const { scale, add } = look.sizeBy;
        if (scale !== 1) {
            const percent = Math.round(Math.abs(scale - 1) * 100);
            words.push(`${percent}% ${scale > 1 ? 'bigger' : 'smaller'}`);
        }
        if (add !== 0) {
            words.push(`${Math.abs(add)} pt ${add > 0 ? 'bigger' : 'smaller'}`);
        }
    }
    if (look.bold !== undefined) {
        words.push(look.bold ? 'bold' : 'not bold');
    }
    if (look.italic !== undefined) {
        words.push(look.italic ? 'italic' : 'not italic');
    }
    if (look.underline !== undefined) {
        words.push(look.underline ? 'underlined' : 'not underlined');
    }
    if (look.strike !== undefined) {
        words.push(look.strike ? 'struck through' : 'not struck through');
    }
    if (look.font !== undefined) {
        words.push(`font ${look.font}`);
    }
    if (look.link !== undefined) {
        words.push(
            look.link === null
                ? 'no link'
                : look.link.startsWith('slide:')
                  ? `a link to slide ${look.link.slice(6)}`
                  : `a link to ${look.link}`,
        );
    }
    if (look.align !== undefined) {
        words.push(`aligned ${look.align}`);
    }
    if (look.shadow !== undefined) {
        words.push(look.shadow ? 'a shadow behind the words' : 'no shadow');
    }
    if (look.lineSpacing !== undefined) {
        words.push(`line spacing ${look.lineSpacing}`);
    }
    if (look.bullets !== undefined) {
        words.push(look.bullets ? 'bullets' : 'no bullets');
    }
    return words.join(', ');
}

// --- an element's properties changed -----------------------------------------

export type ChildSetType = {
    name: string;
    // the child as it is to be written; null takes it out
    xml: string | null;
    // other children it stands in for (a fill of another kind)
    alsoRemove?: readonly string[];
};

type EditType = { start: number; end: number; replacement: string };

function escapeXmlAttribute(value: string) {
    return escapeXmlText(value).replace(/"/g, '&quot;');
}

/**
 * An open tag with one attribute set -- where it stood, when it did -- or
 * taken out with `null`.
 */
export function setAttribute(
    openTag: string,
    name: string,
    value: string | null,
) {
    const pattern = new RegExp(
        `\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*(?:"[^"]*"|'[^']*')`,
    );
    const written =
        value === null ? '' : ` ${name}="${escapeXmlAttribute(value)}"`;
    if (pattern.test(openTag)) {
        return openTag.replace(pattern, () => {
            return written;
        });
    }
    return value === null
        ? openTag
        : openTag.replace(/\s*(\/?)>$/, (_whole, slash: string) => {
              return `${written}${slash}>`;
          });
}

/**
 * A properties element written again: attributes set, children set or
 * taken out, each new child placed where `order` puts it; the children it
 * did not name kept in their order. Null when it cannot be read.
 */
export function patchElement(
    elementXml: string,
    attributes: Record<string, string | null>,
    children: readonly ChildSetType[],
    order: readonly string[],
) {
    const first = scanTags(elementXml).next().value;
    if (first === undefined || first.isClose) {
        return null;
    }
    let openTag = `<${first.name}${first.attributes.replace(/\s+$/, '')}>`;
    for (const [name, value] of Object.entries(attributes)) {
        openTag = setAttribute(openTag, name, value);
    }
    let kept: { name: string; xml: string }[] = [];
    if (!first.isSelfClosing) {
        const closeStart = elementXml.lastIndexOf(`</${first.name}>`);
        if (closeStart < first.end) {
            return null;
        }
        kept = listChildElements(elementXml, first.end, closeStart).map(
            (child) => {
                return {
                    name: child.name,
                    xml: elementXml.slice(child.start, child.end),
                };
            },
        );
    }
    for (const child of children) {
        const removedSet = new Set([child.name, ...(child.alsoRemove ?? [])]);
        kept = kept.filter((one) => {
            return !removedSet.has(one.name);
        });
        if (child.xml === null) {
            continue;
        }
        const index = order.indexOf(child.name);
        const at = kept.findIndex((one) => {
            return order.indexOf(one.name) > index;
        });
        kept.splice(at < 0 ? kept.length : at, 0, {
            name: child.name,
            xml: child.xml,
        });
    }
    if (kept.length === 0) {
        return openTag.replace(/>$/, '/>');
    }
    return (
        openTag +
        kept
            .map((one) => {
                return one.xml;
            })
            .join('') +
        `</${first.name}>`
    );
}

function applyEdits(xml: string, edits: readonly EditType[]) {
    let out = '';
    let cursor = 0;
    for (const edit of [...edits].sort((a, b) => {
        // an insert goes BEFORE a replacement starting at the same place
        return a.start - b.start || a.end - b.end;
    })) {
        out += xml.slice(cursor, edit.start) + edit.replacement;
        cursor = edit.end;
    }
    return out + xml.slice(cursor);
}

function findChild(xml: string, element: ElementType, name: string) {
    if (element.closeStart === element.end) {
        return null;
    }
    return (
        listChildElements(xml, element.openEnd, element.closeStart).find(
            (child) => {
                return child.name === name;
            },
        ) ?? null
    );
}

/**
 * The edit that gives a run (or a line break, or a field) its new look:
 * its properties written again, or made as its first child.
 */
function genRunEdit(
    xml: string,
    run: ElementType,
    propsName: string,
    patch: (propsXml: string) => string | null,
): EditType | null {
    const props = findChild(xml, run, propsName);
    if (props !== null) {
        const replacement = patch(xml.slice(props.start, props.end));
        return replacement === null
            ? null
            : { start: props.start, end: props.end, replacement };
    }
    const made = patch(`<${propsName}/>`);
    if (made === null) {
        return null;
    }
    if (run.closeStart === run.end) {
        // `<a:br/>`: opened to hold its properties
        const tag = xml.slice(run.start, run.end).replace(/\s*\/>$/, '>');
        return {
            start: run.start,
            end: run.end,
            replacement: `${tag}${made}</${run.name}>`,
        };
    }
    return { start: run.openEnd, end: run.openEnd, replacement: made };
}

// --- PowerPoint -------------------------------------------------------------

// The size a run with none of its own is drawn at when nothing it inherits
// says (PowerPoint's own default, and Word's Normal).
export const DEFAULT_PPTX_SIZE = 18;
export const DEFAULT_DOCX_SIZE = 11;

// CT_TextCharacterProperties' children, in the schema's order.
const PPTX_RUN_PROPS_ORDER_LIST = [
    'a:ln',
    'a:noFill',
    'a:solidFill',
    'a:gradFill',
    'a:blipFill',
    'a:pattFill',
    'a:grpFill',
    'a:effectLst',
    'a:effectDag',
    'a:highlight',
    'a:uLnTx',
    'a:uLn',
    'a:uFillTx',
    'a:uFill',
    'a:latin',
    'a:ea',
    'a:cs',
    'a:sym',
    'a:hlinkClick',
    'a:hlinkMouseOver',
    'a:rtl',
    'a:extLst',
];
const PPTX_FILL_LIST = [
    'a:noFill',
    'a:solidFill',
    'a:gradFill',
    'a:blipFill',
    'a:pattFill',
    'a:grpFill',
];
const PPTX_ALIGN_MAP: Record<OfficeAlignType, string> = {
    left: 'l',
    center: 'ctr',
    right: 'r',
    justify: 'just',
};

// PowerPoint's own "Offset: Bottom Right" text shadow, a little darker:
// read on a light picture and a dark one alike
const PPTX_TEXT_SHADOW_XML =
    '<a:effectLst><a:outerShdw blurRad="50800" dist="38100" ' +
    'dir="2700000" algn="tl" rotWithShape="0"><a:prstClr val="black">' +
    '<a:alpha val="70000"/></a:prstClr></a:outerShdw></a:effectLst>';
// CT_TextParagraphProperties' children, in the schema's order.
const PPTX_PARAGRAPH_PROPS_ORDER_LIST = [
    'a:lnSpc',
    'a:spcBef',
    'a:spcAft',
    'a:buClrTx',
    'a:buClr',
    'a:buSzTx',
    'a:buSzPct',
    'a:buSzPts',
    'a:buFontTx',
    'a:buFont',
    'a:buNone',
    'a:buAutoNum',
    'a:buChar',
    'a:buBlip',
    'a:tabLst',
    'a:defRPr',
    'a:extLst',
];
const PPTX_BULLET_LIST = ['a:buNone', 'a:buAutoNum', 'a:buChar', 'a:buBlip'];
// PowerPoint's own bullet indent: 0.375 inch hanging
const PPTX_BULLET_INDENT = 342900;

function genSolidFillXml(hex: string) {
    return `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
}

function patchPptxRunProps(
    propsXml: string,
    look: OfficeLookType,
    baseSize = DEFAULT_PPTX_SIZE,
) {
    const attributes: Record<string, string | null> = {};
    if (look.size !== undefined) {
        attributes.sz = String(Math.round(look.size * 100));
    } else if (look.sizeBy !== undefined) {
        const openTag = /^<[^>]*>/.exec(propsXml)?.[0] ?? '';
        const own = /\ssz="(\d+)"/.exec(openTag)?.[1];
        const current = own === undefined ? baseSize : Number(own) / 100;
        attributes.sz = String(
            Math.round(toChangedSize(current, look.sizeBy) * 100),
        );
    }
    if (look.bold !== undefined) {
        attributes.b = look.bold ? '1' : '0';
    }
    if (look.italic !== undefined) {
        attributes.i = look.italic ? '1' : '0';
    }
    if (look.underline !== undefined) {
        attributes.u = look.underline ? 'sng' : 'none';
    }
    if (look.strike !== undefined) {
        attributes.strike = look.strike ? 'sngStrike' : 'noStrike';
    }
    const children: ChildSetType[] = [];
    if (look.color !== undefined) {
        children.push({
            name: 'a:solidFill',
            xml: genSolidFillXml(look.color),
            alsoRemove: PPTX_FILL_LIST,
        });
    }
    if (look.highlight !== undefined) {
        children.push({
            name: 'a:highlight',
            xml:
                look.highlight === null
                    ? null
                    : `<a:highlight><a:srgbClr val="${look.highlight}"/></a:highlight>`,
        });
    }
    if (look.shadow !== undefined) {
        // an empty effect list says "none" over a shadow the box or the
        // layout gives its words
        children.push({
            name: 'a:effectLst',
            xml: look.shadow ? PPTX_TEXT_SHADOW_XML : '<a:effectLst/>',
            alsoRemove: ['a:effectDag'],
        });
    }
    if (look.font !== undefined) {
        // every script's face: the words asked about may be any of them
        for (const name of ['a:latin', 'a:ea', 'a:cs']) {
            children.push({
                name,
                xml: `<${name} typeface="${escapeXmlAttribute(look.font)}"/>`,
            });
        }
    }
    if (look.link !== undefined) {
        // its relationship is the part's: a token now, the id written
        // once every part is changed (`toOfficeLinkToken`)
        children.push({
            name: 'a:hlinkClick',
            xml:
                look.link === null
                    ? null
                    : `<a:hlinkClick r:id="${toOfficeLinkToken(look.link)}"/>`,
        });
    }
    return patchElement(
        propsXml,
        attributes,
        children,
        PPTX_RUN_PROPS_ORDER_LIST,
    );
}

// --- Word -------------------------------------------------------------------

// CT_ParaRPr / CT_RPr children, in the schema's order (the Word 2010
// effects after the base ones, a tracked change last).
const WORD_RUN_PROPS_ORDER_LIST = [
    'w:ins',
    'w:del',
    'w:moveFrom',
    'w:moveTo',
    'w:rStyle',
    'w:rFonts',
    'w:b',
    'w:bCs',
    'w:i',
    'w:iCs',
    'w:caps',
    'w:smallCaps',
    'w:strike',
    'w:dstrike',
    'w:outline',
    'w:shadow',
    'w:emboss',
    'w:imprint',
    'w:noProof',
    'w:snapToGrid',
    'w:vanish',
    'w:webHidden',
    'w:color',
    'w:spacing',
    'w:w',
    'w:kern',
    'w:position',
    'w:sz',
    'w:szCs',
    'w:highlight',
    'w:u',
    'w:effect',
    'w:bdr',
    'w:shd',
    'w:fitText',
    'w:vertAlign',
    'w:rtl',
    'w:cs',
    'w:em',
    'w:lang',
    'w:eastAsianLayout',
    'w:specVanish',
    'w:oMath',
    'w14:glow',
    'w14:shadow',
    'w14:reflection',
    'w14:textOutline',
    'w14:textFill',
    'w14:scene3d',
    'w14:props3d',
    'w14:ligatures',
    'w14:numForm',
    'w14:numSpacing',
    'w14:stylisticSets',
    'w14:cntxtAlts',
    'w:rPrChange',
];
// CT_PPr's children, in the schema's order.
const WORD_PARAGRAPH_PROPS_ORDER_LIST = [
    'w:pStyle',
    'w:keepNext',
    'w:keepLines',
    'w:pageBreakBefore',
    'w:framePr',
    'w:widowControl',
    'w:numPr',
    'w:suppressLineNumbers',
    'w:pBdr',
    'w:shd',
    'w:tabs',
    'w:suppressAutoHyphens',
    'w:kinsoku',
    'w:wordWrap',
    'w:overflowPunct',
    'w:topLinePunct',
    'w:autoSpaceDE',
    'w:autoSpaceDN',
    'w:bidi',
    'w:adjustRightInd',
    'w:snapToGrid',
    'w:spacing',
    'w:ind',
    'w:contextualSpacing',
    'w:mirrorIndents',
    'w:suppressOverlap',
    'w:jc',
    'w:textDirection',
    'w:textAlignment',
    'w:textboxTightWrap',
    'w:outlineLvl',
    'w:divId',
    'w:cnfStyle',
    'w:rPr',
    'w:sectPr',
    'w:pPrChange',
];
const WORD_ALIGN_MAP: Record<OfficeAlignType, string> = {
    left: 'left',
    center: 'center',
    right: 'right',
    justify: 'both',
};
// Where a run is never looked for: a content control's own settings, an
// equation (its runs are `m:r`).
const WORD_SKIPPED_SET = new Set([
    'w:pPr',
    'w:sdtPr',
    'w:sdtEndPr',
    'w:customXmlPr',
    'w:smartTagPr',
    'm:oMath',
    'm:oMathPara',
]);

function genOnOffXml(name: string, isOn: boolean) {
    return isOn ? `<${name}/>` : `<${name} w:val="0"/>`;
}

function patchWordRunProps(
    propsXml: string,
    look: OfficeLookType,
    baseSize = DEFAULT_DOCX_SIZE,
) {
    const children: ChildSetType[] = [];
    if (look.font !== undefined) {
        // a theme font named in rFonts outranks a named one: written whole
        const font = escapeXmlAttribute(look.font);
        children.push({
            name: 'w:rFonts',
            xml:
                `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" ` +
                `w:eastAsia="${font}" w:cs="${font}"/>`,
        });
    }
    if (look.bold !== undefined) {
        children.push(
            { name: 'w:b', xml: genOnOffXml('w:b', look.bold) },
            { name: 'w:bCs', xml: genOnOffXml('w:bCs', look.bold) },
        );
    }
    if (look.italic !== undefined) {
        children.push(
            { name: 'w:i', xml: genOnOffXml('w:i', look.italic) },
            { name: 'w:iCs', xml: genOnOffXml('w:iCs', look.italic) },
        );
    }
    if (look.color !== undefined) {
        // a Word 2010 text fill paints over the colour: it goes
        children.push({
            name: 'w:color',
            xml: `<w:color w:val="${look.color}"/>`,
            alsoRemove: ['w14:textFill'],
        });
    }
    let size = look.size;
    if (size === undefined && look.sizeBy !== undefined) {
        const own = /<w:sz\s+w:val="(\d+)"/.exec(propsXml)?.[1];
        size = toChangedSize(
            own === undefined ? baseSize : Number(own) / 2,
            look.sizeBy,
        );
    }
    if (size !== undefined) {
        const halfPoints = String(Math.round(size * 2));
        children.push(
            { name: 'w:sz', xml: `<w:sz w:val="${halfPoints}"/>` },
            { name: 'w:szCs', xml: `<w:szCs w:val="${halfPoints}"/>` },
        );
    }
    if (look.highlight !== undefined) {
        // `w:highlight` has sixteen colours; a shading takes any
        children.push({
            name: 'w:shd',
            xml:
                look.highlight === null
                    ? null
                    : `<w:shd w:val="clear" w:color="auto" w:fill="${look.highlight}"/>`,
            alsoRemove: ['w:highlight'],
        });
    }
    if (look.underline !== undefined) {
        children.push({
            name: 'w:u',
            xml: `<w:u w:val="${look.underline ? 'single' : 'none'}"/>`,
        });
    }
    if (look.strike !== undefined) {
        children.push({
            name: 'w:strike',
            xml: genOnOffXml('w:strike', look.strike),
            alsoRemove: ['w:dstrike'],
        });
    }
    if (look.shadow !== undefined) {
        // Word 2010's own shadow is drawn over the old one: it goes
        children.push({
            name: 'w:shadow',
            xml: genOnOffXml('w:shadow', look.shadow),
            alsoRemove: ['w14:shadow'],
        });
    }
    return patchElement(propsXml, {}, children, WORD_RUN_PROPS_ORDER_LIST);
}

// --- a line ------------------------------------------------------------------

function toRunLook(look: OfficeLookType) {
    const runLook: OfficeLookType = { ...look };
    for (const key of OFFICE_LINE_LOOK_KEY_LIST) {
        delete runLook[key];
    }
    return Object.keys(runLook).length === 0 ? null : runLook;
}

function genPptxEdits(
    inner: string,
    look: OfficeLookType,
    runLook: OfficeLookType | null,
    baseSize: number,
) {
    const edits: EditType[] = [];
    let props: ElementType | null = null;
    let endProps: ElementType | null = null;
    for (const child of listChildElements(inner, 0, inner.length)) {
        if (child.name === 'a:pPr') {
            props = child;
        } else if (child.name === 'a:endParaRPr') {
            endProps = child;
        } else if (
            runLook !== null &&
            (child.name === 'a:r' ||
                child.name === 'a:fld' ||
                child.name === 'a:br')
        ) {
            const edit = genRunEdit(inner, child, 'a:rPr', (xml) => {
                return patchPptxRunProps(xml, runLook, baseSize);
            });
            if (edit === null) {
                return null;
            }
            edits.push(edit);
        }
    }
    const lineAttributes: Record<string, string | null> = {};
    const lineChildren: ChildSetType[] = [];
    if (look.align !== undefined) {
        lineAttributes.algn = PPTX_ALIGN_MAP[look.align];
    }
    if (look.lineSpacing !== undefined) {
        lineChildren.push({
            name: 'a:lnSpc',
            xml:
                '<a:lnSpc><a:spcPct val="' +
                `${Math.round(look.lineSpacing * 100000)}"/></a:lnSpc>`,
        });
    }
    if (look.bullets !== undefined) {
        // a bullet hangs in its own indent; a line with none starts at the
        // box's edge, as PowerPoint's own Bullets button leaves it
        lineAttributes.marL = String(look.bullets ? PPTX_BULLET_INDENT : 0);
        lineAttributes.indent = String(look.bullets ? -PPTX_BULLET_INDENT : 0);
        lineChildren.push(
            look.bullets
                ? {
                      name: 'a:buChar',
                      xml: '<a:buChar char="&#8226;"/>',
                      alsoRemove: PPTX_BULLET_LIST,
                  }
                : {
                      name: 'a:buNone',
                      xml: '<a:buNone/>',
                      alsoRemove: PPTX_BULLET_LIST,
                  },
        );
    }
    if (Object.keys(lineAttributes).length > 0 || lineChildren.length > 0) {
        // the paragraph's properties are its first child
        const replacement = patchElement(
            props === null ? '<a:pPr/>' : inner.slice(props.start, props.end),
            lineAttributes,
            lineChildren,
            PPTX_PARAGRAPH_PROPS_ORDER_LIST,
        );
        if (replacement === null) {
            return null;
        }
        edits.push(
            props === null
                ? { start: 0, end: 0, replacement }
                : { start: props.start, end: props.end, replacement },
        );
    }
    if (runLook !== null) {
        // the look of the line's end: an empty line's height, words typed
        // there next
        const source =
            endProps === null
                ? '<a:endParaRPr/>'
                : inner.slice(endProps.start, endProps.end);
        const replacement = patchPptxRunProps(source, runLook, baseSize);
        if (replacement === null) {
            return null;
        }
        edits.push(
            endProps === null
                ? { start: inner.length, end: inner.length, replacement }
                : { start: endProps.start, end: endProps.end, replacement },
        );
    }
    return edits;
}

function genWordEdits(
    inner: string,
    look: OfficeLookType,
    runLook: OfficeLookType | null,
    baseSize: number,
) {
    const edits: EditType[] = [];
    let props: ElementType | null = null;
    let isUnreadable = false;
    const visit = (from: number, to: number, isTop: boolean) => {
        for (const child of listChildElements(inner, from, to)) {
            if (isTop && child.name === 'w:pPr') {
                props = child;
                continue;
            }
            if (child.name === 'w:r') {
                if (runLook === null) {
                    continue;
                }
                const edit = genRunEdit(inner, child, 'w:rPr', (xml) => {
                    return patchWordRunProps(xml, runLook, baseSize);
                });
                if (edit === null) {
                    isUnreadable = true;
                    return;
                }
                edits.push(edit);
                continue;
            }
            if (
                child.closeStart === child.end ||
                WORD_SKIPPED_SET.has(child.name)
            ) {
                continue;
            }
            // a link, a tracked change, a content control: the runs inside
            visit(child.openEnd, child.closeStart, false);
        }
    };
    visit(0, inner.length, true);
    if (isUnreadable) {
        return null;
    }
    const propsChildren: ChildSetType[] = [];
    if (look.align !== undefined) {
        propsChildren.push({
            name: 'w:jc',
            xml: `<w:jc w:val="${WORD_ALIGN_MAP[look.align]}"/>`,
        });
    }
    const found = props as ElementType | null;
    if (look.lineSpacing !== undefined) {
        // its space before and after kept: only the line's own height
        const spacing =
            found === null ? null : findChild(inner, found, 'w:spacing');
        let spacingXml =
            spacing === null
                ? '<w:spacing/>'
                : inner.slice(spacing.start, spacing.end);
        spacingXml = setAttribute(
            spacingXml,
            'w:line',
            String(Math.round(look.lineSpacing * 240)),
        );
        spacingXml = setAttribute(spacingXml, 'w:lineRule', 'auto');
        propsChildren.push({ name: 'w:spacing', xml: spacingXml });
    }
    if (runLook !== null) {
        // the paragraph mark's look: an empty line's height
        const markProps =
            found === null ? null : findChild(inner, found, 'w:rPr');
        const markXml = patchWordRunProps(
            markProps === null
                ? '<w:rPr/>'
                : inner.slice(markProps.start, markProps.end),
            runLook,
            baseSize,
        );
        if (markXml === null) {
            return null;
        }
        propsChildren.push({ name: 'w:rPr', xml: markXml });
    }
    if (propsChildren.length > 0) {
        const replacement = patchElement(
            found === null ? '<w:pPr/>' : inner.slice(found.start, found.end),
            {},
            propsChildren,
            WORD_PARAGRAPH_PROPS_ORDER_LIST,
        );
        if (replacement === null) {
            return null;
        }
        edits.push(
            found === null
                ? { start: 0, end: 0, replacement }
                : { start: found.start, end: found.end, replacement },
        );
    }
    return edits;
}

/**
 * A line (`<a:p>` / `<w:p>`) given a look: each run's properties changed
 * for the words' look, the paragraph's own for its alignment. Its words,
 * pictures, fields and links are left where they were. Null when the line
 * cannot be read.
 */
export function applyParagraphLook(
    paragraphXml: string,
    look: OfficeLookType,
    dialect: OfficeDialectType,
    baseSize = dialect === 'pptx' ? DEFAULT_PPTX_SIZE : DEFAULT_DOCX_SIZE,
) {
    const frame = readParagraphFrame(paragraphXml);
    if (frame === null) {
        return null;
    }
    const inner = frame.isSelfClosing
        ? ''
        : paragraphXml.slice(frame.innerStart, frame.innerEnd);
    const runLook = toRunLook(look);
    const edits =
        dialect === 'pptx'
            ? genPptxEdits(inner, look, runLook, baseSize)
            : genWordEdits(inner, look, runLook, baseSize);
    if (edits === null) {
        return null;
    }
    if (edits.length === 0) {
        return paragraphXml;
    }
    return frame.openTag + applyEdits(inner, edits) + frame.closeTag;
}

// --- some words of a line ---------------------------------------------------

const WORD_DIALECT_MAP = {
    pptx: {
        run: 'a:r',
        field: 'a:fld',
        text: 'a:t',
        props: 'a:rPr',
        paragraphProps: 'a:pPr',
        breaks: { 'a:br': '\n' } as Record<string, string>,
    },
    docx: {
        run: 'w:r',
        field: null,
        text: 'w:t',
        props: 'w:rPr',
        paragraphProps: 'w:pPr',
        breaks: { 'w:br': '\n', 'w:cr': '\n', 'w:tab': '\t' } as Record<
            string,
            string
        >,
    },
};

type PieceType = {
    // where its words start and end in the line's text
    from: number;
    to: number;
    // the text element, whole; null for a break
    node: { start: number; end: number; open: string; close: string } | null;
    text: string;
    // the run it is in; a field's is never split
    run: ElementType | null;
    isField: boolean;
};

/**
 * A line's words in order, each text element with the run it is in, as
 * `readParagraphText` counts them (a break is one letter).
 */
function listPieces(xml: string, dialect: OfficeDialectType) {
    const rule = WORD_DIALECT_MAP[dialect];
    const pieces: PieceType[] = [];
    const openRuns: { name: string; start: number; openEnd: number }[] = [];
    // a piece is told its run once the run closes
    const waiting: { piece: PieceType; depth: number }[] = [];
    let propsDepth = 0;
    let openText: { start: number; end: number } | null = null;
    let offset = 0;
    for (const tag of scanTags(xml)) {
        if (tag.name === rule.paragraphProps) {
            if (!tag.isSelfClosing) {
                propsDepth += tag.isClose ? -1 : 1;
            }
            continue;
        }
        if (propsDepth > 0) {
            continue;
        }
        const isRun = tag.name === rule.run || tag.name === rule.field;
        if (isRun && !tag.isSelfClosing) {
            if (!tag.isClose) {
                openRuns.push({
                    name: tag.name,
                    start: tag.start,
                    openEnd: tag.end,
                });
                continue;
            }
            const run = openRuns.pop();
            if (run === undefined) {
                continue;
            }
            const element: ElementType = {
                name: run.name,
                start: run.start,
                openEnd: run.openEnd,
                closeStart: tag.start,
                end: tag.end,
            };
            const depth = openRuns.length + 1;
            for (const one of waiting) {
                if (one.depth === depth) {
                    one.piece.run = element;
                    one.piece.isField = run.name === rule.field;
                }
            }
            // told: a later run at the same depth is another run
            waiting.splice(
                0,
                waiting.length,
                ...waiting.filter((item) => {
                    return item.depth !== depth;
                }),
            );
            continue;
        }
        if (tag.name === rule.text) {
            if (tag.isSelfClosing) {
                continue;
            }
            if (!tag.isClose) {
                openText = { start: tag.start, end: tag.end };
                continue;
            }
            if (openText === null) {
                continue;
            }
            const text = unescapeXml(xml.slice(openText.end, tag.start));
            const piece: PieceType = {
                from: offset,
                to: offset + text.length,
                node: {
                    start: openText.start,
                    end: tag.end,
                    open: xml.slice(openText.start, openText.end),
                    close: xml.slice(tag.start, tag.end),
                },
                text,
                run: null,
                isField: false,
            };
            offset += text.length;
            pieces.push(piece);
            if (openRuns.length > 0) {
                waiting.push({ piece, depth: openRuns.length });
            }
            openText = null;
            continue;
        }
        if (Object.hasOwn(rule.breaks, tag.name) && !tag.isClose) {
            const text = rule.breaks[tag.name];
            pieces.push({
                from: offset,
                to: offset + text.length,
                node: null,
                text,
                run: null,
                isField: false,
            });
            offset += text.length;
        }
    }
    return { pieces, text: pieces.map((piece) => piece.text).join('') };
}

function genTextNode(open: string, text: string, dialect: OfficeDialectType) {
    let tag = open;
    if (dialect === 'docx' && /^\s|\s$/.test(text) && !/xml:space=/.test(tag)) {
        tag = tag.replace(/^<w:t\b/, '<w:t xml:space="preserve"');
    }
    return `${tag}${escapeXmlText(text)}</${dialect === 'pptx' ? 'a:t' : 'w:t'}>`;
}

/** The line with the run holding letter `at` cut in two there, if it can be. */
function splitRunAt(xml: string, at: number, dialect: OfficeDialectType) {
    const { pieces } = listPieces(xml, dialect);
    const piece = pieces.find((one) => {
        return one.from < at && at < one.to;
    });
    if (
        piece === undefined ||
        piece.node === null ||
        piece.run === null ||
        piece.isField
    ) {
        return xml;
    }
    const { run, node } = piece;
    const rule = WORD_DIALECT_MAP[dialect];
    const props = listChildElements(xml, run.openEnd, run.closeStart).find(
        (child) => {
            return child.name === rule.props;
        },
    );
    const propsXml =
        props === undefined ? '' : xml.slice(props.start, props.end);
    const bodyStart = props === undefined ? run.openEnd : props.end;
    const openTag = xml.slice(run.start, run.openEnd);
    const closeTag = xml.slice(run.closeStart, run.end);
    const cut = at - piece.from;
    const first =
        openTag +
        propsXml +
        xml.slice(bodyStart, node.start) +
        genTextNode(node.open, piece.text.slice(0, cut), dialect) +
        closeTag;
    const second =
        openTag +
        propsXml +
        genTextNode(node.open, piece.text.slice(cut), dialect) +
        xml.slice(node.end, run.closeStart) +
        closeTag;
    return xml.slice(0, run.start) + first + second + xml.slice(run.end);
}

/** Where `words` are in `text`: as written, else in other capitals. */
function findWordPlaces(text: string, words: string) {
    const find = (haystack: string, needle: string) => {
        const places: number[] = [];
        let at = haystack.indexOf(needle);
        while (at >= 0 && needle !== '') {
            places.push(at);
            at = haystack.indexOf(needle, at + needle.length);
        }
        return places;
    };
    const exact = find(text, words);
    if (exact.length > 0) {
        return exact;
    }
    const lower = text.toLowerCase();
    return lower.length === text.length ? find(lower, words.toLowerCase()) : [];
}

/**
 * Some WORDS of a line given a look, the rest of it left as it was: the
 * runs holding them cut at the words' edges, and only the runs inside
 * given the look (2026-11-20: _make the word … red on slide 4_ had turned
 * the whole line red). Every place the words are in the line; `count` says
 * how many. Null when the line cannot be read. A line's alignment is the
 * whole line's, never some words'.
 */
export function applyWordsLook(
    paragraphXml: string,
    words: string,
    look: OfficeLookType,
    dialect: OfficeDialectType,
    baseSize = dialect === 'pptx' ? DEFAULT_PPTX_SIZE : DEFAULT_DOCX_SIZE,
): { xml: string; count: number } | null {
    const runLook = toRunLook(look);
    const { text } = listPieces(paragraphXml, dialect);
    const places = findWordPlaces(text, words);
    if (runLook === null || places.length === 0) {
        return { xml: paragraphXml, count: 0 };
    }
    let xml = paragraphXml;
    for (const place of places) {
        xml = splitRunAt(xml, place + words.length, dialect);
        xml = splitRunAt(xml, place, dialect);
    }
    const rule = WORD_DIALECT_MAP[dialect];
    const { pieces } = listPieces(xml, dialect);
    const runMap = new Map<number, { run: ElementType; isInside: boolean }>();
    for (const piece of pieces) {
        if (piece.run === null || piece.node === null || piece.text === '') {
            continue;
        }
        const isInside = places.some((place) => {
            return place <= piece.from && piece.to <= place + words.length;
        });
        const known = runMap.get(piece.run.start);
        runMap.set(piece.run.start, {
            run: piece.run,
            isInside: (known?.isInside ?? true) && isInside,
        });
    }
    const edits: EditType[] = [];
    for (const { run, isInside } of runMap.values()) {
        if (!isInside) {
            continue;
        }
        const edit = genRunEdit(xml, run, rule.props, (propsXml) => {
            return dialect === 'pptx'
                ? patchPptxRunProps(propsXml, runLook, baseSize)
                : patchWordRunProps(propsXml, runLook, baseSize);
        });
        if (edit === null) {
            return null;
        }
        edits.push(edit);
    }
    return { xml: applyEdits(xml, edits), count: places.length };
}

// --- a slide ----------------------------------------------------------------

/**
 * A slide's background as one colour or a gradient (`toOfficeFill`), or --
 * `null` -- back to its layout's. Null when the slide cannot be read.
 */
export function setSlideBackgroundXml(slideXml: string, hex: string | null) {
    const open = /<p:cSld\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/.exec(slideXml);
    if (open === null || open[1] === '/') {
        return null;
    }
    const innerStart = open.index + open[0].length;
    const innerEnd = slideXml.indexOf('</p:cSld>', innerStart);
    if (innerEnd < 0) {
        return null;
    }
    const background = listChildElements(slideXml, innerStart, innerEnd).find(
        (child) => {
            return child.name === 'p:bg';
        },
    );
    const backgroundXml =
        hex === null
            ? ''
            : `<p:bg><p:bgPr>${genOfficeFillXml(hex)}<a:effectLst/></p:bgPr></p:bg>`;
    // the background is the slide's first child
    return background === undefined
        ? slideXml.slice(0, innerStart) +
              backgroundXml +
              slideXml.slice(innerStart)
        : slideXml.slice(0, background.start) +
              backgroundXml +
              slideXml.slice(background.end);
}

/** A slide skipped by the show (`hidden`), or shown in it again. */
export function setSlideHiddenXml(slideXml: string, isHidden: boolean) {
    return slideXml.replace(/<p:sld\b[^>]*>/, (tag) => {
        return setAttribute(tag, 'show', isHidden ? '0' : null);
    });
}
