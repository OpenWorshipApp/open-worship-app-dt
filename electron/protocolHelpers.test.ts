import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

import { createMockBrowserWindow } from './testUtils';

describe('protocolHelpers', () => {
    beforeEach(async () => {
        vi.resetModules();
    });

    test('loads dev URL for renderer page', async () => {
        vi.doMock('./electronHelpers', () => ({ isDev: true }));
        vi.doMock('./fsServe', () => ({ rootUrl: 'owa://local' }));

        const { genRoutProps } = await import('./protocolHelpers');
        const win = createMockBrowserWindow();

        const route = genRoutProps('presenter.html');
        route.loadURL(win as any, '?foo=bar');

        expect(
            route.preloadFilePath.endsWith(
                path.join('client', 'preloadProvider.js'),
            ),
        ).toBe(true);
        expect(win.loadURL).toHaveBeenCalledWith(
            'https://localhost:3000/presenter.html?foo=bar',
        );
    });

    test('loads custom scheme URL in production mode', async () => {
        vi.doMock('./electronHelpers', () => ({ isDev: false }));
        vi.doMock('./fsServe', () => ({ rootUrl: 'owa://local' }));

        const { genRoutProps } = await import('./protocolHelpers');
        const win = createMockBrowserWindow();

        genRoutProps('screen.html').loadURL(win as any);

        expect(win.loadURL).toHaveBeenCalledWith('owa://local/screen.html');
    });
});
