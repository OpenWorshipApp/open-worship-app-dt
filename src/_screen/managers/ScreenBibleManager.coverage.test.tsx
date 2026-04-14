// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { DragTypeEnum } from '../../helper/DragInf';

const mocks = vi.hoisted(() => ({
    bringDomToCenterView: vi.fn(),
    bringDomToNearestView: vi.fn(),
    bringDomToTopView: vi.fn(),
    checkIsVerticalPartialInvisible: vi.fn(() => false),
    getSetting: vi.fn((_key: string) => undefined as string | undefined),
    setSetting: vi.fn(),
    renderScreenBibleManager: vi.fn(),
    bibleItemJsonToScreenViewData: vi.fn(
        async (bibleItemJson: any, bibleKeys: string[]) => ({
            locale: 'en-US',
            type: 'bible-item',
            scroll: 0,
            selectedKJVVerseKey: null,
            bibleItemData: {
                bibleItem: bibleItemJson,
                renderedList: bibleKeys.map((bibleKey) => ({ bibleKey })),
            },
        }),
    ),
    onSelectKey: vi.fn(),
    genScreenMouseEvent: vi.fn((event: MouseEvent | null) => event),
    getBibleListOnScreenSetting: vi.fn(() => ({})),
    appLog: vi.fn(),
    appError: vi.fn(),
    handleError: vi.fn(),
    screenManagerBaseMap: new Map<number, any>(),
    getAllScreenManagerBases: vi.fn((): any[] => []),
    applyAttachBackground: vi.fn(),
    unlocking: vi.fn((_key: string, callback: () => unknown) => callback()),
    bibleGetDefault: vi.fn(
        async (): Promise<{ filePath: string } | null> => null,
    ),
    registerScrollingSyncEvent: vi.fn(),
    checkIsColorDark: vi.fn((_value: string) => false),
    showAppConfirm: vi.fn(async () => true),
    tran: vi.fn((value: string) => value),
    removeClassName: vi.fn((root: ParentNode, className: string) => {
        for (const element of root.querySelectorAll(`.${className}`)) {
            element.classList.remove(className);
        }
    }),
    resetClassName: vi.fn(
        (
            root: ParentNode,
            className: string,
            _isQuery: boolean,
            key: string,
        ) => {
            const targets = Array.from(
                root.querySelectorAll(`[data-kjv-verse-key="${key}"]`),
            ) as HTMLElement[];
            for (const target of targets) {
                target.classList.add(className);
            }
            return targets;
        },
    ),
    appProvider: {
        isPagePresenter: false,
        isPageScreen: false,
        getIsMouseOverApp: vi.fn(() => true),
        getIsWindowFocused: vi.fn(() => true),
        pathUtils: {
            basename: (value: string) => value.split(/[\\/]/).at(-1) ?? value,
            join: (...parts: string[]) => parts.join('/'),
            resolve: (...parts: string[]) => parts.join('/'),
            sep: '/',
        },
        systemUtils: {
            isDev: false,
        },
    },
}));

vi.mock('../../helper/helpers', async () => {
    const actual = (await vi.importActual('../../helper/helpers')) as any;
    return {
        ...actual,
        bringDomToCenterView: mocks.bringDomToCenterView,
        bringDomToNearestView: mocks.bringDomToNearestView,
        bringDomToTopView: mocks.bringDomToTopView,
        checkIsVerticalPartialInvisible: mocks.checkIsVerticalPartialInvisible,
    };
});

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
}));

vi.mock('../bibleScreenHelpers', () => ({
    default: {
        removeClassName: mocks.removeClassName,
        resetClassName: mocks.resetClassName,
    },
}));

vi.mock('../screenBibleHelpers', () => ({
    SCREEN_BIBLE_SETTING_PREFIX: 'screen-bible',
    renderScreenBibleManager: mocks.renderScreenBibleManager,
    bibleItemJsonToScreenViewData: mocks.bibleItemJsonToScreenViewData,
    onSelectKey: mocks.onSelectKey,
}));

vi.mock('../screenHelpers', () => ({
    genScreenMouseEvent: mocks.genScreenMouseEvent,
    getBibleListOnScreenSetting: mocks.getBibleListOnScreenSetting,
}));

vi.mock('../../helper/loggerHelpers', () => ({
    appLog: mocks.appLog,
    appError: mocks.appError,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));

vi.mock('./screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: mocks.getAllScreenManagerBases,
    getScreenManagerBase: vi.fn((screenId: number) => {
        return mocks.screenManagerBaseMap.get(screenId) ?? null;
    }),
}));

