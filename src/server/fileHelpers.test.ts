import { pathToFileURL } from 'node:url';

import { beforeEach, describe, expect, test, vi } from 'vitest';

// Plain functions over a map, not `vi.fn`: `mockReset` would wipe their
// implementations before every test.
const h = vi.hoisted(() => {
    return {
        files: new Map<string, unknown>(),
        dirEntries: new Map<string, string[]>(),
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
                readdir: (dirPath: string, callback: any) => {
                    callback(null, h.dirEntries.get(dirPath) ?? []);
                },
                readdirSync: (dirPath: string) => {
                    return h.dirEntries.get(dirPath) ?? [];
                },
                existsSync: (filePath: string) => {
                    return h.files.has(filePath) || h.dirEntries.has(filePath);
                },
                stat: (_filePath: string, callback: any) => {
                    callback(null, {
                        isFile: () => true,
                        isDirectory: () => false,
                    });
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
    DATA_DIR_MARKER_FILE_NAME,
    ensureDataDirMarkerIdSync,
    findDataDirsOnVolumesSync,
    findMovedDataDirSync,
    readDataDirMarkerIdSync,
    splitVolumePath,
    checkIsNativeAbsolutePath,
    checkIsSystemFileName,
    checkIsWindowsAbsolutePath,
    fsListFiles,
    fsReadFile,
    fsReadSync,
    fsWriteFile,
    fsWriteFileSync,
    getPortableFileNameProblem,
    PORTABLE_NAME_MAX_LENGTH,
    rebaseDataDirPath,
    repairDataDirLinksInText,
    splitFilePath,
    splitPathRoot,
    toBaseNameOfAnyOs,
    toFileFullNameFromUrl,
    toFilePathFromFileUrl,
    toPortableFileFullName,
    toPortableFileName,
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

describe('getPortableFileNameProblem', () => {
    test('accepts an ordinary name, Khmer included', () => {
        expect(getPortableFileNameProblem('Song 74 (new)')).toBeNull();
        expect(getPortableFileNameProblem('សេចក្តីស្រឡាញ់នៃព្រះ')).toBeNull();
        expect(getPortableFileNameProblem('a.b')).toBeNull();
    });

    test('refuses what Windows or an exFAT stick refuses', () => {
        expect(getPortableFileNameProblem('Service 10:30')).toBe('characters');
        expect(getPortableFileNameProblem('Who Am I?')).toBe('characters');
        expect(getPortableFileNameProblem('a/b')).toBe('characters');
        expect(getPortableFileNameProblem('a\\b')).toBe('characters');
        expect(getPortableFileNameProblem('tab\there')).toBe('characters');
    });

    test('refuses a hidden name and a trailing dot or space', () => {
        expect(getPortableFileNameProblem('.notes')).toBe('leading-dot');
        expect(getPortableFileNameProblem('  .notes')).toBe('leading-dot');
        expect(getPortableFileNameProblem('notes.')).toBe(
            'trailing-dot-or-space',
        );
        expect(getPortableFileNameProblem('notes ')).toBe(
            'trailing-dot-or-space',
        );
    });

    test('refuses a Windows device name, with or without an extension', () => {
        expect(getPortableFileNameProblem('CON')).toBe('reserved');
        expect(getPortableFileNameProblem('nul.old')).toBe('reserved');
        expect(getPortableFileNameProblem('com1')).toBe('reserved');
        expect(getPortableFileNameProblem('console')).toBeNull();
    });

    test('refuses an empty or over-long name', () => {
        expect(getPortableFileNameProblem('   ')).toBe('empty');
        expect(
            getPortableFileNameProblem('a'.repeat(PORTABLE_NAME_MAX_LENGTH)),
        ).toBeNull();
        expect(
            getPortableFileNameProblem(
                'a'.repeat(PORTABLE_NAME_MAX_LENGTH + 1),
            ),
        ).toBe('too-long');
    });
});

describe('toPortableFileName', () => {
    test('keeps the words of a title and drops what no OS takes', () => {
        expect(toPortableFileName('Rock of Ages: Cleft / for Me?', 'x')).toBe(
            'Rock of Ages Cleft for Me',
        );
        expect(
            toPortableFileName('Way Maker | Official Music Video', 'x'),
        ).toBe('Way Maker Official Music Video');
    });

    test('falls back when nothing usable is left', () => {
        expect(toPortableFileName('***', 'Fallback')).toBe('Fallback');
        expect(toPortableFileName(' ... ', 'Fallback')).toBe('Fallback');
    });

    test('drops a leading and a trailing dot or space', () => {
        expect(toPortableFileName('.hidden title.', 'x')).toBe('hidden title');
    });

    test('moves a Windows device name out of the way', () => {
        expect(toPortableFileName('CON', 'x')).toBe('CON_');
        expect(toPortableFileName('nul.old', 'x')).toBe('nul_.old');
    });

    test('cuts by code point, never inside an emoji', () => {
        const name = '🙏'.repeat(PORTABLE_NAME_MAX_LENGTH + 10);
        const result = toPortableFileName(name, 'x');
        expect(Array.from(result)).toHaveLength(PORTABLE_NAME_MAX_LENGTH);
        expect(result.endsWith('🙏')).toBe(true);
    });

    test('always answers a name getPortableFileNameProblem accepts', () => {
        for (const raw of [
            'a:b',
            '. . .x',
            'CON.txt',
            'x'.repeat(300),
            'end.',
        ]) {
            expect(
                getPortableFileNameProblem(toPortableFileName(raw, 'x')),
            ).toBeNull();
        }
    });
});

describe('toBaseNameOfAnyOs', () => {
    test('reads the file name out of a path from either OS family', () => {
        expect(toBaseNameOfAnyOs('C:\\Users\\x\\data\\Song.ows')).toBe(
            'Song.ows',
        );
        expect(toBaseNameOfAnyOs('/Volumes/USB/data/Song.ows')).toBe(
            'Song.ows',
        );
        expect(toBaseNameOfAnyOs('E:\\data/lyrics/a.owl')).toBe('a.owl');
        expect(toBaseNameOfAnyOs('Song.ows')).toBe('Song.ows');
        expect(toBaseNameOfAnyOs('/a/b/')).toBe('b');
        expect(toBaseNameOfAnyOs('')).toBe('');
    });
});

describe('checkIsNativeAbsolutePath', () => {
    test('a Windows path is absolute on Windows only', () => {
        expect(checkIsNativeAbsolutePath('C:\\a\\b.png', true)).toBe(true);
        expect(checkIsNativeAbsolutePath('c:/a/b.png', true)).toBe(true);
        expect(checkIsNativeAbsolutePath('\\\\server\\share\\a', true)).toBe(
            true,
        );
        expect(checkIsNativeAbsolutePath('C:\\a\\b.png', false)).toBe(false);
    });

    test('a POSIX path is absolute on macOS/Linux only', () => {
        expect(checkIsNativeAbsolutePath('/Volumes/USB/a.png', false)).toBe(
            true,
        );
        expect(checkIsNativeAbsolutePath('/Volumes/USB/a.png', true)).toBe(
            false,
        );
        expect(checkIsNativeAbsolutePath('relative/a.png', false)).toBe(false);
    });

    test('a drive-relative or bare drive is not absolute', () => {
        expect(checkIsWindowsAbsolutePath('C:a.png')).toBe(false);
        expect(checkIsWindowsAbsolutePath('C:')).toBe(false);
    });
});

describe('fsListFiles', () => {
    test("leaves out a Mac's `._` stubs and other hidden files", async () => {
        // An editing history on a stick a Mac has written to.
        h.dirEntries.set(String.raw`E:\data\song.ows.histories`, [
            '1',
            '2',
            '3-head',
            '._3-head',
            '.DS_Store',
        ]);
        expect(
            await fsListFiles(String.raw`E:\data\song.ows.histories`),
        ).toEqual(['1', '2', '3-head']);
    });
});

describe('checkIsSystemFileName', () => {
    test('knows the files Windows and macOS drop into any folder', () => {
        expect(checkIsSystemFileName('Thumbs.db')).toBe(true);
        expect(checkIsSystemFileName('desktop.ini')).toBe(true);
        expect(checkIsSystemFileName('Icon\r')).toBe(true);
        expect(checkIsSystemFileName('Icon')).toBe(false);
        expect(checkIsSystemFileName('GEN.1.pdf')).toBe(false);
    });
});

describe('splitFilePath', () => {
    test('on Windows either separator splits', () => {
        expect(splitFilePath(String.raw`E:\data/lyrics/a.owl`, true)).toEqual({
            dirPath: String.raw`E:\data/lyrics`,
            fileFullName: 'a.owl',
        });
        expect(splitFilePath(String.raw`C:\docs\a.ows`, true)).toEqual({
            dirPath: String.raw`C:\docs`,
            fileFullName: 'a.ows',
        });
    });

    test('on macOS/Linux only `/` does', () => {
        expect(splitFilePath(String.raw`/Volumes/USB/a\b.ows`, false)).toEqual({
            dirPath: '/Volumes/USB',
            fileFullName: String.raw`a\b.ows`,
        });
    });

    test('a bare name has no folder', () => {
        expect(splitFilePath('a.mp4', false)).toEqual({
            dirPath: '',
            fileFullName: 'a.mp4',
        });
    });
});

describe('toFilePathFromFileUrl', () => {
    test('reads a URL the way the running OS names the file', () => {
        expect(
            toFilePathFromFileUrl('file:///C:/docs/my%20file.txt', true),
        ).toBe(String.raw`C:\docs\my file.txt`);
        expect(
            toFilePathFromFileUrl('file:///Volumes/USB/a%20b.png', false),
        ).toBe('/Volumes/USB/a b.png');
    });

    test('keeps the server of a Windows share', () => {
        expect(toFilePathFromFileUrl('file://server/share/a.png', true)).toBe(
            String.raw`\\server\share\a.png`,
        );
    });
});

describe('toPortableFileFullName', () => {
    test('cleans the name and the extension apart', () => {
        expect(toPortableFileFullName('What?.owl', 'x')).toBe('What.owl');
        expect(toPortableFileFullName('Song.ows', 'x')).toBe('Song.ows');
        expect(toPortableFileFullName('CON.txt', 'x')).toBe('CON_.txt');
        expect(toPortableFileFullName('noext', 'x')).toBe('noext');
    });

    test('a cut to length never eats the extension', () => {
        const result = toPortableFileFullName(`${'a'.repeat(300)}.ows`, 'x');
        expect(result.endsWith('.ows')).toBe(true);
        expect(result).toHaveLength(PORTABLE_NAME_MAX_LENGTH + 4);
    });
});

describe('splitPathRoot', () => {
    test('keeps the root of a macOS/Linux path', () => {
        expect(splitPathRoot('/Volumes/USB/data', false)).toEqual({
            root: '/',
            segments: ['Volumes', 'USB', 'data'],
        });
    });

    test('keeps a drive and a network share on Windows', () => {
        expect(splitPathRoot(String.raw`C:\Users\x\data`, true)).toEqual({
            root: 'C:\\',
            segments: ['Users', 'x', 'data'],
        });
        expect(splitPathRoot(String.raw`\\server\share\data`, true)).toEqual({
            root: '\\\\server\\share\\',
            segments: ['data'],
        });
        expect(splitPathRoot('C:', true)).toEqual({
            root: 'C:\\',
            segments: [],
        });
    });
});

describe('splitVolumePath', () => {
    test('a Windows drive letter is the mount point', () => {
        expect(splitVolumePath(String.raw`E:\church\data`, true)).toEqual({
            volumeRoot: 'E:\\',
            segments: ['church', 'data'],
        });
        expect(splitVolumePath('E:\\', true)).toBeNull();
        expect(
            splitVolumePath(String.raw`\\server\share\data`, true),
        ).toBeNull();
    });

    test('macOS and Linux mount points are found by where drives go', () => {
        expect(splitVolumePath('/Volumes/USB/data', false)).toEqual({
            volumeRoot: '/Volumes/USB',
            segments: ['data'],
        });
        expect(splitVolumePath('/media/me/USB DRIVE/data', false)).toEqual({
            volumeRoot: '/media/me/USB DRIVE',
            segments: ['data'],
        });
        expect(splitVolumePath('/run/media/me/USB/a/data', false)).toEqual({
            volumeRoot: '/run/media/me/USB',
            segments: ['a', 'data'],
        });
        expect(splitVolumePath('/mnt/usb/data', false)).toEqual({
            volumeRoot: '/mnt/usb',
            segments: ['data'],
        });
    });

    test('a folder on the system disk does not move', () => {
        expect(splitVolumePath('/Users/me/Desktop/data', false)).toBeNull();
        expect(splitVolumePath('/Volumes/USB', false)).toBeNull();
    });
});

describe('finding a data folder again (Windows)', () => {
    beforeEach(() => {
        h.files.clear();
        h.dirEntries.clear();
        h.sessionData.defaultStorageDirPath = null;
    });

    function genDataDir(dirPath: string, id: string) {
        h.dirEntries.set(dirPath, [DATA_DIR_MARKER_FILE_NAME]);
        h.files.set(
            `${dirPath}\\${DATA_DIR_MARKER_FILE_NAME}`,
            JSON.stringify({ id }),
        );
    }

    test('the same folder under another drive letter is found by its id', () => {
        // Remembered as E:, plugged back in as F:. G: holds another church's.
        h.dirEntries.set('F:\\', ['church']);
        h.dirEntries.set('G:\\', ['church']);
        genDataDir(String.raw`G:\church\data`, 'somebody-else');
        genDataDir(String.raw`F:\church\data`, 'ours');
        expect(findMovedDataDirSync(String.raw`E:\church\data`, 'ours')).toBe(
            String.raw`F:\church\data`,
        );
    });

    test('nothing is attached without an id to recognise it by', () => {
        h.dirEntries.set('F:\\', ['church']);
        genDataDir(String.raw`F:\church\data`, 'ours');
        expect(
            findMovedDataDirSync(String.raw`E:\church\data`, null),
        ).toBeNull();
        expect(
            findMovedDataDirSync(String.raw`E:\church\data`, 'not-ours'),
        ).toBeNull();
    });

    test('a new computer finds a marked folder on a plugged-in drive', () => {
        h.dirEntries.set('F:\\', ['music', 'open-worship-data']);
        h.dirEntries.set(String.raw`F:\music`, []);
        genDataDir(String.raw`F:\open-worship-data`, 'ours');
        expect(findDataDirsOnVolumesSync()).toEqual([
            String.raw`F:\open-worship-data`,
        ]);
    });

    test('a chosen folder is given a marker once, and keeps its id', () => {
        h.dirEntries.set(String.raw`F:\data`, []);
        const id = ensureDataDirMarkerIdSync(String.raw`F:\data`);
        expect(typeof id).toBe('string');
        expect(ensureDataDirMarkerIdSync(String.raw`F:\data`)).toBe(id);
        expect(readDataDirMarkerIdSync(String.raw`F:\data`)).toBe(id);
    });
});

describe('repairDataDirLinksInText', () => {
    const DATA_DIR = String.raw`E:\open-worship-data`;
    const CHILD_NAMES = ['images', 'videos', 'documents'];
    // What exists on this computer: the data folder's own files, and a
    // documents folder the user keeps elsewhere on purpose.
    const EXISTING = new Set([
        String.raw`E:\open-worship-data\images\4.jpg`,
        String.raw`E:\open-worship-data\images\a b.jpg`,
        String.raw`E:\open-worship-data\videos\12_cv.mp4`,
        String.raw`C:\Users\me\open-worship-data\documents`,
    ]);
    async function checkIsThere(filePath: string) {
        return EXISTING.has(filePath);
    }

    test("points a Mac's old paths at this data folder, in their own form", async () => {
        // A lyric background written on a Mac, under a folder since renamed.
        const text = JSON.stringify({
            basePath: '/Users/raksa/Desktop/worship/images',
            filePath: '/Users/raksa/Desktop/worship/images/4.jpg',
            src: 'file:///Users/raksa/Desktop/worship/images/a%20b.jpg',
            video: '/Users/raksa/Desktop/worship/videos/12_cv.mp4',
        });
        const result = await repairDataDirLinksInText(
            text,
            DATA_DIR,
            CHILD_NAMES,
            checkIsThere,
        );
        // `basePath` names a folder that is not a file here: left alone.
        expect(result.count).toBe(3);
        expect(JSON.parse(result.text)).toEqual({
            basePath: '/Users/raksa/Desktop/worship/images',
            filePath: '$DATA_DIR_PATH/images/4.jpg',
            src: 'file:///$DATA_DIR_PATH/images/a%20b.jpg',
            video: '$DATA_DIR_PATH/videos/12_cv.mp4',
        });

        // And the app reads it back as this computer's files.
        h.sessionData.defaultStorageDirPath = DATA_DIR;
        const sidecarPath = String.raw`${DATA_DIR}\lyrics\aa.owl.bg.json`;
        h.files.set(sidecarPath, result.text);
        const read = JSON.parse(await fsReadFile(sidecarPath));
        expect(read.filePath).toBe(
            String.raw`E:\open-worship-data\images\4.jpg`,
        );
        expect(read.src).toBe('file:///E:/open-worship-data/images/a%20b.jpg');
        h.sessionData.defaultStorageDirPath = null;
    });

    test('keeps the escape level of a Windows path inside JSON', async () => {
        const text = JSON.stringify({
            filePath: String.raw`D:\old\data\images\4.jpg`,
        });
        const result = await repairDataDirLinksInText(
            text,
            DATA_DIR,
            CHILD_NAMES,
            checkIsThere,
        );
        expect(JSON.parse(result.text).filePath).toBe(
            String.raw`$DATA_DIR_PATH\images\4.jpg`,
        );
    });

    test('repairs a link to one of its folders, and only a whole name', async () => {
        const isFolderThere = async (filePath: string) => {
            return filePath === String.raw`E:\open-worship-data\images`;
        };
        const text = JSON.stringify({
            basePath: '/Users/raksa/Desktop/worship/images',
            other: '/Users/raksa/Desktop/worship/images2',
        });
        const result = await repairDataDirLinksInText(
            text,
            DATA_DIR,
            CHILD_NAMES,
            isFolderThere,
        );
        expect(JSON.parse(result.text)).toEqual({
            basePath: '$DATA_DIR_PATH/images',
            other: '/Users/raksa/Desktop/worship/images2',
        });
    });

    test('never moves a link that still points at something', async () => {
        const text = String.raw`C:\Users\me\open-worship-data\documents`;
        const result = await repairDataDirLinksInText(
            text,
            DATA_DIR,
            CHILD_NAMES,
            checkIsThere,
        );
        expect(result).toEqual({ text, count: 0 });
    });

    test('a web address is not a path on this disk', async () => {
        const text = JSON.stringify({
            src: 'https://cdn.example.com/images/4.jpg',
        });
        const result = await repairDataDirLinksInText(
            text,
            DATA_DIR,
            CHILD_NAMES,
            checkIsThere,
        );
        expect(result.count).toBe(0);
    });
});

describe('rebaseDataDirPath', () => {
    test('moves a file from one data folder to another, across OSes', () => {
        expect(
            rebaseDataDirPath(
                String.raw`C:\Users\x\data\videos\intro.mp4`,
                String.raw`C:\Users\x\data`,
                '/Volumes/USB/data',
                '/',
            ),
        ).toBe('/Volumes/USB/data/videos/intro.mp4');
        expect(
            rebaseDataDirPath(
                '/Volumes/USB/data/videos/intro.mp4',
                '/Volumes/USB/data/',
                String.raw`E:\data`,
                '\\',
            ),
        ).toBe(String.raw`E:\data\videos\intro.mp4`);
    });

    test('a file outside the folder, or a sibling of it, is not moved', () => {
        expect(
            rebaseDataDirPath(
                String.raw`C:\Users\x\Desktop\intro.mp4`,
                String.raw`C:\Users\x\data`,
                '/d',
                '/',
            ),
        ).toBeNull();
        expect(
            rebaseDataDirPath(
                String.raw`C:\Users\x\data-dev\intro.mp4`,
                String.raw`C:\Users\x\data`,
                '/d',
                '/',
            ),
        ).toBeNull();
        expect(
            rebaseDataDirPath(
                String.raw`C:\Users\x\data`,
                String.raw`C:\Users\x\data`,
                '/d',
                '/',
            ),
        ).toBeNull();
    });
});

describe('toFileFullNameFromUrl', () => {
    test('drops the query string and reads %20 as a space', () => {
        expect(
            toFileFullNameFromUrl(
                'https://dl.example.com/s/x/My%20Song.ows?dl=1#top',
                'fallback',
            ),
        ).toBe('My Song.ows');
    });

    test('makes the rest a name every computer accepts', () => {
        expect(
            toFileFullNameFromUrl(
                'https://example.com/Service%2010%3A30.ows',
                'fallback',
            ),
        ).toBe('Service 10 30.ows');
    });

    test('falls back when the URL names no file', () => {
        expect(toFileFullNameFromUrl('https://example.com/', 'fallback')).toBe(
            'fallback',
        );
        expect(toFileFullNameFromUrl('not a url', 'fallback')).toBe('fallback');
    });
});
