// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    selectedBibleKey: 'KJV',
    getInstant: vi.fn(),
    findingContext: {
        bibleKey: null as string | null,
        findingText: null as string | null,
    },
    bodyProps: null as any,
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        useAppEffectAsync: (
            effect: (context: object) => Promise<unknown>,
            deps: unknown[],
            methods: object = {},
        ) => {
            useEffect(
                () => {
                    void effect({ ...methods });
                },
                // eslint-disable-next-line react-hooks/exhaustive-deps
                [...deps, ...Object.values(methods)],
            );
        },
    };
});
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="loading">Loading</div>,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    useBibleKeyContext: () => h.selectedBibleKey,
}));
vi.mock('./BibleFindController', async () => {
    const { createContext } = await import('react');
    return {
        default: {
            getInstant: h.getInstant,
            findingContext: h.findingContext,
        },
        BibleFindControllerContext: createContext(null),
    };
});
vi.mock('./BibleFindBodyComp', async () => {
    const { use } = await import('react');
    const { BibleFindControllerContext } =
        await import('./BibleFindController');
    return {
        default: (props: any) => {
            h.bodyProps = props;
            const controller: any = use(BibleFindControllerContext);
            return <div className="find-body">{controller.bibleKey}</div>;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import BibleFindBodyPreviewerComp from './BibleFindBodyPreviewerComp';

let host: HTMLDivElement;
let root: Root;

async function renderPreviewer() {
    await act(async () => {
        root.render(<BibleFindBodyPreviewerComp />);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.selectedBibleKey = 'KJV';
    h.findingContext.bibleKey = null;
    h.findingContext.findingText = null;
    h.bodyProps = null;
    h.getInstant.mockImplementation(async (bibleKey: string) => ({
        bibleKey,
    }));
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('the Find tab', () => {
    test('loads the find controller of the selected Bible and hands it down', async () => {
        const pending: { resolve: (value: unknown) => void } = {
            resolve: () => {},
        };
        h.getInstant.mockReturnValue(
            new Promise((resolve) => {
                pending.resolve = resolve;
            }),
        );
        await renderPreviewer();
        expect(host.querySelector('.loading')).not.toBeNull();
        expect(h.getInstant).toHaveBeenCalledWith('KJV');
        await act(async () => pending.resolve({ bibleKey: 'KJV' }));
        expect(host.querySelector('.loading')).toBeNull();
        expect(host.querySelector('.find-body')!.textContent).toBe('KJV');
    });

    test('a Bible asked for from elsewhere wins once, and the pending words are taken', async () => {
        h.findingContext.bibleKey = 'NIV';
        h.findingContext.findingText = 'shepherd';
        await renderPreviewer();
        expect(h.getInstant).toHaveBeenCalledWith('NIV');
        expect(h.getInstant).not.toHaveBeenCalledWith('KJV');
        expect(host.querySelector('.find-body')!.textContent).toBe('NIV');
        expect(h.findingContext.bibleKey).toBeNull();
        expect(h.findingContext.findingText).toBeNull();
    });

    test('picking another Bible loads its controller', async () => {
        await renderPreviewer();
        expect(host.querySelector('.find-body')!.textContent).toBe('KJV');
        await act(async () => h.bodyProps.setBibleKey('KJV', 'KHOV'));
        expect(h.getInstant).toHaveBeenLastCalledWith('KHOV');
        expect(host.querySelector('.find-body')!.textContent).toBe('KHOV');
    });

    test('a controller that cannot be had says so, and Reload tries again', async () => {
        h.getInstant.mockResolvedValueOnce(null);
        await renderPreviewer();
        expect(host.querySelector('.alert-warning')!.textContent).toContain(
            'Fail to get find controller!',
        );
        const reload = host.querySelector<HTMLButtonElement>('button')!;
        expect(reload.textContent).toBe('Reload');
        await act(async () => reload.click());
        expect(h.getInstant).toHaveBeenCalledTimes(2);
        expect(host.querySelector('.find-body')!.textContent).toBe('KJV');
    });

    test('no Bible known yet: nothing is loaded', async () => {
        h.selectedBibleKey = 'Unknown';
        await renderPreviewer();
        expect(h.getInstant).not.toHaveBeenCalled();
        expect(host.querySelector('.loading')).not.toBeNull();
    });
});
