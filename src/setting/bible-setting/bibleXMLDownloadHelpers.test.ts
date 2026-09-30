import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fsWriteFile: vi.fn(),
    genNextFilePath: vi.fn(),
    getBibleXMLDataFromKey: vi.fn(),
    handleError: vi.fn(),
    showFileOrDirExplorer: vi.fn(),
    showSimpleToast: vi.fn(),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn(() => ({
            genNextFilePath: mocks.genNextFilePath,
        })),
    },
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: mocks.showFileOrDirExplorer,
}));

vi.mock('../../server/fileHelpers', () => ({
    fsWriteFile: mocks.fsWriteFile,
    getDownloadPath: () => '/downloads',
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));

vi.mock('./bibleXMLHelpers', () => ({
    getBibleXMLDataFromKey: mocks.getBibleXMLDataFromKey,
}));

import { downloadBibleJSON } from './bibleXMLDownloadHelpers';

describe('downloadBibleJSON', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.genNextFilePath.mockResolvedValue('/downloads/KJV (1).json');
    });

    test('writes a free JSON file directly and reveals it', async () => {
        const bibleData = { info: { key: 'KJV' }, books: { GEN: [] } };
        mocks.getBibleXMLDataFromKey.mockResolvedValue(bibleData);

        await expect(downloadBibleJSON('KJV')).resolves.toBe(
            '/downloads/KJV (1).json',
        );

        expect(mocks.fsWriteFile).toHaveBeenCalledWith(
            '/downloads/KJV (1).json',
            JSON.stringify(bibleData, null, 2),
        );
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Download Completed',
            'File saved at: /downloads/KJV (1).json',
        );
        expect(mocks.showFileOrDirExplorer).toHaveBeenCalledWith(
            '/downloads/KJV (1).json',
        );
    });

    test('reports a missing bible without creating a file', async () => {
        mocks.getBibleXMLDataFromKey.mockResolvedValue(null);

        await expect(downloadBibleJSON('MISSING')).resolves.toBeNull();

        expect(mocks.fsWriteFile).not.toHaveBeenCalled();
        expect(mocks.showFileOrDirExplorer).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Download',
            'Bible XML data not found: "MISSING"',
        );
    });

    test('reports a filesystem failure and does not reveal a file', async () => {
        const error = new Error('disk full');
        mocks.getBibleXMLDataFromKey.mockResolvedValue({
            info: { key: 'KJV' },
        });
        mocks.fsWriteFile.mockRejectedValue(error);

        await expect(downloadBibleJSON('KJV')).resolves.toBeNull();

        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(mocks.showFileOrDirExplorer).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Download',
            'Failed to save Bible data',
        );
    });
});
