// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        folders: ['/resources'],
        dirents: {} as Record<
            string,
            { name: string; isFile: boolean; isDirectory: boolean }[]
        >,
        scanResults: {} as Record<string, any>,
        scanErrors: [] as string[],
        sizes: {} as Record<string, number>,
        texts: {} as Record<string, string>,
        bytes: {} as Record<string, Uint8Array>,
        bibleList: [] as { key: string }[],
        bibleMaps: {} as Record<string, Record<string, string>>,
        pdfResult: null as any,
        imageResult: null as any,
        noteText: null as null | string,
        // The Bible Notes folder of the session in front (EC-509).
        bibleNotesDir: null as null | string,
    },
    mocks: {
        scan: vi.fn(),
        listDirents: vi.fn(),
        getSize: vi.fn(),
        readText: vi.fn(),
        readBytes: vi.fn(),
        sendAsync: vi.fn(),
        normalizeImage: vi.fn(),
        getBibleInfo: vi.fn(),
        getAllBibles: vi.fn(),
        toNoteFileText: vi.fn(),
        handleStudy: vi.fn(),
    },
}));

vi.mock('../chatbot/attachmentHelpers', () => ({
    normalizeImage: (...args: unknown[]) => mocks.normalizeImage(...args),
}));
vi.mock('../chatbot/noteFileTextHelpers', () => ({
    toNoteFileText: (...args: unknown[]) => mocks.toNoteFileText(...args),
}));
vi.mock('../resources/resourcesFolderHelpers', () => ({
    getResourcesFolderList: () => state.folders,
}));
vi.mock('../bible-list/note/bibleNotesDirHelpers', () => ({
    getActiveBibleNotesDirPath: () => state.bibleNotesDir,
}));
vi.mock('../resources/resourcesScanHelpers', () => ({
    MAX_SCAN_DEPTH: 2,
    MAX_SCAN_ENTRIES: 100,
    scanResourceFiles: (...args: unknown[]) => mocks.scan(...args),
}));
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: (...args: unknown[]) => mocks.sendAsync(...args),
}));
vi.mock('../server/fileHelpers', () => ({
    checkIsHiddenName: (name: string) => name.startsWith('.'),
    checkIsSystemFileName: (name: string) => name.toLowerCase() === 'thumbs.db',
    fsCheckFileExist: async (path: string) => Object.hasOwn(state.sizes, path),
    fsGetFileSize: (...args: unknown[]) => mocks.getSize(...args),
    fsListDirents: (...args: unknown[]) => mocks.listDirents(...args),
    fsReadFile: (...args: unknown[]) => mocks.readText(...args),
    fsReadFileBytes: (...args: unknown[]) => mocks.readBytes(...args),
    pathBasename: (value: string) => value.split(/[\\/]/).at(-1) ?? '',
    pathJoin: (...parts: string[]) =>
        parts
            .join('/')
            .replaceAll(/\/{2,}/g, '/')
            .replace(/\/$/, ''),
    pathResolve: (value: string) => normalizePath(value),
    pathSeparator: '/',
    toPathCompareKey: (value: string) => normalizePath(value).toLowerCase(),
}));
vi.mock('./agentResourceNameHelpers', () => ({
    genResourceFolderLabels: (
        paths: string[],
        basename: (path: string) => string,
    ) => paths.map((path) => basename(path)),
    resolveResourceBookKeyFromMaps: (
        book: unknown,
        maps: Record<string, string>[],
    ) => {
        const wanted = String(book ?? '').toLowerCase();
        return (
            maps
                .flatMap((map) => Object.entries(map))
                .find(
                    ([key, name]) =>
                        key.toLowerCase() === wanted ||
                        name.toLowerCase() === wanted,
                )?.[0] ?? null
        );
    },
    splitResourceFileName: (value: string) => splitFileName(value),
    toPageSpanText: (first: number, count: number) =>
        count <= 1 ? String(first) : `${first}-${first + count - 1}`,
    toResourceBookKey: (value: unknown) => {
        const names: Record<string, string> = {
            jhn: 'JHN',
            john: 'JHN',
            gen: 'GEN',
            genesis: 'GEN',
        };
        return (
            names[
                String(value ?? '')
                    .trim()
                    .toLowerCase()
            ] ?? null
        );
    },
    toResourceFileKind: (value: string) => {
        const lower = value.toLowerCase();
        if (lower.endsWith('.pdf')) return 'pdf';
        if (lower.endsWith('.own')) return 'note';
        if (/\.(png|jpe?g|webp)$/u.test(lower)) return 'picture';
        if (/\.(txt|md|json)$/u.test(lower)) return 'text';
        return null;
    },
}));
vi.mock('./agentResourceOverviewHelpers', () => ({
    genResourceOverview: (names: string[]) => ({ files: names }),
}));
vi.mock('./bibleVerseFindHelpers', () => ({
    parseRefParts: (value: string) => {
        const match = /^(.+?)\s+(\d+)$/u.exec(value.trim());
        return match === null
            ? null
            : { book: match[1], chapter: Number(match[2]) };
    },
}));
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: (...args: unknown[]) =>
        mocks.getAllBibles(...args),
}));
vi.mock('./bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: (...args: unknown[]) => mocks.getBibleInfo(...args),
}));
// The study-file worker: loaded only for its own four actions.
vi.mock('./agentStudyFileHelpers', () => ({
    handleAgentStudyRequest: (...args: unknown[]) => mocks.handleStudy(...args),
}));

