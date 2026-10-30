// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    storedSettings: new Map<string, boolean>(),
    settingWrites: [] as [string, boolean][],
    settingReads: [] as [string, boolean][],
    showAppContextMenu: vi.fn(),
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
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingBoolean: (
            settingName: string,
            defaultValue: boolean,
        ) => {
            h.settingReads.push([settingName, defaultValue]);
            const [value, setValue] = useState(
                h.storedSettings.get(settingName) ?? defaultValue,
            );
            return [
                value,
                (newValue: boolean) => {
                    h.settingWrites.push([settingName, newValue]);
                    h.storedSettings.set(settingName, newValue);
                    setValue(newValue);
                },
            ];
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    useBibleKeyContext: () => 'KHM',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey} Font`,
}));

import BibleCrossRefWrapperComp from './BibleCrossRefWrapperComp';

let host: HTMLDivElement;
let root: Root;
const onRefresh = vi.fn();

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.storedSettings.clear();
    h.settingWrites = [];
    h.settingReads = [];
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
        root.render(
            <BibleCrossRefWrapperComp
                title="AI Cross References"
                note={<button type="button" className="test-note" />}
                settingName="show-standard-bible-ref"
                onRefresh={onRefresh}
            >
                <div className="test-body">GEN 1:1</div>
            </BibleCrossRefWrapperComp>,
        );
    });
}

function getToggle() {
    return host.querySelector<HTMLButtonElement>('.app-xref-card-toggle')!;
}

async function openMenuOnHeader() {
    await act(async () => {
        host.querySelector('.app-xref-card-header')!.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
    });
}

describe('BibleCrossRefWrapperComp', () => {
    test('a shown section names its source and bible, with the note outside the toggle', async () => {
        await render();
        expect(h.settingReads[0]).toEqual(['show-standard-bible-ref', true]);
        const toggle = getToggle();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.querySelector('.app-xref-card-title')!.textContent).toBe(
            'AI Cross References',
        );
        expect(toggle.querySelector('i')!.className).toContain(
            'bi-chevron-down',
        );
        const bibleKey =
            host.querySelector<HTMLSpanElement>('.app-xref-card-key')!;
        expect(bibleKey.textContent).toBe('KHM');
        expect(bibleKey.style.fontFamily).toBe('KHM Font');
        // A control inside the collapse button could not be pressed.
        const note = host.querySelector('.test-note')!;
        expect(toggle.contains(note)).toBe(false);
        expect(
            host.querySelector('.app-xref-card-body .test-body'),
        ).not.toBeNull();
    });

    test('the toggle collapses the section and remembers it', async () => {
        await render();
        await act(async () => {
            getToggle().click();
        });
        expect(h.settingWrites).toEqual([['show-standard-bible-ref', false]]);
        expect(getToggle().getAttribute('aria-expanded')).toBe('false');
        expect(getToggle().querySelector('i')!.className).toContain(
            'bi-chevron-right',
        );
        expect(host.querySelector('.app-xref-card-body')).toBeNull();
        await act(async () => {
            getToggle().click();
        });
        expect(h.settingWrites.at(-1)).toEqual([
            'show-standard-bible-ref',
            true,
        ]);
        expect(host.querySelector('.test-body')).not.toBeNull();
    });

    test('a collapsed section starts collapsed', async () => {
        h.storedSettings.set('show-standard-bible-ref', false);
        await render();
        expect(getToggle().getAttribute('aria-expanded')).toBe('false');
        expect(host.querySelector('.test-body')).toBeNull();
    });

    test('a right-click on a shown section offers to refresh it', async () => {
        await render();
        await openMenuOnHeader();
        expect(h.showAppContextMenu).toHaveBeenCalledOnce();
        const [, items] = h.showAppContextMenu.mock.calls[0];
        expect(items).toEqual([
            {
                childBefore: 'icon:arrow-clockwise',
                menuElement: 'Refresh',
                onSelect: onRefresh,
            },
        ]);
    });

    test('a collapsed section has nothing to refresh', async () => {
        h.storedSettings.set('show-standard-bible-ref', false);
        await render();
        await openMenuOnHeader();
        expect(h.showAppContextMenu).not.toHaveBeenCalled();
    });

    test('the menu button opens the same menu', async () => {
        await render();
        await act(async () => {
            host.querySelector<HTMLButtonElement>(
                '.app-context-menu-dots',
            )!.click();
        });
        expect(h.showAppContextMenu).toHaveBeenCalledOnce();
        h.showAppContextMenu.mock.calls[0][1][0].onSelect();
        expect(onRefresh).toHaveBeenCalledOnce();
    });
});
