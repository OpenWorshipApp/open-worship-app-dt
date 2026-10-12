// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settingStore: new Map<string, string>(),
    // What the person answers a name dialog with; null is Cancel.
    typedName: null as string | null,
    showAppInput: vi.fn(),
    showAppConfirm: vi.fn(async () => true),
    showAppContextMenu: vi.fn(),
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: (key: string) => h.settingStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
            h.settingStore.set(key, value);
        },
    },
}));

vi.mock('../_screen/screenBibleHelpers', () => ({
    SCREEN_BIBLE_SETTING_PREFIX: 'screen-bible-',
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));

vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: h.showAppInput,
    showAppConfirm: h.showAppConfirm,
}));

import {
    genBibleTextStylePatch,
    toBibleTextStyleView,
} from '../_screen/bibleTextStyleHelpers';
import BibleTextPresetTilesComp from './BibleTextPresetTilesComp';

const SETTING_NAME = 'screen-bible--style-presets';
const goldStyle = { fontSize: 80, color: '#FFD24A', isBold: true };
const plainStyle = { color: '#000000' };

function readSavedPresets() {
    return JSON.parse(h.settingStore.get(SETTING_NAME) ?? '[]') as {
        id: string;
        name: string;
        style: Record<string, unknown>;
    }[];
}