import { handleAgentResourcesRequest } from './agentResourcesHelpers';

function normalizePath(value: string) {
    const result: string[] = [];
    for (const part of value.replaceAll('\\', '/').split('/')) {
        if (part === '' || part === '.') continue;
        if (part === '..') result.pop();
        else result.push(part);
    }
    return `/${result.join('/')}`;
}

function splitFileName(value: string) {
    const parts = String(value ?? '')
        .trim()
        .replaceAll('\\', '/')
        .split('/')
        .filter(Boolean);
    if (
        parts.length < 2 ||
        parts.some(
            (part) => part === '.' || part === '..' || part.includes(':'),
        )
    ) {
        return null;
    }
    return { folder: parts[0], innerParts: parts.slice(1) };
}

function file(path: string, kind: 'file' | 'directory' = 'file') {
    return {
        name: path,
        isFile: kind === 'file',
        isDirectory: kind === 'directory',
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    state.folders = ['/resources'];
    state.dirents = {};
    state.scanResults = {};
    state.scanErrors = [];
    state.sizes = {};
    state.texts = {};
    state.bytes = {};
    state.bibleList = [{ key: 'KJV' }];
    state.bibleMaps = { KJV: { JHN: 'John', GEN: 'Genesis' } };
    state.pdfResult = null;
    state.imageResult = null;
    state.noteText = null;
    state.bibleNotesDir = null;

    mocks.scan.mockImplementation(async (folder: string) => {
        if (state.scanErrors.includes(folder)) throw new Error('scan failed');
        return state.scanResults[folder] ?? { filePaths: [] };
    });
    mocks.listDirents.mockImplementation(async (path: string) => {
        return state.dirents[path] ?? [];
    });
    mocks.getSize.mockImplementation(async (path: string) => {
        if (!Object.hasOwn(state.sizes, path)) throw new Error('file missing');
        return state.sizes[path];
    });
    mocks.readText.mockImplementation(
        async (path: string) => state.texts[path] ?? '',
    );
    mocks.readBytes.mockImplementation(async (path: string) => {
        return state.bytes[path] ?? new Uint8Array([1, 2, 3]);
    });
    mocks.sendAsync.mockImplementation(async () => state.pdfResult);
    mocks.normalizeImage.mockImplementation(async () => state.imageResult);
    mocks.getAllBibles.mockImplementation(async () => state.bibleList);
    mocks.getBibleInfo.mockImplementation(async (key: string) => ({
        keyBookMap: state.bibleMaps[key] ?? {},
    }));
    mocks.toNoteFileText.mockImplementation(() => state.noteText);
});

