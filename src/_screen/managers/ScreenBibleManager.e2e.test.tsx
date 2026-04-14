// @vitest-environment jsdom

import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { BibleItemDataType } from '../screenTypeHelpers';

const mocks = vi.hoisted(() => ({
    addPlayToBottom: vi.fn(),
    addToTheTop: vi.fn(),
    bringDomToCenterView: vi.fn(),
    bringDomToNearestView: vi.fn(),
    bringDomToTopView: vi.fn(),
    checkIsVerticalPartialInvisible: vi.fn(() => false),
    genScreenMouseEvent: vi.fn((event: MouseEvent | null) => event),
    getBibleListOnScreenSetting: vi.fn(() => ({})),
    getDisplayByScreenId: vi.fn(() => ({
        id: 1,
        bounds: {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        },
    })),
    getLangDataAsync: vi.fn(async () => ({
        fontFamily: 'TestFont',
        genCss: () => '',
    })),
    getSetting: vi.fn(() => undefined),
    setSetting: vi.fn(),
    unlocking: vi.fn((_key: string, callback: () => void) => callback()),
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

vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getLangDataAsync: mocks.getLangDataAsync,
    tran: (value: string) => value,
}));

vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getVerses: vi.fn(async () => ({})),
}));

vi.mock('../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: vi.fn(async () => []),
    getDownloadedBibleInfoList: vi.fn(async () => []),
    getOnlineBibleInfoList: vi.fn(async () => []),
}));

vi.mock('../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    genBookMatches: vi.fn(async () => []),
    getModelChapterCount: vi.fn(() => 50),
    getModelKeyBookMap: vi.fn(() => ({})),
    useChapterMatch: vi.fn(),
    toBibleFileName: vi.fn(() => ''),
}));

vi.mock('../../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getBibleLocale: vi.fn(async () => 'en-US'),
    toLocaleNumBible: vi.fn(async (_bibleKey: string, verse: number) => {
        return `${verse}`;
    }),
}));

vi.mock('../../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
    HEX_COLOR_WHITE: '#FFFFFF',
    checkIsColorDark: vi.fn(() => false),
}));

vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: vi.fn(),
    showAppConfirm: vi.fn(async () => true),
}));

vi.mock('../../server/appHelpers', () => ({
    copyToClipboard: vi.fn(),
    electronSendAsync: vi.fn(),
    removeOpacityFromHexColor: (color: string) => color.slice(0, 7),
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        fileUtils: {},
        isPagePresenter: false,
        isPageScreen: true,
        getIsMouseOverApp: () => true,
        getIsWindowFocused: () => true,
        messageUtils: {
            listenForData: vi.fn(),
            listenOnceForData: vi.fn(),
            sendData: vi.fn(),
            sendDataSync: vi.fn(),
        },
        pathUtils: {
            basename: path.basename,
            join: path.join,
            resolve: path.resolve,
            sep: path.sep,
        },
        systemUtils: {
            isMac: true,
        },
    },
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlocking,
}));

vi.mock('./screenBackgroundHelpers', () => ({
    applyAttachBackground: vi.fn(),
}));

vi.mock('../../bible-list/Bible', () => ({
    default: class Bible {
        static async getDefault() {
            return null;
        }
    },
}));

vi.mock('../../bible-list/BibleItem', () => ({
    default: class BibleItem {
        static fromJson(json: any) {
            return json;
        }
    },
}));

vi.mock('../../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        toBibleVersesKey: vi.fn(() => ''),
        toKJVBibleVersesKey: vi.fn(() => ''),
    },
}));

vi.mock('../../bible-lookup/BibleSelectionComp', () => ({
    genContextMenuBibleKeys: vi.fn(async () => []),
}));

