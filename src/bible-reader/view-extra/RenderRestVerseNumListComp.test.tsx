// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../helper/bibleViewHelpers', () => ({
    useBibleViewFontSizeContext: () => 20,
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey} Font`,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));

import RenderRestVerseNumListComp from './RenderRestVerseNumListComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.useFakeTimers();
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
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function render(restVerseList: any[], onSelect = vi.fn()) {
    await act(async () => {
        root.render(
            <RenderRestVerseNumListComp
                bibleItem={{ bibleKey: 'KHM' } as any}
                restVerseList={restVerseList}
                onSelect={onSelect}
                toTitle={(verse) => `John 3:${verse}`}
            />,
        );
    });
    return onSelect;
}

describe('RenderRestVerseNumListComp', () => {
    test('a passage with no verses outside it draws nothing', async () => {
        await render([]);
        expect(host.innerHTML).toBe('');
    });

    test('draws each number as the bible writes it, smaller than the text', async () => {
        await render([
            { verse: 17, label: '១៧' },
            { verse: 18, label: '១៨' },
        ]);
        const numbers = Array.from(
            host.querySelectorAll<HTMLDivElement>('.verse-number'),
        );
        expect(numbers.map((element) => element.textContent)).toEqual([
            '១៧',
            '១៨',
        ]);
        expect(numbers[0].title).toBe(
            'Double click to select verses John 3:17',
        );
        const label =
            numbers[0].querySelector<HTMLDivElement>('.verse-number-rest')!;
        expect(label.style.fontSize).toBe('14px');
        expect(label.style.fontFamily).toBe('KHM Font');
    });

    test('a double-click selects that verse', async () => {
        const onSelect = await render([
            { verse: 17, label: 17 },
            { verse: 18, label: 18 },
        ]);
        const [, second] = Array.from(
            host.querySelectorAll<HTMLDivElement>('.verse-number'),
        );
        // Past the React root: what an ancestor of the view would hear.
        const outerListener = vi.fn();
        document.addEventListener('dblclick', outerListener);
        try {
            await act(async () => {
                second.dispatchEvent(
                    new MouseEvent('dblclick', {
                        bubbles: true,
                        cancelable: true,
                    }),
                );
            });
        } finally {
            document.removeEventListener('dblclick', outerListener);
        }
        expect(onSelect).toHaveBeenCalledWith(18);
        // The gesture stays on the number.
        expect(outerListener).not.toHaveBeenCalled();
    });
});
