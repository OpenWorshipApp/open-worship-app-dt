// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// In-memory setting store so persistence can be round-tripped.
const settingStore = new Map<string, string>();
const getSettingMock = vi.fn((key: string) => {
    return settingStore.has(key) ? (settingStore.get(key) as string) : null;
});
const setSettingMock = vi.fn((key: string, value: string | null) => {
    settingStore.set(key, value ?? '');
});

const appProviderMock = {
    isPagePresenter: true,
    isPageScreen: false,
    systemUtils: { isDev: false },
    messageUtils: { listenForData: vi.fn(), sendData: vi.fn() },
};

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));
vi.mock('../../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));
vi.mock('./screenManagerBaseHelpers', () => ({
    getScreenManagerBase: vi.fn(() => null),
    getSelectedScreenManagerBases: vi.fn(() => []),
    getAllScreenManagerBases: vi.fn(() => []),
}));
vi.mock('../../helper/loggerHelpers', () => ({ appLog: vi.fn() }));

function createBase(screenId = 60) {
    return {
        screenId,
        width: 200,
        height: 100,
        noSyncGroupMap: new Map<string, boolean>(),
        checkIsLockedWithMessage: vi.fn(() => false),
        sendScreenMessage: vi.fn(),
        createScreenManagerBaseGhost: vi.fn((id: number) => ({
            screenId: id,
            isDeleted: true,
        })),
    } as any;
}

async function importManager() {
    const mod = await import('./ScreenFocusManager');
    return mod.default;
}

function focusMessage(screenId: number, data: any) {
    return { screenId, type: 'focus', data } as any;
}

// The overlay is laid out in NATIVE screen px but CSS-scaled by the previewer,
// so give it a half-size box: a click at the box centre must map to the middle
// of the native screen, not to the box coordinates.
function mountOverlay(manager: any) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    div.getBoundingClientRect = () =>
        ({
            left: 0,
            top: 0,
            right: 100,
            bottom: 50,
            width: 100,
            height: 50,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }) as DOMRect;
    manager.div = div;
    return div;
}

function pointerEvent(type: string, clientX: number, clientY: number) {
    return new MouseEvent(type, { clientX, clientY, bubbles: true, button: 0 });
}

// Down lands on the overlay; move/up are window-level so a drag that wanders
// off the mini-preview still tracks and still gets its release.
function press(div: HTMLElement, clientX: number, clientY: number) {
    div.dispatchEvent(pointerEvent('pointerdown', clientX, clientY));
}
function moveTo(clientX: number, clientY: number) {
    globalThis.dispatchEvent(pointerEvent('pointermove', clientX, clientY));
}
function release() {
    globalThis.dispatchEvent(pointerEvent('pointerup', 0, 0));
}

