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
// A line that is ONE verse token and nothing else -- quoted, or bold, at
// most: the passage printed whole (2026-11-10, the user's goal _chatbot
// completely smart enough to help prepare a best preaching lesson_). A
// lesson opens on its passage READ, and a token in a line is only its
// reference; a study file reads such a line the same way
// (`STUDY_CONTENT_RULES`). A token among other words, or in a list item,
// stays a verse mention.
const PASSAGE_LINE_PATTERN =
    /^[ \t]{0,3}(?:>[ \t]?)?(?:\*\*|__|\*|_)?\[\^([^\]\n]+)\](?:\*\*|__|\*|_)?[ \t]*$/;
// A reference to more than one verse: a range (`John 10:11-18`, `1-2`) or a
// whole chapter (`Psalm 23`, `(KJV) Psalm 23`).
const PASSAGE_RANGE_REF_PATTERN = /\d\s*[-–]\s*\d|(?:^|\s)\d+\s*$/;

/** The reference of a line that is one verse token and nothing else. */
export function readPassageLineRef(text: string) {
    const match = PASSAGE_LINE_PATTERN.exec(String(text ?? '').trim());
    return match === null || match[1].trim() === '' ? null : match[1].trim();
}

/** Whether a reference names more than one verse: a range or a chapter. */
export function checkIsPassageRef(ref: string) {
    return PASSAGE_RANGE_REF_PATTERN.test(String(ref ?? '').trim());
}

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
        const isParagraph =
            change.kind === undefined || change.kind === 'paragraph';
        // A paragraph that is one token naming a PASSAGE -- verses or a
        // chapter -- and nothing else is the passage itself (2026-11-10):
        // asked to prepare a sermon on John 10:11-18, gemma4:cloud put
        // `{kind: "paragraph", text: "[^John 10:11-18]"}` first, which was
        // a chip with eight verses folded into it, not the passage read. One
        // verse alone stays its chip: a key verse is often only named.
        const passageRef = isParagraph ? readPassageLineRef(change.text) : null;
        if (passageRef !== null && checkIsPassageRef(passageRef)) {
            const { text: _text, ...rest } = change;
            return [{ ...rest, kind: 'passage', ref: passageRef }];
        }
        const isLinedParagraph =
            isParagraph && checkHasBlockMarkup(change.text);
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

const SPLIT_LIST_KIND_SET = new Set(['bullet', 'number', 'check']);
// A list mark a model writes in front of an item it already names the kind of.
const ITEM_MARK_PATTERN = /^\s*(?:[-*+•]|\d{1,3}[.)])\s+/;

/**
 * A block made SEVERAL (BN-58, 2026-11-09, the user: _imagine user made a
 * messy content then ask chatbot to do reformating_). Asked to tidy a note
 * whose three questions were one line, gemma4:cloud tried five calls: a
 * block cannot take fewer of its own words with another kind, and a new
 * block cannot go after one the call removes, so it kept the line whole as
 * one bullet and added two of its questions again beside it. A change to a
 * block whose words are LINES -- with a list kind (`bullet`, `number`,
 * `check`), one item a line; with `section`, a block a line, each its kind
 * off the line (`## Questions`, `- Who is lost today?`) -- gives the block
 * its first line and adds the rest right after it, in order, each taking
 * the change's look. `splitText` carries every line, so the block is held
 * to keeping its own words across all of them. `ownText` is the block's
 * words as read: given back so, a block is never split.
 */
