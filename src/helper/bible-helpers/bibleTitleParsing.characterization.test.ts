/**
 * What every reference the lookup box ALREADY understands parses to, pinned
 * down before cross-chapter ranges (`John 1:2-3:4`) were taught to the same
 * parser. The real `extractBibleTitle`, `bookToKey` and locale-number chain
 * run here; only the I/O underneath them (bible files, settings, language
 * data, the item class) is faked, with Bibles shaped like real ones.
 *
 * The LEGACY block must never change: a row that moves is a regression in a
 * form volunteers type every week. New forms are pinned in their own block.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
const LATIN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const mocks = vi.hoisted(() => {
    class MockCacheManager<T> {
        private readonly store = new Map<string, T>();
        constructor(_seconds: number) {}
        async get(key: string) {
            return this.store.has(key) ? (this.store.get(key) as T) : null;
        }
        async has(key: string) {
            return this.store.has(key);
        }
        async set(key: string, value: T) {
            this.store.set(key, value);
        }
        async delete(key: string) {
            this.store.delete(key);
        }
    }
    return { MockCacheManager };
});

// Chapter counts of the canonical model, and each fixture chapter's verse
// count (anything not listed holds 30 verses).
const MODEL_CHAPTER_COUNT: Record<string, number> = {
    GEN: 50,
    EXO: 40,
    PSA: 150,
    MAT: 28,
    JHN: 21,
    '1CO': 16,
    '2TI': 4,
    '1KI': 22,
    '1PE': 5,
    '1JN': 5,
    '3JN': 1,
    JUD: 1,
};
const VERSE_COUNT: Record<string, number> = {
    'GEN 1': 31,
    'GEN 2': 25,
    'GEN 50': 26,
    'PSA 3': 8,
    'PSA 23': 6,
    'JHN 1': 51,
    'JHN 2': 25,
    'JHN 3': 36,
    'JHN 4': 54,
    'JHN 18': 40,
    'JHN 19': 42,
    'JHN 21': 25,
    'JUD 1': 25,
    '3JN 1': 15,
    '1JN 1': 10,
    '1JN 2': 29,
};
const MODEL_KEY_BOOK_MAP: Record<string, string> = {
    GEN: 'Genesis',
    EXO: 'Exodus',
    PSA: 'Psalm',
    MAT: 'Matthew',
    JHN: 'John',
    '1CO': '1 Corinthians',
    '2TI': '2 Timothy',
    '1KI': '1 Kings',
    '1PE': '1 Peter',
    '1JN': '1 John',
    '3JN': '3 John',
    JUD: 'Jude',
};
const ENGLISH_BOOKS = { ...MODEL_KEY_BOOK_MAP, PSA: 'Psalms' };
const BIBLE_INFO: Record<string, any> = {
    KJV: { key: 'KJV', locale: 'en-US', keyBookMap: ENGLISH_BOOKS },
    ESV: { key: 'ESV', locale: 'en-US', keyBookMap: ENGLISH_BOOKS },
    NKJV: { key: 'NKJV', locale: 'en-US', keyBookMap: ENGLISH_BOOKS },
    NIV: { key: 'NIV', locale: 'en-US', keyBookMap: ENGLISH_BOOKS },
    KHM: {
        key: 'KHM',
        locale: 'km-KH',
        numList: KHMER_DIGITS,
        keyBookMap: {
            GEN: 'លោកុប្បត្តិ',
            JHN: 'យ៉ូហាន',
            '1PE': '១ ពេត្រុស',
            PSA: 'ទំនុកដំកើង',
        },
    },
    // A Bible whose book names carry a dot ("1. Mose"): a dot-to-colon pass
    // must leave a dot followed by a space alone.
    GER: {
        key: 'GER',
        locale: 'en-US',
        keyBookMap: { GEN: '1. Mose', EXO: '2. Mose', JHN: 'Johannes' },
    },
};

function toStringNum(numList: string[], n: number) {
    return `${n}`
        .split('')
        .map((digit) => numList[Number.parseInt(digit)])
        .join('');
}
function fromStringNum(numList: string[], localeNum: string) {
    const nString = `${localeNum}`
        .split('')
        .map((char) => {
            const index = numList.indexOf(char);
            return index > -1 ? index : char;
        })
        .join('');
    if (Number.isNaN(Number.parseInt(nString))) {
        return null;
    }
    return Number.parseInt(nString);
}
const LANG_DATA: Record<string, any> = {
    'en-US': {
        locale: 'en-US',
        numList: LATIN_DIGITS,
        sanitizeText: (text: string) => text,
        transformBibleBookName: (bookName: string) => [bookName],
    },
    'km-KH': {
        locale: 'km-KH',
        numList: KHMER_DIGITS,
        sanitizeText: (text: string) => {
            return text.replaceAll('​', '').replaceAll('‌', '');
        },
        // A copy of the Khmer language's own: ពេត្រុសទី១ => ១ ពេត្រុស
        transformBibleBookName: (bookName: string) => {
            bookName = bookName.trim();
            const arr = bookName.split('ទី');
            if (
                arr.length > 1 &&
                KHMER_DIGITS.includes(arr[1].trim()) &&
                arr[0].trim().length > 0
            ) {
                return [bookName, `${arr[1].trim()} ${arr[0].trim()}`];
            }
            return [bookName];
        },
    },
};

vi.mock('./BibleDataReader', () => ({
    bibleDataReader: {
        readBibleData: async (bibleKey: string, fileName: string) => {
            if (fileName === '_info') {
                return BIBLE_INFO[bibleKey] ?? null;
            }
            const [bookKey, chapterText] = fileName.split('.');
            const chapter = Number(chapterText);
            const count = VERSE_COUNT[`${bookKey} ${chapter}`] ?? 30;
            const verses = Object.fromEntries(
                Array.from({ length: count }, (_, i) => {
                    return [`${i + 1}`, `${bookKey} ${chapter}:${i + 1}`];
                }),
            );
            return { title: '', verses };
        },
    },
}));
vi.mock('./bibleLogicHelpers1', () => ({
    getModelChapterCount: (bookKey: string) => {
        return MODEL_CHAPTER_COUNT[bookKey] ?? 0;
    },
    getModelKeyBookMap: () => MODEL_KEY_BOOK_MAP,
    toBibleFileName: (bookKey: string, chapter: number) => {
        return `${bookKey}.${chapter}`;
    },
}));
vi.mock('./bibleModelHelpers', () => ({
    getBibleModelInfo: () => ({ oneChapterBooks: ['JUD', '3JN'] }),
    modelNewLinerInfo: [],
}));
vi.mock('./bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: async () => {
        return Object.keys(BIBLE_INFO).map((key) => ({ key }));
    },
}));
vi.mock('../../setting/bible-setting/bibleXMLJsonDataHelpers', () => ({
    bibleKeyToXMLFilePath: async () => null,
}));
vi.mock('../../server/fileHelpers', () => ({
    fsCheckFileExist: async () => false,
}));
vi.mock('../helpers', () => ({
    freezeObject: (value: object) => value,
}));
vi.mock('../../others/CacheManager', () => ({
    default: mocks.MockCacheManager,
    globalCacheManager10Seconds: new mocks.MockCacheManager(10),
}));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => unknown) => callback(),
}));
vi.mock('../settingHelpers', () => ({
    getSetting: () => undefined,
    setSetting: () => {},
}));
vi.mock('../loggerHelpers', () => ({ appLog: () => {} }));
vi.mock('../appHooks', () => ({
    useAppEffect: () => {},
    useAppStateAsync: () => [undefined],
}));
vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    checkIsRtl: () => false,
    getFontFamilyByLocale: () => '',
    getLangDataAsync: async (locale: string) => LANG_DATA[locale] ?? null,
    toStringNum,
    fromStringNum,
    toLocaleNum: async (locale: string, n: number) => {
        const langData = LANG_DATA[locale];
        return langData ? toStringNum(langData.numList, n) : `${n}`;
    },
    fromLocaleNum: async (locale: string, localeNum: string) => {
        const langData = LANG_DATA[locale];
        return langData ? fromStringNum(langData.numList, localeNum) : null;
    },
}));
vi.mock('../../bible-list/BibleItem', () => ({
    default: class MockBibleItem {
        bibleKey: string;
        target: any;
        constructor(bibleKey: string, target: any) {
            this.bibleKey = bibleKey;
            this.target = target;
        }
        static fromData(
            bibleKey: string,
            bookKey: string,
            chapter: number,
            verseStart: number,
            verseEnd: number,
            chapterEnd?: number,
        ) {
            const target: any = { bookKey, chapter, verseStart, verseEnd };
            if (chapterEnd !== undefined && chapterEnd > chapter) {
                target.chapterEnd = chapterEnd;
            }
            return new MockBibleItem(bibleKey, target);
        }
        static async fromTitleText() {
            return null;
        }
        async toTitle() {
            const { bookKey, chapter, verseStart, verseEnd } = this.target;
            return `${bookKey} ${chapter}:${verseStart}-${verseEnd}`;
        }
    },
}));

async function loadModule() {
    return await import('./bibleLogicHelpers2');
}

type ModuleType = Awaited<ReturnType<typeof loadModule>>;

async function summarize(
    module: ModuleType,
    bibleKey: string,
    inputList: string[],
) {
    const summary: Record<string, unknown> = {};
    for (const inputText of inputList) {
        const { result, bibleKey: resolvedBibleKey } =
            await module.extractBibleTitle(bibleKey, inputText);
        const target = result.bibleItem?.target;
        summary[inputText] = [
            resolvedBibleKey,
            result.bookKey,
            result.chapter,
            result.guessingBook,
            result.guessingChapter,
            target === undefined
                ? null
                : `${target.bookKey} ${target.chapter}:${target.verseStart}` +
                  (target.chapterEnd === undefined
                      ? `-${target.verseEnd}`
                      : `-${target.chapterEnd}:${target.verseEnd}`),
        ].join(' | ');
    }
    return summary;
}

describe('bible title parsing (characterization)', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test('legacy book-name, book-key and version forms stay as they were', async () => {
        const module = await loadModule();
        const summary = await summarize(module, 'KJV', [
            '',
            'John',
            'john',
            'John 3',
            'John 3:',
            'John 3:16',
            'John 3:16-18',
            'John 3:16-',
            'John 3:16-99',
            'John 3:99',
            'John 3:0',
            'John 3:18-16',
            'John 99:1',
            'John 0:1',
            'John 3.16',
            '  John  3.16 ',
            'John 3.',
            'John 3 : 16',
            'John 1:2-3',
            'JHN 3:16-17',
            'JHN 3:16',
            'JHN 3',
            'JHN 3:',
            'JHN',
            '(ESV) John 3:16',
            'nkjv 2 Timothy 2:3-4',
            '3 John 1:4-5 (esv)',
            '1 Kings 4:5-6 niv',
            'Matt. 5.1',
            'Matthew 5.1',
            '1 Cor. 5.1',
            '1 Corinthians 5.1-3',
            'Psalm 23:1',
            'Psalms 23:1-6',
            'Psalmz 23:1',
            'Jude 1:',
            'Jude 1:3',
            'Jude 3',
            'Jude',
            '3 John 1:2',
            '1 John 1:5',
            '1John 1:5',
            'Unknown Book',
        ]);
        expect(summary).toMatchInlineSnapshot(`
          {
            "": "KJV |  |  |  |  | ",
            "  John  3.16 ": "KJV | JHN | 3 |  |  | JHN 3:16-16",
            "(ESV) John 3:16": "ESV | JHN | 3 |  |  | JHN 3:16-16",
            "1 Cor. 5.1": "KJV |  |  | 1 Cor. 5:1 |  | ",
            "1 Corinthians 5.1-3": "KJV | 1CO | 5 |  |  | 1CO 5:1-3",
            "1 John 1:5": "KJV | 1JN | 1 |  |  | 1JN 1:5-5",
            "1 Kings 4:5-6 niv": "KJV | 1KI | 4 |  |  | 1KI 4:5-6",
            "1John 1:5": "KJV |  |  | 1John 1:5 |  | ",
            "3 John 1:2": "KJV | 3JN | 1 |  |  | 3JN 1:2-2",
            "3 John 1:4-5 (esv)": "KJV | 3JN | 1 |  |  | 3JN 1:4-5",
            "JHN": "KJV | JHN |  |  |  | ",
            "JHN 3": "KJV | JHN |  |  | 3 | ",
            "JHN 3:": "KJV |  |  | JHN 3: |  | ",
            "JHN 3:16": "KJV | JHN | 3 |  |  | JHN 3:16-16",
            "JHN 3:16-17": "KJV | JHN | 3 |  |  | JHN 3:16-17",
            "John": "KJV | JHN |  |  |  | ",
            "John 0:1": "KJV | JHN |  |  | 0 | ",
            "John 1:2-3": "KJV | JHN | 1 |  |  | JHN 1:2-3",
            "John 3": "KJV | JHN |  |  | 3 | ",
            "John 3 : 16": "KJV | JHN | 3 |  |  | JHN 3:16-16",
            "John 3.": "KJV | JHN | 3 |  |  | JHN 3:1-36",
            "John 3.16": "KJV | JHN | 3 |  |  | JHN 3:16-16",
            "John 3:": "KJV | JHN | 3 |  |  | JHN 3:1-36",
            "John 3:0": "KJV | JHN | 3 |  |  | JHN 3:1-36",
            "John 3:16": "KJV | JHN | 3 |  |  | JHN 3:16-16",
            "John 3:16-": "KJV | JHN | 3 |  |  | JHN 3:16-36",
            "John 3:16-18": "KJV | JHN | 3 |  |  | JHN 3:16-18",
            "John 3:16-99": "KJV | JHN | 3 |  |  | JHN 3:16-36",
            "John 3:18-16": "KJV | JHN | 3 |  |  | JHN 3:1-36",
            "John 3:99": "KJV | JHN | 3 |  |  | JHN 3:1-36",
            "John 99:1": "KJV | JHN |  |  | 99 | ",
            "Jude": "KJV | JUD |  |  |  | ",
            "Jude 1:": "KJV | JUD | 1 |  |  | JUD 1:1-25",
            "Jude 1:3": "KJV | JUD | 1 |  |  | JUD 1:3-3",
            "Jude 3": "KJV | JUD |  |  | 3 | ",
            "Matt. 5.1": "KJV |  |  | Matt. 5:1 |  | ",
            "Matthew 5.1": "KJV | MAT | 5 |  |  | MAT 5:1-1",
            "Psalm 23:1": "KJV | PSA | 23 |  |  | PSA 23:1-1",
            "Psalms 23:1-6": "KJV | PSA | 23 |  |  | PSA 23:1-6",
            "Psalmz 23:1": "KJV |  |  | Psalmz 23:1 |  | ",
            "Unknown Book": "KJV |  |  | Unknown Book |  | ",
            "john": "KJV | JHN |  |  |  | ",
            "nkjv 2 Timothy 2:3-4": "NKJV | 2TI | 2 |  |  | 2TI 2:3-4",
          }
        `);
    });

    test('legacy Khmer forms stay as they were', async () => {
        const module = await loadModule();
        const summary = await summarize(module, 'KHM', [
            'យ៉ូហាន ៣:១៦',
            'យ៉ូហាន ៣:១៦-១៨',
            'យ៉ូហាន ៣:១៦-',
            'យ៉ូហាន ៣:',
            'យ៉ូហាន ៣',
            'យ៉ូហាន ៣.១៦',
            'យ៉ូហាន​ ៣:១៦',
            'យ៉ូហាន 3:16',
            'ពេត្រុសទី១ ១:៣',
            '១ ពេត្រុស ១:៣',
            'John 3:16',
        ]);
        expect(summary).toMatchInlineSnapshot(`
          {
            "John 3:16": "KHM | JHN | 3 |  |  | JHN 3:16-16",
            "ពេត្រុសទី១ ១:៣": "KHM | 1PE | 1 |  |  | 1PE 1:3-3",
            "យ៉ូហាន 3:16": "KHM | JHN | 3 |  |  | JHN 3:16-16",
            "យ៉ូហាន ៣": "KHM | JHN |  |  | ៣ | ",
            "យ៉ូហាន ៣.១៦": "KHM | JHN | 3 |  |  | JHN 3:16-16",
            "យ៉ូហាន ៣:": "KHM | JHN | 3 |  |  | JHN 3:1-36",
            "យ៉ូហាន ៣:១៦": "KHM | JHN | 3 |  |  | JHN 3:16-16",
            "យ៉ូហាន ៣:១៦-": "KHM | JHN | 3 |  |  | JHN 3:16-36",
            "យ៉ូហាន ៣:១៦-១៨": "KHM | JHN | 3 |  |  | JHN 3:16-18",
            "យ៉ូហាន​ ៣:១៦": "KHM | JHN | 3 |  |  | JHN 3:16-16",
            "១ ពេត្រុស ១:៣": "KHM | 1PE | 1 |  |  | 1PE 1:3-3",
          }
        `);
    });

    test('legacy dotted book names stay as they were', async () => {
        const module = await loadModule();
        const summary = await summarize(module, 'GER', [
            '1. Mose 1.1',
            '1. Mose 1:1-3',
            '1. Mose 1',
            '1. Mose 1:',
            'Johannes 3.16',
        ]);
        expect(summary).toMatchInlineSnapshot(`
          {
            "1. Mose 1": "GER | GEN |  |  | 1 | ",
            "1. Mose 1.1": "GER | GEN | 1 |  |  | GEN 1:1-1",
            "1. Mose 1:": "GER | GEN | 1 |  |  | GEN 1:1-31",
            "1. Mose 1:1-3": "GER | GEN | 1 |  |  | GEN 1:1-3",
            "Johannes 3.16": "GER | JHN | 3 |  |  | JHN 3:16-16",
          }
        `);
    });

    test('legacy trailing references stay as they were', async () => {
        const module = await loadModule();
        const summary = Object.fromEntries(
            [
                'Psalms 23:1',
                'Psalms 23:1-6',
                'Psalms 23:',
                'Psalms 23',
                'ទំនុក ២៣:១',
                '1 Jo',
                'Psalms',
                '23:1',
                'Psalms 23:1-',
            ].map((text) => [text, module.toTrailingReference(text)]),
        );
        expect(summary).toMatchInlineSnapshot(`
          {
            "1 Jo": null,
            "23:1": null,
            "Psalms": null,
            "Psalms 23": "23",
            "Psalms 23:": "23:",
            "Psalms 23:1": "23:1",
            "Psalms 23:1-": "23:1-",
            "Psalms 23:1-6": "23:1-6",
            "ទំនុក ២៣:១": "២៣:១",
          }
        `);
    });

    test('legacy input text formatting stays as it was', async () => {
        const module = await loadModule();
        const summary = {
            empty: await module.toInputText('KJV'),
            book: await module.toInputText('KJV', 'John'),
            oneChapterBook: await module.toInputText('KJV', 'Jude'),
            chapter: await module.toInputText('KJV', 'John', 3),
            verse: await module.toInputText('KJV', 'John', 3, 16),
            khmerChapter: await module.toInputText('KHM', 'យ៉ូហាន', 3, 16),
        };
        expect(summary).toMatchInlineSnapshot(`
          {
            "book": "John ",
            "chapter": "John 3",
            "empty": "",
            "khmerChapter": "យ៉ូហាន ៣:១៦",
            "oneChapterBook": "Jude 1:",
            "verse": "John 3:16",
          }
        `);
    });
});

// The forms a passage crossing chapters is typed in, each read as ONE item
// whose target carries `chapterEnd` (John 1=51, 2=25, 3=36, 21=25 verses).
describe('bible title parsing: ranges across chapters', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    const JOHN_1_2_TO_3_4 = 'KJV | JHN | 1 |  |  | JHN 1:2-3:4';

    test.each([
        ['John 1:2-3:4', JOHN_1_2_TO_3_4],
        ['John 1:-2:', 'KJV | JHN | 1 |  |  | JHN 1:1-2:25'],
        ['John 1:4-3:-3', 'KJV | JHN | 1 |  |  | JHN 1:4-3:3'],
        ['John 1:-3', 'KJV | JHN | 1 |  |  | JHN 1:1-3'],
        ['John 1:2-3:', 'KJV | JHN | 1 |  |  | JHN 1:2-3:36'],
        ['John 1-3', 'KJV | JHN | 1 |  |  | JHN 1:1-3:36'],
        ['John 1 to 3', 'KJV | JHN | 1 |  |  | JHN 1:1-3:36'],
        ['John 1-3:5', 'KJV | JHN | 1 |  |  | JHN 1:1-3:5'],
        ['John 1-', 'KJV | JHN | 1 |  |  | JHN 1:1-51'],
        ['John 1:-', 'KJV | JHN | 1 |  |  | JHN 1:1-51'],
        ['John 1:2--3:4', JOHN_1_2_TO_3_4],
        ['John 1:2–3:4', JOHN_1_2_TO_3_4],
        ['John 1:2—3:4', JOHN_1_2_TO_3_4],
        ['John 1:2‐3:4', JOHN_1_2_TO_3_4],
        ['John 1:2‑3:4', JOHN_1_2_TO_3_4],
        ['John 1:2−3:4', JOHN_1_2_TO_3_4],
        ['John 1 : 2 - 3 : 4', JOHN_1_2_TO_3_4],
        ['John 1.2-3.4', JOHN_1_2_TO_3_4],
        ['John 1:2 through 3:4', JOHN_1_2_TO_3_4],
        ['John 1:2 thru 3:4', JOHN_1_2_TO_3_4],
        ['John 1:2 to 3:4', JOHN_1_2_TO_3_4],
        ['JHN 1:2-3:4', JOHN_1_2_TO_3_4],
        ['John 3,16-4,2', 'KJV | JHN | 3 |  |  | JHN 3:16-4:2'],
        ['John 3,16', 'KJV | JHN | 3 |  |  | JHN 3:16-16'],
        ['John 3:16–18', 'KJV | JHN | 3 |  |  | JHN 3:16-18'],
        ['John 1:2 - 3', 'KJV | JHN | 1 |  |  | JHN 1:2-3'],
        ['1 John 1:5-2:2', 'KJV | 1JN | 1 |  |  | 1JN 1:5-2:2'],
        ['John 1:2-1:5', 'KJV | JHN | 1 |  |  | JHN 1:2-5'],
        ['John 3:4-1:2', 'KJV | JHN | 3 |  |  | JHN 3:4-36'],
        ['John 20:1-25:3', 'KJV | JHN | 20 |  |  | JHN 20:1-21:25'],
        ['John 1:99-3:4', 'KJV | JHN | 1 |  |  | JHN 1:1-3:4'],
        ['John 1:2-3:99', 'KJV | JHN | 1 |  |  | JHN 1:2-3:36'],
        ['Genesis 50:1-51:2', 'KJV | GEN | 50 |  |  | GEN 50:1-26'],
        ['John 0-2', 'KJV | JHN |  |  | 0 | '],
        ['Jude 1-3', 'KJV | JUD | 1 |  |  | JUD 1:1-3'],
        ['Jude 3-', 'KJV | JUD | 1 |  |  | JUD 1:3-25'],
        ['(ESV) John 1:2-3:4', 'ESV | JHN | 1 |  |  | JHN 1:2-3:4'],
        ['John 1:2-3:4 (esv)', 'ESV | JHN | 1 |  |  | JHN 1:2-3:4'],
        ['John 1:2-3:4 niv', 'NIV | JHN | 1 |  |  | JHN 1:2-3:4'],
        ['nkjv John 1:2-3:4', 'NKJV | JHN | 1 |  |  | JHN 1:2-3:4'],
    ])('reads %s', async (inputText, expected) => {
        const module = await loadModule();
        const summary = await summarize(module, 'KJV', [inputText]);
        expect(summary[inputText]).toBe(expected);
    });

    test('reads ranges in a Bible numbering in its own digits', async () => {
        const module = await loadModule();
        expect(
            await summarize(module, 'KHM', [
                'យ៉ូហាន ១៨.៣៣-១៩.១៦',
                'យ៉ូហាន ១:២-៣:៤',
                'យ៉ូហាន ១-៣',
            ]),
        ).toEqual({
            'យ៉ូហាន ១៨.៣៣-១៩.១៦': 'KHM | JHN | 18 |  |  | JHN 18:33-19:16',
            'យ៉ូហាន ១:២-៣:៤': 'KHM | JHN | 1 |  |  | JHN 1:2-3:4',
            'យ៉ូហាន ១-៣': 'KHM | JHN | 1 |  |  | JHN 1:1-3:36',
        });
    });

    test('leaves a book name with a dot of its own alone', async () => {
        const module = await loadModule();
        expect(await summarize(module, 'GER', ['1. Mose 1.1-2.3'])).toEqual({
            '1. Mose 1.1-2.3': 'GER | GEN | 1 |  |  | GEN 1:1-2:3',
        });
    });

    test('writes a range back as input text, across chapters too', async () => {
        const module = await loadModule();
        expect(await module.toInputText('KJV', 'John', 3, 16, 18)).toBe(
            'John 3:16-18',
        );
        expect(await module.toInputText('KJV', 'John', 3, 16, 16)).toBe(
            'John 3:16',
        );
        expect(await module.toInputText('KJV', 'John', 1, 2, 4, 3)).toBe(
            'John 1:2-3:4',
        );
        expect(await module.toInputText('KHM', 'យ៉ូហាន', 1, 2, 4, 3)).toBe(
            'យ៉ូហាន ១:២-៣:៤',
        );
    });

    test('keeps a range across chapters an unresolved book was typed with', async () => {
        const module = await loadModule();
        expect(module.toTrailingReference('Psalmz 23:1-24:3')).toBe(
            '23:1-24:3',
        );
        expect(module.toTrailingReference('Psalmz 23-24')).toBe('23-24');
    });
});
