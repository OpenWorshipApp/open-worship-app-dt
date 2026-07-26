// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { showSimpleToastMock } = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../event/ToastEventListener', () => ({
    default: {
        showSimpleToast: showSimpleToastMock,
    },
}));

import { showSimpleToast } from './toastHelpers';

describe('toastHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('forwards simple toast payloads to the event listener', () => {
        showSimpleToast('Saved', 'The file was saved');

        expect(showSimpleToastMock).toHaveBeenCalledWith({
            title: 'Saved',
            message: 'The file was saved',
        });
    });
    test('the dev-only probe fires three staggered toasts', async () => {
        vi.useFakeTimers();
        try {
            const testSimpleToasts = (globalThis as any).testSimpleToasts;
            expect(testSimpleToasts).toBeTypeOf('function');

            const pending = testSimpleToasts();
            expect(showSimpleToastMock).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(500);
            expect(showSimpleToastMock).toHaveBeenCalledTimes(2);
            await vi.advanceTimersByTimeAsync(500);
            await pending;
            expect(showSimpleToastMock).toHaveBeenCalledTimes(3);
        } finally {
            vi.useRealTimers();
        }
    });
});
