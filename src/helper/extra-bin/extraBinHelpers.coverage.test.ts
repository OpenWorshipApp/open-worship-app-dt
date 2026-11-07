import { beforeEach, describe, expect, test, vi } from 'vitest';

// The Settings panel hears the pack changed only until it lets go, and an old
// pack is moved as far as it can be when one of its entries will not move.
const h = vi.hoisted(() => ({
    systemUtils: {
        isWindows: true,
        isMac: false,
        isArm64: false,
        is64System: true,
    },
    listeners: new Map<string, Set<() => void>>(),
    fsCheckFileExist: vi.fn(),
    fsReadFile: vi.fn(),
    fsList: vi.fn(),
    fsMove: vi.fn(),
    ensureDirectory: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        systemUtils: h.systemUtils,
        messageUtils: {
            sendData: () => {},
            listenForData: (channel: string, handler: () => void) => {
                const handlers = h.listeners.get(channel) ?? new Set();
                handlers.add(handler);
                h.listeners.set(channel, handlers);
            },
            removeListener: (channel: string, handler: () => void) => {
                h.listeners.get(channel)?.delete(handler);
            },
        },
    },
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: async () => false,
}));
vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: h.ensureDirectory,
    fsCheckFileExist: h.fsCheckFileExist,
    fsList: h.fsList,
    fsMove: h.fsMove,
    fsReadFile: h.fsReadFile,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorageDirPath: '/data' },
}));

import {
    moveLegacyExtraBinPack,
    registerExtraBinChangedListener,
} from './extraBinHelpers';

function emit(channel: string) {
    for (const handler of h.listeners.get(channel) ?? []) {
        handler();
    }
}

beforeEach(() => {
    h.listeners.clear();
    Object.assign(h.systemUtils, {
        isWindows: true,
        isMac: false,
        isArm64: false,
        is64System: true,
    });
    h.fsCheckFileExist.mockImplementation(async (filePath: string) => {
        return filePath === '/data/extra-bin/info.json';
    });
    h.fsList.mockResolvedValue([]);
    h.fsMove.mockResolvedValue(undefined);
    h.ensureDirectory.mockResolvedValue(undefined);
});

describe('registerExtraBinChangedListener', () => {
    test('hears what the main process relays until it is unregistered', () => {
        const handler = vi.fn();
        const unregister = registerExtraBinChangedListener(handler);

        emit('main:app:extra-bin-changed');
        // The broadcast a window sends is not what it listens on.
        emit('all:app:extra-bin-changed');
        expect(handler).toHaveBeenCalledTimes(1);

        unregister();
        emit('main:app:extra-bin-changed');
        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe('moveLegacyExtraBinPack', () => {
    test('moves the rest of the pack when one entry will not move', async () => {
        h.fsReadFile.mockResolvedValue('{"platform":"win"}');
        h.fsList.mockResolvedValue([{ name: 'yt' }, { name: 'ffmpeg' }]);
        const error = new Error('EBUSY');
        h.fsMove.mockImplementation(async (from: string) => {
            if (from === '/data/extra-bin/yt') {
                throw error;
            }
        });

        await moveLegacyExtraBinPack();

        expect(h.ensureDirectory).toHaveBeenCalledWith('/data/extra-bin/win');
        expect(h.fsMove).toHaveBeenLastCalledWith(
            '/data/extra-bin/ffmpeg',
            '/data/extra-bin/win/ffmpeg',
        );
        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(error);
    });

    test('takes an Intel Mac pack in on Apple silicon', async () => {
        Object.assign(h.systemUtils, {
            isWindows: false,
            isMac: true,
            isArm64: true,
        });
        h.fsReadFile.mockResolvedValue('{"platform":"mac-int"}');
        h.fsList.mockResolvedValue([{ name: 'qjs' }]);

        await moveLegacyExtraBinPack();

        expect(h.fsMove).toHaveBeenCalledExactlyOnceWith(
            '/data/extra-bin/qjs',
            '/data/extra-bin/mac/qjs',
        );
    });

    test('leaves a pack whose info will not parse where it is', async () => {
        h.fsReadFile.mockResolvedValue('{"platform":');
        h.fsList.mockResolvedValue([{ name: 'yt' }]);

        await moveLegacyExtraBinPack();

        expect(h.ensureDirectory).not.toHaveBeenCalled();
        expect(h.fsMove).not.toHaveBeenCalled();
    });
});
