import type * as NodeFs from 'node:fs';
import type * as NodeOs from 'node:os';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { existsSync, readFileSync } = vi.hoisted(() => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('node:fs', async (importActual) => ({
    ...(await importActual<typeof NodeFs>()),
    existsSync,
    readFileSync,
}));

vi.mock('node:os', async (importActual) => ({
    ...(await importActual<typeof NodeOs>()),
    release: () => '23.6.0',
}));

const { settingManagerMock } = vi.hoisted(() => ({
    settingManagerMock: {
        getPopupWinBounds: vi.fn(() => null),
        setPopupWinBounds: vi.fn(),
        clearPopupWinBounds: vi.fn(),
    },
}));

vi.mock('./ElectronSettingManager', () => ({
    default: { getInstance: () => settingManagerMock },
}));

import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

let platformDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
    vi.resetModules();
    electronMockState.reset();
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(
        [
            '# comment',
            'export OWA_ENV_QUOTED = "first value"',
            "OWA_ENV_SINGLE='second value'",
            'OWA.ENV.DOTTED = plain',
            'not an assignment',
            '',
        ].join('\r\n'),
    );
    platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', {
        configurable: true,
        value: 'darwin',
    });
});

afterEach(() => {
    if (platformDescriptor !== undefined) {
        Object.defineProperty(process, 'platform', platformDescriptor);
    }
    delete process.env.OWA_ENV_QUOTED;
    delete process.env.OWA_ENV_SINGLE;
    delete process.env['OWA.ENV.DOTTED'];
});

test('loads quoted env values and selects macOS shortcuts and glass options', async () => {
    const helpers = await import('./electronHelpers');

    expect(process.env.OWA_ENV_QUOTED).toBe('first value');
    expect(process.env.OWA_ENV_SINGLE).toBe('second value');
    expect(process.env['OWA.ENV.DOTTED']).toBe('plain');
    expect(
        helpers.toShortcutKey({ mControlKey: ['Meta', 'Option'], key: 'k' }),
    ).toBe('Command + Option + K');

    const parentWin = createMockBrowserWindow();
    helpers.guardBrowsing(
        parentWin as any,
        {
            preload: '/tmp/preload.js',
        } as any,
    );
    const windowOpenHandler =
        parentWin.webContents.setWindowOpenHandler.mock.calls[0][0];
    const response = windowOpenHandler({
        url: 'https://localhost:3000/about.html?uuid=glass',
        frameName: `${helpers.POPUP_FRAME_NAME_PREFIX}_glass`,
        features: 'popup,appGlassy',
    } as any);

    expect(response.overrideBrowserWindowOptions).toMatchObject({
        backgroundColor: '#00000000',
        vibrancy: 'under-window',
        visualEffectState: 'active',
    });
});

test('ignores a missing env file', async () => {
    existsSync.mockReturnValue(false);

    await expect(import('./electronHelpers')).resolves.toBeDefined();
    expect(readFileSync).not.toHaveBeenCalled();
});

test('uses Linux-specific shortcut modifiers', async () => {
    Object.defineProperty(process, 'platform', {
        configurable: true,
        value: 'linux',
    });
    vi.resetModules();

    const helpers = await import('./electronHelpers');

    expect(
        helpers.toShortcutKey({ lControlKey: ['Ctrl', 'Super'], key: 'x' }),
    ).toBe('Ctrl + Super + X');
});
