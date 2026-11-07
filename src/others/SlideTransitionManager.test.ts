import { beforeEach, describe, expect, test, vi } from 'vitest';

const { files, fileSources, fsCheckFileExistMock, fsDeleteFileMock } =
    vi.hoisted(() => {
        const files = new Map<string, string>();
        const fileSources = new Map<string, any>();
        return {
            files,
            fileSources,
            fsCheckFileExistMock: vi.fn(async (filePath: string) => {
                return files.has(filePath);
            }),
            fsDeleteFileMock: vi.fn(async (filePath: string) => {
                files.delete(filePath);
            }),
        };
    });

vi.mock('../server/appProvider', () => ({
    default: { isPageScreen: false },
}));
vi.mock('../helper/loggerHelpers', () => ({ appWarning: vi.fn() }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: fsCheckFileExistMock,
    fsDeleteFile: fsDeleteFileMock,
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => {
            let fileSource = fileSources.get(filePath);
            if (fileSource === undefined) {
                fileSource = {
                    readFileJsonData: vi.fn(async () => {
                        const text = files.get(filePath);
                        return text === undefined ? null : JSON.parse(text);
                    }),
                    writeFileData: vi.fn(async (data: string) => {
                        files.set(filePath, data);
                        return true;
                    }),
                    fireUpdateEvent: vi.fn(),
                };
                fileSources.set(filePath, fileSource);
            }
            return fileSource;
        },
        forgetCachedData: vi.fn(),
    },
}));

import SlideTransitionManager from './SlideTransitionManager';
import FileSource from '../helper/FileSource';

const DOC = '/docs/Song.ows';
const META = `${DOC}.transition.json`;

describe('SlideTransitionManager', () => {
    beforeEach(async () => {
        files.clear();
        fileSources.clear();
        fsCheckFileExistMock.mockClear();
        fsDeleteFileMock.mockClear();
        // The short-lived read cache is per module, not per instance.
        await new SlideTransitionManager().forgetCachedData(DOC);
    });

    test('the sidecar sits beside the document', () => {
        expect(SlideTransitionManager.genMetaDataFilePath(DOC)).toBe(META);
    });

    test('a document with no sidecar follows the screen, and reading writes nothing', async () => {
        const manager = new SlideTransitionManager();
        expect(await manager.resolveSlideTransition(DOC, 3)).toBeUndefined();
        expect(files.has(META)).toBe(false);
    });

    test('a slide uses its own transition, else its slides preview', async () => {
        files.set(
            META,
            JSON.stringify({ self: 'zoom', '2': 'fade', '5': 'sparkle' }),
        );
        const manager = new SlideTransitionManager();
        expect(await manager.resolveSlideTransition(DOC, 2)).toBe('fade');
        expect(await manager.resolveSlideTransition(DOC, 4)).toBe('zoom');
        // Not an effect: no override at all, so the document's applies.
        expect(await manager.resolveSlideTransition(DOC, 5)).toBe('zoom');
        expect(await manager.getTransition(DOC)).toBe('zoom');
    });

    test('ticking writes the entry, unticking the last one deletes the sidecar', async () => {
        const manager = new SlideTransitionManager();
        await manager.setTransition(DOC, 1, 'move');
        expect(JSON.parse(files.get(META)!)).toEqual({ '1': 'move' });
        await manager.setTransition(DOC, undefined, 'fade');
        expect(JSON.parse(files.get(META)!)).toEqual({
            '1': 'move',
            self: 'fade',
        });
        await manager.setTransition(DOC, 1, undefined);
        await manager.setTransition(DOC, undefined, undefined);
        expect(files.has(META)).toBe(false);
        expect(fsDeleteFileMock).toHaveBeenCalledWith(META);
        expect(await manager.resolveSlideTransition(DOC, 1)).toBeUndefined();
    });

    test('a sidecar that reads as nothing holds no transitions', async () => {
        files.set(META, 'null');
        const manager = new SlideTransitionManager();
        expect(await manager.getAllTransitions(DOC)).toEqual({});
        expect(await manager.resolveSlideTransition(DOC, 1)).toBeUndefined();
    });

    test('deleting the sidecar drops the file and the caches and tells listeners', async () => {
        files.set(META, JSON.stringify({ self: 'zoom' }));
        const manager = new SlideTransitionManager();
        // Read once, so the short-lived copy holds it.
        expect(await manager.getTransition(DOC)).toBe('zoom');
        await manager.deleteMetaDataFile(DOC);
        expect(fsDeleteFileMock).toHaveBeenCalledWith(META);
        expect(files.has(META)).toBe(false);
        expect(FileSource.forgetCachedData).toHaveBeenCalledWith(META);
        expect(fileSources.get(META).fireUpdateEvent).toHaveBeenCalledTimes(1);
        // The cached copy went with it.
        expect(await manager.getTransition(DOC)).toBeUndefined();

        // No sidecar: nothing to delete, but its listeners still hear of it.
        fsDeleteFileMock.mockClear();
        await manager.deleteMetaDataFile(DOC);
        expect(fsDeleteFileMock).not.toHaveBeenCalled();
        expect(fileSources.get(META).fireUpdateEvent).toHaveBeenCalledTimes(2);
    });
});
