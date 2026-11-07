// @vitest-environment jsdom
/**
 * `owa_find_verse` against a real search table. The table is Bible Find's
 * own shape (`initSearchingDatabase`: `verses(text, sText)`, `text` as
 * `GEN.8:11=>…`, `sText` the sanitized words run together, and the `spell`
 * vocabulary), held in an in-memory `node:sqlite` database -- the engine the
 * app itself opens it with -- so the SQL `bibleVerseFindHelpers.ts` writes is
 * the SQL that runs, and the ranking, the word-by-word re-read, the named
 * books, the passages and the paging are what a person would get. The Bible
 * text, the language packs and the lookup are small fakes held here.
 */
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';
// Read at run time, not imported: before Node 23.5 `node:sqlite` is not in
// `builtinModules`, so vite's jsdom environment could not place a static
// import of it and the whole file failed to load (Node 22.20, 2026-11-04).
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
type DatabaseSync = InstanceType<typeof DatabaseSync>;

const { state, mocks, EN_BOOKS } = vi.hoisted(() => ({
    EN_BOOKS: {
        GEN: 'Genesis',
        EXO: 'Exodus',
        LEV: 'Leviticus',
        JDG: 'Judges',
        '1SA': '1 Samuel',
        PSA: 'Psalms',
        DAN: 'Daniel',
        MAT: 'Matthew',
        JHN: 'John',
    } as Record<string, string>,
    state: {
        bibles: [] as { key: string; title: string }[] | null,
        locales: {} as Record<string, string>,
        infos: {} as Record<string, any>,
        failingInfos: new Set<string>(),
        controllers: {} as Record<string, any>,
        // `KJV` -> `GEN 8:11` -> the verse's words.
        verseTexts: {} as Record<string, Record<string, string>>,
        // `KJV:GEN 3` -> verses in that chapter (30 when not given).
        verseCounts: {} as Record<string, number>,
        failingCounts: new Set<string>(),
        brokenKeys: new Set<string>(),
        failingTitles: new Set<string>(),
        liveLookup: null as any,
        isLookupBroken: false,
        newLookupBibleKey: 'KJV',
        popupOpener: null as null | (() => void),
    },
    mocks: {
        getInstant: vi.fn(),
        fromVerseKey: vi.fn(),
        fromTitleText: vi.fn(),
        getCurrentLookup: vi.fn(),
        getPopupOpener: vi.fn(),
        applyNew: vi.fn(),
        applyLive: vi.fn(),
        openPopup: vi.fn(),
        getBibleInfo: vi.fn(),
        getAllBibles: vi.fn(),
        getVersesCount: vi.fn(),
        getBibleLocale: vi.fn(),
        sanitize: vi.fn(),
        doFinding: vi.fn(),
    },
}));

const KH_BOOKS: Record<string, string> = {
    GEN: 'លោកុប្បត្តិ',
    EXO: 'និក្ខមនំ',
    LEV: 'លេវីវិន័យ',
    PSA: 'ទំនុកដំកើង',
    MAT: 'ម៉ាថាយ',
    JHN: 'យ៉ូហាន',
};
const KH_DIGITS: Record<string, string> = Object.fromEntries(
    '០១២៣៤៥៦៧៨៩'.split('').map((digit, index) => [String(index), digit]),
);