vi.mock('../../server/appProvider', () => ({
    default: mocks.appProvider,
}));

vi.mock('./screenBackgroundHelpers', () => ({
    applyAttachBackground: mocks.applyAttachBackground,
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlocking,
}));

vi.mock('../../bible-list/Bible', () => ({
    default: {
        getDefault: mocks.bibleGetDefault,
    },
}));

vi.mock('./screenEventHelpers', () => ({
    registerScrollingSyncEvent: mocks.registerScrollingSyncEvent,
}));

vi.mock('../../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
    HEX_COLOR_WHITE: '#FFFFFF',
    checkIsColorDark: mocks.checkIsColorDark,
}));

vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.showAppConfirm,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: mocks.tran,
}));

let ScreenBibleManager: any;

function createScreenManagerBase(screenId: number) {
    const screenManagerBase = {
        screenId,
        width: 960,
        height: 540,
        noSyncGroupMap: new Map<string, boolean>(),
        checkIsLockedWithMessage: vi.fn(() => false),
        createScreenManagerBaseGhost: vi.fn((targetScreenId: number) => ({
            screenId: targetScreenId,
        })),
        sendScreenMessage: vi.fn(),
    } as any;
    mocks.screenManagerBaseMap.set(screenId, screenManagerBase);
    return screenManagerBase;
}

function createScreenViewData(renderedKeys: string[] = ['KJV', 'NIV']) {
    return {
        locale: 'en-US',
        type: 'bible-item',
        scroll: 0,
        selectedKJVVerseKey: null,
        bibleItemData: {
            bibleItem: { id: 1 },
            renderedList: renderedKeys.map((bibleKey) => ({ bibleKey })),
        },
    } as any;
}

