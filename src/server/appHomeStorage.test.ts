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

import { appHomeStorage } from './appHomeStorage';

describe('server appHomeStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('getItem returns the string value or null for non-strings', () => {
        sendDataSyncMock.mockReturnValue('value');
        expect(appHomeStorage.getItem('k')).toBe('value');
        expect(sendDataSyncMock).toHaveBeenCalledWith(
            'main:app:client-setting',
            { type: 'get', key: 'k' },
        );

        sendDataSyncMock.mockReturnValue(undefined);
        expect(appHomeStorage.getItem('k')).toBeNull();
    });

    test('setItem and removeItem send messages', () => {
        appHomeStorage.setItem('k', 'v');
        expect(sendDataMock).toHaveBeenCalledWith('main:app:client-setting', {
            type: 'set',
            key: 'k',
            value: 'v',
        });
        appHomeStorage.removeItem('k');
        expect(sendDataMock).toHaveBeenCalledWith('main:app:client-setting', {
            type: 'delete',
            key: 'k',
        });
    });

    test('clear sends the clear message', () => {
        appHomeStorage.clear();
        expect(sendDataSyncMock).toHaveBeenCalledWith(
            'main:app:client-setting',
            { type: 'clear', key: '' },
        );
    });

    test('getAllKeys parses a JSON array or returns empty', () => {
        sendDataSyncMock.mockReturnValue(JSON.stringify(['a', 'b']));
        expect(appHomeStorage.getAllKeys()).toEqual(['a', 'b']);

        // non-array json
        sendDataSyncMock.mockReturnValue(JSON.stringify({ not: 'array' }));
        expect(appHomeStorage.getAllKeys()).toEqual([]);

        // null message
        sendDataSyncMock.mockReturnValue(undefined);
        expect(appHomeStorage.getAllKeys()).toEqual([]);
    });
});
