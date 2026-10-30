// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

const h = vi.hoisted(() => ({
    bringDomToTopView: vi.fn(),
}));

vi.mock('./BibleFindController', () => ({
    useBibleFindController: () => ({ bibleKey: 'KJV' }),
}));
vi.mock('./RenderFoundItemComp', () => ({
    default: ({
        findText,
        text,
        bibleKey,
    }: {
        findText: string;
        text: string;
        bibleKey: string;
    }) => (
        <div className="found-item" data-find={findText} data-bible={bibleKey}>
            {text}
        </div>
    ),
}));
vi.mock('../scrolling/ScrollingHandlerComp', () => ({
    default: () => <div className="scrolling-handler" />,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="loading">Loading</div>,
}));
vi.mock('../helper/helpers', () => ({
    bringDomToTopView: h.bringDomToTopView,
}));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getLangDataAsync: vi.fn(),
    quickTrimText: (_locale: string, text: string) => text,
    tran: (key: string) => key,
}));
// What `bibleFindHelpers` reaches beyond the paging arithmetic this view
// uses; none of it runs here.
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../helper/loggerHelpers', () => ({ appError: vi.fn() }));
vi.mock('../bible-list/BibleItem', () => ({ default: {} }));
vi.mock('../bible-list/bibleItemHelpers', () => ({
    genBibleItemCopyingContextMenu: vi.fn(),
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));
vi.mock('../bible-list/bibleHelpers', () => ({ saveBibleItem: vi.fn() }));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: vi.fn(),
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    toVerseFullKeyFormat: vi.fn(),
}));
vi.mock('../helper/settingHelpers', () => ({ setSetting: vi.fn() }));
vi.mock('../location-name-lookup/detailPanelHelpers', () => ({
    openBibleItemDetailPanel: vi.fn(),
}));
vi.mock('../helper/ai/bibleItemChatbotMenuHelpers', () => ({
    genOpenInChatbotContextMenu: vi.fn(),
}));

import BibleFindRenderDataComp from './BibleFindRenderDataComp';
import type { BibleFindResultType, FindDataType } from './bibleFindHelpers';

let host: HTMLDivElement;
let root: Root;
let findFor: Mock<(page: string) => void>;

function genChunk(
    page: number,
    perPage: number,
    maxLineNumber: number,
    texts: string[],
): BibleFindResultType {
    return {
        maxLineNumber,
        fromLineNumber: (page - 1) * perPage,
        toLineNumber: page * perPage - 1,
        content: texts.map((text, i) => ({ text, uniqueKey: `${page}-${i}` })),
    };
}

function genData(
    pageCount: number,
    foundData: FindDataType['foundData'],
    currentPage = '1',
): FindDataType {
    const pages = Array.from({ length: pageCount }, (_, i) => `${i + 1}`);
    return {
        pagingData: { pages, currentPage, perPage: 20 },
        foundData: {
            ...Object.fromEntries(pages.map((page) => [page, null])),
            ...foundData,
        },
    };
}

async function renderData(
    data: FindDataType | null | undefined,
    findText = 'grace',
) {
    await act(async () => {
        root.render(
            <BibleFindRenderDataComp
                findText={findText}
                data={data}
                findFor={findFor}
            />,
        );
    });
}

function getPageButtons() {
    return [...host.querySelectorAll<HTMLButtonElement>('nav button')];
}