vi.mock('../../../../../../bible-find/BibleFindController', () => ({
    default: { getInstant: mocks.getInstant },
}));
vi.mock('../../../../../../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: mocks.fromVerseKey,
        fromTitleText: mocks.fromTitleText,
    },
}));
vi.mock('../../../../../../bible-reader/LookupBibleItemController', () => ({
    default: class {
        get selectedBibleItem() {
            return { bibleKey: state.newLookupBibleKey, id: 'new' };
        }
        applyTargetOrBibleKey(...args: unknown[]) {
            return mocks.applyNew(...args);
        }
    },
    getCurrentLookupBibleItemController: mocks.getCurrentLookup,
}));
vi.mock('../../../../../../others/bibleLookupPopupOpener', () => ({
    getBibleLookupPopupOpener: mocks.getPopupOpener,
}));
vi.mock('../../../../../langHelpers', () => ({
    // The packs' own lists, as far as these words reach.
    checkIsStopWord: (locale: string, word: string) => {
        return (
            locale.startsWith('km')
                ? ['និង', 'ដែល', 'ជា', 'ក្នុង', 'ទៅ']
                : ['a', 'and', 'in', 'of', 'the', 'to', 'which', 'from']
        ).includes(word);
    },
    getBookMarkerWords: (locale: string) => {
        return locale.startsWith('km')
            ? ['ក្នុង', 'គម្ពីរ']
            : ['in', 'inside', 'from', 'book'];
    },
    getFindFrameWords: (locale: string) => {
        return locale.startsWith('km')
            ? ['ស្វែងរក', 'រឿង']
            : ['find', 'search', 'verse', 'about', 'story'];
    },
    sanitizeFindingText: mocks.sanitize,
}));
vi.mock('../../../../../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: mocks.getAllBibles,
}));
vi.mock('../../../../../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: mocks.getBibleInfo,
}));
vi.mock('../../../../../../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: mocks.getVersesCount,
}));
vi.mock('../../../../../../helper/bible-helpers/bibleModelHelpers', () => ({
    kjvBibleModelInfo: { keyBookMap: EN_BOOKS },
}));
vi.mock('../../../../../../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: mocks.getBibleLocale,
}));
vi.mock('../../../../../../helper/helpers', () => ({
    cloneJson: (value: unknown) => structuredClone(value),
}));

import { handleAgentBibleFindRequest } from '../../../../../../helper/agentBibleFindHelpers';

// The language packs' `sanitizeFindingText`: English keeps a-z and digits,
// Khmer its own letters, each cutting everything else to a space.
function sanitizeAs(locale: string, text: string) {
    const kept = locale.startsWith('km')
        ? text.replaceAll(/[^ក-៿]/gu, ' ')
        : text.toLowerCase().replaceAll(/[^a-z0-9 ]/g, ' ');
    return kept.replaceAll(/\s+/g, ' ').trim();
}

const KJV_VERSES: Record<string, string> = {
    'GEN 6:8': 'But Noah found grace in the eyes of the LORD.',
    'GEN 7:1':
        'And the LORD said unto Noah, Come thou and all thy house into the ark;',
    'GEN 7:7':
        'And Noah went in, and his sons, into the ark, because of the waters of the flood.',
    'GEN 8:8':
        'Also he sent forth a dove from him, to see if the waters were abated;',
    'GEN 8:9':
        'But the dove found no rest for the sole of her foot, and she returned unto him into the ark,',
    'GEN 8:11':
        'And the dove came in to him in the evening; and, lo, in her mouth was an olive leaf pluckt off: so Noah knew that the waters were abated.',
    'GEN 8:12':
        'And he stayed yet other seven days; and sent forth the dove; which returned not again unto him any more.',
    'EXO 15:9':
        'The enemy said, I will pursue, I will overtake, I will divide the spoil;',
    'JDG 13:2':
        'And there was a certain man of Zorah, of the family of the Danites, whose name was Manoah;',
    '1SA 7:15': 'And Samuel judged Israel all the days of his life.',
    'PSA 23:1': 'The LORD is my shepherd; I shall not want.',
    'PSA 23:2': 'He maketh me to lie down in green pastures.',
    'DAN 6:16':
        'Then the king commanded, and they brought Daniel, and cast him into the den of lions.',
    'MAT 5:44':
        'But I say unto you, Love your enemies, bless them that curse you, and pray for them which despitefully use you, and persecute you;',
    'JHN 3:16':
        'For God so loved the world, that he gave his only begotten Son.',
    'JHN 3:17': 'For God sent not his Son into the world to condemn the world.',
    'JHN 10:11':
        'I am the good shepherd: the good shepherd giveth his life for the sheep.',
    'JHN 10:14':
        'I am the good shepherd, and know my sheep, and am known of mine.',
};
const KH_VERSES: Record<string, string> = {
    'GEN 7:1': 'ព្រះអម្ចាស់មានព្រះបន្ទូលមកកាន់ណូអេ',
    'GEN 8:8': 'គាត់ក៏លែងព្រាបមួយ',
    'GEN 8:9': 'ព្រាបរកកន្លែងទំជើងមិនបាន',
    'GEN 8:11': 'ព្រាបនាំស្លឹកអូលីវមក ណូអេក៏ដឹង',
    'GEN 8:12': 'គាត់លែងព្រាបម្ដងទៀត',
    'MAT 26:34': 'ព្រះយេស៊ូមានព្រះបន្ទូលនឹងពេត្រុស',
    'JHN 21:17': 'ព្រះយេស៊ូសួរពេត្រុសជាលើកទីបី',
    'JHN 10:11': 'ខ្ញុំជាគង្វាលល្អ',
    // A book this Bible's own name list leaves out.
    'DAN 6:16': 'គេបោះដានីយ៉ែលទៅក្នុងរូងសិង្ហ',
    'DAN 6:22': 'ព្រះបានបិទមាត់សិង្ហ',
};
const KH_VOCABULARY = [
    'ព្រះយេស៊ូ',
    'សួរ',
    'ពេត្រុស',
    'ព្រាប',
    'ណូអេ',
    'ព្រះបន្ទូល',
];