export function expandBlockSplits(
    changes: readonly NoteEditChangeType[],
    toOwnText: (block: number) => string | null,
): NoteEditChangeType[] {
    return changes.flatMap((change) => {
        if (
            typeof change !== 'object' ||
            change === null ||
            typeof change.block !== 'number' ||
            typeof change.text !== 'string' ||
            change.remove === true ||
            change.after !== undefined
        ) {
            return [change];
        }
        const isList = SPLIT_LIST_KIND_SET.has(change.kind ?? '');
        if (!isList && change.kind !== 'section') {
            return [change];
        }
        const text = toSectionLines(change.text).replace(/\r\n?/g, '\n');
        const lines = text.split('\n').filter((line) => {
            return line.trim() !== '';
        });
        if (lines.length < 2 || text.trim() === toOwnText(change.block)) {
            if (change.kind !== 'section') {
                return [change];
            }
            // One line of a section is that line's kind and words.
            const single = lines.length === 1 ? toLineChange(lines[0]) : null;
            const { kind: _kind, ...rest } = change;
            return [
                single === null || single.text === undefined
                    ? rest
                    : { ...rest, kind: single.kind, text: single.text },
            ];
        }
        const lineChanges: NoteEditChangeType[] = isList
            ? lines.map((line) => {
                  return {
                      kind: change.kind,
                      text: line.replace(ITEM_MARK_PATTERN, '').trim(),
                      ...(change.checked === undefined
                          ? {}
                          : { checked: change.checked }),
                  };
              })
            : toNoteAddChanges(text);
        if (lineChanges.length === 0) {
            return [change];
        }
        const style: NoteEditChangeType = {};
        for (const key of SECTION_STYLE_KEY_LIST) {
            if (change[key] !== undefined) {
                (style as any)[key] = change[key];
            }
        }
        const [first, ...rest] = lineChanges;
        return [
            {
                ...change,
                kind: first.kind,
                text: first.text,
                ...(first.checked === undefined
                    ? {}
                    : { checked: first.checked }),
                splitText: lines.join('\n'),
            },
            ...rest.map((lineChange) => {
                const { block: _block, ...add } = lineChange;
                return { ...style, ...add, after: change.block };
            }),
        ];
    });
}

/**
 * List items added one after another, numbered as they will stand
 * (2026-11-10, a sermon's follow-ups): asked for two cross references under
 * point 1, gemma4:cloud added a bullet `after: 9` and the next `after: 10`
 * -- block 10 being the point's example paragraph, so the two references
 * stood apart with the example between them; "two more questions" the same
 * way would put the second under the next heading. Adds in a row of ONE
 * list kind whose `after` goes up one at a time, onto a block that is not
 * an item of that kind, are one list: each goes right after the one before
 * (`chain`). Onto an item of the list itself they stay as numbered -- a new
 * item between two old ones -- and adds of paragraphs (a translation under
 * each line) are never read so.
 */
export function chainListAdds(
    changes: readonly NoteEditChangeType[],
    kindOf: (block: number) => string | null,
): NoteEditChangeType[] {
    const result = [...changes];
    for (let index = 1; index < result.length; index++) {
        const before = result[index - 1];
        const change = result[index];
        const isListRun =
            before?.block === undefined &&
            change?.block === undefined &&
            change.chain !== true &&
            SPLIT_LIST_KIND_SET.has(change.kind ?? '') &&
            change.kind === before.kind &&
            Number.isInteger(before.after) &&
            change.after === (before.after as number) + 1;
        if (!isListRun) {
            continue;
        }
        const kind = kindOf(change.after as number);
        if (kind !== null && kind !== change.kind) {
            result[index] = { ...change, chain: true };
        }
    }
    return result;
}

/**
 * A note rewritten as new blocks NUMBERED AS THEY WILL STAND (BN-58). Asked
 * to format a note that was one run-on paragraph, gemma4:cloud removed it
 * and added the formatted blocks `after: 0`, `after: 1`, `after: 2` … --
 * the title, then each part after the one before -- seven calls, each
 * refused (a block it removes, a number past the note's end), and no
 * answer. A run of new blocks whose `after` goes up one a group -- a group
 * being the adds one `section` spells -- onto a block the call removes or
 * past the note's end, is that: each group after the one before it
 * (`chain`, set here and never by a model).
 */
export function chainRewriteAdds(
    changes: readonly NoteEditChangeType[],
    count: number,
): NoteEditChangeType[] {
    const removedSet = new Set(
        changes
            .filter((change) => {
                return change?.block !== undefined && change.remove === true;
            })
            .map((change) => change.block),
    );
    const groups: { after: number; indexes: number[] }[] = [];
    changes.forEach((change, index) => {
        if (change?.block !== undefined || !Number.isInteger(change?.after)) {
            return;
        }
        const last = groups.at(-1);
        if (
            last !== undefined &&
            last.after === change.after &&
            last.indexes.at(-1) === index - 1
        ) {
            last.indexes.push(index);
            return;
        }
        groups.push({ after: change.after as number, indexes: [index] });
    });
    if (groups.length < 2) {
        return [...changes];
    }
    const base = groups[0].after;
    const chainedSet = new Set<number>();
    groups.forEach((group, order) => {
        if (
            order > 0 &&
            group.after === base + order &&
            (removedSet.has(group.after) || group.after > count)
        ) {
            group.indexes.forEach((index) => chainedSet.add(index));
        }
    });
    return changes.map((change, index) => {
        return chainedSet.has(index) ? { ...change, chain: true } : change;
    });
}

