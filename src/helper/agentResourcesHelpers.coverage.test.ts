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
