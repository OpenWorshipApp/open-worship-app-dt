// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        fsCheckFileExist: vi.fn(async (_filePath: string) => true),
        fsCopyFilePathToPath: vi.fn(
            async (_file: string, dirPath: string) =>
                `${dirPath}/report (1).md` as string | null,
        ),
        fsGetFileSize: vi.fn(async (_filePath: string) => 120),
        fsReadFile: vi.fn(async (_filePath: string) => 'line one\nline two'),
        fsReadFileBase64Sync: vi.fn((_filePath: string) => 'UE5H'),
        fsWriteFileSync: vi.fn(),
        getDownloadPath: vi.fn(() => 'C:/Users/one/Downloads'),
        downloadImageBase64Data: vi.fn(
            (_srcData: string) => '/downloads/owa-image_1.png' as string | null,
        ),
        showFileOrDirExplorer: vi.fn(),
        getAttachmentData: vi.fn((_id: string): string | null => null),
        genNextFilePath: vi.fn(
            async () => 'C:/Users/one/Downloads/notes (1).txt',
        ),
    };
});

vi.mock('../server/fileHelpers', () => {
    return {
        fsCheckFileExist: mocks.fsCheckFileExist,
        fsCopyFilePathToPath: mocks.fsCopyFilePathToPath,
        fsGetFileSize: mocks.fsGetFileSize,
        fsReadFile: mocks.fsReadFile,
        fsReadFileBase64Sync: mocks.fsReadFileBase64Sync,
        fsWriteFileSync: mocks.fsWriteFileSync,
        getDownloadPath: mocks.getDownloadPath,
    };
});
vi.mock('../server/appHelpers', () => {
    return {
        downloadImageBase64Data: mocks.downloadImageBase64Data,
        showFileOrDirExplorer: mocks.showFileOrDirExplorer,
    };
});
vi.mock('../helper/FileSource', () => {
    return {
        default: {
            getInstance: (filePath: string) => {
                const parts = filePath.split(/[\\/]/);
                const fullName = parts.pop() ?? '';
                return {
                    baseDirPath: parts.join('/'),
                    fullName,
                    genNextFilePath: mocks.genNextFilePath,
                };
            },
        },
    };
});
vi.mock('./attachmentHelpers', async (importOriginal) => {
    const original = await importOriginal<any>();
    return { ...original, getAttachmentData: mocks.getAttachmentData };
});

const {
    checkIsAssetAttachment,
    downloadAsset,
    readAssetPreview,
    toReadableSize,
} = await import('./assetPreviewHelpers');

function genAttachment(extra: Record<string, any> = {}) {
    return {
        id: 'a1',
        kind: 'text' as const,
        name: 'notes.txt',
        mimeType: 'text/plain',
        byteSize: 17,
        ...extra,
    };
}

describe('checkIsAssetAttachment', () => {
    it('is true for anything that can be opened, false for a control', () => {
        expect(
            checkIsAssetAttachment(genAttachment({ filePath: '/docs/a.txt' })),
        ).toBe(true);
        expect(
            checkIsAssetAttachment(genAttachment({ summary: 'some words' })),
        ).toBe(true);
        // A control is rung where it lives; it is not an asset.
        expect(
            checkIsAssetAttachment(
                genAttachment({ kind: 'element', selector: '#one' }),
            ),
        ).toBe(false);
        expect(checkIsAssetAttachment(genAttachment())).toBe(false);
    });

    it('is true for a picture whose bytes are still in the window', () => {
        mocks.getAttachmentData.mockReturnValueOnce('data:image/png;base64,AA');
        expect(
            checkIsAssetAttachment(
                genAttachment({ kind: 'image', name: 'my screen' }),
            ),
        ).toBe(true);
    });
});