/** Bible Find's table, built the way `initSearchingDatabase` builds it. */
function genSearchDatabase(
    locale: string,
    verses: Record<string, string>,
    filler: string,
    vocabulary: string[] = [],
) {
    const database = new DatabaseSync(':memory:');
    database.exec(
        'CREATE TABLE verses(text TEXT, sText TEXT);' +
            'CREATE TABLE spell(text TEXT, bookKeys TEXT);',
    );
    const insert = database.prepare(
        'INSERT INTO verses(text, sText) VALUES (?, ?)',
    );
    const insertRow = (key: string, text: string) => {
        const tableKey = key.replace(' ', '.');
        insert.run(
            `${tableKey}=>${text}`,
            sanitizeAs(locale, text).split(' ').join(''),
        );
    };
    // A thousand verses of something else first, so a word in a handful of
    // verses is as rare as it is in a whole Bible.
    for (let chapter = 1; chapter <= 10; chapter++) {
        for (let verse = 1; verse <= 100; verse++) {
            insertRow(`LEV ${chapter}:${verse}`, filler);
        }
    }
    for (const [key, text] of Object.entries(verses)) {
        insertRow(key, text);
    }
    const spellInsert = database.prepare(
        'INSERT INTO spell(text, bookKeys) VALUES (?, ?)',
    );
    for (const word of vocabulary) {
        spellInsert.run(word, '');
    }
    return database;
}

let kjvDatabase: DatabaseSync;
let khDatabase: DatabaseSync;

function genController(database: DatabaseSync) {
    return {
        databaseFindHandler: {
            database: {
                getAll: vi.fn((sql: string) => database.prepare(sql).all()),
            },
        },
        onlineFindHandler: null,
    };
}

function toKhmerDigits(value: number | string) {
    return String(value).replaceAll(/\d/g, (digit) => KH_DIGITS[digit]);
}

function genBibleItem(bibleKey: string, target: any) {
    return {
        target,
        toText: async () => {
            const parts: string[] = [];
            for (
                let verse = target.verseStart;
                verse <= target.verseEnd;
                verse++
            ) {
                const text =
                    state.verseTexts[bibleKey]?.[
                        `${target.bookKey} ${target.chapter}:${verse}`
                    ];
                parts.push(text === undefined ? '??' : `(${verse}): ${text}`);
            }
            // The renderer's placeholder for a verse it has not got.
            return parts.every((one) => one === '??') ? '??' : parts.join(' ');
        },
        toTitle: async () => {
            const key = `${target.bookKey} ${target.chapter}:${target.verseStart}`;
            if (state.failingTitles.has(key)) {
                throw new Error('no title');
            }
            const book =
                bibleKey === 'KH'
                    ? KH_BOOKS[target.bookKey]
                    : EN_BOOKS[target.bookKey];
            const end =
                target.verseEnd > target.verseStart
                    ? `-${target.verseEnd}`
                    : '';
            const title = `${book} ${target.chapter}:${target.verseStart}${end}`;
            return bibleKey === 'KH' ? toKhmerDigits(title) : title;
        },
    };
}

function toCount(bibleKey: string, bookKey: string, chapter: number) {
    return state.verseCounts[`${bibleKey}:${bookKey} ${chapter}`] ?? 30;
}

