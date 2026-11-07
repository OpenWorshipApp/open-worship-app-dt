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
    removeSetting: vi.fn(),
    showSimpleToast: vi.fn(),
    renderScreenLongTextManager: vi.fn(),
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
    showColorToast: vi.fn((_onUndo: () => void) => {}),
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
        checkIsVerticalPartialInvisible: mocks.checkIsVerticalPartialInvisible,
    };
});

// A selection is brought into view by a glide now; each mock stands for
// where it is brought.
vi.mock('./screenGlideScrollHelpers', () => ({
    glideDomIntoView: (dom: Element, block: string) => {
        if (block === 'center') {
            mocks.bringDomToCenterView(dom);
        } else if (block === 'start') {
            mocks.bringDomToTopView(dom);
        } else {
            mocks.bringDomToNearestView(dom);
        }
    },
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
    removeSetting: mocks.removeSetting,
}));
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: mocks.getSetting,
        setItem: mocks.setSetting,
    },
}));

vi.mock('../bibleScreenHelpers', () => ({
    default: {
        removeClassName: mocks.removeClassName,
        resetClassName: mocks.resetClassName,
    },
}));

vi.mock('../screenBibleHelpers', () => ({
    SCREEN_BIBLE_SETTING_PREFIX: 'screen-bible',
    renderScreenLongTextManager: mocks.renderScreenLongTextManager,
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

vi.mock('./bibleTextColorToastHelpers', () => ({
    showBibleTextColorChangedToast: mocks.showColorToast,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: mocks.tran,
}));

// Only the closed-screen toast is read here; the rest stays real.
vi.mock('../../toast/toastHelpers', async () => {
    const actual = (await vi.importActual('../../toast/toastHelpers')) as any;
    return { ...actual, showSimpleToast: mocks.showSimpleToast };
});

let ScreenLongTextManager: any;

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

function createLongTextData(sourceId: string) {
    return {
        locale: 'km-KH',
        type: 'long-text',
        scroll: 0,
        selectedKJVVerseKey: null,
        longTextData: {
            sourceId,
            renderedList: ['KM', 'EN'].map((code) => {
                return {
                    locale: code === 'KM' ? 'km-KH' : 'en-US',
                    code,
                    title: `${code} song`,
                    sections: [1, 2].map((num) => {
                        return {
                            num: `${num}`,
                            text: `${code} section ${num}`,
                            key: `lt-${num}`,
                        };
                    }),
                };
            }),
        },
    } as any;
}

describe('ScreenLongTextManager coverage', () => {
    beforeAll(async () => {
        ({ default: ScreenLongTextManager } =
            await import('./ScreenLongTextManager'));
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
        const manager = new ScreenLongTextManager(base);

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
            ScreenLongTextManager,
            'changeTextStyleTextFontSize',
        );
        const registerCount =
            mocks.registerScrollingSyncEvent.mock.calls.length;
        manager.div = host;
        expect(host.classList.contains('screen-bible-container-scroll')).toBe(
            true,
        );
        expect(mocks.registerScrollingSyncEvent).toHaveBeenCalledWith(
            host,
            expect.any(Function),
        );
        // `ScreenBibleComp` hands the same div over on every effect re-run:
        // one set of listeners, however often.
        manager.div = host;
        expect(mocks.registerScrollingSyncEvent).toHaveBeenCalledTimes(
            registerCount + 1,
        );

        host.dispatchEvent(
            new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                ctrlKey: true,
                deltaY: -1,
            }),
        );
        expect(fontSizeSpy).toHaveBeenCalledOnce();
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

        ScreenLongTextManager.receiveSyncSelectedIndex({
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
        const manager = new ScreenLongTextManager(baseA);
        new ScreenLongTextManager(baseB);
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

        expect(ScreenLongTextManager.textStyleTextFontSize).toBe(65);
        expect(ScreenLongTextManager.textStyleTextColor).toBe('#abcdef');
        expect(ScreenLongTextManager.textStyleTextTextShadow).toBe(
            '1px 1px black',
        );
        expect(ScreenLongTextManager.textStyleText).toContain(
            'font-size: 65px;',
        );

        ScreenLongTextManager.applyTextStyle({
            fontSize: 70,
            color: '#123456',
        });
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

        ScreenLongTextManager.receiveSyncTextStyle({
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
        // A stored value that is valid JSON but not an object fails the setting
        // manager's validate, so it degrades to the default WITHOUT throwing
        // and logging the way the hand-rolled parse used to.
        expect(ScreenLongTextManager.textStyle).toEqual({});
        expect(mocks.appError).not.toHaveBeenCalledWith(5);

        // Malformed JSON lands on the same default.
        mocks.getSetting.mockImplementation((key: string) => {
            if (key === 'screen-bible-style-text') {
                return '{not-json';
            }
            return undefined;
        });
        expect(ScreenLongTextManager.textStyle).toEqual({});

        manager.render();
        expect(mocks.renderScreenLongTextManager).toHaveBeenCalledWith(manager);
    });

    test('covers new bible item application, static selection, dropped items, and sync-group application', async () => {
        const base = createScreenManagerBase(81);
        const manager = new ScreenLongTextManager(base);

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

        const enableSyncSpy = vi.spyOn(
            ScreenLongTextManager,
            'enableSyncGroup',
        );
        manager.applyFullDataSrcWithSyncGroup(createScreenViewData(['NASB']));
        expect(enableSyncSpy).toHaveBeenCalledWith(81);
        expect(manager.getRenderedBibleKeys()).toEqual(['NASB']);

        const chooseScreenIdsSpy = vi
            .spyOn(ScreenLongTextManager, 'chooseScreenIds')
            .mockResolvedValue([81]);
        mocks.bibleGetDefault.mockResolvedValue({
            filePath: '/bibles/default.json',
        });
        await ScreenLongTextManager.handleBibleItemSelecting(
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

        ScreenLongTextManager.receiveSyncScreen({
            screenId: 81,
            type: 'bible-screen-view',
            data: createScreenViewData(['MSG']),
        } as any);
        expect(manager.getRenderedBibleKeys()).toEqual(['MSG']);
    });

    // The operator's `...` under JHN 1:2-6:4: the same passage in the same
    // versions one chapter deeper, the marked verse kept, the view kept about
    // where it was rather than jumping past the chapter just added.
    test('shows one more chapter of a passage across chapters', async () => {
        const manager = new ScreenLongTextManager(createScreenManagerBase(82));
        const crossJson = {
            id: 6,
            bibleKey: 'KJV',
            target: {
                bookKey: 'JHN',
                chapter: 1,
                verseStart: 2,
                verseEnd: 4,
                chapterEnd: 6,
            },
        };
        const genVerses = (count: number) => {
            return Array.from({ length: count }, () => ({}));
        };
        const genViewData = (shownChapterCount: number) => {
            return {
                locale: 'en-US',
                type: 'bible-item',
                scroll: 0.8,
                selectedKJVVerseKey: 'JHN 2:3',
                shownChapterCount,
                bibleItemData: {
                    bibleItem: crossJson,
                    renderedList: ['KJV', 'NIV'].map((bibleKey) => ({
                        bibleKey,
                        verses: genVerses(shownChapterCount * 10),
                    })),
                },
            } as any;
        };
        mocks.bibleItemJsonToScreenViewData.mockImplementationOnce(
            async (bibleItemJson: any, bibleKeys: string[], count?: number) => {
                return {
                    ...genViewData(count ?? 3),
                    bibleItemData: {
                        bibleItem: bibleItemJson,
                        renderedList: bibleKeys.map((bibleKey) => ({
                            bibleKey,
                            verses: genVerses((count ?? 3) * 10),
                        })),
                    },
                    scroll: 0,
                    selectedKJVVerseKey: null,
                };
            },
        );
        manager.screenViewData = genViewData(3);

        await manager.showMoreBibleChapter();

        expect(mocks.bibleItemJsonToScreenViewData).toHaveBeenLastCalledWith(
            crossJson,
            ['KJV', 'NIV'],
            4,
        );
        const screenViewData = manager.screenViewData as any;
        expect(screenViewData.shownChapterCount).toBe(4);
        expect(screenViewData.selectedKJVVerseKey).toBe('JHN 2:3');
        expect(screenViewData.scroll).toBeCloseTo((0.8 * 30) / 40);

        // Every chapter on the screen already: nothing to read.
        mocks.bibleItemJsonToScreenViewData.mockClear();
        manager.screenViewData = genViewData(6);
        await manager.showMoreBibleChapter();
        expect(mocks.bibleItemJsonToScreenViewData).not.toHaveBeenCalled();
    });

    test("puts a long text on the chosen screens with nothing that is only a Bible's", async () => {
        const baseA = createScreenManagerBase(301);
        const baseB = createScreenManagerBase(302);
        const managerA = new ScreenLongTextManager(baseA);
        const managerB = new ScreenLongTextManager(baseB);
        // Screen 302 is locked: its own check refuses, with its own toast.
        baseB.checkIsLockedWithMessage.mockReturnValue(true);
        const enableSyncSpy = vi.spyOn(
            ScreenLongTextManager,
            'enableSyncGroup',
        );
        vi.spyOn(ScreenLongTextManager, 'chooseScreenIds').mockResolvedValue([
            301, 302,
        ]);
        const longTextData = createLongTextData('long-text');

        const shownScreenIds =
            await ScreenLongTextManager.handleLongTextShowing(
                null,
                longTextData,
                true,
            );

        expect(shownScreenIds).toEqual([301]);
        expect(managerA.screenViewData).toEqual(longTextData);
        // A copy: the panel's own object is never the one a screen holds.
        expect(managerA.screenViewData).not.toBe(longTextData);
        expect(managerA.isShowing).toBe(true);
        expect(managerA.isShowingLongText).toBe(true);
        expect(managerB.screenViewData).toBeNull();
        // The colour-note group follows, as it does for a passage.
        expect(enableSyncSpy).toHaveBeenCalledWith(301);
        expect(managerA.toSyncMessage()).toEqual({
            type: 'bible-screen-view',
            data: longTextData,
        });
        // No background is attached and no Bible is looked up.
        expect(mocks.applyAttachBackground).not.toHaveBeenCalled();
        expect(mocks.bibleItemJsonToScreenViewData).not.toHaveBeenCalled();
        // Its columns are languages: a Bible presented next must not carry
        // `KM` over as a version to look for.
        expect(managerA.getRenderedBibleKeys()).toEqual([]);

        managerA.screenViewData = null;
        managerB.screenViewData = null;
    });

    test('lists, hides and restyles a long text by the source that put it up', async () => {
        const baseA = createScreenManagerBase(311);
        const baseB = createScreenManagerBase(312);
        const baseC = createScreenManagerBase(313);
        const managerA = new ScreenLongTextManager(baseA);
        const managerB = new ScreenLongTextManager(baseB);
        const managerC = new ScreenLongTextManager(baseC);
        managerA.screenViewData = createLongTextData('long-text');
        managerB.screenViewData = createLongTextData('long-text-s1');
        managerC.screenViewData = createScreenViewData(['KJV']);
        expect(managerC.isShowingLongText).toBe(false);

        // What a panel marks itself by is read off the on-screen SETTING: it
        // is drawn after a reload before any manager exists.
        mocks.getBibleListOnScreenSetting.mockReturnValue({
            311: createLongTextData('long-text'),
            312: createLongTextData('long-text-s1'),
            313: createScreenViewData(['KJV']),
        });
        const toIds = (list: [number, unknown][]) => {
            return list.map(([screenId]) => screenId).sort();
        };
        expect(toIds(ScreenLongTextManager.getLongTextShowingList())).toEqual([
            311, 312,
        ]);
        expect(
            toIds(ScreenLongTextManager.getLongTextShowingList('long-text')),
        ).toEqual([311]);
        // Acting on a text goes by the LIVE managers, whatever the setting
        // still says.
        mocks.getBibleListOnScreenSetting.mockReturnValue({});

        // Restyled where it shows: the words, the position and the selected
        // row stay the screen's own.
        managerA.scroll = 0.5;
        managerA.selectedKJVVerseKey = 'lt-2';
        ScreenLongTextManager.restyleLongText('long-text', {
            EN: { fontFamily: 'Georgia', fontSizeScale: 0.8 },
        });
        const restyled = managerA.screenViewData;
        expect(restyled.longTextData.renderedList[1].style).toEqual({
            fontFamily: 'Georgia',
            fontSizeScale: 0.8,
        });
        expect('style' in restyled.longTextData.renderedList[0]).toBe(false);
        expect(restyled.scroll).toBe(0.5);
        expect(restyled.selectedKJVVerseKey).toBe('lt-2');
        expect(restyled.longTextData.renderedList[1].sections).toEqual(
            createLongTextData('long-text').longTextData.renderedList[1]
                .sections,
        );
        // Another session's text is not this one's to restyle.
        expect(
            'style' in managerB.screenViewData.longTextData.renderedList[1],
        ).toBe(false);

        // The same style again changes nothing, so nothing is sent again.
        baseA.sendScreenMessage.mockClear();
        ScreenLongTextManager.restyleLongText('long-text', {
            EN: { fontFamily: 'Georgia', fontSizeScale: 0.8 },
        });
        expect(baseA.sendScreenMessage).not.toHaveBeenCalled();

        // A locked screen is passed over without a word.
        baseB.isLocked = true;
        ScreenLongTextManager.restyleLongText('long-text-s1', {
            EN: { color: '#00ff00' },
        });
        expect(
            'style' in managerB.screenViewData.longTextData.renderedList[1],
        ).toBe(false);
        expect(baseB.checkIsLockedWithMessage).not.toHaveBeenCalled();
        baseB.isLocked = false;

        // Hide takes down that source's text, and only on the screen named.
        ScreenLongTextManager.hideLongText('long-text', 312);
        expect(managerA.isShowingLongText).toBe(true);
        ScreenLongTextManager.hideLongText('long-text');
        expect(managerA.screenViewData).toBeNull();
        expect(managerB.isShowingLongText).toBe(true);
        // A stale Hide can never clear a Bible passage in the same layer.
        ScreenLongTextManager.hideLongText('long-text', 313);
        expect(managerC.getRenderedBibleKeys()).toEqual(['KJV']);

        managerA.screenViewData = null;
        managerB.screenViewData = null;
        managerC.screenViewData = null;
    });

    test('brings a row to the middle here and on the projector, once for the whole row', async () => {
        const baseA = createScreenManagerBase(321);
        const baseB = createScreenManagerBase(322);
        const managerA = new ScreenLongTextManager(baseA);
        const managerB = new ScreenLongTextManager(baseB);
        managerA.screenViewData = createLongTextData('long-text');
        managerB.screenViewData = createLongTextData('long-text-s1');

        // The row as it is drawn: one table row, a cell per language.
        const host = document.createElement('div');
        const row = document.createElement('tr');
        const cells = ['KM', 'EN'].map(() => {
            const cell = document.createElement('span');
            cell.dataset.kjvVerseKey = 'lt-2';
            row.appendChild(cell);
            return cell;
        });
        host.appendChild(row);
        managerA.div = host;
        mocks.bringDomToCenterView.mockClear();
        mocks.bringDomToNearestView.mockClear();
        baseA.sendScreenMessage.mockClear();
        baseB.sendScreenMessage.mockClear();

        ScreenLongTextManager.bringLongTextRowToMiddle('long-text', 1);

        expect(managerA.selectedKJVVerseKey).toBe('lt-2');
        expect(cells.every((cell) => cell.classList.contains('selected'))).toBe(
            true,
        );
        // The ROW, and once -- not each cell in turn, which left the last
        // language's cell centred and the row wherever that put it.
        expect(mocks.bringDomToCenterView).toHaveBeenCalledTimes(1);
        expect(mocks.bringDomToCenterView).toHaveBeenCalledWith(row);
        expect(mocks.bringDomToNearestView).not.toHaveBeenCalled();
        // The projector is told to bring it to ITS middle.
        expect(baseA.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 321,
                type: 'bible-screen-view-selected-index',
                data: { selectedKJVVerseKey: 'lt-2', isToMiddle: true },
            },
            true,
        );
        // Another session's text is left where it is.
        expect(managerB.selectedKJVVerseKey).toBeNull();
        expect(baseB.sendScreenMessage).not.toHaveBeenCalled();
        // One press, one move: the next plain selection is not centred.
        expect(managerA.isToMiddle).toBe(false);

        // The receiving side centres too, and an ordinary selection message
        // -- a verse clicked on a screen -- carries no such flag.
        mocks.bringDomToCenterView.mockClear();
        ScreenLongTextManager.receiveSyncSelectedIndex({
            screenId: 321,
            type: 'bible-screen-view-selected-index',
            data: { selectedKJVVerseKey: 'lt-2', isToMiddle: true },
        } as any);
        expect(mocks.bringDomToCenterView).toHaveBeenCalledWith(row);
        mocks.bringDomToCenterView.mockClear();
        ScreenLongTextManager.receiveSyncSelectedIndex({
            screenId: 321,
            type: 'bible-screen-view-selected-index',
            data: { selectedKJVVerseKey: 'lt-2' },
        } as any);
        expect(mocks.bringDomToCenterView).not.toHaveBeenCalledWith(row);
        expect(mocks.bringDomToNearestView).toHaveBeenCalled();

        managerA.screenViewData = null;
        managerB.screenViewData = null;
    });

    test('a selection brought into view is not sent out as a scroll, and to the top rides with it', async () => {
        const { getScrollSyncState } =
            await import('./screenScrollSyncHelpers');
        const base = createScreenManagerBase(331);
        const manager = new ScreenLongTextManager(base);
        manager.screenViewData = createScreenViewData();
        const host = document.createElement('div');
        const verse = document.createElement('span');
        verse.dataset.kjvVerseKey = 'GEN-2-12';
        host.appendChild(verse);
        manager.div = host;
        const state = getScrollSyncState(host);
        state.remoteAt = Number.NEGATIVE_INFINITY;

        // No such verse here: nothing scrolls, nothing is marked.
        manager.selectedKJVVerseKey = 'GEN-9-9';
        expect(state.remoteAt).toBe(Number.NEGATIVE_INFINITY);

        // The glide is this window's own: the scroll sync swallows it as it
        // does a remote one, so a grouped mini screen's glide is not stopped.
        manager.isToTop = true;
        manager.selectedKJVVerseKey = 'GEN-2-12';
        expect(mocks.bringDomToTopView).toHaveBeenCalledWith(verse);
        expect(state.remoteAt).toBeGreaterThan(Number.NEGATIVE_INFINITY);

        // The projector brings it to ITS top instead of following the glide.
        base.sendScreenMessage.mockClear();
        manager.sendSyncSelectedIndex('top');
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 331,
                type: 'bible-screen-view-selected-index',
                data: { selectedKJVVerseKey: 'GEN-2-12', isToTop: true },
            },
            true,
        );
        mocks.bringDomToTopView.mockClear();
        mocks.bringDomToNearestView.mockClear();
        ScreenLongTextManager.receiveSyncSelectedIndex({
            screenId: 331,
            type: 'bible-screen-view-selected-index',
            data: { selectedKJVVerseKey: 'GEN-2-12', isToTop: true },
        } as any);
        expect(mocks.bringDomToTopView).toHaveBeenCalledWith(verse);
        expect(mocks.bringDomToNearestView).not.toHaveBeenCalled();

        manager.screenViewData = null;
    });

    test('a colour-group member takes a selection only for the same text and while unlocked', async () => {
        const baseBible = createScreenManagerBase(341);
        const baseBibleMember = createScreenManagerBase(342);
        const baseLongText = createScreenManagerBase(343);
        const baseLongTextMember = createScreenManagerBase(344);
        const baseOtherLongText = createScreenManagerBase(345);
        const bible = new ScreenLongTextManager(baseBible);
        const bibleMember = new ScreenLongTextManager(baseBibleMember);
        const longText = new ScreenLongTextManager(baseLongText);
        const longTextMember = new ScreenLongTextManager(baseLongTextMember);
        const otherLongText = new ScreenLongTextManager(baseOtherLongText);
        bible.screenViewData = createScreenViewData(['KJV']);
        bibleMember.screenViewData = createScreenViewData(['NIV']);
        longText.screenViewData = createLongTextData('song');
        longTextMember.screenViewData = createLongTextData('song');
        otherLongText.screenViewData = createLongTextData('song-2');
        const toMessage = (screenId: number, data: object) => {
            return {
                screenId,
                type: 'bible-screen-view-selected-index',
                data,
            } as any;
        };

        // Any Bible passage, in its own versions: as the Reader writes it.
        expect(
            ScreenLongTextManager.receiveGroupSelectedIndex(
                341,
                toMessage(342, { selectedKJVVerseKey: 'GEN-2-12' }),
            ),
        ).toBe(true);
        expect(bibleMember.selectedKJVVerseKey).toBe('GEN-2-12');

        // The same long text, brought to its middle as the sender's was.
        expect(
            ScreenLongTextManager.receiveGroupSelectedIndex(
                343,
                toMessage(344, {
                    selectedKJVVerseKey: 'lt-2',
                    isToMiddle: true,
                }),
            ),
        ).toBe(true);
        expect(longTextMember.selectedKJVVerseKey).toBe('lt-2');
        expect(longTextMember.isToMiddle).toBe(false);

        // Another text keeps its own mark: another song, a song against a
        // Bible verse, a Bible against a song's row.
        otherLongText.selectedKJVVerseKey = 'lt-1';
        for (const [fromScreenId, screenId] of [
            [343, 345],
            [341, 345],
            [343, 342],
        ]) {
            expect(
                ScreenLongTextManager.receiveGroupSelectedIndex(
                    fromScreenId,
                    toMessage(screenId, { selectedKJVVerseKey: 'lt-2' }),
                ),
            ).toBe(false);
        }
        expect(otherLongText.selectedKJVVerseKey).toBe('lt-1');
        expect(bibleMember.selectedKJVVerseKey).toBe('GEN-2-12');

        // A locked member stays as it is; so does one with nothing up, and
        // a screen that is gone.
        baseLongTextMember.isLocked = true;
        expect(
            ScreenLongTextManager.receiveGroupSelectedIndex(
                343,
                toMessage(344, { selectedKJVVerseKey: 'lt-1' }),
            ),
        ).toBe(false);
        expect(longTextMember.selectedKJVVerseKey).toBe('lt-2');
        bibleMember.screenViewData = null;
        expect(
            ScreenLongTextManager.receiveGroupSelectedIndex(
                341,
                toMessage(342, { selectedKJVVerseKey: 'GEN-2-13' }),
            ),
        ).toBe(false);
        expect(
            ScreenLongTextManager.receiveGroupSelectedIndex(
                399,
                toMessage(341, { selectedKJVVerseKey: 'GEN-2-13' }),
            ),
        ).toBe(false);
        expect(bible.selectedKJVVerseKey).toBeNull();

        for (const manager of [
            bible,
            longText,
            longTextMember,
            otherLongText,
        ]) {
            manager.screenViewData = null;
        }
    });

    test('says which rows of a long text are marked, and says so only for a long text', async () => {
        const baseA = createScreenManagerBase(331);
        const baseB = createScreenManagerBase(332);
        const baseC = createScreenManagerBase(333);
        const managerA = new ScreenLongTextManager(baseA);
        const managerB = new ScreenLongTextManager(baseB);
        const managerC = new ScreenLongTextManager(baseC);
        managerA.screenViewData = createLongTextData('long-text');
        managerB.screenViewData = createLongTextData('long-text');
        managerC.screenViewData = createScreenViewData(['KJV']);
        const staticSpy = vi.spyOn(ScreenLongTextManager, 'addPropEvent');
        const instanceSpy = vi.spyOn(managerA, 'addPropEvent');
        const bibleSpy = vi.spyOn(managerC, 'addPropEvent');

        // Nothing is marked on a text that has only just gone up.
        expect(
            ScreenLongTextManager.getLongTextSelectedSectionKeys('long-text'),
        ).toEqual([]);

        // A row marked on a screen is that source's, and its panel is
        // told: by a button of the panel, or by a click on the text.
        managerA.selectedKJVVerseKey = 'lt-2';
        expect(instanceSpy).toHaveBeenCalledWith('selected');
        expect(staticSpy).toHaveBeenCalledWith('selected');
        expect(
            ScreenLongTextManager.getLongTextSelectedSectionKeys('long-text'),
        ).toEqual(['lt-2']);
        // Two screens on two rows are two marks; on the same row, one.
        managerB.selectedKJVVerseKey = 'lt-1';
        expect(
            ScreenLongTextManager.getLongTextSelectedSectionKeys(
                'long-text',
            ).sort(),
        ).toEqual(['lt-1', 'lt-2']);
        managerB.selectedKJVVerseKey = 'lt-2';
        expect(
            ScreenLongTextManager.getLongTextSelectedSectionKeys('long-text'),
        ).toEqual(['lt-2']);
        // Another session's text has no mark of this one's.
        expect(
            ScreenLongTextManager.getLongTextSelectedSectionKeys(
                'long-text-s1',
            ),
        ).toEqual([]);

        // A Bible verse is marked far more often -- the Reader follows it
        // -- and no panel draws that mark, so it fires nothing.
        staticSpy.mockClear();
        managerC.selectedKJVVerseKey = 'GEN 1:1';
        expect(bibleSpy).not.toHaveBeenCalledWith('selected');
        expect(staticSpy).not.toHaveBeenCalledWith('selected');

        // With no manager yet -- a panel drawn straight after a reload --
        // the on-screen setting stands in.
        managerA.screenViewData = null;
        managerB.screenViewData = null;
        mocks.getBibleListOnScreenSetting.mockReturnValue({
            331: {
                ...createLongTextData('long-text'),
                selectedKJVVerseKey: 'lt-1',
            },
            333: createScreenViewData(['KJV']),
        });
        expect(
            ScreenLongTextManager.getLongTextSelectedSectionKeys('long-text'),
        ).toEqual(['lt-1']);
        mocks.getBibleListOnScreenSetting.mockReturnValue({});

        managerC.screenViewData = null;
    });

    test('covers background color reflection decisions', async () => {
        const base = createScreenManagerBase(91);
        new ScreenLongTextManager(base);

        ScreenLongTextManager.textStyle = { color: '#000000' };
        mocks.getSetting.mockImplementation((key: string) => {
            if (key === 'screen-bible-style-text') {
                return JSON.stringify({ color: '#000000' });
            }
            return undefined;
        });
        mocks.checkIsColorDark.mockImplementation((value: string) => {
            return value === '#000000' || value === '#111111';
        });
        ScreenLongTextManager.getInstance(91).reflectBackgroundColor('#111111');
        expect(mocks.showColorToast).toHaveBeenCalledOnce();
        // Said, never asked: nothing blocks while the run goes on.
        expect(mocks.showAppConfirm).not.toHaveBeenCalled();
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'screen-bible-style-text',
            JSON.stringify({ color: '#FFFFFF' }),
        );
        // The readable colour goes up BEFORE the toast, so a showing screen is
        // never left unreadable.
        const fixingCallIndex = mocks.setSetting.mock.calls.findIndex(
            ([key, value]: any[]) => {
                return (
                    key === 'screen-bible-style-text' &&
                    value === JSON.stringify({ color: '#FFFFFF' })
                );
            },
        );
        expect(
            mocks.setSetting.mock.invocationCallOrder[fixingCallIndex],
        ).toBeLessThan(mocks.showColorToast.mock.invocationCallOrder[0]);

        // Undo puts the operator's own colour back.
        mocks.setSetting.mockClear();
        const onUndo = mocks.showColorToast.mock.calls[0][0];
        onUndo();
        expect(mocks.setSetting).toHaveBeenLastCalledWith(
            'screen-bible-style-text',
            JSON.stringify({ color: '#000000' }),
        );

        mocks.getSetting.mockImplementation((key: string) => {
            if (key === 'screen-bible-style-text') {
                return JSON.stringify({ color: '#111111' });
            }
            return undefined;
        });
        mocks.checkIsColorDark.mockImplementation(
            (value: string) => value === '#111111',
        );
        ScreenLongTextManager.getInstance(91).reflectBackgroundColor('#ffffff');
        // No clash, nothing changed, nothing said.
        expect(mocks.showColorToast).toHaveBeenCalledOnce();
    });
    test('sends the exact auto-scroll position as an operator scroll', () => {
        const manager = new ScreenLongTextManager(createScreenManagerBase(95));
        const send = vi
            .spyOn(manager, 'sendSyncScrollPercentage')
            .mockImplementation(() => {});
        const div = document.createElement('div');
        const metrics = {
            scrollHeight: 600,
            clientHeight: 100,
            scrollWidth: 300,
            clientWidth: 300,
            scrollLeft: 0,
        };
        for (const [name, value] of Object.entries(metrics)) {
            Object.defineProperty(div, name, { configurable: true, value });
        }
        manager.sendAutoScrollPosition(div, 125.5, true);
        expect(send).toHaveBeenCalledWith(
            '.screen-bible-container-scroll',
            { x: 0, y: 0.251 },
            true, // past the mouse-over guard, like a wheel
            true, // drawn to the sub-pixel on the projector
        );
        manager.sendAutoScrollPosition(div, 125.5, false);
        expect(send).toHaveBeenLastCalledWith(
            '.screen-bible-container-scroll',
            { x: 0, y: 0.251 },
            true,
            false, // the last frame lets go
        );
        Object.defineProperty(div, 'scrollHeight', {
            configurable: true,
            value: 100,
        });
        manager.sendAutoScrollPosition(div, 0, true);
        expect(send).toHaveBeenCalledTimes(2); // nothing to scroll, nothing sent
    });

    // Several Bibles side by side scroll a column each, inside the div.
    function createColumn(index: number, scrollHeight: number) {
        const column = document.createElement('div');
        column.className = `screen-bible-column screen-bible-column-${index}`;
        column.dataset.columnIndex = `${index}`;
        const metrics = {
            scrollHeight,
            clientHeight: 100,
            scrollWidth: 300,
            clientWidth: 300,
            scrollLeft: 0,
        };
        for (const [name, value] of Object.entries(metrics)) {
            Object.defineProperty(column, name, { configurable: true, value });
        }
        Object.defineProperty(column, 'scrollTop', {
            configurable: true,
            writable: true,
            value: 0,
        });
        const table = document.createElement('table');
        table.innerHTML =
            '<thead><tr><th class="header"><div></div></th></tr></thead>';
        column.append(table);
        return column;
    }

    async function createColumnScreen(screenId: number) {
        const { wireScreenBibleColumns } =
            await import('../screenBibleColumnHelpers');
        const manager = new ScreenLongTextManager(
            createScreenManagerBase(screenId),
        );
        const div = document.createElement('div');
        const columns = [createColumn(0, 500), createColumn(1, 900)];
        div.append(...columns);
        document.body.append(div);
        manager.screenViewData = createScreenViewData();
        manager.div = div;
        const host = wireScreenBibleColumns(div, columns, vi.fn());
        return { manager, div, columns, host };
    }

    test('remembers the host column as the position of a screen that scrolls in columns', async () => {
        const { manager, columns, host } = await createColumnScreen(96);
        // The longer Bible hosts; a scroll event does not bubble to the div.
        expect(host).toBe(columns[1]);
        columns[0].scrollTop = 300;
        columns[0].dispatchEvent(new Event('scroll'));
        expect(manager.scroll).toBe(0);
        columns[1].scrollTop = 200;
        columns[1].dispatchEvent(new Event('scroll'));
        expect(manager.scroll).toBeCloseTo(0.25);
    });

    test('shrinks every header by the column that has gone furthest', async () => {
        const { div, columns } = await createColumnScreen(97);
        columns[0].scrollTop = 59;
        columns[0].dispatchEvent(new Event('scroll'));
        const sizes = () => {
            return Array.from(
                div.querySelectorAll<HTMLElement>('th.header'),
            ).map((header) => header.style.fontSize);
        };
        // Both the same size, though only one of them has moved.
        expect(sizes()).toEqual(['0.75em', '0.75em']);
        columns[1].scrollTop = 500;
        columns[1].dispatchEvent(new Event('scroll'));
        expect(sizes()).toEqual(['0.5em', '0.5em']);
    });

    test('names the column an auto-scroll frame moves', async () => {
        const { manager, host } = await createColumnScreen(98);
        const send = vi
            .spyOn(manager, 'sendSyncScrollPercentage')
            .mockImplementation(() => {});
        manager.sendAutoScrollPosition(host, 200, true);
        expect(send).toHaveBeenCalledWith(
            '.screen-bible-column-1',
            { x: 0, y: 0.25 },
            true,
            true,
        );
    });

    test('gives a wheel on another column to the host while it slides by itself', async () => {
        const { writeSubPixelScrollTop } =
            await import('../../scrolling/subPixelScrollHelpers');
        const { columns, host } = await createColumnScreen(99);
        const turn = () => {
            const event = new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                deltaY: 120,
            });
            columns[0].dispatchEvent(event);
            return event;
        };
        expect(turn().defaultPrevented).toBe(false);
        expect(host.scrollTop).toBe(0);
        writeSubPixelScrollTop(host, 40.5);
        expect(turn().defaultPrevented).toBe(true);
        expect(host.scrollTop).toBe(160);
    });

    test('the presenter restores each screen from the saved map, and rebuilds a map it cannot read', () => {
        mocks.appProvider.isPagePresenter = true;
        const saved = createScreenViewData(['KJV']);
        mocks.getBibleListOnScreenSetting.mockReturnValue({ 401: saved });
        const restored = new ScreenLongTextManager(
            createScreenManagerBase(401),
        );
        const fresh = new ScreenLongTextManager(createScreenManagerBase(402));
        expect(restored.screenViewData).toEqual(saved);
        expect(fresh.screenViewData).toBeNull();

        // The file holds more than `{}` yet reads back empty: it is broken,
        // and saving `{402}` over it would wipe screen 401.
        mocks.getBibleListOnScreenSetting.mockImplementation(() => ({}));
        mocks.getSetting.mockImplementation((key: string) => {
            return key === 'screen-ft-manager' ? '{"401": {broken' : undefined;
        });
        const next = createScreenViewData(['NIV']);
        fresh.screenViewData = next;

        expect(mocks.handleError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining(
                    'rebuilding it from the screens in memory',
                ),
            }),
        );
        const [settingName, json] = mocks.setSetting.mock.calls.at(-1)!;
        expect(settingName).toBe('screen-ft-manager');
        const written = JSON.parse(json as string);
        expect(written['401']).toEqual(saved);
        expect(written['402']).toEqual(next);
        restored.delete();
        fresh.delete();
    });

    test("the scroll sync sends the scrolled column's own selector", () => {
        const manager = new ScreenLongTextManager(createScreenManagerBase(403));
        const send = vi
            .spyOn(manager, 'sendSyncScrollPercentage')
            .mockImplementation(() => {});
        const host = document.createElement('div');
        manager.div = host;
        const [div, onScroll] =
            mocks.registerScrollingSyncEvent.mock.calls.at(-1)!;
        expect(div).toBe(host);

        onScroll({ x: 0, y: 0.4 }, true);
        expect(send).toHaveBeenLastCalledWith(
            '.screen-bible-container-scroll',
            { x: 0, y: 0.4 },
            true,
        );
        host.dataset.columnIndex = '2';
        onScroll({ x: 0, y: 0.1 }, false);
        expect(send).toHaveBeenLastCalledWith(
            '.screen-bible-column-2',
            { x: 0, y: 0.1 },
            false,
        );
        manager.delete();
    });

    test('a mini preview lets go of its div only while it still holds it; the projector never', () => {
        const manager = new ScreenLongTextManager(createScreenManagerBase(404));
        const shown = createScreenViewData(['KJV']);
        manager.screenViewData = shown;
        const host = document.createElement('div');
        manager.div = host;

        manager.releaseDiv(document.createElement('div'));
        expect(manager.div).toBe(host);
        manager.releaseDiv(host);
        expect(manager.div).toBeNull();
        // The passage stays: the next div renders it.
        expect(manager.screenViewData).toEqual(shown);

        mocks.appProvider.isPageScreen = true;
        const projected = new ScreenLongTextManager(
            createScreenManagerBase(405),
        );
        const screenDiv = document.createElement('div');
        projected.div = screenDiv;
        projected.releaseDiv(screenDiv);
        expect(projected.div).toBe(screenDiv);
        manager.delete();
        projected.delete();
    });

    test('a scroll or a mark is saved once the screen settles, each screen its own', () => {
        vi.useFakeTimers();
        const managerA = new ScreenLongTextManager(
            createScreenManagerBase(406),
        );
        const managerB = new ScreenLongTextManager(
            createScreenManagerBase(407),
        );
        try {
            mocks.getBibleListOnScreenSetting.mockImplementation(() => ({}));
            // Nothing on the screen: no position to keep.
            managerA.scroll = 0.3;
            expect(managerA.scroll).toBe(0);
            managerA.screenViewData = createScreenViewData(['KJV']);
            managerB.screenViewData = createScreenViewData(['NIV']);
            mocks.setSetting.mockClear();

            managerA.scroll = 0.25;
            managerA.scroll = 0.5;
            managerB.selectedKJVVerseKey = 'JHN 3:16';
            // Live at once; the whole-file write waits for the drag to end.
            expect(managerA.scroll).toBe(0.5);
            expect(mocks.setSetting).not.toHaveBeenCalled();
            vi.advanceTimersByTime(499);
            expect(mocks.setSetting).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1);

            const writes = mocks.setSetting.mock.calls
                .filter(([name]) => name === 'screen-ft-manager')
                .map(([, json]) => JSON.parse(json as string));
            // One write per screen: a shared timer would have dropped one.
            expect(writes).toHaveLength(2);
            expect(writes[0]['406'].scroll).toBe(0.5);
            expect(writes[1]['407'].selectedKJVVerseKey).toBe('JHN 3:16');
        } finally {
            vi.useRealTimers();
            managerA.delete();
            managerB.delete();
        }
    });

    test('a scroll still settling when its screen is cleared is not saved back', () => {
        vi.useFakeTimers();
        const manager = new ScreenLongTextManager(createScreenManagerBase(413));
        try {
            mocks.getBibleListOnScreenSetting.mockImplementation(() => ({}));
            manager.screenViewData = createScreenViewData(['KJV']);
            manager.scroll = 0.4;
            // Cleared from the panel inside the scroll's half second.
            manager.screenViewData = null;
            mocks.setSetting.mockClear();

            vi.advanceTimersByTime(500);

            expect(manager.screenViewData).toBeNull();
            expect(mocks.setSetting).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
            manager.delete();
        }
    });

    test('the container fills the screen and scrolls only up and down', () => {
        const manager = new ScreenLongTextManager(createScreenManagerBase(408));
        expect(manager.containerStyle).toEqual({
            position: 'absolute',
            width: '960px',
            height: '540px',
            overflowX: 'hidden',
            overflowY: 'auto',
        });
        manager.delete();
    });

    test('a selection or a sync for a screen that is not here changes nothing', () => {
        const base = createScreenManagerBase(409);
        const manager = new ScreenLongTextManager(base);
        const shown = createScreenViewData(['KJV']);
        manager.screenViewData = shown;

        ScreenLongTextManager.receiveSyncSelectedIndex({
            screenId: 9999,
            type: 'bible-screen-view-selected-index',
            data: { selectedKJVVerseKey: 'GEN 1:1', isToTop: true },
        } as any);
        expect(manager.isToTop).toBe(false);
        expect(manager.selectedKJVVerseKey).toBeNull();

        // A locked screen keeps what it has.
        base.checkIsLockedWithMessage.mockReturnValue(true);
        manager.receiveSyncScreen({
            screenId: 409,
            type: 'bible-screen-view',
            data: createScreenViewData(['NIV']),
        } as any);
        expect(manager.getRenderedBibleKeys()).toEqual(['KJV']);
        manager.delete();
    });

    test('one more chapter is only for a Bible passage', async () => {
        const manager = new ScreenLongTextManager(createScreenManagerBase(410));
        await manager.showMoreBibleChapter();
        const longText = createLongTextData('long-text-more');
        manager.screenViewData = longText;
        await manager.showMoreBibleChapter();
        manager.screenViewData = {
            ...createScreenViewData(),
            bibleItemData: undefined,
        };
        await manager.showMoreBibleChapter();

        expect(mocks.bibleItemJsonToScreenViewData).not.toHaveBeenCalled();
        expect(manager.screenViewData.bibleItemData).toBeUndefined();
        manager.delete();
    });

    test('a closed screen is reported, and the open ones still get the passage or the text', async () => {
        const open = new ScreenLongTextManager(createScreenManagerBase(411));
        vi.spyOn(ScreenLongTextManager, 'chooseScreenIds').mockResolvedValue([
            9998, 411,
        ]);
        const closedToast = [
            'Failed to apply to screen. Please make sure the screen is open.',
            'Error',
        ];

        await ScreenLongTextManager.handleBibleItemSelecting(null, {
            filePath: '/bibles/kjv.json',
            toJson: () => ({ id: 20, bibleKey: 'KJV' }),
        } as any);
        expect(mocks.showSimpleToast).toHaveBeenCalledOnce();
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(...closedToast);
        expect(mocks.bibleItemJsonToScreenViewData).toHaveBeenCalledOnce();
        expect(open.isShowing).toBe(true);

        mocks.showSimpleToast.mockClear();
        const shownScreenIds =
            await ScreenLongTextManager.handleLongTextShowing(
                null,
                createLongTextData('long-text-closed'),
            );
        expect(shownScreenIds).toEqual([411]);
        expect(mocks.showSimpleToast).toHaveBeenCalledOnce();
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(...closedToast);
        expect(open.checkIsLongTextSource('long-text-closed')).toBe(true);
        open.delete();
    });

    test('a sync for a closed screen is said in English, never through tran', () => {
        ScreenLongTextManager.receiveSyncScreen({
            screenId: 9997,
            type: 'bible-screen-view',
            data: null,
        } as any);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'error',
        );
        expect(mocks.tran).not.toHaveBeenCalled();
    });

    test('delete tears the screen down locally: no broadcast, no write', () => {
        const base = createScreenManagerBase(412);
        const manager = new ScreenLongTextManager(base);
        manager.screenViewData = createScreenViewData(['KJV']);
        manager.div = document.createElement('div');
        const applied = vi.fn();
        const highlighted = vi.fn();
        manager.applyBibleViewData = applied;
        manager.handleBibleViewVersesHighlighting = highlighted;
        mocks.setSetting.mockClear();
        base.sendScreenMessage.mockClear();

        manager.delete();

        expect(mocks.removeSetting).toHaveBeenCalledWith(
            'screen-bible-line-sync-412',
        );
        expect(manager.screenViewData).toBeNull();
        expect(manager.div).toBeNull();
        expect(ScreenLongTextManager.getInstance(412)).toBeNull();
        expect(base.createScreenManagerBaseGhost).toHaveBeenCalledWith(412);
        expect(base.sendScreenMessage).not.toHaveBeenCalled();
        expect(mocks.setSetting).not.toHaveBeenCalled();
        // The view callbacks of the gone card are let go of.
        manager.applyBibleViewData(null);
        manager.handleBibleViewVersesHighlighting('GEN 1:1', false);
        expect(applied).not.toHaveBeenCalled();
        expect(highlighted).not.toHaveBeenCalled();
    });
});
