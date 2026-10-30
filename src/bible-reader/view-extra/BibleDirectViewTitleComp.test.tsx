// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppStateAsync: <T,>(load: () => Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                void load().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey} Font`,
}));

import { BibleDirectViewTitleComp } from './BibleDirectViewTitleComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

function genBibleItem(target: object, title: string) {
    return {
        bibleKey: 'KHM',
        target,
        toTitle: vi.fn(async () => title),
    } as any;
}

async function render(bibleItem: any) {
    await act(async () => {
        root.render(<BibleDirectViewTitleComp bibleItem={bibleItem} />);
    });
    return host.querySelector<HTMLSpanElement>('span.title')!;
}

describe('BibleDirectViewTitleComp', () => {
    test("shows the passage title in the bible's own face", async () => {
        const title = await render(
            genBibleItem({ bookKey: 'JHN', chapter: 3 }, 'John 3:16'),
        );
        expect(title.textContent).toBe('John 3:16');
        expect(title.style.fontFamily).toBe('KHM Font');
    });

    test('titles a new target anew, and the same one only once', async () => {
        const target = { bookKey: 'JHN', chapter: 3 };
        const first = genBibleItem(target, 'John 3:16');
        await render(first);
        // A new object for the same passage: nothing to read again.
        const same = genBibleItem(target, 'unused');
        await render(same);
        expect(same.toTitle).not.toHaveBeenCalled();
        const next = genBibleItem({ bookKey: 'JHN', chapter: 4 }, 'John 4:1');
        const title = await render(next);
        expect(next.toTitle).toHaveBeenCalledOnce();
        expect(title.textContent).toBe('John 4:1');
    });
});
