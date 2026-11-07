// @vitest-environment jsdom

/**
 * The Find panel's components, driven through their DOM: the result list, its
 * chunk footer, one found verse, the body that runs a find, the previewer that
 * builds the controller, the tab picker and the book filter bar. The pure
 * paging helpers in `bibleFindHelpers` run for real; the controller, the
 * context menu and everything that leaves the panel are this file's own mocks.
 */

import type { ReactNode } from 'react';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const realSetImmediate = globalThis.setImmediate.bind(globalThis);

const h = vi.hoisted(() => ({
    settings: {} as Record<string, string>,
    selectedBibleKey: 'KJV',
    viewController: {} as any,
    lastFindHeaderProps: null as any,
    lastKeySelectionProps: null as any,
    findingContext: {
        bibleKey: null as string | null,
        findingText: null as string | null,
    },
    reload: vi.fn(),
    handleError: vi.fn(),
    showSimpleToast: vi.fn(),
    showAppContextMenu: vi.fn(),
    showAppConfirm: vi.fn(),
    genBookMatches: vi.fn(),
    openChatbotAsking: vi.fn(),
    genVerseFindAsk: vi.fn(),
    bringDomToTopView: vi.fn(),
    pressElementLikeButton: vi.fn(),
    handleDragStart: vi.fn(),
    openBibleItemDetailPanel: vi.fn(),
    saveBibleItem: vi.fn(),
    setSetting: vi.fn(),
    getInstant: vi.fn(),
    resetSearchingDatabase: vi.fn(),
    getLangDataAsync: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        reload: h.reload,
    },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../helper/loggerHelpers', () => ({
    appError: () => {},
    appWarning: () => {},
    appLog: () => {},
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    tran: (text: string) => text,
    getLangDataAsync: h.getLangDataAsync,
    quickTrimText: (_locale: string, text: string) => text.trim(),
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromJson: (json: any) => ({ ...json, isFakeBibleItem: true }),
    },
}));
vi.mock('../bible-list/bibleItemHelpers', () => ({
    genBibleItemCopyContextMenuItem: () => ({ menuElement: 'Copy' }),
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    saveBibleItem: h.saveBibleItem,
    useBibleKeyContext: () => h.selectedBibleKey,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    toVerseFullKeyFormat: (book: string, chapter: string, verse: string) => {
        return `${book} ${chapter}:${verse}`;
    },
    checkIsOldTestament: (bookKey: string) => {
        return ['GEN', 'EXO'].includes(bookKey);
    },
}));
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        setSetting: h.setSetting,
        useStateSettingString: (name: string, defaultValue: string) => {
            const [value, setValue] = useState(
                h.settings[name] || defaultValue,
            );
            return [
                value,
                (newValue: string) => {
                    h.settings[name] = newValue;
                    setValue(newValue);
                },
            ];
        },
    };
});
vi.mock('../location-name-lookup/detailPanelHelpers', () => ({
    openBibleItemDetailPanel: h.openBibleItemDetailPanel,
}));
vi.mock('../helper/ai/bibleItemChatbotMenuHelpers', () => ({
    genOpenInChatbotContextMenu: () => [{ menuElement: 'Open in Chatbot' }],
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    genBookMatches: h.genBookMatches,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirm,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey}-font`,
}));
vi.mock('../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotAsking: h.openChatbotAsking,
}));
vi.mock('../helper/ai/verseFindAskHelpers', () => ({
    genVerseFindAsk: h.genVerseFindAsk,
}));
vi.mock('../helper/helpers', () => ({
    bringDomToTopView: h.bringDomToTopView,
    pressElementLikeButton: h.pressElementLikeButton,
}));
vi.mock('../helper/dragHelpers', () => ({
    handleDragStart: h.handleDragStart,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => h.viewController,
}));
vi.mock('../bible-reader/view-extra/BibleDirectViewTitleComp', () => ({
    BibleDirectViewTitleComp: ({ bibleItem }: any) => {
        const { bookKey, chapter, verseStart } = bibleItem.target;
        return (
            <span className="ut-title">{`${bookKey} ${chapter}:${verseStart}`}</span>
        );
    },
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="ut-loading">loading</div>,
}));
vi.mock('../scrolling/ScrollingHandlerComp', () => ({
    default: () => <div className="ut-scrolling" />,
}));
vi.mock('../others/TabRenderComp', async () => {
    const { Suspense } = await import('react');
    return {
        genTabBody: (selectedTab: string, [tab, Element]: [string, any]) => {
            return (
                <Suspense
                    key={`tab-${tab}`}
                    fallback={<div className="ut-suspense" />}
                >
                    {selectedTab === tab ? <Element /> : null}
                </Suspense>
            );
        },
    };
});
vi.mock('./BibleCrossReferencePreviewerComp', () => ({
    default: () => <div className="ut-tab-c">cross reference tab</div>,
}));
vi.mock('./BibleLocationNamePreviewerComp', () => ({
    default: () => <div className="ut-tab-l">location tab</div>,
}));
vi.mock('../resources/ResourcesPreviewerComp', () => ({
    default: () => <div className="ut-tab-r">resources tab</div>,
}));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    default: (props: any) => {
        h.lastKeySelectionProps = props;
        return (
            <button
                className="ut-key-selection"
                onClick={() => {
                    props.onBibleKeyChange(props.bibleKey, 'NIV');
                }}
            >
                {props.bibleKey}
            </button>
        );
    },
}));
vi.mock('./BibleFindHeaderComp', () => ({
    default: (props: any) => {
        h.lastFindHeaderProps = props;
        return <div className="ut-find-header" />;
    },
}));
vi.mock('./BibleFindController', async () => {
    const { createContext, use } = await import('react');
    const BibleFindControllerContext = createContext<any>(null);
    class FakeBibleFindController {
        static readonly findingContext = h.findingContext;
        static getInstant(bibleKey: string) {
            return h.getInstant(bibleKey);
        }
        static resetSearchingDatabase(bibleKey: string) {
            return h.resetSearchingDatabase(bibleKey);
        }
    }
    return {
        default: FakeBibleFindController,
        BibleFindControllerContext,
        useBibleFindController: () => {
            const context = use(BibleFindControllerContext);
            if (context === null) {
                throw new Error(
                    'useBibleFindController must be used within ' +
                        'BibleFindControllerContext',
                );
            }
            return context;
        },
    };
});

import { BibleFindControllerContext } from './BibleFindController';
import { ShowFindingComp } from './ShowFindingComp';
import RenderPageNumberComp from './RenderPageNumberComp';
import BibleFindRenderPerPageComp from './BibleFindRenderPerPageComp';
import RenderFoundItemComp from './RenderFoundItemComp';
import BibleFindRenderDataComp from './BibleFindRenderDataComp';
import BibleFindBodyComp from './BibleFindBodyComp';
import BibleFindBodyPreviewerComp from './BibleFindBodyPreviewerComp';
import BibleFindPreviewerComp from './BibleFindPreviewerComp';
import RenderFindingInfoHeaderComp from './RenderFindingInfoHeaderComp';
import { setBibleSearchingTabType } from './bibleFindHelpers';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function flush(times = 4) {
    for (let i = 0; i < times; i++) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
            await new Promise((resolve) => {
                realSetImmediate(resolve);
            });
        });
    }
}

async function render(node: ReactNode) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(node);
    });
    await flush();
}

async function rerender(node: ReactNode) {
    await act(async () => {
        root!.render(node);
    });
    await flush();
}

async function unmount() {
    if (root !== null) {
        const oldRoot = root;
        root = null;
        await act(async () => {
            oldRoot.unmount();
        });
    }
}

async function press(element: Element | null | undefined) {
    expect(element).toBeTruthy();
    await act(async () => {
        (element as HTMLElement).click();
    });
    await flush();
}

function query(selector: string) {
    return container!.querySelector(selector);
}

function queryAll(selector: string) {
    return [...container!.querySelectorAll(selector)];
}

function findButtonByText(text: string) {
    return queryAll('button').find((button) => {
        return button.textContent === text;
    }) as HTMLButtonElement | undefined;
}

function genDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((resolver) => {
        resolve = resolver;
    });
    return { promise, resolve };
}

function genController(bibleKey = 'KJV') {
    return {
        bibleKey,
        locale: 'en-US',
        selectedBookKeys: [] as string[],
        getSelectedBooks: vi.fn(async () => [] as any[]),
        doFinding: vi.fn(async (_findData: any) => null as any),
    };
}

function genResult(maxLineNumber: number, from: number, verses: string[]) {
    return {
        maxLineNumber,
        fromLineNumber: from,
        toLineNumber: from + 19,
        content: verses.map((text, index) => {
            return { text, uniqueKey: `${from}-${index}` };
        }),
    };
}

function lastMenuItems() {
    const { calls } = h.showAppContextMenu.mock;
    return calls[calls.length - 1][1] as any[];
}

function findMenuItem(items: any[], label: string) {
    return items.find((item) => {
        return item.menuElement === label;
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    h.settings = {};
    h.selectedBibleKey = 'KJV';
    h.lastFindHeaderProps = null;
    h.lastKeySelectionProps = null;
    h.findingContext.bibleKey = null;
    h.findingContext.findingText = null;
    h.viewController = {
        appendBibleItem: vi.fn(),
        setLookupContentFromBibleItem: vi.fn(),
        openBibleSearch: null,
    };
    h.getLangDataAsync.mockResolvedValue({
        sanitizeFindingText: (text: string) => text.toLowerCase(),
    });
    h.openBibleItemDetailPanel.mockResolvedValue(undefined);
    h.openChatbotAsking.mockResolvedValue(undefined);
    h.genVerseFindAsk.mockImplementation(
        (bibleKey: string, findText: string) => {
            return `ask:${bibleKey}:${findText}`;
        },
    );
    h.getInstant.mockResolvedValue(null);
});

afterEach(async () => {
    await unmount();
    container?.remove();
    container = null;
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('ShowFindingComp', () => {
    it('brings the loading row into view', async () => {
        await render(<ShowFindingComp />);
        const row = query('.d-flex.justify-content-center');
        expect(row?.querySelector('.ut-loading')).not.toBeNull();
        expect(h.bringDomToTopView).toHaveBeenCalledWith(row);
    });
});

describe('RenderPageNumberComp', () => {
    it('scrolls to a loaded chunk and fetches one that is not loaded', async () => {
        const handleFinding = vi.fn();
        const target = document.createElement('div');
        target.className = 'app-found-page-3';
        document.body.append(target);
        await render(
            <>
                <RenderPageNumberComp
                    pageNumber="3"
                    isLoaded
                    handleFinding={handleFinding}
                />
                <RenderPageNumberComp
                    pageNumber="4"
                    isLoaded={false}
                    handleFinding={handleFinding}
                />
                <RenderPageNumberComp
                    pageNumber="9"
                    isLoaded
                    handleFinding={handleFinding}
                />
            </>,
        );
        const [loaded, notLoaded, gone] = queryAll('button');
        expect(loaded.className).toBe('app-find-page is-loaded');
        expect(loaded.getAttribute('title')).toBe('Go to results');
        expect(notLoaded.className).toBe('app-find-page');
        expect(notLoaded.getAttribute('title')).toBe('Load more results');
        await press(loaded);
        expect(h.bringDomToTopView).toHaveBeenCalledWith(target);
        expect(handleFinding).not.toHaveBeenCalled();
        await press(notLoaded);
        expect(handleFinding).toHaveBeenCalledWith('4');
        // A loaded number whose chunk is not in the DOM scrolls nowhere.
        await press(gone);
        expect(h.bringDomToTopView).toHaveBeenCalledTimes(1);
        expect(handleFinding).toHaveBeenCalledTimes(1);
        target.remove();
    });
});

describe('BibleFindRenderPerPageComp', () => {
    it('labels the chunk with its range, lists it and scrolls to it a second later', async () => {
        const controller = genController();
        await render(
            <BibleFindControllerContext value={controller as any}>
                <BibleFindRenderPerPageComp
                    page="2"
                    fromNumber={21}
                    toNumber={40}
                    findText="loved"
                    bibleKey="KJV"
                    items={[
                        {
                            text: 'JHN.3:16:For God so loved the world',
                            uniqueKey: 'a',
                        },
                        { text: 'JHN.3:17:For God sent', uniqueKey: 'b' },
                    ]}
                />
            </BibleFindControllerContext>,
        );
        const divider = query('.app-find-chunk-divider');
        expect(divider?.className).toBe(
            'app-find-chunk-divider app-found-page-2',
        );
        expect(divider?.textContent).toBe('Results 21–40');
        expect(queryAll('.app-find-item')).toHaveLength(2);
        expect(h.bringDomToTopView).not.toHaveBeenCalledWith(divider);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(h.bringDomToTopView).toHaveBeenCalledWith(divider);
    });

    it('shows the finding row while its chunk is still loading', async () => {
        await render(
            <BibleFindRenderPerPageComp
                page="5"
                fromNumber={81}
                toNumber={100}
                findText="loved"
                bibleKey="KJV"
                items={undefined}
            />,
        );
        expect(query('.ut-loading')).not.toBeNull();
        expect(query('.app-find-chunk-divider')).toBeNull();
    });
});

describe('RenderFoundItemComp', () => {
    async function renderItem() {
        const controller = genController();
        await render(
            <BibleFindControllerContext value={controller as any}>
                <RenderFoundItemComp
                    findText="loved"
                    text="JHN.3:16:For God so loved the world"
                    bibleKey="KJV"
                />
            </BibleFindControllerContext>,
        );
        return query('.app-find-item') as HTMLElement;
    }

    const expectedBibleItem = {
        id: -1,
        metadata: {},
        bibleKey: 'KJV',
        target: { bookKey: 'JHN', chapter: 3, verseStart: 16, verseEnd: 16 },
        isFakeBibleItem: true,
    };

    it('says Loading until the verse is broken into its parts', async () => {
        const deferred = genDeferred<any>();
        h.getLangDataAsync.mockReturnValue(deferred.promise);
        await renderItem();
        expect(container!.textContent).toBe('Loading...');
        deferred.resolve({
            sanitizeFindingText: (text: string) => text.toLowerCase(),
        });
        await flush();
        expect(query('.app-find-item')).not.toBeNull();
    });

    it('renders the reference and the verse with the match marked, named by both', async () => {
        const row = await renderItem();
        expect(row.getAttribute('role')).toBe('button');
        expect(row.getAttribute('tabindex')).toBe('0');
        expect(row.getAttribute('title')).toBe('Click to open the verse');
        expect(row.getAttribute('draggable')).toBe('true');
        const [titleId, textId] = row
            .getAttribute('aria-labelledby')!
            .split(' ');
        expect(document.getElementById(titleId)?.textContent).toBe('JHN 3:16');
        const text = document.getElementById(textId) as HTMLElement;
        expect(text.className).toBe('app-find-text');
        expect(text.style.fontFamily).toBe('KJV-font');
        expect(text.innerHTML).toBe(
            'For God so <span class="app-found-match">loved</span> the world',
        );
    });

    it('opens the verse on a press and on Enter, but not for a key aimed at its menu button', async () => {
        const row = await renderItem();
        await press(row);
        expect(h.openBibleItemDetailPanel).toHaveBeenCalledWith(
            expectedBibleItem,
        );
        await act(async () => {
            row.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);
        const dots = row.querySelector('.app-context-menu-dots')!;
        await act(async () => {
            dots.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);
    });

    it('drags the verse it shows', async () => {
        const row = await renderItem();
        await act(async () => {
            row.dispatchEvent(new Event('dragstart', { bubbles: true }));
        });
        expect(h.handleDragStart).toHaveBeenCalledTimes(1);
        expect(h.handleDragStart.mock.calls[0][1]).toEqual(expectedBibleItem);
    });

    it('opens the row menu from a right-click and from its dots, whose items act on the verse', async () => {
        const row = await renderItem();
        await act(async () => {
            row.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        const items = lastMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            'Open',
            'Open in Chatbot',
            'Open beside the current verse',
            'Copy',
            'Save bible item',
        ]);
        findMenuItem(items, 'Open beside the current verse').onSelect();
        expect(h.viewController.appendBibleItem).toHaveBeenCalledWith(
            expectedBibleItem,
        );
        findMenuItem(items, 'Save bible item').onSelect();
        expect(h.saveBibleItem).toHaveBeenCalledWith(expectedBibleItem);
        findMenuItem(items, 'Open').onSelect();
        expect(h.openBibleItemDetailPanel).toHaveBeenCalledWith(
            expectedBibleItem,
        );

        await press(row.querySelector('.app-context-menu-dots'));
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(2);
        // The dots keep the press from also opening the verse behind them.
        expect(h.openBibleItemDetailPanel).toHaveBeenCalledTimes(1);
    });

    it('hands a failing detail panel to the error handler', async () => {
        const error = new Error('no panel');
        h.openBibleItemDetailPanel.mockRejectedValue(error);
        const row = await renderItem();
        await press(row);
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});

describe('BibleFindRenderDataComp', () => {
    const verses = [
        'JHN.3:16:For God so loved the world',
        'JHN.3:17:For God sent',
    ];

    function genData(pages: number, maxLineNumber: number) {
        const pageList = Array.from({ length: pages }, (_, index) => {
            return `${index + 1}`;
        });
        return {
            pagingData: { pages: pageList, currentPage: '1', perPage: 20 },
            foundData: Object.fromEntries(
                pageList.map((page) => [page, null]),
            ) as Record<string, any>,
            maxLineNumber,
        };
    }

    async function renderData(
        data: any,
        findText = 'loved',
        findFor = vi.fn(),
    ) {
        const node = (
            <BibleFindControllerContext value={genController() as any}>
                <BibleFindRenderDataComp
                    findText={findText}
                    data={data}
                    findFor={findFor}
                />
            </BibleFindControllerContext>
        );
        if (root === null) {
            await render(node);
        } else {
            await rerender(node);
        }
        return findFor;
    }

    it('shows the finding row, no data, and no verses', async () => {
        await renderData(undefined);
        expect(query('.ut-loading')).not.toBeNull();
        await renderData(null);
        expect(container!.textContent).toBe('No data available');
        await renderData({
            pagingData: { pages: [], currentPage: '0', perPage: 0 },
            foundData: {},
        });
        expect(container!.textContent).toBe('No verses found');
    });

    it('counts the verses, lists loaded chunks, marks loading ones and opens a gap', async () => {
        const data = genData(10, 195);
        data.foundData['1'] = genResult(195, 0, verses);
        data.foundData['2'] = undefined;
        const findFor = await renderData(data);
        expect(query('.app-find-count')?.textContent).toBe('195 verses found');
        expect(query('.app-find-pages')?.getAttribute('aria-label')).toBe(
            'Find',
        );
        expect(query('.app-find-chunk-divider')?.textContent).toBe(
            'Results 1–20',
        );
        expect(queryAll('.app-find-item')).toHaveLength(2);
        // Chunk 2 is on its way; the chunks never asked for draw nothing.
        expect(queryAll('.ut-loading')).toHaveLength(1);
        expect(query('.ut-scrolling')).not.toBeNull();
        const strip = () => {
            return queryAll('.app-find-pages button').map((button) => {
                return button.textContent;
            });
        };
        expect(strip()).toEqual(['1', '2', '3', '…', '10']);
        expect(query('.app-find-page.is-loaded')?.textContent).toBe('1');
        const gap = query('.app-find-page-gap') as HTMLElement;
        expect(gap.getAttribute('title')).toBe('Show pages 4–9');
        await press(gap);
        expect(strip()).toEqual([
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
            '10',
        ]);
        await press(findButtonByText('7'));
        expect(findFor).toHaveBeenCalledWith('7');

        // A new find is a new strip: the opened gap closes again.
        await renderData(data, 'world', findFor);
        expect(strip()).toEqual(['1', '2', '3', '…', '10']);
    });

    it('says verse for one match and nothing before any chunk has landed', async () => {
        const one = genData(1, 1);
        one.foundData['1'] = genResult(1, 0, [verses[0]]);
        await renderData(one);
        expect(query('.app-find-count')?.textContent).toBe('1 verse found');

        const pending = genData(2, 0);
        pending.foundData['1'] = undefined;
        await renderData(pending);
        expect(query('.app-find-count')?.textContent).toBe('');
        expect(queryAll('.ut-loading')).toHaveLength(1);
    });
});

describe('BibleFindBodyComp', () => {
    it('runs a find, loads a chunk on request, re-runs fresh and refilters by books', async () => {
        const controller = genController();
        controller.getSelectedBooks.mockResolvedValue([
            { bookKey: 'GEN', book: 'Genesis' },
        ]);
        controller.doFinding.mockResolvedValue(
            genResult(45, 0, ['JHN.3:16:For God so loved the world']),
        );
        const setBibleKey = vi.fn();
        await render(
            <BibleFindControllerContext value={controller as any}>
                <BibleFindBodyComp setBibleKey={setBibleKey} />
            </BibleFindControllerContext>,
        );
        expect(container!.textContent).toContain('No data available');
        expect(query('.app-find-filter')?.textContent).toBe('Genesis');
        expect(h.lastKeySelectionProps.bibleKey).toBe('KJV');
        await press(query('.ut-key-selection'));
        expect(setBibleKey).toHaveBeenCalledWith('KJV', 'NIV');

        await act(async () => {
            h.lastFindHeaderProps.handleFinding('loved');
        });
        await flush();
        expect(controller.doFinding).toHaveBeenCalledTimes(1);
        expect(controller.doFinding).toHaveBeenCalledWith({ text: 'loved' });
        expect(query('.app-find-count')?.textContent).toBe('45 verses found');
        expect(queryAll('.app-find-item')).toHaveLength(1);

        // The same words again without asking for fresh results do nothing.
        await act(async () => {
            h.lastFindHeaderProps.handleFinding('loved');
        });
        await flush();
        expect(controller.doFinding).toHaveBeenCalledTimes(1);

        const pageTwo = genDeferred<any>();
        controller.doFinding.mockReturnValueOnce(pageTwo.promise);
        await press(findButtonByText('2'));
        expect(controller.doFinding).toHaveBeenCalledTimes(2);
        expect(controller.doFinding.mock.calls[1][0].text).toBe('loved');
        expect(queryAll('.ut-loading')).toHaveLength(1);
        // Pressed again while it loads: the chunk is already on its way.
        await press(findButtonByText('2'));
        expect(controller.doFinding).toHaveBeenCalledTimes(2);
        pageTwo.resolve(genResult(45, 20, ['JHN.3:17:For God sent']));
        await flush();
        expect(
            queryAll('.app-find-chunk-divider').map((d) => d.textContent),
        ).toEqual(['Results 1–20', 'Results 21–40']);
        expect(queryAll('.app-find-item')).toHaveLength(2);

        await act(async () => {
            h.lastFindHeaderProps.handleFinding('loved', true);
        });
        await flush();
        expect(controller.doFinding).toHaveBeenCalledTimes(3);
        expect(controller.doFinding.mock.calls[2][0]).toEqual({
            text: 'loved',
        });
        expect(queryAll('.app-find-chunk-divider')).toHaveLength(1);

        h.genBookMatches.mockResolvedValue([
            {
                bibleKey: 'KJV',
                bookKey: 'EXO',
                book: 'Exodus',
                modelBook: 'Exodus',
                isAvailable: true,
            },
        ]);
        await press(query('.app-find-filter'));
        const exodus = lastMenuItems().find((item) => {
            return item.menuElement?.props?.children === 'Exodus';
        });
        await act(async () => {
            exodus.onSelect({ shiftKey: true });
        });
        await flush();
        expect(controller.selectedBookKeys).toEqual(['GEN', 'EXO']);
        expect(query('.app-find-filter')?.textContent).toBe('Genesis, Exodus');
        // A new set of books is a new find.
        expect(controller.doFinding).toHaveBeenCalledTimes(4);

        await press(query('.app-find-filter'));
        await act(async () => {
            findMenuItem(lastMenuItems(), 'All Books').onSelect();
        });
        await flush();
        expect(controller.selectedBookKeys).toEqual([]);
        expect(query('.app-find-filter')?.textContent).toBe('All Books');
        expect(controller.doFinding).toHaveBeenCalledTimes(5);
    });

    it('drops the results when the find no longer answers', async () => {
        const controller = genController();
        controller.doFinding.mockResolvedValueOnce(
            genResult(45, 0, ['JHN.3:16:For God so loved the world']),
        );
        await render(
            <BibleFindControllerContext value={controller as any}>
                <BibleFindBodyComp setBibleKey={vi.fn()} />
            </BibleFindControllerContext>,
        );
        await act(async () => {
            h.lastFindHeaderProps.handleFinding('loved');
        });
        await flush();
        expect(queryAll('.app-find-item')).toHaveLength(1);
        controller.doFinding.mockResolvedValueOnce(null);
        await press(findButtonByText('3'));
        expect(container!.textContent).toContain('No data available');
    });
});

describe('BibleFindBodyPreviewerComp', () => {
    it('takes the Bible and words it was opened for, then builds that controller', async () => {
        h.findingContext.bibleKey = 'ESV';
        h.findingContext.findingText = 'grace';
        const deferred = genDeferred<any>();
        h.getInstant.mockReturnValueOnce(deferred.promise);
        await render(<BibleFindBodyPreviewerComp />);
        expect(h.findingContext.bibleKey).toBeNull();
        expect(query('.ut-loading')).not.toBeNull();
        expect(h.getInstant).toHaveBeenCalledWith('ESV');
        deferred.resolve(genController('ESV'));
        await flush();
        expect(h.findingContext.findingText).toBeNull();
        expect(query('.ut-key-selection')?.textContent).toBe('ESV');

        h.getInstant.mockResolvedValueOnce(genController('NIV'));
        await press(query('.ut-key-selection'));
        expect(h.getInstant).toHaveBeenLastCalledWith('NIV');
        expect(query('.ut-key-selection')?.textContent).toBe('NIV');
    });

    it('offers a reload when no controller can be built', async () => {
        h.getInstant.mockResolvedValue(null);
        await render(<BibleFindBodyPreviewerComp />);
        expect(h.getInstant).toHaveBeenCalledWith('KJV');
        expect(container!.textContent).toContain(
            'Fail to get find controller!',
        );
        h.getInstant.mockResolvedValue(genController('KJV'));
        await press(findButtonByText('Reload'));
        expect(h.getInstant).toHaveBeenCalledTimes(2);
        expect(query('.ut-key-selection')?.textContent).toBe('KJV');
    });

    it('builds nothing for an unknown Bible', async () => {
        h.selectedBibleKey = 'Unknown';
        await render(<BibleFindBodyPreviewerComp />);
        expect(h.getInstant).not.toHaveBeenCalled();
        expect(query('.ut-loading')).not.toBeNull();
    });
});

describe('BibleFindPreviewerComp', () => {
    it('opens on Find, follows the controller and the picker, and hands the slot back', async () => {
        await render(<BibleFindPreviewerComp />);
        const select = query('select') as HTMLSelectElement;
        expect(select.value).toBe('s');
        expect(select.title).toBe('Find');
        expect(select.getAttribute('aria-label')).toBe('Bible Online Lookup');
        expect(queryAll('option').map((option) => option.textContent)).toEqual([
            'Find',
            'Cross Reference',
            'Location-Name (KJV)',
            'Resources',
        ]);
        expect(query('.card-header i')?.className).toBe('bi bi-search pe-1');
        expect(container!.textContent).toContain(
            'Fail to get find controller!',
        );

        await act(async () => {
            h.viewController.openBibleSearch('c');
        });
        await flush();
        expect(query('.ut-tab-c')).not.toBeNull();
        expect(select.title).toBe('Cross Reference');
        expect(query('.card-header i')?.className).toBe(
            'bi bi-signpost-split pe-1',
        );

        await act(async () => {
            select.value = 'l';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await flush();
        expect(query('.ut-tab-l')).not.toBeNull();
        expect(query('.ut-tab-c')).toBeNull();
        expect(h.settings['bible-search-tab']).toBe('l');

        await unmount();
        expect(h.viewController.openBibleSearch).toBe(setBibleSearchingTabType);
        h.viewController.openBibleSearch('r');
        expect(h.setSetting).toHaveBeenCalledWith('bible-search-tab', 'r');
    });

    it('opens the stored tab and falls back to the Find label for an unknown one', async () => {
        h.settings['bible-search-tab'] = 'r';
        await render(<BibleFindPreviewerComp />);
        expect(query('.ut-tab-r')).not.toBeNull();
        await unmount();
        container!.remove();

        h.settings['bible-search-tab'] = 'zz';
        await render(<BibleFindPreviewerComp />);
        const select = query('select') as HTMLSelectElement;
        expect(select.title).toBe('Find');
        expect(query('.card-header i')?.className).toBe('bi bi-search pe-1');
        expect(query('[class^="ut-tab-"]')).toBeNull();
        expect(container!.textContent).not.toContain('Fail to get');
    });
});

describe('RenderFindingInfoHeaderComp', () => {
    const books = [
        {
            bibleKey: 'KJV',
            bookKey: 'GEN',
            book: 'Genesis',
            modelBook: 'Genesis',
            isAvailable: true,
        },
        {
            bibleKey: 'KJV',
            bookKey: 'EXO',
            book: 'Exodus',
            modelBook: 'Exodus',
            isAvailable: false,
        },
        {
            bibleKey: 'KJV',
            bookKey: 'JHN',
            book: 'Yohan',
            modelBook: 'John',
            isAvailable: true,
        },
    ];

    async function renderHeader(
        selectedBooks: { bookKey: string; book: string }[],
        setSelectedBooks = vi.fn(),
        findText?: string,
    ) {
        const node = (
            <RenderFindingInfoHeaderComp
                bibleKey="KJV"
                selectedBooks={selectedBooks}
                setSelectedBooks={setSelectedBooks}
                findText={findText}
            />
        );
        if (root === null) {
            await render(node);
        } else {
            await rerender(node);
        }
        return setSelectedBooks;
    }

    it('lists the books by testament and selects one, a testament or all', async () => {
        h.genBookMatches.mockResolvedValue(books);
        const setSelectedBooks = await renderHeader([]);
        const filter = query('.app-find-filter') as HTMLElement;
        expect(filter.className).toBe('app-find-filter app-ellipsis');
        expect(filter.querySelector('.bi-funnel-fill')).toBeNull();
        expect(filter.getAttribute('title')).toBe('All Books');
        expect(
            (filter.querySelector('span') as HTMLElement).style.fontFamily,
        ).toBe('KJV-font');
        await press(filter);
        expect(h.genBookMatches).toHaveBeenCalledWith('KJV');
        const items = lastMenuItems();
        expect(items).toHaveLength(6);
        expect(items[0].menuElement).toBe('All Books');
        expect(items[1].menuElement.props.children).toBe('Old Testament');
        expect(items[2].menuElement.props).toEqual({
            'data-bible-key-ff': 'KJV',
            children: 'Genesis',
        });
        expect(items[3].disabled).toBe(true);
        expect(items[4].menuElement.props.children).toBe('New Testament');
        expect(items[5].menuElement.props.children).toBe('Yohan (John)');
        expect([items[2].disabled, items[5].disabled]).toEqual([false, false]);

        items[0].onSelect();
        expect(setSelectedBooks).toHaveBeenLastCalledWith([]);
        items[1].onSelect();
        expect(setSelectedBooks).toHaveBeenLastCalledWith([books[0], books[1]]);
        items[4].onSelect();
        expect(setSelectedBooks).toHaveBeenLastCalledWith([books[2]]);
        items[2].onSelect({ shiftKey: false });
        expect(setSelectedBooks).toHaveBeenLastCalledWith([
            { bookKey: 'GEN', book: 'Genesis' },
        ]);
        items[5].onSelect({ shiftKey: true });
        expect(setSelectedBooks).toHaveBeenLastCalledWith([
            { bookKey: 'JHN', book: 'Yohan' },
        ]);
    });

    it('shows the filter that is on and adds a book with Shift', async () => {
        h.genBookMatches.mockResolvedValue(books);
        const genesis = { bookKey: 'GEN', book: 'Genesis' };
        const setSelectedBooks = await renderHeader([genesis]);
        const filter = query('.app-find-filter') as HTMLElement;
        expect(filter.className).toBe(
            'app-find-filter app-ellipsis is-filtered',
        );
        expect(filter.querySelector('.bi-funnel-fill')).not.toBeNull();
        expect(filter.textContent).toBe('Genesis');
        await press(filter);
        const items = lastMenuItems();
        expect(items[1].menuElement).toBe('Shift + Click to select multiple');
        // The one book already chosen cannot be chosen again on its own.
        expect(items[3].disabled).toBe(true);
        items[6].onSelect({ shiftKey: true });
        expect(setSelectedBooks).toHaveBeenLastCalledWith([
            genesis,
            { bookKey: 'JHN', book: 'Yohan' },
        ]);

        await renderHeader([genesis, { bookKey: 'JHN', book: 'John' }]);
        expect(query('.app-find-filter')?.textContent).toBe('Genesis, John');
    });

    it('says so when the book list cannot be read', async () => {
        h.genBookMatches.mockResolvedValue(null);
        await renderHeader([]);
        await press(query('.app-find-filter'));
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Getting bible list',
            'Fail to get bible list',
        );
        expect(h.showAppContextMenu).not.toHaveBeenCalled();
    });

    it('resets the search data only once confirmed, reloading on success', async () => {
        const setSelectedBooks = await renderHeader([]);
        const moreOptions = queryAll('button').find((button) => {
            return button.getAttribute('aria-label') === 'More Options';
        });
        await press(moreOptions);
        let items = lastMenuItems();
        expect(items[0].menuElement.props.children).toBe('Reset Search Data');
        expect(items[1].menuElement).toBe('Reset Selected Books');
        expect(items[1].disabled).toBe(true);
        items[1].onSelect();
        expect(setSelectedBooks).toHaveBeenCalledWith([]);

        h.showAppConfirm.mockResolvedValueOnce(false);
        await items[0].onSelect();
        expect(h.showAppConfirm).toHaveBeenCalledWith(
            'Reset Search Data',
            'Are you sure to reset search data? This will take a moment ' +
                'to restore',
        );
        expect(h.resetSearchingDatabase).not.toHaveBeenCalled();

        h.showAppConfirm.mockResolvedValueOnce(true);
        h.resetSearchingDatabase.mockResolvedValueOnce(true);
        await items[0].onSelect();
        expect(h.resetSearchingDatabase).toHaveBeenCalledWith('KJV');
        expect(h.reload).toHaveBeenCalledTimes(1);

        h.showAppConfirm.mockResolvedValueOnce(true);
        h.resetSearchingDatabase.mockResolvedValueOnce(false);
        await items[0].onSelect();
        expect(h.reload).toHaveBeenCalledTimes(1);
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Reset Search Data',
            'Fail to reset search data, please try again',
        );

        await renderHeader([{ bookKey: 'GEN', book: 'Genesis' }]);
        await press(moreOptions);
        items = lastMenuItems();
        expect(items[1].disabled).toBe(false);
    });

    it('asks the assistant for this Bible and the words typed in Find', async () => {
        await renderHeader([], vi.fn(), 'shepherd');
        const assistant = queryAll('button').find((button) => {
            return (
                button.getAttribute('aria-label') ===
                'Find a Verse with the Assistant'
            );
        });
        expect(assistant?.getAttribute('title')).toBe(
            'Find a Verse with the Assistant',
        );
        await press(assistant);
        expect(h.genVerseFindAsk).toHaveBeenCalledWith('KJV', 'shepherd');
        expect(h.openChatbotAsking).toHaveBeenCalledWith('ask:KJV:shepherd');

        await renderHeader([]);
        await press(assistant);
        expect(h.genVerseFindAsk).toHaveBeenLastCalledWith('KJV', '');
    });
});
