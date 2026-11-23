import { describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

import {
    clickAgentMenuItem,
    FACTORY_RESET_DENIED_LABEL,
    findAgentMenuItem,
    listAgentMenuItems,
} from './appMenuAgentHelpers';
import { FACTORY_RESET_LABEL } from './factoryResetHelpers';

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
        expect(byPath['File > Quit'].refused).toContain('closes the app');
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
            ['File > Quit', 'closes the app'],
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

    test('refuses Help > Factory Reset, whatever its case', () => {
        const click = vi.fn();
        const menu = {
            items: [
                {
                    label: 'Help',
                    type: 'submenu',
                    submenu: {
                        items: [
                            {
                                label: FACTORY_RESET_LABEL,
                                type: 'normal',
                                enabled: true,
                                click,
                            },
                        ],
                    },
                },
            ],
        } as any;
        // The two spellings are one item: the menu's label is the one refused.
        expect(FACTORY_RESET_LABEL.toLowerCase()).toBe(
            FACTORY_RESET_DENIED_LABEL,
        );
        const listed = listAgentMenuItems(menu);
        expect(listed[1]).toMatchObject({
            path: 'Help > Factory Reset',
            refused: expect.stringContaining('cannot be undone'),
        });
        for (const item of ['Help > Factory Reset', 'factory reset']) {
            expect(clickAgentMenuItem(item, null, menu), item).toMatchObject({
                isError: true,
                reason: expect.stringContaining('deletes every setting'),
            });
        }
        expect(click).not.toHaveBeenCalled();
    });

    test('an item with no words is neither listed nor pressable', () => {
        const click = vi.fn();
        const menu = {
            items: [
                {
                    label: 'Help',
                    type: 'submenu',
                    submenu: {
                        items: [
                            { label: '   ', type: 'normal', click },
                            { type: 'normal', click },
                            { label: 'About', type: 'normal', click },
                        ],
                    },
                },
            ],
        } as any;
        expect(listAgentMenuItems(menu).map((one) => one.path)).toEqual([
            'Help',
            'Help > About',
        ]);
        // Nothing to name it by: asked for, it is not found, and not pressed.
        expect(clickAgentMenuItem('Help > ', null, menu)).toEqual({
            isError: true,
            reason: expect.stringContaining('no menu item called "Help > "'),
        });
        expect(clickAgentMenuItem('Nowhere > Gone', null, menu)).toEqual({
            isError: true,
            reason: expect.stringContaining('no menu item called'),
        });
        expect(click).not.toHaveBeenCalled();
    });

    test('each refused role says what it does, and none is pressed (F-1)', () => {
        const click = vi.fn();
        const item = (label: string, role: string) => {
            return { label, role, type: 'normal', enabled: true, click };
        };
        const menu = {
            items: [
                {
                    label: 'Edit',
                    type: 'submenu',
                    submenu: {
                        items: [
                            {
                                label: 'Speech',
                                type: 'submenu',
                                submenu: {
                                    items: [
                                        item('Start Speaking', 'startSpeaking'),
                                        item('Stop Speaking', 'stopSpeaking'),
                                    ],
                                },
                            },
                        ],
                    },
                },
                {
                    label: 'Window',
                    type: 'submenu',
                    submenu: {
                        items: [
                            item('Bring All to Front', 'front'),
                            item('Hide Others', 'hideOthers'),
                            item('Show All', 'unhide'),
                            item('Services', 'services'),
                        ],
                    },
                },
            ],
        } as any;
        const said = (path: string) => {
            const result = clickAgentMenuItem(path, null, menu);
            expect(result, path).toMatchObject({ isError: true });
            return (result as { reason: string }).reason;
        };
        expect(said('Edit > Speech > Start Speaking')).toContain('aloud');
        expect(said('Edit > Speech > Stop Speaking')).toContain('aloud');
        expect(said('Window > Bring All to Front')).toContain('in front of');
        expect(said('Window > Hide Others')).toContain('hides');
        expect(said('Window > Show All')).toContain('brings back');
        expect(said('Window > Services')).toContain('another program');
        for (const path of [
            'Edit > Speech > Start Speaking',
            'Window > Bring All to Front',
        ]) {
            expect(said(path)).not.toContain('closes');
        }
        expect(click).not.toHaveBeenCalled();
    });
});
