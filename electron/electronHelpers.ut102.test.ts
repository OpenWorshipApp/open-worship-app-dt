/**
 * The Windows answers of `electronHelpers`, read the way the module reads
 * them -- once, at load, off `process.platform` and the OS release -- on
 * whatever system the suite runs on.
 */
import type * as NodeFs from 'node:fs';
import type * as NodeOs from 'node:os';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { osState, settingManagerMock } = vi.hoisted(() => ({
    osState: { release: '10.0.22631' },
    settingManagerMock: {
        getPopupWinBounds: vi.fn(() => null),
        setPopupWinBounds: vi.fn(),
        clearPopupWinBounds: vi.fn(),
    },
}));

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

// No `.env` file is read: none is there.
vi.mock('node:fs', async (importActual) => ({
    ...(await importActual<typeof NodeFs>()),
    existsSync: () => false,
}));

vi.mock('node:os', async (importActual) => ({
    ...(await importActual<typeof NodeOs>()),
    release: () => osState.release,
}));

vi.mock('./ElectronSettingManager', () => ({
    default: { getInstance: () => settingManagerMock },
}));

import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

let platformDescriptor: PropertyDescriptor | undefined;
let windowsStoreDescriptor: PropertyDescriptor | undefined;

async function loadOnWindows(release: string) {
    osState.release = release;
    Object.defineProperty(process, 'platform', {
        configurable: true,
        value: 'win32',
    });
    vi.resetModules();
    return import('./electronHelpers');
}

beforeEach(() => {
    electronMockState.reset();
    platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    windowsStoreDescriptor = Object.getOwnPropertyDescriptor(
        process,
        'windowsStore',
    );
});

afterEach(() => {
    if (platformDescriptor !== undefined) {
        Object.defineProperty(process, 'platform', platformDescriptor);
    }
    if (windowsStoreDescriptor === undefined) {
        delete (process as any).windowsStore;
    } else {
        Object.defineProperty(process, 'windowsStore', windowsStoreDescriptor);
    }
    osState.release = '10.0.22631';
});

describe('on Windows', () => {
    test('a glass backdrop from Windows 11 22H2 (build 22621) on', async () => {
        const helpers = await loadOnWindows('10.0.22631');
        expect(helpers.isWindows).toBe(true);
        expect(helpers.isMac).toBe(false);
        expect(helpers.isLinux).toBe(false);
        expect(helpers.isGlassCapable).toBe(true);

        expect((await loadOnWindows('10.0.22621')).isGlassCapable).toBe(true);
    });

    test('no glass on an older build, or a release with no build number', async () => {
        expect((await loadOnWindows('10.0.22000')).isGlassCapable).toBe(false);
        expect((await loadOnWindows('10.0.19045')).isGlassCapable).toBe(false);
        expect((await loadOnWindows('10.0')).isGlassCapable).toBe(false);
        expect((await loadOnWindows('10.0.beta')).isGlassCapable).toBe(false);
    });

    test("a glassy popup gets Windows' acrylic, an opaque one where it cannot", async () => {
        const openGlassy = (
            helpers: Awaited<ReturnType<typeof loadOnWindows>>,
        ) => {
            const parentWin = createMockBrowserWindow();
            helpers.guardBrowsing(
                parentWin as any,
                {
                    preload: '/tmp/preload.js',
                } as any,
            );
            const windowOpenHandler =
                parentWin.webContents.setWindowOpenHandler.mock.calls[0][0];
            return windowOpenHandler({
                url: 'https://localhost:3000/about.html?uuid=glass',
                frameName: `${helpers.POPUP_FRAME_NAME_PREFIX}_glass`,
                features: 'popup,appGlassy',
            } as any).overrideBrowserWindowOptions;
        };

        const glassy = openGlassy(await loadOnWindows('10.0.22631'));
        expect(glassy).toMatchObject({
            backgroundColor: '#00000000',
            backgroundMaterial: 'acrylic',
        });
        expect(glassy).not.toHaveProperty('vibrancy');

        const opaque = openGlassy(await loadOnWindows('10.0.19045'));
        expect(opaque).not.toHaveProperty('backgroundMaterial');
        expect(opaque.backgroundColor).not.toBe('#00000000');
    });

    test("a shortcut is written with Windows' own modifiers", async () => {
        const helpers = await loadOnWindows('10.0.22631');
        expect(
            helpers.toShortcutKey({
                wControlKey: ['Shift', 'Ctrl'],
                mControlKey: ['Meta'],
                lControlKey: ['Super'],
                key: 'f',
            } as any),
        ).toBe('Ctrl + Shift + F');
        // A shortcut with no Windows modifier is the key alone.
        expect(
            helpers.toShortcutKey({
                mControlKey: ['Meta'],
                key: 'Enter',
            } as any),
        ).toBe('Enter');
    });

    test('a Store install is told by Electron itself', async () => {
        Object.defineProperty(process, 'windowsStore', {
            configurable: true,
            value: true,
        });
        expect((await loadOnWindows('10.0.22631')).isWindowsStore).toBe(true);
        delete (process as any).windowsStore;
        expect((await loadOnWindows('10.0.22631')).isWindowsStore).toBe(false);
    });
});
