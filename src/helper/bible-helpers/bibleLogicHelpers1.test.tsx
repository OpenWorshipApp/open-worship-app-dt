// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    checkIsBookAvailableMock: vi.fn(),
    getBibleInfoMock: vi.fn(),
    getChapterDataMock: vi.fn(),
    getOnlineBibleInfoListMock: vi.fn(),
    getBibleModelInfoMock: vi.fn(),
    toLocaleNumBibleMock: vi.fn(),
}));

vi.mock('./bibleInfoHelpers', () => ({
    checkIsBookAvailable: mocks.checkIsBookAvailableMock,
    getBibleInfo: mocks.getBibleInfoMock,
    getChapterData: mocks.getChapterDataMock,
}));

vi.mock('./bibleDownloadHelpers', () => ({
    getOnlineBibleInfoList: mocks.getOnlineBibleInfoListMock,
}));

vi.mock('../debuggerHelpers', async () => {
    const React = await import('react');
    return {
        useAppEffectAsync: (
            effectMethod: (methods: Record<string, unknown>) => Promise<void>,
            deps: unknown[],
            methods: Record<string, unknown>,
        ) => {
            React.useEffect(() => {
                void effectMethod({ ...methods });
            }, deps);
        },
    };
});

vi.mock('./bibleLogicHelpers2', () => ({
    toLocaleNumBible: mocks.toLocaleNumBibleMock,
}));

vi.mock('./bibleModelHelpers', () => ({
    getBibleModelInfo: mocks.getBibleModelInfoMock,
}));

import {
    fromBibleFileName,
    genBookMatches,
    genChapterMatches,
    getBibleInfoWithStatusList,
    getModelChapterCount,
    getModelKeyBookMap,
    toBibleFileName,
    toChapterList,
    toLocaleNumQuick,
    useChapterMatch,
} from './bibleLogicHelpers1';

function ChapterMatchHarness({
    bibleKey,
    bookKey,
    guessingChapter,
    onUpdate,
}: Readonly<{
    bibleKey: string;
    bookKey: string;
    guessingChapter: string | null;
    onUpdate: (value: ReturnType<typeof useChapterMatch>) => void;
}>) {
    const data = useChapterMatch(bibleKey, bookKey, guessingChapter);
    onUpdate(data);
    return null;
}

