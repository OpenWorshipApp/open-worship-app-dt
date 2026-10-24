/**
 * The person's OWN notes and marks on a passage, for `owa_lookup_record`'s
 * `related` (2026-10-23; the user's goal with a Bible view's 🤖
 * conversation on Genesis 8:1-22: _help user find everything related to the
 * selected verses_). The app's cross references, the chapter's study files
 * and the verses around it were all in the record; what the person had
 * written about those very verses -- a Bible note naming one, a highlight, a
 * comment -- was not, and _what did I note here?_ had nothing to answer
 * from.
 *
 * Pure: the Reader's two note indexes come in
 * (`bibleNoteShortVerseHelpers.ts`: which note items name each verse, and
 * what is marked on each), the note items' words with them, and a test
 * hands it indexes of its own. The worker (`agentLookupHelpers.ts`) reads
 * them.
 */

import type { VerseAnnotationsMapType } from '../bible-list/note/verseAnnotationHelpers';
import { readLexicalText, toFirstWords } from './agentNoteTextHelpers';

// A note is named by its title and its first words; the model reads the
// rest with the note tool when asked, as the person would open it.
const MAX_NOTES = 6;
const MAX_NOTE_WORDS = 200;
const MAX_MARK_ROWS = 10;
const MAX_MARK_WORDS = 120;
const MAX_COMMENT_WORDS = 200;

/** A note that names verses of the passage, as the record carries it. */
export type PassageNoteRowType = {
    // The note file's name (`Default`), never its path.
    file: string;
    title: string;
    // `GEN 8:20` -- the passage's verses it names.
    verses: string[];
    text: string;
};

/** What is marked on one verse in one Bible. */
export type PassageMarkRowType = {
    // `GEN 8:11`
    verse: string;
    bible: string;
    highlighted: string[];
    comments: { words: string; comment: string }[];
};

/**
 * `"<note file path>@<id>"` -> the verses of the passage it names, in the
 * passage's order, for every note item the index has on them.
 */
export function collectPassageNoteRefs(
    shortVerseNoteRefs: Record<string, string[]>,
    verseKeyList: string[],
) {
    const refVersesMap = new Map<string, string[]>();
    for (const verseKey of verseKeyList) {
        for (const ref of shortVerseNoteRefs[verseKey] ?? []) {
            const verses = refVersesMap.get(ref) ?? [];
            if (!verses.includes(verseKey)) {
                verses.push(verseKey);
            }
            refVersesMap.set(ref, verses);
        }
    }
    return refVersesMap;
}

/**
 * A note item of a note file as a row, or null for an item that is a
 * verse's marks (those are `collectPassageMarks`'s) or holds no words.
 */
export function toPassageNoteRow(
    file: string,
    item: any,
    verses: string[],
): PassageNoteRowType | null {
    if (typeof item?.verseKey === 'string' && item.verseKey !== '') {
        return null;
    }
    const title = typeof item?.title === 'string' ? item.title.trim() : '';
    const text = toFirstWords(readLexicalText(item?.content), MAX_NOTE_WORDS);
    if (title.length === 0 && text.length === 0) {
        return null;
    }
    return { file, title, verses, text };
}

const MARKED_VERSE_KEY_PATTERN = /^\((.+?)\) (\S+ \d+:\d+)$/;

/**
 * The highlights and comments on the passage's verses, in every Bible they
 * were made in (a mark is a range of one translation's words), verse by
 * verse in the passage's order.
 */
export function collectPassageMarks(
    verseAnnotationsMap: VerseAnnotationsMapType,
    verseKeyList: string[],
) {
    const order = new Map(
        verseKeyList.map((verseKey, index) => {
            return [verseKey, index] as const;
        }),
    );
    const rows: (PassageMarkRowType & { at: number })[] = [];
    for (const [fullKey, annotations] of Object.entries(verseAnnotationsMap)) {
        const match = MARKED_VERSE_KEY_PATTERN.exec(fullKey);
        const at = match === null ? undefined : order.get(match[2]);
        if (match === null || at === undefined) {
            continue;
        }
        const highlighted = annotations.highlights.map(({ highlight }) => {
            return toFirstWords(highlight.text, MAX_MARK_WORDS);
        });
        const comments = annotations.comments.map(({ comment }) => {
            return {
                words: toFirstWords(comment.text, MAX_MARK_WORDS),
                comment: toFirstWords(comment.comment, MAX_COMMENT_WORDS),
            };
        });
        if (highlighted.length === 0 && comments.length === 0) {
            continue;
        }
        rows.push({
            verse: match[2],
            bible: match[1],
            highlighted,
            comments,
            at,
        });
    }
    return rows
        .sort((a, b) => {
            return a.at - b.at;
        })
        .map(({ at: _at, ...row }) => {
            return row;
        });
}

/**
 * What the record carries, or null when the person has nothing on these
 * verses: how many verses carry something of theirs, the notes and the marks
 * (the first few of each, with how many there are).
 */
export function toPassageNotesFacts(
    notes: PassageNoteRowType[],
    marks: PassageMarkRowType[],
) {
    if (notes.length === 0 && marks.length === 0) {
        return null;
    }
    const verseSet = new Set<string>();
    for (const note of notes) {
        for (const verse of note.verses) {
            verseSet.add(verse);
        }
    }
    for (const mark of marks) {
        verseSet.add(mark.verse);
    }
    return {
        verseCount: verseSet.size,
        ...(notes.length > 0
            ? { notes: notes.slice(0, MAX_NOTES), noteCount: notes.length }
            : {}),
        ...(marks.length > 0
            ? {
                  marks: marks.slice(0, MAX_MARK_ROWS),
                  markCount: marks.length,
              }
            : {}),
    };
}