test('invalid actions and an unset Resources folder explain how to continue', async () => {
    await expect(handleAgentResourcesRequest({})).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('Give action'),
    });

    state.folders = [];
    await expect(
        handleAgentResourcesRequest({ action: 'list' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('No Resources folder'),
    });
});

test('an overview walks nested folders and omits hidden and system entries', async () => {
    state.dirents = {
        '/resources': [
            file('JHN.3.pdf'),
            file('.cache', 'directory'),
            file('Thumbs.db'),
            file('notes', 'directory'),
        ],
        '/resources/notes': [file('JHN.3.own')],
        '/resources/.cache': [file('secret.txt')],
    };

    await expect(
        handleAgentResourcesRequest({ action: 'list' }),
    ).resolves.toMatchObject({
        overview: [{ folder: 'resources', files: ['JHN.3.pdf', 'JHN.3.own'] }],
        note: expect.stringContaining('introduction'),
    });
    expect(mocks.listDirents).toHaveBeenCalledWith('/resources/notes');
    expect(mocks.listDirents).not.toHaveBeenCalledWith('/resources/.cache');
});

test('a reference and a book name resolve to the panel’s book and chapter files', async () => {
    state.scanResults['/resources'] = {
        filePaths: ['/resources/JHN.3.pdf', '/resources/JHN.3.notes/JHN.3.own'],
    };

    const result = await handleAgentResourcesRequest({
        action: 'list',
        ref: 'John 3',
    });

    expect(mocks.scan).toHaveBeenCalledWith(
        '/resources',
        [{ bookKey: 'JHN', chapter: 3 }],
        '',
    );
    expect(result).toMatchObject({
        folders: ['resources'],
        files: [
            { file: 'resources/JHN.3.pdf', kind: 'pdf' },
            { file: 'resources/JHN.3.notes/JHN.3.own', kind: 'note' },
        ],
    });
});

test('a book without a chapter lists every file for the book, not only the introduction', async () => {
    state.scanResults['/resources'] = {
        filePaths: ['/resources/JHN.0.links.json', '/resources/JHN.3.pdf'],
    };

    await handleAgentResourcesRequest({ action: 'list', book: 'JHN' });

    expect(mocks.scan).toHaveBeenCalledWith('/resources', [], 'JHN.');
});

test('bad references and unknown book names are refused before scanning', async () => {
    await expect(
        handleAgentResourcesRequest({ action: 'list', ref: 'John' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('book and chapter'),
    });
    await expect(
        handleAgentResourcesRequest({ action: 'list', book: 'Atlantis' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('not a Bible book'),
    });
    expect(mocks.scan).not.toHaveBeenCalled();
});

test('a failed folder scan is skipped while results from another folder remain', async () => {
    state.folders = ['/one/resources', '/two/resources'];
    state.scanErrors = ['/one/resources'];
    state.scanResults['/two/resources'] = {
        filePaths: ['/two/resources/JHN.3.pdf'],
    };

    await expect(
        handleAgentResourcesRequest({ action: 'list', search: 'JHN' }),
    ).resolves.toMatchObject({
        folders: ['resources', 'resources'],
        files: [{ file: 'resources/JHN.3.pdf', kind: 'pdf' }],
    });
});

test('a read refuses traversal and ambiguous bare names', async () => {
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/../private.txt',
        }),
    ).resolves.toMatchObject({ isError: true });

    state.folders = ['/one/resources', '/two/resources'];
    state.scanResults['/one/resources'] = {
        filePaths: ['/one/resources/JHN.3.pdf'],
    };
    state.scanResults['/two/resources'] = {
        filePaths: ['/two/resources/JHN.3.pdf'],
    };
    await expect(
        handleAgentResourcesRequest({ action: 'read', file: 'JHN.3.pdf' }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('More than one Resources file'),
    });
    expect(mocks.getSize).not.toHaveBeenCalled();
});

