import { describe, expect, test } from 'vitest';

import {
    MAX_OVERVIEW_OTHER_NAMES,
    genResourceOverview,
    readBookChapterName,
    toChapterSpanText,
} from './agentResourceOverviewHelpers';

describe('what is on the Resources shelf', () => {
    test('says chapters the way a person writes them', () => {
        expect(toChapterSpanText([3, 0, 1, 2, 9, 12, 13, 14, 2])).toBe(
            '0-3, 9, 12-14',
        );
        expect(toChapterSpanText([5])).toBe('5');
        expect(toChapterSpanText([])).toBe('');
    });

    test('reads a book and chapter only off a name of that shape', () => {
        expect(readBookChapterName('LUK.7.pdf')).toEqual({
            book: 'LUK',
            chapter: 7,
        });
        expect(readBookChapterName('luk.0.links.json')).toEqual({
            book: 'LUK',
            chapter: 0,
        });
        // Not a chapter as the panel spells one, or not a book at all.
        expect(readBookChapterName('LUK.07.pdf')).toBeNull();
        expect(readBookChapterName('NOTES.1.pdf')).toBeNull();
        expect(readBookChapterName('Jesus-family-line.jpeg')).toBeNull();
    });

    test('groups a folder by book, and names a few of the rest', () => {
        const overview = genResourceOverview([
            'LUK.6.pdf',
            'LUK.0.pdf',
            'LUK.7.pdf',
            'LUK.0.links.json',
            '1CH.12.pdf',
            'map.jpeg',
        ]);
        expect(overview.books).toEqual([
            { book: 'LUK', chapters: '0, 6-7', fileCount: 4 },
            { book: '1CH', chapters: '12', fileCount: 1 },
        ]);
        expect(overview.others).toEqual(['map.jpeg']);
        expect(overview.otherCount).toBe(1);
    });

    test('sums a big folder up rather than listing it', () => {
        const names = Array.from({ length: 50 }, (_, index) => {
            return `picture-${index.toString()}.jpg`;
        });
        const overview = genResourceOverview(names);
        expect(overview.others).toHaveLength(MAX_OVERVIEW_OTHER_NAMES);
        expect(overview.otherCount).toBe(50);
    });
});
