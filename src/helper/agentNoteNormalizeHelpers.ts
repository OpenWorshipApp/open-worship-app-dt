/**
 * A changed block written the way the note editor itself writes it
 * (2026-11-08). An open note window loads what a change wrote and, when the
 * editor would have written it another way, writes ITS version back as a
 * history step of its own -- an echo, which an "undo" then took back in
 * place of the change. Measured live by writing every kind of change with
 * the note window open: six kinds echoed, each for one of these rules, all
 * read off Lexical's own `exportJSON`:
 *
 * - an element's keys: `children, direction, format, indent, type, version`,
 *   then `textFormat` / `textStyle`, then its class's own (a heading's
 *   `tag`, a list item's `checked` and `value`, a list's `listType`, `start`,
 *   `tag` …);
 * - a PARAGRAPH always writes `textFormat` / `textStyle`, taken from its
 *   first piece of text when it has one;
 * - any other element writes them only when they are not empty and it
 *   holds no text of its own;
 * - a block object (a YouTube video, a website): `type, version, format`
 *   first;
 * - a list's items numbered from its `start`, `checked` on a check list's
 *   items only (`numberListItems`).
 *
 * Only blocks a change altered are passed here, so every other node stays
 * byte for byte. A code block's words are split into highlighted pieces by
 * the editor's highlighter, which nothing here can do -- that echo is
 * stepped over by the worker's undo instead.
 */

type NodeType = Record<string, any>;

const ELEMENT_HEAD_KEY_LIST = [
    'children',
    'direction',
    'format',
    'indent',
    'type',
    'version',
];
// A class's own keys, in the order its exportJSON adds them.
const ELEMENT_TAIL_KEY_MAP: Record<string, string[]> = {
    heading: ['tag'],
    list: ['listType', 'start', 'tag'],
    listitem: ['checked', 'value'],
    code: ['language', 'theme'],
    link: ['rel', 'target', 'title', 'url'],
    autolink: ['rel', 'target', 'title', 'url', 'isUnlinked'],
    'collapsible-container': ['open'],
    'layout-container': ['templateColumns'],
};
const BLOCK_OBJECT_TYPE_SET = new Set(['youtube', 'website']);

