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

// The second installed Bible: a language other than English, by its key and
// locale. Its own words are the language package's tests
// (`src/lang/data/online/<code>/tests/helper/agentBibleFindHelpers.test.ts`); here it
// is only another Bible, so its names and digits are stand-ins.
const XX_BOOKS: Record<string, string> = {
    GEN: 'Xgen',
    EXO: 'Xexo',
    LEV: 'Xlev',
    PSA: 'Xpsa',
    MAT: 'Xmat',
    JHN: 'Xjhn',
};
const XX_DIGITS: Record<string, string> = Object.fromEntries(
    '0123456789'.split('').map((digit, index) => [String(index), digit]),
);

vi.mock('../bible-find/BibleFindController', () => ({
    default: { getInstant: mocks.getInstant },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: mocks.fromVerseKey,
        fromTitleText: mocks.fromTitleText,
    },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
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
vi.mock('../others/bibleLookupPopupOpener', () => ({
    getBibleLookupPopupOpener: mocks.getPopupOpener,
}));
vi.mock('../lang/langHelpers', () => ({
    // The packs' own lists, as far as these words reach.
    checkIsStopWord: (_locale: string, word: string) => {
        return ['a', 'and', 'in', 'of', 'the', 'to', 'which', 'from'].includes(
            word,
        );
    },
    getBookMarkerWords: () => {
        return ['in', 'inside', 'from', 'book'];
    },
    getFindFrameWords: () => {
        return ['find', 'search', 'verse', 'about', 'story'];
    },
    sanitizeFindingText: mocks.sanitize,
}));
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: mocks.getAllBibles,
}));
vi.mock('./bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: mocks.getBibleInfo,
}));
vi.mock('./bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: mocks.getVersesCount,
}));
vi.mock('./bible-helpers/bibleModelHelpers', () => ({
    kjvBibleModelInfo: { keyBookMap: EN_BOOKS },
}));
vi.mock('./bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: mocks.getBibleLocale,
}));
vi.mock('./helpers', () => ({
    cloneJson: (value: unknown) => structuredClone(value),
}));

import { handleAgentBibleFindRequest } from './agentBibleFindHelpers';

// The packs' `sanitizeFindingText`: English keeps a-z and digits, and the
// other Bible's language keeps its own letters -- none of these -- each
// cutting everything else to a space.
function sanitizeAs(locale: string, text: string) {
    const kept = locale.startsWith('en')
        ? text.toLowerCase().replaceAll(/[^a-z0-9 ]/g, ' ')
        : text.replaceAll(/[\x00-\x7f]/g, ' ');
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
const XX_VERSES: Record<string, string> = {};

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
let xxDatabase: DatabaseSync;

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

function toOwnDigits(value: number | string) {
    return String(value).replaceAll(/\d/g, (digit) => XX_DIGITS[digit]);
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
                bibleKey === 'XX'
                    ? XX_BOOKS[target.bookKey]
                    : EN_BOOKS[target.bookKey];
            const end =
                target.verseEnd > target.verseStart
                    ? `-${target.verseEnd}`
                    : '';
            const title = `${book} ${target.chapter}:${target.verseStart}${end}`;
            return bibleKey === 'XX' ? toOwnDigits(title) : title;
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
    xxDatabase = genSearchDatabase('xx', XX_VERSES, 'filler');
});

afterAll(() => {
    kjvDatabase.close();
    xxDatabase.close();
});

