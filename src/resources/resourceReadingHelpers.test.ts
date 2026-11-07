import { describe, expect, test, vi } from 'vitest';

// The real name matching runs; only the file helpers it is imported beside
// need an app to answer at load.
vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        fileUtils: { readdir: vi.fn() },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (filePath: string) =>
                filePath.slice(filePath.lastIndexOf('/') + 1),
        },
    },
}));

import type { BibleTargetType } from '../helper/bible-helpers/bibleTargetHelpers';
import {
    findResourceReadingPane,
    type ResourceReadingPaneType,
    toResourceReading,
} from './resourceReadingHelpers';

function genPane(
    target: BibleTargetType,
    title: string | (() => Promise<string>) = 'Genesis 22:1-5',
    bibleKey = 'KJV',
): ResourceReadingPaneType {
    return {
        bibleKey,
        target,
        toTitle:
            typeof title === 'function' ? title : () => Promise.resolve(title),
    };
}

const GEN_22_1_5 = { bookKey: 'GEN', chapter: 22, verseStart: 1, verseEnd: 5 };
// Genesis 22:10 to 24:3, read three chapters at a time.
const GEN_22_TO_24 = {
    bookKey: 'GEN',
    chapter: 22,
    verseStart: 10,
    verseEnd: 3,
    chapterEnd: 24,
};

describe('findResourceReadingPane', () => {
    test('a chapter file read in a one-chapter passage hands over its verses', () => {
        const pane = genPane(GEN_22_1_5);
        expect(findResourceReadingPane('GEN.22.sermon.pdf', [pane])).toEqual({
            pane,
            chapter: 22,
            hasVerses: true,
        });
    });

    test('no pane on the file, or no pane at all, finds nothing', () => {
        expect(findResourceReadingPane('GEN.22.pdf', [])).toBeNull();
        expect(
            findResourceReadingPane('GEN.22.pdf', [
                genPane({ ...GEN_22_1_5, bookKey: 'EXO' }),
                genPane({ ...GEN_22_1_5, chapter: 23 }),
            ]),
        ).toBeNull();
        // Not a chapter file at all: a free-text hit.
        expect(
            findResourceReadingPane('Abraham-notes.pdf', [genPane(GEN_22_1_5)]),
        ).toBeNull();
    });

    test('the first pane on the file is the one, after those that are not', () => {
        const other = genPane({ ...GEN_22_1_5, bookKey: 'EXO' });
        const first = genPane(GEN_22_1_5, 'first');
        const second = genPane({ ...GEN_22_1_5, verseStart: 7 }, 'second');
        expect(
            findResourceReadingPane('GEN.22.pdf', [other, first, second])?.pane,
        ).toBe(first);
    });

    test('a passage that runs into later chapters gives the chapter, never its verses', () => {
        const pane = genPane(GEN_22_TO_24);
        // The start chapter: the verses run on past it.
        expect(findResourceReadingPane('GEN.22.pdf', [pane])).toEqual({
            pane,
            chapter: 22,
            hasVerses: false,
        });
        // A later chapter of the same passage.
        expect(findResourceReadingPane('GEN.24.pdf', [pane])).toEqual({
            pane,
            chapter: 24,
            hasVerses: false,
        });
    });

    test('only the chapters the pane shows count, as the panel lists them', () => {
        const pane = genPane({ ...GEN_22_TO_24, chapter: 1, chapterEnd: 10 });
        expect(findResourceReadingPane('GEN.3.pdf', [pane])?.chapter).toBe(3);
        // Chapter 4 is past the three a long passage opens with.
        expect(findResourceReadingPane('GEN.4.pdf', [pane])).toBeNull();
    });

    test('a book-level file is filed at the chapter being read, with no verses', () => {
        const pane = genPane(GEN_22_1_5);
        expect(findResourceReadingPane('GEN.0.intro.pdf', [pane])).toEqual({
            pane,
            chapter: 22,
            hasVerses: false,
        });
    });
});

describe('toResourceReading', () => {
    test('hands over the pane: its book, chapter, verses, trimmed title and bible', async () => {
        expect(
            await toResourceReading('GEN.22.pdf', [
                genPane(GEN_22_1_5, '  Genesis 22:1-5 \n', 'NIV'),
            ]),
        ).toEqual({
            bookKey: 'GEN',
            chapter: 22,
            verseStart: 1,
            verseEnd: 5,
            title: 'Genesis 22:1-5',
            bibleKey: 'NIV',
        });
    });

    test('without verses the reading carries no verse keys at all', async () => {
        const reading = await toResourceReading('GEN.23.pdf', [
            genPane(GEN_22_TO_24, 'Genesis 22:10-24:3'),
        ]);
        expect(reading).toEqual({
            bookKey: 'GEN',
            chapter: 23,
            title: 'Genesis 22:10-24:3',
            bibleKey: 'KJV',
        });
        expect(Object.keys(reading!)).not.toContain('verseStart');
        expect(Object.keys(reading!)).not.toContain('verseEnd');
    });

    test('no pane on the file hands nothing over, and asks no title', async () => {
        const toTitle = vi.fn(async () => 'Exodus 1');
        expect(
            await toResourceReading('GEN.22.pdf', [
                genPane({ ...GEN_22_1_5, bookKey: 'EXO' }, toTitle),
            ]),
        ).toBeNull();
        expect(toTitle).not.toHaveBeenCalled();
    });

    test('a title that cannot be worked out, or is blank, leaves the file on its own', async () => {
        expect(
            await toResourceReading('GEN.22.pdf', [
                genPane(GEN_22_1_5, () =>
                    Promise.reject(new Error('bible not downloaded')),
                ),
            ]),
        ).toBeNull();
        expect(
            await toResourceReading('GEN.22.pdf', [
                genPane(GEN_22_1_5, ' \t '),
            ]),
        ).toBeNull();
    });
});
