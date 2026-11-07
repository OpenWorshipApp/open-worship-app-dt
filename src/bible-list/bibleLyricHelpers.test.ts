import { beforeEach, describe, expect, test, vi } from 'vitest';
import type BibleItem from './BibleItem';

const h = vi.hoisted(() => ({
    getVerses: vi.fn(),
    toLocaleNumBible: vi.fn(),
    getAvailableFileName: vi.fn(),
    createWithContent: vi.fn(),
    toast: vi.fn(),
    error: vi.fn(),
    unlockKeys: [] as string[],
    directory: {
        isDirPathValid: true,
        dirPath: '/documents',
        fireRefreshEvent: vi.fn(),
    },
}));

vi.mock('../helper/DirSource', () => ({
    default: { getInstance: async () => h.directory },
}));
vi.mock('../helper/constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'documents' },
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getVerses: h.getVerses,
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    toLocaleNumBible: h.toLocaleNumBible,
}));
vi.mock('../server/fileHelpers', () => ({
    getAvailableFileName: h.getAvailableFileName,
    getMimetypeExtensions: (name: string) => (name === 'lyric' ? ['owl'] : []),
    toPortableFileName: (name: string) => name.replaceAll(':', ' '),
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (key: string, run: () => any) => {
        h.unlockKeys.push(key);
        return run();
    },
}));
vi.mock('../lyric-list/Lyric', () => ({
    default: { createWithContent: h.createWithContent },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.error }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));

import { createBibleItemLyric } from './bibleLyricHelpers';

// A whole chapter: a passage running on through it ends where it does.
function genChapter(prefix: string, count: number) {
    const verses: Record<string, string> = {};
    for (let verse = 1; verse <= count; verse++) {
        verses[String(verse)] = `${prefix}:${verse}`;
    }
    return verses;
}

// Two versions: the passage's own and one written in its own digits.
const VERSES: Record<string, Record<number, Record<string, string>>> = {
    KJV: {
        1: genChapter('K1', 51),
        2: { '1': 'K2:1', '2': 'K2:2', '3': 'K2:3' },
        3: {
            '16': 'For God so loved the world',
            '17': 'For God sent not his Son',
            '18': 'He that believeth',
        },
    },
    KH: {
        1: genChapter('H1', 51),
        2: { '1': 'H2:1', '2': 'H2:2', '3': 'H2:3' },
        3: { '16': 'Kh 16', '17': 'Kh 17', '18': 'Kh 18' },
    },
};
const DIGITS: Record<string, string> = { KH: 'kh-' };

function passage(
    target: Partial<BibleItem['target']> = {},
    bibleKey = 'KJV',
): BibleItem {
    const item: any = {
        bibleKey,
        isError: false,
        target: {
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 17,
            ...target,
        },
        clone() {
            return passage(structuredClone(this.target), this.bibleKey);
        },
        async toTitleWithBibleKey() {
            const { chapter, verseStart, verseEnd, chapterEnd } = this.target;
            const end = chapterEnd ? `${chapterEnd}:${verseEnd}` : verseEnd;
            return `(${this.bibleKey}) John ${chapter}:${verseStart}-${end}`;
        },
    };
    return item;
}

function getCreatedContent() {
    expect(h.createWithContent).toHaveBeenCalledOnce();
    return h.createWithContent.mock.calls[0][2] as string;
}

beforeEach(() => {
    vi.clearAllMocks();
    h.unlockKeys = [];
    h.directory.isDirPathValid = true;
    h.getVerses.mockImplementation(
        async (bibleKey: string, _bookKey: string, chapter: number) =>
            VERSES[bibleKey]?.[chapter] ?? null,
    );
    h.toLocaleNumBible.mockImplementation(
        async (bibleKey: string, n: number) => `${DIGITS[bibleKey] ?? ''}${n}`,
    );
    h.getAvailableFileName.mockImplementation(
        async (_dirPath: string, name: string) => name,
    );
    h.createWithContent.mockImplementation(
        async (dirPath: string, name: string) => ({
            filePath: `${dirPath}/${name}.owl`,
        }),
    );
});

