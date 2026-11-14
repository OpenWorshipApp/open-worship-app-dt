import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    dirPath: '/d/Bible Notes' as string | null,
    copyMock: vi.fn(),
    toastMock: vi.fn(),
}));

vi.mock('../bible-list/note/bibleNotesDirHelpers', () => ({
    getActiveBibleNotesDirPath: () => {
        return h.dirPath;
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCopyFilePathToPath: h.copyMock,
    pathBasename: (filePath: string) => {
        return filePath.slice(filePath.lastIndexOf('/') + 1);
    },
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.toastMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => {
        return text;
    },
}));

import { copyResourceToBibleNotes } from './resourceBibleNotesCopyHelpers';

beforeEach(() => {
    h.dirPath = '/d/Bible Notes';
    h.copyMock.mockReset();
    h.toastMock.mockReset();
});

// 2026-11-13, the user: _context menu of markdown study file should have
// `Copy to Bible-Note` to copy the file to bible note area_.
describe('copyResourceToBibleNotes', () => {
    test('copies the file into the Bible Notes folder in front and names the copy as written', async () => {
        // A name already there: the copy took the next free one.
        h.copyMock.mockResolvedValue('/d/Bible Notes/JHN.3.Study (1).md');
        await expect(
            copyResourceToBibleNotes('/r/Default/JHN.3.Study.md'),
        ).resolves.toBe('/d/Bible Notes/JHN.3.Study (1).md');
        expect(h.copyMock.mock.calls).toEqual([
            ['/r/Default/JHN.3.Study.md', '/d/Bible Notes'],
        ]);
        expect(h.toastMock.mock.calls).toEqual([
            ['Copy to Bible Notes', 'Copied JHN.3.Study (1).md.'],
        ]);
    });

    test('with no Bible Notes folder set, copies nothing and says so', async () => {
        for (const dirPath of [null, '']) {
            h.dirPath = dirPath;
            await expect(
                copyResourceToBibleNotes('/r/Default/A.md'),
            ).resolves.toBeNull();
        }
        expect(h.copyMock).not.toHaveBeenCalled();
        expect(h.toastMock.mock.calls).toEqual([
            ['Copy to Bible Notes', 'Bible notes directory is not set'],
            ['Copy to Bible Notes', 'Bible notes directory is not set'],
        ]);
    });

    test('a copy that failed adds nothing to what the copy said', async () => {
        h.copyMock.mockResolvedValue(null);
        await expect(
            copyResourceToBibleNotes('/r/Default/A.md'),
        ).resolves.toBeNull();
        expect(h.toastMock).not.toHaveBeenCalled();
    });
});