beforeEach(() => {
    state.bibles = [
        { key: 'KJV', title: 'King James Version' },
        { key: 'XX', title: 'Xx Bible' },
    ];
    state.locales = { KJV: 'en', XX: 'xx', WEB: 'en-US' };
    state.infos = {
        KJV: { keyBookMap: EN_BOOKS },
        WEB: { keyBookMap: EN_BOOKS },
        XX: { keyBookMap: XX_BOOKS, numbersMap: XX_DIGITS },
    };
    state.failingInfos = new Set();
    state.controllers = {
        KJV: genController(kjvDatabase),
        XX: genController(xxDatabase),
    };
    state.verseTexts = { KJV: KJV_VERSES, XX: XX_VERSES, WEB: KJV_VERSES };
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

describe('searching by words', () => {
    test('every word is matched on its own and a verse holding more ranks first; "lover" is not "I will overtake"', async () => {
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'enemies love pray persecute',
        });
        expect(result).toEqual({
            bible: 'KJV',
            // English words cut back to what their forms share.
            words: ['enem', 'love', 'pray', 'persecut'],
            of: 4,
            // Exodus 15:9 holds "enem" and, run together, "love"
            // ("I wil(l ove)rtake"): read word by word it holds one.
            total: 1,
            verses: [
                {
                    key: 'MAT 5:44',
                    ref: 'Matthew 5:44',
                    text: KJV_VERSES['MAT 5:44'],
                    hits: 4,
                },
            ],
        });
    });

    test('equal verses are listed from the chapter where the words gather, a page at a time', async () => {
        const first: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'shepherd',
            limit: 1,
        });
        expect(first).toMatchObject({
            total: 3,
            verses: [{ key: 'JHN 10:11', hits: 1 }],
            next: 1,
            // Where the story is told, and every book they are in.
            passages: [{ ref: 'John 10', key: 'JHN 10', verses: 2 }],
            byBook: [
                { book: 'John', key: 'JHN', verses: 2 },
                { book: 'Psalms', key: 'PSA', verses: 1 },
            ],
        });
        expect(first).not.toHaveProperty('from');
        const second: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'shepherd',
            limit: 1,
            from: first.next,
        });
        expect(second).toMatchObject({
            from: 1,
            verses: [{ key: 'JHN 10:14' }],
            next: 2,
        });
        const last: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'shepherd',
            limit: 1,
            from: 2,
        });
        expect(last.verses).toEqual([
            {
                key: 'PSA 23:1',
                ref: 'Psalms 23:1',
                text: KJV_VERSES['PSA 23:1'],
                hits: 1,
            },
        ]);
        expect(last).not.toHaveProperty('next');
    });

    test('a story found by its rare words is named as the chapter it is told in', async () => {
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'Noah dove',
        });
        expect(result).toMatchObject({
            words: ['noah', 'dove'],
            of: 2,
            total: 1,
            verses: [{ key: 'GEN 8:11', hits: 2 }],
            // "Manoah" holds "noah" run together; Judges 13 is no passage.
            passages: [{ ref: 'Genesis 8', key: 'GEN 8', verses: 4 }],
        });
    });

    test('the words of asking are taken off the front', async () => {
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'find the verse about the dove',
        });
        expect(result.words).toEqual(['dove']);
        expect(result.total).toBe(4);
    });

    test('a word in no verse is said to be missing, and words never together are said so', async () => {
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', words: 'unicorn' }),
        ).resolves.toEqual({
            bible: 'KJV',
            words: ['unicorn'],
            total: 0,
            verses: [],
            notInBible: ['unicorn'],
            note:
                'None of these words is in this Bible. Try other forms of ' +
                'them (forgive / forgave / forgiveness) or other words for ' +
                'the same thing.',
        });
        await expect(
            handleAgentBibleFindRequest({
                bible: 'KJV',
                words: 'dove shepherd unicorn',
            }),
        ).resolves.toMatchObject({
            of: 2,
            total: 0,
            verses: [],
            notInBible: ['unicorn'],
            note: expect.stringContaining('No verse has these words together'),
        });
    });

    test('a limit is kept between one and twenty, and a bad one is the default', async () => {
        const one: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'dove',
            limit: 0,
        });
        expect(one.verses).toHaveLength(1);
        const all: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'dove',
            limit: 'many',
        });
        expect(all.verses.map((one: any) => one.key)).toEqual([
            'GEN 8:8',
            'GEN 8:9',
            'GEN 8:11',
            'GEN 8:12',
        ]);
    });
});

