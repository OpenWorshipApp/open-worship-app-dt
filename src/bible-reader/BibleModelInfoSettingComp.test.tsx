// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    model: 'KJV',
    setBibleModelInfoSetting: vi.fn(),
    showAppContextMenu: vi.fn(),
    reload: vi.fn(),
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
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    bibleModelInfoTitleMap: {
        KJV: 'King James Version',
        KJVD: 'King James Version with Deuterocanon',
        DR: 'Douay-Rheims',
    },
    getBibleModelInfoSetting: () => h.model,
    setBibleModelInfoSetting: h.setBibleModelInfoSetting,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../server/appProvider', () => ({ default: { reload: h.reload } }));

import BibleModelInfoSettingComp from './BibleModelInfoSettingComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.model = 'KJV';
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

async function render() {
    await act(async () => {
        root.render(<BibleModelInfoSettingComp />);
    });
    return host.querySelector('button')!;
}

describe('BibleModelInfoSettingComp', () => {
    test('shows the model in use and what it is', async () => {
        h.model = 'DR';
        const button = await render();
        expect(button.textContent).toBe('DR');
        expect(button.title).toBe('Change Bible Model Info (Douay-Rheims)');
    });

    test('offers every model, the one in use disabled', async () => {
        const button = await render();
        await act(async () => {
            button.click();
        });
        expect(h.showAppContextMenu).toHaveBeenCalledOnce();
        const [event, items] = h.showAppContextMenu.mock.calls[0];
        expect(event.type).toBe('click');
        expect(
            items.map((item: any) => ({
                childBefore: item.childBefore,
                menuElement: item.menuElement,
                title: item.title,
                disabled: item.disabled,
            })),
        ).toEqual([
            {
                childBefore: 'icon:cpu',
                menuElement: 'KJV - (King James Version)',
                title: 'King James Version',
                disabled: true,
            },
            {
                childBefore: 'icon:cpu',
                menuElement: 'KJVD - (King James Version with Deuterocanon)',
                title: 'King James Version with Deuterocanon',
                disabled: false,
            },
            {
                childBefore: 'icon:cpu',
                menuElement: 'DR - (Douay-Rheims)',
                title: 'Douay-Rheims',
                disabled: false,
            },
        ]);
    });

    test('choosing a model saves it and reloads the window', async () => {
        const button = await render();
        await act(async () => {
            button.click();
        });
        const items = h.showAppContextMenu.mock.calls[0][1];
        items[1].onSelect();
        expect(h.setBibleModelInfoSetting).toHaveBeenCalledWith('KJVD');
        expect(h.reload).toHaveBeenCalledOnce();
        // Saved before the reload reads it back.
        expect(
            h.setBibleModelInfoSetting.mock.invocationCallOrder[0],
        ).toBeLessThan(h.reload.mock.invocationCallOrder[0]);
    });
});
