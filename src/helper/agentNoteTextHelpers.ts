/**
 * A Bible note's words, to and from what the note editor stores.
 *
 * A note's `content` is not text: it is the serialized state of the
 * `bible-note` editor (Lexical), and the editor restores a note with
 * `parseEditorState` -- which refuses plain text outright. So a note written
 * by `owa_bible_note` is written in the editor's own shape, one paragraph a
 * line, exactly the nodes a real note file holds; and a note READ for a model
 * is walked back down to its words, verse mentions included, because a model
 * handed twenty kilobytes of editor state reads nothing but the state.
 *
 * Pure on purpose: no app, no editor package (it is heavy and loaded only when
 * a note window opens), so the shape is tested against a real file's nodes
 * without either.
 */

type LexicalNodeType = Record<string, any>;

/** What a line of a note may hold before it is split into more lines. */
export const AGENT_NOTE_TEXT_MAX_CHARS = 20000;

// Elements that sit INSIDE a line rather than starting one: a link, a comment
// mark. Everything else with children is a block and starts a line of its own.
const INLINE_ELEMENT_TYPE_SET = new Set(['link', 'autolink', 'mark']);

function genTextNode(text: string): LexicalNodeType {
    return {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text,
        type: 'text',
        version: 1,
    };
}

/**
 * The editor state for plain text: one paragraph a line, an empty line an
 * empty paragraph, and "" for no text at all -- which is what a new note in
 * the panel holds until somebody types.
 */
export function toLexicalContent(text: string) {
    const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
    if (normalized.trim() === '') {
        return '';
    }
    const paragraphs = normalized.split('\n').map((line) => {
        return {
            children: line === '' ? [] : [genTextNode(line)],
            direction: null,
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
            textFormat: 0,
            textStyle: '',
        };
    });
    return JSON.stringify({
        root: {
            children: paragraphs,
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
        },
    });
}

function readRoot(content: unknown): LexicalNodeType | null {
    if (typeof content !== 'string' || !content.trimStart().startsWith('{')) {
        return null;
    }
    try {
        const root = JSON.parse(content)?.root;
        return typeof root === 'object' && root !== null ? root : null;
    } catch (_error) {
        return null;
    }
}

function checkIsNode(value: unknown): value is LexicalNodeType {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The words of a note, a line per block. Verse mentions read as their names
 * ("(KJV) Genesis 1:1-3"), a line break as a new line, an empty paragraph as
 * an empty line -- so `toLexicalContent` and this round-trip. Unreadable
 * content reads as no words, never as an error.
 */
export function readLexicalText(content: unknown) {
    const root = readRoot(content);
    if (root === null) {
        return '';
    }
    const lines: string[] = [];
    let current = '';
    const flush = () => {
        lines.push(current);
        current = '';
    };
    const visit = (node: unknown) => {
        if (!checkIsNode(node)) {
            return;
        }
        if (node.type === 'linebreak') {
            flush();
            return;
        }
        if (Array.isArray(node.children)) {
            if (INLINE_ELEMENT_TYPE_SET.has(node.type)) {
                node.children.forEach(visit);
                return;
            }
            if (current !== '') {
                flush();
            }
            if (node.children.length === 0) {
                // An empty paragraph is a blank line somebody left on purpose.
                lines.push('');
                return;
            }
            node.children.forEach(visit);
            if (current !== '') {
                flush();
            }
            return;
        }
        if (typeof node.text === 'string') {
            current += node.text;
        }
    };
    (Array.isArray(root.children) ? root.children : []).forEach(visit);
    if (current !== '') {
        flush();
    }
    return lines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** The Bible passages a note mentions, by name, each once. */
export function readLexicalMentions(content: unknown) {
    const root = readRoot(content);
    const nameSet = new Set<string>();
    const visit = (node: unknown) => {
        if (!checkIsNode(node)) {
            return;
        }
        if (node.type === 'mention' && node.mentionKind === 'bible-verse') {
            const name = node.mentionName ?? node.text;
            if (typeof name === 'string' && name.trim() !== '') {
                nameSet.add(name.trim());
            }
        }
        if (Array.isArray(node.children)) {
            node.children.forEach(visit);
        }
    };
    if (root !== null) {
        visit(root);
    }
    return [...nameSet];
}

/** The start of a note's words, on one line, for a row in a list. */
export function toFirstWords(text: string, limit = 80) {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > limit ? `${flat.slice(0, limit).trimEnd()}…` : flat;
}
