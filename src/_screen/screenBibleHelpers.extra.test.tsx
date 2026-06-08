// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const showAppContextMenuMock = vi.fn();
const showAppAlertMock = vi.fn();
const addPlayToBottomMock = vi.fn();
const addToTheTopMock = vi.fn();
const getDisplayByScreenIdMock = vi.fn(() => ({
    bounds: { width: 640, height: 360 },
}));
const genContextMenuBibleKeysMock = vi.fn();
const registerHighlightMock = vi.fn();
const genHtmlFromScreenViewBibleItemMock = vi.fn();
const genBibleItemRenderListMock = vi.fn();
const getBibleLocaleMock = vi.fn(async (bibleKey: string) => {
    return `locale-${bibleKey}`;
});

let capturedHighlightHandlers:
    | {
          onSelectKey: (
              selectedKJVVerseKey: string | null,
              isToTop: boolean,
          ) => void;
          onBibleSelect: (event: MouseEvent, index: number) => Promise<void>;
      }
    | undefined;

class MockBibleItem {
    static readonly validate = vi.fn();

    bibleKey: string | null;
    target: {
        bookKey: string;
        chapter: number;
        verseStart: number;
        verseEnd: number;
    };
    metadata: Record<string, unknown>;
    id: number;

    constructor(data: any) {
        this.id = data.id;
        this.bibleKey = data.bibleKey ?? null;
        this.target = data.target;
        this.metadata = data.metadata ?? {};
    }

    static fromJson(json: any) {
        return new MockBibleItem({ ...json });
    }

    toJson() {
        return {
            id: this.id,
            bibleKey: this.bibleKey,
            target: { ...this.target },
            metadata: { ...this.metadata },
        };
    }

    async toTitle() {
        return `${this.target.bookKey} ${this.target.chapter}:${this.target.verseStart}`;
    }
}

vi.mock('../bible-list/BibleItem', () => ({
    default: MockBibleItem,
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('./bibleScreenHelpers', () => ({
    default: {
        genHtmlFromScreenViewBibleItem: genHtmlFromScreenViewBibleItemMock,
        registerHighlight: registerHighlightMock,
        genBibleItemRenderList: genBibleItemRenderListMock,
    },
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: showAppAlertMock,
}));

vi.mock('./screenHelpers', () => ({
    addPlayToBottom: addPlayToBottomMock,
    addToTheTop: addToTheTopMock,
}));

vi.mock('./managers/screenHelpers', () => ({
    getDisplayByScreenId: getDisplayByScreenIdMock,
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
    freezeObject: <T,>(value: T) => value,
}));

vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: 'divider',
}));

vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    genContextMenuBibleKeys: genContextMenuBibleKeysMock,
}));

vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getBibleLocale: getBibleLocaleMock,
}));

function createBibleItemJson(bibleKey = 'KJV') {
    return {
        id: 1,
        bibleKey,
        target: {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 2,
        },
        metadata: {},
    };
}

function createScreenBibleManager(screenViewData: any = null) {
    const div = document.createElement('div');
    Object.defineProperties(div, {
        scrollHeight: { configurable: true, value: 1000 },
        clientHeight: { configurable: true, value: 200 },
    });
    return {
        div,
        screenId: 1,
        screenManagerBase: {
            width: 1280,
            height: 720,
        },
        isLineSync: true,
        screenViewData,
        scroll: 0.5,
        selectedKJVVerseKey: null,
        isToTop: false,
        sendSyncSelectedIndex: vi.fn(),
        renderSelectedIndex: vi.fn(),
    } as any;
}