test('text files are read by their Resources name and bounded at 16 KB', async () => {
    const filePath = '/resources/notes/sermon.txt';
    state.sizes[filePath] = 20_000;
    state.texts[filePath] = 's'.repeat(20_000);
    state.scanResults['/resources'] = {
        filePaths: [filePath],
        searchedFilePaths: [filePath],
    };

    const result: any = await handleAgentResourcesRequest({
        action: 'read',
        file: 'resources/notes/sermon.txt',
    });

    expect(result.file).toBe('resources/notes/sermon.txt');
    expect(result.kind).toBe('text');
    expect(result.text).toBe('s'.repeat(16 * 1024));
    expect(result.note).toContain('Only the start');
});

test('Bible notes use the note reader and unsupported or oversized files are refused', async () => {
    const notePath = '/resources/notes.own';
    state.sizes[notePath] = 50;
    state.noteText = 'note item text';
    state.scanResults['/resources'] = { filePaths: [notePath] };

    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/notes.own',
        }),
    ).resolves.toMatchObject({ kind: 'note', text: 'note item text' });
    expect(mocks.toNoteFileText).toHaveBeenCalledWith('');

    state.scanResults['/resources'] = {
        filePaths: ['/resources/archive.docx'],
    };
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/archive.docx',
        }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('not a kind of file'),
    });

    state.scanResults['/resources'] = { filePaths: ['/resources/large.txt'] };
    state.sizes['/resources/large.txt'] = 16 * 1024 * 1024 + 1;
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/large.txt',
        }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('too large'),
    });
});

test('a PDF read is paginated, capped, and uses high detail only when asked', async () => {
    const pdfPath = '/resources/JHN.3.pdf';
    state.sizes[pdfPath] = 200;
    state.scanResults['/resources'] = { filePaths: [pdfPath] };
    state.pdfResult = {
        isSuccessful: true,
        pageCount: 20,
        dataUrls: Array.from(
            { length: 8 },
            (_, index) => `data:image/png,${index}`,
        ),
    };

    const result: any = await handleAgentResourcesRequest({
        action: 'read',
        file: 'resources/JHN.3.pdf',
        page: 3,
        pages: 99,
        detail: 'high',
    });

    expect(mocks.sendAsync).toHaveBeenCalledWith('main:app:pdf-to-chat-pages', {
        filePath: pdfPath,
        startPage: 2,
        maxPages: 8,
        longEdge: 2048,
    });
    expect(result).toMatchObject({
        pages: '3-10',
        firstPage: 3,
        lastPage: 10,
        nextPage: 11,
        isComplete: false,
        images: state.pdfResult.dataUrls,
    });
    expect(result.text).toBeUndefined();
});

test('a PDF with no rendered pages and a failed PDF request return clear errors', async () => {
    const pdfPath = '/resources/JHN.3.pdf';
    state.sizes[pdfPath] = 200;
    state.scanResults['/resources'] = { filePaths: [pdfPath] };
    state.pdfResult = { isSuccessful: true, pageCount: 5, dataUrls: [] };
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/JHN.3.pdf',
            page: 6,
        }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('there is no page 6'),
    });

    state.pdfResult = { isSuccessful: false };
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/JHN.3.pdf',
        }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('could not be opened as a PDF'),
    });
});

test('a picture is normalized before it is returned as an image', async () => {
    const imagePath = '/resources/map.jpg';
    state.sizes[imagePath] = 10;
    state.bytes[imagePath] = new Uint8Array([4, 5]);
    state.imageResult = { dataUrl: 'data:image/png;base64,normalized' };
    state.scanResults['/resources'] = { filePaths: [imagePath] };

    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/map.jpg',
        }),
    ).resolves.toMatchObject({
        kind: 'picture',
        images: ['data:image/png;base64,normalized'],
    });
    expect(mocks.normalizeImage).toHaveBeenCalledOnce();
});