describe('ScreenFocusManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        settingStore.clear();
        appProviderMock.isPagePresenter = true;
        appProviderMock.isPageScreen = false;
        document.body.innerHTML = '';
    });

    test('press-and-hold dims, follows, and undims on release', async () => {
        const ScreenFocusManager = await importManager();
        const base = createBase();
        const manager = new ScreenFocusManager(base);
        const div = mountOverlay(manager);

        // Unarmed (no focus panel open): a press must do nothing at all.
        press(div, 50, 25);
        expect(manager.isSpotlighting).toBe(false);

        manager.setIsArmed(true);
        press(div, 50, 25);
        expect(manager.isSpotlighting).toBe(true);
        // Half-size box -> the centre press is the centre of the native screen.
        expect(manager.point).toEqual({ x: 100, y: 50 });
        expect(manager.isShowing).toBe(true);

        moveTo(25, 10);
        expect(manager.point).toEqual({ x: 50, y: 20 });

        release();
        expect(manager.isSpotlighting).toBe(false);
    });

    test('moves outside a press are ignored, including after release', async () => {
        const ScreenFocusManager = await importManager();
        const manager = new ScreenFocusManager(createBase(61));
        const div = mountOverlay(manager);
        manager.setIsArmed(true);

        moveTo(25, 10);
        expect(manager.point).toBeNull();
        expect(manager.isSpotlighting).toBe(false);

        // After a completed gesture the window listeners must be gone, so a
        // stray move can't resurrect the mask or move a stale hole.
        press(div, 50, 25);
        release();
        moveTo(10, 10);
        expect(manager.isSpotlighting).toBe(false);
        expect(manager.point).toEqual({ x: 100, y: 50 });
    });

    test('disarming drops the mask so a closed panel never leaves a dimmed screen', async () => {
        const ScreenFocusManager = await importManager();
        const base = createBase(62);
        const manager = new ScreenFocusManager(base);
        const div = mountOverlay(manager);
        manager.setIsArmed(true);
        press(div, 50, 25);
        expect(manager.isSpotlighting).toBe(true);

        // Closing the panel mid-press must undim: there would be no visible
        // control left to turn it off with.
        manager.setIsArmed(false);
        expect(manager.isSpotlighting).toBe(false);
        expect(base.sendScreenMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({
                type: 'focus',
                data: expect.objectContaining({ isSpotlighting: false }),
            }),
            false,
        );
    });

    test('only the pressed overlay claims the size/dim keys', async () => {
        const ScreenFocusManager = await importManager();
        const managerA = new ScreenFocusManager(createBase(66));
        const managerB = new ScreenFocusManager(createBase(67));
        const divA = mountOverlay(managerA);
        mountOverlay(managerB);
        managerA.setIsArmed(true);
        managerB.setIsArmed(true);

        // Nobody pressed yet: a key must not act on either screen.
        expect(managerA.isShortcutTarget).toBe(false);
        expect(managerB.isShortcutTarget).toBe(false);

        press(divA, 50, 25);
        release();
        expect(managerA.isShortcutTarget).toBe(true);
        expect(managerB.isShortcutTarget).toBe(false);

        // Closing the panel drops the claim along with the ring.
        managerA.setIsArmed(false);
        expect(managerA.isShortcutTarget).toBe(false);
    });

    test('resetSettings restores the shipped defaults', async () => {
        const ScreenFocusManager = await importManager();
        const manager = new ScreenFocusManager(createBase(68));
        manager.setSize(1000);
        manager.setDimColor('#123456');
        manager.setDimOpacity(20);
        manager.setEdgeBlur(0);
        manager.setIsContrast(true);

        manager.resetSettings();
        expect(manager.size).toBe(300);
        expect(manager.dimColor).toBe('#000000');
        expect(manager.dimOpacity).toBe(70);
        expect(manager.edgeBlur).toBe(35);
        expect(manager.isContrast).toBe(false);
    });

    test('edge blur 0 paints a hard-edged hole', async () => {
        const ScreenFocusManager = await importManager();
        const manager = new ScreenFocusManager(createBase(69));
        const div = mountOverlay(manager);
        manager.setIsArmed(true);
        manager.setSize(200);
        manager.setDimOpacity(50);

        manager.setEdgeBlur(0);
        press(div, 50, 25);
        // Clear all the way to the rim, dim from the rim out: no gradient band.
        // The clear stop is the dim colour at alpha 00, not the `transparent`
        // keyword, so a soft rim can't pick up a tint on the way out.
        expect(div.style.background).toContain('#00000000 100%');
        expect(div.style.background).toContain('circle 100px at 100px 50px');

        manager.setEdgeBlur(40);
        expect(div.style.background).toContain('#00000000 60%');

        // Contrast inverts which side of the rim is dark: the circle blocks
        // what the pointer is over and the rest of the screen stays clear.
        manager.setIsContrast(true);
        expect(div.style.background).toContain(
            '#00000080 0, #00000080 60%, #00000000 100%',
        );

        // Releasing removes the mask entirely rather than leaving a transparent
        // gradient painting over the slide.
        release();
        expect(div.style.background).toBe('none');
    });

    test('the dim is the chosen color at the dim alpha', async () => {
        const ScreenFocusManager = await importManager();
        const manager = new ScreenFocusManager(createBase(70));
        const div = mountOverlay(manager);
        manager.setIsArmed(true);
        manager.setSize(200);
        manager.setEdgeBlur(0);

        manager.setDimColor('#1E3A8A');
        manager.setDimOpacity(60);
        press(div, 50, 25);
        // Normalized to lower case, and the alpha is the dim percentage:
        // round(0.6 * 255) = 153 = 0x99.
        expect(div.style.background).toContain('#1e3a8a99');
        expect(div.style.background).toContain('#1e3a8a00 100%');

        // Anything that isn't #rrggbb would make the whole gradient
        // unparseable, which paints NOTHING — i.e. silently undims the screen.
        manager.setDimColor('rgb(1, 2, 3)' as any);
        expect(manager.dimColor).toBe('#000000');

        // Persisted and reloaded like the numeric settings.
        manager.setDimColor('#ff8800');
        await new Promise((resolve) => {
            setTimeout(resolve, 250);
        });
        expect(setSettingMock).toHaveBeenCalledWith(
            'screen-focus-color-70',
            '#ff8800',
        );
        expect(new ScreenFocusManager(createBase(70)).dimColor).toBe('#ff8800');
    });

    test('size and dim are clamped, debounce-persisted and reload', async () => {
        const ScreenFocusManager = await importManager();
        const manager = new ScreenFocusManager(createBase(63));
        expect(manager.size).toBe(300);
        expect(manager.dimOpacity).toBe(70);

        manager.setSize(99999);
        manager.setDimOpacity(-5);
        // Applied at once so the mask tracks the slider thumb...
        expect(manager.size).toBe(1200);
        expect(manager.dimOpacity).toBe(10);
        // ...but the disk write trails the drag.
        expect(setSettingMock).not.toHaveBeenCalled();

        manager.setSize(420);
        await new Promise((resolve) => {
            setTimeout(resolve, 250);
        });
        expect(setSettingMock).toHaveBeenCalledWith(
            'screen-focus-size-63',
            '420',
        );
        expect(setSettingMock).toHaveBeenCalledWith(
            'screen-focus-dim-63',
            '10',
        );

        const reloaded = new ScreenFocusManager(createBase(63));
        expect(reloaded.size).toBe(420);
        expect(reloaded.dimOpacity).toBe(10);
        // The spotlight itself is never restored: an app restart must not come
        // back with the congregation's screen dimmed.
        expect(reloaded.isSpotlighting).toBe(false);
    });

    test('the panel-open toggle persists and reopens, but never the spotlight', async () => {
        const ScreenFocusManager = await importManager();
        const manager = new ScreenFocusManager(createBase(71));
        expect(manager.isPanelOpen).toBe(false);

        manager.setIsPanelOpen(true);
        expect(setSettingMock).toHaveBeenCalledWith(
            'screen-focus-open-71',
            'true',
        );
        const reloaded = new ScreenFocusManager(createBase(71));
        expect(reloaded.isPanelOpen).toBe(true);
        // Only the PANEL comes back. A restart must never restore a dimmed
        // screen, so the mask itself stays off regardless.
        expect(reloaded.isSpotlighting).toBe(false);
        expect(reloaded.isArmed).toBe(false);

        manager.setIsPanelOpen(false);
        expect(new ScreenFocusManager(createBase(71)).isPanelOpen).toBe(false);
    });

    test('receiveSyncScreen adopts the state and clones the point', async () => {
        const ScreenFocusManager = await importManager();
        const manager = new ScreenFocusManager(createBase(64));
        mountOverlay(manager);
        // Group members share the same message object in-process, so a stored
        // point must not be the sender's own object.
        const shared = { x: 12, y: 34 };
        manager.receiveSyncScreen(
            focusMessage(64, {
                isSpotlighting: true,
                point: shared,
                size: 500,
                dimColor: '#00ff00',
                dimOpacity: 45,
                isContrast: true,
            }),
        );
        expect(manager.isSpotlighting).toBe(true);
        expect(manager.size).toBe(500);
        expect(manager.dimColor).toBe('#00ff00');
        expect(manager.dimOpacity).toBe(45);
        expect(manager.isContrast).toBe(true);
        shared.x = 999;
        expect(manager.point).toEqual({ x: 12, y: 34 });
    });

    test('output windows neither capture input nor persist', async () => {
        const ScreenFocusManager = await importManager();
        appProviderMock.isPagePresenter = false;
        appProviderMock.isPageScreen = true;
        const manager = new ScreenFocusManager(createBase(65));
        const div = mountOverlay(manager);
        manager.setIsArmed(true);

        press(div, 50, 25);
        expect(manager.isSpotlighting).toBe(false);

        manager.setSize(500);
        await new Promise((resolve) => {
            setTimeout(resolve, 250);
        });
        expect(setSettingMock).not.toHaveBeenCalled();
    });
});