vi.mock('../bibleScreenHelpers', async () => {
    const actual = (await vi.importActual('../bibleScreenHelpers')) as any;
    return {
        default: {
            ...actual.default,
            genHtmlFromScreenViewBibleItem: vi.fn(async () => {
                const div = document.createElement('div');
                div.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th class="header"><div>KJV</div></th>
                                <th class="header"><div>NIV</div></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <span class="highlight" data-kjv-verse-key="GEN-1-1" data-verse-key="KJV-GEN-1-1">
                                        <div class="verse-number">1</div>
                                        In the beginning
                                    </span>
                                    <span class="highlight" data-kjv-verse-key="GEN-1-2" data-verse-key="KJV-GEN-1-2">
                                        <div class="verse-number">2</div>
                                        The earth was without form
                                    </span>
                                </td>
                                <td>
                                    <span class="highlight" data-kjv-verse-key="GEN-1-1" data-verse-key="NIV-GEN-1-1">
                                        <div class="verse-number">1</div>
                                        At the start
                                    </span>
                                    <span class="highlight" data-kjv-verse-key="GEN-1-2" data-verse-key="NIV-GEN-1-2">
                                        <div class="verse-number">2</div>
                                        The earth was formless
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                `;
                return div;
            }),
        },
    };
});

vi.mock('../screenHelpers', () => ({
    addPlayToBottom: mocks.addPlayToBottom,
    addToTheTop: mocks.addToTheTop,
    genScreenMouseEvent: mocks.genScreenMouseEvent,
    getBibleListOnScreenSetting: mocks.getBibleListOnScreenSetting,
}));

vi.mock('./screenHelpers', () => ({
    getDisplayByScreenId: mocks.getDisplayByScreenId,
}));

function createScreenViewData(): BibleItemDataType {
    return {
        locale: 'en-US',
        type: 'bible-item',
        scroll: 0,
        selectedKJVVerseKey: null,
        bibleItemData: {
            bibleItem: {} as any,
            renderedList: [
                {
                    locale: 'en-US' as any,
                    bibleKey: 'KJV',
                    title: 'Genesis 1:1-2',
                    verses: [
                        {
                            num: '1',
                            text: 'In the beginning',
                            verseKey: 'KJV-GEN-1-1',
                            kjvVerseKey: 'GEN-1-1',
                        },
                        {
                            num: '2',
                            text: 'The earth was without form',
                            verseKey: 'KJV-GEN-1-2',
                            kjvVerseKey: 'GEN-1-2',
                        },
                    ],
                },
                {
                    locale: 'en-US' as any,
                    bibleKey: 'NIV',
                    title: 'Genesis 1:1-2',
                    verses: [
                        {
                            num: '1',
                            text: 'At the start',
                            verseKey: 'NIV-GEN-1-1',
                            kjvVerseKey: 'GEN-1-1',
                        },
                        {
                            num: '2',
                            text: 'The earth was formless',
                            verseKey: 'NIV-GEN-1-2',
                            kjvVerseKey: 'GEN-1-2',
                        },
                    ],
                },
            ],
        },
    };
}

function createScreenManagerBase(screenId: number) {
    return {
        screenId,
        width: 960,
        height: 540,
        noSyncGroupMap: new Map<string, boolean>(),
        checkIsLockedWithMessage: vi.fn(() => false),
        createScreenManagerBaseGhost: vi.fn(),
        sendScreenMessage: vi.fn(),
    } as any;
}

function createHost() {
    const host = document.createElement('div');
    Object.defineProperties(host, {
        clientHeight: {
            configurable: true,
            value: 320,
        },
        clientWidth: {
            configurable: true,
            value: 960,
        },
        scrollHeight: {
            configurable: true,
            value: 640,
        },
        scrollWidth: {
            configurable: true,
            value: 960,
        },
    });
    document.body.appendChild(host);
    return host;
}

describe('ScreenBibleManager e2e', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        mocks.checkIsVerticalPartialInvisible.mockReturnValue(false);
    });

    test('renders a scaled Bible table and syncs verse selection across columns', async () => {
        const { renderScreenBibleManager } =
            await import('../screenBibleHelpers');
        const { default: ScreenBibleManager } =
            await import('./ScreenBibleManager');

        const screenManagerBase = createScreenManagerBase(101);
        const screenBibleManager = new ScreenBibleManager(screenManagerBase);
        const host = createHost();
        const highlightSpy = vi.fn();

        screenBibleManager.handleBibleViewVersesHighlighting = highlightSpy;
        screenBibleManager.div = host;
        screenBibleManager.screenViewData = createScreenViewData();
        await renderScreenBibleManager(screenBibleManager);

        expect(host.style.pointerEvents).toBe('auto');
        expect(host.querySelectorAll('span.highlight')).toHaveLength(4);
        expect(host.firstElementChild).not.toBeNull();
        expect((host.firstElementChild as HTMLDivElement).style.transform).toBe(
            'scale(0.5,0.5) translate(50%, 50%)',
        );

        const verse = host.querySelector(
            '[data-kjv-verse-key="GEN-1-1"]',
        ) as HTMLSpanElement | null;
        expect(verse).not.toBeNull();

        verse?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(screenBibleManager.selectedKJVVerseKey).toBe('GEN-1-1');
        expect(host.querySelectorAll('span.selected')).toHaveLength(2);
        expect(highlightSpy).toHaveBeenCalledWith('GEN-1-1', false);
        expect(screenManagerBase.sendScreenMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                screenId: 101,
                type: 'bible-screen-view-selected-index',
                data: {
                    selectedKJVVerseKey: 'GEN-1-1',
                },
            }),
            true,
        );

        verse?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(screenBibleManager.selectedKJVVerseKey).toBeNull();
        expect(host.querySelectorAll('span.selected')).toHaveLength(0);
        expect(screenManagerBase.sendScreenMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                screenId: 101,
                type: 'bible-screen-view-selected-index',
                data: {
                    selectedKJVVerseKey: null,
                },
            }),
            true,
        );
    });

    test('double click promotes the selected verse to the top flow', async () => {
        const { renderScreenBibleManager } =
            await import('../screenBibleHelpers');
        const { default: ScreenBibleManager } =
            await import('./ScreenBibleManager');

        const screenManagerBase = createScreenManagerBase(102);
        const screenBibleManager = new ScreenBibleManager(screenManagerBase);
        const host = createHost();
        const highlightSpy = vi.fn();

        screenBibleManager.handleBibleViewVersesHighlighting = highlightSpy;
        screenBibleManager.div = host;
        screenBibleManager.screenViewData = createScreenViewData();
        await renderScreenBibleManager(screenBibleManager);

        const verse = host.querySelector(
            '[data-kjv-verse-key="GEN-1-2"]',
        ) as HTMLSpanElement | null;
        expect(verse).not.toBeNull();

        verse?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

        expect(screenBibleManager.selectedKJVVerseKey).toBe('GEN-1-2');
        expect(mocks.bringDomToTopView).toHaveBeenCalledTimes(2);
        expect(mocks.bringDomToNearestView).not.toHaveBeenCalled();
        expect(mocks.bringDomToCenterView).not.toHaveBeenCalled();
        expect(highlightSpy).toHaveBeenCalledWith('GEN-1-2', true);
        expect(screenManagerBase.sendScreenMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                screenId: 102,
                type: 'bible-screen-view-selected-index',
                data: {
                    selectedKJVVerseKey: 'GEN-1-2',
                },
            }),
            true,
        );
    });

    test('applies synced selections and centers partially hidden verses', async () => {
        const { renderScreenBibleManager } =
            await import('../screenBibleHelpers');
        const { default: ScreenBibleManager } =
            await import('./ScreenBibleManager');

        const screenManagerBase = createScreenManagerBase(103);
        const screenBibleManager = new ScreenBibleManager(screenManagerBase);
        const host = createHost();
        const highlightSpy = vi.fn();

        screenBibleManager.handleBibleViewVersesHighlighting = highlightSpy;
        screenBibleManager.div = host;
        screenBibleManager.screenViewData = createScreenViewData();
        await renderScreenBibleManager(screenBibleManager);

        mocks.checkIsVerticalPartialInvisible.mockReturnValue(true);
        ScreenBibleManager.receiveSyncSelectedIndex({
            screenId: 103,
            type: 'bible-screen-view-selected-index',
            data: {
                selectedKJVVerseKey: 'GEN-1-2',
            },
        } as any);

        expect(screenBibleManager.selectedKJVVerseKey).toBe('GEN-1-2');
        expect(host.querySelectorAll('span.selected')).toHaveLength(2);
        expect(mocks.bringDomToCenterView).toHaveBeenCalledTimes(2);
        expect(mocks.bringDomToNearestView).not.toHaveBeenCalled();
        expect(mocks.bringDomToTopView).not.toHaveBeenCalled();
        expect(highlightSpy).toHaveBeenCalledWith('GEN-1-2', false);
    });
});