describe('bibleLogicHelpers1', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();

        mocks.getBibleModelInfoMock.mockReturnValue({
            bookKeysOrder: ['GEN', 'EXO', 'MAT', 'REV'],
            books: {
                EXO: { chapterCount: 40 },
                GEN: { chapterCount: 3 },
                MAT: { chapterCount: 28 },
                REV: { chapterCount: 22 },
            },
            keyBookMap: {
                EXO: 'Exodus',
                GEN: 'Genesis',
                MAT: 'Matthew',
                REV: 'Revelation',
            },
        });
        mocks.toLocaleNumBibleMock.mockImplementation(async (_bibleKey: string, chapter: number) => {
            return ['០', '១', '២', '៣', '៤'][chapter] ?? `${chapter}`;
        });
        mocks.checkIsBookAvailableMock.mockResolvedValue(true);
        mocks.getChapterDataMock.mockResolvedValue({ verses: { 1: 'Intro' } });
        mocks.getBibleInfoMock.mockResolvedValue({
            booksAvailable: ['GEN', 'MAT'],
            keyBookMap: {
                EXO: 'Exodus',
                GEN: 'Genesis',
                MAT: 'Matthew',
                REV: 'Revelation',
            },
            numList: ['០', '១', '២', '៣', '៤'],
        });
        mocks.getOnlineBibleInfoListMock.mockResolvedValue([
            { key: 'KJV' },
            { key: 'WEB' },
        ]);

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('formats locale numbers and generates chapter match suggestions', async () => {
        expect(toLocaleNumQuick(123, ['០', '១', '២', '៣'])).toBe('១២៣');
        expect(toLocaleNumQuick(12, undefined as any)).toBe(12);

        expect(await genChapterMatches('KJV', 'GEN', null)).toEqual([
            { chapter: 1, chapterLocaleString: '១' },
            { chapter: 2, chapterLocaleString: '២' },
            { chapter: 3, chapterLocaleString: '៣' },
        ]);
        expect(await genChapterMatches('KJV', 'GEN', '២')).toEqual([
            { chapter: 2, chapterLocaleString: '២' },
        ]);
    });

    test('hydrates chapter matches through the hook and keeps null for unavailable books', async () => {
        const updates: Array<ReturnType<typeof useChapterMatch>> = [];

        await act(async () => {
            if (!container) {
                throw new Error('Missing container');
            }
            root = createRoot(container);
            root.render(
                <ChapterMatchHarness
                    bibleKey="KJV"
                    bookKey="GEN"
                    guessingChapter="២"
                    onUpdate={(value) => {
                        updates.push(value);
                    }}
                />,
            );
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(updates.at(-1)).toEqual([
            {
                chapter: 0,
                chapterLocaleString: 'Introduction',
                isIntro: true,
            },
            { chapter: 2, chapterLocaleString: '២' },
        ]);

        mocks.checkIsBookAvailableMock.mockResolvedValueOnce(false);
        await act(async () => {
            root?.render(
                <ChapterMatchHarness
                    bibleKey="KJV"
                    bookKey="REV"
                    guessingChapter={null}
                    onUpdate={(value) => {
                        updates.push(value);
                    }}
                />,
            );
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(mocks.checkIsBookAvailableMock).toHaveBeenLastCalledWith('KJV', 'REV');
        expect(updates.at(-1)).toEqual([
            {
                chapter: 0,
                chapterLocaleString: 'Introduction',
                isIntro: true,
            },
            { chapter: 2, chapterLocaleString: '២' },
        ]);
    });

    test('matches bible books by exact, partial, and rotated guesses', async () => {
        mocks.getBibleInfoMock.mockResolvedValueOnce(null);
        expect(await genBookMatches('KJV', { guessingBook: 'Genesis' })).toBeNull();

        const exactMatches = await genBookMatches('KJV', { guessingBook: 'Gen' });
        expect(exactMatches?.[0]).toEqual({
            bibleKey: 'KJV',
            book: 'Genesis',
            bookKey: 'GEN',
            isAvailable: true,
            modelBook: 'Genesis',
        });

        const rotatedMatches = await genBookMatches('KJV', { guessingBook: 'atthewm' });
        expect(rotatedMatches?.some((item) => item.bookKey === 'MAT')).toBe(true);
        expect(rotatedMatches?.every((item) => item.bookKey !== 'REV')).toBe(true);
    });

    test('reports online bible availability status and exposes chapter and file helpers', async () => {
        mocks.getBibleInfoMock
            .mockResolvedValueOnce({ key: 'KJV' })
            .mockResolvedValueOnce(null);

        expect(await getBibleInfoWithStatusList()).toEqual([
            ['KJV', true, 'KJV'],
            ['WEB', false, '🚫WEB'],
        ]);

        mocks.getOnlineBibleInfoListMock.mockResolvedValueOnce(null);
        expect(await getBibleInfoWithStatusList()).toEqual([]);

        expect(getModelKeyBookMap()).toEqual({
            EXO: 'Exodus',
            GEN: 'Genesis',
            MAT: 'Matthew',
            REV: 'Revelation',
        });
        expect(getModelChapterCount('REV')).toBe(22);
        expect(toChapterList('KJV', 'GEN')).toHaveLength(3);
        await expect(Promise.all(toChapterList('KJV', 'GEN'))).resolves.toEqual([
            'Genesis ១',
            'Genesis ២',
            'Genesis ៣',
        ]);
        expect(toBibleFileName('GEN', 2)).toBe('0001-GEN.2');
        expect(() => toBibleFileName('GEN', 4)).toThrow('Invalid chapter number');
        expect(fromBibleFileName('0001-GEN.2')).toEqual({ bookKey: 'GEN', chapterNum: 2 });
        expect(fromBibleFileName('bad-file-name')).toBeNull();
    });
});