describe('readAssetPreview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fsCheckFileExist.mockResolvedValue(true);
        mocks.fsGetFileSize.mockResolvedValue(120);
        mocks.fsReadFile.mockResolvedValue('line one\nline two');
        mocks.fsReadFileBase64Sync.mockReturnValue('UE5H');
        mocks.getAttachmentData.mockReturnValue(null);
    });

    it('answers a live picture from memory without touching the disk', async () => {
        mocks.getAttachmentData.mockReturnValue('data:image/png;base64,AA');
        const preview = await readAssetPreview(
            genAttachment({ kind: 'image', name: 'my screen' }),
        );
        expect(preview.kind).toBe('image');
        expect(preview.imageDataUrl).toBe('data:image/png;base64,AA');
        expect(mocks.fsReadFileBase64Sync).not.toHaveBeenCalled();
        expect(mocks.fsCheckFileExist).not.toHaveBeenCalled();
    });

    it('reads a saved picture off the disk as its own media type', async () => {
        const preview = await readAssetPreview(
            genAttachment({
                name: 'OWA-260912-8144.png',
                filePath: '/downloads/OWA-260912-8144.png',
            }),
        );
        expect(preview.kind).toBe('image');
        expect(preview.imageDataUrl).toBe('data:image/png;base64,UE5H');
        const jpeg = await readAssetPreview(
            genAttachment({ name: 'photo.JPG', filePath: '/pics/photo.JPG' }),
        );
        expect(jpeg.imageDataUrl).toBe('data:image/jpeg;base64,UE5H');
    });

    it('reads a text file, and cuts what is too long to read here', async () => {
        const preview = await readAssetPreview(
            genAttachment({ name: 'song.owl', filePath: '/docs/song.owl' }),
        );
        expect(preview.kind).toBe('text');
        expect(preview.text).toBe('line one\nline two');

        mocks.fsReadFile.mockResolvedValueOnce('x'.repeat(30000));
        const long = await readAssetPreview(
            genAttachment({ name: 'big.md', filePath: '/docs/big.md' }),
        );
        expect(long.text?.length).toBeLessThan(30000);
        expect(long.text?.endsWith('the rest is in the file ...]')).toBe(true);
    });

    it('does not read a file too big to show, and says its size', async () => {
        mocks.fsGetFileSize.mockResolvedValue(40 * 1024 * 1024);
        const preview = await readAssetPreview(
            genAttachment({ name: 'clip.png', filePath: '/pics/clip.png' }),
        );
        expect(preview.kind).toBe('file');
        expect(preview.byteSize).toBe(40 * 1024 * 1024);
        expect(preview.note).toContain('40.0 MB');
        // The cap is the point: the bytes were never read.
        expect(mocks.fsReadFileBase64Sync).not.toHaveBeenCalled();
    });

    it('draws a card for a kind it cannot show, with no read at all', async () => {
        const preview = await readAssetPreview(
            genAttachment({ name: 'clip.mp4', filePath: '/videos/clip.mp4' }),
        );
        expect(preview.kind).toBe('file');
        expect(preview.note).toBeNull();
        expect(preview.filePath).toBe('/videos/clip.mp4');
        expect(mocks.fsReadFile).not.toHaveBeenCalled();
        expect(mocks.fsReadFileBase64Sync).not.toHaveBeenCalled();
    });

    it('says so plainly when the file is gone', async () => {
        mocks.fsCheckFileExist.mockResolvedValue(false);
        const preview = await readAssetPreview(
            genAttachment({ name: 'gone.md', filePath: '/docs/gone.md' }),
        );
        expect(preview.kind).toBe('file');
        expect(preview.note).toContain('not on this machine any more');
    });

    it('shows attached words with the line written for the model removed', async () => {
        const preview = await readAssetPreview(
            genAttachment({
                summary:
                    'The user attached a file called "notes.txt":\nthe words',
            }),
        );
        expect(preview.kind).toBe('text');
        expect(preview.text).toBe('the words');
    });

    it('never throws: a failed read becomes a sentence', async () => {
        mocks.fsGetFileSize.mockRejectedValue(new Error('nope'));
        mocks.fsReadFile.mockRejectedValue(new Error('nope'));
        const preview = await readAssetPreview(
            genAttachment({ name: 'song.owl', filePath: '/docs/song.owl' }),
        );
        expect(preview.kind).toBe('file');
        const gonePicture = await readAssetPreview(
            genAttachment({ kind: 'image', name: 'my screen' }),
        );
        expect(gonePicture.note).toContain('not attached any more');
    });
});

describe('downloadAsset', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fsCheckFileExist.mockResolvedValue(true);
        mocks.getDownloadPath.mockReturnValue('C:/Users/one/Downloads');
    });

    const genPreview = (extra: Record<string, any> = {}) => {
        return {
            id: 'a1',
            name: 'report.md',
            kind: 'text' as const,
            imageDataUrl: null,
            text: null,
            filePath: null,
            byteSize: null,
            note: null,
            ...extra,
        };
    };

    it('copies a file into Downloads and opens it there', async () => {
        const result = await downloadAsset(
            genPreview({ filePath: 'C:/docs/report.md' }),
        );
        expect(mocks.fsCopyFilePathToPath).toHaveBeenCalledWith(
            'C:/docs/report.md',
            'C:/Users/one/Downloads',
        );
        expect(result.message).toContain('Downloads folder');
        expect(mocks.showFileOrDirExplorer).toHaveBeenCalledWith(
            'C:/Users/one/Downloads/report (1).md',
        );
    });

    it('reveals a file already in Downloads rather than duplicating it', async () => {
        // Pressed twice, this must not leave three copies of one report.
        const result = await downloadAsset(
            genPreview({ filePath: 'C:\\Users\\one\\Downloads\\report.md' }),
        );
        expect(mocks.fsCopyFilePathToPath).not.toHaveBeenCalled();
        expect(result.message).toContain('already in your Downloads folder');
        expect(mocks.showFileOrDirExplorer).toHaveBeenCalled();
    });

    it('saves a picture held only in the window through the app itself', async () => {
        const result = await downloadAsset(
            genPreview({
                name: 'my screen',
                kind: 'image',
                imageDataUrl: 'data:image/png;base64,AA',
            }),
        );
        expect(mocks.downloadImageBase64Data).toHaveBeenCalledWith(
            'data:image/png;base64,AA',
        );
        expect(result.message).toContain('Saved the picture');
        // The app's own save reveals it; a second reveal would open the
        // folder twice for one press.
        expect(mocks.showFileOrDirExplorer).not.toHaveBeenCalled();
    });

    it('writes words with no file behind them to a free name', async () => {
        const result = await downloadAsset(
            genPreview({ name: 'notes.txt', text: 'the words' }),
        );
        expect(mocks.fsWriteFileSync).toHaveBeenCalledWith(
            'C:/Users/one/Downloads/notes (1).txt',
            'the words',
        );
        expect(result.filePath).toBe('C:/Users/one/Downloads/notes (1).txt');
    });

    it('refuses a file that is gone, in words', async () => {
        mocks.fsCheckFileExist.mockResolvedValue(false);
        const result = await downloadAsset(
            genPreview({ filePath: 'C:/docs/gone.md' }),
        );
        expect(result.filePath).toBeNull();
        expect(result.message).toContain('not on this machine any more');
        expect(mocks.fsCopyFilePathToPath).not.toHaveBeenCalled();
    });
});

describe('toReadableSize', () => {
    it('is read by a person, not by a machine', () => {
        expect(toReadableSize(400)).toBe('400 bytes');
        expect(toReadableSize(2048)).toBe('2 KB');
        expect(toReadableSize(3 * 1024 * 1024)).toBe('3.0 MB');
        expect(toReadableSize(null)).toBe('');
    });
});
