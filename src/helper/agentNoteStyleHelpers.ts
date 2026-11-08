/**
 * The Bible Note editor's TOOLBAR, as changes a model can ask for
 * (2026-11-08, the user, with a picture of the toolbar: _make chatbot able to
 * use all toolbar operations_). What each control writes into a note's
 * Lexical state, taken from the editor itself (`bible-note`'s toolbar and
 * the notes it saved):
 *
 * - the font box: `font-family: <name>;` on each run of words -- the six
 *   fonts the editor always lists, and each installed language's own face;
 * - the text and background colour pickers: `color: …;` and
 *   `background-color: …;`, cleared by their Remove;
 * - B / I / U, `</>` and the ••• menu: a run's `format` bits -- bold 1,
 *   italic 2, strikethrough 4, underline 8, code 16, subscript 32,
 *   superscript 64, highlight 128, lowercase 256, uppercase 512, capitalize
 *   1024 -- subscript and superscript one or the other, and the three cases
 *   one at a time, as the editor toggles them;
 * - Clear Formatting: every run's style and bits off, the block's alignment
 *   and indent back, a heading or quote made a paragraph;
 * - the alignment menu: the block's `format` (left, center, right, justify,
 *   start, end), and Indent / Outdent its `indent` -- a list item NESTED
 *   under the one before it, or taken back out, as the editor does.
 *
 * A toolbar acts on a SELECTION; here a change names the block and, with
 * `words`, the words in it the style is for -- runs are split where those
 * words start and end, every other run left as it was.
 *
 * Pure, like `agentNoteBlockHelpers.ts`, which applies these.
 */

type NodeType = Record<string, any>;

export const NOTE_STYLE_NAME_LIST = [
    'bold',
    'italic',
    'underline',
    'strikethrough',
    'code',
    'subscript',
    'superscript',
    'highlight',
    'lowercase',
    'uppercase',
    'capitalize',
] as const;
export type NoteStyleNameType = (typeof NOTE_STYLE_NAME_LIST)[number];

const STYLE_BIT_MAP: Record<NoteStyleNameType, number> = {
    bold: 1,
    italic: 2,
    strikethrough: 4,
    underline: 8,
    code: 16,
    subscript: 32,
    superscript: 64,
    highlight: 128,
    lowercase: 256,
    uppercase: 512,
    capitalize: 1024,
};
// Turning one on turns the others of its group off, as the editor does.
const EXCLUSIVE_STYLE_GROUP_LIST: NoteStyleNameType[][] = [
    ['subscript', 'superscript'],
    ['lowercase', 'uppercase', 'capitalize'],
];

export const NOTE_ALIGN_LIST = [
    'left',
    'center',
    'right',
    'justify',
    'start',
    'end',
    'none',
] as const;

/** The fonts the editor's font box always lists. */
export const NOTE_STANDARD_FONT_LIST = [
    'Arial',
    'Courier New',
    'Georgia',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
];

export const NOTE_INDENT_MAX = 10;

// --- a run's CSS ---------------------------------------------------------------

/** `color: red;font-size: 20px;` as an ordered map. */
export function parseStyleText(style: unknown) {
    const map = new Map<string, string>();
    if (typeof style !== 'string') {
        return map;
    }
    for (const part of style.split(';')) {
        const index = part.indexOf(':');
        if (index <= 0) {
            continue;
        }
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (key !== '' && value !== '') {
            map.set(key, value);
        }
    }
    return map;
}

/** As the editor writes it: `key: value;` with nothing between. */
export function toStyleText(map: Map<string, string>) {
    return [...map]
        .map(([key, value]) => {
            return `${key}: ${value};`;
        })
        .join('');
}

/**
 * A style with some properties set (in their place, a new one at the end)
 * or taken off (`null`) -- the editor's own patch. A style nothing changes
 * comes back as it was, byte for byte.
 */
export function patchStyleText(
    style: unknown,
    patch: Record<string, string | null>,
) {
    const map = parseStyleText(style);
    let isChanged = false;
    for (const [key, value] of Object.entries(patch)) {
        if (value === null) {
            isChanged = map.delete(key) || isChanged;
            continue;
        }
        if (map.get(key) !== value) {
            map.set(key, value);
            isChanged = true;
        }
    }
    if (!isChanged) {
        return typeof style === 'string' ? style : '';
    }
    return toStyleText(map);
}