const HEADING_KIND_PATTERN = /^h[1-6]$/;

function checkIsHeadingKind(kind: unknown) {
    return typeof kind === 'string' && HEADING_KIND_PATTERN.test(kind);
}

/**
 * A heading's own marks written into its words (2026-11-10, BN-67). Asked to
 * finish a sermon, gemma4:cloud sent `{block: 4, text: "## 1. The shepherd
 * seeks"}` and `{after: 1, kind: "h2", text: "## Big idea"}`, and the note's
 * headings read "## 1. The shepherd seeks". One line of words opening with a
 * heading's marks, given to a heading -- or as a change of a block with no
 * kind, or a paragraph's -- is that heading: the marks come off, and say its
 * level when no heading kind is given. A paragraph ADD of mark-up is a
 * section already (`expandSectionAdds`); a code block's or a quote's words
 * are left as written (`# a comment` is code).
 */
export function readHeadingMarks(
    change: NoteEditChangeType,
    blockKind: string | null,
): NoteEditChangeType {
    if (
        typeof change !== 'object' ||
        change === null ||
        typeof change.text !== 'string' ||
        change.text.includes('\n')
    ) {
        return change;
    }
    const heading = HEADING_LINE_PATTERN.exec(change.text);
    if (heading === null || heading[2].trim() === '') {
        return change;
    }
    const isHeading = checkIsHeadingKind(change.kind);
    if (change.block === undefined) {
        return isHeading ? { ...change, text: heading[2].trim() } : change;
    }
    if (
        !isHeading &&
        change.kind !== undefined &&
        change.kind !== 'paragraph'
    ) {
        return change;
    }
    if (
        change.kind === undefined &&
        (blockKind === null || blockKind === 'code' || blockKind === 'quote')
    ) {
        return change;
    }
    return {
        ...change,
        kind: isHeading ? change.kind : `h${heading[1].length}`,
        text: heading[2].trim(),
    };
}

/**
 * A block CHANGED into one token naming a passage is the passage printed
 * (2026-11-10, BN-67), as a paragraph ADD of one is (`expandSectionAdds`):
 * asked to finish a sermon whose first line was "Sermon on Matthew
 * 6:25-34", gemma4:cloud changed that line to `[^Matthew 6:25-34]`, a chip
 * with ten verses folded into it where the lesson opens on the passage
 * read. The block gives way to the passage, in its place -- never a block
 * given its OWN words back (a chip of a range the person put in a line
 * stays that chip, byte for byte: `note-roundtrip.mjs`).
 */
export function expandPassageChanges(
    changes: readonly NoteEditChangeType[],
    toOwnText: (block: number) => string | null,
): NoteEditChangeType[] {
    return changes.flatMap((change) => {
        if (
            typeof change !== 'object' ||
            change === null ||
            typeof change.block !== 'number' ||
            change.after !== undefined ||
            change.remove === true ||
            typeof change.text !== 'string' ||
            !(change.kind === undefined || change.kind === 'paragraph')
        ) {
            return [change];
        }
        const ownText = toOwnText(change.block);
        if (ownText === null || ownText === change.text.trim()) {
            return [change];
        }
        const ref = readPassageLineRef(change.text);
        if (ref === null || !checkIsPassageRef(ref)) {
            return [change];
        }
        return [
            { after: change.block - 1, kind: 'passage', ref },
            { block: change.block, remove: true },
        ];
    });
}

/**
 * A passage given another reference is that passage, in its place (BN-72,
 * 2026-11-10: a review's fix "narrow point 2's passage to the stony ground"
 * came as `{block: 14, ref: "Matthew 13:5-6"}`, refused as saying nothing
 * to change, then as a passage given another kind).
 */
