import { describe, expect, test } from 'vitest';

import {
    checkIsCrossChapterTarget,
    checkIsSameBibleTarget,
    getTargetChapterCount,
    getTargetChapterEnd,
    normalizeBibleTarget,
    toBibleTargetIdentityKey,
    toSingleChapterTarget,
    toTargetChapterList,
    toTargetChapterSliceList,
} from './bibleTargetHelpers';

const oneChapter = { bookKey: 'JHN', chapter: 3, verseStart: 16, verseEnd: 18 };
const crossChapter = {
    bookKey: 'JHN',
    chapter: 1,
    verseStart: 2,
    verseEnd: 4,
    chapterEnd: 5,
};

describe('bibleTargetHelpers', () => {
    test('a chapter end counts only when it is a later chapter', () => {
        expect(getTargetChapterEnd(oneChapter)).toBe(3);
        expect(getTargetChapterEnd(crossChapter)).toBe(5);
        expect(getTargetChapterEnd({ ...oneChapter, chapterEnd: 3 })).toBe(3);
        expect(getTargetChapterEnd({ ...oneChapter, chapterEnd: 1 })).toBe(3);
        expect(checkIsCrossChapterTarget(oneChapter)).toBe(false);
        expect(checkIsCrossChapterTarget(crossChapter)).toBe(true);
        expect(getTargetChapterCount(oneChapter)).toBe(1);
        expect(getTargetChapterCount(crossChapter)).toBe(5);
    });

    test('lists the chapters, or only a window of them', () => {
        expect(toTargetChapterList(oneChapter)).toEqual([3]);
        expect(toTargetChapterList(crossChapter)).toEqual([1, 2, 3, 4, 5]);
        expect(toTargetChapterList(crossChapter, 0, 3)).toEqual([1, 2, 3]);
        expect(toTargetChapterList(crossChapter, 3, 1)).toEqual([4]);
        expect(toTargetChapterList(crossChapter, 4, 3)).toEqual([5]);
        expect(toTargetChapterList(crossChapter, 5, 1)).toEqual([]);
    });

    test('slices the first chapter from its verse and the last up to its verse', () => {
        expect(toTargetChapterSliceList(crossChapter, 0, 2)).toEqual([
            {
                chapter: 1,
                verseStart: 2,
                verseEnd: null,
                isFirstChapter: true,
                isLastChapter: false,
            },
            {
                chapter: 2,
                verseStart: 1,
                verseEnd: null,
                isFirstChapter: false,
                isLastChapter: false,
            },
        ]);
        expect(toTargetChapterSliceList(crossChapter, 4)).toEqual([
            {
                chapter: 5,
                verseStart: 1,
                verseEnd: 4,
                isFirstChapter: false,
                isLastChapter: true,
            },
        ]);
        expect(toTargetChapterSliceList(oneChapter)).toEqual([
            {
                chapter: 3,
                verseStart: 16,
                verseEnd: 18,
                isFirstChapter: true,
                isLastChapter: true,
            },
        ]);
    });

    test('writes a chapter end only when it means something', () => {
        expect(normalizeBibleTarget({ ...oneChapter, chapterEnd: 3 })).toEqual(
            oneChapter,
        );
        expect(
            Object.keys(normalizeBibleTarget({ ...oneChapter, chapterEnd: 3 })),
        ).not.toContain('chapterEnd');
        expect(
            normalizeBibleTarget({ ...oneChapter, chapterEnd: undefined }),
        ).toEqual(oneChapter);
        expect(normalizeBibleTarget(crossChapter)).toEqual(crossChapter);
        expect(toSingleChapterTarget('JHN', 2, 1, 3)).toEqual({
            bookKey: 'JHN',
            chapter: 2,
            verseStart: 1,
            verseEnd: 3,
        });
    });

    test('compares passages, chapter end included', () => {
        expect(
            checkIsSameBibleTarget(oneChapter, {
                ...oneChapter,
                chapterEnd: 3,
            }),
        ).toBe(true);
        expect(
            checkIsSameBibleTarget(crossChapter, {
                ...crossChapter,
                chapterEnd: 4,
            }),
        ).toBe(false);
        expect(checkIsSameBibleTarget(oneChapter, crossChapter)).toBe(false);
        expect(toBibleTargetIdentityKey(oneChapter)).toBe('JHN 3:16-18');
        expect(toBibleTargetIdentityKey(crossChapter)).toBe('JHN 1:2-5:4');
    });
});
