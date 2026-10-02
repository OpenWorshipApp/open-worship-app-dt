import { beforeEach, describe, expect, test, vi } from 'vitest';

const { appProviderMock } = vi.hoisted(() => ({
    appProviderMock: {
        messageUtils: {
            sendData: vi.fn(),
            listenForData: vi.fn(),
            removeListener: vi.fn(),
        },
    },
}));

vi.mock('../../server/appProvider', () => ({ default: appProviderMock }));

import {
    notifyBibleListChanged,
    registerBibleListChangedListener,
} from './bibleListChangeHelpers';

describe('bibleListChangeHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('a change is sent to the main process, which relays it to every window', () => {
        notifyBibleListChanged();

        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:bible-list-changed',
        );
    });

    test('a window listens on the relayed channel and can stop listening', () => {
        const handler = vi.fn();

        const unregister = registerBibleListChangedListener(handler);

        expect(appProviderMock.messageUtils.listenForData).toHaveBeenCalledWith(
            'main:app:bible-list-changed',
            handler,
        );
        expect(appProviderMock.messageUtils.removeListener).not.toHaveBeenCalled();

        unregister();

        // The SAME function, or the IPC listener would never come off.
        expect(appProviderMock.messageUtils.removeListener).toHaveBeenCalledWith(
            'main:app:bible-list-changed',
            handler,
        );
    });
});