function getPageButton(text: string) {
    return getPageButtons().find((button) => button.textContent === text)!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    findFor = vi.fn<(page: string) => void>();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('Find results', () => {
    test('a find still running shows the spinner, scrolled into view', async () => {
        await renderData(undefined);
        const loading = host.querySelector('.loading')!;
        expect(loading).not.toBeNull();
        expect(h.bringDomToTopView).toHaveBeenCalledWith(loading.parentElement);
        expect(host.querySelector('nav')).toBeNull();
    });

    test('no find, and a find that matched nothing, say which', async () => {
        await renderData(null);
        expect(host.textContent).toBe('No data available');
        await renderData(genData(0, {}));
        expect(host.textContent).toBe('No verses found');
    });

    test('loaded chunks are listed under their range, a requested one spins, the rest wait', async () => {
        await renderData(
            genData(4, {
                '1': genChunk(1, 20, 74, ['GEN.1:1:In the beginning']),
                '2': undefined,
            }),
        );
        const dividers = host.querySelectorAll('.app-find-chunk-divider');
        expect(dividers).toHaveLength(1);
        expect(dividers[0].classList.contains('app-found-page-1')).toBe(true);
        expect(dividers[0].textContent).toBe('Results 1–20');
        const items = host.querySelectorAll<HTMLElement>('.found-item');
        expect(items).toHaveLength(1);
        expect(items[0].textContent).toBe('GEN.1:1:In the beginning');
        expect(items[0].dataset.find).toBe('grace');
        expect(items[0].dataset.bible).toBe('KJV');
        // Chunk 2 has been asked for; 3 and 4 have not.
        expect(
            host.querySelectorAll('.app-find-results .loading'),
        ).toHaveLength(1);
        expect(
            host.querySelector('.app-find-results .scrolling-handler'),
        ).not.toBeNull();
    });

    test('the footer counts the verses and offers every chunk of a short find', async () => {
        await renderData(
            genData(4, {
                '1': genChunk(1, 20, 74, ['GEN.1:1:In the beginning']),
            }),
        );
        expect(host.querySelector('.app-find-count')!.textContent).toBe(
            '74 verses found',
        );
        expect(host.querySelector('nav')!.getAttribute('aria-label')).toBe(
            'Find',
        );
        expect(getPageButtons().map((button) => button.textContent)).toEqual([
            '1',
            '2',
            '3',
            '4',
        ]);
        expect(getPageButton('1').classList.contains('is-loaded')).toBe(true);
        expect(getPageButton('1').title).toBe('Go to results');
        expect(getPageButton('3').classList.contains('is-loaded')).toBe(false);
        expect(getPageButton('3').title).toBe('Load more results');
    });

    test('a chunk not loaded is fetched; a loaded one is scrolled to', async () => {
        await renderData(
            genData(4, {
                '1': genChunk(1, 20, 74, ['GEN.1:1:In the beginning']),
            }),
        );
        await act(async () => getPageButton('3').click());
        expect(findFor).toHaveBeenCalledWith('3');
        h.bringDomToTopView.mockClear();
        await act(async () => getPageButton('1').click());
        expect(findFor).toHaveBeenCalledTimes(1);
        expect(h.bringDomToTopView).toHaveBeenCalledWith(
            host.querySelector('.app-found-page-1'),
        );
    });

    test('one verse is counted in the singular, and nothing is counted before a chunk lands', async () => {
        await renderData(
            genData(1, { '1': genChunk(1, 20, 1, ['JHN.11:35:Jesus wept.']) }),
        );
        expect(host.querySelector('.app-find-count')!.textContent).toBe(
            '1 verse found',
        );
        await renderData(genData(2, { '1': undefined }));
        expect(host.querySelector('.app-find-count')!.textContent).toBe('');
    });

    test('a long find hides the middle chunks behind a gap that opens', async () => {
        await renderData(
            genData(30, {
                '1': genChunk(1, 20, 600, ['GEN.1:1:In the beginning']),
            }),
        );
        expect(getPageButtons().map((button) => button.textContent)).toEqual([
            '1',
            '2',
            '3',
            '…',
            '30',
        ]);
        const gap =
            host.querySelector<HTMLButtonElement>('.app-find-page-gap')!;
        expect(gap.title).toBe('Show pages 4–29');
        await act(async () => gap.click());
        expect(host.querySelector('.app-find-page-gap')).toBeNull();
        expect(getPageButtons()).toHaveLength(30);
        expect(getPageButton('17').title).toBe('Load more results');
    });

    test('a new find closes the gaps opened on the old one', async () => {
        const data = genData(30, {
            '1': genChunk(1, 20, 600, ['GEN.1:1:In the beginning']),
        });
        await renderData(data, 'grace');
        await act(async () =>
            host
                .querySelector<HTMLButtonElement>('.app-find-page-gap')!
                .click(),
        );
        expect(getPageButtons()).toHaveLength(30);
        await renderData(data, 'mercy');
        expect(host.querySelector('.app-find-page-gap')).not.toBeNull();
        expect(getPageButtons()).toHaveLength(5);
    });

    test('a loaded chunk scrolls itself into view a moment after it lands', async () => {
        await renderData(
            genData(2, {
                '1': genChunk(1, 20, 30, ['GEN.1:1:In the beginning']),
                '2': genChunk(2, 20, 30, ['GEN.1:2:And the earth']),
            }),
        );
        expect(host.querySelector('.app-found-page-2')!.textContent).toBe(
            'Results 21–30',
        );
        h.bringDomToTopView.mockClear();
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        const scrolled = h.bringDomToTopView.mock.calls.map(([dom]) => dom);
        expect(scrolled).toContain(host.querySelector('.app-found-page-1'));
        expect(scrolled).toContain(host.querySelector('.app-found-page-2'));
    });
});
