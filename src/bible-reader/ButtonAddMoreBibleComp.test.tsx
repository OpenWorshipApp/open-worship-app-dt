// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    showBibleKeyOption: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: h.showBibleKeyOption,
}));
vi.mock('./ReadIdOnlyBibleItem', () => ({
    ReadIdOnlyBibleItem: class {
        bibleKey: string;
        target: unknown;
        constructor(json: { bibleKey: string; target: unknown }) {
            this.bibleKey = json.bibleKey;
            this.target = json.target;
        }
        static fromJson(json: { bibleKey: string; target: unknown }) {
            return new this(json);
        }
        toJson() {
            return { bibleKey: this.bibleKey, target: this.target };
        }
    },
}));

import ButtonAddMoreBibleComp from './ButtonAddMoreBibleComp';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';

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

async function render(bibleItems: any[], applyPresents = vi.fn()) {
    await act(async () => {
        root.render(
            <ButtonAddMoreBibleComp
                bibleItems={bibleItems}
                applyPresents={applyPresents}
            />,
        );
    });
    return { button: host.querySelector('button')!, applyPresents };
}

describe('ButtonAddMoreBibleComp', () => {
    test('there is nothing to add to without a first item', async () => {
        const { button } = await render([]);
        expect(button.disabled).toBe(true);
        expect(button.textContent).toBe(' Add Item');
    });

    test('adds the first item again, in the bible picked', async () => {
        const target = { bookKey: 'JHN', chapter: 3, verseStart: 16 };
        const first = ReadIdOnlyBibleItem.fromJson({
            bibleKey: 'KJV',
            target,
        } as any);
        const second = ReadIdOnlyBibleItem.fromJson({
            bibleKey: 'FRE',
            target,
        } as any);
        const { button, applyPresents } = await render([first, second]);
        expect(button.disabled).toBe(false);
        await act(async () => {
            button.click();
        });
        expect(h.showBibleKeyOption).toHaveBeenCalledOnce();
        const [event, onSelect] = h.showBibleKeyOption.mock.calls[0];
        expect(event.type).toBe('click');
        onSelect('KHM');
        expect(applyPresents).toHaveBeenCalledOnce();
        const [newItems] = applyPresents.mock.calls[0];
        expect(newItems.slice(0, 2)).toEqual([first, second]);
        expect(newItems[2]).toBeInstanceOf(ReadIdOnlyBibleItem);
        expect(newItems[2]).not.toBe(first);
        expect(newItems[2].bibleKey).toBe('KHM');
        expect(newItems[2].target).toEqual(target);
        // The first item itself is left in its own bible.
        expect(first.bibleKey).toBe('KJV');
    });
});
