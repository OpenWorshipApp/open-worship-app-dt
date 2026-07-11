// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const cacheStores: Map<string, unknown>[] = [];
    const verseKeyMap = new Map<string, any>();

    class MockCacheManager<T> {
        private readonly store = new Map<string, T>();

        constructor(_ttl: number) {
            cacheStores.push(this.store as Map<string, unknown>);
        }

        async get(key: string) {
            return this.store.has(key) ? this.store.get(key) : null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }
    }

    class MockBibleItem {
        bibleKey: string;
        target: {
            bookKey: string;
            chapter: number;
            verseEnd: number;
            verseStart: number;
        };
        private readonly titleText: string;
        private readonly bodyText: string;

        constructor(
            bibleKey: string,
            target: {
                bookKey: string;
                chapter: number;
                verseEnd: number;
                verseStart: number;
            },
            titleText: string,
            bodyText: string,
        ) {
            this.bibleKey = bibleKey;
            this.target = target;
            this.titleText = titleText;
            this.bodyText = bodyText;
        }

        getCopyingBibleKey() {
            return `(${this.bibleKey})`;
        }

        async toText() {
            return this.bodyText;
        }

        async toTitle() {
            return this.titleText;
        }
    }

    const buildBibleItem = (
        bibleKey: string,
        verseKey: string,
        titleText: string,
        bodyText: string,
    ) => {
        const [chapterPart, versePart] = verseKey.split(':');
        const [bookKey, chapter] = chapterPart.split(' ');
        const [verseStart, verseEnd] = versePart.split('-');
        return new MockBibleItem(
            bibleKey,
            {
                bookKey,
                chapter: Number.parseInt(chapter, 10),
                verseEnd: Number.parseInt(verseEnd ?? verseStart, 10),
                verseStart: Number.parseInt(verseStart, 10),
            },
            titleText,
            bodyText,
        );
    };

    return {
        MockCacheManager,
        bibleRenderTitleMock: vi.fn(),
        buildBibleItem,
        cacheStores,
        copyToClipboardMock: vi.fn(),
        fromVerseKeyMock: vi.fn(async (bibleKey: string, verseKey: string) => {
            return verseKeyMap.get(`${bibleKey}:${verseKey}`) ?? null;
        }),
        generateMD5Mock: vi.fn((value: string) => `md5:${value.length}`),
        getBibleLocaleMock: vi.fn(),
        getChapterDataMock: vi.fn(),
        getLangDataFromBibleKeyMock: vi.fn(),
        reset() {
            cacheStores.length = 0;
            verseKeyMap.clear();
        },
        showAppContextMenuMock: vi.fn(),
        toVerseFullKeyFormatMock: vi.fn(
            (bookKey: string, chapter: number, verse: number) => {
                return `${bookKey} ${chapter}:${verse}`;
            },
        ),
        unlockingMock: vi.fn(
            async (_key: string, callback: () => Promise<unknown>) => {
                return callback();
            },
        ),
        verseKeyMap,
    };
});

vi.mock('./bibleInfoHelpers', () => ({
    getChapterData: mocks.getChapterDataMock,
    toVerseFullKeyFormat: mocks.toVerseFullKeyFormatMock,
}));

vi.mock('../../bible-list/BibleItem', () => ({
    default: class BibleItem {
        static readonly fromVerseKey = mocks.fromVerseKeyMock;
    },
}));

vi.mock('../../others/CacheManager', () => ({
    default: mocks.MockCacheManager,
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlockingMock,
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        systemUtils: {
            generateMD5: mocks.generateMD5Mock,
        },
    },
}));

vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenuMock,
}));

vi.mock('../../server/appHelpers', () => ({
    copyToClipboard: mocks.copyToClipboardMock,
}));

vi.mock('../../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        toTitle: mocks.bibleRenderTitleMock,
    },
}));

vi.mock('../../context-menu/AppContextMenuComp', () => ({
    elementDivider: 'DIVIDER',
}));

vi.mock('./bibleStyleHelpers', () => ({
    getBibleLocale: mocks.getBibleLocaleMock,
    getLangDataFromBibleKey: mocks.getLangDataFromBibleKeyMock,
}));

async function loadModule() {
    return await import('./bibleLogicHelpers3');
}

async function flushAsyncWork() {
    for (let i = 0; i < 8; i++) {
        await Promise.resolve();
    }
}