describe('a book named in the words, or given', () => {
    test('"in Genesis" is the book searched, and comes out of the words', async () => {
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'in Genesis the dove',
        });
        expect(result).toMatchObject({
            words: ['dove'],
            books: ['Genesis'],
            readAsBook: ['genesis'],
            total: 4,
        });
    });

    test('a misspelt book name after "in" is still the book', async () => {
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'in Genisis the dove',
        });
        expect(result).toMatchObject({
            books: ['Genesis'],
            readAsBook: ['genisis'],
            total: 4,
        });
    });

    test('a name the verses use is a word of the verse, not the book', async () => {
        const daniel: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'Daniel lions den',
        });
        expect(daniel).not.toHaveProperty('books');
        expect(daniel.verses[0]).toMatchObject({ key: 'DAN 6:16', hits: 3 });
        // "samuel" is one letter from "1 Samuel" and "judged" from
        // "Judges", and both are in a verse: neither is a book.
        const samuel: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'samuel judged israel',
        });
        expect(samuel).not.toHaveProperty('books');
        expect(samuel.verses[0]).toMatchObject({ key: '1SA 7:15', hits: 3 });
    });

    test('a book name alone is searched as a word: nothing would be left', async () => {
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', words: 'Genesis' }),
        ).resolves.toMatchObject({
            // Cut back like every English word: "genesi".
            words: ['genesi'],
            total: 0,
            notInBible: ['genesi'],
        });
    });

    test('a book given narrows the search, a name that is no book is said, none at all is refused', async () => {
        const psalms: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            words: 'shepherd',
            book: 'Psalms and Hezekiah',
        });
        expect(psalms).toMatchObject({
            books: ['Psalms'],
            notBooks: ['Hezekiah'],
            total: 1,
            verses: [{ key: 'PSA 23:1' }],
        });
        await expect(
            handleAgentBibleFindRequest({
                bible: 'KJV',
                words: 'shepherd',
                book: 'Hezekiah',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                '"Hezekiah" is not a book of the Bible. Name it in full -- ' +
                '"Psalms", "1 John" -- or leave book out.',
        });
    });
});

describe('words in another language than the Bible’s', () => {
    test('nothing but asking words is no search in any Bible', async () => {
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', words: 'find a' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('not written in this Bible’s'),
        });
    });
});

describe('a Bible that cannot be searched', () => {
    test('a table that cannot be opened is said, and the search goes nowhere else', async () => {
        state.controllers.KJV = null;
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', words: 'shepherd' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'The Bible KJV could not be opened for searching. Open it ' +
                'once in Bible Find, or pick another Bible.',
        });
    });

    test('an old-format Bible with no online search either is refused', async () => {
        state.controllers.KJV = {
            databaseFindHandler: { database: null },
            onlineFindHandler: null,
        };
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', words: 'shepherd' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The Bible KJV cannot be searched.',
        });
    });

    test('an online search with nothing returned counts what it lists', async () => {
        state.controllers.KJV = {
            databaseFindHandler: null,
            onlineFindHandler: { doFinding: mocks.doFinding },
        };
        mocks.doFinding.mockResolvedValue(null);
        await expect(
            handleAgentBibleFindRequest({
                bible: 'KJV',
                words: 'shepherd',
                from: 3,
            }),
        ).resolves.toMatchObject({ total: 0, verses: [] });
        expect(mocks.doFinding).toHaveBeenCalledWith({
            text: 'shepherd',
            bookKeys: [],
            fromLineNumber: 3,
            toLineNumber: 10,
        });
    });
});

