// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MIRROR_REMOTE_DISPLAY_FIRST } from '../../../electron/screenMirrorProtocol';
import { VIRTUAL_DISPLAY_ID_BASE } from '../../../electron/virtualDisplayProtocol';

const h = vi.hoisted(() => ({
    displays: [] as any[],
    primaryDisplay: { id: 1 } as any,
    screenManagerBase: null as any,
    eventCalls: [] as any[][],
    menuCalls: [] as { event: any; items: any[] }[],
    setMirrorPanelShowing: vi.fn(),
}));

vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (event: any, items: any[]) => {
        h.menuCalls.push({ event, items });
    },
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../managers/screenHelpers', () => ({
    getAllDisplays: () => ({
        primaryDisplay: h.primaryDisplay,
        displays: h.displays,
    }),
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../../screen-mirror/mirrorConnectionHelpers', () => ({
    setMirrorPanelShowing: h.setMirrorPanelShowing,
}));
vi.mock('../managers/screenManagerHooks', () => ({
    useScreenManagerBaseContext: () => h.screenManagerBase,
    useScreenManagerEvents: (...args: any[]) => {
        h.eventCalls.push(args);
    },
}));

import DisplayControlComp from './DisplayControlComp';

const VIRTUAL_ID = VIRTUAL_DISPLAY_ID_BASE - 1;
const GUEST_ID = MIRROR_REMOTE_DISPLAY_FIRST - 2;

let container: HTMLDivElement;
let root: Root;

function genDisplay(id: number, label: string, extra: object = {}) {
    return { id, label, bounds: { width: 1920, height: 1080 }, ...extra };
}

async function renderComp(displayId: number) {
    h.screenManagerBase = { screenId: 5, displayId };
    await act(async () => {
        root.render(<DisplayControlComp />);
    });
    return container.querySelector('button')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.displays = [];
    h.primaryDisplay = { id: 1 };
    h.eventCalls.length = 0;
    h.menuCalls.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('DisplayControlComp', () => {
    test('names a connected display by its OS label', async () => {
        h.displays = [genDisplay(1, ' DELL U2419 ')];
        const button = await renderComp(1);
        expect(button.title).toBe(
            'Display: DELL U2419, Screen id: 5, Display id: 1',
        );
        expect(button.textContent).toBe('DELL U2419(5):1');
        expect(button.querySelector('i')!.className).toBe('bi bi-display');
        // It re-renders when this screen's display changes.
        expect(h.eventCalls[0]).toEqual([['display-id'], h.screenManagerBase]);
    });

    test('an unnamed display reads as primary or unnamed, never "Unknown"', async () => {
        h.displays = [genDisplay(1, ''), genDisplay(2, '   ')];
        let button = await renderComp(1);
        expect(button.title).toContain('Display: Primary display,');

        button = await renderComp(2);
        expect(button.title).toContain('Display: Unnamed display,');

        // A display flagged primary by the OS counts as primary too.
        h.displays = [genDisplay(3, '', { isPrimary: true })];
        button = await renderComp(3);
        expect(button.title).toContain('Display: Primary display,');
    });

    test('a display that is gone warns before it is pressed', async () => {
        h.displays = [genDisplay(1, 'Main')];
        let button = await renderComp(9);
        expect(button.querySelector('i')!.className).toContain(
            'bi-exclamation-triangle',
        );
        expect(button.title).toContain('Display: Not connected,');
        expect(button.textContent).toBe('(5):9');

        button = await renderComp(VIRTUAL_ID);
        expect(button.title).toContain('Display: Virtual display not found,');

        button = await renderComp(GUEST_ID);
        expect(button.title).toContain(
            'Display: Guest display, not connected,',
        );
    });

    test('a guest or virtual display shows its name and size', async () => {
        h.displays = [
            genDisplay(GUEST_ID, 'Lobby TV', {
                guestId: 'g1',
                bounds: { width: 1280, height: 720 },
            }),
            genDisplay(VIRTUAL_ID, 'Stream'),
        ];
        let button = await renderComp(GUEST_ID);
        expect(button.textContent).toBe('Lobby TV: 1280x720');
        expect(button.querySelector('i')!.className).toBe('bi bi-display');

        button = await renderComp(VIRTUAL_ID);
        expect(button.textContent).toBe('Stream: 1920x1080');
    });

    test('pressing it lists every display and where virtual ones are made', async () => {
        h.displays = [
            genDisplay(1, 'Main'),
            genDisplay(2, ''),
            genDisplay(VIRTUAL_ID, 'Stream'),
            genDisplay(GUEST_ID, 'Lobby TV', { guestId: 'g1' }),
        ];
        const button = await renderComp(2);
        await act(async () => {
            button.click();
        });
        const { items } = h.menuCalls[0];
        expect(
            items.map((item: any) => {
                return item.menuElement;
            }),
        ).toEqual([
            'Main(1): 1920x1080 (primary)',
            '*Unnamed display(2): 1920x1080',
            'Stream (Virtual): 1920x1080',
            'Lobby TV: 1920x1080',
            'Manage Virtual Displays',
        ]);
        expect(items[4].childBefore).toBe('icon:display');

        items[2].onSelect();
        expect(h.screenManagerBase.displayId).toBe(VIRTUAL_ID);

        items[4].onSelect();
        expect(h.setMirrorPanelShowing).toHaveBeenCalledWith(true, 'virtual');
    });
});
