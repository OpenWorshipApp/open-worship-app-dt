/**
 * A Bible note as numbered BLOCKS, and changes to them that keep everything
 * else -- the rules behind `owa_note_edit` (2026-11-07, the user: _add `Open
 * in Chatbot` for bible-note … goal: chatbot can help modify and answer
 * everything on bible-note_).
 *
 * A note's `content` is the `bible-note` editor's serialized Lexical state:
 * headings, lists, verse mentions that CARRY their verse words, collapsible
 * passages, tables, pictures in base64, drawings, sticky notes. The older
 * `owa_bible_note update` wrote a note back as plain paragraphs and lost all
 * of that; here a change names the blocks it is about, only those are
 * rebuilt, and every other node is copied through as it was, byte for byte.
 *
 * What a model reads is a line a block: its kind and its words in a light
 * mark-up -- `**bold**`, `*italic*`, `__underline__`, `~~strike~~`,
 * `` `code` ``, `[words](https://…)` and a mention as `[^John 3:16]`,
 * `[@Moses]`, `[#Jerusalem]`. Written back, a mention token it kept is the
 * ORIGINAL node with its data (a verse mention's words, a person's id), a run
 * of words it did not change keeps its own colour, font and size, and new
 * words take the block's own style -- a note's language font included.
 *
 * Verse words are never a model's: a NEW verse (`[^Romans 8:28]`, or a
 * `passage` block) is resolved by the app from an installed Bible
 * (`agentNoteEditHelpers.ts`) and handed in here as `verseMap`.
 *
 * A verse mention says which Bible it is read from, as the editor names it:
 * `[^(KJV) John 3:16]` (2026-11-08, the user, asking a note conversation to
 * make the English lines' verses KJV: every verse it wrote came back in the
 * Bible the lookup was on, the token having said no Bible and a kept token
 * matching the old chip by its words alone). A token
 * kept as read is the ORIGINAL chip; one naming another Bible is a NEW verse
 * read from that Bible; one naming none matches a chip by its words.
 *
 * Pure on purpose -- no app, no editor package (heavy, and loaded only in a
 * note window) -- so every rule is tested against a real note's nodes.
 */

import {
    NOTE_ALIGN_LIST,
    NOTE_STANDARD_FONT_LIST,
    NOTE_STYLE_NAME_LIST,
    NOTE_TEXT_SIZE_MAX,
    NOTE_TEXT_SIZE_MIN,
    applyBlockAlign,
    applyBlockTypingStyle,
    applyRunStyle,
    checkCanAlign,
    checkCanIndent,
    checkIsNoteTextSize,
    checkIsStyleRemoval,
    collectBlockRuns,
    findNoteFont,
    nestListItem,
    readTextSize,
    readWordsMarkup,
    splitRunsForWords,
    toCssColor,
    toNewIndent,
    toNewTextSize,
    unnestListItem,
    withTextSize,
    type NoteRunStyleType,
    type NoteStyleNameType,
} from './agentNoteStyleHelpers';
import { normalizeNoteNode } from './agentNoteNormalizeHelpers';
import {
    chainListAdds,
    chainRewriteAdds,
    chainSectionAdds,
    expandPassageChanges,
    readHeadingMarks,
    readPassageLineRef,
    checkHasBlockMarkup,
    checkIsPassageRef,
    expandBlockSplits,
    expandSectionAdds,
} from './agentNoteMarkupHelpers';
import {
    genNoteBlockLink,
    type NoteBlockLinkType,
} from './agentNoteBlockLinkHelpers';
import {
    NOTE_INSERT_KIND_LIST,
    genNoteInsertNode,
    toNoteInsertText,
    type NoteInsertKindType,
} from './agentNoteInsertHelpers';
import {
    changeNoteDrawingNode,
    readNoteDrawingLines,
    readNoteDrawingScene,
    toNoteDrawingText,
} from './agentNoteDrawingHelpers';

export {
    NOTE_TEXT_SIZE_LARGER,
    NOTE_TEXT_SIZE_MAX,
    NOTE_TEXT_SIZE_MIN,
    NOTE_TEXT_SIZE_SMALLER,
    checkIsNoteTextSize,
} from './agentNoteStyleHelpers';

type NodeType = Record<string, any>;

export const NOTE_TEXT_KIND_LIST = [
    'paragraph',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'quote',
    'code',
] as const;
export const NOTE_LIST_KIND_LIST = ['bullet', 'number', 'check'] as const;
/**
 * What a change may make a block, or add: the words kinds, a passage, a
 * rule, and every object of the editor's Insert menu.
 */
export const NOTE_ADD_KIND_LIST = [
    ...NOTE_TEXT_KIND_LIST,
    ...NOTE_LIST_KIND_LIST,
    'passage',
    'rule',
    // Many blocks from mark-up lines at once (`expandSectionAdds`): an add
    // only, expanded before any rule reads it.
    'section',
    ...NOTE_INSERT_KIND_LIST,
] as const;

type NoteTextKindType = (typeof NOTE_TEXT_KIND_LIST)[number];
type NoteListKindType = (typeof NOTE_LIST_KIND_LIST)[number];
type NoteEditableKindType = NoteTextKindType | NoteListKindType;
export type NoteAddKindType = (typeof NOTE_ADD_KIND_LIST)[number];

export type NoteBlockType = {
    n: number;
    kind: string;
    text: string;
    // A list item inside another list item's list.
    level?: number;
    // A check list's tick.
    checked?: boolean;
    // Read only: moved or removed, never given words (a table, a picture, a
    // drawing, a sticky note, a passage, a rule …).
    isFixed?: boolean;
    // Its words were too long to show whole: it cannot be given new ones.
    isTextCut?: boolean;
};

/** A new verse, as the app resolved it for a `[^…]` token or a passage. */
export type NoteVerseType = {
    // "(KJV) John 3:16" -- the version and the reference, as the editor keeps
    // it on a mention and as a passage's title.
    mentionName: string;
    // "John 3:16" -- what the mention shows.
    shownText: string;
    // "(16): For God so loved …" -- the verse words, a line a chapter.
    verseText: string;
    // "font-family: app-<Family>;" for a Bible written in another script.
    style: string;
};

export type NoteEditChangeType = {
    block?: number;
    after?: number;
    kind?: string;
    text?: string;
    checked?: boolean;
    remove?: boolean;
    // An added block whose words another block has already, added on
    // purpose -- a refrain, a closing "Amen" (BN-44).
    again?: boolean;
    ref?: string;
    // The block's text size: px, or "larger" / "smaller" -- each run of
    // words scaled from its own size, so a heading stays above its lines.
    size?: number | string;
    // The toolbar on a block (`agentNoteStyleHelpers.ts`), for the whole
    // block or, with `words`, those words in it -- the selection.
    words?: string;
    font?: string;
    color?: string;
    background?: string;
    styles?: string[];
    stylesOff?: string[];
    clear?: boolean;
    align?: string;
    indent?: number | string;
    // A code block's language and colour theme, its own pickers.
    language?: string;
    theme?: string;
    // Link block text: from this block (its `words`, or all of it) to
    // block `linkTo` (its `linkToWords`, or all of it), the arrow
    // running `linkKind`.
    linkTo?: number;
    linkToWords?: string;
    linkKind?: string;
    // Set by the app, never by a model: every line of a block made several
    // (`expandBlockSplits`), for the check that it keeps its own words.
    splitText?: string;
    // Set by the app, never by a model: a new block of a note rewritten as
    // blocks numbered as they will stand, placed after the new block before
    // it (`chainRewriteAdds`).
    chain?: boolean;
};

/**
 * A code block's languages -- what its picker lists, the Prism list and the
 * shiki one together -- and shiki's colour themes.
 */
export const NOTE_CODE_LANGUAGE_LIST = [
    'c',
    'clike',
    'cpp',
    'css',
    'html',
    'java',
    'js',
    'javascript',
    'markdown',
    'objc',
    'objective-c',
    'plain',
    'powershell',
    'py',
    'python',
    'rust',
    'sql',
    'swift',
    'typescript',
    'xml',
];
export const NOTE_CODE_THEME_LIST = [
    'catppuccin-latte',
    'everforest-light',
    'github-light',
    'gruvbox-light-medium',
    'kanagawa-lotus',
    'dark-plus',
    'light-plus',
    'material-theme-lighter',
    'min-light',
    'one-light',
    'rose-pine-dawn',
    'slack-ochin',
    'snazzy-light',
    'solarized-light',
    'vitesse-light',
];

/** A new person or place mention, as the app found it in its names lookup. */
export type NoteNameType = {
    mentionId: string;
    mentionName: string;
};

export const NOTE_EDIT_MAX_CHANGES = 200;

// --- text size ----------------------------------------------------------------
//
// What the editor's own font-size box does (8 to 72, the size written on each
// run of words as `font-size: Npx;`), asked for in words (2026-11-08, the
// user, with a note conversation answering "make text bigger" with the
// toolbar's steps: _check why chatbot can't help increase text size_). A run
// with no size of its own is the size its block is drawn at: the editor's
// stylesheet gives a body 15px, a h1 24px, a h3 12px and code 13px.

/**
 * Every run of words in a block at its new size, and the size the block
 * gives words typed into it next. A nested list belongs to its own items.
 */
function resizeBlockNode(node: NodeType, kind: string, size: number | string) {
    if (typeof node.textStyle === 'string') {
        node.textStyle = withTextSize(
            node.textStyle,
            toNewTextSize(readTextSize(node.textStyle, kind), size),
        );
    }
    for (const child of childrenOf(node)) {
        if (!checkIsNode(child) || child.type === 'list') {
            continue;
        }
        if (typeof child.text === 'string' && child.type !== 'linebreak') {
            child.style = withTextSize(
                child.style,
                toNewTextSize(readTextSize(child.style, kind), size),
            );
            continue;
        }
        resizeBlockNode(child, kind, size);
    }
}
const MAX_TEXT_CHARS = 20000;
const MAX_TITLE_CHARS = 200;
// One block's words shown whole up to this; a longer one is read cut, and
// cannot then be given new words (its end would be lost).
const MAX_SHOWN_BLOCK_CHARS = 8000;
// What one read hands over at most: a long note is read on with `from`.
export const NOTE_READ_MAX_CHARS = 16000;

const INLINE_TEXTISH_TYPE_SET = new Set([
    'text',
    'linebreak',
    'tab',
    'mention',
    'link',
    'autolink',
    'mark',
    'hashtag',
    'keyword',
    'emoji',
    'specialText',
    'code-highlight',
]);
const INLINE_WRAPPER_TYPE_SET = new Set(['link', 'autolink', 'mark']);
const FIXED_KIND_MAP: Record<string, string> = {
    image: 'picture',
    excalidraw: 'drawing',
    youtube: 'video',
    website: 'website',
    equation: 'equation',
    datetime: 'date',
    poll: 'poll',
    sticky: 'sticky',
    table: 'table',
    horizontalrule: 'rule',
    'page-break': 'page-break',
    'layout-container': 'columns',
    'collapsible-container': 'passage',
};
// A collapsible block whose title is not a verse reference "(KJV) John 3:16".
const PASSAGE_TITLE_PATTERN = /^\([^)]+\)\s+\S/;

/** The kind an object of the editor reads as. */
function toFixedKind(node: NodeType) {
    if (node.type === 'collapsible-container') {
        const title = toPlainWords(childrenOf(node)[0] ?? {}).trim();
        return PASSAGE_TITLE_PATTERN.test(title) ? 'passage' : 'collapsible';
    }
    if (node.type === 'image' && node.mediaType && node.mediaType !== 'image') {
        return 'media';
    }
    return FIXED_KIND_MAP[node.type] ?? 'other';
}

// Lexical's text format bits.
const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKE = 4;
const FORMAT_UNDERLINE = 8;
const FORMAT_CODE = 16;