test('a book named in another installed Bible’s language is found past a Bible that cannot be read', async () => {
    state.bibleList = [{ key: 'KJV' }, { key: 'XXV' }];
    state.bibleMaps = { XXV: { JHN: 'Xjhn' } };
    mocks.getBibleInfo.mockImplementation(async (key: string) => {
        if (key === 'KJV') {
            throw new Error('unreadable Bible');
        }
        return { keyBookMap: state.bibleMaps[key] ?? {} };
    });
    state.scanResults['/resources'] = { filePaths: ['/resources/JHN.3.pdf'] };

    await expect(
        handleAgentResourcesRequest({ action: 'list', book: 'Xjhn' }),
    ).resolves.toMatchObject({
        files: [{ file: 'resources/JHN.3.pdf', kind: 'pdf' }],
    });
    expect(mocks.scan).toHaveBeenCalledWith('/resources', [], 'JHN.');
    expect(mocks.getBibleInfo).toHaveBeenCalledWith('XXV');
});

test('an overview passes over a folder it cannot open, and says a shelf too big to walk was cut', async () => {
    state.folders = ['/resources', '/big'];
    state.dirents = {
        '/resources': [
            file('JHN.3.pdf'),
            file('locked', 'directory'),
            file('sub', 'directory'),
        ],
        '/resources/sub': [file('GEN.1.pdf')],
        '/big': Array.from({ length: 101 }, (_, index) => {
            return file(`GEN.${index + 1}.pdf`);
        }),
    };
    mocks.listDirents.mockImplementation(async (path: string) => {
        if (path === '/resources/locked') {
            throw new Error('permission denied');
        }
        return state.dirents[path] ?? [];
    });

    const result: any = await handleAgentResourcesRequest({ action: 'list' });

    expect(result.overview).toEqual([
        { folder: 'resources', files: ['JHN.3.pdf', 'GEN.1.pdf'] },
        { folder: 'big', files: [], isCut: true },
    ]);
    expect(mocks.listDirents).toHaveBeenCalledWith('/resources/locked');
});

test('a listing stops at sixty files and says there are more', async () => {
    state.scanResults['/resources'] = {
        filePaths: Array.from({ length: 61 }, (_, index) => {
            return `/resources/JHN.${index + 1}.pdf`;
        }),
    };

    const result: any = await handleAgentResourcesRequest({
        action: 'list',
        search: 'JHN',
    });

    expect(result.files).toHaveLength(60);
    expect(result.files.at(-1)).toEqual({
        file: 'resources/JHN.60.pdf',
        kind: 'pdf',
    });
    expect(result.note).toContain('There are more');
});

// EC-509: a study the person kept in the Bible Notes list is read by the
// name the help window gives it, `Bible Notes/<name>`.
test('a study kept in Bible Notes is read as `Bible Notes/<name>`', async () => {
    state.folders = [];
    state.bibleNotesDir = '/data/notes';
    const filePath = '/data/notes/JHN.3.16 Love.md';
    state.sizes[filePath] = 14;
    state.texts[filePath] = '# Love\n\nWords.';

    const result: any = await handleAgentResourcesRequest({
        action: 'read',
        file: 'Bible Notes/JHN.3.16 Love.md',
    });
    expect(result.file).toBe('Bible Notes/JHN.3.16 Love.md');
    expect(result.kind).toBe('text');
    expect(result.text).toBe('# Love\n\nWords.');

    // Not a step out of it, and nothing while no folder is set.
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'Bible Notes/../secret.md',
        }),
    ).resolves.toMatchObject({ isError: true });
    state.bibleNotesDir = null;
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'Bible Notes/JHN.3.16 Love.md',
        }),
    ).resolves.toMatchObject({ isError: true });
});