describe('BibleTextPresetTilesComp', () => {
    let container: HTMLDivElement;
    let root: Root;
    const applyStyle = vi.fn();

    async function renderTiles(currentStyle: Record<string, unknown>) {
        await act(async () => {
            root.render(
                <BibleTextPresetTilesComp
                    view={toBibleTextStyleView(currentStyle)}
                    sample="Aa"
                    applyStyle={applyStyle}
                />,
            );
        });
    }

    function findTile(name: string) {
        const tile = [...container.querySelectorAll('button')].find(
            (button) => button.title === name,
        );
        if (tile === undefined) {
            throw new Error(`No tile called "${name}"`);
        }
        return tile;
    }

    function listTileNames() {
        return [...container.querySelectorAll('button')].map(
            (button) => button.title,
        );
    }

    // The menu a right-click opens, as the items it was built from.
    async function openMenu(name: string) {
        await act(async () => {
            findTile(name).dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const items = h.showAppContextMenu.mock.lastCall?.[1] as {
            menuElement: string;
            onSelect: () => Promise<void> | void;
        }[];
        return Object.fromEntries(
            items.map((item) => [item.menuElement, item.onSelect]),
        );
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        h.settingStore.clear();
        h.typedName = null;
        applyStyle.mockClear();
        h.showAppContextMenu.mockClear();
        h.showAppConfirm.mockClear();
        h.showAppConfirm.mockResolvedValue(true);
        // The dialog's body is the name box: typing in it is its `onChange`.
        h.showAppInput.mockReset();
        h.showAppInput.mockImplementation(async (_title, body) => {
            if (h.typedName === null) {
                return false;
            }
            body.props.onChange({ target: { value: h.typedName } });
            return true;
        });
        h.settingStore.set(
            SETTING_NAME,
            JSON.stringify([
                { id: 'gold', name: 'Gold', style: goldStyle },
                { id: 'plain', name: 'Plain black', style: plainStyle },
            ]),
        );
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
        container.remove();
    });

    test('shows each saved look as a tile, then the one that saves another', async () => {
        await renderTiles({});
        expect(listTileNames()).toEqual([
            'Gold',
            'Plain black',
            'Save as Preset',
        ]);
    });

    test('lights the saved look the screen is wearing, and only that one', async () => {
        await renderTiles(goldStyle);
        expect(findTile('Gold').getAttribute('aria-pressed')).toBe('true');
        expect(findTile('Plain black').getAttribute('aria-pressed')).toBe(
            'false',
        );
    });

    test('a tile draws its own look, on the background its colour is for', async () => {
        await renderTiles({});
        const goldSample = findTile('Gold').querySelector('span');
        expect(goldSample?.className).toContain('bible-style-on-dark');
        expect(goldSample?.style.fontWeight).toBe('700');
        const plainSample = findTile('Plain black').querySelector('span');
        expect(plainSample?.className).toContain('bible-style-on-light');
    });

    test('pressing a saved look puts the whole of it back', async () => {
        await renderTiles({ fontSize: 120, isItalic: true });
        await act(async () => {
            findTile('Gold').click();
        });
        expect(applyStyle).toHaveBeenCalledTimes(1);
        const patch = applyStyle.mock.calls[0][0];
        expect(patch).toEqual(
            genBibleTextStylePatch(toBibleTextStyleView(goldStyle)),
        );
        // Named and undefined, so the italic the screen had is cleared.
        expect('isItalic' in patch).toBe(true);
        expect(patch.isItalic).toBeUndefined();
    });

    test('saves the look on the stage under the name that was typed', async () => {
        const currentStyle = { fontSize: 96, color: '#00FF00' };
        await renderTiles(currentStyle);
        h.typedName = 'Easter';
        await act(async () => {
            findTile('Save as Preset').click();
        });
        // The dialog opens on a name nobody has taken.
        expect(h.showAppInput.mock.lastCall?.[1].props.defaultValue).toBe(
            'Preset 1',
        );
        expect(listTileNames()).toEqual([
            'Gold',
            'Plain black',
            'Easter',
            'Save as Preset',
        ]);
        const saved = readSavedPresets();
        expect(saved).toHaveLength(3);
        expect(saved[2].name).toBe('Easter');
        expect(saved[2].style).toMatchObject(currentStyle);
        // It is the look that is on, so its tile is lit at once.
        expect(findTile('Easter').getAttribute('aria-pressed')).toBe('true');
    });

    test('Cancel, or an empty name, saves nothing', async () => {
        await renderTiles({});
        h.typedName = null;
        await act(async () => {
            findTile('Save as Preset').click();
        });
        h.typedName = '   ';
        await act(async () => {
            findTile('Save as Preset').click();
        });
        expect(readSavedPresets()).toHaveLength(2);
    });

    test('a right-click renames a saved look', async () => {
        await renderTiles({});
        const menu = await openMenu('Gold');
        expect(Object.keys(menu)).toEqual([
            'Rename Preset',
            'Replace with Current Look',
            'Remove Preset',
        ]);
        h.typedName = 'Morning service';
        await act(async () => {
            await menu['Rename Preset']();
        });
        // Asked with the name it has now.
        expect(h.showAppInput.mock.lastCall?.[1].props.defaultValue).toBe(
            'Gold',
        );
        expect(listTileNames()[0]).toBe('Morning service');
        expect(readSavedPresets()[0]).toEqual({
            id: 'gold',
            name: 'Morning service',
            style: goldStyle,
        });
    });

    test('a right-click replaces a saved look with the one on the stage', async () => {
        const currentStyle = { fontSize: 70, color: '#112233' };
        await renderTiles(currentStyle);
        const menu = await openMenu('Gold');
        await act(async () => {
            await menu['Replace with Current Look']();
        });
        const saved = readSavedPresets();
        expect(saved[0].name).toBe('Gold');
        expect(saved[0].style).toMatchObject(currentStyle);
        expect(findTile('Gold').getAttribute('aria-pressed')).toBe('true');
    });

    test('removing asks first, and No keeps it', async () => {
        await renderTiles({});
        const menu = await openMenu('Gold');
        h.showAppConfirm.mockResolvedValue(false);
        await act(async () => {
            await menu['Remove Preset']();
        });
        expect(h.showAppConfirm).toHaveBeenCalledTimes(1);
        expect(readSavedPresets()).toHaveLength(2);

        h.showAppConfirm.mockResolvedValue(true);
        await act(async () => {
            await menu['Remove Preset']();
        });
        expect(listTileNames()).toEqual(['Plain black', 'Save as Preset']);
        expect(readSavedPresets().map((preset) => preset.id)).toEqual([
            'plain',
        ]);
    });

    test('a full gallery says why it cannot take another', async () => {
        h.settingStore.set(
            SETTING_NAME,
            JSON.stringify(
                Array.from({ length: 30 }).map((_, i) => ({
                    id: `id-${i}`,
                    name: `Look ${i}`,
                    style: {},
                })),
            ),
        );
        await renderTiles({});
        const addTile = [...container.querySelectorAll('button')].at(-1);
        expect(addTile?.disabled).toBe(true);
        expect(addTile?.title).toBe('Remove a preset to save a new one');
    });
});