describe('reading references', () => {
    test('keys, names and whole chapters are read; what cannot be read is listed with why', async () => {
        state.failingCounts.add('KJV:MAT 5');
        state.brokenKeys.add('JHN 3:17');
        state.verseTexts.KJV = { ...KJV_VERSES };
        delete state.verseTexts.KJV['GEN 6:8'];
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            refs:
                'JHN 3:16; Psalm 23; Matthew 5:44; Jn 10:11; Genesis 3:203; ' +
                'John 3:17; Genesis 6:8; hello',
        });
        expect(result).toEqual({
            bible: 'KJV',
            verses: [
                {
                    key: 'JHN 3:16',
                    ref: 'John 3:16',
                    text: KJV_VERSES['JHN 3:16'],
                },
                {
                    key: 'PSA 23:1-2',
                    ref: 'Psalms 23:1-2',
                    text: `(1): ${KJV_VERSES['PSA 23:1']} (2): ${KJV_VERSES['PSA 23:2']}`,
                },
                // Its chapter could not be counted: not a verdict.
                {
                    key: 'MAT 5:44',
                    ref: 'Matthew 5:44',
                    text: KJV_VERSES['MAT 5:44'],
                },
                // A form only the app's own parser reads.
                {
                    key: 'JHN 10:11',
                    ref: 'John 10:11',
                    text: KJV_VERSES['JHN 10:11'],
                },
            ],
            unread: ['Genesis 3:203', 'John 3:17', 'Genesis 6:8', 'hello'],
            note:
                'Write a reference as book, chapter and verse -- ' +
                '"Matthew 6:34", "1 John 4:18" -- or a whole chapter as ' +
                '"Psalm 23".',
            notFound: [
                { ref: 'Genesis 3:203', reason: 'Genesis 3 has 24 verses.' },
            ],
        });
    });

    // BN-86 (2026-11-11): cut at a found verse's 300 letters, a lesson's
    // thirteen verses were read as their first two, and the rest of the
    // lesson was written from memory.
    test('a passage read by its reference is given whole, a verse still cut', async () => {
        const verse = (number: number) => {
            return `Verse ${number} of the passage, read whole by the model.`;
        };
        state.verseCounts['KJV:MAT 13'] = 58;
        state.verseTexts.KJV = {
            ...KJV_VERSES,
            ...Object.fromEntries(
                Array.from({ length: 23 }, (_, index) => {
                    return [`MAT 13:${index + 1}`, verse(index + 1)];
                }),
            ),
            'MAT 13:24': `${'A long verse. '.repeat(40)}End.`,
        };
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            refs: 'Matthew 13:1-23; Matthew 13:24',
        });
        const [passage, single] = result.verses;
        expect(passage.key).toBe('MAT 13:1-23');
        expect(passage.text.length).toBeGreaterThan(300);
        expect(passage.text).toContain(`(23): ${verse(23)}`);
        expect(passage.text.endsWith('…')).toBe(false);
        // One verse is quoted as a found one is: cut at its line.
        expect(single.key).toBe('MAT 13:24');
        expect(single.text.length).toBeLessThanOrEqual(301);
        expect(single.text.endsWith('…')).toBe(true);
    });

    // BN-99 (2026-11-11): "Revelation 20:11-21:7" was read as ONE verse --
    // 300 letters of chapter 20, chapter 21 never read -- and the funeral
    // sermon quoted Revelation 21 from memory.
    test('a passage over chapters is read a chapter at a time, whole', async () => {
        state.verseCounts['KJV:JHN 2'] = 25;
        state.verseCounts['KJV:JHN 3'] = 36;
        state.verseTexts.KJV = {
            ...KJV_VERSES,
            ...Object.fromEntries(
                [23, 24, 25].map((verse) => {
                    return [`JHN 2:${verse}`, `Chapter two, verse ${verse}.`];
                }),
            ),
            ...Object.fromEntries(
                [1, 2, 3].map((verse) => {
                    return [`JHN 3:${verse}`, `Chapter three, verse ${verse}.`];
                }),
            ),
        };
        const result: any = await handleAgentBibleFindRequest({
            bible: 'KJV',
            refs: 'John 2:23-3:3',
        });
        expect(result.verses.map((verse: any) => verse.key)).toEqual([
            'JHN 2:23-25',
            'JHN 3:1-3',
        ]);
        expect(result.verses[1].text).toContain('(3): Chapter three, verse 3.');
        expect(result.unread).toBeUndefined();
    });

    test('a reference that names no book stays in the lookup’s Bible', async () => {
        state.newLookupBibleKey = 'XX';
        const semicolons: any = await handleAgentBibleFindRequest({
            refs: ' ; ',
        });
        expect(semicolons).toEqual({ bible: 'XX', verses: [] });
        const words: any = await handleAgentBibleFindRequest({
            refs: 'hello there',
        });
        expect(words).toMatchObject({ bible: 'XX', unread: ['hello there'] });
    });

    test('with no lookup to ask, the first installed Bible is used', async () => {
        state.isLookupBroken = true;
        state.bibles = [
            { key: 'XX', title: 'Xx Bible' },
            { key: 'KJV', title: 'King James Version' },
        ];
        const result: any = await handleAgentBibleFindRequest({});
        expect(result).toEqual({
            bible: 'XX',
            bibles: [
                { key: 'XX', title: 'Xx Bible', locale: 'xx' },
                { key: 'KJV', title: 'King James Version', locale: 'en' },
            ],
            note: 'Give words to search for, or refs to read.',
        });
    });

    // A New Testament alone had been chosen to quote Genesis from
    // (2026-10-29): a Bible of some books says how many; a whole one, and
    // one that does not say, say nothing.
    test('a Bible that holds some books only says how many', async () => {
        state.isLookupBroken = true;
        state.locales = { ...state.locales, NT: 'xx' };
        state.bibles = [
            {
                key: 'NT',
                title: 'Xx New Testament',
                booksAvailable: Array.from({ length: 27 }, (_, index) => {
                    return `B${index}`;
                }),
            },
            {
                key: 'XX',
                title: 'Xx Bible',
                booksAvailable: Array.from({ length: 66 }, (_, index) => {
                    return `B${index}`;
                }),
            },
            { key: 'KJV', title: 'King James Version' },
        ] as any;
        const result: any = await handleAgentBibleFindRequest({});
        expect(result.bibles).toEqual([
            {
                key: 'NT',
                title: 'Xx New Testament',
                locale: 'xx',
                books: 27,
            },
            { key: 'XX', title: 'Xx Bible', locale: 'xx' },
            { key: 'KJV', title: 'King James Version', locale: 'en' },
        ]);
    });

    test('no Bible installed at all is refused', async () => {
        state.bibles = null;
        await expect(
            handleAgentBibleFindRequest({ refs: 'John 3:16' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('No Bible is installed'),
        });
    });
});

