import { describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

import {
    clickAgentMenuItem,
    findAgentMenuItem,
    listAgentMenuItems,
} from './appMenuAgentHelpers';

// A menu the shape Electron builds: items with labels, roles, types and
// submenus. Hand-made so the rules are tested with no Electron behind them.
function genMenu() {
    const click = vi.fn();
    const items = [
        {
            label: 'File',
            type: 'submenu',
            submenu: {
                items: [
                    { label: 'Print', type: 'normal', enabled: true, click },
                    { type: 'separator' },
                    {
                        label: 'Export Data',
                        type: 'normal',
                        enabled: true,
                        click,
                    },
                    { label: 'Quit', role: 'quit', type: 'normal', click },
                ],
            },
        },
        {
            label: 'View',
            type: 'submenu',
            submenu: {
                items: [
                    { label: 'Reload', role: 'reload', type: 'normal', click },
                    { label: 'Relaunch', type: 'normal', enabled: true, click },
                    {
                        label: 'Toggle Developer Tools',
                        role: 'toggleDevTools',
                        type: 'normal',
                        click,
                    },
                    {
                        label: 'Documents',
                        type: 'checkbox',
                        checked: true,
                        enabled: true,
                        click: vi.fn(function toggle(this: any) {
                            this.checked = !this.checked;
                        }),
                    },
                    { label: 'Hidden', type: 'normal', visible: false, click },
                    { label: 'Print', type: 'normal', enabled: false, click },
                ],
            },
        },
    ];
    return { menu: { items } as any, click };
}

describe('appMenuAgentHelpers', () => {
    test('lists every visible item with its path, marking what it will not press', () => {
        const { menu } = genMenu();
        const listed = listAgentMenuItems(menu);
        expect(listed.map((one) => one.path)).toEqual([
            'File',
            'File > Print',
            'File > Export Data',
            'File > Quit',
            'View',
            'View > Reload',
            'View > Relaunch',
            'View > Toggle Developer Tools',
            'View > Documents',
            'View > Print',
        ]);
        const byPath = Object.fromEntries(listed.map((one) => [one.path, one]));
        expect(byPath['File'].hasSubmenu).toBe(true);
        expect(byPath['File > Quit'].refused).toContain('closes or hides');
        expect(byPath['View > Relaunch'].refused).toContain(
            'closes and reopens',
        );
        expect(byPath['View > Toggle Developer Tools'].refused).toContain(
            'Developer Tools',
        );
        expect(byPath['View > Documents']).toMatchObject({
            isChecked: true,
            isEnabled: true,
        });
        expect(byPath['View > Print'].isEnabled).toBe(false);
        expect(byPath['View > Reload'].refused).toBeUndefined();
    });

    test('finds an item by its path, or by a bare label only when it is unique', () => {
        const { menu } = genMenu();
        expect(findAgentMenuItem('view > reload', menu)).toMatchObject({
            path: 'View > Reload',
        });
        expect(findAgentMenuItem('Export Data', menu)).toMatchObject({
            path: 'File > Export Data',
        });
        expect(findAgentMenuItem('Print', menu)).toMatchObject({
            reason: expect.stringContaining('"File > Print", "View > Print"'),
        });
        expect(findAgentMenuItem('Nowhere', menu)).toMatchObject({
            reason: expect.stringContaining('no menu item called "Nowhere"'),
        });
        expect(findAgentMenuItem('', menu)).toMatchObject({
            reason: expect.stringContaining('Name the menu item'),
        });
    });

    test('presses an item with the window that asked, and reads a checkbox back', () => {
        const { menu, click } = genMenu();
        const win = { isDestroyed: () => false, webContents: { id: 7 } } as any;
        expect(clickAgentMenuItem('View > Reload', win, menu)).toEqual({
            clicked: 'View > Reload',
        });
        expect(click).toHaveBeenCalledWith(undefined, win, win.webContents);
        expect(clickAgentMenuItem('View > Documents', win, menu)).toEqual({
            clicked: 'View > Documents',
            isCheckedNow: false,
        });
    });

    test('refuses what takes the app down, a submenu, and a greyed-out item', () => {
        const { menu, click } = genMenu();
        for (const [item, words] of [
            ['File > Quit', 'closes or hides'],
            ['View > Relaunch', 'closes and reopens'],
            ['View > Toggle Developer Tools', 'Developer Tools'],
            ['File', 'opens a menu'],
            ['View > Print', 'greyed out'],
        ]) {
            expect(clickAgentMenuItem(item, null, menu), item).toMatchObject({
                isError: true,
                reason: expect.stringContaining(words),
            });
        }
        expect(click).not.toHaveBeenCalled();
    });
});