beforeAll(() => {
    kjvDatabase = genSearchDatabase(
        'en',
        KJV_VERSES,
        'These are the statutes and judgments.',
    );
    khDatabase = genSearchDatabase(
        'km',
        KH_VERSES,
        'នេះជាច្បាប់',
        KH_VOCABULARY,
    );
});

afterAll(() => {
    kjvDatabase.close();
    khDatabase.close();
});

beforeEach(() => {
    state.bibles = [
        { key: 'KJV', title: 'King James Version' },
        { key: 'KH', title: 'Khmer Bible' },
    ];
    state.locales = { KJV: 'en', KH: 'km', WEB: 'en-US' };
    state.infos = {
        KJV: { keyBookMap: EN_BOOKS },
        WEB: { keyBookMap: EN_BOOKS },
        KH: { keyBookMap: KH_BOOKS, numbersMap: KH_DIGITS },
    };
    state.failingInfos = new Set();
    state.controllers = {
        KJV: genController(kjvDatabase),
        KH: genController(khDatabase),
    };
    state.verseTexts = { KJV: KJV_VERSES, KH: KH_VERSES, WEB: KJV_VERSES };
    state.verseCounts = {
        'KJV:GEN 3': 24,
        'KJV:GEN 7': 24,
        'KJV:PSA 23': 2,
    };
    state.failingCounts = new Set();
    state.brokenKeys = new Set();
    state.failingTitles = new Set();
    state.liveLookup = null;
    state.isLookupBroken = false;
    state.newLookupBibleKey = 'KJV';
    state.popupOpener = null;

    mocks.getInstant.mockImplementation(async (bibleKey: string) => {
        return state.controllers[bibleKey] ?? null;
    });
    mocks.getAllBibles.mockImplementation(async () => state.bibles);
    mocks.getBibleInfo.mockImplementation(async (bibleKey: string) => {
        if (state.failingInfos.has(bibleKey)) {
            throw new Error('Bible info unreadable');
        }
        return state.infos[bibleKey] ?? null;
    });
    mocks.getBibleLocale.mockImplementation(async (bibleKey: string) => {
        return state.locales[bibleKey] ?? 'en';
    });
    mocks.getVersesCount.mockImplementation(
        async (bibleKey: string, bookKey: string, chapter: number) => {
            if (state.failingCounts.has(`${bibleKey}:${bookKey} ${chapter}`)) {
                throw new Error('chapter unreadable');
            }
            return toCount(bibleKey, bookKey, chapter);
        },
    );
    mocks.sanitize.mockImplementation(async (locale: string, text: string) =>
        sanitizeAs(locale, text),
    );
    mocks.fromVerseKey.mockImplementation(
        async (bibleKey: string, key: string) => {
            if (state.brokenKeys.has(key)) {
                throw new Error('the parser broke');
            }
            const match = /^([0-9A-Z]{3}) (\d+):(\d+)(-(\d*))?$/.exec(key);
            if (match === null) {
                return null;
            }
            const chapter = Number(match[2]);
            const verseStart = Number(match[3]);
            // `PSA 23:1-` is the whole chapter.
            const verseEnd =
                match[4] === undefined
                    ? verseStart
                    : match[5] === ''
                      ? toCount(bibleKey, match[1], chapter)
                      : Number(match[5]);
            return genBibleItem(bibleKey, {
                bookKey: match[1],
                chapter,
                verseStart,
                verseEnd,
            });
        },
    );
    mocks.fromTitleText.mockImplementation(
        async (bibleKey: string, text: string) => {
            // The app's parser reads a short form the finder does not.
            const match = /^Jn (\d+):(\d+)$/.exec(text);
            return match === null
                ? null
                : genBibleItem(bibleKey, {
                      bookKey: 'JHN',
                      chapter: Number(match[1]),
                      verseStart: Number(match[2]),
                      verseEnd: Number(match[2]),
                  });
        },
    );
    mocks.getCurrentLookup.mockImplementation(() => {
        if (state.isLookupBroken) {
            throw new Error('no lookup in this window');
        }
        return state.liveLookup;
    });
    mocks.getPopupOpener.mockImplementation(() => state.popupOpener);
});