// Every CSS colour name, written with no spaces: a model says "dark blue".
const CSS_COLOR_NAME_SET = new Set(
    (
        'aliceblue antiquewhite aqua aquamarine azure beige bisque black ' +
        'blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse ' +
        'chocolate coral cornflowerblue cornsilk crimson cyan darkblue ' +
        'darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
        'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon ' +
        'darkseagreen darkslateblue darkslategray darkslategrey darkturquoise ' +
        'darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick ' +
        'floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod ' +
        'gray green greenyellow grey honeydew hotpink indianred indigo ivory ' +
        'khaki lavender lavenderblush lawngreen lemonchiffon lightblue ' +
        'lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen ' +
        'lightgrey lightpink lightsalmon lightseagreen lightskyblue ' +
        'lightslategray lightslategrey lightsteelblue lightyellow lime ' +
        'limegreen linen magenta maroon mediumaquamarine mediumblue ' +
        'mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
        'mediumspringgreen mediumturquoise mediumvioletred midnightblue ' +
        'mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab ' +
        'orange orangered orchid palegoldenrod palegreen paleturquoise ' +
        'palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
        'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
        'seagreen seashell sienna silver skyblue slateblue slategray slategrey ' +
        'snow springgreen steelblue tan teal thistle tomato turquoise violet ' +
        'wheat white whitesmoke yellow yellowgreen'
    ).split(' '),
);
const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const FUNCTION_COLOR_PATTERN = /^(?:rgba?|hsla?)\(\s*[\d.%\s,/+-]+\)$/i;

/** A colour as CSS takes it, or null for words that are no colour. */
export function toCssColor(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim();
    if (HEX_COLOR_PATTERN.test(text)) {
        return text.toLowerCase();
    }
    if (FUNCTION_COLOR_PATTERN.test(text)) {
        return text.replace(/\s+/g, ' ');
    }
    const name = text.toLowerCase().replace(/[\s_-]+/g, '');
    return CSS_COLOR_NAME_SET.has(name) ? name : null;
}

/** "none", "remove", "default" … -- a colour or font taken off. */
export function checkIsStyleRemoval(value: unknown) {
    return (
        typeof value === 'string' &&
        /^(?:none|remove|default|clear|no ?colou?r|transparent)$/i.test(
            value.trim(),
        )
    );
}

/** A font of the list, by any case, or null. */
export function findNoteFont(value: unknown, fontList: readonly string[]) {
    if (typeof value !== 'string') {
        return null;
    }
    const wanted = value.trim().toLowerCase().replace(/\s+/g, ' ');
    return (
        fontList.find((font) => {
            return font.toLowerCase() === wanted;
        }) ?? null
    );
}

// --- text size (the toolbar's − [size] +) ---------------------------------------

export const NOTE_TEXT_SIZE_MIN = 8;
export const NOTE_TEXT_SIZE_MAX = 72;
export const NOTE_TEXT_SIZE_LARGER = 1.25;
export const NOTE_TEXT_SIZE_SMALLER = 0.8;
const NOTE_DEFAULT_TEXT_SIZE = 15;
// The editor's stylesheet: a body 15px, a h1 24px, a h3 12px, code 13px.
const KIND_TEXT_SIZE_MAP: Record<string, number> = {
    h1: 24,
    h3: 12,
    code: 13,
};
const FONT_SIZE_STYLE_PATTERN = /font-size:\s*([\d.]+)px;?\s*/;

export function checkIsNoteTextSize(value: unknown) {
    return (
        value === 'larger' ||
        value === 'smaller' ||
        (typeof value === 'number' &&
            Number.isFinite(value) &&
            value >= NOTE_TEXT_SIZE_MIN &&
            value <= NOTE_TEXT_SIZE_MAX)
    );
}

export function toNewTextSize(current: number, size: number | string) {
    const wanted =
        size === 'larger'
            ? current * NOTE_TEXT_SIZE_LARGER
            : size === 'smaller'
              ? current * NOTE_TEXT_SIZE_SMALLER
              : Number(size);
    return Math.min(
        NOTE_TEXT_SIZE_MAX,
        Math.max(NOTE_TEXT_SIZE_MIN, Math.round(wanted)),
    );
}