describe('bibleLogicHelpers3', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mocks.reset();

        mocks.getBibleLocaleMock.mockResolvedValue('km-KH');
        mocks.getLangDataFromBibleKeyMock.mockResolvedValue({
            fontFamily: 'Khmer Font',
        });
        mocks.bibleRenderTitleMock.mockResolvedValue('Genesis 1:1-2:3');
        mocks.getChapterDataMock.mockResolvedValue(null);

        mocks.verseKeyMap.set(
            'KJV:GEN 1:1',
            mocks.buildBibleItem(
                'KJV',
                'GEN 1:1',
                'Genesis 1:1',
                'In the beginning',
            ),
        );
        mocks.verseKeyMap.set(
            'KJV:GEN 1:1-',
            mocks.buildBibleItem(
                'KJV',
                'GEN 1:1',
                'Genesis 1:1',
                'In the beginning',
            ),
        );
        mocks.verseKeyMap.set(
            'KJV:GEN 2:1-3',
            mocks.buildBibleItem(
                'KJV',
                'GEN 2:1-3',
                'Genesis 2:1-3',
                'Thus the heavens',
            ),
        );
    });

    test('builds and caches newline title html with compiled verse tooltips', async () => {
        const module = await loadModule();
        const titles = [
            {
                content:
                    '<span data-title-verse-key="GEN 1:1">Open verse</span>',
                cssStyle: 'color: red;',
            },
        ];

        const html = await module.genNewLineTitlesHtmlText('KJV', titles);
        expect(html).toContain('data-dict-locale="km-KH"');
        expect(html).toContain('font-family: Khmer Font');
        expect(html).toContain('app-caught-hover-pointer');
        expect(html).toContain('Genesis 1:1  In the beginning');

        const cachedHtml = await module.genNewLineTitlesHtmlText('KJV', titles);
        expect(cachedHtml).toBe(html);
        expect(mocks.getLangDataFromBibleKeyMock).toHaveBeenCalledTimes(1);

        mocks.getChapterDataMock.mockResolvedValueOnce({
            newLinesTitleMap: {
                'GEN 1:1': titles,
            },
        });
        expect(
            await module.getNewLineTitlesHtmlText('KJV', 'GEN', 1, 1),
        ).toContain('Open verse');

        mocks.getChapterDataMock.mockResolvedValueOnce({
            newLinesTitleMap: {},
        });
        expect(
            await module.getNewLineTitlesHtmlText('KJV', 'GEN', 1, 2),
        ).toBeNull();
    });

    test('renders custom verse content, god-word spans, and injected title blocks', async () => {
        const module = await loadModule();
        mocks.getChapterDataMock.mockResolvedValueOnce({
            customVersesMap: {
                'GEN 1:1': [
                    { content: ' Plain text ' },
                    { content: 'LORD', isGW: true },
                    {
                        isTitle: true,
                        titles: [
                            {
                                content:
                                    '<span data-title-verse-key="GEN 1:1">Heading</span>',
                            },
                        ],
                    },
                    { foo: 'bar' },
                ],
            },
        });
        const customText = await module.getCustomVerseText('KJV', 'GEN', 1, 1);
        expect(customText).toContain('Plain text');
        expect(customText).toContain('<span class="app-god-word">LORD</span>');
        expect(customText).toContain('class="mt-2"');

        mocks.getChapterDataMock.mockResolvedValueOnce({
            customVersesMap: {
                'GEN 1:2': [{ content: '   ' }],
            },
        });
        expect(await module.getCustomVerseText('KJV', 'GEN', 1, 2)).toBeNull();
    });

    test('attaches verse click handlers and opens context menus for single verses', async () => {
        const module = await loadModule();
        const parent = document.createElement('span');
        parent.innerHTML =
            '<span data-title-verse-key="GEN 1:1" data-bible-key="KJV">Verse</span>';
        const child = parent.querySelector(
            'span[data-title-verse-key]',
        ) as HTMLSpanElement;
        const currentBibleItem = mocks.buildBibleItem(
            'KJV',
            'GEN 1:1',
            'Genesis 1:1',
            'Current verse',
        );
        const viewController = {
            addBibleItemRight: vi.fn(),
            isLookup: false,
        };

        await module.reformCustomTitle(
            viewController as any,
            currentBibleItem as any,
            parent,
        );
        child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await flushAsyncWork();

        const items = mocks.showAppContextMenuMock.mock.calls.at(
            -1,
        )?.[1] as Array<any>;
        expect(items).toHaveLength(3);
        expect(items[0]?.menuElement).toBe('DIVIDER');
        expect(items[1]?.title).toBe('Open "Genesis 1:1"');
        items[1]?.onSelect?.();
        expect(viewController.addBibleItemRight).toHaveBeenCalledWith(
            currentBibleItem,
            mocks.verseKeyMap.get('KJV:GEN 1:1'),
        );

        items[2]?.onSelect?.();
        expect(mocks.copyToClipboardMock).toHaveBeenCalledWith(
            '(KJV) Genesis 1:1',
        );
    });

    test('handles cross-chapter title ranges for lookup controllers', async () => {
        vi.useFakeTimers();
        const module = await loadModule();
        const parent = document.createElement('span');
        parent.innerHTML =
            '<span data-title-verse-key="GEN 1:1-2:3" data-bible-key="KJV">Verse range</span>';
        const child = parent.querySelector(
            'span[data-title-verse-key]',
        ) as HTMLSpanElement;
        const currentBibleItem = mocks.buildBibleItem(
            'KJV',
            'GEN 1:1',
            'Genesis 1:1',
            'Current verse',
        );
        const lookupController = {
            addBibleItemRight: vi.fn(),
            inputText: '',
            isLookup: true,
        };

        await module.reformCustomTitle(
            lookupController as any,
            currentBibleItem as any,
            parent,
        );
        child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await flushAsyncWork();

        const items = mocks.showAppContextMenuMock.mock.calls.at(
            -1,
        )?.[1] as Array<any>;
        const combinedOpen = items.find(
            (item) => item.title === 'Open "Genesis 1:1-2:3"',
        );
        expect(combinedOpen).toBeTruthy();
        combinedOpen?.onSelect?.();
        vi.runAllTimers();

        expect(lookupController.addBibleItemRight).toHaveBeenCalledWith(
            currentBibleItem,
            currentBibleItem,
        );
        expect(lookupController.inputText).toBe('Genesis 1:1-2:3');
        vi.useRealTimers();
    });
});
