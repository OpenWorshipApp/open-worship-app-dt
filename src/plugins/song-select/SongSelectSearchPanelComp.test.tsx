// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    searchSongs: vi.fn(),
    importSong: vi.fn(),
    handleError: vi.fn(),
}));
const popupState = vi.hoisted(() => ({ theme: 'light' }));

vi.mock('../../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../others/LoadingComp', () => ({
    default: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('../../others/RenderPaginationComp', () => ({
    default: ({
        safePage,
        setPage,
    }: {
        safePage: number;
        setPage: (page: number) => void;
    }) => (
        <button type="button" onClick={() => setPage(safePage + 1)}>
            Page {safePage}
        </button>
    ),
}));
vi.mock('./songSelectApiHelpers', () => ({
    searchSongs: mocks.searchSongs,
    toSongSelectErrorMessageKey: () => 'Search failed',
}));
vi.mock('./songSelectImportHelpers', () => ({
    importSongSelectSongToDirectory: mocks.importSong,
}));
// The popup's frame: what it is titled, where its rect is kept, how it closes.
vi.mock('../../app-modal/FloatingWidgetComp', () => ({
    default: ({ title, persistKey, onClose, options, children }: any) => (
        <section
            role="dialog"
            aria-label={title}
            data-persist-key={persistKey}
            data-size={`${options.width}x${options.height}`}
        >
            <button type="button" onClick={onClose}>
                Close widget
            </button>
            {children}
        </section>
    ),
}));
vi.mock('../../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: popupState.theme }),
}));

import type { SongSelectSearchPageType } from './songSelectApiHelpers';
import SongSelectSearchPanelComp from './SongSelectSearchPanelComp';
import SongSelectSearchPopupComp from './SongSelectSearchPopupComp';

let host: HTMLDivElement;
let root: Root;

function page(query: string, pageNumber = 1): SongSelectSearchPageType {
    return {
        page: pageNumber,
        totalPages: 3,
        totalRecords: 1,
        records: [
            {
                id: `${query}-${pageNumber}`,
                title: `${query} Song`,
                songNumber: '123',
                authors: ['Writer'],
                lyricsPreview: 'First line',
                isPublicDomain: false,
                hasLyrics: true,
                isAuthorized: true,
            },
        ],
    };
}

function changeInput(value: string) {
    const input = host.querySelector('input')!;
    Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.searchSongs.mockImplementation(
        async (query: string, pageNumber: number) => page(query, pageNumber),
    );
    mocks.importSong.mockResolvedValue(true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('SongSelect search panel', () => {
    test('debounces remote search, keeps the latest query, and resets paging', async () => {
        await act(async () =>
            root.render(<SongSelectSearchPanelComp dirPath="/songs" />),
        );
        expect(host.textContent).toContain('Type to search');

        await act(async () => changeInput('Gra'));
        await act(async () => vi.advanceTimersByTime(300));
        await act(async () => changeInput('Grace'));
        await act(async () => vi.advanceTimersByTime(499));
        expect(mocks.searchSongs).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTime(1));
        expect(mocks.searchSongs).toHaveBeenLastCalledWith('Grace', 1);
        expect(host.textContent).toContain('Grace Song');

        await act(async () => {
            [...host.querySelectorAll('button')]
                .find((button) => button.textContent?.includes('Page 1'))!
                .click();
        });
        expect(mocks.searchSongs).toHaveBeenLastCalledWith('Grace', 2);
        expect(host.textContent).toContain('Page 2');

        await act(async () => changeInput('Hope'));
        await act(async () => vi.advanceTimersByTime(500));
        expect(mocks.searchSongs).toHaveBeenLastCalledWith('Hope', 1);
        expect(host.textContent).toContain('Hope Song');

        await act(async () =>
            host
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Clear search"]',
                )!
                .click(),
        );
        expect(host.textContent).toContain('Type to search');
        expect(mocks.searchSongs).toHaveBeenCalledTimes(3);
    });

    test('discards an old response after a newer query resolves', async () => {
        let resolveOld!: (result: SongSelectSearchPageType) => void;
        mocks.searchSongs.mockImplementation((query: string) =>
            query === 'Old'
                ? new Promise<SongSelectSearchPageType>((resolve) => {
                      resolveOld = resolve;
                  })
                : Promise.resolve(page(query)),
        );
        await act(async () =>
            root.render(<SongSelectSearchPanelComp dirPath="/songs" />),
        );
        await act(async () => changeInput('Old'));
        await act(async () => vi.advanceTimersByTime(500));
        expect(host.textContent).toContain('Loading');

        await act(async () => changeInput('New'));
        await act(async () => vi.advanceTimersByTime(500));
        expect(host.textContent).toContain('New Song');
        await act(async () => resolveOld(page('Old')));
        expect(host.textContent).toContain('New Song');
        expect(host.textContent).not.toContain('Old Song');
    });

    test('shows an API error and an empty result separately', async () => {
        mocks.searchSongs.mockRejectedValueOnce(new Error('offline'));
        await act(async () =>
            root.render(<SongSelectSearchPanelComp dirPath="/songs" />),
        );
        await act(async () => changeInput('Lost'));
        await act(async () => vi.advanceTimersByTime(500));
        expect(host.textContent).toContain('Search failed');
        expect(mocks.handleError).toHaveBeenCalledOnce();

        mocks.searchSongs.mockResolvedValueOnce({
            ...page('None'),
            totalRecords: 0,
            records: [],
        });
        await act(async () => changeInput('None'));
        await act(async () => vi.advanceTimersByTime(500));
        expect(host.textContent).toContain('No matches');
        expect(host.textContent).not.toContain('Search failed');
    });

    test('passes the selected record to import and blocks a second download while busy', async () => {
        let finishImport!: (value: boolean) => void;
        mocks.importSong.mockImplementation(
            () => new Promise<boolean>((resolve) => (finishImport = resolve)),
        );
        await act(async () =>
            root.render(<SongSelectSearchPanelComp dirPath="/songs" />),
        );
        await act(async () => changeInput('Grace'));
        await act(async () => vi.advanceTimersByTime(500));

        await act(async () =>
            host
                .querySelector<HTMLButtonElement>('[aria-label="Download"]')!
                .click(),
        );
        expect(mocks.importSong).toHaveBeenCalledWith(
            '/songs',
            page('Grace').records[0],
        );
        expect(
            host.querySelector<HTMLButtonElement>('[aria-label="Download"]')!
                .disabled,
        ).toBe(true);
        await act(async () => finishImport(true));
        expect(
            host.querySelector<HTMLButtonElement>('[aria-label="Download"]')!
                .disabled,
        ).toBe(false);
    });

    // The API clamps a page past the last one. The panel takes the page the
    // answer names as its own, so the pager's next press asks again instead
    // of being a no-op on a page number it already holds.
    test('a page the API clamps is mirrored back, so the next press still asks', async () => {
        mocks.searchSongs.mockImplementation(
            async (query: string, pageNumber: number) => {
                return {
                    ...page(query, Math.min(pageNumber, 1)),
                    totalPages: 1,
                };
            },
        );
        const countPageTwoAsks = () => {
            return mocks.searchSongs.mock.calls.filter(([, pageNumber]) => {
                return pageNumber === 2;
            }).length;
        };
        const pressPager = async () => {
            await act(async () => {
                [...host.querySelectorAll('button')]
                    .find((button) => button.textContent?.includes('Page 1'))!
                    .click();
            });
        };
        await act(async () =>
            root.render(<SongSelectSearchPanelComp dirPath="/songs" />),
        );
        await act(async () => changeInput('Grace'));
        await act(async () => vi.advanceTimersByTime(500));
        expect(host.textContent).toContain('Page 1');

        await pressPager();
        expect(countPageTwoAsks()).toBe(1);
        expect(host.textContent).toContain('Page 1');
        expect(host.textContent).toContain('Grace Song');

        await pressPager();
        expect(countPageTwoAsks()).toBe(2);
        expect(host.textContent).toContain('Page 1');
    });

    test('an old query that fails after a newer one answered shows no error', async () => {
        let rejectOld!: (error: Error) => void;
        mocks.searchSongs.mockImplementation((query: string) =>
            query === 'Old'
                ? new Promise<SongSelectSearchPageType>((_resolve, reject) => {
                      rejectOld = reject;
                  })
                : Promise.resolve(page(query)),
        );
        await act(async () =>
            root.render(<SongSelectSearchPanelComp dirPath="/songs" />),
        );
        await act(async () => changeInput('Old'));
        await act(async () => vi.advanceTimersByTime(500));
        await act(async () => changeInput('New'));
        await act(async () => vi.advanceTimersByTime(500));
        expect(host.textContent).toContain('New Song');

        await act(async () => rejectOld(new Error('timed out')));
        expect(host.textContent).toContain('New Song');
        expect(host.textContent).not.toContain('Search failed');
        expect(host.textContent).not.toContain('Loading');
        expect(mocks.handleError).not.toHaveBeenCalled();
    });
});

describe('SongSelect search popup', () => {
    test('floats the search panel over the page, in the app theme, and closes', async () => {
        popupState.theme = 'dark';
        const onClose = vi.fn();
        await act(async () =>
            root.render(
                <SongSelectSearchPopupComp
                    dirPath="/songs"
                    onClose={onClose}
                />,
            ),
        );
        // The panel is lazy: it is fetched only now that the popup is open.
        for (let round = 0; round < 3; round++) {
            await act(async () => {
                await vi.dynamicImportSettled();
            });
        }
        // Portalled to the body, not rendered where it was mounted.
        expect(host.childElementCount).toBe(0);
        const portal = document.body.querySelector<HTMLElement>(
            ':scope > .app-floating-widget-portal',
        )!;
        expect(portal.dataset.bsTheme).toBe('dark');
        const dialog = portal.querySelector('[role="dialog"]')!;
        expect(dialog.getAttribute('aria-label')).toBe(
            'Import From SongSelect',
        );
        expect(dialog.getAttribute('data-persist-key')).toBe(
            'floating-widget-rect-song-select-import',
        );
        expect(dialog.getAttribute('data-size')).toBe('480x600');
        expect(dialog.textContent).toContain('Type to search');
        expect(dialog.querySelector('input')!.placeholder).toBe(
            'Search songs...',
        );

        await act(async () => {
            [...dialog.querySelectorAll('button')]
                .find((button) => button.textContent === 'Close widget')!
                .click();
        });
        expect(onClose).toHaveBeenCalledTimes(1);
        popupState.theme = 'light';
    });
});