// EC-706: the bare name of a study attached from Bible Notes had read its
// Resources copy, and the model told the person it was all Khmer.
test('a bare study name counts the one kept in Bible Notes, and two are named back', async () => {
    const name = 'PSA.100.Joy.md';
    const notesPath = `/data/notes/${name}`;
    state.bibleNotesDir = '/data/notes';
    state.sizes[notesPath] = 5;
    state.texts[notesPath] = 'notes';

    const notesOnly: any = await handleAgentResourcesRequest({
        action: 'read',
        file: name,
    });
    expect(notesOnly.file).toBe(`Bible Notes/${name}`);
    expect(notesOnly.text).toBe('notes');

    const defaultPath = `/resources/Default/${name}`;
    state.scanResults['/resources'] = { filePaths: [defaultPath] };
    state.sizes[defaultPath] = 7;
    await expect(
        handleAgentResourcesRequest({ action: 'read', file: name }),
    ).resolves.toEqual({
        isError: true,
        reason:
            `More than one Resources file is called "${name}": ` +
            `resources/Default/${name}, Bible Notes/${name}. Name the one ` +
            'you mean.',
    });

    // Only a Markdown study is looked for there.
    state.sizes['/data/notes/JHN.3.pdf'] = 9;
    await expect(
        handleAgentResourcesRequest({ action: 'read', file: 'JHN.3.pdf' }),
    ).resolves.toMatchObject({ isError: true });
});

test('a Resources folder called Bible Notes is asked before the list', async () => {
    state.folders = ['/stick/Bible Notes'];
    state.bibleNotesDir = '/data/notes';
    const filePath = '/stick/Bible Notes/JHN.3.16 Love.md';
    state.sizes[filePath] = 5;
    state.texts[filePath] = 'stick';
    const result: any = await handleAgentResourcesRequest({
        action: 'read',
        file: 'Bible Notes/JHN.3.16 Love.md',
    });
    expect(result.text).toBe('stick');
});

test('a read naming a folder that is not a Resources folder is refused without a scan', async () => {
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'Downloads/JHN.3.pdf',
        }),
    ).resolves.toEqual({
        isError: true,
        reason: expect.stringContaining('Only files in the Resources folders'),
    });
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.getSize).not.toHaveBeenCalled();
});

test('a bare file name is still found when another Resources folder cannot be scanned', async () => {
    state.folders = ['/one/resources', '/two/resources'];
    state.scanErrors = ['/one/resources'];
    const filePath = '/two/resources/sermon.txt';
    state.scanResults['/two/resources'] = { filePaths: [filePath] };
    state.sizes[filePath] = 5;
    state.texts[filePath] = 'grace';

    await expect(
        handleAgentResourcesRequest({ action: 'read', file: 'sermon.txt' }),
    ).resolves.toEqual({
        file: 'resources/sermon.txt',
        kind: 'text',
        text: 'grace',
    });
    expect(mocks.scan).toHaveBeenCalledWith('/one/resources', [], 'sermon.txt');
});

test('missing files and images that cannot be normalized are refused', async () => {
    const imagePath = '/resources/map.jpg';
    state.scanResults['/resources'] = { filePaths: [imagePath] };
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/map.jpg',
        }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('is not there'),
    });

    state.sizes[imagePath] = 10;
    state.imageResult = null;
    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/map.jpg',
        }),
    ).resolves.toMatchObject({
        isError: true,
        reason: expect.stringContaining('could not be read as a picture'),
    });
});

