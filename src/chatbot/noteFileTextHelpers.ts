// A Bible note file (`.own`) as words a model can read.
//
// Handed over as it is, a note file is JSON in which every note's body is
// ANOTHER JSON string -- the editor's own tree of nodes -- and a picture
// pasted into a note is its bytes in base64. Cut to the 16 KB a text
// attachment may carry, a note with one photograph in it was the first part
// of that photograph and no notes at all. So the tree is walked down to the
// words in it, a note at a time, the verses marked in the file after them.
//
// Pure: no file is read here (`fileAttachHelpers.ts` does that).

// What a note with no words reads as -- the empty note's lesson card
// (`checkIsEmptyNoteAttachment`) tells one by it.
export const EMPTY_NOTE_BODY = '(empty)';

/**
 * What `owa_note_edit read` answers for an EMPTY note, worked out from its
 * file: its blocks, every one an empty paragraph, counted off the editor's
 * saved tree (none saved yet is the one the editor starts with). Null when
 * the note holds anything at all -- a picture alone is not empty -- or is not
 * there (BN-87, 2026-11-11: on a busy computer the note's window took over
 * twenty seconds to open, the window's read of the note failed, and an empty
 * note was taken for one with words -- the lesson asked for went into a NEW
 * note beside it).
 */
export function toBlankNoteReadFromFileText(
    text: string,
    noteId: number,
    file: string,
) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return null;
    }
    const item = Array.isArray(data?.items)
        ? data.items.find((one: any) => one?.metadata?.id === noteId)
        : undefined;
    if (
        typeof item !== 'object' ||
        item === null ||
        typeof item.verseKey === 'string'
    ) {
        return null;
    }
    const content = typeof item.content === 'string' ? item.content : '';
    let blockCount = 1;
    if (content.trim() !== '') {
        let children;
        try {
            children = JSON.parse(content)?.root?.children;
        } catch {
            return null;
        }
        const isEveryBlockEmpty =
            Array.isArray(children) &&
            children.every((child: any) => {
                return (
                    child?.type === 'paragraph' &&
                    (!Array.isArray(child.children) ||
                        child.children.length === 0)
                );
            });
        if (!isEveryBlockEmpty) {
            return null;
        }
        blockCount = Math.max(1, children.length);
    }
    return {
        file,
        blockCount,
        blocks: Array.from({ length: blockCount }, (_, index) => {
            return { n: index + 1, kind: 'paragraph', text: '' };
        }),
    };
}

// The nodes that END a line of their own: what makes a heading, a paragraph
// and a list item read as three lines instead of one run-on sentence.
const BLOCK_TYPE_SET = new Set([
    'paragraph',
    'heading',
    'quote',
    'listitem',
    'code',
]);

function toNodeText(node: any): string {
    if (typeof node !== 'object' || node === null) {
        return '';
    }
    if (node.type === 'linebreak') {
        return '\n';
    }
    // A picture's bytes are nothing a reader of the words needs -- only that
    // one is there.
    if (node.type === 'image') {
        return '[picture]';
    }
    // Plain words, and a verse mentioned by its reference ("(KJV) Genesis
    // 1:1-3") -- whose own words the note goes on to quote when it wants them.
    if (typeof node.text === 'string') {
        return node.text;
    }
    const inner = Array.isArray(node.children)
        ? node.children.map(toNodeText).join('')
        : '';
    if (!BLOCK_TYPE_SET.has(node.type)) {
        return inner;
    }
    if (node.type === 'heading') {
        return `## ${inner}\n`;
    }
    if (node.type === 'listitem') {
        return `- ${inner}\n`;
    }
    return `${inner}\n`;
}

/**
 * One note's body as lines. The body is the editor's JSON tree; anything else
 * (an older note, plain words) is taken as words, without the markup an
 * older editor may have left in it.
 */
export function toNoteContentText(content: string) {
    let tree;
    try {
        tree = JSON.parse(content);
    } catch {
        tree = null;
    }
    const text =
        typeof tree?.root === 'object'
            ? toNodeText(tree.root)
            : content.replace(/<[^>]+>/g, ' ');
    return text
        .split('\n')
        .map((line) => {
            return line.replace(/\s+$/, '');
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function toMarkLines(item: any) {
    const lines: string[] = [];
    for (const highlight of Array.isArray(item.highlights)
        ? item.highlights
        : []) {
        if (typeof highlight?.text === 'string' && highlight.text.length > 0) {
            lines.push(`- highlighted: "${highlight.text}"`);
        }
    }
    for (const comment of Array.isArray(item.comments) ? item.comments : []) {
        if (
            typeof comment?.text === 'string' &&
            typeof comment?.comment === 'string'
        ) {
            lines.push(`- comment on "${comment.text}": ${comment.comment}`);
        }
    }
    return lines;
}

/**
 * The words of a whole note file: each note under its title, then each verse
 * marked in it with its highlights and comments, in the file's own order.
 * Null for text that is not a note file at all, which the caller then reads
 * as plain text instead.
 */
export function toNoteFileText(text: string): string | null {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return null;
    }
    if (!Array.isArray(data?.items)) {
        return null;
    }
    const parts: string[] = [];
    for (const item of data.items) {
        if (typeof item !== 'object' || item === null) {
            continue;
        }
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (typeof item.verseKey === 'string') {
            const lines = toMarkLines(item);
            if (lines.length > 0) {
                parts.push(
                    [
                        `Marked verse: ${title.length > 0 ? title : item.verseKey}`,
                        ...lines,
                    ].join('\n'),
                );
            }
            continue;
        }
        const body =
            typeof item.content === 'string'
                ? toNoteContentText(item.content)
                : '';
        if (title.length === 0 && body.length === 0) {
            continue;
        }
        parts.push(
            `Note: ${title.length > 0 ? title : '(no title)'}\n` +
                (body.length > 0 ? body : EMPTY_NOTE_BODY),
        );
    }
    return parts.length === 0
        ? '(this note file has no notes in it)'
        : parts.join('\n\n');
}

/** What a note with no title of its own is called, as the panel calls it. */
export const UNTITLED_NOTE_NAME = 'Unnamed';

/**
 * ONE note of a note file, by its id -- what **Open in Chatbot** on a note row
 * attaches (2026-11-07): its title and its words. Null when the file is not a
 * note file, holds no such note, or that id is a marked verse (its highlights
 * are not a note anybody writes in).
 */
export function toNoteItemFromFileText(
    text: string,
    noteId: number,
): { title: string; text: string } | null {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return null;
    }
    if (!Array.isArray(data?.items)) {
        return null;
    }
    const item = data.items.find((one: any) => {
        return (
            typeof one === 'object' &&
            one !== null &&
            one.metadata?.id === noteId
        );
    });
    if (item === undefined || typeof item.verseKey === 'string') {
        return null;
    }
    const title =
        typeof item.title === 'string' && item.title.trim() !== ''
            ? item.title.trim()
            : UNTITLED_NOTE_NAME;
    const body =
        typeof item.content === 'string' ? toNoteContentText(item.content) : '';
    return { title, text: body.length > 0 ? body : EMPTY_NOTE_BODY };
}