describe('screenBibleHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedHighlightHandlers = undefined;
        genHtmlFromScreenViewBibleItemMock.mockImplementation(async () => {
            const div = document.createElement('div');
            const span = document.createElement('span');
            span.className = 'highlight';
            span.dataset.kjvVerseKey = 'GEN-1-1';
            div.appendChild(span);
            return div;
        });
        registerHighlightMock.mockImplementation((_div, handlers) => {
            capturedHighlightHandlers = handlers;
        });
        genBibleItemRenderListMock.mockImplementation(
            async (bibleItems: any[]) => {
                return bibleItems.map((bibleItem) => ({
                    locale:
                        bibleItem.bibleKey === null
                            ? 'en'
                            : `locale-${bibleItem.bibleKey}`,
                    bibleKey: bibleItem.bibleKey,
                    title: `Title-${bibleItem.bibleKey ?? 'none'}`,
                    verses: [],
                }));
            },
        );
        genContextMenuBibleKeysMock.mockImplementation(
            async (
                handleBibleKeySelection: (
                    event: any,
                    bibleKey: string,
                ) => Promise<void> | void,
            ) => {
                return [
                    {
                        menuElement: 'ESV',
                        onSelect: async () => {
                            await Promise.resolve(
                                handleBibleKeySelection(
                                    { shiftKey: false },
                                    'ESV',
                                ),
                            );
                        },
                    },
                ];
            },
        );
    });

    test('updates selected verse state and syncs it to the screen manager', async () => {
        const { onSelectKey } = await import('./screenBibleHelpers');
        const screenBibleManager = {
            isToTop: false,
            selectedKJVVerseKey: null,
            sendSyncSelectedIndex: vi.fn(),
        } as any;

        onSelectKey(screenBibleManager, 'GEN-1-1', true);

        expect(screenBibleManager.isToTop).toBe(true);
        expect(screenBibleManager.selectedKJVVerseKey).toBe('GEN-1-1');
        expect(screenBibleManager.sendSyncSelectedIndex).toHaveBeenCalledOnce();
    });

    test('clears stale Bible DOM and renders scaled Bible content', async () => {
        const { renderScreenBibleManager } =
            await import('./screenBibleHelpers');
        const bibleItemJson = createBibleItemJson();
        const screenViewData = {
            type: 'bible-item',
            locale: 'en-US',
            bibleItemData: {
                renderedList: [
                    {
                        locale: 'en-US',
                        bibleKey: 'KJV',
                        title: 'Genesis 1:1-2',
                        verses: [],
                    },
                    {
                        locale: 'en-US',
                        bibleKey: 'NIV',
                        title: 'Genesis 1:1-2',
                        verses: [],
                    },
                ],
                bibleItem: bibleItemJson,
            },
            scroll: 0.5,
            selectedKJVVerseKey: null,
        };

        const emptyManager = createScreenBibleManager(null);
        emptyManager.div.appendChild(document.createElement('div'));
        await renderScreenBibleManager(emptyManager);
        expect(emptyManager.div.children).toHaveLength(0);
        expect(emptyManager.div.style.pointerEvents).toBe('none');

        const screenBibleManager = createScreenBibleManager(screenViewData);
        await renderScreenBibleManager(screenBibleManager);

        expect(genHtmlFromScreenViewBibleItemMock).toHaveBeenCalledWith(
            screenViewData.bibleItemData.renderedList,
            true,
        );
        expect(screenBibleManager.div.style.pointerEvents).toBe('auto');
        expect(screenBibleManager.div.firstElementChild).not.toBeNull();
        expect(
            (screenBibleManager.div.firstElementChild as HTMLDivElement).style
                .transform,
        ).toContain('scale(2,2)');
        expect(screenBibleManager.renderSelectedIndex).toHaveBeenCalledOnce();
        expect(screenBibleManager.div.scrollTop).toBe(400);
        expect(addToTheTopMock).toHaveBeenCalledWith(screenBibleManager.div);
        expect(addPlayToBottomMock).toHaveBeenCalledWith(
            screenBibleManager.div,
        );

        capturedHighlightHandlers?.onSelectKey('GEN-1-1', true);
        expect(screenBibleManager.selectedKJVVerseKey).toBe('GEN-1-1');
        expect(screenBibleManager.isToTop).toBe(true);
        expect(screenBibleManager.sendSyncSelectedIndex).toHaveBeenCalledOnce();
    });

    test('opens Bible menus and applies replacement and removal updates', async () => {
        const { renderScreenBibleManager } =
            await import('./screenBibleHelpers');
        const bibleItemJson = createBibleItemJson();
        const screenViewData = {
            type: 'bible-item',
            locale: 'en-US',
            bibleItemData: {
                renderedList: [
                    {
                        locale: 'en-US',
                        bibleKey: 'KJV',
                        title: 'Genesis 1:1-2',
                        verses: [],
                    },
                    {
                        locale: 'en-US',
                        bibleKey: 'NIV',
                        title: 'Genesis 1:1-2',
                        verses: [],
                    },
                ],
                bibleItem: bibleItemJson,
            },
            scroll: 0,
            selectedKJVVerseKey: null,
        };
        const screenBibleManager = createScreenBibleManager(screenViewData);

        await renderScreenBibleManager(screenBibleManager);
        await capturedHighlightHandlers?.onBibleSelect(
            new MouseEvent('click'),
            0,
        );

        expect(genContextMenuBibleKeysMock).toHaveBeenCalledOnce();
        expect(showAppContextMenuMock).toHaveBeenCalledOnce();
        const menuItems = showAppContextMenuMock.mock.calls[0]?.[1] as Array<{
            menuElement: any;
            onSelect: () => Promise<void> | void;
        }>;
        const waitForAsyncUpdate = async () => {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 0);
            });
        };

        expect(renderToStaticMarkup(menuItems[0]?.menuElement)).toContain(
            'KJV',
        );

        await menuItems.at(-1)?.onSelect();
        await waitForAsyncUpdate();
        expect(
            screenBibleManager.screenViewData.bibleItemData.renderedList.map(
                ({ bibleKey }: any) => bibleKey,
            ),
        ).toEqual(['ESV', 'NIV']);

        await menuItems[0]?.onSelect();
        await waitForAsyncUpdate();
        expect(
            screenBibleManager.screenViewData.bibleItemData.renderedList.map(
                ({ bibleKey }: any) => bibleKey,
            ),
        ).toEqual(['NIV']);
    });

    test('skips empty menu states and alerts when Bible item data is missing', async () => {
        const { renderScreenBibleManager } =
            await import('./screenBibleHelpers');
        const invalidViewData = {
            type: 'bible-item',
            locale: 'en-US',
            bibleItemData: {
                renderedList: [
                    {
                        locale: 'en-US',
                        bibleKey: 'KJV',
                        title: 'Genesis 1:1-2',
                        verses: [],
                    },
                ],
                bibleItem: undefined,
            },
            scroll: 0,
            selectedKJVVerseKey: null,
        };
        const screenBibleManager = createScreenBibleManager(invalidViewData);

        await renderScreenBibleManager(screenBibleManager);

        genContextMenuBibleKeysMock.mockResolvedValueOnce(null);
        await capturedHighlightHandlers?.onBibleSelect(
            new MouseEvent('click'),
            0,
        );
        expect(showAppContextMenuMock).not.toHaveBeenCalled();

        genContextMenuBibleKeysMock.mockImplementationOnce(
            async (
                handleBibleKeySelection: (
                    event: any,
                    bibleKey: string,
                ) => Promise<void> | void,
            ) => {
                return [
                    {
                        menuElement: 'ESV',
                        onSelect: async () => {
                            await Promise.resolve(
                                handleBibleKeySelection(
                                    { shiftKey: false },
                                    'ESV',
                                ),
                            );
                        },
                    },
                ];
            },
        );
        await capturedHighlightHandlers?.onBibleSelect(
            new MouseEvent('click'),
            0,
        );
        const menuItems = showAppContextMenuMock.mock.calls.at(
            -1,
        )?.[1] as Array<{
            onSelect: () => Promise<void> | void;
        }>;
        await menuItems.at(-1)?.onSelect();
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(showAppAlertMock).toHaveBeenCalledWith(
            'Fail to get bible item data',
            'We were sorry, but we are unable to get bible item data at the moment please try again later',
        );
    });

    test('builds screen view data from Bible items and JSON clones', async () => {
        const { bibleItemJsonToScreenViewData, bibleItemToScreenViewData } =
            await import('./screenBibleHelpers');

        const withNoBibleKey = new MockBibleItem({
            ...createBibleItemJson(null as any),
            bibleKey: null,
        });
        const defaultLocaleView = await bibleItemToScreenViewData([
            withNoBibleKey as any,
        ]);
        expect(defaultLocaleView.locale).toBe('en');
        expect(defaultLocaleView.bibleItemData?.renderedList).toHaveLength(1);

        const bibleKeys = ['KJV', 'NIV'];
        const jsonView = await bibleItemJsonToScreenViewData(
            createBibleItemJson(),
            bibleKeys,
        );
        expect(bibleKeys).toEqual(['KJV', 'NIV']);
        expect(jsonView.locale).toBe('locale-KJV');
        expect(
            jsonView.bibleItemData?.renderedList.map(
                ({ bibleKey }) => bibleKey,
            ),
        ).toEqual(['KJV', 'NIV']);

        const singleView = await bibleItemJsonToScreenViewData(
            createBibleItemJson(),
            [],
        );
        expect(singleView.bibleItemData?.renderedList).toHaveLength(1);
        expect(getBibleLocaleMock).toHaveBeenCalledWith('KJV');
    });
});
