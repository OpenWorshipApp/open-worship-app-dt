import { beforeEach, describe, expect, test, vi } from 'vitest';

// A chapter that is not there yet is never cached, and a Bible with nothing
// stored clears nothing.
const mocks = vi.hoisted(() => ({
    getItem: vi.fn(),
    addItem: vi.fn(),
    getKeys: vi.fn(),
    deleteItem: vi.fn(),
    readFileData: vi.fn(),
}));

vi.mock('../../server/appProvider', () => ({
    default: { appUtils: { base64Decode: (value: string) => value } },
}));
vi.mock('../../server/fileHelpers', () => ({
    fsCheckFileExist: async () => false,
    fsCreateDir: async () => {},
    fsWriteFile: async () => {},
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../../_owa-crypto', () => ({ decrypt: (value: string) => value }));
vi.mock('../errorHelpers', () => ({ handleError: () => {} }));
vi.mock('../../progress-bar/progressBarHelpers', () => ({
    hideProgressBar: () => {},
    showProgressBar: () => {},
}));
vi.mock('./BibleDatabaseController', () => ({
    default: {
        getInstance: async () => ({
            getItem: mocks.getItem,
            addItem: mocks.addItem,
            getKeys: mocks.getKeys,
            deleteItem: mocks.deleteItem,
        }),
    },
}));
vi.mock('../FileSource', () => ({
    default: { readFileData: mocks.readFileData },
}));
vi.mock('../../others/CacheManager', () => ({
    default: class {
        private readonly store = new Map<string, unknown>();
        async get(key: string) {
            return this.store.get(key) ?? null;
        }
        async set(key: string, value: unknown) {
            this.store.set(key, value);
        }
    },
}));
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorageDirPath: '/storage' },
}));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => Promise<unknown>) => {
        return callback();
    },
}));
vi.mock('./bibleInfoHelpers', () => ({ checkIsBibleXML: async () => false }));
vi.mock('../../setting/bible-setting/bibleXMLHelpers', () => ({
    clearBibleXMLCache: async () => {},
    readBibleXMLData: async () => null,
}));
vi.mock('./bibleModelHelpers', () => ({ BIBLE_KJV_KEY: 'KJV' }));
vi.mock('./kjvBibleXMLTextHelpers', () => ({
    genEmbeddedKJVBibleXMLText: async () => null,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: () => {} }));

import BibleDataReader from './BibleDataReader';

beforeEach(() => {
    mocks.getItem.mockResolvedValue(null);
    mocks.addItem.mockResolvedValue(true);
    mocks.deleteItem.mockResolvedValue(true);
});

describe('readBibleData', () => {
    test('does not remember a missing chapter, so one downloaded later is read', async () => {
        const reader = new BibleDataReader();
        mocks.readFileData.mockResolvedValueOnce(null);
        expect(await reader.readBibleData('WEB', '0001-GEN.1')).toBeNull();

        mocks.readFileData.mockResolvedValueOnce('{"title":"Genesis 1"}');
        expect(await reader.readBibleData('WEB', '0001-GEN.1')).toEqual({
            title: 'Genesis 1',
        });
        expect(mocks.readFileData).toHaveBeenCalledTimes(2);
        expect(mocks.readFileData).toHaveBeenLastCalledWith(
            '/storage/bibles-data/WEB/0001-GEN.1',
            true,
        );
    });
});

describe('clearBibleDatabaseData', () => {
    test('deletes nothing for a Bible with no stored records', async () => {
        mocks.getKeys.mockResolvedValue(null);
        await new BibleDataReader().clearBibleDatabaseData('GONE');
        expect(mocks.getKeys).toHaveBeenCalledWith('GONE');
        expect(mocks.deleteItem).not.toHaveBeenCalled();
    });
});