function checkIsNode(value: unknown): value is NodeType {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A piece of text, as Lexical counts one ($isTextNode). */
function checkIsTextNode(node: NodeType) {
    return typeof node.text === 'string' && node.type !== 'linebreak';
}

function reorder(node: NodeType, headList: string[], tailList: string[]) {
    const ordered: NodeType = {};
    for (const key of headList) {
        if (key in node) {
            ordered[key] = node[key];
        }
    }
    for (const key of ['textFormat', 'textStyle']) {
        if (key in node) {
            ordered[key] = node[key];
        }
    }
    for (const key of tailList) {
        if (key in node) {
            ordered[key] = node[key];
        }
    }
    for (const key of Object.keys(node)) {
        if (!(key in ordered)) {
            ordered[key] = node[key];
        }
    }
    for (const key of Object.keys(node)) {
        delete node[key];
    }
    Object.assign(node, ordered);
}

/**
 * A list's items numbered as the editor numbers them
 * (`$updateChildrenListItemValue`): from the list's `start`, one more an item
 * -- an item that only wraps a nested list takes the next one's number and
 * counts none -- and a tick (`checked`, always written) on a check list's
 * items alone. Seen live 2026-11-08: a note of five bullets made by
 * `owa_bible_note add` came out `value: 1` on every item, and the note
 * window wrote them back 1 to 5 as a step of its own the moment it opened.
 */
function numberListItems(list: NodeType) {
    let value = Number.isInteger(list.start) ? list.start : 1;
    const isCheck = list.listType === 'check';
    for (const item of list.children) {
        if (!checkIsNode(item) || item.type !== 'listitem') {
            continue;
        }
        item.value = value;
        if (isCheck) {
            item.checked = item.checked === true;
        } else {
            delete item.checked;
        }
        const first = Array.isArray(item.children)
            ? item.children[0]
            : undefined;
        if (!(checkIsNode(first) && first.type === 'list')) {
            value++;
        }
    }
}

type RunMarkType = { format: number; style: string } | null;

/**
 * The next-words style an open note window gives a LIST: that of the first
 * piece of text inside it, in reading order, an inner element's own first
 * text counting where that element stands. Lexical keeps one on every
 * element (`setTextFormat` in its reconciler), and an element with no text
 * of its own WRITES it (`ElementNode.exportJSON`). Measured live
 * 2026-11-08 on five new lists, each written and then opened in its window:
 * the list's first items' first texts bold [1,1,1,0,0,0,1] came back
 * `textFormat: 1` on the list, [0,1] and [0] with none, [1] with 1 -- as a
 * history step of its own whenever this said otherwise.
 */
function walkReconciledMark(node: NodeType): RunMarkType {
    let mark: RunMarkType = null;
    for (const child of node.children) {
        if (!checkIsNode(child)) {
            continue;
        }
        if (Array.isArray(child.children)) {
            // Every inner element gets its own, whatever comes first here.
            const childMark = walkReconciledMark(child);
            if (mark === null) {
                mark = childMark;
            }
        } else if (mark === null && checkIsTextNode(child)) {
            mark = { format: child.format ?? 0, style: child.style ?? '' };
        }
    }
    // Lists only: that is what was measured. A passage (a collapsible block)
    // given its title's font this way was written back WITHOUT it by the
    // window, as a step of its own (2026-11-08) -- the rule is not general.
    if (mark !== null && node.type === 'list') {
        node.textFormat = mark.format;
        node.textStyle = mark.style;
    }
    return mark;
}

/**
 * One block and everything under it, in place, as the editor writes them:
 * the reconciler's walk first, then each node's own rules.
 */
export function normalizeNoteNode(node: NodeType) {
    if (!checkIsNode(node)) {
        return;
    }
    if (Array.isArray(node.children)) {
        walkReconciledMark(node);
    }
    normalizeNode(node);
}

function normalizeNode(node: NodeType) {
    if (!checkIsNode(node)) {
        return;
    }
    if (node.type === 'list' && Array.isArray(node.children)) {
        numberListItems(node);
    }
    // A sticky note's words are a little editor of their own: each of its
    // blocks is walked as a block.
    const captionRoot = node.caption?.editorState?.root;
    if (checkIsNode(captionRoot) && Array.isArray(captionRoot.children)) {
        for (const child of captionRoot.children) {
            normalizeNoteNode(child);
        }
    }
    if (!Array.isArray(node.children)) {
        if (BLOCK_OBJECT_TYPE_SET.has(node.type)) {
            reorder(node, ['type', 'version', 'format'], []);
        }
        return;
    }
    for (const child of node.children) {
        normalizeNode(child);
    }
    const firstText = node.children.find((child: NodeType) => {
        return checkIsNode(child) && checkIsTextNode(child);
    });
    if (node.type === 'paragraph') {
        node.textFormat =
            firstText !== undefined
                ? (firstText.format ?? 0)
                : (node.textFormat ?? 0);
        node.textStyle =
            firstText !== undefined
                ? (firstText.style ?? '')
                : (node.textStyle ?? '');
    } else if (node.type !== 'root') {
        if (firstText !== undefined || !node.textFormat) {
            delete node.textFormat;
        }
        if (firstText !== undefined || !node.textStyle) {
            delete node.textStyle;
        }
    }
    reorder(node, ELEMENT_HEAD_KEY_LIST, ELEMENT_TAIL_KEY_MAP[node.type] ?? []);
}

/**
 * The note as it reads, whatever way its nodes are written: keys sorted, a
 * code block's highlighted pieces joined into its words. Two states that
 * read the same here differ only by how the editor writes them -- an echo.
 */
export function toNoteCanonicalText(content: string) {
    let state: unknown;
    try {
        state = JSON.parse(content);
    } catch (_error) {
        return content;
    }
    const canonical = (value: unknown): unknown => {
        if (Array.isArray(value)) {
            return value.map(canonical);
        }
        if (!checkIsNode(value)) {
            return value;
        }
        if (value.type === 'code' && Array.isArray(value.children)) {
            return {
                type: 'code',
                language: value.language ?? null,
                theme: value.theme ?? null,
                text: value.children
                    .map((child: NodeType) => {
                        return child.type === 'linebreak'
                            ? '\n'
                            : String(child.text ?? '');
                    })
                    .join(''),
            };
        }
        const sorted: NodeType = {};
        for (const key of Object.keys(value).sort()) {
            // How the NEXT typed words look: no part of what the note reads.
            if (key === 'textFormat' || key === 'textStyle') {
                continue;
            }
            sorted[key] = canonical(value[key]);
        }
        return sorted;
    };
    return JSON.stringify(canonical(state));
}