export function expandPassageRepoints(
    changes: readonly NoteEditChangeType[],
    kindOf: (block: number) => string | null,
): NoteEditChangeType[] {
    return changes.flatMap((change) => {
        if (
            typeof change !== 'object' ||
            change === null ||
            typeof change.block !== 'number' ||
            change.after !== undefined ||
            change.remove === true ||
            typeof change.ref !== 'string' ||
            change.ref.trim() === '' ||
            change.text !== undefined ||
            !(change.kind === undefined || change.kind === 'passage') ||
            kindOf(change.block) !== 'passage'
        ) {
            return [change];
        }
        return [
            {
                after: change.block - 1,
                kind: 'passage',
                ref: change.ref.trim(),
            },
            { block: change.block, remove: true },
        ];
    });
}

/**
 * A heading added, then what goes under it NUMBERED AS IT WILL STAND
 * (2026-11-10, BN-67). Asked to finish a sermon written as an outline,
 * gemma4:cloud added "Background" `after: 3`, its paragraph `after: 4`,
 * "Introduction" `after: 5` and its paragraph `after: 6` -- blocks 4 to 6
 * being the three points, so the background went under the first point and
 * the introduction under the second; three of four partial sermons came out
 * so. New blocks in a row, ONE block a place, whose `after` goes up one at a
 * time, holding a heading with words right after it, are one section: each
 * after the one before (`chain`). Sections, one a place (a group of blocks
 * with one `after`), are written by the note as read -- told so, the same
 * model put each point's words after its own heading, `after: 4, 5, 6`, and
 * chained they all went under the background. A heading over each of three
 * paragraphs (headings alone) and a line under each line (no heading) stay
 * as numbered too.
 */
export function chainSectionAdds(
    changes: readonly NoteEditChangeType[],
): NoteEditChangeType[] {
    type GroupType = { after: number; indexes: number[] };
    const groups: (GroupType | null)[] = [];
    changes.forEach((change, index) => {
        if (
            typeof change !== 'object' ||
            change === null ||
            change.block !== undefined ||
            !Number.isInteger(change.after)
        ) {
            groups.push(null);
            return;
        }
        const last = groups.at(-1);
        if (
            last !== undefined &&
            last !== null &&
            last.after === change.after &&
            last.indexes.at(-1) === index - 1
        ) {
            last.indexes.push(index);
            return;
        }
        groups.push({ after: change.after as number, indexes: [index] });
    });
    const chainedSet = new Set<number>();
    let run: GroupType[] = [];
    const settle = () => {
        if (
            run.length >= 2 &&
            run.every((group) => group.indexes.length === 1)
        ) {
            const kinds = run.flatMap((group) => {
                return group.indexes.map((index) => {
                    return changes[index].kind ?? 'paragraph';
                });
            });
            const isSection = kinds.some((kind, index) => {
                return (
                    checkIsHeadingKind(kind) &&
                    index + 1 < kinds.length &&
                    !checkIsHeadingKind(kinds[index + 1])
                );
            });
            if (isSection) {
                for (const group of run.slice(1)) {
                    group.indexes.forEach((index) => chainedSet.add(index));
                }
            }
        }
        run = [];
    };
    for (const group of groups) {
        if (group === null) {
            settle();
            continue;
        }
        const last = run.at(-1);
        if (
            last !== undefined &&
            group.after === last.after + 1 &&
            group.indexes[0] === (last.indexes.at(-1) as number) + 1
        ) {
            run.push(group);
            continue;
        }
        settle();
        run = [group];
    }
    settle();
    return changes.map((change, index) => {
        return chainedSet.has(index) ? { ...change, chain: true } : change;
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
    const passage = PASSAGE_LINE_PATTERN.exec(line);
    if (passage !== null && passage[1].trim() !== '') {
        return { after: 0, kind: 'passage', ref: passage[1].trim() };
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
 * check item, `1.` a numbered item, `>` a quote, `---` a rule, a verse
 * token alone on its line (`[^John 10:11-18]`) the passage itself -- and its
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
 * one verse it names cannot be read -- a passage no Bible could give is a
 * line of its reference, never a block dropped without a word.
 */
export function toUnfoundVersesAsWords(
    changes: readonly NoteEditChangeType[],
    foundRefSet: ReadonlySet<string>,
): NoteEditChangeType[] {
    return changes.map((change) => {
        if (
            change.kind === 'passage' &&
            typeof change.ref === 'string' &&
            !foundRefSet.has(change.ref.trim())
        ) {
            return {
                after: change.after,
                kind: 'paragraph',
                text: change.ref.trim(),
            };
        }
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
