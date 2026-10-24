// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    lookup: undefined as undefined | null | object,
    namesSearch: vi.fn(),
    locationsSearch: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../helper/bibleViewHelpers', () => ({
    useBibleViewTextScale: () => 1.4,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/LoadingComp', () => ({
    default: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('../others/RenderPaginationComp', () => ({
    default: ({
        safePage,
        totalPages,
        setPage,
    }: {
        safePage: number;
        totalPages: number;
        setPage: (page: number) => void;
    }) => (
        <button type="button" onClick={() => setPage(safePage + 1)}>
            Page {safePage} of {totalPages}
        </button>
    ),
}));
vi.mock('./lookupLangHelpers', () => ({
    useLookupLangPresentation: () => ({
        fontFamily: 'TestFont',
        translate: (text: string) => `local:${text}`,
    }),
}));
vi.mock('./lookupManagersContext', () => ({
    useLookupManagers: () => state.lookup,
}));
vi.mock('./RenderLookupRecordItemComp', () => ({
    default: ({ record }: { record: { name: string } }) => (
        <li>{record.name}</li>
    ),
}));

import LocationNameLookupPanelComp from './LocationNameLookupPanelComp';

let host: HTMLDivElement;
let root: Root;

function page(kind: 'name' | 'location', query: string, requestedPage: number) {
    const safePage = Math.min(requestedPage, query ? 1 : 3);
    return {
        page: safePage,
        totalPages: query ? 1 : 3,
        totalRecords: 1,
        records: [
            {
                id: `${kind}-${safePage}`,
                name: `${kind}:${query || safePage}`,
                title: 'Genesis 1',
                type: 'person',
            },
        ],
    };
}

function button(label: string) {
    return [...host.querySelectorAll('button')].find(
        (element) =>
            element.textContent?.includes(label) ||
            element.getAttribute('aria-label') === label,
    )!;
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
    state.lookup = undefined;
    state.namesSearch.mockReset();
    state.locationsSearch.mockReset();
    state.namesSearch.mockImplementation(({ query, page: requestedPage }) =>
        page('name', query, requestedPage),
    );
    state.locationsSearch.mockImplementation(({ query, page: requestedPage }) =>
        page('location', query, requestedPage),
    );
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

describe('location and name lookup panel', () => {
    it('shows loading and failure states before managers are available', async () => {
        await act(async () => root.render(<LocationNameLookupPanelComp />));
        expect(host.textContent).toContain('Loading lookup data');

        state.lookup = null;
        await act(async () => root.render(<LocationNameLookupPanelComp />));
        expect(host.textContent).toContain('Failed to load lookup data');
    });

    it('keeps tab queries separate, debounces searches, and applies name types only to names', async () => {
        state.lookup = {
            namesLookupManager: {
                nameTypes: [{ type: 'person' }],
                searchNamesPagination: state.namesSearch,
            },
            locationsLookupManager: {
                searchLocationsPagination: state.locationsSearch,
            },
        };
        await act(async () => root.render(<LocationNameLookupPanelComp />));
        expect(host.textContent).toContain('name:1');
        expect(state.namesSearch).toHaveBeenLastCalledWith({
            query: '',
            page: 1,
            pageSize: 20,
            type: undefined,
        });
        expect(host.querySelector('select')!.disabled).toBe(false);

        await act(async () => {
            changeInput('Adam');
        });
        expect((host.querySelector('input') as HTMLInputElement).value).toBe(
            'Adam',
        );
        expect(host.textContent).toContain('name:1');
        await act(async () => vi.advanceTimersByTime(300));
        expect(host.textContent).toContain('name:Adam');

        await act(async () => {
            host.querySelector('select')!.value = 'person';
            host.querySelector('select')!.dispatchEvent(
                new Event('change', { bubbles: true }),
            );
        });
        expect(state.namesSearch).toHaveBeenLastCalledWith({
            query: 'Adam',
            page: 1,
            pageSize: 20,
            type: 'person',
        });

        await act(async () => button('Locations').click());
        expect(host.querySelector('select')!.disabled).toBe(true);
        expect(host.textContent).toContain('location:1');
        await act(async () => changeInput('Jerusalem'));
        await act(async () => vi.advanceTimersByTime(300));
        expect(host.textContent).toContain('location:Jerusalem');
        expect(state.locationsSearch).toHaveBeenLastCalledWith({
            query: 'Jerusalem',
            page: 1,
            pageSize: 20,
        });

        await act(async () => button('Names').click());
        expect((host.querySelector('input') as HTMLInputElement).value).toBe(
            'Adam',
        );
        expect(host.textContent).toContain('name:Adam');
        await act(async () => button('Clear search').click());
        expect((host.querySelector('input') as HTMLInputElement).value).toBe(
            '',
        );
        expect(state.namesSearch).toHaveBeenLastCalledWith({
            query: '',
            page: 1,
            pageSize: 20,
            type: 'person',
        });
    });

    it('starts a new query on page one after browsing later pages', async () => {
        state.lookup = {
            namesLookupManager: {
                nameTypes: [],
                searchNamesPagination: state.namesSearch,
            },
            locationsLookupManager: {
                searchLocationsPagination: state.locationsSearch,
            },
        };
        await act(async () => root.render(<LocationNameLookupPanelComp />));
        await act(async () => button('Page 1').click());
        expect(host.textContent).toContain('name:2');
        await act(async () => changeInput('Moses'));
        await act(async () => vi.advanceTimersByTime(300));
        expect(host.textContent).toContain('name:Moses');
        expect(state.namesSearch).toHaveBeenLastCalledWith({
            query: 'Moses',
            page: 1,
            pageSize: 20,
            type: undefined,
        });
    });
});
