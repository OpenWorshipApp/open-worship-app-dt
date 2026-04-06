import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

import {
    startAgentDebugServer,
    maybeStartAgentDebugServer,
} from './agentDebugServer';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

describe('agentDebugServer', () => {
    beforeEach(() => {
        electronMockState.reset();
        delete process.env.OPEN_WORSHIP_AGENT_DEBUG;
        delete process.env.OPEN_WORSHIP_AGENT_DEBUG_PORT;
        delete process.env.OPEN_WORSHIP_AGENT_DEBUG_TOKEN;
    });

    afterEach(async () => {
        delete process.env.OPEN_WORSHIP_AGENT_DEBUG;
        delete process.env.OPEN_WORSHIP_AGENT_DEBUG_PORT;
        delete process.env.OPEN_WORSHIP_AGENT_DEBUG_TOKEN;
    });

    test('does not start when agent debug is disabled', async () => {
        const appController = {
            mainWin: createMockBrowserWindow(),
        };

        await expect(
            maybeStartAgentDebugServer(appController as any),
        ).resolves.toBeNull();
    });

    test('serves screenshot and renderer snapshot data', async () => {
        const mainWin = createMockBrowserWindow();
        mainWin.webContents.executeJavaScript.mockResolvedValue({
            title: 'Presenter',
            locationHref: 'https://localhost:3000/presenter.html',
            customData: {
                page: 'presenter',
                selectionCount: 2,
            },
        });
        mainWin.webContents.capturePage.mockResolvedValue({
            toPNG: () => Buffer.from('png-data'),
        });
        const appController = {
            mainWin,
        };
        const debugServer = await startAgentDebugServer(appController as any, {
            port: 0,
            token: null,
            log: () => {},
        });

        try {
            const snapshotResponse = await fetch(
                `${debugServer.baseUrl}/snapshot`,
            );
            const snapshot = (await snapshotResponse.json()) as {
                window: {
                    url: string;
                };
                renderer: {
                    customData: {
                        page: string;
                        selectionCount: number;
                    };
                };
            };
            expect(snapshot.window.url).toBe(
                'https://localhost:3000/presenter.html',
            );
            expect(snapshot.renderer.customData.page).toBe('presenter');
            expect(snapshot.renderer.customData.selectionCount).toBe(2);

            const screenshotResponse = await fetch(
                `${debugServer.baseUrl}/screenshot.png`,
            );
            const screenshotBuffer = Buffer.from(
                await screenshotResponse.arrayBuffer(),
            );
            expect(screenshotBuffer.equals(Buffer.from('png-data'))).toBe(true);
        } finally {
            await debugServer.close();
        }
    });

    test('requires authorization when token is configured', async () => {
        const mainWin = createMockBrowserWindow();
        mainWin.webContents.executeJavaScript.mockResolvedValue({
            title: 'Presenter',
        });
        const appController = {
            mainWin,
        };
        const debugServer = await startAgentDebugServer(appController as any, {
            port: 0,
            token: 'secret',
            log: () => {},
        });

        try {
            const unauthorizedResponse = await fetch(
                `${debugServer.baseUrl}/dom`,
            );
            expect(unauthorizedResponse.status).toBe(401);

            const authorizedResponse = await fetch(
                `${debugServer.baseUrl}/dom?token=secret`,
            );
            expect(authorizedResponse.status).toBe(200);
        } finally {
            await debugServer.close();
        }
    });
});