describe('createBibleItemLyric', () => {
    test('titled by its own version, the others its subtitle, one numbered line per version in each Verse part', async () => {
        const source = passage();
        const file = await createBibleItemLyric(source, ['KH']);
        expect(file).toEqual({
            filePath: '/documents/(KJV) John 3 16-17, (KH) John 3 16-17.owl',
        });
        const content = getCreatedContent();
        expect(content).toContain(
            '- Title: (KJV) John 3:16-17\n- Subtitle: (KH) John 3:16-17\n',
        );
        expect(content).toContain('- Structure: V16V17\n');
        expect(content).toContain(
            '```ol:Verse 16\n16: For God so loved the world\nkh-16: Kh 16\n```',
        );
        expect(content).toContain(
            '```ol:Verse 17\n17: For God sent not his Son\nkh-17: Kh 17\n```',
        );
        expect(h.getAvailableFileName).toHaveBeenCalledWith(
            '/documents',
            '(KJV) John 3 16-17, (KH) John 3 16-17',
            '.owl',
        );
        expect(h.unlockKeys).toEqual(['create-bible-lyric']);
        expect(h.directory.fireRefreshEvent).toHaveBeenCalledOnce();
        // The row's own item is never touched.
        expect(source.target).toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 17,
        });
        expect(h.toast).not.toHaveBeenCalled();
    });

    test("the passage's own version leads, and is never listed twice", async () => {
        await createBibleItemLyric(passage({}, 'KH'), ['KJV', 'KH', 'KJV']);
        const content = getCreatedContent();
        expect(content).toContain(
            '- Title: (KH) John 3:16-17\n- Subtitle: (KJV) John 3:16-17\n',
        );
        expect(content).toContain(
            '```ol:Verse 16\nkh-16: Kh 16\n16: For God so loved the world\n```',
        );
    });

    test('with no other version chosen it is the passage alone', async () => {
        await createBibleItemLyric(passage({ verseEnd: 16 }));
        const content = getCreatedContent();
        // No other version, no subtitle.
        expect(content).toContain(
            '- Title: (KJV) John 3:16-16\n- Structure: V16\n',
        );
        expect(content).toContain(
            '```ol:Verse 16\n16: For God so loved the world\n```',
        );
    });

    test('across chapters each line says its chapter too', async () => {
        await createBibleItemLyric(
            passage({ chapter: 1, verseStart: 51, chapterEnd: 2, verseEnd: 2 }),
            ['KH'],
        );
        const content = getCreatedContent();
        expect(content).toContain('- Structure: V51V1V2\n');
        expect(content).toContain(
            '```ol:Verse 51\n1:51: K1:51\nkh-1:kh-51: H1:51\n```',
        );
        expect(content).toContain(
            '```ol:Verse 1\n2:1: K2:1\nkh-2:kh-1: H2:1\n```',
        );
    });

    test('a verse missing in one version names it and creates nothing', async () => {
        h.getVerses.mockImplementation(
            async (bibleKey: string, _bookKey: string, chapter: number) =>
                bibleKey === 'KH' ? { '16': 'Kh 16' } : VERSES.KJV[chapter],
        );
        const file = await createBibleItemLyric(passage(), ['KH']);
        expect(file).toBeNull();
        expect(h.toast).toHaveBeenCalledExactlyOnceWith(
            'Create Lyric',
            'Bible passage is unavailable in: KH',
        );
        expect(h.createWithContent).not.toHaveBeenCalled();
        expect(h.directory.fireRefreshEvent).not.toHaveBeenCalled();
    });

    test('no Documents folder, or a file that cannot be made, says it failed', async () => {
        h.directory.isDirPathValid = false;
        expect(await createBibleItemLyric(passage())).toBeNull();
        expect(h.createWithContent).not.toHaveBeenCalled();
        expect(h.toast).toHaveBeenLastCalledWith(
            'Create Lyric',
            'Failed to create lyric document',
        );

        h.directory.isDirPathValid = true;
        h.createWithContent.mockResolvedValue(null);
        expect(await createBibleItemLyric(passage())).toBeNull();
        expect(h.error).toHaveBeenCalledTimes(2);
        expect(h.toast).toHaveBeenCalledTimes(2);
        expect(h.directory.fireRefreshEvent).not.toHaveBeenCalled();
    });
});
