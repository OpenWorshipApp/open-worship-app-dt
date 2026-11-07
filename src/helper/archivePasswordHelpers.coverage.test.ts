import { describe, expect, test, vi } from 'vitest';

const { askForNewArchivePasswordMock } = vi.hoisted(() => ({
    askForNewArchivePasswordMock: vi.fn(),
}));

vi.mock('../server/appHelpers', () => ({
    checkIsEncryptedFile: async () => false,
    decryptFile: async () => ({ isOk: true }),
    encryptFile: async () => {},
}));
vi.mock('../server/fileHelpers', () => ({
    fsDeleteFile: async () => {},
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
// The dialog the dynamic `import()` reaches.
vi.mock('../popup-widget/ArchivePasswordComp', () => ({
    askForArchivePassword: async () => null,
    askForNewArchivePassword: askForNewArchivePasswordMock,
}));

import { askForNewArchivePassword } from './archivePasswordHelpers';

describe('askForNewArchivePassword', () => {
    test('hands the dialog the untranslated title and answers what it answered', async () => {
        askForNewArchivePasswordMock.mockResolvedValueOnce('secret');
        expect(await askForNewArchivePassword('Export Data')).toBe('secret');
        expect(askForNewArchivePasswordMock).toHaveBeenCalledExactlyOnceWith(
            'Export Data',
        );

        // "No password" and "cancelled" stay apart.
        askForNewArchivePasswordMock.mockResolvedValueOnce('');
        expect(await askForNewArchivePassword('Export Data')).toBe('');
        askForNewArchivePasswordMock.mockResolvedValueOnce(null);
        expect(await askForNewArchivePassword('Export Data')).toBeNull();
    });
});