function checkIsNode(value: unknown): value is NodeType {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function childrenOf(node: NodeType): NodeType[] {
    return Array.isArray(node.children) ? node.children : [];
}

function cloneNode<T>(node: T): T {
    return JSON.parse(JSON.stringify(node));
}

/** A short fingerprint of a note's content: a read and a write must agree. */
export function genNoteContentHash(content: string) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < content.length; index++) {
        hash ^= content.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function genEmptyRoot(): NodeType {
    return {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
    };
}

/** The editor state's root, or null when it is not one (an older note). */
function readState(content: string): NodeType | null {
    if (content.trim() === '') {
        return { root: genEmptyRoot() };
    }
    try {
        const state = JSON.parse(content);
        return checkIsNode(state?.root) ? state : null;
    } catch (_error) {
        return null;
    }
}

// --- reading -----------------------------------------------------------------

type BlockRefType = {
    kind: string;
    node: NodeType;
    level: number;
    isFixed: boolean;
};

function listKindOf(list: NodeType): NoteListKindType {
    return list.listType === 'number' || list.listType === 'check'
        ? list.listType
        : 'bullet';
}

function checkIsWrapperItem(item: NodeType) {
    const children = childrenOf(item);
    return (
        children.length > 0 &&
        children.every((child) => {
            return child.type === 'list';
        })
    );
}

/** The kind of a block that is not a list, and whether it is read only. */
function blockKindOf(node: NodeType): { kind: string; isFixed: boolean } {
    if (node.type === 'heading') {
        const tag = /^h[1-6]$/.test(node.tag) ? node.tag : 'h1';
        return { kind: tag, isFixed: false };
    }
    if (node.type === 'paragraph' || node.type === 'quote') {
        const fixedChild = findFixedInline(node);
        if (fixedChild !== null) {
            return {
                kind: toFixedKind(fixedChild),
                isFixed: true,
            };
        }
        return { kind: node.type, isFixed: false };
    }
    if (node.type === 'code') {
        return { kind: 'code', isFixed: false };
    }
    return { kind: toFixedKind(node), isFixed: true };
}

/** A picture, drawing or other object sitting among a block's words. */
function findFixedInline(node: NodeType): NodeType | null {
    for (const child of childrenOf(node)) {
        if (child.type === 'paragraph' && node.type === 'quote') {
            const inner = findFixedInline(child);
            if (inner !== null) {
                return inner;
            }
            continue;
        }
        if (INLINE_WRAPPER_TYPE_SET.has(child.type)) {
            const inner = findFixedInline(child);
            if (inner !== null) {
                return inner;
            }
            continue;
        }
        if (!INLINE_TEXTISH_TYPE_SET.has(child.type)) {
            return child;
        }
    }
    return null;
}

function collectBlockRefs(root: NodeType): BlockRefType[] {
    const blockRefs: BlockRefType[] = [];
    const visitList = (list: NodeType, level: number) => {
        for (const item of childrenOf(list)) {
            if (item.type !== 'listitem') {
                continue;
            }
            if (checkIsWrapperItem(item)) {
                for (const nested of childrenOf(item)) {
                    visitList(nested, level + 1);
                }
                continue;
            }
            const fixedChild = findFixedInline(item);
            blockRefs.push({
                kind:
                    fixedChild === null
                        ? listKindOf(list)
                        : toFixedKind(fixedChild),
                node: item,
                level,
                isFixed: fixedChild !== null,
            });
        }
    };
    for (const node of childrenOf(root)) {
        if (!checkIsNode(node)) {
            continue;
        }
        if (node.type === 'list') {
            visitList(node, 0);
            continue;
        }
        const { kind, isFixed } = blockKindOf(node);
        blockRefs.push({ kind, node, level: 0, isFixed });
    }
    return blockRefs;
}

// Characters the mark-up uses, escaped where the words hold them.
const MARKUP_CHAR_PATTERN = /[\\*_~`[\]]/g;

function escapeMarkup(text: string) {
    return text.replace(MARKUP_CHAR_PATTERN, (char) => {
        return `\\${char}`;
    });
}

// Spaces at the edge of a run go OUTSIDE its marks: `**Text: **` reads as no
// mark-up at all to a model, and comes back wrong.
function wrapMarks(text: string, format: number) {
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
    let core = match[2];
    if (core === '') {
        return text;
    }
    if (format & FORMAT_CODE) {
        core = `\`${core}\``;
    }
    if (format & FORMAT_BOLD) {
        core = `**${core}**`;
    }
    if (format & FORMAT_ITALIC) {
        core = `*${core}*`;
    }
    if (format & FORMAT_UNDERLINE) {
        core = `__${core}__`;
    }
    if (format & FORMAT_STRIKE) {
        core = `~~${core}~~`;
    }
    return `${match[1]}${core}${match[3]}`;
}

const MENTION_SIGN_MAP: Record<string, string> = {
    'bible-verse': '^',
    mention: '@',
    location: '#',
};

// "(KJV) John 3:16": the Bible a verse is read from, in front of it -- how
// the editor names a verse mention (`mentionName`) and how a token may.
const VERSE_BIBLE_PREFIX_PATTERN = /^\(([^()\s]{1,40})\)\s+(\S.*)$/u;

/** A verse token's Bible, when it names one, and its reference. */
export function splitNoteVerseRef(text: string): {
    bibleKey: string | null;
    ref: string;
} {
    const trimmed = text.trim();
    const match = VERSE_BIBLE_PREFIX_PATTERN.exec(trimmed);
    return match === null
        ? { bibleKey: null, ref: trimmed }
        : { bibleKey: match[1], ref: match[2].trim() };
}

/** The Bible a verse mention was read from, off its `mentionName`. */
function readVerseMentionBibleKey(node: NodeType): string | null {
    return typeof node.mentionName === 'string'
        ? splitNoteVerseRef(node.mentionName).bibleKey
        : null;
}

/** A verse mention as a token's words: its Bible in front when it has one. */
function toVerseTokenText(node: NodeType) {
    const text = String(node.text ?? '').replace(/]/g, '');
    const bibleKey = readVerseMentionBibleKey(node);
    return bibleKey === null ? text : `(${bibleKey}) ${text}`;
}

/**
 * Whether a token's words name this verse mention: the same reference, and
 * -- when the token names a Bible -- the same Bible.
 */
function checkIsVerseToken(node: NodeType, tokenText: string) {
    const { bibleKey, ref } = splitNoteVerseRef(tokenText);
    if (String(node.text ?? '').trim() !== ref) {
        return false;
    }
    if (bibleKey === null) {
        return true;
    }
    const nodeBibleKey = readVerseMentionBibleKey(node);
    return (
        nodeBibleKey !== null &&
        nodeBibleKey.toLowerCase() === bibleKey.toLowerCase()
    );
}

function toInlineMarkup(nodes: NodeType[]): string {
    return nodes
        .map((node) => {
            if (!checkIsNode(node)) {
                return '';
            }
            if (node.type === 'linebreak') {
                return '\n';
            }
            if (node.type === 'tab') {
                return '\t';
            }
            if (node.type === 'mention') {
                if (node.mentionKind === 'bible-verse') {
                    return `[^${toVerseTokenText(node)}]`;
                }
                const sign = MENTION_SIGN_MAP[node.mentionKind] ?? '@';
                return `[${sign}${String(node.text ?? '').replace(/]/g, '')}]`;
            }
            if (node.type === 'link' || node.type === 'autolink') {
                return `[${toInlineMarkup(childrenOf(node))}](${String(node.url ?? '')})`;
            }
            if (node.type === 'mark') {
                return toInlineMarkup(childrenOf(node));
            }
            if (typeof node.text === 'string') {
                const format =
                    typeof node.format === 'number' ? node.format : 0;
                return wrapMarks(escapeMarkup(node.text), format);
            }
            return '';
        })
        .join('');
}

function toCodeText(node: NodeType): string {
    return childrenOf(node)
        .map((child) => {
            if (child.type === 'linebreak') {
                return '\n';
            }
            if (child.type === 'tab') {
                return '\t';
            }
            return typeof child.text === 'string' ? child.text : '';
        })
        .join('');
}

function checkIsQuoteOfParagraphs(node: NodeType) {
    const children = childrenOf(node);
    return (
        node.type === 'quote' &&
        children.length > 0 &&
        children.every((child) => {
            return child.type === 'paragraph';
        })
    );
}

/** The words of any node, plainly, for a read-only block's line. */
function toPlainWords(node: NodeType): string {
    if (node.type === 'linebreak') {
        return ' ';
    }
    if (typeof node.text === 'string') {
        return node.text;
    }
    if (node.type === 'sticky') {
        return toPlainWords(node.caption?.editorState?.root ?? {});
    }
    const children = childrenOf(node);
    const separator = children.some((child) => {
        return Array.isArray(child?.children);
    })
        ? ' | '
        : '';
    return children
        .map((child) => {
            return checkIsNode(child) ? toPlainWords(child) : '';
        })
        .filter((words) => {
            return words.trim() !== '';
        })
        .join(separator);
}

function toFixedText(ref: BlockRefType): string {
    const { node, kind } = ref;
    if (kind === 'table') {
        const rows = childrenOf(node);
        const columnCount = Math.max(
            0,
            ...rows.map((row) => {
                return childrenOf(row).length;
            }),
        );
        const firstRows = rows
            .slice(0, 3)
            .map((row) => {
                return childrenOf(row)
                    .map((cell) => {
                        return toPlainWords(cell).trim();
                    })
                    .join(' | ');
            })
            .join(' / ');
        return `${rows.length} rows x ${columnCount} columns: ${firstRows}`;
    }
    if (kind === 'passage' || kind === 'collapsible') {
        const [title, content] = childrenOf(node);
        return (
            `${toPlainWords(title ?? {}).trim()} — ` +
            toPlainWords(content ?? {}).trim()
        );
    }
    if (kind === 'sticky') {
        return `(${String(node.color ?? 'yellow')}) ${toPlainWords(node).trim()}`;
    }
    const object =
        toNoteInsertText(node) === null ? findFixedInline(node) : node;
    const objectText = object === null ? null : toNoteInsertText(object);
    if (objectText !== null) {
        return objectText;
    }
    return toPlainWords(node).trim();
}

function toBlockText(ref: BlockRefType): string {
    if (ref.isFixed) {
        return toFixedText(ref);
    }
    const { node } = ref;
    if (node.type === 'code') {
        return toCodeText(node);
    }
    if (checkIsQuoteOfParagraphs(node)) {
        return childrenOf(node)
            .map((paragraph) => {
                return toInlineMarkup(childrenOf(paragraph));
            })
            .join('\n');
    }
    return toInlineMarkup(childrenOf(node));
}

function toNoteBlock(ref: BlockRefType, index: number): NoteBlockType {
    const fullText = toBlockText(ref);
    const isTextCut = fullText.length > MAX_SHOWN_BLOCK_CHARS;
    return {
        n: index + 1,
        kind: ref.kind,
        text: isTextCut
            ? `${fullText.slice(0, MAX_SHOWN_BLOCK_CHARS)}…`
            : fullText,
        ...(ref.level > 0 ? { level: ref.level } : {}),
        ...(ref.kind === 'check' ? { checked: ref.node.checked === true } : {}),
        ...(ref.isFixed ? { isFixed: true } : {}),
        ...(isTextCut ? { isTextCut: true } : {}),
    };
}

export type NoteBlocksReadType = {
    hash: string;
    blockCount: number;
    blocks: NoteBlockType[];
    // A long note is read in parts: the block to read on from.
    nextFrom?: number;
};

/**
 * The note as numbered blocks, from block `from` (1 = the top) to as many as
 * fit in one read. Null for a note that is not editor content (an older
 * note, stored as HTML), which the tool then refuses to change.
 */
export function readNoteBlocks(
    content: string,
    from = 1,
): NoteBlocksReadType | null {
    const state = readState(content);
    if (state === null) {
        return null;
    }
    const refs = collectBlockRefs(state.root);
    const blocks: NoteBlockType[] = [];
    let size = 0;
    const start = Math.max(1, Math.floor(from));
    let nextFrom: number | undefined;
    for (let index = start - 1; index < refs.length; index++) {
        const block = toNoteBlock(refs[index], index);
        size += block.text.length + 24;
        if (blocks.length > 0 && size > NOTE_READ_MAX_CHARS) {
            nextFrom = index + 1;
            break;
        }
        blocks.push(block);
    }
    return {
        hash: genNoteContentHash(content),
        blockCount: refs.length,
        blocks,
        ...(nextFrom === undefined ? {} : { nextFrom }),
    };
}

// --- the mark-up, back into nodes -------------------------------------------

type RunType =
    | { kind: 'text'; text: string; format: number }
    | { kind: 'mention'; sign: string; text: string }
    | { kind: 'link'; url: string; runs: RunType[] }
    | { kind: 'linebreak' }
    | { kind: 'tab' };

type MarkerType = '**' | '*' | '__' | '~~' | '`';
const MARKER_FORMAT_MAP: Record<MarkerType, number> = {
    '**': FORMAT_BOLD,
    '*': FORMAT_ITALIC,
    __: FORMAT_UNDERLINE,
    '~~': FORMAT_STRIKE,
    '`': FORMAT_CODE,
};

function readMarker(text: string, index: number): MarkerType | null {
    for (const marker of ['**', '__', '~~', '*', '`'] as MarkerType[]) {
        if (text.startsWith(marker, index)) {
            return marker;
        }
    }
    return null;
}

