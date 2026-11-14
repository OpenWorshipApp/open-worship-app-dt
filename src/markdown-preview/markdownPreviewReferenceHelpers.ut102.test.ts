// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// UT-102: what the page still links when one of the files it reads fails --
// the book table, the names index, the lookup language's words, a file
// check or a Resources walk -- and a page changed while they were read.
// The surface below is the module's own test's:
// 2026-11-11, the user: the Markdown Preview has _to highlight
// name/location-name/bible-verse/other-resource and can click to view_.
// The files it reads are stand-ins: a book table of four books in English and
// in a made-up language, a names index of three records, and a disk.
const h = vi.hoisted(() => ({
    langCode: 'en',
    fileSet: new Set<string>(),
    folderList: [] as string[],
    scanCalls: [] as [string, unknown][],
    scanFilePaths: [] as string[],
    indexLoadOptions: [] as unknown[],
    needlesLoadArgs: [] as unknown[][],
    index: null as unknown,
    needles: null as unknown,
    bookListCount: 0,
    openPdf: vi.fn(),
    openMarkdown: vi.fn(),
    openNote: vi.fn(),
    reveal: vi.fn(),
    noteItems: [] as unknown[],
    failing: new Set<string>(),
    brokenFileSet: new Set<string>(),
    brokenFolderSet: new Set<string>(),
    onBookList: null as null | (() => void),
}));

vi.mock('../server/appProvider', () => ({
    default: { isPageScreen: false, systemUtils: { isDev: false } },
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    checkIsValidLangCode: () => true,
    getLangCode: () => 'en',
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../helper/bible-helpers/bibleBookNameListHelpers', () => ({
    listBibleBookNames: async () => {
        h.bookListCount++;
        h.onBookList?.();
        if (h.failing.has('books')) {
            throw new Error('no book table');
        }
        return {
            kind: 'books',
            bookKeys: ['GEN', 'EXO', 'EZK', 'JHN'],
            english: ['Genesis', 'Exodus', 'Ezekiel', 'John'],
            bibles: [
                {
                    keys: ['KJV'],
                    locale: 'en',
                    books: ['Genesis', 'Exodus', 'Ezekiel', 'John'],
                },
                {
                    keys: ['XXB'],
                    locale: 'xx',
                    books: ['Xgen', 'Xexo', 'Xezk', 'Xjohn'],
                },
            ],
        };
    },
}));
vi.mock('../location-name-lookup/lookupIndexFileHelpers', () => ({
    loadLookupTextIndexFile: async (options: unknown) => {
        h.indexLoadOptions.push(options);
        if (h.failing.has('index')) {
            throw new Error('no index');
        }
        return h.index;
    },
    loadLookupTextNeedlesFile: async (...args: unknown[]) => {
        h.needlesLoadArgs.push(args);
        if (h.failing.has('needles')) {
            throw new Error('no needles');
        }
        return args[0] === 'en' ? null : h.needles;
    },
    genLookupFileStore: () => () => null,
    genLookupLangFileStore: () => () => null,
}));
vi.mock('../location-name-lookup/lookupLangHelpers', () => ({
    getSelectedLookupLangCode: () => h.langCode,
}));
vi.mock('../resources/resourcesFolderHelpers', () => ({
    getResourcesFolderList: () => h.folderList,
}));
vi.mock('../resources/resourcesScanHelpers', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    scanResourceFiles: async (dirPath: string, targets: unknown) => {
        h.scanCalls.push([dirPath, targets]);
        if (h.brokenFolderSet.has(dirPath)) {
            throw new Error('folder unreadable');
        }
        return {
            filePaths: h.scanFilePaths.filter((filePath) => {
                return filePath.startsWith(`${dirPath}/`);
            }),
        };
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => {
        if (h.brokenFileSet.has(filePath)) {
            throw new Error('permission denied');
        }
        return h.fileSet.has(filePath);
    },
    pathBasename: (filePath: string) => filePath.split('/').at(-1) ?? '',
    pathDirname: (filePath: string) =>
        filePath.slice(0, filePath.lastIndexOf('/')),
    pathJoin: (...parts: string[]) => parts.join('/'),
    // What the real `resourcesScanHelpers` (its own book table) reads on load.
    checkIsHiddenName: (name: string) => name.startsWith('.'),
    checkIsSystemFileName: () => false,
    fsListDirents: async () => [],
    getMimetypeExtensions: () => [],
}));
vi.mock('../helper/pdfPreviewHelpers', () => ({ openPdfPreview: h.openPdf }));
vi.mock('../resources/resourcePreviewOpenHelpers', () => ({
    openMarkdownPreview: h.openMarkdown,
    openBibleNotePreview: h.openNote,
}));
vi.mock('../resources/resourcePreviewHelpers', () => ({
    readResourceNoteItems: async () => ({
        items: h.noteItems,
        failureReason: null,
    }),
}));
vi.mock('../server/appHelpers', () => ({ showFileOrDirExplorer: h.reveal }));

import {
    decorateMarkdownReferences,
    findMarkdownRef,
    releaseReferenceData,
} from './markdownPreviewReferenceHelpers';

const STUDY_PATH = '/res/Default/JHN.3.The New Birth.md';

// Nicodemus is attested in John 3; one Zacharias each in Luke and Ezra, so
// only a chapter's evidence can tell which; Egypt is a place one record
// bears in the whole dataset.
function genIndex() {
    return {
        version: 3,
        ids: ['nicodemus_1', 'zacharias_1', 'zacharias_2', 'egypt_1'],
        names: { nicodemus: [0], zacharias: [1, 2] },
        locations: { egypt: [3] },
        verseNames: { 'JHN 3:1': [0], 'JHN 3:9': [1], 'EZR 5:1': [2] },
        verseLocations: {},
    };
}

