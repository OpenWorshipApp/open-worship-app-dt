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
import {
    readPrintAppendix,
    readPrintVerseEntry,
} from './markdownPrintAppendixReadHelpers';

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

describe('a passage for the paper', () => {
    test('is its verses with their numbers, skipping any the Bible lacks', async () => {
        h.verseList.mockResolvedValueOnce(
            verses(3, [
                [16, 'For God so loved the world,'],
                [17, '??'],
                [18, ' He that believeth '],
            ]),
        );

        const entry = await readPrintVerseEntry('KJV', 'JHN 3:16-18');

        expect(h.verseList).toHaveBeenCalledWith(
            'KJV',
            toTarget('JHN 3:16-18'),
            true,
        );
        expect(entry).toEqual({
            title: 'KJV:JHN 3:16-18',
            bibleKey: 'KJV',
            chapters: [
                {
                    title: null,
                    verses: [
                        { verse: 'v16', text: 'For God so loved the world,' },
                        { verse: 'v18', text: 'He that believeth' },
                    ],
                },
            ],
            isCut: false,
        });
    });

    test('over chapters is each chapter under its own title', async () => {
        h.verseList.mockResolvedValueOnce([
            ...verses(2, [[25, 'And needed not']]),
            ...verses(3, [
                [1, 'There was a man'],
                [2, 'The same came'],
            ]),
        ]);

        const entry = await readPrintVerseEntry('KJV', 'JHN 2:25-3:2');

        expect(
            entry?.chapters.map((chapter) => {
                return chapter.title;
            }),
        ).toEqual(['KJV:JHN 2:25-25', 'KJV:JHN 3:1-2']);
    });

    test('stops at about a chapter of words and says it was cut', async () => {
        const longText = 'x'.repeat(2500);
        h.verseList.mockResolvedValueOnce(
            verses(119, [
                [1, longText],
                [2, longText],
                [3, longText],
                [4, longText],
            ]),
        );

        const entry = await readPrintVerseEntry('KJV', 'PSA 119:1-4');

        expect(entry?.chapters[0].verses).toHaveLength(2);
        expect(entry?.isCut).toBe(true);
    });

    test('is nothing for a key no Bible reads, a book it lacks, or only missing verses', async () => {
        h.fromVerseKey.mockResolvedValueOnce(null);
        expect(await readPrintVerseEntry('KJV', 'nonsense')).toBeNull();
        h.verseList.mockResolvedValueOnce(null);
        expect(await readPrintVerseEntry('KJV', 'TOB 1:1')).toBeNull();
        h.verseList.mockResolvedValueOnce(verses(3, [[99, '??']]));
        expect(await readPrintVerseEntry('KJV', 'JHN 3:99')).toBeNull();
    });
});

describe("the appendix's verses", () => {
    test('are read in the Bible a reference was written in, else the KJV, else the first installed', async () => {
        h.installed.mockResolvedValue([{ key: 'ABC' }, { key: 'KJV' }]);
        await readPrintAppendix(
            genReferences({
                verses: [
                    request('verse', 'JHN 3:16', 'abc'),
                    request('verse', 'JHN 3:17'),
                    request('verse', 'JHN 3:18', 'GONE'),
                ],
            }),
        );
        expect(
            h.verseList.mock.calls.map((call) => {
                return call[0];
            }),
        ).toEqual(['ABC', 'KJV', 'KJV']);

        h.verseList.mockClear();
        h.installed.mockResolvedValue([{ key: 'ABC' }, { key: 'DEF' }]);
        await readPrintAppendix(
            genReferences({ verses: [request('verse', 'JHN 3:16')] }),
        );
        expect(h.verseList.mock.calls[0][0]).toBe('ABC');
    });

    test('with no Bible installed are all left out, and the records still read', async () => {
        h.installed.mockResolvedValue([]);
        h.nameRecords.set('n-1', {
            name: 'Moses',
            kjvName: null,
            title: 'A prophet',
            description: '',
        });

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [request('verse', 'JHN 3:16')],
                names: [request('name', 'n-1')],
            }),
        );

        expect(appendix.verses).toEqual([]);
        expect(appendix.names).toHaveLength(1);
        expect(appendix.leftOutCount).toBe(1);
        expect(h.verseList).not.toHaveBeenCalled();
    });
});

