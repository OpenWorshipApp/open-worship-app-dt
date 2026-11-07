// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// The preview's quieter ways out: a picture the disk will not give up, a
// Bible note, a text file too big to read or that cannot be read again, and
// a Download that has nothing to copy. The disk is a set of hand-held
// answers; the window's own attachment store is the real one, and holds
// nothing here.
const { mocks } = vi.hoisted(() => ({
    mocks: {
        fsCheckFileExist: vi.fn(),
        fsCopyFilePathToPath: vi.fn(),
        fsGetFileSize: vi.fn(),
        fsReadFile: vi.fn(),
        fsReadFileBase64Sync: vi.fn(),
        fsWriteFileSync: vi.fn(),
        downloadImageBase64Data: vi.fn(),
        showFileOrDirExplorer: vi.fn(),
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: (...args: any[]) => mocks.fsCheckFileExist(...args),
    fsCopyFilePathToPath: (...args: any[]) =>
        mocks.fsCopyFilePathToPath(...args),
    fsGetFileSize: (...args: any[]) => mocks.fsGetFileSize(...args),
    fsReadFile: (...args: any[]) => mocks.fsReadFile(...args),
    fsReadFileBase64Sync: (...args: any[]) =>
        mocks.fsReadFileBase64Sync(...args),
    fsWriteFileSync: (...args: any[]) => mocks.fsWriteFileSync(...args),
    getDownloadPath: () => 'C:/Users/one/Downloads',
}));
vi.mock('../server/appHelpers', () => ({
    downloadImageBase64Data: (...args: any[]) =>
        mocks.downloadImageBase64Data(...args),
    showFileOrDirExplorer: (...args: any[]) =>
        mocks.showFileOrDirExplorer(...args),
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => {
            const parts = filePath.split(/[\\/]/);
            const fullName = parts.pop() ?? '';
            return { baseDirPath: parts.join('/'), fullName };
        },
    },
}));

import {
    downloadAsset,
    readAssetPreview,
    type ChatAssetPreviewType,
} from './assetPreviewHelpers';

function genHeld(name: string, words: string) {
    // What the window keeps of an attached file: a line for the model, then
    // the file's words.
    return `The user attached a file called "${name}":\n${words}`;
}

const EMPTY_PREVIEW: ChatAssetPreviewType = {
    id: 'a1',
    name: 'notes.txt',
    kind: 'file',
    imageDataUrl: null,
    text: null,
    filePath: null,
    byteSize: null,
    note: null,
};

beforeEach(() => {
    mocks.fsCheckFileExist.mockResolvedValue(true);
    mocks.fsGetFileSize.mockResolvedValue(2048);
    mocks.fsReadFile.mockResolvedValue('read off the disk');
    mocks.fsReadFileBase64Sync.mockReturnValue('UE5H');
});

describe('a picture on the disk that cannot be read', () => {
    test('is a card that says so, never the disk’s own words', async () => {
        mocks.fsReadFileBase64Sync.mockImplementation(() => {
            throw new Error('EBUSY: resource busy or locked');
        });
        const preview = await readAssetPreview({
            id: 'p1',
            kind: 'image',
            name: 'stage.png',
            mimeType: 'image/png',
            byteSize: 2048,
            filePath: 'D:/pictures/stage.png',
        });
        expect(preview).toEqual({
            id: 'p1',
            name: 'stage.png',
            kind: 'file',
            imageDataUrl: null,
            text: null,
            filePath: 'D:/pictures/stage.png',
            byteSize: 2048,
            note: 'I could not read that picture from the disk.',
        });
    });
});

describe('a Bible note', () => {
    test('is shown as the words the assistant was given, not read again as the editor’s file', async () => {
        const preview = await readAssetPreview({
            id: 'n1',
            kind: 'text',
            name: 'Sunday.own',
            mimeType: 'application/json',
            byteSize: 900,
            filePath: 'D:/notes/Sunday.own',
            summary: genHeld('Sunday.own', '# Sunday\nJohn 3:16 — loved'),
        });
        expect(preview.kind).toBe('text');
        expect(preview.text).toBe('# Sunday\nJohn 3:16 — loved');
        expect(preview.note).toBeNull();
        expect(mocks.fsReadFile).not.toHaveBeenCalled();
    });
});