function genArticle(html: string) {
    const element = document.createElement('div');
    element.innerHTML = html;
    document.body.append(element);
    return element;
}

function listLinks(element: HTMLElement) {
    return [...element.querySelectorAll('.app-markdown-ref')].map((link) => {
        return [link.className, link.textContent, findMarkdownRef(link)];
    });
}

beforeEach(() => {
    h.langCode = 'en';
    h.fileSet = new Set();
    h.folderList = [];
    h.scanCalls = [];
    h.scanFilePaths = [];
    h.indexLoadOptions = [];
    h.needlesLoadArgs = [];
    h.index = genIndex();
    h.needles = null;
    h.bookListCount = 0;
    h.noteItems = [];
    h.failing = new Set();
    h.brokenFileSet = new Set();
    h.brokenFolderSet = new Set();
    h.onBookList = null;
    h.openPdf.mockReset();
    h.openMarkdown.mockReset();
    h.openNote.mockReset();
    h.reveal.mockReset();
    releaseReferenceData();
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
});

const isFresh = () => false;

function listLinkTexts(element: HTMLElement) {
    return listLinks(element).map((one) => {
        return one[1];
    });
}

describe('a file the page reads that fails', () => {
    test('no book table: the names are still linked, the verses are not', async () => {
        h.failing.add('books');
        const element = genArticle('<p>Nicodemus read John 3:16.</p>');
        expect(
            await decorateMarkdownReferences(element, STUDY_PATH, isFresh),
        ).toBe(1);
        expect(listLinkTexts(element)).toEqual(['Nicodemus']);
    });

    test('no names index: the verses are still linked, no name is', async () => {
        h.failing.add('index');
        const element = genArticle('<p>Nicodemus read John 3:16.</p>');
        expect(
            await decorateMarkdownReferences(element, STUDY_PATH, isFresh),
        ).toBe(1);
        expect(listLinkTexts(element)).toEqual(['John 3:16']);
    });

    test("the lookup language's words failing leaves its own words unlinked", async () => {
        h.langCode = 'xx';
        h.needles = { version: 3, needles: ['Nikodem', '', '', 'Ejip'] };
        h.failing.add('needles');
        const element = genArticle('<p>Nikodem read John 3:16.</p>');
        await decorateMarkdownReferences(element, STUDY_PATH, isFresh);
        expect(listLinkTexts(element)).toEqual(['John 3:16']);
        expect(h.needlesLoadArgs).toEqual([['xx', { isBuildSkipped: true }]]);
    });

    test('every file found beside the page walks no Resources folder', async () => {
        h.fileSet.add('/res/Default/JHN.3.Love.md');
        h.fileSet.add('/res/Default/MAT.18.pdf');
        h.folderList = ['/shelf'];
        const element = genArticle('<p>Read JHN.3.Love.md and MAT.18.pdf.</p>');
        await decorateMarkdownReferences(element, STUDY_PATH, isFresh);
        expect(
            listLinks(element).map((one) => {
                return one[2];
            }),
        ).toEqual([
            { kind: 'file', filePath: '/res/Default/JHN.3.Love.md' },
            { kind: 'file', filePath: '/res/Default/MAT.18.pdf' },
        ]);
        expect(h.scanCalls).toEqual([]);
    });

    test('a file that cannot be checked is looked for in Resources, and a folder that cannot be walked is passed over', async () => {
        h.brokenFileSet.add('/res/Default/MAT.18.pdf');
        h.folderList = ['/broken', '/shelf'];
        h.brokenFolderSet.add('/broken');
        h.scanFilePaths = ['/shelf/pdf/MAT.18.pdf'];
        const element = genArticle('<p>Read MAT.18.pdf.</p>');
        await decorateMarkdownReferences(element, STUDY_PATH, isFresh);
        expect(
            listLinks(element).map((one) => {
                return one[2];
            }),
        ).toEqual([{ kind: 'file', filePath: '/shelf/pdf/MAT.18.pdf' }]);
        expect(
            h.scanCalls.map((call) => {
                return call[0];
            }),
        ).toEqual(['/broken', '/shelf']);
    });
});

describe('a page that changes while its files are read', () => {
    test('drawn again meanwhile, it is left as it was', async () => {
        const element = genArticle('<p>Nicodemus read John 3:16.</p>');
        let lookCount = 0;
        const checkIsStale = () => {
            lookCount++;
            return lookCount > 1;
        };
        expect(
            await decorateMarkdownReferences(element, STUDY_PATH, checkIsStale),
        ).toBe(0);
        expect(lookCount).toBe(2);
        expect(element.innerHTML).toBe('<p>Nicodemus read John 3:16.</p>');
    });

    test('a paragraph taken out meanwhile is not linked; the rest are', async () => {
        const element = genArticle(
            '<p id="gone">Nicodemus came.</p><p>John 3:16</p>',
        );
        const removed = element.querySelector('#gone')!;
        h.onBookList = () => {
            removed.remove();
        };
        expect(
            await decorateMarkdownReferences(element, STUDY_PATH, isFresh),
        ).toBe(1);
        expect(listLinkTexts(element)).toEqual(['John 3:16']);
        expect(removed.querySelector('.app-markdown-ref')).toBeNull();
        expect(removed.textContent).toBe('Nicodemus came.');
    });
});