describe('a passage already on the paper', () => {
    // Every verse of the passage asked for, each `text` long; a passage over
    // two chapters is its first verse, then the next chapter to its end.
    function readWholePassages(text: (verse: number) => string) {
        h.verseList.mockImplementation(async (_bibleKey: string, target) => {
            const chapterEnd = target.chapterEnd ?? target.chapter;
            const list: ReturnType<typeof verses> = [];
            for (
                let chapter = target.chapter;
                chapter <= chapterEnd;
                chapter++
            ) {
                const first =
                    chapter === target.chapter ? target.verseStart : 1;
                const last = chapter === chapterEnd ? target.verseEnd : first;
                for (let verse = first; verse <= last; verse++) {
                    list.push(...verses(chapter, [[verse, text(verse)]]));
                }
            }
            return list;
        });
    }

    function toTitleList(appendix: { verses: { title: string }[] }) {
        return appendix.verses.map((entry) => {
            return entry.title;
        });
    }

    test('is not printed again in the same Bible, nor counted as left out', async () => {
        h.installed.mockResolvedValue([{ key: 'KJV' }, { key: 'ABC' }]);
        readWholePassages((verse) => {
            return `words of ${verse}`;
        });

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    request('verse', 'JHN 3:1-36'),
                    request('verse', 'JHN 3:3-8'),
                    request('verse', 'JHN 3:3-8', 'ABC'),
                    request('verse', 'JHN 3:16'),
                    request('verse', 'JHN 3:36-4:2'),
                    request('verse', 'JHN 4:1-2'),
                ],
            }),
        );

        // Held by John 3:1-36: 3:3-8 and 3:16 in the KJV, and 4:1-2 by the
        // passage over two chapters printed before it.
        expect(toTitleList(appendix)).toEqual([
            'KJV:JHN 3:1-36',
            'ABC:JHN 3:3-8',
            'KJV:JHN 3:36-2',
        ]);
        expect(appendix.leftOutCount).toBe(0);
        expect(h.verseList).toHaveBeenCalledTimes(3);
    });

    test('holds a reference whose Bible was not named from another Bible of its language, never one whose Bible was', async () => {
        // The user's John 3 study: `John 3:1-36 (Amplified)` heading its
        // English part, the chapter in a second language's words with one of
        // that language's Bibles named heading the other, and under each
        // plain references -- the English read in the KJV, the other in the
        // first Bible of its language that writes John so.
        h.installed.mockResolvedValue([
            { key: 'KJV', locale: 'en' },
            { key: 'Amplified', locale: 'en-US' },
            { key: 'KHB', locale: 'km' },
            { key: 'KHC', locale: 'km-KH' },
        ]);
        readWholePassages((verse) => {
            return `words of ${verse}`;
        });

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    namedVerse('JHN 3:1-36', 'Amplified'),
                    // Its own Bible named: printed in it.
                    namedVerse('JHN 3:17', 'KJV'),
                    request('verse', 'JHN 3:16'),
                    namedVerse('JHN 3:1-36', 'KHC'),
                    request('verse', 'JHN 3:5', 'KHB'),
                    namedVerse('JHN 3:6', 'KHB'),
                ],
            }),
        );

        expect(toTitleList(appendix)).toEqual([
            'Amplified:JHN 3:1-36',
            'KJV:JHN 3:17-17',
            'KHC:JHN 3:1-36',
            'KHB:JHN 3:6-6',
        ]);
        expect(appendix.leftOutCount).toBe(0);
    });

    test("does not hold one from another language's Bible, or across Bibles whose language is not known", async () => {
        h.installed.mockResolvedValue([
            { key: 'KJV', locale: 'en' },
            { key: 'KHB', locale: 'km' },
        ]);
        readWholePassages((verse) => {
            return `words of ${verse}`;
        });
        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    namedVerse('JHN 3:1-36', 'KHB'),
                    request('verse', 'JHN 3:16'),
                ],
            }),
        );
        expect(toTitleList(appendix)).toEqual([
            'KHB:JHN 3:1-36',
            'KJV:JHN 3:16-16',
        ]);

        h.installed.mockResolvedValue([{ key: 'ABC' }, { key: 'DEF' }]);
        const unknownAppendix = await readPrintAppendix(
            genReferences({
                verses: [
                    namedVerse('JHN 3:1-36', 'DEF'),
                    request('verse', 'JHN 3:16'),
                ],
            }),
        );
        expect(toTitleList(unknownAppendix)).toEqual([
            'DEF:JHN 3:1-36',
            'ABC:JHN 3:16-16',
        ]);
    });

    test('is printed when it comes first, or reaches past where the passage was cut', async () => {
        readWholePassages(() => {
            return 'x'.repeat(2500);
        });

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    request('verse', 'PSA 119:3'),
                    // Cut after verse 2: three verses are 7 500 characters.
                    request('verse', 'PSA 119:1-4'),
                    request('verse', 'PSA 119:2'),
                    request('verse', 'PSA 119:2-4'),
                    request('verse', 'PSA 118:1'),
                ],
            }),
        );

        expect(toTitleList(appendix)).toEqual([
            'KJV:PSA 119:3-3',
            'KJV:PSA 119:1-4',
            'KJV:PSA 119:2-4',
            'KJV:PSA 118:1-1',
        ]);
        expect(appendix.leftOutCount).toBe(0);
    });

    test('carries a reference that starts inside it, and is not held, on in its Bible', async () => {
        // The user's John 3 study: the Amplified chapter cut short, then
        // a reference into it that names no Bible.
        h.installed.mockResolvedValue([
            { key: 'KJV', locale: 'en' },
            { key: 'Amplified', locale: 'en-US' },
            { key: 'KHB', locale: 'km' },
        ]);
        readWholePassages(() => {
            return 'x'.repeat(2500);
        });

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    // Cut after verse 2: three verses are 7 500 characters.
                    namedVerse('JHN 3:1-36', 'Amplified'),
                    request('verse', 'JHN 3:2-4'),
                    // Starting before it, in a chapter it does not ask for,
                    // in another language, or with its own Bible named: as
                    // they would have been.
                    request('verse', 'JHN 2:25-3:1'),
                    request('verse', 'JHN 4:1'),
                    request('verse', 'JHN 3:5', 'KHB'),
                    namedVerse('JHN 3:6', 'KJV'),
                ],
            }),
        );

        expect(toTitleList(appendix)).toEqual([
            'Amplified:JHN 3:1-36',
            'Amplified:JHN 3:2-4',
            'KJV:JHN 2:25-1',
            'KJV:JHN 4:1-1',
            'KHB:JHN 3:5-5',
            'KJV:JHN 3:6-6',
        ]);
        expect(appendix.leftOutCount).toBe(0);
    });

    test('reads one its Bible cannot read as it would have been', async () => {
        h.installed.mockResolvedValue([
            { key: 'KJV', locale: 'en' },
            { key: 'Amplified', locale: 'en-US' },
        ]);
        readWholePassages(() => {
            return 'x'.repeat(2500);
        });
        const readWhole = h.verseList.getMockImplementation()!;
        // The Amplified lacks verse 30.
        h.verseList.mockImplementation(async (bibleKey: string, target) => {
            if (bibleKey === 'Amplified' && target.verseStart === 30) {
                return verses(target.chapter, [[30, '??']]);
            }
            return readWhole(bibleKey, target);
        });

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [
                    namedVerse('JHN 3:1-36', 'Amplified'),
                    request('verse', 'JHN 3:30'),
                ],
            }),
        );

        expect(toTitleList(appendix)).toEqual([
            'Amplified:JHN 3:1-36',
            'KJV:JHN 3:30-30',
        ]);
    });

    test('past the cap is still not left out', async () => {
        const verseList = Array.from({ length: 61 }, (_value, index) => {
            return request('verse', `PSA ${index + 1}:1`);
        });

        const appendix = await readPrintAppendix(
            genReferences({
                verses: [...verseList, request('verse', 'PSA 1:1', 'KJV')],
            }),
        );

        expect(appendix.verses).toHaveLength(60);
        // Psalm 61:1 alone; Psalm 1:1 again is on the paper already.
        expect(appendix.leftOutCount).toBe(1);
        expect(h.verseList).toHaveBeenCalledTimes(60);
    });
});