describe('a Bible written with no spaces', () => {
    test('a found word is matched as letters, the passage titled in the Bible’s own words, and the English Bible named', async () => {
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            words: 'ព្រាប',
            limit: 2,
        });
        expect(result).toEqual({
            bible: 'KH',
            words: ['ព្រាប'],
            of: 1,
            total: 4,
            verses: [
                {
                    key: 'GEN 8:8',
                    ref: 'Genesis 8:8',
                    text: KH_VERSES['GEN 8:8'],
                    hits: 1,
                    title: 'លោកុប្បត្តិ ៨:៨',
                },
                {
                    key: 'GEN 8:9',
                    ref: 'Genesis 8:9',
                    text: KH_VERSES['GEN 8:9'],
                    hits: 1,
                    title: 'លោកុប្បត្តិ ៨:៩',
                },
            ],
            next: 2,
            passages: [
                {
                    ref: 'Genesis 8',
                    key: 'GEN 8',
                    verses: 4,
                    title: 'លោកុប្បត្តិ ៨',
                    keyTitle: 'លោកុប្បត្តិ ៨',
                },
            ],
            byBook: [
                {
                    book: 'Genesis',
                    key: 'GEN',
                    verses: 4,
                    title: 'លោកុប្បត្តិ',
                },
            ],
            note:
                'This script has no spaces, so a word was matched as ' +
                'letters and may be part of a longer word: check each verse ' +
                'says what they remember.',
            englishBible: 'KJV',
        });
    });

    test('a long run of letters is cut into the Bible’s own words', async () => {
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            words: 'ព្រះយេស៊ូសួរពេត្រុស',
        });
        expect(result.words).toEqual(['ព្រះយេស៊ូ', 'សួរ', 'ពេត្រុស']);
        expect(result.verses.map((one: any) => [one.key, one.hits])).toEqual([
            ['JHN 21:17', 3],
            ['MAT 26:34', 2],
        ]);
    });

    test('a book named inside the run, even a letter off, is the book searched', async () => {
        const exact: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            words: 'ក្នុងលោកុប្បត្តិព្រាប',
        });
        expect(exact).toMatchObject({
            words: ['ព្រាប'],
            books: ['Genesis'],
            readAsBook: ['លោកុប្បត្តិ'],
            total: 4,
        });
        // The user's own words, with a vowel sign left out (2026-10-22).
        const misspelt: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            words: 'ក្នុងលោកប្បត្តិព្រាប',
        });
        expect(misspelt).toMatchObject({
            books: ['Genesis'],
            readAsBook: ['លោកប្បត្តិ'],
            total: 4,
        });
    });

    test('a verse that cannot be titled keeps its English reference only', async () => {
        state.failingTitles.add('GEN 8:8');
        state.brokenKeys.add('GEN 8:9');
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            words: 'ព្រាប',
            limit: 3,
        });
        expect(result.verses.map((one: any) => one.title)).toEqual([
            undefined,
            undefined,
            'លោកុប្បត្តិ ៨:១១',
        ]);
    });

    test('a passage in a book the Bible has no name for keeps its English name', async () => {
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            words: 'សិង្ហ',
            limit: 1,
        });
        expect(result).toMatchObject({
            total: 2,
            passages: [{ ref: 'Daniel 6', key: 'DAN 6', verses: 2 }],
            byBook: [{ book: 'Daniel', key: 'DAN', verses: 2 }],
        });
        expect(result.passages[0]).not.toHaveProperty('title');
        expect(result.byBook[0]).not.toHaveProperty('title');
    });

    test('no English Bible installed: none is named', async () => {
        state.bibles = [{ key: 'KH', title: 'Khmer Bible' }];
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            words: 'ព្រាប',
        });
        expect(result.total).toBe(4);
        expect(result).not.toHaveProperty('englishBible');
    });

    test('another English Bible is named when the KJV is not installed', async () => {
        state.bibles = [
            { key: 'KH', title: 'Khmer Bible' },
            { key: 'WEB', title: 'World English Bible' },
        ];
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            words: 'ព្រាប',
        });
        expect(result.englishBible).toBe('WEB');
    });
});