describe('ScreenBibleManager coverage', () => {
    beforeAll(async () => {
        ({ default: ScreenBibleManager } =
            await import('./ScreenBibleManager'));
    });

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        mocks.appProvider.isPagePresenter = false;
        mocks.appProvider.isPageScreen = false;
        mocks.screenManagerBaseMap.clear();
        mocks.getSetting.mockReturnValue(undefined);
        mocks.getBibleListOnScreenSetting.mockReturnValue({});
        mocks.checkIsVerticalPartialInvisible.mockReturnValue(false);
        mocks.checkIsColorDark.mockReturnValue(false);
        mocks.showAppConfirm.mockResolvedValue(true);
    });

    test('covers line sync, div events, rendered keys, sync payloads, and selection navigation', async () => {
        const base = createScreenManagerBase(61);
        const manager = new ScreenBibleManager(base);

        expect(manager.getRenderedBibleKeys()).toEqual([]);
        expect(manager.scroll).toBe(0);
        expect(manager.isShowing).toBe(false);

        manager.screenViewData = createScreenViewData();
        expect(manager.getRenderedBibleKeys()).toEqual(['KJV', 'NIV']);
        expect(manager.toSyncMessage()).toEqual({
            type: 'bible-screen-view',
            data: manager.screenViewData,
        });

        mocks.getSetting.mockImplementation((key: string) => {
            return key === 'screen-bible-line-sync-61' ? 'true' : undefined;
        });
        expect(manager.isLineSync).toBe(true);
        manager.isLineSync = false;
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'screen-bible-line-sync-61',
            'false',
        );

        base.checkIsLockedWithMessage.mockReturnValueOnce(true);
        manager.isLineSync = true;
        expect(mocks.setSetting).not.toHaveBeenCalledWith(
            'screen-bible-line-sync-61',
            'true',
        );

        const host = document.createElement('div');
        Object.defineProperties(host, {
            scrollTop: {
                configurable: true,
                writable: true,
                value: 59,
            },
            scrollHeight: {
                configurable: true,
                value: 200,
            },
            clientHeight: {
                configurable: true,
                value: 100,
            },
        });
        const fontSizeSpy = vi.spyOn(
            ScreenBibleManager,
            'changeTextStyleTextFontSize',
        );
        manager.div = host;
        expect(host.classList.contains('screen-bible-container-scroll')).toBe(
            true,
        );
        expect(mocks.registerScrollingSyncEvent).toHaveBeenCalledWith(
            host,
            expect.any(Function),
        );

        host.dispatchEvent(
            new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                ctrlKey: true,
                deltaY: -1,
            }),
        );
        expect(fontSizeSpy).toHaveBeenCalledWith(true);

        host.dispatchEvent(new Event('scroll'));
        expect(manager.scroll).toBeCloseTo(0.59, 2);

        const verseOne = document.createElement('span');
        verseOne.dataset.kjvVerseKey = 'GEN-1-1';
        const verseTwo = document.createElement('span');
        verseTwo.dataset.kjvVerseKey = 'GEN-1-1';
        host.appendChild(verseOne);
        host.appendChild(verseTwo);

        manager.selectedKJVVerseKey = 'GEN-1-1';
        expect(verseOne.classList.contains('selected')).toBe(true);
        expect(verseTwo.classList.contains('selected')).toBe(true);
        expect(mocks.bringDomToNearestView).toHaveBeenCalled();

        mocks.checkIsVerticalPartialInvisible.mockReturnValue(true);
        manager.selectedKJVVerseKey = 'GEN-1-1';
        expect(mocks.bringDomToCenterView).toHaveBeenCalled();

        manager.isToTop = true;
        manager.selectedKJVVerseKey = 'GEN-1-1';
        expect(mocks.bringDomToTopView).toHaveBeenCalled();

        manager.sendSyncSelectedIndex();
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                screenId: 61,
                type: 'bible-screen-view-selected-index',
            }),
            true,
        );

        ScreenBibleManager.receiveSyncSelectedIndex({
            screenId: 61,
            type: 'bible-screen-view-selected-index',
            data: { selectedKJVVerseKey: 'GEN-1-2' },
        } as any);
        expect(manager.selectedKJVVerseKey).toBe('GEN-1-2');

        manager.receiveSyncScreen({
            screenId: 61,
            type: 'bible-screen-view',
            data: createScreenViewData(['ESV']),
        } as any);
        expect(manager.getRenderedBibleKeys()).toEqual(['ESV']);

        manager.handleScreenVersesHighlighting('GEN-1-3', true);
        expect(mocks.onSelectKey).toHaveBeenCalledWith(
            manager,
            'GEN-1-3',
            true,
        );

        manager.clear();
        expect(manager.screenViewData).toBeNull();
    });

    test('covers text-style parsing, setters, syncing, and render forwarding', async () => {
        const baseA = createScreenManagerBase(71);
        const baseB = createScreenManagerBase(72);
        const manager = new ScreenBibleManager(baseA);
        new ScreenBibleManager(baseB);
        mocks.getAllScreenManagerBases.mockReturnValue([baseA, baseB]);

        mocks.getSetting.mockImplementation((key: string) => {
            if (key === 'screen-bible-style-text') {
                return JSON.stringify({
                    fontSize: 65,
                    color: '#abcdef',
                    textShadow: '1px 1px black',
                });
            }
            return undefined;
        });

        expect(ScreenBibleManager.textStyleTextFontSize).toBe(65);
        expect(ScreenBibleManager.textStyleTextColor).toBe('#abcdef');
        expect(ScreenBibleManager.textStyleTextTextShadow).toBe(
            '1px 1px black',
        );
        expect(ScreenBibleManager.textStyleText).toContain('font-size: 65px;');

        ScreenBibleManager.applyTextStyle({ fontSize: 70, color: '#123456' });
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'screen-bible-style-text',
            JSON.stringify({
                fontSize: 70,
                color: '#123456',
                textShadow: '1px 1px black',
            }),
        );
        expect(baseA.sendScreenMessage).toHaveBeenCalled();
        expect(baseB.sendScreenMessage).toHaveBeenCalled();

        ScreenBibleManager.receiveSyncTextStyle({
            screenId: 71,
            type: 'bible-screen-view-text-style',
            data: { textStyle: { color: '#fedcba' } },
        } as any);
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'screen-bible-style-text',
            JSON.stringify({ color: '#fedcba' }),
        );

        mocks.getSetting.mockImplementation((key: string) => {
            if (key === 'screen-bible-style-text') {
                return '5';
            }
            return undefined;
        });
        expect(ScreenBibleManager.textStyle).toEqual({});
        expect(mocks.appError).toHaveBeenCalledWith(5);
        expect(mocks.handleError).toHaveBeenCalled();

        manager.render();
        expect(mocks.renderScreenBibleManager).toHaveBeenCalledWith(manager);
    });

    test('covers new bible item application, static selection, dropped items, and sync-group application', async () => {
        const base = createScreenManagerBase(81);
        const manager = new ScreenBibleManager(base);

        const bibleItemJson = { id: 5, bibleKey: 'NIV' };
        await manager.applyNewBibleItemJson(bibleItemJson as any, undefined);
        expect(mocks.bibleItemJsonToScreenViewData).toHaveBeenLastCalledWith(
            bibleItemJson,
            [],
        );

        manager.screenViewData = createScreenViewData(['KJV']);
        await manager.applyNewBibleItemJson(
            bibleItemJson as any,
            '/bibles/niv.json',
        );
        expect(mocks.bibleItemJsonToScreenViewData).toHaveBeenLastCalledWith(
            bibleItemJson,
            ['NIV'],
        );
        expect(mocks.applyAttachBackground).toHaveBeenCalledWith(
            81,
            '/bibles/niv.json',
            5,
        );

        manager.screenViewData = createScreenViewData(['KJV', 'ESV']);
        await manager.applyNewBibleItemJson(
            bibleItemJson as any,
            '/bibles/niv.json',
        );
        expect(mocks.bibleItemJsonToScreenViewData).toHaveBeenLastCalledWith(
            bibleItemJson,
            ['NIV', 'KJV', 'ESV'],
        );

        const enableSyncSpy = vi.spyOn(ScreenBibleManager, 'enableSyncGroup');
        manager.applyFullDataSrcWithSyncGroup(createScreenViewData(['NASB']));
        expect(enableSyncSpy).toHaveBeenCalledWith(81);
        expect(manager.getRenderedBibleKeys()).toEqual(['NASB']);

        const chooseScreenIdsSpy = vi
            .spyOn(ScreenBibleManager, 'chooseScreenIds')
            .mockResolvedValue([81]);
        mocks.bibleGetDefault.mockResolvedValue({
            filePath: '/bibles/default.json',
        });
        await ScreenBibleManager.handleBibleItemSelecting(
            null as any,
            {
                filePath: undefined,
                toJson: () => ({ id: 10, bibleKey: 'ESV' }),
            } as any,
            true,
        );
        expect(chooseScreenIdsSpy).toHaveBeenCalled();
        expect(mocks.genScreenMouseEvent).toHaveBeenCalledWith(null);
        expect(mocks.applyAttachBackground).toHaveBeenCalledWith(
            81,
            '/bibles/default.json',
            10,
        );

        await manager.receiveScreenDropped({
            type: DragTypeEnum.BIBLE_ITEM,
            item: {
                filePath: '/bibles/kjv.json',
                toJson: () => ({ id: 12, bibleKey: 'KJV' }),
            },
        } as any);
        expect(mocks.bibleItemJsonToScreenViewData).toHaveBeenCalled();

        await manager.receiveScreenDropped({
            type: DragTypeEnum.LYRIC_ITEM,
            item: { id: 3 },
        } as any);
        expect(mocks.appLog).toHaveBeenCalledWith({
            type: DragTypeEnum.LYRIC_ITEM,
            item: { id: 3 },
        });

        ScreenBibleManager.receiveSyncScreen({
            screenId: 81,
            type: 'bible-screen-view',
            data: createScreenViewData(['MSG']),
        } as any);
        expect(manager.getRenderedBibleKeys()).toEqual(['MSG']);
    });

    test('covers background color reflection decisions', async () => {
        const base = createScreenManagerBase(91);
        new ScreenBibleManager(base);

        ScreenBibleManager.textStyle = { color: '#000000' };
        mocks.getSetting.mockImplementation((key: string) => {
            if (key === 'screen-bible-style-text') {
                return JSON.stringify({ color: '#000000' });
            }
            return undefined;
        });
        mocks.checkIsColorDark.mockImplementation((value: string) => {
            return value === '#000000' || value === '#111111';
        });
        await ScreenBibleManager.getInstance(91).reflectBackgroundColor(
            '#111111',
        );
        expect(mocks.showAppConfirm).toHaveBeenCalledOnce();
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'screen-bible-style-text',
            JSON.stringify({ color: '#FFFFFF' }),
        );

        mocks.showAppConfirm.mockResolvedValue(false);
        await ScreenBibleManager.getInstance(91).reflectBackgroundColor(
            '#111111',
        );
        expect(mocks.showAppConfirm).toHaveBeenCalledTimes(2);

        mocks.getSetting.mockImplementation((key: string) => {
            if (key === 'screen-bible-style-text') {
                return JSON.stringify({ color: '#111111' });
            }
            return undefined;
        });
        mocks.checkIsColorDark.mockImplementation(
            (value: string) => value === '#111111',
        );
        await ScreenBibleManager.getInstance(91).reflectBackgroundColor(
            '#ffffff',
        );
        expect(mocks.showAppConfirm).toHaveBeenCalledTimes(2);
    });
});