describe('a text file', () => {
    test('too big to read here is measured on a card and never read', async () => {
        mocks.fsGetFileSize.mockResolvedValue(600 * 1024);
        const preview = await readAssetPreview({
            id: 't1',
            kind: 'text',
            name: 'service-log.txt',
            mimeType: 'text/plain',
            byteSize: 600 * 1024,
            filePath: 'D:/logs/service-log.txt',
        });
        expect(preview).toMatchObject({
            kind: 'file',
            text: null,
            byteSize: 600 * 1024,
            note:
                'This file is 600 KB, too big to show here. Download it or ' +
                'open its folder to read it.',
        });
        expect(mocks.fsReadFile).not.toHaveBeenCalled();
    });

    test('that cannot be read again shows the copy attached to the question', async () => {
        mocks.fsReadFile.mockRejectedValue(new Error('EPERM'));
        const preview = await readAssetPreview({
            id: 't2',
            kind: 'text',
            name: 'order.txt',
            mimeType: 'text/plain',
            byteSize: 40,
            filePath: 'D:/docs/order.txt',
            summary: genHeld('order.txt', 'Welcome\nHymn 12\nSermon'),
        });
        expect(preview).toMatchObject({
            kind: 'text',
            text: 'Welcome\nHymn 12\nSermon',
            note:
                'I could not re-read the file, so this is the copy ' +
                'attached to your question.',
        });
        expect(JSON.stringify(preview)).not.toContain('EPERM');
    });

    test('that cannot be read, with no copy held, is still a card and never a throw', async () => {
        mocks.fsReadFile.mockRejectedValue(new Error('EPERM'));
        const preview = await readAssetPreview({
            id: 't3',
            kind: 'text',
            name: 'order.txt',
            mimeType: 'text/plain',
            byteSize: 40,
            filePath: 'D:/docs/order.txt',
        });
        // Found by UT-89b (2026-11-03): the card had no note at all, so it
        // showed nothing and said nothing -- what the type's own rule (a note
        // "never absent when something IS missing") is there to stop.
        expect(preview).toMatchObject({
            kind: 'file',
            text: null,
            imageDataUrl: null,
            filePath: 'D:/docs/order.txt',
            note: 'I could not read the words of order.txt just now.',
        });
        expect(JSON.stringify(preview)).not.toContain('EPERM');
    });
});

describe('Download', () => {
    test('a copy that could not be made says so, and opens no folder', async () => {
        mocks.fsCopyFilePathToPath.mockResolvedValue(null);
        const result = await downloadAsset({
            ...EMPTY_PREVIEW,
            filePath: 'D:/docs/order.txt',
        });
        expect(result).toEqual({
            filePath: null,
            message: 'I could not save a copy into your Downloads folder.',
        });
        expect(mocks.fsCopyFilePathToPath).toHaveBeenCalledWith(
            'D:/docs/order.txt',
            'C:/Users/one/Downloads',
        );
        expect(mocks.showFileOrDirExplorer).not.toHaveBeenCalled();
    });

    test('a picture the app could not save says so', async () => {
        mocks.downloadImageBase64Data.mockReturnValue(null);
        const result = await downloadAsset({
            ...EMPTY_PREVIEW,
            kind: 'image',
            imageDataUrl: 'data:image/png;base64,UE5H',
        });
        expect(result).toEqual({
            filePath: null,
            message: 'I could not save that picture.',
        });
    });

    test('nothing left to copy, write or save is said in words, and nothing is touched', async () => {
        const result = await downloadAsset(EMPTY_PREVIEW);
        expect(result).toEqual({
            filePath: null,
            message: 'There is nothing left of that one to download.',
        });
        expect(mocks.fsWriteFileSync).not.toHaveBeenCalled();
        expect(mocks.downloadImageBase64Data).not.toHaveBeenCalled();
        expect(mocks.showFileOrDirExplorer).not.toHaveBeenCalled();
    });
});
