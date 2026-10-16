import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    langCode: 'en',
    // What the reader currently shows, or null when no reader is mounted.
    currentBibleKey: null as string | null,
    appliedList: [] as { bibleKey: string; target: any }[],
    // Which bible key each `BibleItem` factory was asked for.
    askedBibleKeys: [] as string[],
    // The chapter windows the sections were read in.
    sectionRangeList: [] as ({ start: number; count: number } | null)[],
}));

vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: async (bibleKey: string, verseKey: string) => {
            h.askedBibleKeys.push(bibleKey);
            if (verseKey === 'BAD') {
                return null;
            }
            if (verseKey === 'JHN 18:33-23:2') {
                return {
                    bibleKey,
                    target: {
                        bookKey: 'JHN',
                        chapter: 18,
                        verseStart: 33,
                        verseEnd: 2,
                        chapterEnd: 23,
                    },
                    toTitle: async () => 'John 18:33-23:2',
                };
            }
            return {
                bibleKey,
                target: { bookKey: 'EZK', chapter: 27 },
                toTitle: async () => `title in ${bibleKey}`,
                toFullText: async () => `text in ${bibleKey}`,
            };
        },
        fromTitleText: async (bibleKey: string) => {
            h.askedBibleKeys.push(bibleKey);
            return null;
        },
    },
}));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        // One section per chapter asked for, from the 18th.
        toTextSectionList: async (
            _bibleKey: string,
            target: any,
            _isSkipExtra: boolean,
            range?: { start: number; count: number },
        ) => {
            h.sectionRangeList.push(range ?? null);
            const start = range?.start ?? 0;
            const count =
                range?.count ?? target.chapterEnd - target.chapter + 1;
            return Array.from({ length: count }, (_, i) => {
                const chapter = target.chapter + start + i;
                return {
                    chapter,
                    localeChapter: `${chapter}`,
                    title: `John ${chapter}`,
                    text: `text ${chapter}`,
                };
            });
        },
        toLocaleBook: async (bibleKey: string, bookKey: string) => {
            h.askedBibleKeys.push(bibleKey);
            if (bookKey === 'ZZZ') {
                return undefined;
            }
            return bibleKey === 'KHOV' ? `${bookKey} in Khmer` : bookKey;
        },
    },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    getCurrentLookupBibleItemController: () => {
        if (h.currentBibleKey === null) {
            return null;
        }
        return { selectedBibleItem: { bibleKey: h.currentBibleKey } };
    },
}));
vi.mock('../helper/appHooks', () => ({ useAppEffect: () => undefined }));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    toLocaleNumBible: async (bibleKey: string, n: number) => {
        return bibleKey === 'KHOV' ? `[${n}]` : `${n}`;
    },
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: async () => 'a-font',
}));
vi.mock('../helper/helpers', () => ({ cloneJson: (value: any) => value }));
vi.mock('../lang/langHelpers', () => ({ DEFAULT_LANG_CODE: 'en' }));
vi.mock('./lookupLangHelpers', () => ({
    getSelectedLookupLangCode: () => h.langCode,
    useLookupLangCode: () => h.langCode,
}));

import {
    openVerseInBibleLookup,
    shortToReferenceTitle,
    shortToVerseCopyData,
    shortToVerseData,
    shortToVerseSectionList,
    shortToVerseTitle,
    toLookupVerseBibleKey,
} from './bibleVerseHelpers';

function genViewController(bibleKey: string) {
    return {
        selectedBibleItem: { bibleKey },
        applyTargetOrBibleKey: (_item: any, data: any) => {
            h.appliedList.push(data);
        },
    } as any;
}

beforeEach(() => {
    h.langCode = 'en';
    h.currentBibleKey = null;
    h.appliedList = [];
    h.askedBibleKeys = [];
    h.sectionRangeList = [];
});

// JHN 18:33-23:2, six chapters: the panel reads three, then one per press,
// and only Copy reads them all.
describe('a passage across chapters in a verse panel', () => {
    test('is read three chapters deep, a section per chapter', async () => {
        const verseData = await shortToVerseData('KJV', 'JHN 18:33-23:2');
        expect(verseData).toMatchObject({
            title: 'John 18:33-23:2',
            chapterCount: 6,
            shownChapterCount: 3,
            text: 'John 18\ntext 18\nJohn 19\ntext 19\nJohn 20\ntext 20',
        });
        expect(verseData?.sectionList?.map(({ chapter }) => chapter)).toEqual([
            18, 19, 20,
        ]);
        expect(h.sectionRangeList).toEqual([{ start: 0, count: 3 }]);
    });

    test('reads one more chapter at a time', async () => {
        const sectionList = await shortToVerseSectionList(
            'KJV',
            'JHN 18:33-23:2',
            3,
        );
        expect(sectionList?.map(({ chapter }) => chapter)).toEqual([21]);
        expect(h.sectionRangeList).toEqual([{ start: 3, count: 1 }]);
    });

    test('is copied whole, every chapter under its title', async () => {
        const copyData = await shortToVerseCopyData('KJV', 'JHN 18:33-23:2');
        expect(copyData?.sectionList).toHaveLength(6);
        expect(copyData?.text.split('\n')[0]).toBe('John 18');
        expect(h.sectionRangeList).toEqual([null]);
    });
});