test('a study file’s four actions go to its own worker, the request whole', async () => {
    mocks.handleStudy.mockImplementation(async (request: any) => ({
        handled: request.action,
    }));
    for (const action of ['draft', 'translate', 'save', 'preview']) {
        const request = {
            action,
            file: 'Default/JHN.3.16 Notes.md',
            hash: 'h',
        };
        await expect(handleAgentResourcesRequest(request)).resolves.toEqual({
            handled: action,
        });
        expect(mocks.handleStudy).toHaveBeenLastCalledWith(request);
    }
    expect(mocks.handleStudy).toHaveBeenCalledTimes(4);
    expect(mocks.scan).not.toHaveBeenCalled();
});

function genLongStudy() {
    return [
        '# The New Birth',
        '',
        '## Background',
        '',
        'b'.repeat(10_000),
        '',
        '## Translation',
        '',
        'Xx words.',
        '',
        '### Part one',
        '',
        't'.repeat(17_000),
        '',
        '---',
        '',
        '*Drafted with the app assistant. Check it against your Bible.*',
        '',
    ].join('\n');
}

test('a long Markdown file is read in part, its headings named so a change goes by section', async () => {
    const filePath = '/resources/Default/JHN.3.study.md';
    const text = genLongStudy();
    state.sizes[filePath] = text.length;
    state.texts[filePath] = text;

    const result: any = await handleAgentResourcesRequest({
        action: 'read',
        file: 'resources/Default/JHN.3.study.md',
    });

    expect(result.text).toBe(text.slice(0, 16 * 1024));
    expect(result.note).toBe(
        `Only the start of it is here: it is ${text.length} characters. ` +
            'Read one part with `section` (one of its headings); change it ' +
            'with `draft`, `file` and `section`, or `append` -- never by ' +
            'writing back the part read. Its headings:\n' +
            '# The New Birth\n## Background\n## Translation\n### Part one',
    );

    // With no heading there is nothing to name.
    state.texts[filePath] = 'p'.repeat(20_000);
    const plain: any = await handleAgentResourcesRequest({
        action: 'read',
        file: 'resources/Default/JHN.3.study.md',
    });
    expect(plain.note).toBe(
        'Only the start of it is here: it is 20000 characters. Read one ' +
            'part with `section` (one of its headings); change it with ' +
            '`draft`, `file` and `section`, or `append` -- never by writing ' +
            'back the part read.',
    );
});

test('a section of a text file is read by its heading’s words, whole or with its own headings named', async () => {
    const filePath = '/resources/Default/JHN.3.study.md';
    const text = genLongStudy();
    state.sizes[filePath] = text.length;
    state.texts[filePath] = text;
    const read = (section: string) => {
        return handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/Default/JHN.3.study.md',
            section,
        }) as Promise<any>;
    };

    await expect(read('  background ')).resolves.toEqual({
        file: 'resources/Default/JHN.3.study.md',
        kind: 'text',
        section: 'Background',
        text: `## Background\n\n${'b'.repeat(10_000)}`,
    });

    // Past 16 KB the section says which headings inside it to read.
    const translation = await read('Translation');
    expect(translation.section).toBe('Translation');
    expect(translation.text).toHaveLength(16 * 1024);
    expect(translation.text.startsWith('## Translation\n\nXx words.')).toBe(
        true,
    );
    expect(translation.note).toBe(
        'Only the start of this section is here. Read a heading inside it ' +
            'with `section`:\n## Translation\n### Part one',
    );

    const missing = await read('Prayer');
    expect(missing.isError).toBe(true);
    expect(missing.reason).toContain('The file has no section “Prayer”.');
});

test('a section is read only from a text file; a note is read whole', async () => {
    const notePath = '/resources/notes.own';
    state.sizes[notePath] = 50;
    state.noteText = '## Heading\nnote item text';
    state.scanResults['/resources'] = { filePaths: [notePath] };

    await expect(
        handleAgentResourcesRequest({
            action: 'read',
            file: 'resources/notes.own',
            section: 'Heading',
        }),
    ).resolves.toEqual({
        file: 'resources/notes.own',
        kind: 'note',
        text: '## Heading\nnote item text',
    });
});
