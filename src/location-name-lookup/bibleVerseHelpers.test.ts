import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    langCode: 'en',
    // What the reader currently shows, or null when no reader is mounted.
    currentBibleKey: null as string | null,
    appliedList: [] as { bibleKey: string; target: any }[],
    // Which bible key each `BibleItem` factory was asked for.
    askedBibleKeys: [] as string[],
}));

vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: async (bibleKey: string, verseKey: string) => {
            h.askedBibleKeys.push(bibleKey);
            if (verseKey === 'BAD') {
                return null;
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
    useSelectedLookupLangCode: () => h.langCode,
}));

import {
    openVerseInBibleLookup,
    shortToReferenceTitle,
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
