import { beforeEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    keys: {} as Record<string, string>,
    exists: false,
    save: vi.fn(),
}));
vi.mock('../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getDownloadedBibleInfoList: async () => [],
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../server/fileHelpers', () => ({
    fsCheckFileExist: async () => mocks.exists,
}));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: (_key: string, run: () => unknown) => run(),
}));
vi.mock('./bibleXMLJsonDataHelpers', () => ({
    bibleKeyToXMLFilePath: async () => '/data/bible.xml',
    getAllXMLFileKeys: async () => mocks.keys,
}));
vi.mock('./bibleXMLHelpers', () => ({ saveJsonDataToXMLfile: mocks.save }));
import { saveNewBibleImport } from './bibleImportSaveHelpers';
beforeEach(() => {
    mocks.keys = {};
    mocks.exists = false;
    mocks.save.mockReset().mockResolvedValue(true);
});
test.each(['', '../escape', 'CON', 'a/b'])(
    'refuses unsafe key %s before a write',
    async (key) => {
        await expect(
            saveNewBibleImport({ info: { key } } as any),
        ).rejects.toThrow('Invalid Bible key');
        expect(mocks.save).not.toHaveBeenCalled();
    },
);
test('refuses an installed key ignoring case, and a colliding file even if its key is absent', async () => {
    mocks.keys = { khmer: '/existing.xml' };
    await expect(
        saveNewBibleImport({ info: { key: 'KHMER' } } as any),
    ).rejects.toThrow('already taken');
    mocks.keys = {};
    mocks.exists = true;
    await expect(
        saveNewBibleImport({ info: { key: 'NEW' } } as any),
    ).rejects.toThrow('already taken');
    expect(mocks.save).not.toHaveBeenCalled();
});
test('uses the existing XML writer and reports its failure honestly', async () => {
    const data = { info: { key: 'NEW' } } as any;
    mocks.save.mockResolvedValue(false);
    expect(await saveNewBibleImport(data)).toBe(false);
    expect(mocks.save).toHaveBeenCalledWith(data);
});