describe("the appendix's people and places", () => {
    test("are the record's name, its KJV spelling when another, its summary and words, a place's modern site", async () => {
        h.nameRecords.set('n-1', {
            name: 'Nikodemos',
            kjvName: 'Nicodemus',
            title: 'A [Pharisee](name-id://p-1)',
            description: '  He came\n by night. ',
        });
        h.nameRecords.set('n-2', {
            name: 'Moses',
            kjvName: 'Moses',
            title: '',
            description: '',
        });
        h.placeRecords.set('l-1', {
            name: 'Aenon',
            kjvName: null,
            title: 'Where John baptized',
            description: '',
            modernIdentification: 'near [Salim](location-id://l-2)',
        });

        const appendix = await readPrintAppendix(
            genReferences({
                names: [request('name', 'n-1'), request('name', 'n-2')],
                places: [request('location', 'l-1')],
            }),
        );

        expect(h.acquire).toHaveBeenCalledWith('xx');
        expect(appendix.names).toEqual([
            {
                name: 'Nikodemos',
                kjvName: 'Nicodemus',
                summary: 'A Pharisee',
                description: 'He came by night.',
                modernIdentification: '',
            },
            {
                name: 'Moses',
                kjvName: null,
                summary: '',
                description: '',
                modernIdentification: '',
            },
        ]);
        expect(appendix.places).toEqual([
            {
                name: 'Aenon',
                kjvName: null,
                summary: 'Where John baptized',
                description: '',
                modernIdentification: 'near Salim',
            },
        ]);
        expect(appendix.leftOutCount).toBe(0);
        // The dataset is given back as soon as they are read.
        expect(h.release).toHaveBeenCalledTimes(1);
        expect(h.release).toHaveBeenCalledWith('xx');
    });

    test('give the dataset back even when it could not be read', async () => {
        h.acquire.mockRejectedValueOnce(new Error('no dataset'));

        await expect(
            readPrintAppendix(
                genReferences({ names: [request('name', 'n-1')] }),
            ),
        ).rejects.toThrow('no dataset');

        expect(h.release).toHaveBeenCalledTimes(1);
    });

    test('a page with none never takes the dataset', async () => {
        await readPrintAppendix(
            genReferences({ verses: [request('verse', 'JHN 3:16')] }),
        );

        expect(h.acquire).not.toHaveBeenCalled();
        expect(h.release).not.toHaveBeenCalled();
    });
});

describe('how much one print carries', () => {
    test('past the caps, and wherever nothing was found, references are counted as left out', async () => {
        const verseList = Array.from({ length: 63 }, (_value, index) => {
            return request('verse', `PSA ${index + 1}:1`);
        });
        const nameList = Array.from({ length: 85 }, (_value, index) => {
            const id = `n-${index}`;
            // Every tenth person is not in this language's dataset.
            if (index % 10 !== 0) {
                h.nameRecords.set(id, {
                    name: id,
                    kjvName: null,
                    title: '',
                    description: '',
                });
            }
            return request('name', id);
        });
        h.placeRecords.set('l-1', {
            name: 'Aenon',
            kjvName: null,
            title: '',
            description: '',
        });

        const appendix = await readPrintAppendix(
            genReferences({
                verses: verseList,
                names: nameList,
                places: [request('location', 'l-1')],
            }),
        );

        expect(appendix.verses).toHaveLength(60);
        // The first 80 records, places after people: 8 of them missing,
        // and the place past the cap.
        expect(appendix.names).toHaveLength(72);
        expect(appendix.places).toHaveLength(0);
        expect(appendix.leftOutCount).toBe(3 + 5 + 8 + 1);
    });
});
