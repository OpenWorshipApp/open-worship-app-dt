import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('devtools', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test('opens devtools only in development mode', async () => {
        const openDevTools = vi.fn();
        vi.doMock('./electronHelpers', () => ({ isDev: true }));

        const { initDevtools } = await import('./devtools');
        await initDevtools({
            mainController: {
                win: {
                    webContents: { openDevTools },
                },
            },
        } as any);

        expect(openDevTools).toHaveBeenCalledTimes(1);
    });

    test('skips opening devtools outside development mode', async () => {
        const openDevTools = vi.fn();
        vi.doMock('./electronHelpers', () => ({ isDev: false }));

        const { initDevtools } = await import('./devtools');
        await initDevtools({
            mainController: {
                win: {
                    webContents: { openDevTools },
                },
            },
        } as any);

        expect(openDevTools).not.toHaveBeenCalled();
    });
});