describe('which bible a stored reference is read back in', () => {
    // The dataset was extracted FROM the KJV, so for English records its
    // wording is the one that matches them — whatever the reader is set to.
    test('stays KJV for English, even with another bible open', () => {
        expect(toLookupVerseBibleKey('NIV')).toBe('KJV');
        expect(toLookupVerseBibleKey(null)).toBe('KJV');
    });

    // A Khmer record citing `Ezekiel 27:11` in English beside its own Khmer
    // prose is unreadable to exactly the person who chose Khmer.
    test('follows the reader for any other lookup language', () => {
        h.langCode = 'km';

        expect(toLookupVerseBibleKey('KHOV')).toBe('KHOV');
    });

    // The detail panels are window-level widgets and outlive any reader, so
    // "no bible selected" has to resolve to something readable, not to null.
    test('falls back to KJV when no reader is mounted', () => {
        h.langCode = 'km';

        expect(toLookupVerseBibleKey(null)).toBe('KJV');
    });
});

describe('resolving a reference', () => {
    test('reads the title from the bible it was handed', async () => {
        expect(await shortToVerseTitle('KHOV', 'EZK 27:11')).toBe(
            'title in KHOV',
        );

        expect(h.askedBibleKeys).toStrictEqual(['KHOV']);
    });

    // Anything outside the canonical `EZK 27:11` shape still goes through the
    // lenient parser rather than being dropped from the list.
    test('falls back to the lenient parser in the same bible', async () => {
        expect(await shortToVerseTitle('KHOV', 'BAD')).toBeNull();

        expect(h.askedBibleKeys).toStrictEqual(['KHOV', 'KHOV']);
    });
});

describe('opening a citation in the reader', () => {
    test('leaves an English lookup on the KJV', async () => {
        await openVerseInBibleLookup(genViewController('NIV'), 'EZK 27:11');

        expect(h.appliedList[0].bibleKey).toBe('KJV');
    });

    // Swapping the reader to the KJV underneath the user would undo the very
    // choice that put the citation in their own language a moment earlier.
    test('keeps the reader on its own bible otherwise', async () => {
        h.langCode = 'km';

        await openVerseInBibleLookup(genViewController('KHOV'), 'EZK 27:11');

        expect(h.appliedList[0].bibleKey).toBe('KHOV');
    });

    // A panel opened in a bible of its own -- a cross reference, a found
    // verse -- opens the verse in the reader in exactly that bible.
    test('opens in the panel own bible whatever the lookup setting', async () => {
        await openVerseInBibleLookup(
            genViewController('NIV'),
            'EZK 27:11',
            'KHOV',
        );

        expect(h.appliedList[0].bibleKey).toBe('KHOV');
        expect(h.askedBibleKeys).toContain('KHOV');
    });

    test('reports a reference it cannot resolve instead of applying it', async () => {
        expect(
            await openVerseInBibleLookup(genViewController('KJV'), 'BAD'),
        ).toBe(false);
        expect(h.appliedList).toHaveLength(0);
    });
});

describe('naming a book or a chapter in the bible behind it', () => {
    // The datasets are written against the KJV, so `[Acts](book-key://ACT)`
    // ships an English label whatever language the record itself is in.
    test('names a book from that bible own book map', async () => {
        expect(await shortToReferenceTitle('KHOV', 'book', 'ACT')).toBe(
            'ACT in Khmer',
        );
    });

    // The chapter goes through that bible numeral list, exactly as a verse
    // title does — a Khmer bible writes `14` as `១៤`.
    test('numbers a chapter the way that bible numbers it', async () => {
        expect(await shortToReferenceTitle('KHOV', 'chapter', 'GEN 14')).toBe(
            'GEN in Khmer [14]',
        );
    });

    test('routes a verse through the verse resolver', async () => {
        expect(await shortToReferenceTitle('KHOV', 'verse', 'EZK 27:11')).toBe(
            'title in KHOV',
        );
    });

    // Null, not a blank: the caller falls back to the label the dataset
    // shipped rather than dropping the reference out of the sentence.
    test('gives back nothing for a key that bible does not know', async () => {
        expect(await shortToReferenceTitle('KHOV', 'book', 'ZZZ')).toBeNull();
        expect(
            await shortToReferenceTitle('KHOV', 'chapter', 'GEN'),
        ).toBeNull();
    });
});