/** A run's size: its own, else the size its block is drawn at. */
export function readTextSize(style: unknown, kind: string) {
    const match =
        typeof style === 'string' ? FONT_SIZE_STYLE_PATTERN.exec(style) : null;
    return match !== null
        ? Number(match[1])
        : (KIND_TEXT_SIZE_MAP[kind] ?? NOTE_DEFAULT_TEXT_SIZE);
}

export function withTextSize(style: unknown, px: number) {
    const rest = (typeof style === 'string' ? style : '')
        .replace(FONT_SIZE_STYLE_PATTERN, '')
        .trim();
    return `${rest}${rest === '' || rest.endsWith(';') ? '' : ';'}font-size: ${px}px;`;
}

// --- what a change does to a run of words ---------------------------------------

export type NoteRunStyleType = {
    // A font of the list, or null to take the font off.
    font?: string | null;
    size?: number | string;
    // A CSS colour, or null to take it off.
    color?: string | null;
    background?: string | null;
    on?: readonly NoteStyleNameType[];
    off?: readonly NoteStyleNameType[];
    clear?: boolean;
};

function checkIsNode(value: unknown): value is NodeType {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Words a toolbar acts on: a run with text of its own. */
function checkIsRun(node: NodeType) {
    return (
        typeof node.text === 'string' &&
        node.type !== 'linebreak' &&
        node.type !== 'tab'
    );
}

function withStyleBits(
    format: number,
    on: readonly NoteStyleNameType[],
    off: readonly NoteStyleNameType[],
) {
    let bits = format;
    for (const name of off) {
        bits &= ~STYLE_BIT_MAP[name];
    }
    for (const name of on) {
        for (const group of EXCLUSIVE_STYLE_GROUP_LIST) {
            if (group.includes(name)) {
                for (const other of group) {
                    bits &= ~STYLE_BIT_MAP[other];
                }
            }
        }
        bits |= STYLE_BIT_MAP[name];
    }
    return bits;
}

function toStylePatch(style: NoteRunStyleType) {
    const patch: Record<string, string | null> = {};
    if (style.font !== undefined) {
        patch['font-family'] = style.font;
    }
    if (style.color !== undefined) {
        patch.color = style.color;
    }
    if (style.background !== undefined) {
        patch['background-color'] = style.background;
    }
    return patch;
}

/** One run of words restyled, in place. */
export function applyRunStyle(
    run: NodeType,
    kind: string,
    style: NoteRunStyleType,
) {
    if (style.clear === true) {
        if (typeof run.style === 'string' && run.style !== '') {
            run.style = '';
        }
        if (typeof run.format === 'number' && run.format !== 0) {
            run.format = 0;
        }
    }
    const patch = toStylePatch(style);
    if (Object.keys(patch).length > 0) {
        run.style = patchStyleText(run.style, patch);
    }
    if (style.size !== undefined) {
        run.style = withTextSize(
            run.style,
            toNewTextSize(readTextSize(run.style, kind), style.size),
        );
    }
    if ((style.on?.length ?? 0) + (style.off?.length ?? 0) > 0) {
        run.format = withStyleBits(
            typeof run.format === 'number' ? run.format : 0,
            style.on ?? [],
            style.off ?? [],
        );
    }
}

/**
 * The style a block gives words typed into it next (`textStyle`,
 * `textFormat`), when the whole block is restyled.
 */
export function applyBlockTypingStyle(
    node: NodeType,
    kind: string,
    style: NoteRunStyleType,
) {
    if (style.clear === true) {
        if (typeof node.textStyle === 'string') {
            node.textStyle = '';
        }
        if (typeof node.textFormat === 'number') {
            node.textFormat = 0;
        }
    }
    if (typeof node.textStyle === 'string') {
        const patch = toStylePatch(style);
        if (Object.keys(patch).length > 0) {
            node.textStyle = patchStyleText(node.textStyle, patch);
        }
        if (style.size !== undefined) {
            node.textStyle = withTextSize(
                node.textStyle,
                toNewTextSize(readTextSize(node.textStyle, kind), style.size),
            );
        }
    }
    if (
        typeof node.textFormat === 'number' &&
        (style.on?.length ?? 0) + (style.off?.length ?? 0) > 0
    ) {
        node.textFormat = withStyleBits(
            node.textFormat,
            style.on ?? [],
            style.off ?? [],
        );
    }
}

type RunSlotType = {
    owner: NodeType[];
    node: NodeType;
};

/**
 * Every run of words of a block, in order, deep through links, marks, a
 * quote's paragraphs and a fixed block's own parts (a table's cells, a
 * passage's lines) -- never into a list nested under a list item, whose
 * items are blocks of their own.
 */
function collectRunSlots(block: NodeType): RunSlotType[] {
    const slots: RunSlotType[] = [];
    const visit = (node: NodeType) => {
        const children = Array.isArray(node.children) ? node.children : [];
        for (const child of children) {
            if (!checkIsNode(child)) {
                continue;
            }
            if (child.type === 'list' && block.type === 'listitem') {
                continue;
            }
            if (checkIsRun(child) || child.type === 'linebreak') {
                slots.push({ owner: children, node: child });
                continue;
            }
            visit(child);
        }
    };
    visit(block);
    return slots;
}

/** Every run of words of a block (see `collectRunSlots`). */
export function collectBlockRuns(block: NodeType): NodeType[] {
    return collectRunSlots(block)
        .map((slot) => {
            return slot.node;
        })
        .filter(checkIsRun);
}

const WORD_CHAR_PATTERN = /[\p{L}\p{M}\p{N}]/u;

/**
 * Where the words are: as whole words first -- "fas" is not the middle of
 * "tasdfasd" (seen live 2026-11-08: a word made red took a piece of another
 * with it) -- then anywhere, for a script written with no spaces; the exact
 * words before the same words in another case.
 */
export function findWordRanges(text: string, words: string) {
    const search = (haystack: string, needle: string, isWhole: boolean) => {
        const ranges: [number, number][] = [];
        let index = haystack.indexOf(needle);
        while (index >= 0 && needle !== '') {
            const end = index + needle.length;
            const isWholeWord =
                !WORD_CHAR_PATTERN.test(haystack[index - 1] ?? '') &&
                !WORD_CHAR_PATTERN.test(haystack[end] ?? '');
            if (!isWhole || isWholeWord) {
                ranges.push([index, end]);
            }
            index = haystack.indexOf(needle, end);
        }
        return ranges;
    };
    const lowerText = text.toLowerCase();
    const lowerWords = words.toLowerCase();
    for (const isWhole of [true, false]) {
        for (const [haystack, needle] of [
            [text, words],
            [lowerText, lowerWords],
        ]) {
            const ranges = search(haystack, needle, isWhole);
            if (ranges.length > 0) {
                return ranges;
            }
        }
    }
    return [];
}

// What a model writes in place of a field: HTML round the words.
const TAG_STYLE_MAP: Record<string, NoteStyleNameType> = {
    b: 'bold',
    strong: 'bold',
    i: 'italic',
    em: 'italic',
    u: 'underline',
    s: 'strikethrough',
    del: 'strikethrough',
    strike: 'strikethrough',
    code: 'code',
    sub: 'subscript',
    sup: 'superscript',
    mark: 'highlight',
};

export type NoteWordsMarkupType = {
    words: string;
    color?: string;
    background?: string;
    font?: string;
    size?: number;
    on: NoteStyleNameType[];
};

/**
 * `words` as a model may write them: HTML round the words it means
 * (`tasdfasd <span style="color:red">fas</span> dfasd`, `<b>grace</b>`).
 * Seen live 2026-11-08: gemma4:cloud, asked to make one word red, sent the
 * block's words with a span round that word and no `color` at all. The
 * styled element's words are the words, its CSS and tags the style; with
 * no styled element, the tags are taken off. Null for words with no tag.
 */
export function readWordsMarkup(words: string): NoteWordsMarkupType | null {
    if (!/<\/?[a-z][^>]*>/i.test(words)) {
        return null;
    }
    const elementPattern =
        /<(span|font|b|strong|i|em|u|s|del|strike|code|sub|sup|mark)\b([^>]*)>([\s\S]*?)<\/\1>/i;
    const found = elementPattern.exec(words);
    const stripTags = (text: string) => {
        return text.replace(/<\/?[a-z][^>]*>/gi, '');
    };
    if (found === null) {
        return { words: stripTags(words).trim(), on: [] };
    }
    const [, tag, attributes, inner] = found;
    const read: NoteWordsMarkupType = {
        words: stripTags(inner).trim(),
        on: [],
    };
    const styleName = TAG_STYLE_MAP[tag.toLowerCase()];
    if (styleName !== undefined) {
        read.on.push(styleName);
    }
    const style = /style\s*=\s*["']([^"']*)["']/i.exec(attributes)?.[1] ?? '';
    const css = parseStyleText(style);
    const fontColor = /color\s*=\s*["']([^"']*)["']/i.exec(attributes)?.[1];
    const color = css.get('color') ?? fontColor;
    if (color !== undefined) {
        read.color = color;
    }
    const background = css.get('background-color') ?? css.get('background');
    if (background !== undefined) {
        read.background = background;
    }
    const font = css.get('font-family');
    if (font !== undefined) {
        read.font = font.replace(/["']/g, '').split(',')[0].trim();
    }
    const size = /^([\d.]+)px$/.exec(css.get('font-size') ?? '')?.[1];
    if (size !== undefined) {
        read.size = Number(size);
    }
    if (css.get('font-weight') === 'bold' || css.get('font-weight') === '700') {
        read.on.push('bold');
    }
    if (css.get('font-style') === 'italic') {
        read.on.push('italic');
    }
    return read;
}

/**
 * The runs that hold `words` in a block -- every place the words are, the
 * exact words first, else in any case -- split where the words start and
 * end so that only they are restyled. A mention or another run that cannot
 * be cut counts whole when the words touch it. Null when the block does
 * not hold the words; the block is left as it was then.
 */
export function splitRunsForWords(
    block: NodeType,
    words: string,
): NodeType[] | null {
    const slots = collectRunSlots(block);
    let text = '';
    const starts: number[] = [];
    for (const slot of slots) {
        starts.push(text.length);
        text += slot.node.type === 'linebreak' ? '\n' : String(slot.node.text);
    }
    const ranges = findWordRanges(text, words.trim());
    if (ranges.length === 0) {
        return null;
    }
    const targets: NodeType[] = [];
    slots.forEach((slot, index) => {
        const { node, owner } = slot;
        if (!checkIsRun(node)) {
            return;
        }
        const start = starts[index];
        const end = start + String(node.text).length;
        const overlaps = ranges.filter(([from, to]) => {
            return from < end && to > start;
        });
        if (overlaps.length === 0) {
            return;
        }
        const isCuttable =
            (node.type === 'text' || node.type === 'code-highlight') &&
            (node.mode === undefined || node.mode === 'normal');
        if (!isCuttable) {
            targets.push(node);
            return;
        }
        const cuts = new Set<number>([0, end - start]);
        for (const [from, to] of overlaps) {
            cuts.add(Math.max(0, from - start));
            cuts.add(Math.min(end - start, to - start));
        }
        const points = [...cuts].sort((one, other) => {
            return one - other;
        });
        const pieces: { node: NodeType; isInside: boolean }[] = [];
        for (let piece = 0; piece < points.length - 1; piece++) {
            const from = points[piece];
            const to = points[piece + 1];
            if (from === to) {
                continue;
            }
            pieces.push({
                node: { ...node, text: String(node.text).slice(from, to) },
                isInside: overlaps.some(([rangeFrom, rangeTo]) => {
                    return start + from >= rangeFrom && start + to <= rangeTo;
                }),
            });
        }
        if (pieces.length === 1) {
            // The run is the words whole: restyled where it is.
            targets.push(node);
            return;
        }
        owner.splice(
            owner.indexOf(node),
            1,
            ...pieces.map((piece) => {
                return piece.node;
            }),
        );
        for (const piece of pieces) {
            if (piece.isInside) {
                targets.push(piece.node);
            }
        }
    });
    return targets;
}

// --- alignment and indent ----------------------------------------------------------

/** Whether a block can be aligned: an element, or an object that keeps one. */
export function checkCanAlign(node: NodeType) {
    return typeof node.format === 'string' || Array.isArray(node.children);
}

export function applyBlockAlign(node: NodeType, align: string) {
    node.format = align === 'none' ? '' : align;
}

export function checkCanIndent(node: NodeType) {
    return typeof node.indent === 'number';
}

export function toNewIndent(current: number, indent: number | string) {
    const wanted =
        indent === 'more'
            ? current + 1
            : indent === 'less'
              ? current - 1
              : Math.round(Number(indent));
    return Math.min(NOTE_INDENT_MAX, Math.max(0, wanted));
}

// --- a list item nested one level deeper, or back out ------------------------------

function checkIsWrapperItem(item: NodeType) {
    const children = Array.isArray(item?.children) ? item.children : [];
    return (
        children.length > 0 &&
        children.every((child: NodeType) => {
            return child?.type === 'list';
        })
    );
}

function genWrapperItem(list: NodeType, items: NodeType[]): NodeType {
    return {
        children: [
            {
                ...list,
                children: items,
            },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'listitem',
        version: 1,
        value: 1,
    };
}

/** The list a list item is in, and that list's own place. */
export type ListPlaceType = {
    list: NodeType;
    // The wrapper item holding this list when it is nested, else null.
    wrapper: NodeType | null;
    // The list holding that wrapper.
    outerList: NodeType | null;
};

/** Where a list item is: found by a walk from the note's root. */
export function findListPlace(
    root: NodeType,
    item: NodeType,
): ListPlaceType | null {
    let found: ListPlaceType | null = null;
    const visit = (
        node: NodeType,
        wrapper: NodeType | null,
        outerList: NodeType | null,
    ) => {
        if (found !== null || !Array.isArray(node.children)) {
            return;
        }
        if (node.type === 'list' && node.children.includes(item)) {
            found = { list: node, wrapper, outerList };
            return;
        }
        for (const child of node.children) {
            if (!checkIsNode(child)) {
                continue;
            }
            if (node.type === 'list' && checkIsWrapperItem(child)) {
                for (const nested of child.children) {
                    visit(nested, child, node);
                }
                continue;
            }
            visit(child, wrapper, outerList);
        }
    };
    visit(root, null, null);
    return found;
}

/** A list item one level deeper, under the item before it (Indent). */
export function nestListItem(root: NodeType, item: NodeType) {
    const place = findListPlace(root, item);
    if (place === null) {
        return false;
    }
    const siblings: NodeType[] = place.list.children;
    const index = siblings.indexOf(item);
    const previous = siblings[index - 1];
    const next = siblings[index + 1];
    if (checkIsWrapperItem(previous)) {
        const inner = previous.children[previous.children.length - 1];
        inner.children.push(item);
        siblings.splice(index, 1);
        if (checkIsWrapperItem(next)) {
            // Two wrappers that now touch become one, as the editor makes it.
            inner.children.push(...next.children[0].children);
            siblings.splice(siblings.indexOf(next), 1);
        }
        return true;
    }
    if (checkIsWrapperItem(next)) {
        next.children[0].children.unshift(item);
        siblings.splice(index, 1);
        return true;
    }
    siblings.splice(index, 1, genWrapperItem(place.list, [item]));
    return true;
}

/** A nested list item one level back out (Outdent). */
export function unnestListItem(root: NodeType, item: NodeType) {
    const place = findListPlace(root, item);
    if (place === null || place.wrapper === null || place.outerList === null) {
        return false;
    }
    const { list, wrapper, outerList } = place;
    const siblings: NodeType[] = list.children;
    const index = siblings.indexOf(item);
    const before = siblings.slice(0, index);
    const after = siblings.slice(index + 1);
    const outerSiblings: NodeType[] = outerList.children;
    const wrapperIndex = outerSiblings.indexOf(wrapper);
    const placed: NodeType[] = [item];
    if (after.length > 0) {
        placed.push(genWrapperItem(list, after));
    }
    if (before.length > 0) {
        list.children = before;
        outerSiblings.splice(wrapperIndex + 1, 0, ...placed);
    } else {
        // The wrapper held nothing before this item: it goes, if empty.
        const remaining = wrapper.children.filter((one: NodeType) => {
            return one !== list;
        });
        if (remaining.length === 0) {
            outerSiblings.splice(wrapperIndex, 1, ...placed);
        } else {
            wrapper.children = remaining;
            outerSiblings.splice(wrapperIndex, 0, ...placed);
        }
    }
    return true;
}
