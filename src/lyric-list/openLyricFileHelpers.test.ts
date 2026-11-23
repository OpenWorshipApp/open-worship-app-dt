import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    existing: new Set<string>(),
    diskFiles: new Map<string, string>(),
    created: [] as { dirPath: string; name: string; content: string }[],
    written: [] as { filePath: string; content: string }[],
    createResult: 'file' as 'file' | 'null',
    lyricContent: '',
    fireUpdateEvent: vi.fn(),
    toast: vi.fn(),
    reveal: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('./Lyric', () => ({
    default: {
        createWithContent: async (
            dirPath: string,
            name: string,
            content: string,
        ) => {
            if (state.createResult === 'null') {
                return null;
            }
            state.created.push({ dirPath, name, content });
            state.existing.add(`${dirPath}/${name}.owl`);
            return { fireUpdateEvent: state.fireUpdateEvent };
        },
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            name: filePath
                .split('/')
                .pop()!
                .replace(/\.[^.]+$/, ''),
        }),
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsReadFile: async (filePath: string) => {
        const text = state.diskFiles.get(filePath);
        if (text === undefined) {
            throw new Error(`ENOENT: ${filePath}`);
        }
        return text;
    },
    fsWriteFile: async (filePath: string, content: string) => {
        state.written.push({ filePath, content });
        state.existing.add(filePath);
        return filePath;
    },
    // The app's own rule: the name as it is, else "name (2)", "name (3)"...
    getAvailableFileName: async (
        dirPath: string,
        name: string,
        dotExtension: string,
    ) => {
        let candidate = name;
        for (let number = 2; ; number++) {
            if (!state.existing.has(`${dirPath}/${candidate}${dotExtension}`)) {
                return candidate;
            }
            candidate = `${name} (${number})`;
        }
    },
    getDownloadPath: () => '/home/Downloads',
    getFileFullName: (file: File | string) =>
        typeof file === 'string' ? file.split('/').pop() : file.name,
    getMimetypeExtensions: () => ['owl'],
    pathJoin: (...parts: string[]) => parts.join('/'),
    toPortableFileName: (name: string, fallback: string) =>
        name.replaceAll(/[\\/:*?"<>|]/g, ' ').trim() || fallback,
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: state.reveal,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: state.toast }));
vi.mock('../helper/errorHelpers', () => ({
    handleError: state.handleError,
}));

import type Lyric from './Lyric';
import { checkIsOpenLyricFileFullName } from './openLyricFileNameHelpers';
import {
    exportLyricToOpenLyricFile,
    importOpenLyricFile,
    toOpenLyricContent,
    toOpenLyricFileSongName,
} from './openLyricFileHelpers';

const SONG = '# Morning Praise\n\n```ol:Config\n- Title: Morning Praise\n```\n';

beforeEach(() => {
    state.existing = new Set();
    state.diskFiles = new Map();
    state.created = [];
    state.written = [];
    state.createResult = 'file';
    state.lyricContent = SONG;
    state.fireUpdateEvent.mockClear();
    state.toast.mockClear();
    state.reveal.mockClear();
    state.handleError.mockClear();
});

describe('recognizing an Open Lyric file', () => {
    test.each([
        ['Morning Praise.ol.md', true],
        ['MORNING.OL.MD', true],
        ['.ol.md', false],
        ['Morning Praise.md', false],
        ['Morning Praise.owl', false],
        ['Morning Praise.ol.md.txt', false],
    ])('%s -> %s', (fileFullName, isOpenLyric) => {
        expect(checkIsOpenLyricFileFullName(fileFullName)).toBe(isOpenLyric);
    });

    test('names the song after the file, without its double extension', () => {
        expect(toOpenLyricFileSongName('001-Morning Praise (1).ol.md')).toBe(
            '001-Morning Praise (1)',
        );
        expect(toOpenLyricFileSongName('a:b.ol.md')).toBe('a b');
    });

    test('keeps the Markdown as the .owl does: no BOM, \\n line ends', () => {
        expect(toOpenLyricContent('\uFEFFa\r\nb\rc\n')).toBe('a\nb\nc\n');
    });
});

describe('importing an Open Lyric file', () => {
    test('a dropped file becomes a .owl holding its Markdown', async () => {
        const file = new File(['\uFEFF' + SONG], 'Morning Praise.ol.md');
        await importOpenLyricFile(file, '/data/Documents');
        expect(state.created).toEqual([
            {
                dirPath: '/data/Documents',
                name: 'Morning Praise',
                content: SONG,
            },
        ]);
        expect(state.fireUpdateEvent).toHaveBeenCalledTimes(1);
        expect(state.toast).toHaveBeenCalledExactlyOnceWith(
            'Import',
            'Lyric document created successfully (1)',
        );
    });

    test('a picked file is read from its path', async () => {
        state.diskFiles.set('/songs/Hymn.ol.md', SONG);
        await importOpenLyricFile('/songs/Hymn.ol.md', '/data/Documents');
        expect(state.created).toEqual([
            { dirPath: '/data/Documents', name: 'Hymn', content: SONG },
        ]);
    });

    test('many at once run one by one, never taking the same name, and say so once', async () => {
        state.existing.add('/data/Documents/Hymn.owl');
        state.diskFiles.set('/a/Hymn.ol.md', SONG);
        state.diskFiles.set('/b/Hymn.ol.md', SONG);
        const first = importOpenLyricFile('/a/Hymn.ol.md', '/data/Documents');
        const second = importOpenLyricFile('/b/Hymn.ol.md', '/data/Documents');
        await Promise.all([first, second]);
        expect(
            state.created.map((one) => {
                return one.name;
            }),
        ).toEqual(['Hymn (2)', 'Hymn (3)']);
        expect(state.toast).toHaveBeenCalledExactlyOnceWith(
            'Import',
            'Lyric document created successfully (2)',
        );
    });

    test('an empty or unreadable file is named in one failure toast', async () => {
        state.diskFiles.set('/a/Good.ol.md', SONG);
        const empty = new File([' \n'], 'Empty.ol.md');
        await Promise.all([
            importOpenLyricFile(empty, '/data/Documents'),
            importOpenLyricFile('/a/Missing.ol.md', '/data/Documents'),
            importOpenLyricFile('/a/Good.ol.md', '/data/Documents'),
        ]);
        expect(state.created).toHaveLength(1);
        expect(state.handleError).toHaveBeenCalledTimes(2);
        expect(state.toast.mock.calls).toEqual([
            ['Import', 'Lyric document created successfully (1)'],
            [
                'Import',
                'Failed to create lyric document: Empty.ol.md, Missing.ol.md',
            ],
        ]);
    });

    test('a lyric that could not be created is a failure', async () => {
        state.createResult = 'null';
        await importOpenLyricFile(
            new File([SONG], 'Hymn.ol.md'),
            '/data/Documents',
        );
        expect(state.toast).toHaveBeenCalledExactlyOnceWith(
            'Import',
            'Failed to create lyric document: Hymn.ol.md',
        );
    });
});

describe('exporting a lyric to an Open Lyric file', () => {
    function genLyric() {
        return {
            filePath: '/data/Documents/Morning Praise.owl',
            getContent: async () => state.lyricContent,
        } as unknown as Lyric;
    }

    test('writes the Markdown to Downloads as .ol.md and shows it', async () => {
        const filePath = await exportLyricToOpenLyricFile(genLyric());
        expect(filePath).toBe('/home/Downloads/Morning Praise.ol.md');
        expect(state.written).toEqual([{ filePath, content: SONG }]);
        expect(state.toast).toHaveBeenCalledExactlyOnceWith(
            'Export to Open Lyric File',
            `Exported to ${filePath}`,
        );
        expect(state.reveal).toHaveBeenCalledWith(filePath);
    });

    test('never overwrites an earlier export', async () => {
        await exportLyricToOpenLyricFile(genLyric());
        const filePath = await exportLyricToOpenLyricFile(genLyric());
        expect(filePath).toBe('/home/Downloads/Morning Praise (2).ol.md');
    });

    test('a failure is reported and nothing is shown', async () => {
        const lyric = {
            filePath: '/data/Documents/Broken.owl',
            getContent: async () => {
                throw new Error('unreadable');
            },
        } as unknown as Lyric;
        expect(await exportLyricToOpenLyricFile(lyric)).toBeNull();
        expect(state.handleError).toHaveBeenCalledTimes(1);
        expect(state.written).toEqual([]);
        expect(state.reveal).not.toHaveBeenCalled();
    });
});
