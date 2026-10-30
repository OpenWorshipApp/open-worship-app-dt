// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import ItemReadErrorComp from './ItemReadErrorComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('ItemReadErrorComp', () => {
    test('says the item data is broken, with no menu unless given one', async () => {
        await act(async () => root.render(<ItemReadErrorComp />));
        expect(host.querySelector('.card-header')!.textContent).toBe(
            'Item data error',
        );
        expect(host.querySelector('button')).toBeNull();
    });

    test('a given menu opens from the dots and from a right-click', async () => {
        const onContextMenu = vi.fn();
        await act(async () =>
            root.render(<ItemReadErrorComp onContextMenu={onContextMenu} />),
        );
        await act(async () => host.querySelector('button')!.click());
        await act(async () => {
            host.querySelector('.card-header')!.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(onContextMenu).toHaveBeenCalledTimes(2);
    });
});
