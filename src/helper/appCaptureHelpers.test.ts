import { beforeEach, describe, expect, test, vi } from 'vitest';

const { electronSendAsync } = vi.hoisted(() => ({
    electronSendAsync: vi.fn(),
}));

vi.mock('../server/appHelpers', () => ({ electronSendAsync }));

import { captureAppWindow } from './appCaptureHelpers';

beforeEach(() => {
    electronSendAsync.mockResolvedValue('data:image/png;base64,AAAA');
});

describe('captureAppWindow', () => {
    test('with no screen named it photographs the app window itself', async () => {
        await expect(captureAppWindow()).resolves.toBe(
            'data:image/png;base64,AAAA',
        );
        expect(electronSendAsync).toHaveBeenCalledExactlyOnceWith(
            'main:app:capture-window',
            {},
        );
    });

    test('screen 0 is a screen, not "no screen"', async () => {
        await captureAppWindow(0);
        expect(electronSendAsync).toHaveBeenCalledExactlyOnceWith(
            'main:app:capture-window',
            { screenId: 0 },
        );
    });

    test('a screen that is not showing rejects for the caller to handle', async () => {
        electronSendAsync.mockRejectedValue(new Error('Screen 2 is not shown'));
        await expect(captureAppWindow(2)).rejects.toThrow(
            'Screen 2 is not shown',
        );
        expect(electronSendAsync).toHaveBeenCalledWith(
            'main:app:capture-window',
            { screenId: 2 },
        );
    });
});
