// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    searchSongs: vi.fn(),
    importSong: vi.fn(),
    handleError: vi.fn(),
}));

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

import type { SongSelectSearchPageType } from './songSelectApiHelpers';
import SongSelectSearchPanelComp from './SongSelectSearchPanelComp';

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
});
