/**
 * A NEW Bible note's words as a model writes them -- `# A heading`, `- a
 * point`, `1. a step`, `> a quote`, `**bold**`, `[^John 3:16]` -- read as the
 * note editor's own blocks (2026-11-08, the user, with a Reader chat that
 * answered "make a bible note for me" with a note to copy and paste:
 * _chatbot should be able to create new bible note (not allow delete), after
 * create should open the note and attach to the chatbot session_).
 *
 * `owa_bible_note add` wrote every line as a plain paragraph, so a note a
 * model drafted kept its `**` and `#` as letters. Words with none of that
 * mark-up are still written as before (`toLexicalContent`); words with any
 * become `owa_note_edit`'s own adds -- a block a line, its kind read off the
 * line's start, its words in the light mark-up that tool reads -- built by
 * the same pure rules (`applyNoteEdit`), so a new note holds the nodes the
 * editor itself writes.
 *
 * Pure: no app, no editor.
 */
import type { NoteEditChangeType } from './agentNoteBlockHelpers';

// A line that starts a heading, a list item or a quote.
const BLOCK_MARK_PATTERN =
    /^[ \t]{0,3}(?:#{1,6}[ \t]+\S|[-*+•][ \t]+\S|\d{1,3}[.)][ \t]+\S|>)/m;
// A line that is a rule and nothing else: `---`, `***`, `___`.
const RULE_LINE_PATTERN = /^[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;
// Words marked bold, underlined, struck or as code; a verse, person or place
// token; a link written as `[words](https://…)`.
const INLINE_MARK_PATTERN =
    /\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[\^@#][^\]\n]+\]|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/;

const HEADING_LINE_PATTERN = /^[ \t]{0,3}(#{1,6})[ \t]+(.*)$/;
const CHECK_LINE_PATTERN = /^[ \t]*[-*+•][ \t]+\[([ xX])\][ \t]+(.*)$/;
const BULLET_LINE_PATTERN = /^[ \t]*[-*+•][ \t]+(.*)$/;
const NUMBER_LINE_PATTERN = /^[ \t]*\d{1,3}[.)][ \t]+(.*)$/;
const QUOTE_LINE_PATTERN = /^[ \t]{0,3}>[ \t]?(.*)$/;
const VERSE_TOKEN_PATTERN = /\[\^([^\]\n]+)\]/g;

/** Whether words carry a line that starts a block: a heading, a list, … */
export function checkHasBlockMarkup(text: string) {
    const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
    return (
        BLOCK_MARK_PATTERN.test(normalized) ||
        normalized.split('\n').some((line) => {
            return RULE_LINE_PATTERN.test(line);
        })
    );
}

/** Whether a new note's words carry any mark-up to be read as such. */
export function checkHasNoteMarkup(text: string) {
    return (
        checkHasBlockMarkup(text) ||
        INLINE_MARK_PATTERN.test(String(text ?? '').replace(/\r\n?/g, '\n'))
    );
}

function toSectionLines(text: string) {
    return text.replace(/\\r\\n|\\n/g, '\n').replace(/\\t/g, '\t');
}

// What a section's blocks take from it: the toolbar's look, never another
// kind's own fields.
const SECTION_STYLE_KEY_LIST = [
    'size',
    'font',
    'color',
    'background',
    'styles',
    'align',
] as const;

/**
 * Many blocks added at one place: an add of `kind: "section"` -- or a
 * paragraph add whose words are mark-up LINES (`## A point`, `- a line`,
 * `1. a step`, `> a quote`, `---`), which is what a model writes anyway --
 * is the adds those lines spell, a block a line, all after the same block
 * and in their order, each taking the section's look. (2026-11-08, the
 * user, with a note chat that answered _new page_ under a lesson by asking
 * which way to translate: _chatbot should understand and can append the
 * lesson content to new section_.) A lesson put into a note keeps its
 * headings and lists as the editor's own, in ONE change. A section with no
 * words is left an empty paragraph add, which is refused with its reason.
 */
export function expandSectionAdds(
    changes: readonly NoteEditChangeType[],
): NoteEditChangeType[] {
    return changes.flatMap((change) => {
        if (
            typeof change !== 'object' ||
            change === null ||
            change.block !== undefined ||
            typeof change.text !== 'string'
        ) {
            return [change];
        }
        const isSection = change.kind === 'section';
        const isLinedParagraph =
            (change.kind === undefined || change.kind === 'paragraph') &&
            checkHasBlockMarkup(change.text);
        if (!isSection && !isLinedParagraph) {
            return [change];
        }
        // A section's lines, a `\n` written out as two characters read as
        // the line break it means: a model copies the escaping it was
        // shown (seen live 2026-11-08, `## Key Words\n- …` in one heading).
        const lineChanges = toNoteAddChanges(
            isSection ? toSectionLines(change.text) : change.text,
        );
        if (lineChanges.length === 0) {
            return [{ ...change, kind: 'paragraph' }];
        }
        const style: NoteEditChangeType = {};
        for (const key of SECTION_STYLE_KEY_LIST) {
            if (change[key] !== undefined) {
                (style as any)[key] = change[key];
            }
        }
        return lineChanges.map((lineChange) => {
            return { ...style, ...lineChange, after: change.after };
        });
    });
}

// What a line says once its marks are put aside: for the title check.
function toLooseWords(text: string) {
    return text
        .replace(/[#*_~`>]/g, ' ')
        .replace(/^\s*title\s*:/i, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[\s:.]+$/, '')
        .trim()
        .toLowerCase();
}

function toLineChange(line: string): NoteEditChangeType | null {
    if (line.trim() === '') {
        return null;
    }
    if (RULE_LINE_PATTERN.test(line)) {
        return { after: 0, kind: 'rule' };
    }
    const heading = HEADING_LINE_PATTERN.exec(line);
    if (heading !== null) {
        return {
            after: 0,
            kind: `h${heading[1].length}`,
            text: heading[2].trim(),
        };
    }
    const check = CHECK_LINE_PATTERN.exec(line);
    if (check !== null) {
        return {
            after: 0,
            kind: 'check',
            text: check[2].trim(),
            checked: check[1] !== ' ',
        };
    }
    const bullet = BULLET_LINE_PATTERN.exec(line);
    if (bullet !== null) {
        return { after: 0, kind: 'bullet', text: bullet[1].trim() };
    }
    const number = NUMBER_LINE_PATTERN.exec(line);
    if (number !== null) {
        return { after: 0, kind: 'number', text: number[1].trim() };
    }
    const quote = QUOTE_LINE_PATTERN.exec(line);
    if (quote !== null) {
        return quote[1].trim() === ''
            ? null
            : { after: 0, kind: 'quote', text: quote[1].trim() };
    }
    return { after: 0, kind: 'paragraph', text: line.trim() };
}

/**
 * A new note's words as the adds that build it, top to bottom: a block a
 * line (an empty line only parts blocks), its kind off the line's start --
 * `#` to `######` a heading, `-` `*` `+` `•` a bullet, `- [ ]` / `- [x]` a
 * check item, `1.` a numbered item, `>` a quote, `---` a rule -- and its
 * words as written, mark-up and tokens kept for the rules to read. A first
 * line that only says the note's TITLE again (`# Sunday`, `**Title:
 * Sunday**`) is left out: the title is the note's name already.
 */
export function toNoteAddChanges(text: string, title = '') {
    const changes = String(text ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(toLineChange)
        .filter((change): change is NoteEditChangeType => {
            return change !== null;
        });
    const titleWords = toLooseWords(title);
    const first = changes[0];
    if (
        first !== undefined &&
        titleWords !== '' &&
        typeof first.text === 'string' &&
        toLooseWords(first.text) === titleWords
    ) {
        changes.shift();
    }
    return changes;
}

/**
 * The changes with every `[^…]` verse no installed Bible could give left as
 * its words: a new note is still made, the reference written plainly, when
 * one verse it names cannot be read.
 */
export function toUnfoundVersesAsWords(
    changes: readonly NoteEditChangeType[],
    foundRefSet: ReadonlySet<string>,
): NoteEditChangeType[] {
    return changes.map((change) => {
        if (typeof change.text !== 'string') {
            return change;
        }
        const text = change.text.replace(
            VERSE_TOKEN_PATTERN,
            (token, ref: string) => {
                return foundRefSet.has(ref.trim()) ? token : ref.trim();
            },
        );
        return text === change.text ? change : { ...change, text };
    });
}
