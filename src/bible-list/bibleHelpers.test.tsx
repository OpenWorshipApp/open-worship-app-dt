// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    const captured: { effectCb?: any; screenCb?: any } = {};
    return {
        captured,
        tranMock: vi.fn((key: string) => key),
        getLangDataAsyncMock: vi.fn(),
        bibleItemFromVerseKeyMock: vi.fn(),
        checkIsBookAvailableMock: vi.fn(),
        getVersesMock: vi.fn(),
        keyToBookMock: vi.fn(),
        extractBibleTitleMock: vi.fn(),
        toInputTextMock: vi.fn(),
        toLocaleNumBibleMock: vi.fn(),
        bibleAddToDefaultMock: vi.fn(),
        bibleFromFilePathMock: vi.fn(),
        bibleGetDirSettingMock: vi.fn(() => 'bible-dir'),
        bibleCheckIsDefaultMock: vi.fn(),
        showSimpleToastMock: vi.fn(),
        dirSourceGetInstanceMock: vi.fn(),
        fileSourceGetInstanceMock: vi.fn(),
        addExtensionMock: vi.fn((name: string, ext: string) => `${name}${ext}`),
        fsCheckFileExistMock: vi.fn(),
        getFileBase64Mock: vi.fn(),
        pathJoinMock: vi.fn((...parts: string[]) => parts.join('/')),
        writeFileFromBase64SyncMock: vi.fn(),
        showAppContextMenuMock: vi.fn(),
        screenBibleHandleSelectingMock: vi.fn(),
        applyTargetOrBibleKeyMock: vi.fn(),
        detachBackgroundMock: vi.fn(),
        genShowOnScreensContextMenuMock: vi.fn((cb: any) => [
            { menuElement: 'on-screen', onSelect: (e: any) => cb(e) },
        ]),
        genBibleItemCopyingContextMenuMock: vi.fn(() => [
            { menuElement: 'copy' },
        ]),
        getAllScreenManagersMock: vi.fn((): any[] => []),
        bibleRenderToTitleMock: vi.fn(async () => 'rendered-title'),
        useAppEffectAsyncMock: vi.fn((cb: any) => {
            captured.effectCb = cb;
        }),
        genTimeoutAttemptMock: vi.fn(() => (fn: any) => fn()),
        useScreenUpdateEventsMock: vi.fn((_a: any, cb: any) => {
            captured.screenCb = cb;
        }),
        exportBibleMSWordMock: vi.fn(async () => '/out/bible.docx'),
        showFileOrDirExplorerMock: vi.fn(),
        handleErrorMock: vi.fn(),
        cloneJsonMock: vi.fn((v: any) => structuredClone(v)),
        getBibleLocaleMock: vi.fn(async () => 'en'),
    };
});