describe('opening a verse in the Bible Lookup', () => {
    test('a key opens in the live lookup, never on a screen', async () => {
        state.liveLookup = {
            selectedBibleItem: { id: 'live' },
            applyTargetOrBibleKey: mocks.applyLive,
        };
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', open: 'JHN 3:16' }),
        ).resolves.toEqual({
            opened: 'John 3:16',
            bible: 'KJV',
            note: 'It is in the Bible Lookup now; nothing went on a screen.',
        });
        expect(mocks.applyLive).toHaveBeenCalledWith(
            { id: 'live' },
            {
                bibleKey: 'KJV',
                target: {
                    bookKey: 'JHN',
                    chapter: 3,
                    verseStart: 16,
                    verseEnd: 16,
                },
            },
        );
        expect(mocks.applyNew).not.toHaveBeenCalled();
    });

    test('a chapter a search named opens as every verse of it', async () => {
        state.liveLookup = {
            selectedBibleItem: { id: 'live' },
            applyTargetOrBibleKey: mocks.applyLive,
        };
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', open: 'Genesis 7' }),
        ).resolves.toMatchObject({ opened: 'Genesis 7:1-24' });
        expect(mocks.applyLive.mock.calls[0][1].target).toEqual({
            bookKey: 'GEN',
            chapter: 7,
            verseStart: 1,
            verseEnd: 24,
        });
    });

    test('with the lookup in a shut popup, the passage is set and the popup opened', async () => {
        state.popupOpener = mocks.openPopup;
        state.failingCounts.add('KJV:JHN 3');
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', open: 'John 3:16' }),
        ).resolves.toMatchObject({ opened: 'John 3:16', bible: 'KJV' });
        expect(mocks.applyNew).toHaveBeenCalledWith(
            { bibleKey: 'KJV', id: 'new' },
            {
                bibleKey: 'KJV',
                target: {
                    bookKey: 'JHN',
                    chapter: 3,
                    verseStart: 16,
                    verseEnd: 16,
                },
            },
        );
        expect(mocks.openPopup).toHaveBeenCalledOnce();
    });

    test.each([
        ['Hezekiah 3:1', 'no such book'],
        ['Genesis 99', 'a chapter that cannot be counted'],
        ['JHN 3:16', 'a key the parser throws on'],
    ])('"%s" (%s) is refused and nothing moves', async (open) => {
        state.liveLookup = {
            selectedBibleItem: { id: 'live' },
            applyTargetOrBibleKey: mocks.applyLive,
        };
        state.failingCounts.add('KJV:GEN 99');
        state.brokenKeys.add('JHN 3:16');
        await expect(
            handleAgentBibleFindRequest({ bible: 'KJV', open }),
        ).resolves.toEqual({
            isError: true,
            reason:
                `"${open}" is not a verse of KJV. Open a verse by the key a ` +
                'search answered with, such as "JHN 3:16", or as "John 3:16".',
        });
        expect(mocks.applyLive).not.toHaveBeenCalled();
    });
});
