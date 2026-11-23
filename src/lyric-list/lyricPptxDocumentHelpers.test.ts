import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    dirPath: '/data/documents',
    isDirPathValid: true as unknown,
    settingNames: [] as string[],
    fireRefreshEvent: vi.fn(),
    files: new Map<string, Uint8Array>(),
    taken: new Set<string>(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => `tran:${text}`,
}));
vi.mock('../media-sessions/folderSessionHelpers', () => ({
    getActiveDirSourceSettingName: (base: string) => `${base}-active`,
}));
vi.mock('../helper/DirSource', () => ({
    default: {
        getInstance: async (settingName: string) => {
            h.settingNames.push(settingName);
            return {
                dirPath: h.dirPath,
                isDirPathValid: h.isDirPathValid,
                fireRefreshEvent: h.fireRefreshEvent,
            };
        },
    },
}));
vi.mock('../resources/resourcesCopyHelpers', () => ({
    // `Song.pptx`, then `Song (1).pptx`, as the real one names.
    genFreeFilePath: async (dirPath: string, name: string) => {
        const path = `${dirPath}/${name}`;
        return h.taken.has(path)
            ? `${dirPath}/${name.replace('.pptx', ' (1).pptx')}`
            : path;
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsWriteFile: async (path: string, data: Uint8Array) => {
        h.files.set(path, new Uint8Array(data));
        return path;
    },
    pathBasename: (path: string) => path.split('/').at(-1),
}));

import { dirSourceSettingNames } from '../helper/constants';
import { savePptxInDocuments } from './lyricPptxDocumentHelpers';

beforeEach(() => {
    h.isDirPathValid = true;
    h.settingNames.length = 0;
    h.fireRefreshEvent.mockClear();
    h.files.clear();
    h.taken.clear();
});

describe('savePptxInDocuments', () => {
    test('writes the deck into the Documents list being looked at', async () => {
        const status = await savePptxInDocuments(
            new Blob([Uint8Array.of(80, 75, 3, 4)]),
            'Grace-open-lyric.pptx',
        );

        expect(h.settingNames).toEqual([
            `${dirSourceSettingNames.APP_DOCUMENT}-active`,
        ]);
        expect([
            ...h.files.get('/data/documents/Grace-open-lyric.pptx')!,
        ]).toEqual([80, 75, 3, 4]);
        expect(h.fireRefreshEvent).toHaveBeenCalledTimes(1);
        expect(status).toBe('tran:Saved: Grace-open-lyric.pptx');
    });

    test('takes the next free name rather than overwrite one', async () => {
        h.taken.add('/data/documents/Grace.pptx');

        const status = await savePptxInDocuments(new Blob(['x']), 'Grace.pptx');

        expect([...h.files.keys()]).toEqual(['/data/documents/Grace (1).pptx']);
        expect(status).toBe('tran:Saved: Grace (1).pptx');
    });

    test('writes nothing without a Documents folder', async () => {
        h.isDirPathValid = false;

        await expect(
            savePptxInDocuments(new Blob(['x']), 'Grace.pptx'),
        ).rejects.toThrow('Documents directory is unavailable');
        expect(h.files.size).toBe(0);
        expect(h.fireRefreshEvent).not.toHaveBeenCalled();
    });
});