const MENTION_TOKEN_PATTERN = /^\[([\^@#])([^\]\n]+)\]/;
const LINK_TOKEN_PATTERN =
    /^\[([^\]\n]*)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/;

function parseRuns(text: string, literalSet: Set<MarkerType>): RunType[] {
    const runs: RunType[] = [];
    let format = 0;
    let buffer = '';
    const flush = () => {
        if (buffer !== '') {
            runs.push({ kind: 'text', text: buffer, format });
            buffer = '';
        }
    };
    let index = 0;
    while (index < text.length) {
        const char = text[index];
        if ((format & FORMAT_CODE) !== 0) {
            // Inside code, only the closing backtick means anything.
            if (char === '`' && !literalSet.has('`')) {
                flush();
                format &= ~FORMAT_CODE;
                index++;
                continue;
            }
            buffer += char;
            index++;
            continue;
        }
        if (char === '\\' && index + 1 < text.length) {
            buffer += text[index + 1];
            index += 2;
            continue;
        }
        if (char === '\n' || char === '\t') {
            flush();
            runs.push({ kind: char === '\n' ? 'linebreak' : 'tab' });
            index++;
            continue;
        }
        if (char === '[') {
            const rest = text.slice(index);
            const mention = MENTION_TOKEN_PATTERN.exec(rest);
            if (mention !== null) {
                flush();
                runs.push({
                    kind: 'mention',
                    sign: mention[1],
                    text: mention[2].trim(),
                });
                index += mention[0].length;
                continue;
            }
            const link = LINK_TOKEN_PATTERN.exec(rest);
            if (link !== null) {
                flush();
                runs.push({
                    kind: 'link',
                    url: link[2],
                    runs: parseRuns(link[1], literalSet).map((run) => {
                        return run.kind === 'text'
                            ? { ...run, format: run.format | format }
                            : run;
                    }),
                });
                index += link[0].length;
                continue;
            }
        }
        const marker = readMarker(text, index);
        if (marker !== null && !literalSet.has(marker)) {
            flush();
            format ^= MARKER_FORMAT_MAP[marker];
            index += marker.length;
            continue;
        }
        buffer += char;
        index++;
    }
    flush();
    if (format !== 0) {
        // A mark opened and never closed is a character somebody meant: read
        // again with that one as a plain character.
        for (const marker of Object.keys(MARKER_FORMAT_MAP) as MarkerType[]) {
            if ((format & MARKER_FORMAT_MAP[marker]) !== 0) {
                literalSet.add(marker);
            }
        }
        return parseRuns(text, literalSet);
    }
    return runs;
}

/** A model copying the JSON escaping of the words it was shown. */
export function toRealLineBreaks(text: string) {
    return text.replace(/\\r\\n|\\n/g, '\n').replace(/\\t/g, '\t');
}

type BuildContextType = {
    // Every node of the block being rebuilt, by what it says -- taken once.
    textPool: NodeType[];
    mentionPool: NodeType[];
    linkPool: NodeType[];
    // A mention anywhere in the note: a verse copied from another block is
    // that verse, words and all.
    noteMentions: NodeType[];
    verseMap: Map<string, NoteVerseType>;
    // New people and places the app found in its names lookup, by
    // `toNameKey`.
    nameMap: Map<string, NoteNameType>;
    defaultStyle: string;
    // New verses the app could not resolve.
    missingVerses: string[];
};

/** "mention:Moses" / "location:Jerusalem": a new name's key. */
export function toNameKey(mentionKind: string, text: string) {
    return `${mentionKind}:${text.trim()}`;
}

function takeFrom<T>(pool: T[], test: (one: T) => boolean): T | null {
    const index = pool.findIndex(test);
    if (index < 0) {
        return null;
    }
    return pool.splice(index, 1)[0];
}

/**
 * The block's own text nodes that make up a run: one with its words, or
 * several side by side whose words add up to it -- the mark-up reads two
 * nodes of one format (a word in another font, a pasted piece) as one run,
 * and they come back as the nodes they were. Null when they do not.
 */
function takeTextNodes(
    pool: NodeType[],
    text: string,
    format: number,
): NodeType[] | null {
    const exact = takeFrom(pool, (one) => {
        return one.text === text && (one.format ?? 0) === format;
    });
    if (exact !== null) {
        return [exact];
    }
    const picked: NodeType[] = [];
    let rest = text;
    while (rest.length > 0) {
        const next = pool.find((one) => {
            return (
                !picked.includes(one) &&
                (one.format ?? 0) === format &&
                one.text.length > 0 &&
                rest.startsWith(one.text)
            );
        });
        if (next === undefined) {
            return null;
        }
        picked.push(next);
        rest = rest.slice(next.text.length);
    }
    for (const one of picked) {
        pool.splice(pool.indexOf(one), 1);
    }
    return picked.length > 0 ? picked : null;
}

function genTextNode(text: string, format: number, style: string): NodeType {
    return {
        detail: 0,
        format,
        mode: 'normal',
        style,
        text,
        type: 'text',
        version: 1,
    };
}

function genVerseMentionNode(verse: NoteVerseType): NodeType {
    return {
        detail: 1,
        format: 0,
        mode: 'segmented',
        style: verse.style,
        text: verse.shownText,
        type: 'mention',
        version: 1,
        mentionData: verse.verseText,
        mentionId: null,
        mentionKind: 'bible-verse',
        mentionName: verse.mentionName,
    };
}

/**
 * A run's edge spaces were read OUTSIDE its marks (`**Text:** `); where the
 * note held them as one node ("Text: ", bold), they are one run again, so
 * words given back unchanged are the node they were.
 */
function mergeEdgeSpaces(runs: RunType[], textPool: NodeType[]) {
    const checkHas = (text: string, format: number) => {
        return textPool.some((one) => {
            return one.text === text && (one.format ?? 0) === format;
        });
    };
    const checkIsSpace = (run: RunType | undefined) => {
        return (
            run?.kind === 'text' && run.format === 0 && run.text.trim() === ''
        );
    };
    const merged: RunType[] = [];
    for (let index = 0; index < runs.length; index++) {
        const run = runs[index];
        if (run.kind !== 'text' || run.format === 0) {
            merged.push(run.kind === 'text' ? { ...run } : run);
            continue;
        }
        // A formatted run: its spaces may sit on either side of it.
        const before = merged.at(-1);
        const after = runs[index + 1];
        const beforeText =
            checkIsSpace(before) && before?.kind === 'text' ? before.text : '';
        const afterText =
            checkIsSpace(after) && after?.kind === 'text' ? after.text : '';
        const tries: [string, boolean, boolean][] = [
            [
                beforeText + run.text + afterText,
                beforeText !== '',
                afterText !== '',
            ],
            [beforeText + run.text, beforeText !== '', false],
            [run.text + afterText, false, afterText !== ''],
        ];
        const found = tries.find(([text, isBefore, isAfter]) => {
            return (isBefore || isAfter) && checkHas(text, run.format);
        });
        if (found === undefined) {
            merged.push({ ...run });
            continue;
        }
        if (found[1]) {
            merged.pop();
        }
        if (found[2]) {
            index++;
        }
        merged.push({ ...run, text: found[0] });
    }
    return merged;
}

function buildInlineNodes(runs: RunType[], context: BuildContextType) {
    const nodes: NodeType[] = [];
    for (const run of mergeEdgeSpaces(runs, context.textPool)) {
        if (run.kind === 'linebreak') {
            nodes.push({ type: 'linebreak', version: 1 });
            continue;
        }
        if (run.kind === 'tab') {
            nodes.push({
                detail: 2,
                format: 0,
                mode: 'normal',
                style: '',
                text: '\t',
                type: 'tab',
                version: 1,
            });
            continue;
        }
        if (run.kind === 'text') {
            const kept = takeTextNodes(context.textPool, run.text, run.format);
            nodes.push(
                ...(kept !== null
                    ? kept.map(cloneNode)
                    : [
                          genTextNode(
                              run.text,
                              run.format,
                              context.defaultStyle,
                          ),
                      ]),
            );
            continue;
        }
        if (run.kind === 'link') {
            const kept = takeFrom(context.linkPool, (one) => {
                return one.url === run.url;
            });
            const { children: _children, ...props } = kept ?? {
                direction: null,
                format: '',
                indent: 0,
                type: 'link',
                version: 1,
                rel: 'noreferrer',
                target: null,
                title: null,
            };
            nodes.push({
                ...cloneNode(props),
                url: run.url,
                children: buildInlineNodes(run.runs, context),
            });
            continue;
        }
        // A mention.
        const mentionKind =
            run.sign === '^'
                ? 'bible-verse'
                : run.sign === '#'
                  ? 'location'
                  : 'mention';
        const isSame = (one: NodeType) => {
            if (one.mentionKind !== mentionKind) {
                return false;
            }
            // A verse by its words and, when the token names one, its Bible.
            return mentionKind === 'bible-verse'
                ? checkIsVerseToken(one, run.text)
                : String(one.text ?? '').trim() === run.text;
        };
        const kept =
            takeFrom(context.mentionPool, isSame) ??
            context.noteMentions.find(isSame) ??
            null;
        if (kept !== null) {
            nodes.push(cloneNode(kept));
            continue;
        }
        if (mentionKind === 'bible-verse') {
            const verse = context.verseMap.get(run.text);
            if (verse === undefined) {
                context.missingVerses.push(run.text);
                continue;
            }
            nodes.push(genVerseMentionNode(verse));
            continue;
        }
        // A NEW person or place, as the app found it in its names lookup
        // -- looked up only for a name a change adds; one it does not know
        // is written as the words.
        const name = context.nameMap.get(toNameKey(mentionKind, run.text));
        if (name !== undefined) {
            nodes.push({
                detail: 1,
                format: 0,
                mode: 'segmented',
                style: context.defaultStyle,
                text: run.text,
                type: 'mention',
                version: 1,
                mentionData: null,
                mentionId: name.mentionId,
                mentionKind,
                mentionName: name.mentionName,
            });
            continue;
        }
        nodes.push(genTextNode(run.text, 0, context.defaultStyle));
    }
    return nodes;
}

function collectNodes(
    node: NodeType,
    test: (one: NodeType) => boolean,
    out: NodeType[] = [],
) {
    for (const child of childrenOf(node)) {
        if (!checkIsNode(child)) {
            continue;
        }
        if (test(child)) {
            out.push(child);
        }
        collectNodes(child, test, out);
    }
    return out;
}

function findFirstStyle(node: NodeType): string {
    const textNode = collectNodes(node, (one) => {
        return one.type === 'text' && typeof one.style === 'string';
    })[0];
    if (textNode !== undefined) {
        return textNode.style;
    }
    return typeof node.textStyle === 'string' ? node.textStyle : '';
}

function genBuildContext(
    node: NodeType | null,
    root: NodeType,
    verseMap: Map<string, NoteVerseType>,
    defaultStyle: string,
    nameMap: Map<string, NoteNameType> = new Map(),
): BuildContextType {
    const pool = node === null ? [] : collectNodes(node, () => true);
    return {
        textPool: pool.filter((one) => {
            return typeof one.text === 'string' && one.type !== 'mention';
        }),
        mentionPool: pool.filter((one) => {
            return one.type === 'mention';
        }),
        linkPool: pool.filter((one) => {
            return one.type === 'link' || one.type === 'autolink';
        }),
        noteMentions: collectNodes(root, (one) => {
            return one.type === 'mention';
        }),
        verseMap,
        nameMap,
        defaultStyle,
        missingVerses: [],
    };
}

// --- whole blocks -------------------------------------------------------------

function genElementProps(source: NodeType | null) {
    return {
        direction: source?.direction ?? null,
        format: typeof source?.format === 'string' ? source.format : '',
        indent: typeof source?.indent === 'number' ? source.indent : 0,
        version: 1,
    };
}

function genTextBlockNode(
    kind: NoteTextKindType,
    children: NodeType[],
    source: NodeType | null,
    style: string,
): NodeType {
    const props = genElementProps(source);
    if (kind === 'paragraph') {
        return {
            children,
            ...props,
            type: 'paragraph',
            textFormat: 0,
            textStyle: style,
        };
    }
    if (kind === 'quote') {
        return {
            children,
            ...props,
            type: 'quote',
            textFormat: 0,
            textStyle: style,
        };
    }
    if (kind === 'code') {
        return { children, ...props, type: 'code', language: null };
    }
    return { children, ...props, type: 'heading', tag: kind };
}

function genListItemNode(
    children: NodeType[],
    kind: NoteListKindType,
    checked: boolean | undefined,
): NodeType {
    return {
        children,
        direction: null,
        format: '',
        indent: 0,
        type: 'listitem',
        version: 1,
        value: 1,
        ...(kind === 'check' ? { checked: checked === true } : {}),
    };
}

function genListNode(
    kind: NoteListKindType,
    items: NodeType[],
    source: NodeType | null,
    style: string,
): NodeType {
    return {
        ...(source === null ? {} : cloneNode(source)),
        children: items,
        direction: source?.direction ?? null,
        format: typeof source?.format === 'string' ? source.format : '',
        indent: typeof source?.indent === 'number' ? source.indent : 0,
        type: 'list',
        version: 1,
        textFormat: source?.textFormat ?? 0,
        textStyle: source?.textStyle ?? style,
        listType: kind,
        start: 1,
        tag: kind === 'number' ? 'ol' : 'ul',
    };
}

function genParagraphOfText(text: string, style: string): NodeType {
    return genTextBlockNode(
        'paragraph',
        text === '' ? [] : [genTextNode(text, 0, style)],
        null,
        style,
    );
}

function genPassageNode(verse: NoteVerseType): NodeType {
    const lines = verse.verseText.split('\n').filter((line) => {
        return line.trim() !== '';
    });
    return {
        children: [
            {
                children: [genParagraphOfText(verse.mentionName, verse.style)],
                direction: null,
                format: '',
                indent: 0,
                type: 'collapsible-title',
                version: 1,
                textStyle: verse.style,
            },
            {
                children: lines.map((line) => {
                    return genParagraphOfText(line, verse.style);
                }),
                direction: null,
                format: '',
                indent: 0,
                type: 'collapsible-content',
                version: 1,
            },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'collapsible-container',
        version: 1,
        open: true,
    };
}

function checkIsListKind(kind: string): kind is NoteListKindType {
    return (NOTE_LIST_KIND_LIST as readonly string[]).includes(kind);
}

function checkIsTextKind(kind: string): kind is NoteTextKindType {
    return (NOTE_TEXT_KIND_LIST as readonly string[]).includes(kind);
}

/** Where a node sits now: the array holding it and the node that owns it. */
function findParent(
    root: NodeType,
    target: NodeType,
): { owner: NodeType; children: NodeType[] } | null {
    const visit = (
        owner: NodeType,
    ): { owner: NodeType; children: NodeType[] } | null => {
        const children = childrenOf(owner);
        if (children.includes(target)) {
            return { owner, children };
        }
        for (const child of children) {
            if (checkIsNode(child)) {
                const found = visit(child);
                if (found !== null) {
                    return found;
                }
            }
        }
        return null;
    };
    return visit(root);
}

/**
 * Split a top-level list at one of its items: the items before stay, the
 * items after go to a copy of the list after it. Answers the item's index in
 * the root, where something may now go in its place.
 */
function splitListAround(root: NodeType, item: NodeType) {
    const parent = findParent(root, item);
    if (parent === null || parent.owner.type !== 'list') {
        return null;
    }
    const list = parent.owner;
    const listParent = findParent(root, list);
    if (listParent === null || listParent.owner !== root) {
        return null;
    }
    const itemIndex = list.children.indexOf(item);
    const after = list.children.slice(itemIndex + 1);
    list.children = list.children.slice(0, itemIndex);
    let listIndex = root.children.indexOf(list);
    if (after.length > 0) {
        const { children: _children, ...listProps } = list;
        root.children.splice(listIndex + 1, 0, {
            ...cloneNode(listProps),
            children: after,
        });
    }
    if (list.children.length === 0) {
        root.children.splice(listIndex, 1);
        listIndex--;
    }
    // The slot right after what stays before it.
    return listIndex + 1;
}

/**
 * Cut a top-level list right after one of its items: the items after it go
 * to a copy of the list. Answers the root index right after the item's list.
 */
function splitListAfter(root: NodeType, item: NodeType) {
    const list = findParent(root, item)!.owner;
    const listIndex = root.children.indexOf(list);
    const itemIndex = list.children.indexOf(item);
    const after = list.children.slice(itemIndex + 1);
    list.children = list.children.slice(0, itemIndex + 1);
    if (after.length > 0) {
        const { children: _children, ...listProps } = list;
        root.children.splice(listIndex + 1, 0, {
            ...cloneNode(listProps),
            children: after,
        });
    }
    return listIndex + 1;
}

/** The top-level node a block sits in. */
function findTopNode(root: NodeType, node: NodeType): NodeType | null {
    if (root.children.includes(node)) {
        return node;
    }
    for (const top of root.children) {
        if (
            checkIsNode(top) &&
            collectNodes(top, (one) => one === node).length > 0
        ) {
            return top;
        }
    }
    return null;
}

function removeBlockNode(root: NodeType, node: NodeType) {
    const parent = findParent(root, node);
    if (parent === null) {
        return;
    }
    parent.owner.children = parent.children.filter((one) => {
        return one !== node;
    });
    // A list left with no items goes too, and a wrapper item with no list.
    let owner = parent.owner;
    while (owner !== root && childrenOf(owner).length === 0) {
        const ownerParent = findParent(root, owner);
        if (ownerParent === null) {
            break;
        }
        ownerParent.owner.children = ownerParent.children.filter((one) => {
            return one !== owner;
        });
        owner = ownerParent.owner;
    }
}

/**
 * Put `node` (a top-level block, or a list item of `listKind`) after
 * `anchor` -- a block node, or null for the top of the note.
 */
function insertBlockNode(
    root: NodeType,
    anchor: NodeType | null,
    node: NodeType,
    listKind: NoteListKindType | null,
    style: string,
) {
    if (anchor === null) {
        const first = root.children[0];
        if (
            listKind !== null &&
            first?.type === 'list' &&
            listKindOf(first) === listKind
        ) {
            first.children.unshift(node);
            return;
        }
        root.children.unshift(
            listKind === null
                ? node
                : genListNode(listKind, [node], null, style),
        );
        return;
    }
    const parent = findParent(root, anchor);
    if (parent === null) {
        root.children.push(
            listKind === null
                ? node
                : genListNode(listKind, [node], null, style),
        );
        return;
    }
    if (parent.owner.type === 'list') {
        const list = parent.owner;
        if (listKind !== null && listKindOf(list) === listKind) {
            list.children.splice(list.children.indexOf(anchor) + 1, 0, node);
            return;
        }
        if (findParent(root, list)?.owner !== root) {
            // Inside a nested list: after the whole top-level list.
            const top = findTopNode(root, list)!;
            root.children.splice(
                root.children.indexOf(top) + 1,
                0,
                listKind === null
                    ? node
                    : genListNode(listKind, [node], null, style),
            );
            return;
        }
        // After an item of a list of another kind: the list is cut there.
        const slot = splitListAfter(root, anchor);
        root.children.splice(
            slot,
            0,
            listKind === null
                ? node
                : genListNode(listKind, [node], null, style),
        );
        return;
    }
    const index = root.children.indexOf(anchor);
    const next = root.children[index + 1];
    if (
        listKind !== null &&
        next?.type === 'list' &&
        listKindOf(next) === listKind
    ) {
        next.children.unshift(node);
        return;
    }
    root.children.splice(
        index + 1,
        0,
        listKind === null ? node : genListNode(listKind, [node], null, style),
    );
}

// --- the edit -----------------------------------------------------------------

export type NoteEditResultType =
    | {
          content: string;
          title: string | null;
          isChanged: boolean;
          summary: string;
          // Link block text entries, for the app to add to the editor's own
          // storage (they are no part of the note's content).
          blockLinks?: NoteBlockLinkType[];
      }
    | { reason: string };

function toReason(reason: string): { reason: string } {
    return { reason };
}

/**
 * New blocks put into a note that holds NOTHING -- only empty paragraphs,
 * the line a new note opens with -- take those lines' place (2026-11-10, a
 * sermon written into an empty note): the adds after them go at the top,
 * in the order given, and the empty lines go. A change that names any
 * block keeps the note as read, and a note with anything in it is left as
 * it is.
 */
export function withBlankNoteFilled(
    content: string,
    changes: readonly NoteEditChangeType[],
): NoteEditChangeType[] {
    const blocks = readNoteBlocks(content)?.blocks ?? [];
    const isBlank =
        blocks.length > 0 &&
        blocks.every((block) => {
            return (
                block.kind === 'paragraph' &&
                block.isFixed !== true &&
                block.text.trim() === ''
            );
        });
    const isOnlyAdds =
        changes.length > 0 &&
        changes.every((change) => {
            return (
                typeof change === 'object' &&
                change !== null &&
                change.block === undefined
            );
        });
    if (!isBlank || !isOnlyAdds) {
        return [...changes];
    }
    return [
        ...blocks.map((block) => {
            return { block: block.n, remove: true };
        }),
        ...changes.map((change) => {
            const after = change.after as number;
            return Number.isInteger(after) &&
                after >= 1 &&
                after <= blocks.length
                ? { ...change, after: 0 }
                : change;
        }),
    ];
}

/** Every verse a change would add that is not in the note already. */
export function collectNewNoteVerseRefs(
    content: string,
    changes: readonly NoteEditChangeType[],
) {
    const state = readState(content);
    const knownVerses =
        state === null
            ? []
            : collectNodes(state.root, (one) => {
                  return (
                      one.type === 'mention' &&
                      one.mentionKind === 'bible-verse'
                  );
              });
    const refs = new Set<string>();
    for (const change of changes) {
        if (change.kind === 'passage' && typeof change.ref === 'string') {
            refs.add(change.ref.trim());
        }
        if (typeof change.text !== 'string') {
            continue;
        }
        for (const match of change.text.matchAll(/\[\^([^\]\n]+)\]/g)) {
            const ref = match[1].trim();
            // A chip the note has -- in the Bible the token names, if it
            // names one -- is kept, never read again.
            const isKnown = knownVerses.some((one) => {
                return checkIsVerseToken(one, ref);
            });
            if (!isKnown) {
                refs.add(ref);
            }
        }
        // A token alone on its line of a section -- or alone in a paragraph,
        // naming a range -- is a PASSAGE printed whole, which no chip of the
        // note stands in for (BN-67: finishing an outline whose points
        // carried Luke 15:4, 5 and 7, a section opening each point on its
        // verse was refused -- "no installed Bible could read" them).
        const isParagraph =
            change.kind === undefined || change.kind === 'paragraph';
        const isSection =
            change.kind === 'section' ||
            (change.block === undefined &&
                isParagraph &&
                checkHasBlockMarkup(change.text));
        const lines = change.text.split(/\r?\n|\\n/);
        for (const line of lines) {
            const ref = readPassageLineRef(line);
            if (
                ref !== null &&
                (isSection ||
                    (lines.length === 1 &&
                        isParagraph &&
                        checkIsPassageRef(ref)))
            ) {
                refs.add(ref);
            }
        }
    }
    refs.delete('');
    return [...refs];
}

/**
 * Every person (`[@…]`) and place (`[#…]`) a change would add that the
 * note does not mention already -- what the app looks up in its names
 * lookup, and only then.
 */
export function collectNewNoteNameRefs(
    content: string,
    changes: readonly NoteEditChangeType[],
) {
    const state = readState(content);
    const known = new Set(
        state === null
            ? []
            : collectNodes(state.root, (one) => {
                  return one.type === 'mention';
              }).map((one) => {
                  return toNameKey(
                      String(one.mentionKind ?? 'mention'),
                      String(one.text ?? ''),
                  );
              }),
    );
    const refMap = new Map<
        string,
        { mentionKind: 'mention' | 'location'; text: string }
    >();
    for (const change of changes) {
        if (typeof change.text !== 'string') {
            continue;
        }
        for (const match of change.text.matchAll(/\[([@#])([^\]\n]+)\]/g)) {
            const mentionKind = match[1] === '#' ? 'location' : 'mention';
            const text = match[2].trim();
            const key = toNameKey(mentionKind, text);
            if (text !== '' && !known.has(key)) {
                refMap.set(key, { mentionKind, text });
            }
        }
    }
    return [...refMap.values()];
}

function checkIsBlockNumber(value: unknown, count: number) {
    return (
        Number.isInteger(value) &&
        (value as number) >= 1 &&
        (value as number) <= count
    );
}

/**
 * A word worth counting: three letters or more ("a", "of" are in any text),
 * or two in a script with no capitals, whose words are short -- two
 * characters are a word of their own in Chinese.
 */
function checkIsCountedWord(word: string) {
    const size = [...word].length;
    return size >= 3 || (size === 2 && !/\p{Cased}/u.test(word));
}

/**
 * The words of a block worth keeping, any script: cut by the segmenter, so
 * a script written with no spaces is words too (2026-11-08: split at the
 * spaces, a paragraph in a script without spaces was one or two "words", and the
 * guard below never held a heading off it); split at what is not a letter
 * where there is no segmenter.
 */
function toWordSet(text: string) {
    const lower = text.toLowerCase();
    const words =
        typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
            ? [
                  ...new Intl.Segmenter(undefined, {
                      granularity: 'word',
                  }).segment(lower),
              ]
                  .filter((one) => {
                      return one.isWordLike === true;
                  })
                  .map((one) => {
                      return one.segment;
                  })
            : lower.split(/[^\p{L}\p{M}\p{N}]+/u);
    return new Set(words.filter(checkIsCountedWord));
}

/**
 * Whether new words keep fewer than half of a block's own: a block of a
 * few words, or one whose words are mostly still there, loses nothing.
 */
function checkLosesWords(oldText: string, newText: string) {
    const oldWords = toWordSet(oldText);
    if (oldWords.size < 4) {
        return false;
    }
    const newWords = toWordSet(newText);
    let keptCount = 0;
    for (const word of oldWords) {
        if (newWords.has(word)) {
            keptCount++;
        }
    }
    return keptCount * 2 < oldWords.size;
}

function toComparableWords(text: string) {
    return text
        .replace(/[*_~`\\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

type ChangeStyleType = {
    run: NoteRunStyleType;
    hasRunStyle: boolean;
    align: string | null;
    indent: number | string | null;
};

const STYLE_FIELD_LIST = [
    'words',
    'font',
    'color',
    'background',
    'styles',
    'stylesOff',
    'clear',
    'align',
    'indent',
] as const;

function checkHasToolbarField(change: NoteEditChangeType) {
    return STYLE_FIELD_LIST.some((field) => {
        return change[field] !== undefined;
    });
}

function readStyleNames(
    value: unknown,
    field: string,
): { names: NoteStyleNameType[] } | { reason: string } {
    if (!Array.isArray(value)) {
        return { reason: `\`${field}\` is a list of style names.` };
    }
    const names: NoteStyleNameType[] = [];
    for (const one of value) {
        const name = String(one).trim().toLowerCase();
        const found = NOTE_STYLE_NAME_LIST.find((style) => {
            return (
                style === name ||
                (name === 'strike' && style === 'strikethrough')
            );
        });
        if (found === undefined) {
            return {
                reason:
                    `\`${field}\` names styles of ` +
                    `${NOTE_STYLE_NAME_LIST.join(', ')}.`,
            };
        }
        names.push(found);
    }
    return { names };
}

/**
 * The toolbar fields of a change, checked: what its runs of words get, its
 * alignment and its indent. A sticky note's `color` is its own colour, not
 * the words'.
 */
function readChangeStyle(
    change: NoteEditChangeType,
    fontList: readonly string[],
    isStickyColor: boolean,
): ChangeStyleType | { reason: string } {
    const run: NoteRunStyleType = {};
    if (change.font !== undefined) {
        if (checkIsStyleRemoval(change.font)) {
            run.font = null;
        } else {
            const font = findNoteFont(change.font, fontList);
            if (font === null) {
                return {
                    reason:
                        `\`font\` is one the font box lists: ` +
                        `${fontList.join(', ')} -- or "default" to take a ` +
                        'font off.',
                };
            }
            run.font = font;
        }
    }
    const colorFields: ('color' | 'background')[] = isStickyColor
        ? ['background']
        : ['color', 'background'];
    for (const field of colorFields) {
        const value = change[field];
        if (value === undefined) {
            continue;
        }
        if (checkIsStyleRemoval(value)) {
            run[field] = null;
            continue;
        }
        const color = toCssColor(value);
        if (color === null) {
            return {
                reason:
                    `\`${field}\` is a colour ("red", "dark blue", ` +
                    '"#1e88e5") or "none" to take it off.',
            };
        }
        run[field] = color;
    }
    for (const field of ['styles', 'stylesOff'] as const) {
        if (change[field] === undefined) {
            continue;
        }
        const read = readStyleNames(change[field], field);
        if ('reason' in read) {
            return read;
        }
        if (field === 'styles') {
            run.on = read.names;
        } else {
            run.off = read.names;
        }
    }
    if (
        (run.on ?? []).some((name) => {
            return (run.off ?? []).includes(name);
        })
    ) {
        return {
            reason: 'A style cannot be both in `styles` and `stylesOff`.',
        };
    }
    if (change.clear !== undefined) {
        if (change.clear !== true) {
            return { reason: '`clear` is true: Clear Formatting.' };
        }
        run.clear = true;
    }
    let align: string | null = null;
    if (change.align !== undefined) {
        const wanted = String(change.align).trim().toLowerCase();
        align = wanted === 'centre' || wanted === 'middle' ? 'center' : wanted;
        if (!(NOTE_ALIGN_LIST as readonly string[]).includes(align)) {
            return {
                reason: `\`align\` is one of ${NOTE_ALIGN_LIST.join(', ')}.`,
            };
        }
    }
    let indent: number | string | null = null;
    if (change.indent !== undefined) {
        indent = change.indent;
        if (!(
            indent === 'more' ||
            indent === 'less' ||
            (Number.isInteger(indent) &&
                (indent as number) >= 0 &&
                (indent as number) <= 10)
        )) {
            return {
                reason:
                    '`indent` is "more", "less" or a level from 0 to 10 (for ' +
                    'a list item, how deep it is nested).',
            };
        }
    }
    const hasRunStyle = Object.keys(run).length > 0;
    if (change.words !== undefined) {
        if (typeof change.words !== 'string' || change.words.trim() === '') {
            return { reason: '`words` are words of the block, as it reads.' };
        }
        if (
            !hasRunStyle &&
            change.size === undefined &&
            change.linkTo === undefined
        ) {
            return {
                reason:
                    '`words` pick the words a font, colour, size or style is ' +
                    'for: give one of those with them.',
            };
        }
    }
    return { run, hasRunStyle, align, indent };
}

/** Why a code block's language or theme cannot be what a change asks. */
function readCodeReason(
    change: NoteEditChangeType,
    kind: string,
    blockNumber: number | null,
): string | null {
    if (change.language === undefined && change.theme === undefined) {
        return null;
    }
    if (kind !== 'code') {
        return (
            `${blockNumber === null ? 'A new block' : `Block ${blockNumber}`} ` +
            'is not a code block: only a code block has a language and a theme.'
        );
    }
    if (
        change.language !== undefined &&
        !NOTE_CODE_LANGUAGE_LIST.includes(String(change.language).toLowerCase())
    ) {
        return `\`language\` is one of ${NOTE_CODE_LANGUAGE_LIST.join(', ')}.`;
    }
    if (
        change.theme !== undefined &&
        !NOTE_CODE_THEME_LIST.includes(String(change.theme).toLowerCase())
    ) {
        return `\`theme\` is one of ${NOTE_CODE_THEME_LIST.join(', ')}.`;
    }
    return null;
}

function applyCodeFields(node: NodeType, change: NoteEditChangeType) {
    if (node.type !== 'code') {
        return;
    }
    if (change.language !== undefined) {
        node.language = String(change.language).toLowerCase();
    }
    if (change.theme !== undefined) {
        node.theme = String(change.theme).toLowerCase();
    }
}

/**
 * A change whose `words` came with HTML round them: the words alone, and
 * what the HTML asked for in the fields (a field the change gives wins).
 */
function toPlainWordsChange(change: NoteEditChangeType): NoteEditChangeType {
    if (typeof change.words !== 'string') {
        return change;
    }
    const read = readWordsMarkup(change.words);
    if (read === null) {
        return change;
    }
    const styles = [...(change.styles ?? []), ...read.on];
    return {
        ...change,
        words: read.words,
        ...(change.color === undefined && read.color !== undefined
            ? { color: read.color }
            : {}),
        ...(change.background === undefined && read.background !== undefined
            ? { background: read.background }
            : {}),
        ...(change.font === undefined && read.font !== undefined
            ? { font: read.font }
            : {}),
        ...(change.size === undefined && read.size !== undefined
            ? { size: read.size }
            : {}),
        ...(styles.length > 0 ? { styles: [...new Set(styles)] } : {}),
    };
}

const MAX_DONE_TEXT_CHARS = 600;

// --- a drawing (BN-51) -------------------------------------------------------
//
// A drawing is a paragraph holding the board's `excalidraw` node: a size or a
// colour on the paragraph reached no words and changed nothing, while the
// summary listed it -- asked to make a drawing larger, gemma4:cloud sent
// `size` on its block and told the person it was larger (2026-11-09). So a
// drawing takes what changes IT: new lines (drawn again), `background` (its
// boxes), `color` (its lines), `size` larger or smaller (how large the board
// draws it) and `align`; anything else is refused, saying so.

const DRAWING_FIELDS_TEXT =
    'new lines in `text` (a line a box, "A -> B" an arrow, a first line ' +
    '"layout: across", "circle" or "center"), `background` (its boxes), ' +
    '`color` (its lines), `size` "larger" or "smaller", and `align`';

/** Why a change cannot be made to (or as) a drawing, or null. */
function readDrawingChangeReason(
    change: NoteEditChangeType,
    blockName: string,
    drawingNode: NodeType | null,
) {
    if (
        change.font !== undefined ||
        change.styles !== undefined ||
        change.stylesOff !== undefined ||
        change.clear !== undefined ||
        change.words !== undefined ||
        (change.size !== undefined &&
            change.size !== 'larger' &&
            change.size !== 'smaller')
    ) {
        return `${blockName} is a drawing: it takes ${DRAWING_FIELDS_TEXT}.`;
    }
    if (change.text !== undefined && drawingNode !== null) {
        if (!readNoteDrawingScene(drawingNode).isOwn) {
            return (
                `${blockName} is a drawing drawn by hand: drawing it again ` +
                'from lines would lose what was drawn. Add a new drawing ' +
                '({after, kind: "drawing", text}), or give it `background`, ' +
                '`color`, `size` or `align` only.'
            );
        }
        const read = readNoteDrawingLines(toRealLineBreaks(change.text));
        if (read.reason !== undefined) {
            return read.reason;
        }
    }
    return null;
}

/** The fill and line colours a change gives a drawing, as the board takes. */
function toDrawingColors(style: ChangeStyleType) {
    const { background, color } = style.run;
    return {
        fill:
            background === undefined
                ? undefined
                : background === null
                  ? 'transparent'
                  : background,
        stroke: color === undefined || color === null ? undefined : color,
    };
}

/** Puts `newNode` where `oldNode` sits, anywhere inside `owner`. */
function replaceInlineNode(
    owner: NodeType,
    oldNode: NodeType,
    newNode: NodeType,
): boolean {
    const children = childrenOf(owner);
    const index = children.indexOf(oldNode);
    if (index >= 0) {
        owner.children = children.map((child) => {
            return child === oldNode ? newNode : child;
        });
        return true;
    }
    return children.some((child) => {
        return checkIsNode(child) && replaceInlineNode(child, oldNode, newNode);
    });
}

/**
 * A drawing block changed in place: null when done (`drawnAgainSet` given
 * the change when its lines drew it anew), else why not.
 */
function applyDrawingChange(
    blockNode: NodeType,
    change: NoteEditChangeType,
    style: ChangeStyleType,
    context: { now?: Date; genId?: () => string },
    drawnAgainSet: Set<NoteEditChangeType>,
): string | null {
    const drawingNode = findFixedInline(blockNode);
    if (drawingNode === null || drawingNode.type !== 'excalidraw') {
        return 'That drawing could not be read.';
    }
    const { fill, stroke } = toDrawingColors(style);
    // Its own lines given back (with a colour, say) are no new drawing.
    const text =
        change.text === undefined ||
        toRealLineBreaks(change.text).trim() ===
            toNoteDrawingText(drawingNode).trim()
            ? undefined
            : toRealLineBreaks(change.text);
    if (
        text === undefined &&
        fill === undefined &&
        stroke === undefined &&
        change.size === undefined
    ) {
        return null;
    }
    const changed = changeNoteDrawingNode(
        drawingNode,
        {
            text,
            fill,
            stroke,
            size:
                change.size === 'larger' || change.size === 'smaller'
                    ? change.size
                    : undefined,
        },
        context,
    );
    if ('reason' in changed) {
        return changed.reason;
    }
    replaceInlineNode(blockNode, drawingNode, changed.node);
    if (text !== undefined) {
        drawnAgainSet.add(change);
    }
    return null;
}

/** One change's effect in a few words: "block 5 "fas": color red, bold on". */
function describeDoneChange(
    change: NoteEditChangeType,
    style: ChangeStyleType,
    isOwnWords: boolean,
    isDrawing = false,
) {
    if (isDrawing) {
        return describeDoneDrawing(change, style, isOwnWords);
    }
    const done: string[] = [];
    if (change.block === undefined) {
        done.push(`added ${change.kind ?? 'paragraph'}`);
    } else {
        if (change.text !== undefined && !isOwnWords) {
            done.push('new words');
        }
        if (change.kind !== undefined) {
            done.push(`made ${change.kind}`);
        }
        if (change.checked !== undefined) {
            done.push(change.checked ? 'ticked' : 'unticked');
        }
    }
    const { run } = style;
    if (run.clear === true) {
        done.push('formatting cleared');
    }
    if (change.size !== undefined) {
        done.push(`size ${change.size}`);
    }
    if (run.font !== undefined) {
        done.push(`font ${run.font ?? 'default'}`);
    }
    if (run.color !== undefined) {
        done.push(`color ${run.color ?? 'none'}`);
    }
    if (run.background !== undefined) {
        done.push(`background ${run.background ?? 'none'}`);
    }
    for (const name of run.on ?? []) {
        done.push(`${name} on`);
    }
    for (const name of run.off ?? []) {
        done.push(`${name} off`);
    }
    if (style.align !== null) {
        done.push(`aligned ${style.align}`);
    }
    if (style.indent !== null) {
        done.push(`indent ${style.indent}`);
    }
    if (change.language !== undefined) {
        done.push(`language ${change.language}`);
    }
    if (change.theme !== undefined) {
        done.push(`theme ${change.theme}`);
    }
    if (change.linkTo !== undefined) {
        done.push(`linked to block ${change.linkTo}`);
    }
    const where =
        change.block === undefined
            ? `after block ${change.after}`
            : `block ${change.block}`;
    const words =
        typeof change.words === 'string' ? ` "${change.words.trim()}"` : '';
    return `${where}${words}: ${done.join(', ')}`;
}

/** A drawing's change in a few words: "block 10: drawn again, boxes green". */
function describeDoneDrawing(
    change: NoteEditChangeType,
    style: ChangeStyleType,
    isDrawnAgain: boolean,
) {
    const done: string[] = [];
    if (change.block === undefined) {
        done.push('added drawing');
    } else if (isDrawnAgain) {
        done.push('drawing drawn again from the new lines');
    }
    const { fill, stroke } = toDrawingColors(style);
    if (fill !== undefined) {
        done.push(`boxes ${fill}`);
    }
    if (stroke !== undefined) {
        done.push(`lines ${stroke}`);
    }
    if (change.size !== undefined) {
        done.push(`drawing made ${change.size}`);
    }
    if (style.align !== null) {
        done.push(`aligned ${style.align}`);
    }
    const where =
        change.block === undefined
            ? `after block ${change.after}`
            : `block ${change.block}`;
    return `${where}: ${done.length > 0 ? done.join(', ') : 'nothing changed'}`;
}

/**
 * The toolbar on one block, as the change left it: its runs of words (or
 * only the `words` asked for), its alignment and its indent. A list item's
 * indent is how deep it is nested. Null when done, else why not.
 */
function applyChangeStyle(
    root: NodeType,
    node: NodeType,
    kind: string,
    level: number,
    change: NoteEditChangeType,
    style: ChangeStyleType,
    blockName: string,
): string | null {
    const isWordsSized =
        change.words !== undefined && change.size !== undefined;
    if (style.hasRunStyle || isWordsSized) {
        const runStyle: NoteRunStyleType = {
            ...style.run,
            ...(isWordsSized ? { size: change.size } : {}),
        };
        let runs: NodeType[];
        if (change.words !== undefined) {
            const found = splitRunsForWords(node, change.words);
            if (found === null) {
                return (
                    `${blockName} does not have the words "${change.words}". ` +
                    'Give `words` exactly as the block reads, without its ' +
                    'mark-up.'
                );
            }
            runs = found;
        } else {
            runs = collectBlockRuns(node);
            applyBlockTypingStyle(node, kind, runStyle);
        }
        for (const run of runs) {
            applyRunStyle(run, kind, runStyle);
        }
    }
    if (style.run.clear === true && change.words === undefined) {
        if (typeof node.format === 'string') {
            node.format = '';
        }
        if (typeof node.indent === 'number' && node.type !== 'listitem') {
            node.indent = 0;
        }
    }
    if (style.align !== null) {
        if (!checkCanAlign(node)) {
            return `${blockName} cannot be aligned.`;
        }
        applyBlockAlign(node, style.align);
    }
    if (style.indent !== null) {
        if (node.type === 'listitem') {
            let current = level;
            const wanted = toNewIndent(current, style.indent);
            while (current < wanted && nestListItem(root, node)) {
                current++;
            }
            while (current > wanted && unnestListItem(root, node)) {
                current--;
            }
            return null;
        }
        if (!checkCanIndent(node)) {
            return `${blockName} cannot be indented.`;
        }
        node.indent = toNewIndent(node.indent, style.indent);
    }
    return null;
}

/**
 * Apply a batch of changes to a note's content, all or nothing. Block
 * numbers are the note's as READ, whatever the batch does to them on the way.
 *
 * - `{block, text?, kind?, checked?}` changes a block;
 * - `{block, remove: true}` removes it;
 * - `{block, after}` moves it after block `after` (0 = the top);
 * - `{after, kind?, text?}` adds a block after block `after` (`passage` takes
 *   `ref`, a `rule` nothing).
 */
export function applyNoteEdit({
    content,
    changes,
    title = null,
    verseMap = new Map(),
    nameMap = new Map(),
    fontList = NOTE_STANDARD_FONT_LIST,
    now,
    genId,
    exampleNodes,
}: {
    content: string;
    changes: readonly NoteEditChangeType[];
    title?: string | null;
    verseMap?: Map<string, NoteVerseType>;
    // New people and places the app found, by `toNameKey`.
    nameMap?: Map<string, NoteNameType>;
    // What the font box lists: its six and each installed language's face.
    fontList?: readonly string[];
    now?: Date;
    genId?: () => string;
    // The editor's Default Example, read by the app only when asked for.
    exampleNodes?: NodeType[];
}): NoteEditResultType {
    const state = readState(content);
    if (state === null) {
        return toReason(
            'This note is kept in an older form that cannot be changed here. ' +
                'Ask the person to open it in its own window once, which ' +
                'brings it up to date.',
        );
    }
    // A section is the blocks its lines spell (`expandSectionAdds`); a block
    // changed into a passage's token is that passage (BN-67).
    changes = expandPassageChanges(expandSectionAdds(changes));
    if (changes.length > NOTE_EDIT_MAX_CHANGES) {
        return toReason(
            `At most ${NOTE_EDIT_MAX_CHANGES} changes in one call; send the ` +
                'rest in another.',
        );
    }
    let newTitle: string | null = null;
    if (title !== null) {
        newTitle = title.replace(/\s+/g, ' ').trim();
        if (newTitle === '' || newTitle.length > MAX_TITLE_CHARS) {
            return toReason(
                `A title is 1 to ${MAX_TITLE_CHARS} characters of words.`,
            );
        }
    }
    const root = state.root;
    // The blocks as they came: one this change leaves as it was is never
    // rewritten, byte for byte.
    const originalBlockTextSet = new Set(
        childrenOf(root).map((child) => {
            return JSON.stringify(child);
        }),
    );
    const refs = collectBlockRefs(root);
    const count = refs.length;
    // A block given its words as lines with a list kind or `section` is made
    // several, a block a line (BN-58).
    changes = expandBlockSplits(
        // The app's own marks, never a model's.
        changes.map((change) => {
            if (typeof change !== 'object' || change === null) {
                return change;
            }
            const { splitText: _splitText, chain: _chain, ...rest } = change;
            // A heading's marks written into its words (BN-67).
            const ref =
                typeof rest.block === 'number'
                    ? refs[rest.block - 1]
                    : undefined;
            return readHeadingMarks(
                rest,
                ref === undefined || ref.isFixed ? null : ref.kind,
            );
        }),
        (block) => {
            const ref = refs[block - 1];
            return ref === undefined || ref.isFixed
                ? null
                : toBlockText(ref).trim();
        },
    );
    // A note rewritten as new blocks numbered as they will stand (BN-58).
    changes = chainRewriteAdds(changes, count);
    // List items added in a row, numbered as they will stand: one list.
    changes = chainListAdds(changes, (block) => {
        return refs[block - 1]?.kind ?? null;
    });
    // A heading added with its words numbered as they will stand (BN-67).
    changes = chainSectionAdds(changes);
    const touched = new Set<number>();
    const updates: NoteEditChangeType[] = [];
    const removes: number[] = [];
    const moves: NoteEditChangeType[] = [];
    const adds: NoteEditChangeType[] = [];
    const styleMap = new Map<NoteEditChangeType, ChangeStyleType>();
    // Changes giving a block its OWN words back, as read: its nodes are kept.
    // The light mark-up cannot say a space inside a bold run, a comment's
    // mark or a code block's colouring, and rebuilding from it had moved the
    // space out of the bold, dropped the comment and flattened the code
    // (2026-11-08, BN-35, three blocks of a note in the dev data folder) --
    // a model sends a block's words back with a style or a kind all the time.
    const ownWordsChangeSet = new Set<NoteEditChangeType>();
    // Drawings drawn anew from new lines (BN-51), for the summary.
    const drawnAgainSet = new Set<NoteEditChangeType>();
    // Blocks given another kind and other words, checked for losing their
    // own once the call's adds are known.
    const kindWordsCheckList: {
        blockNumber: number;
        change: NoteEditChangeType;
        ref: BlockRefType;
    }[] = [];
    const checkIsDrawingChange = (change: NoteEditChangeType) => {
        if (change.block === undefined) {
            return change.kind === 'drawing';
        }
        const ref = refs[(change.block as number) - 1];
        return ref !== undefined && ref.isFixed && ref.kind === 'drawing';
    };
    for (const askedChange of changes) {
        if (!checkIsNode(askedChange)) {
            return toReason('Each change is an object.');
        }
        let change = toPlainWordsChange(askedChange);
        // A block this call adds, named by the number it would have: after
        // that new block, in the order given. Seen live 2026-11-08: asked
        // for a table and a sticky note at the end of an 8-block note,
        // gemma4:cloud put the sticky "after: 9" twice running.
        if (
            change.block === undefined &&
            change.chain !== true &&
            Number.isInteger(change.after) &&
            (change.after as number) > count &&
            (change.after as number) <= count + adds.length
        ) {
            change = {
                ...change,
                after: adds[(change.after as number) - count - 1].after,
            };
        }
        const style = readChangeStyle(
            change,
            fontList,
            change.block === undefined && change.kind === 'sticky',
        );
        if ('reason' in style) {
            return toReason(style.reason);
        }
        styleMap.set(change, style);
        if (change.size !== undefined && !checkIsNoteTextSize(change.size)) {
            return toReason(
                `\`size\` is "larger", "smaller" or a size in px from ` +
                    `${NOTE_TEXT_SIZE_MIN} to ${NOTE_TEXT_SIZE_MAX}.`,
            );
        }
        if (typeof change.text === 'string') {
            if (change.text.length > MAX_TEXT_CHARS) {
                return toReason(
                    `A block's words are ${MAX_TEXT_CHARS} characters at most.`,
                );
            }
        }
        if (change.block === undefined) {
            if (change.after === undefined) {
                return toReason(
                    'A change needs `block` (the block to change, remove or ' +
                        'move) or `after` (where a new block goes; 0 is the top).',
                );
            }
            if (
                change.chain !== true &&
                !(change.after === 0 || checkIsBlockNumber(change.after, count))
            ) {
                // Seen live 2026-11-08: gemma4:cloud put a sticky note
                // "after: 7" -- the table it was adding in the same call --
                // in a note of six blocks, twice.
                return toReason(
                    `\`after\` is 0 (the top) or a block number from 1 to ${count}, ` +
                        'the note as read: a block this call adds has no ' +
                        'number. Several new blocks after one block go in ' +
                        'the order given -- give them all that same `after`.',
                );
            }
            const kind = change.kind ?? 'paragraph';
            if (!(NOTE_ADD_KIND_LIST as readonly string[]).includes(kind)) {
                return toReason(
                    `A new block's kind is one of ${NOTE_ADD_KIND_LIST.join(', ')}.`,
                );
            }
            if (kind === 'passage') {
                if (
                    typeof change.ref !== 'string' ||
                    change.ref.trim() === ''
                ) {
                    return toReason(
                        'A passage needs `ref`, the Bible reference to put in ' +
                            '(e.g. "John 3:16-17"). Never write a verse\'s words ' +
                            'yourself.',
                    );
                }
            } else if (
                kind !== 'rule' &&
                kind !== 'page-break' &&
                kind !== 'date' &&
                kind !== 'example' &&
                toComparableWords(change.text ?? '') === ''
            ) {
                return toReason(
                    'A new block needs its words in `text` -- never an empty ' +
                        'block.',
                );
            }
            const addCodeReason = readCodeReason(change, kind, null);
            if (addCodeReason !== null) {
                return toReason(addCodeReason);
            }
            if (kind === 'drawing') {
                const drawingReason = readDrawingChangeReason(
                    { ...change, text: undefined },
                    'A new drawing',
                    null,
                );
                if (drawingReason !== null) {
                    return toReason(drawingReason);
                }
            }
            if (change.linkTo !== undefined) {
                return toReason(
                    'A link starts at a block that is there: link from it ' +
                        'in a second call, once the new block is read.',
                );
            }
            adds.push(change);
            continue;
        }
        if (!checkIsBlockNumber(change.block, count)) {
            return toReason(
                count === 0
                    ? 'This note has no blocks yet: add some with `after: 0`.'
                    : `\`block\` is a block number from 1 to ${count}.`,
            );
        }
        const blockNumber = change.block as number;
        if (touched.has(blockNumber)) {
            return toReason(
                `Block ${blockNumber} is named twice: give each block one ` +
                    'change.',
            );
        }
        touched.add(blockNumber);
        const ref = refs[blockNumber - 1];
        if (change.remove === true) {
            removes.push(blockNumber);
            continue;
        }
        if (change.after !== undefined) {
            if (
                !(
                    change.after === 0 ||
                    checkIsBlockNumber(change.after, count)
                ) ||
                change.after === blockNumber
            ) {
                return toReason(
                    '`after` for a move is 0 (the top) or another block number.',
                );
            }
            moves.push(change);
            continue;
        }
        // "Tick the first question" on a numbered or bulleted item, or a
        // line: only a check item has a tick, and a tick asked for on another
        // had changed nothing while the answer said it was already ticked
        // (BN-56, 2026-11-09, the elder run) -- it is made a check item,
        // ticked.
        if (
            change.checked !== undefined &&
            change.kind === undefined &&
            !ref.isFixed &&
            ref.kind !== 'check'
        ) {
            const checkedStyle = styleMap.get(change)!;
            change = { ...change, kind: 'check' };
            styleMap.set(change, checkedStyle);
        }
        const isDrawing = ref.isFixed && ref.kind === 'drawing';
        if (
            ref.isFixed &&
            ((change.text !== undefined && !isDrawing) ||
                change.kind !== undefined ||
                change.checked !== undefined)
        ) {
            return toReason(
                isDrawing
                    ? `Block ${blockNumber} is a drawing: it can be moved, ` +
                          `removed, or given ${DRAWING_FIELDS_TEXT} -- never ` +
                          'another kind.'
                    : `Block ${blockNumber} is a ${ref.kind}: it can be moved, ` +
                          'removed, styled, sized or aligned, never given ' +
                          'words or another kind.',
            );
        }
        if (isDrawing) {
            const drawingReason = readDrawingChangeReason(
                change,
                `Block ${blockNumber}`,
                findFixedInline(ref.node),
            );
            if (drawingReason !== null) {
                return toReason(drawingReason);
            }
        }
        if (change.text !== undefined && !ref.isFixed) {
            const ownText = toBlockText(ref);
            if (
                change.text === ownText ||
                toRealLineBreaks(change.text) === ownText
            ) {
                ownWordsChangeSet.add(change);
            }
        }
        if (
            change.text !== undefined &&
            toBlockText(ref).length > MAX_SHOWN_BLOCK_CHARS
        ) {
            return toReason(
                `Block ${blockNumber} was too long to read whole, so its ` +
                    'words cannot be replaced here.',
            );
        }
        if (
            change.kind !== undefined &&
            !checkIsTextKind(change.kind) &&
            !checkIsListKind(change.kind)
        ) {
            return toReason(
                `A block's kind is one of ${[...NOTE_TEXT_KIND_LIST, ...NOTE_LIST_KIND_LIST].join(', ')}.`,
            );
        }
        if (
            change.kind !== undefined &&
            change.kind !== ref.kind &&
            ref.level > 0
        ) {
            return toReason(
                `Block ${blockNumber} is inside another list item's list: its ` +
                    'words can change, its kind cannot.',
            );
        }
        // A block made another kind AND given other words is a block whose
        // words are gone: asked to tidy a note into headings, gemma4:cloud
        // turned a paragraph into the heading "The nature of grace" and the
        // paragraph was lost (seen live 2026-11-08). A new heading is a new
        // block; the paragraph keeps its words.
        // Judged once every add of the call is known: the new blocks put
        // right after it may carry the rest of its words (BN-58, a run-on
        // paragraph made a title with its parts as blocks after it).
        if (
            change.kind !== undefined &&
            change.kind !== ref.kind &&
            change.text !== undefined
        ) {
            kindWordsCheckList.push({ blockNumber, change, ref });
        }
        const codeReason = readCodeReason(
            change,
            change.kind ?? ref.kind,
            blockNumber,
        );
        if (codeReason !== null) {
            return toReason(codeReason);
        }
        if (
            change.linkTo !== undefined &&
            (!checkIsBlockNumber(change.linkTo, count) ||
                change.linkTo === blockNumber)
        ) {
            return toReason(
                `\`linkTo\` is another block's number, 1 to ${count}.`,
            );
        }
        if (
            change.text === undefined &&
            change.kind === undefined &&
            change.checked === undefined &&
            change.size === undefined &&
            change.language === undefined &&
            change.theme === undefined &&
            change.linkTo === undefined &&
            !checkHasToolbarField(change)
        ) {
            return toReason(
                `The change to block ${blockNumber} says nothing to change: ` +
                    'give `text`, `kind`, `size`, `checked` or a style (or ' +
                    '`remove: true`).',
            );
        }
        updates.push(change);
    }

    // A block given another kind and other words keeps its own words --
    // counting the new blocks this call puts right after it, and the run of
    // blocks numbered as they will stand (`chain`), which carry the rest.
    for (const { blockNumber, change, ref } of kindWordsCheckList) {
        const followingText = adds
            .filter((add) => {
                return add.after === blockNumber || add.chain === true;
            })
            .map((add) => add.text ?? '')
            .join(' ');
        const keptText = `${change.splitText ?? change.text ?? ''} ${followingText}`;
        if (checkLosesWords(toBlockText(ref), keptText)) {
            return toReason(
                `Making block ${blockNumber} a ${change.kind} with other words ` +
                    'would lose its own words. Add the new words as a NEW ' +
                    `block ({after: ${blockNumber - 1}, kind: "${change.kind}", ` +
                    `text}) and leave block ${blockNumber}'s words as they are ` +
                    `(give \`kind\` alone to change only its kind), or make it ` +
                    `several: {block: ${blockNumber}, kind: "section", text: ` +
                    '"## A heading\\n- a point"} with all its words.',
            );
        }
    }

    // A model "adding" a block that is already there, untouched by this
    // change: the words were meant as a change to that block -- unless it
    // says `again`. BN-44 (2026-11-09): _add a line at the end saying
    // Fitiavana Andriamanitra_ to a note that had that line already was
    // refused twice with no way to add it, and the model then told the
    // person, in Malagasy, that the line was added.
    for (const change of adds) {
        if (
            change.again === true ||
            change.kind === 'passage' ||
            change.kind === 'rule' ||
            (NOTE_INSERT_KIND_LIST as readonly string[]).includes(
                change.kind ?? '',
            )
        ) {
            continue;
        }
        const words = toComparableWords(change.text ?? '');
        const twin = refs.findIndex((ref, index) => {
            return (
                !ref.isFixed &&
                !touched.has(index + 1) &&
                toComparableWords(toBlockText(ref)) === words
            );
        });
        if (twin >= 0) {
            return toReason(
                `Those are block ${twin + 1}'s words already. To change ` +
                    `block ${twin + 1}, give \`block: ${twin + 1}\`; to add ` +
                    'the same words again as a new block, give `again: true`.',
            );
        }
        // A new block whose words are PART of a block this call keeps: a
        // block being split by hand, its parts added while it keeps them all
        // (BN-58: three questions on one line made a bullet whole, two of
        // them added again beside it).
        // Words alone, any case: a model capitalises the part it copies.
        const toLooseWords = (value: string) => {
            return (value.toLowerCase().match(/[\p{L}\p{M}\p{N}']+/gu) ?? [])
                .join(' ')
                .trim();
        };
        const looseWords = toLooseWords(change.text ?? '');
        if (
            /^h[1-6]$/.test(change.kind ?? '') ||
            looseWords.split(' ').length < 4
        ) {
            continue;
        }
        const holder = refs.findIndex((ref, index) => {
            const blockNumber = index + 1;
            if (ref.isFixed || removes.includes(blockNumber)) {
                return false;
            }
            const update = updates.find((one) => one.block === blockNumber);
            const kept = toLooseWords(
                update?.text !== undefined ? update.text : toBlockText(ref),
            );
            return (
                kept !== looseWords && ` ${kept} `.includes(` ${looseWords} `)
            );
        });
        if (holder >= 0) {
            return toReason(
                `Block ${holder + 1} already holds the words "${change.text}". ` +
                    `To make block ${holder + 1} several blocks, give it its ` +
                    `kind and its lines: {block: ${holder + 1}, kind: ` +
                    '"bullet", text: "first line\\nsecond line"} -- a block a ' +
                    'line, every word kept.',
            );
        }
    }

    const missingVerses: string[] = [];
    const verseOf = (ref: string) => {
        const verse = verseMap.get(ref.trim());
        if (verse === undefined) {
            missingVerses.push(ref.trim());
        }
        return verse;
    };
    // What each read block number points at NOW: an update may put another
    // node in its place, and every later step finds it by this.
    const nodeOf = new Map<number, NodeType>();
    refs.forEach((ref, index) => {
        nodeOf.set(index + 1, ref.node);
    });

    // The kind each change leaves its block: Clear Formatting makes a
    // heading or a quote a paragraph, as the editor's own does.
    const kindOfChange = (change: NoteEditChangeType) => {
        const ref = refs[(change.block as number) - 1];
        if (change.kind !== undefined) {
            return change.kind;
        }
        const isCleared =
            styleMap.get(change)?.run.clear === true &&
            change.words === undefined &&
            !ref.isFixed;
        return isCleared && (/^h[1-6]$/.test(ref.kind) || ref.kind === 'quote')
            ? 'paragraph'
            : ref.kind;
    };
    for (const change of updates) {
        const blockNumber = change.block as number;
        const ref = refs[blockNumber - 1];
        if (ref.isFixed) {
            // A drawing is changed here, its own way; any other fixed block
            // is styled, sized or aligned below and never given words.
            if (ref.kind === 'drawing') {
                const failure = applyDrawingChange(
                    nodeOf.get(blockNumber)!,
                    change,
                    styleMap.get(change)!,
                    { now, genId },
                    drawnAgainSet,
                );
                if (failure !== null) {
                    return toReason(failure);
                }
            }
            continue;
        }
        const node = nodeOf.get(blockNumber)!;
        const kind = kindOfChange(change) as NoteEditableKindType;
        const style = findFirstStyle(node);
        const hasNewWords =
            change.text !== undefined && !ownWordsChangeSet.has(change);
        let children: NodeType[];
        if (hasNewWords) {
            const text = toRealLineBreaks(change.text as string);
            if (kind === 'code') {
                children = text.split('\n').flatMap((line, index) => {
                    const lineNodes =
                        line === '' ? [] : [genTextNode(line, 0, style)];
                    return index === 0
                        ? lineNodes
                        : [{ type: 'linebreak', version: 1 }, ...lineNodes];
                });
            } else {
                const context = genBuildContext(
                    node,
                    root,
                    verseMap,
                    style,
                    nameMap,
                );
                children = buildInlineNodes(
                    parseRuns(text, new Set()),
                    context,
                );
                missingVerses.push(...context.missingVerses);
            }
        } else if (checkIsQuoteOfParagraphs(node)) {
            // A quote of paragraphs made something else: its lines, with a
            // break between them.
            children = childrenOf(node).flatMap((paragraph, index) => {
                const inner = cloneNode(childrenOf(paragraph));
                return index === 0
                    ? inner
                    : [{ type: 'linebreak', version: 1 }, ...inner];
            });
        } else {
            children = childrenOf(node);
        }
        if (checkIsQuoteOfParagraphs(node) && kind === 'quote' && hasNewWords) {
            // Written back the way this quote holds its words: a paragraph a
            // line.
            const firstParagraph = childrenOf(node)[0];
            const lines: NodeType[][] = [[]];
            for (const child of children) {
                if (child.type === 'linebreak') {
                    lines.push([]);
                    continue;
                }
                lines[lines.length - 1].push(child);
            }
            // Each line in its own paragraph's place, key order and all.
            const paragraphs = childrenOf(node);
            node.children = lines.map((lineChildren, index) => {
                const paragraph = cloneNode(
                    paragraphs[index] ?? firstParagraph,
                );
                paragraph.children = lineChildren;
                return paragraph;
            });
            continue;
        }
        if (checkIsListKind(ref.kind)) {
            if (checkIsListKind(kind)) {
                node.children = children;
                if (kind === 'check' && change.checked !== undefined) {
                    node.checked = change.checked;
                }
                if (kind !== ref.kind) {
                    const parent = findParent(root, node)!;
                    const list = parent.owner;
                    if (childrenOf(list).length === 1) {
                        list.listType = kind;
                        list.tag = kind === 'number' ? 'ol' : 'ul';
                        if (kind === 'check' && node.checked === undefined) {
                            node.checked = change.checked === true;
                        }
                    } else {
                        const slot = splitListAround(root, node)!;
                        if (kind === 'check' && node.checked === undefined) {
                            node.checked = change.checked === true;
                        }
                        root.children.splice(
                            slot,
                            0,
                            genListNode(kind, [node], list, style),
                        );
                    }
                }
                continue;
            }
            // A list item made a heading or a paragraph: the list is cut
            // around it.
            const newNode = genTextBlockNode(kind, children, null, style);
            const slot = splitListAround(root, node)!;
            root.children.splice(slot, 0, newNode);
            nodeOf.set(blockNumber, newNode);
            continue;
        }
        if (checkIsListKind(kind)) {
            const item = genListItemNode(children, kind, change.checked);
            const index = root.children.indexOf(node);
            root.children.splice(
                index,
                1,
                genListNode(kind, [item], null, style),
            );
            nodeOf.set(blockNumber, item);
            continue;
        }
        if (kind === ref.kind && hasNewWords) {
            node.children = children;
            continue;
        }
        if (kind !== ref.kind) {
            const newNode = genTextBlockNode(kind, children, node, style);
            const parent = findParent(root, node)!;
            parent.owner.children = parent.children.map((one) => {
                return one === node ? newNode : one;
            });
            nodeOf.set(blockNumber, newNode);
        }
    }

    // Sizes last, on the block as the change left it: a heading made of a
    // paragraph is sized as a heading.
    for (const change of updates) {
        if (
            change.size === undefined ||
            change.words !== undefined ||
            checkIsDrawingChange(change)
        ) {
            continue;
        }
        const blockNumber = change.block as number;
        resizeBlockNode(
            nodeOf.get(blockNumber)!,
            kindOfChange(change),
            change.size,
        );
    }
    // Then the rest of the toolbar: font, colours, styles, alignment, indent.
    // A drawing's colours went to its boxes and lines; only its alignment is
    // the paragraph's.
    for (const change of updates) {
        const style = checkIsDrawingChange(change)
            ? { ...styleMap.get(change)!, hasRunStyle: false }
            : styleMap.get(change)!;
        if (
            !style.hasRunStyle &&
            style.align === null &&
            style.indent === null &&
            !(change.words !== undefined && change.size !== undefined)
        ) {
            continue;
        }
        const blockNumber = change.block as number;
        const failure = applyChangeStyle(
            root,
            nodeOf.get(blockNumber)!,
            kindOfChange(change),
            refs[blockNumber - 1].level,
            change,
            style,
            `Block ${blockNumber}`,
        );
        if (failure !== null) {
            return toReason(failure);
        }
    }

    // A code block's language and theme, on the block as the change left it.
    for (const change of updates) {
        applyCodeFields(nodeOf.get(change.block as number)!, change);
    }

    // Anchors are taken before anything moves: "after block 3" is after what
    // block 3 was, wherever it ends up.
    const lastPlacedMap = new Map<number, NodeType | null>();
    const anchorOf = (after: number) => {
        if (lastPlacedMap.has(after)) {
            return lastPlacedMap.get(after)!;
        }
        return after === 0 ? null : nodeOf.get(after)!;
    };
    // Removes come LAST (BN-58): a new block put after a block this call
    // removes takes that block's place, as a model writes a rewrite.
    for (const change of moves) {
        const blockNumber = change.block as number;
        const node = nodeOf.get(blockNumber)!;
        const after = change.after as number;
        if (removes.includes(after)) {
            return toReason(
                `Block ${after} is removed in this change: move block ` +
                    `${blockNumber} after another one.`,
            );
        }
        const ref = refs[blockNumber - 1];
        const listKind =
            node.type === 'listitem' && checkIsListKind(ref.kind)
                ? ref.kind
                : null;
        const anchor = anchorOf(after);
        removeBlockNode(root, node);
        insertBlockNode(root, anchor, node, listKind, findFirstStyle(node));
        lastPlacedMap.set(after, node);
    }
    // The last new block placed: a chained one goes after it (BN-58).
    let lastAddedNode: NodeType | null = null;
    // Where a chain grows from: a chained block counts as placed after THAT
    // block, never after the number it was given, which is a block of the
    // note too -- or a new block meant for that one would land after the
    // chain (BN-67: a point's words went under the background before it).
    let chainSlot: number | null = null;
    for (const change of adds) {
        const after = change.after as number;
        const isChained: boolean =
            change.chain === true && lastAddedNode !== null;
        const anchor: NodeType | null = isChained
            ? lastAddedNode
            : anchorOf(after);
        const slot = isChained && chainSlot !== null ? chainSlot : after;
        if (!isChained) {
            chainSlot = after;
        }
        const kind = (change.kind ?? 'paragraph') as NoteAddKindType;
        const style =
            anchor === null ? findFirstStyle(root) : findFirstStyle(anchor);
        let node: NodeType;
        let listKind: NoteListKindType | null = null;
        if (kind === 'passage') {
            const verse = verseOf(change.ref as string);
            if (verse === undefined) {
                continue;
            }
            node = genPassageNode(verse);
        } else if (kind === 'rule') {
            node = { type: 'horizontalrule', version: 1 };
        } else if (
            (NOTE_INSERT_KIND_LIST as readonly string[]).includes(kind)
        ) {
            // An object of the editor's Insert menu.
            const context = genBuildContext(
                null,
                root,
                verseMap,
                style,
                nameMap,
            );
            const result = genNoteInsertNode(
                kind as NoteInsertKindType,
                // KaTeX is written with backslashes: \times, \neq.
                kind === 'equation'
                    ? (change.text ?? '')
                    : toRealLineBreaks(change.text ?? ''),
                change.color,
                {
                    genInline: (line) => {
                        return buildInlineNodes(
                            parseRuns(line, new Set()),
                            context,
                        );
                    },
                    style,
                    root,
                    now,
                    genId,
                    exampleNodes,
                    ...(kind === 'drawing'
                        ? { drawing: toDrawingColors(styleMap.get(change)!) }
                        : {}),
                },
            );
            missingVerses.push(...context.missingVerses);
            if ('reason' in result) {
                return toReason(result.reason);
            }
            if ('nodes' in result) {
                // The editor's Default Example: its blocks, in order.
                let exampleAnchor: NodeType | null = anchor;
                for (const exampleNode of result.nodes) {
                    insertBlockNode(
                        root,
                        exampleAnchor,
                        exampleNode,
                        null,
                        style,
                    );
                    exampleAnchor = exampleNode;
                }
                lastPlacedMap.set(slot, exampleAnchor);
                lastAddedNode = exampleAnchor;
                continue;
            }
            node = result.node;
        } else {
            const text = toRealLineBreaks(change.text ?? '');
            const context = genBuildContext(
                null,
                root,
                verseMap,
                style,
                nameMap,
            );
            const children =
                kind === 'code'
                    ? text.split('\n').flatMap((line, index) => {
                          const lineNodes =
                              line === '' ? [] : [genTextNode(line, 0, style)];
                          return index === 0
                              ? lineNodes
                              : [
                                    { type: 'linebreak', version: 1 },
                                    ...lineNodes,
                                ];
                      })
                    : buildInlineNodes(parseRuns(text, new Set()), context);
            missingVerses.push(...context.missingVerses);
            if (checkIsListKind(kind)) {
                listKind = kind;
                node = genListItemNode(children, kind, change.checked);
            } else {
                node = genTextBlockNode(
                    kind as NoteTextKindType,
                    children,
                    null,
                    style,
                );
            }
        }
        if (kind === 'drawing') {
            // Its colours went into the drawing; a size is how large the
            // board draws it.
            if (change.size === 'larger' || change.size === 'smaller') {
                const failure = applyDrawingChange(
                    node,
                    { size: change.size },
                    { ...styleMap.get(change)!, run: {} },
                    { now, genId },
                    drawnAgainSet,
                );
                if (failure !== null) {
                    return toReason(failure);
                }
            }
        } else if (
            change.size !== undefined &&
            change.words === undefined &&
            kind !== 'rule'
        ) {
            resizeBlockNode(node, kind, change.size);
        }
        applyCodeFields(node, change);
        insertBlockNode(root, anchor, node, listKind, style);
        lastPlacedMap.set(slot, node);
        lastAddedNode = node;
        // The toolbar on the new block, where it now sits (a list item
        // nests under the one before it).
        const addStyle =
            kind === 'drawing'
                ? { ...styleMap.get(change)!, hasRunStyle: false }
                : styleMap.get(change)!;
        if (
            addStyle.hasRunStyle ||
            addStyle.align !== null ||
            addStyle.indent !== null ||
            (change.words !== undefined && change.size !== undefined)
        ) {
            const failure = applyChangeStyle(
                root,
                node,
                kind,
                0,
                change,
                addStyle,
                `The new ${kind}`,
            );
            if (failure !== null) {
                return toReason(failure);
            }
        }
    }
    for (const blockNumber of removes) {
        removeBlockNode(root, nodeOf.get(blockNumber)!);
    }
    if (missingVerses.length > 0) {
        return toReason(
            `No installed Bible could read ${[...new Set(missingVerses)]
                .map((ref) => {
                    return `"${ref}"`;
                })
                .join(', ')}. Write a reference as "Book chapter:verse" ` +
                '(e.g. "John 3:16" or "Psalm 23:1-3"); never write a verse\'s ' +
                'words yourself.',
        );
    }
    // Every block the change altered, written as the editor writes it --
    // or an open note window writes it back as a step of its own.
    for (const child of childrenOf(root)) {
        if (!originalBlockTextSet.has(JSON.stringify(child))) {
            normalizeNoteNode(child);
        }
    }
    // Link block text, from the note as the change leaves it: positions.
    const blockLinks: NoteBlockLinkType[] = [];
    for (const change of updates) {
        if (change.linkTo === undefined) {
            continue;
        }
        if (
            removes.includes(change.linkTo) ||
            removes.includes(change.block!)
        ) {
            return toReason('A block this call removes cannot be linked.');
        }
        const made = genNoteBlockLink({
            root,
            fromBlock: nodeOf.get(change.block as number)!,
            fromWords: change.words,
            toBlock: nodeOf.get(change.linkTo)!,
            toWords: change.linkToWords,
            kind: change.linkKind,
            now,
            genId,
        });
        if ('reason' in made) {
            return toReason(made.reason);
        }
        blockLinks.push(made.link);
    }
    const newContent =
        childrenOf(root).length === 0 ? '' : JSON.stringify(state);
    const parts = [
        updates.length > 0 ? `${updates.length} changed` : null,
        adds.length > 0 ? `${adds.length} added` : null,
        removes.length > 0 ? `${removes.length} removed` : null,
        moves.length > 0 ? `${moves.length} moved` : null,
        newTitle !== null ? 'title changed' : null,
    ].filter(Boolean);
    // What was DONE, change by change: a model says what changed from this,
    // never more (a model had said a word was made red with no colour sent).
    const doneText = [...updates, ...adds]
        .map((change) => {
            const isDrawing = checkIsDrawingChange(change);
            return describeDoneChange(
                change,
                styleMap.get(change)!,
                isDrawing
                    ? drawnAgainSet.has(change)
                    : ownWordsChangeSet.has(change),
                isDrawing,
            );
        })
        .join('; ');
    const summary =
        parts.length > 0
            ? `blocks: ${parts.join(', ')}` +
              (doneText === ''
                  ? ''
                  : ` -- ${doneText.length > MAX_DONE_TEXT_CHARS ? `${doneText.slice(0, MAX_DONE_TEXT_CHARS)}…` : doneText}`)
            : 'nothing';
    return {
        content: newContent,
        title: newTitle,
        isChanged:
            newContent !== content ||
            newTitle !== null ||
            blockLinks.length > 0,
        summary,
        ...(blockLinks.length > 0 ? { blockLinks } : {}),
    };
}