vi.mock('../lang/langHelpers', () => ({
    getLangDataAsync: h.getLangDataAsyncMock,
    tran: h.tranMock,
}));
vi.mock('./BibleItem', () => ({
    default: { fromVerseKey: h.bibleItemFromVerseKeyMock },
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    checkIsBookAvailable: h.checkIsBookAvailableMock,
    getVerses: h.getVersesMock,
    keyToBook: h.keyToBookMock,
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    extractBibleTitle: h.extractBibleTitleMock,
    toInputText: h.toInputTextMock,
    toLocaleNumBible: h.toLocaleNumBibleMock,
}));
vi.mock('./Bible', () => ({
    default: {
        addBibleItemToDefault: h.bibleAddToDefaultMock,
        fromFilePath: h.bibleFromFilePathMock,
        getDirSourceSettingName: h.bibleGetDirSettingMock,
        checkIsDefault: h.bibleCheckIsDefaultMock,
    },
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('../helper/DirSource', () => ({
    default: { getInstance: h.dirSourceGetInstanceMock },
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: h.fileSourceGetInstanceMock },
}));
vi.mock('../server/fileHelpers', () => ({
    addExtension: h.addExtensionMock,
    fsCheckFileExist: h.fsCheckFileExistMock,
    getFileBase64: h.getFileBase64Mock,
    pathJoin: h.pathJoinMock,
    writeFileFromBase64Sync: h.writeFileFromBase64SyncMock,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenuMock,
}));
vi.mock('../_screen/managers/ScreenBibleManager', () => ({
    default: { handleBibleItemSelecting: h.screenBibleHandleSelectingMock },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    default: class {
        selectedBibleItem = { id: 1 };
        applyTargetOrBibleKey = h.applyTargetOrBibleKeyMock;
    },
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { detachBackground: h.detachBackgroundMock },
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: h.genShowOnScreensContextMenuMock,
}));
vi.mock('./bibleItemHelpers', () => ({
    genBibleItemCopyingContextMenu: h.genBibleItemCopyingContextMenuMock,
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: h.getAllScreenManagersMock,
}));
vi.mock('./bibleRenderHelpers', () => ({
    bibleRenderHelper: { toTitle: h.bibleRenderToTitleMock },
}));
vi.mock('../helper/appHooks', () => ({
    useAppEffectAsync: h.useAppEffectAsyncMock,
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: h.genTimeoutAttemptMock,
}));
vi.mock('../_screen/managers/screenManagerHooks', () => ({
    useScreenUpdateEvents: h.useScreenUpdateEventsMock,
}));
vi.mock('../server/appHelpers', () => ({
    exportBibleMSWord: h.exportBibleMSWordMock,
    showFileOrDirExplorer: h.showFileOrDirExplorerMock,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleErrorMock }));
vi.mock('../helper/helpers', () => ({ cloneJson: h.cloneJsonMock }));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'kjv',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: h.getBibleLocaleMock,
}));

import {
    SelectedBibleKeyContext,
    checkIsBibleItemOnScreen,
    exportToWordDocument,
    genInputText,
    genVerseList,
    getOnScreenBibleItems,
    improveBibleItemTitleOnHover,
    moveBibleItemTo,
    openBibleItemContextMenu,
    saveBibleItem,
    sortBibleFilePaths,
    useBibleKeyContext,
    useIsOnScreen,
} from './bibleHelpers';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: any) {
    await act(async () => {
        root = createRoot(container);
        root.render(node);
    });
}

