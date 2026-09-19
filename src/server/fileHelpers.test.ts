import { pathToFileURL } from 'node:url';

import { beforeEach, describe, expect, test, vi } from 'vitest';

// Plain functions over a map, not `vi.fn`: `mockReset` would wipe their
// implementations before every test.
const h = vi.hoisted(() => {
    return {
        files: new Map<string, unknown>(),
        sessionData: { defaultStorageDirPath: null as string | null },
    };
});

vi.mock('./appProvider', async () => {
    const { win32 } = await import('node:path');
    const url = await import('node:url');
    return {
        default: {
            isPageScreen: false,
            systemUtils: { isDev: false },
            sessionData: h.sessionData,
            pathUtils: win32,
            browserUtils: {
                pathToFileURL: (filePath: string) => {
                    return url.pathToFileURL(filePath, { windows: true }).href;
                },
            },
            fileUtils: {
                readFile: (filePath: string, _options: any, callback: any) => {
                    callback(null, h.files.get(filePath));
                },
                writeFile: (
                    filePath: string,
                    data: unknown,
                    _options: any,
                    callback: any,
                ) => {
                    h.files.set(filePath, data);
                    callback(null);
                },
                readFileSync: (filePath: string) => {
                    return h.files.get(filePath);
                },
                writeFileSync: (filePath: string, data: unknown) => {
                    h.files.set(filePath, data);
                },
            },
        },
    };
});

// `tran` reads the locale out of the settings store, which otherwise walks all
// the way down to IPC. With nothing stored it short-circuits to English.
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

import {
    fsReadFile,
    fsReadSync,
    fsWriteFile,
    fsWriteFileSync,
} from './fileHelpers';

const DATA_DIR = 'C:\\Users\\me\\open-worship-data';
const VIDEO_PATH = `${DATA_DIR}\\videos\\intro.mp4`;
const DOCUMENT_TEXT = JSON.stringify({
    filePath: VIDEO_PATH,
    src: pathToFileURL(VIDEO_PATH, { windows: true }).href,
});
const DOCUMENT_PATH = `${DATA_DIR}\\documents\\song.ows`;

describe('the data folder is stored as $DATA_DIR_PATH', () => {
    beforeEach(() => {
        h.files.clear();
        h.sessionData.defaultStorageDirPath = DATA_DIR;
    });

    test('a file inside the data folder stores the alias and reads real paths', async () => {
        await fsWriteFile(DOCUMENT_PATH, DOCUMENT_TEXT);
        const stored = h.files.get(DOCUMENT_PATH) as string;
        expect(stored).toContain('$DATA_DIR_PATH');
        expect(stored).not.toContain('open-worship-data');
        expect(await fsReadFile(DOCUMENT_PATH)).toBe(DOCUMENT_TEXT);
    });

    test('settings, read and written synchronously, do the same', () => {
        const settingPath = `${DATA_DIR}\\local-storage\\select-dir-videos`;
        fsWriteFileSync(settingPath, `${DATA_DIR}\\videos`);
        expect(h.files.get(settingPath)).toBe('$DATA_DIR_PATH\\videos');
        expect(fsReadSync(settingPath)).toBe(`${DATA_DIR}\\videos`);
    });

    test('a file outside the data folder keeps real paths, yet reads an aliased copy', async () => {
        const reportPath = 'C:\\Users\\me\\Downloads\\report.json';
        await fsWriteFile(reportPath, DOCUMENT_TEXT);
        expect(h.files.get(reportPath)).toBe(DOCUMENT_TEXT);
        // A document copied byte for byte off the drive still reads.
        await fsWriteFile(DOCUMENT_PATH, DOCUMENT_TEXT);
        const copyPath = 'C:\\Users\\me\\Desktop\\song.ows';
        h.files.set(copyPath, h.files.get(DOCUMENT_PATH));
        expect(await fsReadFile(copyPath)).toBe(DOCUMENT_TEXT);
    });

    test('web files keep real paths: an <iframe> loads them from disk', async () => {
        for (const fileName of ['page.html', 'page.HTM', 'feed.xml']) {
            const webPath = `${DATA_DIR}\\webs\\${fileName}`;
            await fsWriteFile(webPath, DOCUMENT_TEXT);
            expect(h.files.get(webPath)).toBe(DOCUMENT_TEXT);
        }
    });

    test('a Buffer is written untouched', async () => {
        const data = Buffer.from(DOCUMENT_TEXT);
        const audioPath = `${DATA_DIR}\\bible-audio\\a.mp3`;
        await fsWriteFile(audioPath, data);
        expect(h.files.get(audioPath)).toBe(data);
    });

    test('with no data folder nothing is aliased either way', async () => {
        h.sessionData.defaultStorageDirPath = null;
        await fsWriteFile(DOCUMENT_PATH, DOCUMENT_TEXT);
        expect(h.files.get(DOCUMENT_PATH)).toBe(DOCUMENT_TEXT);
        h.files.set(DOCUMENT_PATH, '$DATA_DIR_PATH\\videos');
        expect(await fsReadFile(DOCUMENT_PATH)).toBe('$DATA_DIR_PATH\\videos');
    });

    test('a data folder that changes is followed', () => {
        const settingPath = `${DATA_DIR}\\local-storage\\select-dir-videos`;
        fsWriteFileSync(settingPath, `${DATA_DIR}\\videos`);
        h.sessionData.defaultStorageDirPath = 'F:\\church\\data';
        expect(fsReadSync(settingPath)).toBe('F:\\church\\data\\videos');
    });
});
