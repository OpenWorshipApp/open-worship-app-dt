import { beforeEach, describe, expect, test, vi } from 'vitest';

const { sendDataSyncMock, sendDataMock } = vi.hoisted(() => ({
    sendDataSyncMock: vi.fn(),
    sendDataMock: vi.fn(),
}));

vi.mock('./appProvider', () => ({
    default: {
        messageUtils: {
            sendDataSync: sendDataSyncMock,
            sendData: sendDataMock,
        },
    },
}));

import { appSecureStorage } from './appSecureStorage';

describe('server appSecureStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('getItem returns the string value or null for non-strings', () => {
        sendDataSyncMock.mockReturnValue('sk-secret');
        expect(appSecureStorage.getItem('k')).toBe('sk-secret');
        expect(sendDataSyncMock).toHaveBeenCalledWith(
            'main:app:secure-setting',
            { type: 'get', key: 'k' },
        );

        // nothing stored, or the OS could not decrypt it
        sendDataSyncMock.mockReturnValue(null);
        expect(appSecureStorage.getItem('k')).toBeNull();
    });

    test('setItem and removeItem send messages', () => {
        appSecureStorage.setItem('k', 'sk-secret');
        expect(sendDataMock).toHaveBeenCalledWith('main:app:secure-setting', {
            type: 'set',
            key: 'k',
            value: 'sk-secret',
        });
        appSecureStorage.removeItem('k');
        expect(sendDataMock).toHaveBeenCalledWith('main:app:secure-setting', {
            type: 'delete',
            key: 'k',
        });
    });

    test('clear sends the clear message', () => {
        appSecureStorage.clear();
        expect(sendDataSyncMock).toHaveBeenCalledWith(
            'main:app:secure-setting',
            { type: 'clear', key: '' },
        );
    });

    test('availability is resolved once, since it is read during render', () => {
        sendDataSyncMock.mockReturnValue(true);

        expect(appSecureStorage.checkIsAvailable()).toBe(true);
        expect(appSecureStorage.checkIsAvailable()).toBe(true);
        expect(sendDataSyncMock).toHaveBeenCalledTimes(1);
        expect(sendDataSyncMock).toHaveBeenCalledWith(
            'main:app:secure-setting',
            { type: 'is-available', key: '' },
        );
    });
});
