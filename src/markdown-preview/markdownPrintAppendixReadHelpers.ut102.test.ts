// A reference the appendix cannot read -- its key, its verses, or the
// Bible that would carry it on -- is passed over, and the rest still print.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    installed: vi.fn(),
    fromVerseKey: vi.fn(),
    verseList: vi.fn(),
    title: vi.fn(),
    acquire: vi.fn(),
    release: vi.fn(),
    nameRecords: new Map<string, unknown>(),
    placeRecords: new Map<string, unknown>(),
}));

vi.mock('../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: h.installed,
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    fromVerseKey: h.fromVerseKey,
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { toVerseTextList: h.verseList, toTitle: h.title },
}));
vi.mock('../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: h.acquire,
    releaseLookupData: h.release,
}));
vi.mock('../location-name-lookup/lookupLangHelpers', () => ({
    getSelectedLookupLangCode: () => 'xx',
}));
// Only its caps and types are read here.
vi.mock('./markdownPreviewReferenceHelpers', () => ({
    findMarkdownRef: vi.fn(),
}));

import type { PrintReferencesType } from './markdownPrintAppendixHelpers';
import { readPrintAppendix } from './markdownPrintAppendixReadHelpers';

// `JHN 3:16-17` -> one chapter; `JHN 2:25-3:1` -> two.
function toTarget(verseKey: string) {
    const match = /^(\S+) (\d+):(\d+)-(?:(\d+):)?(\d+)$/.exec(verseKey);
    if (match === null) {
        const [bookKey, rest] = verseKey.split(' ');
        const [chapter, verse] = rest.split(':').map(Number);
        return { bookKey, chapter, verseStart: verse, verseEnd: verse };
    }
    return {
        bookKey: match[1],
        chapter: Number(match[2]),
        verseStart: Number(match[3]),
        ...(match[4] === undefined ? {} : { chapterEnd: Number(match[4]) }),
        verseEnd: Number(match[5]),
    };
}

function verses(chapter: number, list: [number, string][]) {
    return list.map(([verse, text]) => {
        return { verse, localeVerse: `v${verse}`, text, chapter };
    });
}

function request(
    kind: 'verse' | 'name' | 'location',
    target: string,
    bibleKey?: string,
) {
    return {
        kind,
        target,
        name: target,
        ...(bibleKey === undefined ? {} : { bibleKey }),
    };
}

// A verse whose Bible was named in brackets after it: `(Amplified)`.
function namedVerse(target: string, bibleKey: string) {
    return {
        ...request('verse', target, bibleKey),
        isBibleNamed: true as const,
    };
}

function genReferences(
    parts: Partial<PrintReferencesType>,
): PrintReferencesType {
    return { verses: [], names: [], places: [], ...parts };
}

beforeEach(() => {
    h.installed.mockReset().mockResolvedValue([{ key: 'KJV' }]);
    h.fromVerseKey
        .mockReset()
        .mockImplementation(async (_bibleKey: string, verseKey: string) => {
            return toTarget(verseKey);
        });
    h.verseList
        .mockReset()
        .mockImplementation(async (_bibleKey: string, target) => {
            return verses(target.chapter, [
                [target.verseStart, `words of ${target.verseStart}`],
            ]);
        });
    h.title.mockReset().mockImplementation(async (bibleKey: string, target) => {
        return `${bibleKey}:${target.bookKey} ${target.chapter}:${target.verseStart}-${target.verseEnd}`;
    });
    h.nameRecords.clear();
    h.placeRecords.clear();
    h.acquire.mockReset().mockResolvedValue({
        namesLookupManager: {
            getRecordById: (id: string) => h.nameRecords.get(id) ?? null,
        },
        locationsLookupManager: {
            getRecordById: (id: string) => h.placeRecords.get(id) ?? null,
        },
    });
    h.release.mockReset();
});

function toTitleList(appendix: { verses: { title: string }[] }) {
    return appendix.verses.map((entry) => {
        return entry.title;
    });
}

// Every verse of the passage asked for, each `text` long.
function readWholePassages(text: (verse: number) => string) {
    h.verseList.mockImplementation(async (_bibleKey: string, target) => {
        const list: ReturnType<typeof verses> = [];
        for (let verse = target.verseStart; verse <= target.verseEnd; verse++) {
            list.push(...verses(target.chapter, [[verse, text(verse)]]));
        }
        return list;
    });
}

describe('a reference the appendix cannot read', () => {
    test('a key the Bible fails on, or does not know, is left out and the next still prints', async () => {
        h.fromVerseKey.mockImplementation(
            async (_bibleKey: string, verseKey: string) => {
                if (verseKey === 'BROKEN 1:1') {
                    throw new Error('the Bible file is damaged');
                }
                if (verseKey === 'UNKNOWN 1:1') {
                    return null;
                }
                return toTarget(verseKey);
            },
        );

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    request('verse', 'BROKEN 1:1'),
                    request('verse', 'UNKNOWN 1:1'),
                    request('verse', 'JHN 3:16'),
                ],
            }),
        );

        expect(toTitleList(appendix)).toEqual(['KJV:JHN 3:16-16']);
        expect(appendix.leftOutCount).toBe(2);
        // Neither unreadable key reached the verses.
        expect(h.verseList).toHaveBeenCalledTimes(1);
    });

    test('verses that fail to read are left out, not thrown', async () => {
        h.verseList.mockImplementation(async (_bibleKey: string, target) => {
            if (target.chapter === 1) {
                throw new Error('chapter file missing');
            }
            return verses(target.chapter, [[target.verseStart, 'words']]);
        });

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    request('verse', 'GEN 1:1'),
                    request('verse', 'JHN 3:16'),
                ],
            }),
        );

        expect(toTitleList(appendix)).toEqual(['KJV:JHN 3:16-16']);
        expect(appendix.leftOutCount).toBe(1);
    });
});

describe('a reference the Bible before it cannot carry on', () => {
    beforeEach(() => {
        h.installed.mockResolvedValue([
            { key: 'KJV', locale: 'en' },
            { key: 'Amplified', locale: 'en-US' },
        ]);
        // Cut after verse 2: three verses are 7 500 characters.
        readWholePassages(() => {
            return 'x'.repeat(2500);
        });
    });

    test('a key that Bible fails on is read in its own Bible instead', async () => {
        h.fromVerseKey.mockImplementation(
            async (bibleKey: string, verseKey: string) => {
                if (bibleKey === 'Amplified' && verseKey === 'JHN 3:3-4') {
                    throw new Error('no such verse here');
                }
                return toTarget(verseKey);
            },
        );

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    namedVerse('JHN 3:1-36', 'Amplified'),
                    request('verse', 'JHN 3:3-4'),
                ],
            }),
        );

        expect(toTitleList(appendix)).toEqual([
            'Amplified:JHN 3:1-36',
            'KJV:JHN 3:3-4',
        ]);
        expect(appendix.leftOutCount).toBe(0);
    });

    test('a key that Bible does not know is read in its own Bible instead', async () => {
        h.fromVerseKey.mockImplementation(
            async (bibleKey: string, verseKey: string) => {
                if (bibleKey === 'Amplified' && verseKey === 'JHN 3:3-4') {
                    return null;
                }
                return toTarget(verseKey);
            },
        );

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    namedVerse('JHN 3:1-36', 'Amplified'),
                    request('verse', 'JHN 3:3-4'),
                ],
            }),
        );

        expect(toTitleList(appendix)).toEqual([
            'Amplified:JHN 3:1-36',
            'KJV:JHN 3:3-4',
        ]);
    });
});
