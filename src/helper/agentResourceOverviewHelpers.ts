/**
 * What is in a Resources folder, in a few lines a model can read: which
 * books have files and for which chapters, and the files named after no
 * chapter. `owa_resource_file`'s `list` with nothing to narrow it answers
 * with this (2026-10-17, the user: _ask everything among resources files_),
 * so a question across the whole shelf starts from what is on it rather
 * than from a guess. Pure, every rule a test.
 */
import { toResourceBookKey } from './agentResourceNameHelpers';

// What one overview names: a folder of thousands is summed up, not listed.
export const MAX_OVERVIEW_OTHER_NAMES = 30;

/** Chapters as a person writes them: `0-7, 9, 12-24`. */
export function toChapterSpanText(chapters: number[]) {
    const sorted = [...new Set(chapters)].sort((a, b) => {
        return a - b;
    });
    const spans: string[] = [];
    let start: number | null = null;
    let previous: number | null = null;
    const closeSpan = () => {
        if (start === null || previous === null) {
            return;
        }
        spans.push(
            start === previous
                ? String(start)
                : `${start.toString()}-${previous.toString()}`,
        );
    };
    for (const chapter of sorted) {
        if (previous !== null && chapter === previous + 1) {
            previous = chapter;
            continue;
        }
        closeSpan();
        start = chapter;
        previous = chapter;
    }
    closeSpan();
    return spans.join(', ');
}

/** `LUK.7.pdf` → `{ book: 'LUK', chapter: 7 }`; null for any other name. */
export function readBookChapterName(fileName: string) {
    const matched = /^([^.]+)\.(-?\d+)\.[^.]/.exec(fileName);
    if (matched === null || String(Number(matched[2])) !== matched[2]) {
        return null;
    }
    const book = toResourceBookKey(matched[1]);
    return book === null ? null : { book, chapter: Number(matched[2]) };
}

export type ResourceOverviewType = {
    // Per book in the Bible's own order of first appearance in the names:
    // the chapters it has files for, 0 being its introduction.
    books: { book: string; chapters: string; fileCount: number }[];
    // Files named after no chapter, a few of them by name.
    others: string[];
    otherCount: number;
};

/** The overview of one folder's file names (the names alone, no paths). */
export function genResourceOverview(fileNames: string[]): ResourceOverviewType {
    const bookMap = new Map<
        string,
        { chapters: number[]; fileCount: number }
    >();
    const others: string[] = [];
    let otherCount = 0;
    for (const fileName of fileNames) {
        const named = readBookChapterName(fileName);
        if (named === null) {
            otherCount += 1;
            if (others.length < MAX_OVERVIEW_OTHER_NAMES) {
                others.push(fileName);
            }
            continue;
        }
        const entry = bookMap.get(named.book) ?? { chapters: [], fileCount: 0 };
        entry.chapters.push(named.chapter);
        entry.fileCount += 1;
        bookMap.set(named.book, entry);
    }
    return {
        books: [...bookMap.entries()].map(([book, entry]) => {
            return {
                book,
                chapters: toChapterSpanText(entry.chapters),
                fileCount: entry.fileCount,
            };
        }),
        others,
        otherCount,
    };
}