describe('words in another language than the Bible’s', () => {
    test('Khmer words under the KJV are searched in the Khmer Bible and quoted from the KJV', async () => {
        state.bibles = [
            { key: 'KJV', title: 'King James Version' },
            { key: 'WEB', title: 'World English Bible' },
            { key: 'KH', title: 'Khmer Bible' },
        ];
        // The KJV has no Genesis 8:12 to quote: that one keeps the Khmer.
        state.verseTexts.KJV = { ...KJV_VERSES };
        delete state.verseTexts.KJV['GEN 8:12'];
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'ព្រាប',
        });
        expect(result).toMatchObject({
            bible: 'KJV',
            searchedIn: 'KH',
            total: 4,
            verses: [
                { key: 'GEN 8:8', text: KJV_VERSES['GEN 8:8'] },
                { key: 'GEN 8:9', text: KJV_VERSES['GEN 8:9'] },
                { key: 'GEN 8:11', text: KJV_VERSES['GEN 8:11'] },
                { key: 'GEN 8:12', text: KH_VERSES['GEN 8:12'], in: 'KH' },
            ],
            note:
                'These words are not in KJV’s language, so they were ' +
                'searched in KH and each verse is quoted from KJV. Put them ' +
                'into KJV’s language and search again for more.',
        });
        // The English Bible could not read them and was passed over.
        expect(mocks.getInstant).not.toHaveBeenCalledWith('WEB');
    });

    test('English words under the Khmer Bible go to the KJV first, then any English one', async () => {
        state.bibles = [
            { key: 'KH', title: 'Khmer Bible' },
            { key: 'WEB', title: 'World English Bible' },
            { key: 'KJV', title: 'King James Version' },
        ];
        // The KJV's table cannot be opened: the next English Bible is.
        state.controllers.KJV = null;
        state.controllers.WEB = genController(kjvDatabase);
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            words: 'shepherd',
        });
        expect(mocks.getInstant.mock.calls.map(([key]) => key)).toEqual([
            'KH',
            'KJV',
            'WEB',
        ]);
        expect(result).toMatchObject({
            bible: 'KH',
            searchedIn: 'WEB',
            verses: [
                {
                    key: 'JHN 10:11',
                    text: KH_VERSES['JHN 10:11'],
                    title: 'យ៉ូហាន ១០:១១',
                },
                { key: 'JHN 10:14', in: 'WEB' },
                { key: 'PSA 23:1', in: 'WEB' },
            ],
            passages: [
                {
                    ref: 'John 10',
                    title: 'យ៉ូហាន ១០',
                    keyTitle: 'យ៉ូហាន ១០',
                },
            ],
        });
    });

    test('no installed Bible reads the words: refused, with the Bible’s language named', async () => {
        state.bibles = [{ key: 'KJV', title: 'King James Version' }];
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', words: 'ព្រាប' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Those words are not written in this Bible’s language. KJV ' +
                'is written in "en": put the words they remember into that ' +
                'language, or read the verses you think of with refs, which ' +
                'work in any language.',
        });
    });
});

describe('reading references', () => {
    test('a reference in another Bible’s language is read from the Bible that names the book so', async () => {
        state.failingInfos.add('WEB');
        state.bibles = [
            { key: 'KJV', title: 'King James Version' },
            { key: 'WEB', title: 'World English Bible' },
            { key: 'KH', title: 'Khmer Bible' },
        ];
        const result: any = await handleAgentBibleFindRequest({
            refs: 'យ៉ូហាន 10:11',
        });
        expect(result).toEqual({
            bible: 'KH',
            verses: [
                {
                    key: 'JHN 10:11',
                    ref: 'John 10:11',
                    text: KH_VERSES['JHN 10:11'],
                    title: 'យ៉ូហាន ១០:១១',
                },
            ],
        });
    });
});

describe('opening a verse in the Bible Lookup', () => {
    test('a verse opened in a Bible not in English carries its own title, when it has one', async () => {
        state.liveLookup = {
            selectedBibleItem: { id: 'live' },
            applyTargetOrBibleKey: mocks.applyLive,
        };
        await expect(
            handleAgentBibleFindRequest({ bible: 'KH', open: 'JHN 21:17' }),
        ).resolves.toMatchObject({
            opened: 'John 21:17',
            title: 'យ៉ូហាន ២១:១៧',
        });
        state.failingTitles.add('JHN 21:17');
        const untitled: any = await handleAgentBibleFindRequest({
            bible: 'KH',
            open: 'JHN 21:17',
        });
        expect(untitled.opened).toBe('John 21:17');
        expect(untitled).not.toHaveProperty('title');
    });
});
