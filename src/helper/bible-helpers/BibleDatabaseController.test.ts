import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    addItemBaseMock: vi.fn(),
    base64EncodeMock: vi.fn((value: string) => `b64:${value}`),
    getInstanceBaseMock: vi.fn(),
    getItemBaseMock: vi.fn(),
    getKeysBaseMock: vi.fn(),
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        appUtils: {
            base64Encode: mocks.base64EncodeMock,
        },
    },
}));

vi.mock('../../db/databaseHelpers', () => ({
    IndexedDbController: class IndexedDbController {
        static async getInstance() {
            return mocks.getInstanceBaseMock(this);
        }

        async addItem(item: any) {
            return mocks.addItemBaseMock(item);
        }

        async getItem<T>(id: string) {
            return mocks.getItemBaseMock(id) as T;
        }

        async getKeys(id: string) {
            return mocks.getKeysBaseMock(id);
        }
    },
}));

import BibleDatabaseController from './BibleDatabaseController';

describe('BibleDatabaseController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getInstanceBaseMock.mockImplementation(async (Class: any) => {
            return new Class();
        });
    });

    test('instantiates the bible store and wraps ids with base64 encoding', async () => {
        const controller = BibleDatabaseController.instantiate();
        expect(controller.storeName).toBe('bible');

        const item = { data: 'payload', id: 'GEN 1' };
        await controller.addItem(item as any);
        expect(mocks.base64EncodeMock).toHaveBeenCalledWith('GEN 1');
        expect(mocks.addItemBaseMock).toHaveBeenCalledWith({
            data: 'payload',
            id: 'b64:GEN 1',
        });

        await controller.getItem('JHN 3:16');
        expect(mocks.getItemBaseMock).toHaveBeenCalledWith('b64:JHN 3:16');

        mocks.getKeysBaseMock.mockResolvedValue(['a', 'b']);
        await expect(controller.getKeys('KJV')).resolves.toEqual(['a', 'b']);
    });

    test('returns a typed instance from the base controller', async () => {
        const controller = await BibleDatabaseController.getInstance();
        expect(controller).toBeInstanceOf(BibleDatabaseController);
        expect(mocks.getInstanceBaseMock).toHaveBeenCalledTimes(1);
    });
});
