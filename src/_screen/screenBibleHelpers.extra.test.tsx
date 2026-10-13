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
const genHtmlFromLongTextColumnsMock = vi.fn();
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
    DEFAULT_LANG_CODE: 'en',
    tran: (value: string) => value,
}));

vi.mock('./bibleScreenHelpers', () => ({
    default: {
        genHtmlFromScreenViewBibleItem: genHtmlFromScreenViewBibleItemMock,
        genHtmlFromLongTextColumns: genHtmlFromLongTextColumnsMock,
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

vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
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

function createScreenLongTextManager(screenViewData: any = null) {
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
        genHtmlFromLongTextColumnsMock.mockImplementation(async () => {
            const div = document.createElement('div');
            div.className = 'screen-long-text';
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
        const screenLongTextManager = {
            isToTop: false,
            selectedKJVVerseKey: null,
            sendSyncSelectedIndex: vi.fn(),
        } as any;

        onSelectKey(screenLongTextManager, 'GEN-1-1', true);

        expect(screenLongTextManager.isToTop).toBe(true);
        expect(screenLongTextManager.selectedKJVVerseKey).toBe('GEN-1-1');
        expect(
            screenLongTextManager.sendSyncSelectedIndex,
        ).toHaveBeenCalledOnce();
    });

    test('clears stale Bible DOM and renders scaled Bible content', async () => {
        const { renderScreenLongTextManager } =
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

        const emptyManager = createScreenLongTextManager(null);
        emptyManager.div.appendChild(document.createElement('div'));
        await renderScreenLongTextManager(emptyManager);
        expect(emptyManager.div.children).toHaveLength(0);
        expect(emptyManager.div.style.pointerEvents).toBe('none');

        const screenLongTextManager =
            createScreenLongTextManager(screenViewData);
        await renderScreenLongTextManager(screenLongTextManager);

        expect(genHtmlFromScreenViewBibleItemMock).toHaveBeenCalledWith(
            screenViewData.bibleItemData.renderedList,
            true,
        );
        expect(screenLongTextManager.div.style.pointerEvents).toBe('auto');
        expect(screenLongTextManager.div.firstElementChild).not.toBeNull();
        expect(
            (screenLongTextManager.div.firstElementChild as HTMLDivElement)
                .style.transform,
        ).toContain('scale(2,2)');
        expect(
            screenLongTextManager.renderSelectedIndex,
        ).toHaveBeenCalledOnce();
        expect(screenLongTextManager.div.scrollTop).toBe(400);
        expect(addToTheTopMock).toHaveBeenCalledWith(screenLongTextManager.div);
        expect(addPlayToBottomMock).toHaveBeenCalledWith(
            screenLongTextManager.div,
            expect.any(Function),
        );
        // Each auto-scroll frame goes to the projector from its exact position.
        screenLongTextManager.sendAutoScrollPosition = vi.fn();
        addPlayToBottomMock.mock.calls[0][1](123.4, true);
        expect(
            screenLongTextManager.sendAutoScrollPosition,
        ).toHaveBeenCalledWith(screenLongTextManager.div, 123.4, true);

        capturedHighlightHandlers?.onSelectKey('GEN-1-1', true);
        expect(screenLongTextManager.selectedKJVVerseKey).toBe('GEN-1-1');
        expect(screenLongTextManager.isToTop).toBe(true);
        expect(
            screenLongTextManager.sendSyncSelectedIndex,
        ).toHaveBeenCalledOnce();
    });

    test('draws a long text row by row whatever the screen says, and its chip opens nothing', async () => {
        const { renderScreenLongTextManager } =
            await import('./screenBibleHelpers');
        const screenViewData = {
            type: 'long-text',
            locale: 'km-KH',
            longTextData: {
                sourceId: 'long-text',
                renderedList: ['KM', 'EN'].map((code) => {
                    return {
                        locale: code === 'KM' ? 'km-KH' : 'en-US',
                        code,
                        title: `${code} song`,
                        sections: [{ num: '1', text: code, key: 'lt-1' }],
                    };
                }),
            },
            scroll: 0.5,
            selectedKJVVerseKey: null,
        };
        const screenLongTextManager =
            createScreenLongTextManager(screenViewData);
        // This screen's own Line Sync is off; a long text is not asked.
        screenLongTextManager.isLineSync = false;

        await renderScreenLongTextManager(screenLongTextManager);

        expect(genHtmlFromLongTextColumnsMock).toHaveBeenCalledWith(
            screenViewData.longTextData.renderedList,
            { isLineSync: true, isLongText: true },
        );
        expect(genHtmlFromScreenViewBibleItemMock).not.toHaveBeenCalled();
        expect(screenLongTextManager.div.firstElementChild).not.toBeNull();
        expect(screenLongTextManager.div.style.pointerEvents).toBe('auto');
        expect(addPlayToBottomMock).toHaveBeenCalledWith(
            screenLongTextManager.div,
            expect.any(Function),
        );

        // The header chip is a language code: no Bible versions menu behind it.
        await capturedHighlightHandlers?.onBibleSelect(
            new MouseEvent('click'),
            0,
        );
        expect(genContextMenuBibleKeysMock).not.toHaveBeenCalled();
        expect(showAppContextMenuMock).not.toHaveBeenCalled();
        // A section is selected the way a verse is.
        capturedHighlightHandlers?.onSelectKey('lt-1', false);
        expect(screenLongTextManager.selectedKJVVerseKey).toBe('lt-1');
    });

    test('empties the layer for a kind it cannot draw instead of leaving the last one up', async () => {
        const { renderScreenLongTextManager } =
            await import('./screenBibleHelpers');
        const screenLongTextManager = createScreenLongTextManager({
            type: 'lyric',
            locale: 'en-US',
            scroll: 0,
            selectedKJVVerseKey: null,
        });
        // What the previous passage left in the layer.
        screenLongTextManager.div.appendChild(document.createElement('div'));

        await renderScreenLongTextManager(screenLongTextManager);

        expect(screenLongTextManager.div.children).toHaveLength(0);
        expect(screenLongTextManager.div.style.pointerEvents).toBe('none');
        expect(genHtmlFromScreenViewBibleItemMock).not.toHaveBeenCalled();
        expect(genHtmlFromLongTextColumnsMock).not.toHaveBeenCalled();
    });

    test('gives each Bible its own scaled scroller when they are not row by row', async () => {
        const { renderScreenLongTextManager } =
            await import('./screenBibleHelpers');
        // What `BibleBibleTableComp` draws for two Bibles without Line Sync.
        genHtmlFromScreenViewBibleItemMock.mockImplementation(async () => {
            const root = document.createElement('div');
            root.className = 'screen-bible-columns';
            root.innerHTML =
                '<style></style>' +
                [0, 1]
                    .map((index) => {
                        return (
                            `<div class="screen-bible-column screen-bible-column-${index}"` +
                            ` data-column-index="${index}"><table></table></div>`
                        );
                    })
                    .join('');
            return root;
        });
        const screenViewData = {
            type: 'bible-item',
            locale: 'en-US',
            bibleItemData: {
                renderedList: [
                    { locale: 'en-US', bibleKey: 'KJV', title: '', verses: [] },
                    { locale: 'en-US', bibleKey: 'NIV', title: '', verses: [] },
                ],
                bibleItem: createBibleItemJson(),
            },
            scroll: 0,
            selectedKJVVerseKey: null,
        };
        const screenLongTextManager =
            createScreenLongTextManager(screenViewData);
        screenLongTextManager.isLineSync = false;
        screenLongTextManager.sendSyncScrollPercentage = vi.fn();
        screenLongTextManager.sendAutoScrollPosition = vi.fn();

        await renderScreenLongTextManager(screenLongTextManager);

        const { div } = screenLongTextManager;
        // The columns go in as they are: the div itself scrolls nothing.
        const root = div.firstElementChild as HTMLElement;
        expect(root.className).toBe('screen-bible-columns');
        const columns = Array.from(
            root.querySelectorAll<HTMLElement>('.screen-bible-column'),
        );
        expect(columns).toHaveLength(2);
        for (const column of columns) {
            // Half the 1280px box each, laid out at half the 640px display.
            const container = column.firstElementChild as HTMLElement;
            expect(container.style.width).toBe('640px');
            expect(container.style.transform).toContain('scale(2,2)');
            const scaled = container.firstElementChild as HTMLElement;
            expect(scaled.style.width).toBe('320px');
            expect(scaled.firstElementChild?.tagName).toBe('TABLE');
        }
        // One column hosts the screen's buttons and its auto-scroll.
        const [host] = columns;
        expect(addToTheTopMock).toHaveBeenCalledWith(host);
        expect(addPlayToBottomMock).toHaveBeenCalledWith(
            host,
            expect.any(Function),
        );
        addPlayToBottomMock.mock.calls[0][1](12.5, true);
        expect(
            screenLongTextManager.sendAutoScrollPosition,
        ).toHaveBeenCalledWith(host, 12.5, true);
        // The host leads until a hand says otherwise, and is sent by name.
        host.dispatchEvent(new Event('scroll'));
        expect(
            screenLongTextManager.sendSyncScrollPercentage,
        ).toHaveBeenCalledWith(
            '.screen-bible-column-0',
            expect.any(Object),
            false,
        );
        // The other column's scrolls are the follower's own: never sent.
        columns[1].dispatchEvent(new Event('scroll'));
        expect(
            screenLongTextManager.sendSyncScrollPercentage,
        ).toHaveBeenCalledTimes(1);

        // Line Sync, or a single Bible, goes back to the one scroller.
        genHtmlFromScreenViewBibleItemMock.mockImplementation(async () => {
            const table = document.createElement('div');
            table.append(document.createElement('table'));
            return table;
        });
        addToTheTopMock.mockClear();
        await renderScreenLongTextManager(screenLongTextManager);
        expect(addToTheTopMock).toHaveBeenCalledWith(div);
        expect(div.querySelectorAll('.screen-bible-column')).toHaveLength(0);
        // It answers for the columns another window may still be showing.
        expect(div.classList.contains('screen-bible-column-1')).toBe(true);
    });

    test('opens Bible menus and applies replacement and removal updates', async () => {
        const { renderScreenLongTextManager } =
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
        const screenLongTextManager =
            createScreenLongTextManager(screenViewData);

        await renderScreenLongTextManager(screenLongTextManager);
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
            screenLongTextManager.screenViewData.bibleItemData.renderedList.map(
                ({ bibleKey }: any) => bibleKey,
            ),
        ).toEqual(['ESV', 'NIV']);

        await menuItems[0]?.onSelect();
        await waitForAsyncUpdate();
        expect(
            screenLongTextManager.screenViewData.bibleItemData.renderedList.map(
                ({ bibleKey }: any) => bibleKey,
            ),
        ).toEqual(['NIV']);
    });

    test('skips empty menu states and alerts when Bible item data is missing', async () => {
        const { renderScreenLongTextManager } =
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
        const screenLongTextManager =
            createScreenLongTextManager(invalidViewData);

        await renderScreenLongTextManager(screenLongTextManager);

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