describe('bible-list bibleHelpers', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
        h.captured.effectCb = undefined;
        h.captured.screenCb = undefined;
    });

    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('useBibleKeyContext returns the provided key and throws when empty', async () => {
        let seen = '';
        function Probe() {
            seen = useBibleKeyContext();
            return null;
        }
        await render(
            <SelectedBibleKeyContext.Provider value="ESV">
                <Probe />
            </SelectedBibleKeyContext.Provider>,
        );
        expect(seen).toBe('ESV');

        function ThrowProbe() {
            try {
                useBibleKeyContext();
                return <span>ok</span>;
            } catch (error: any) {
                return <span>{error.message}</span>;
            }
        }
        await act(async () => {
            root?.render(
                <SelectedBibleKeyContext.Provider value="">
                    <ThrowProbe />
                </SelectedBibleKeyContext.Provider>,
            );
        });
        expect(container.textContent).toContain('not provided');
    });

    test('genInputText converts book when available, else returns input', async () => {
        h.extractBibleTitleMock.mockResolvedValue({
            result: {
                bookKey: 'GEN',
                chapter: 1,
                bibleItem: { target: { verseStart: 1, verseEnd: 2 } },
            },
        });
        h.checkIsBookAvailableMock.mockResolvedValue(true);
        h.keyToBookMock.mockResolvedValue('Genesis');
        h.toInputTextMock.mockReturnValue('Genesis 1:1-2');
        expect(await genInputText('kjv', 'esv', 'Gen 1:1-2')).toBe(
            'Genesis 1:1-2',
        );

        h.checkIsBookAvailableMock.mockResolvedValue(false);
        expect(await genInputText('kjv', 'esv', 'unknown')).toBe('unknown');

        h.extractBibleTitleMock.mockResolvedValue({
            result: { bookKey: null, chapter: null, bibleItem: null },
        });
        expect(await genInputText('kjv', 'esv', 'raw')).toBe('raw');
    });

    test('saveBibleItem reports success and failure', async () => {
        h.bibleAddToDefaultMock.mockResolvedValue({ id: 5 });
        const onDone = vi.fn();
        const saved = await saveBibleItem({ id: 5 } as any, onDone);
        expect(saved).toEqual({ id: 5 });
        expect(onDone).toHaveBeenCalled();

        h.bibleAddToDefaultMock.mockResolvedValue(null);
        expect(await saveBibleItem({ id: 5 } as any)).toBeNull();
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Adding bible',
            'Fail to add bible to list',
        );
    });

    test('genVerseList builds a filtered verse list', async () => {
        h.getVersesMock.mockResolvedValue({ '1': 'a', '2': 'b', '3': 'c' });
        h.toLocaleNumBibleMock.mockImplementation(
            async (_key: string, n: number) => (n === 2 ? null : `#${n}`),
        );
        const list = await genVerseList({
            bibleKey: 'kjv',
            bookKey: 'GEN',
            chapter: 1,
        });
        expect(list).toEqual([
            [1, '#1'],
            [3, '#3'],
        ]);

        h.getVersesMock.mockResolvedValue(null);
        expect(
            await genVerseList({ bibleKey: 'kjv', bookKey: 'GEN', chapter: 1 }),
        ).toBeNull();
    });

    test('moveBibleItemTo warns when no other bibles are available', async () => {
        h.dirSourceGetInstanceMock.mockResolvedValue({
            getFilePaths: vi.fn(async () => ['/b/Same.bible']),
        });
        h.fileSourceGetInstanceMock.mockReturnValue({ name: 'Same' });
        await moveBibleItemTo({}, { filePath: '/b/Same.bible' } as any);
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Move Bible Item',
            'No other bibles found',
        );
    });

    test('moveBibleItemTo builds a menu and moves to the target bible', async () => {
        h.dirSourceGetInstanceMock.mockResolvedValue({
            getFilePaths: vi.fn(async () => ['/b/Other.bible', '/b/Cur.bible']),
        });
        h.fileSourceGetInstanceMock.mockImplementation(
            (a: string, b?: string) => {
                if (a === '/b/Other.bible') {
                    return { name: 'Other' };
                }
                if (a === '/b/Cur.bible') {
                    return { name: 'Cur' };
                }
                // current bible.filePath lookups
                if (a === '/b/Cur.bible' || b !== undefined) {
                    return {
                        name: 'Cur',
                        baseDirPath: '/b',
                        dotExtension: '.bible',
                        filePath: '/b/Other.bible',
                    };
                }
                return {
                    name: 'Cur',
                    baseDirPath: '/b',
                    dotExtension: '.bible',
                    filePath: '/b/Other.bible',
                };
            },
        );
        const moveItemFrom = vi.fn();
        h.bibleFromFilePathMock.mockResolvedValue({ moveItemFrom });

        const bible = { filePath: '/b/Cur.bible' } as any;
        await moveBibleItemTo({}, bible, { id: 1 } as any);
        expect(h.showAppContextMenuMock).toHaveBeenCalled();
        const items = h.showAppContextMenuMock.mock.calls[0][1];
        await items[0].onSelect();
        expect(moveItemFrom).toHaveBeenCalledWith('/b/Cur.bible', { id: 1 });

        // target bible not found path
        h.bibleFromFilePathMock.mockResolvedValue(null);
        await items[0].onSelect();
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Move Bible Item',
            'Target bible not found',
        );
    });

    test('openBibleItemContextMenu warns when bible cannot be loaded', async () => {
        h.bibleFromFilePathMock.mockResolvedValue(null);
        await openBibleItemContextMenu(
            {},
            { filePath: '/b/x.bible' } as any,
            0,
            null,
            [],
        );
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Open Bible Item Context Menu',
            'Unable to get bible',
        );
    });

    test('openBibleItemContextMenu builds a full menu and runs handlers', async () => {
        const bible = {
            duplicate: vi.fn(),
            save: vi.fn(),
            deleteBibleItem: vi.fn(async () => {}),
            swapItems: vi.fn(),
            itemsLength: 3,
        };
        h.bibleFromFilePathMock.mockResolvedValue(bible);
        const openBibleLookup = vi.fn();
        const bibleItem = {
            filePath: '/b/x.bible',
            bibleKey: 'kjv',
            target: { bookKey: 'GEN' },
            id: 7,
        } as any;
        const extra = [{ menuElement: 'extra' }];

        await openBibleItemContextMenu(
            {},
            bibleItem,
            1,
            openBibleLookup,
            extra as any,
        );
        const items = h.showAppContextMenuMock.mock.calls[0][1];
        const byName = (name: string) =>
            items.find((it: any) => it.menuElement === name);

        await byName('Lookup').onSelect();
        expect(h.applyTargetOrBibleKeyMock).toHaveBeenCalled();
        expect(openBibleLookup).toHaveBeenCalled();

        byName('Duplicate').onSelect();
        expect(bible.duplicate).toHaveBeenCalledWith(1);

        byName('on-screen').onSelect({});
        expect(h.screenBibleHandleSelectingMock).toHaveBeenCalled();

        h.dirSourceGetInstanceMock.mockResolvedValue({
            getFilePaths: vi.fn(async () => []),
        });
        byName('Move To').onSelect({});
        await new Promise((r) => setTimeout(r, 5));

        await byName('Delete').onSelect();
        expect(bible.deleteBibleItem).toHaveBeenCalled();
        expect(h.detachBackgroundMock).toHaveBeenCalledWith('/b/x.bible', 7);

        byName('Move up').onSelect();
        expect(bible.swapItems).toHaveBeenCalledWith(1, 0);
        byName('Move down').onSelect();
        expect(bible.swapItems).toHaveBeenCalledWith(1, 2);
    });

    test('openBibleItemContextMenu omits move up at first and lookup when null', async () => {
        const bible = {
            duplicate: vi.fn(),
            save: vi.fn(),
            deleteBibleItem: vi.fn(async () => {}),
            swapItems: vi.fn(),
            itemsLength: 1,
        };
        h.bibleFromFilePathMock.mockResolvedValue(bible);
        await openBibleItemContextMenu(
            {},
            {
                filePath: '/b/x.bible',
                bibleKey: 'kjv',
                target: {},
                id: 1,
            } as any,
            0,
            null,
            [],
        );
        const items = h.showAppContextMenuMock.mock.calls[0][1];
        const names = items.map((it: any) => it.menuElement);
        expect(names).not.toContain('Lookup');
        expect(names).not.toContain('Move up');
        expect(names).not.toContain('Move down');

        // delete without filePath skips detach
        const target = items.find((it: any) => it.menuElement === 'Delete');
        await target.onSelect();
    });

    test('getOnScreenBibleItems collects titles from screen managers', async () => {
        h.getAllScreenManagersMock.mockReturnValue([
            {
                screenBibleManager: {
                    screenViewData: {
                        bibleItemData: {
                            a: [{ title: 'T1' }, { title: 'T1' }],
                            b: { bibleKey: 'kjv', target: {} },
                        },
                    },
                },
            },
            {
                screenBibleManager: { screenViewData: undefined },
            },
        ]);
        const titles = await getOnScreenBibleItems();
        expect(titles).toContain('T1');
        expect(titles).toContain('rendered-title');
        // deduped
        expect(titles.filter((t) => t === 'T1')).toHaveLength(1);
    });

    test('checkIsBibleItemOnScreen matches item titles', async () => {
        h.getAllScreenManagersMock.mockReturnValue([
            {
                screenBibleManager: {
                    screenViewData: {
                        bibleItemData: { a: [{ title: 'Match' }] },
                    },
                },
            },
        ]);
        expect(
            await checkIsBibleItemOnScreen([
                { toTitle: async () => 'Match' } as any,
            ]),
        ).toBe(true);
        expect(
            await checkIsBibleItemOnScreen([
                { toTitle: async () => 'Nope' } as any,
            ]),
        ).toBe(false);
    });

    test('useIsOnScreen resolves the on-screen state via effects', async () => {
        h.getAllScreenManagersMock.mockReturnValue([
            {
                screenBibleManager: {
                    screenViewData: {
                        bibleItemData: { a: [{ title: 'Match' }] },
                    },
                },
            },
        ]);
        const items = [{ toTitle: async () => 'Match' } as any];
        let value = true;
        function Probe() {
            value = useIsOnScreen(items);
            return null;
        }
        await render(<Probe />);
        expect(value).toBe(false);
        await act(async () => {
            await h.captured.effectCb();
        });
        expect(value).toBe(true);
        await act(async () => {
            await h.captured.screenCb();
        });
        expect(value).toBe(true);
    });

    test('exportToWordDocument returns early with no items', async () => {
        await exportToWordDocument([]);
        expect(h.exportBibleMSWordMock).not.toHaveBeenCalled();
    });

    test('exportToWordDocument writes fonts and opens the folder', async () => {
        h.getLangDataAsyncMock.mockResolvedValue({
            fontFamily: 'FontA',
            getFontFamilyFiles: () => ['/fonts/a.ttf'],
        });
        h.fileSourceGetInstanceMock.mockReturnValue({ baseDirPath: '/out' });
        h.getFileBase64Mock.mockResolvedValue('base64data');
        h.fsCheckFileExistMock.mockResolvedValue(false);
        const items = [
            {
                bibleKey: 'kjv',
                toText: async () => 'body',
                toTitleWithBibleKey: async () => 'title',
            } as any,
        ];
        await exportToWordDocument(items);
        expect(h.exportBibleMSWordMock).toHaveBeenCalled();
        expect(h.showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/out/bible.docx',
        );
        // font file written since it does not exist
        await Promise.resolve();
        expect(h.writeFileFromBase64SyncMock).toHaveBeenCalled();
    });

    test('exportToWordDocument skips existing font files and handles errors', async () => {
        h.getLangDataAsyncMock.mockResolvedValue({
            getFontFamilyFiles: () => ['/fonts/a.ttf', '/fonts/b.ttf'],
        });
        h.fileSourceGetInstanceMock.mockReturnValue({ baseDirPath: '/out' });
        // first font already exists (early return), second throws on read
        h.fsCheckFileExistMock.mockResolvedValue(true);
        h.getFileBase64Mock
            .mockResolvedValueOnce('data')
            .mockRejectedValueOnce(new Error('read fail'));
        const items = [
            {
                bibleKey: 'kjv',
                toText: async () => 'body',
                toTitleWithBibleKey: async () => 'title',
            } as any,
        ];
        await exportToWordDocument(items);
        // allow the fire-and-forget font export promises to settle
        await new Promise((r) => setTimeout(r, 5));
        expect(h.writeFileFromBase64SyncMock).not.toHaveBeenCalled();
    });

    test('improveBibleItemTitleOnHover lazily loads the verse text', async () => {
        expect(
            improveBibleItemTitleOnHover('kjv', 'GEN.1.1', null),
        ).toBeUndefined();

        const element = document.createElement('div');
        h.bibleItemFromVerseKeyMock.mockResolvedValue({
            toText: async () => 'x'.repeat(2000),
        });
        improveBibleItemTitleOnHover('kjv', 'GEN.1.1', element);
        element.dispatchEvent(new Event('mouseover'));
        await new Promise((r) => setTimeout(r, 5));
        expect(element.title.length).toBe(1000);

        // second hover returns early because title is already set
        h.bibleItemFromVerseKeyMock.mockClear();
        element.dispatchEvent(new Event('mouseover'));
        await new Promise((r) => setTimeout(r, 5));
        expect(h.bibleItemFromVerseKeyMock).not.toHaveBeenCalled();
    });

    test('improveBibleItemTitleOnHover exits when verse cannot load', async () => {
        const element = document.createElement('div');
        h.bibleItemFromVerseKeyMock.mockResolvedValue(null);
        improveBibleItemTitleOnHover('kjv', 'GEN.1.1', element);
        element.dispatchEvent(new Event('mouseover'));
        await new Promise((r) => setTimeout(r, 5));
        expect(element.title).toBe('Loading...');
    });

    test('sortBibleFilePaths moves the default file to the front', () => {
        h.bibleCheckIsDefaultMock.mockImplementation(
            (p: string) => p === '/b/Default.bible',
        );
        const sorted = sortBibleFilePaths([
            '/b/A.bible',
            '/b/Default.bible',
            '/b/B.bible',
        ]);
        expect(sorted[0]).toBe('/b/Default.bible');
    });
});
