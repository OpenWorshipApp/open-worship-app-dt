// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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
        return h.index;
    },
    loadLookupTextNeedlesFile: async (...args: unknown[]) => {
        h.needlesLoadArgs.push(args);
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
        return { filePaths: h.scanFilePaths };
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => h.fileSet.has(filePath),
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
    MAX_REFERENCE_TEXT_LENGTH,
    openResourceFileWindow,
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

describe('decorateMarkdownReferences', () => {
    test('links the people and places the chapter attests, and verses', async () => {
        const element = genArticle(
            '<p>Nicodemus came by night; Zacharias and Egypt. ' +
                'See Ezekiel 36:25-27 and John 3:16.</p>',
        );
        const count = await decorateMarkdownReferences(
            element,
            STUDY_PATH,
            isFresh,
        );
        expect(count).toBe(5);
        expect(listLinks(element)).toEqual([
            [
                'app-markdown-ref app-markdown-ref-name',
                'Nicodemus',
                {
                    kind: 'panel',
                    request: {
                        kind: 'name',
                        target: 'nicodemus_1',
                        name: 'Nicodemus',
                    },
                },
            ],
            [
                'app-markdown-ref app-markdown-ref-name',
                'Zacharias',
                {
                    kind: 'panel',
                    request: {
                        kind: 'name',
                        target: 'zacharias_1',
                        name: 'Zacharias',
                    },
                },
            ],
            [
                'app-markdown-ref app-markdown-ref-location',
                'Egypt',
                {
                    kind: 'panel',
                    request: {
                        kind: 'location',
                        target: 'egypt_1',
                        name: 'Egypt',
                    },
                },
            ],
            [
                'app-markdown-ref app-markdown-ref-verse',
                'Ezekiel 36:25-27',
                {
                    kind: 'panel',
                    request: {
                        kind: 'verse',
                        target: 'EZK 36:25-27',
                        name: 'Ezekiel 36:25-27',
                    },
                },
            ],
            [
                'app-markdown-ref app-markdown-ref-verse',
                'John 3:16',
                {
                    kind: 'panel',
                    request: {
                        kind: 'verse',
                        target: 'JHN 3:16',
                        name: 'John 3:16',
                    },
                },
            ],
        ]);
        // The words read the same; only the links are new.
        expect(element.textContent).toBe(
            'Nicodemus came by night; Zacharias and Egypt. ' +
                'See Ezekiel 36:25-27 and John 3:16.',
        );
        // The index the Reader built, never built here.
        expect(h.indexLoadOptions).toEqual([{ isBuildSkipped: true }]);
    });

    test('without a chapter in the file name, only a name one record bears', async () => {
        const element = genArticle('<p>Nicodemus, Zacharias and Egypt.</p>');
        await decorateMarkdownReferences(element, '/notes/Sermon.md', isFresh);
        expect(
            listLinks(element).map((one) => {
                return one[1];
            }),
        ).toEqual(['Nicodemus', 'Egypt']);
    });

    test('a verse named as only another language writes it reads in that Bible', async () => {
        const element = genArticle('<p>Xjohn 3:16; 3:17</p>');
        await decorateMarkdownReferences(element, STUDY_PATH, isFresh);
        expect(
            listLinks(element).map((one) => {
                return one[2];
            }),
        ).toEqual([
            {
                kind: 'panel',
                request: {
                    kind: 'verse',
                    target: 'JHN 3:16',
                    name: 'Xjohn 3:16',
                    bibleKey: 'XXB',
                },
            },
            {
                kind: 'panel',
                request: {
                    kind: 'verse',
                    target: 'JHN 3:17',
                    name: '3:17',
                    bibleKey: 'XXB',
                },
            },
        ]);
    });

    test('a verse reads in an installed Bible named in brackets right after it', async () => {
        // 2026-11-12: the user's John 3 study heads its chapter as the app's
        // studies do, `> **John 3:1-36** (Amplified)`, and its printout read
        // the chapter from the KJV.
        const element = genArticle(
            '<blockquote><p><strong>John 3:1-36</strong> (kjv)</p></blockquote>' +
                '<p>John 3:16 (XXB), Ezekiel 36:25 (see also) and ' +
                'Xjohn 3:3 (NIV).</p>' +
                '<p><strong>John 3:5</strong> <em>(XXB)</em></p>' +
                '<p>John 3:20 <em>(KJV)</em></p>' +
                '<p><em>John 3:17</em></p><p>(KJV)</p>' +
                '<div><p><strong>John 3:18</strong></p>(KJV)</div>' +
                '<p><strong>John 3:19</strong> <code>(KJV)</code></p>' +
                '<p>John 3:21 is in it (KJV)</p>',
        );
        await decorateMarkdownReferences(element, STUDY_PATH, isFresh);
        expect(
            listLinks(element).map((one) => {
                const { request, isBibleNamed } = one[2] as {
                    request: { name: string; bibleKey?: string };
                    isBibleNamed?: true;
                };
                return [request.name, request.bibleKey, isBibleNamed];
            }),
        ).toEqual([
            // Out of the bold, case aside, as the Bible's key is written.
            ['John 3:1-36', 'KJV', true],
            ['John 3:16', 'XXB', true],
            // Brackets naming no installed Bible change nothing: the Bible
            // its book is written for, named by nobody.
            ['Ezekiel 36:25', undefined, undefined],
            ['Xjohn 3:3', 'XXB', undefined],
            ['John 3:5', 'XXB', true],
            ['John 3:20', 'KJV', true],
            // Not right after it: the next paragraph, words past its own
            // paragraph, a code span, other words between.
            ['John 3:17', undefined, undefined],
            ['John 3:18', undefined, undefined],
            ['John 3:19', undefined, undefined],
            ['John 3:21', undefined, undefined],
        ]);
    });

    test('names in the lookup language come from its own words, on the chapter', async () => {
        h.langCode = 'xx';
        h.needles = { version: 3, needles: ['Nikodem', '', '', 'Ejip'] };
        const element = genArticle('<p>Nikodem went to Ejip.</p>');
        await decorateMarkdownReferences(element, STUDY_PATH, isFresh);
        expect(
            listLinks(element).map((one) => {
                return one[1];
            }),
        ).toEqual(['Nikodem']);
        expect(h.needlesLoadArgs).toEqual([['xx', { isBuildSkipped: true }]]);
    });

    test('a file name links only when the file is there, beside or in Resources', async () => {
        h.fileSet.add('/res/Default/JHN.3.Love.md');
        h.folderList = ['/shelf'];
        h.scanFilePaths = ['/shelf/pdf/mat.18.PDF', '/shelf/pdf/MAT.17.pdf'];
        const element = genArticle(
            '<p>Read JHN.3.Love.md, MAT.18.pdf and GEN.1.gone.md.</p>',
        );
        await decorateMarkdownReferences(element, STUDY_PATH, isFresh);
        expect(
            listLinks(element).map((one) => {
                return [one[1], one[2]];
            }),
        ).toEqual([
            [
                'JHN.3.Love.md',
                { kind: 'file', filePath: '/res/Default/JHN.3.Love.md' },
            ],
            ['MAT.18.pdf', { kind: 'file', filePath: '/shelf/pdf/mat.18.PDF' }],
        ]);
        // One walk a folder, for every name not found beside the file.
        expect(h.scanCalls).toEqual([
            [
                '/shelf',
                [
                    { bookKey: 'MAT', chapter: 18 },
                    { bookKey: 'GEN', chapter: 1 },
                ],
            ],
        ]);
    });

    test('nothing in a link, code, a diagram or a span the file wrote', async () => {
        const element = genArticle(
            '<p><a href="x.md">John 3:16</a> <code>John 3:16</code></p>' +
                '<pre>Nicodemus</pre>' +
                '<div class="app-markdown-mermaid">Egypt</div>' +
                '<span class="app-markdown-ref">Nicodemus</span>',
        );
        expect(
            await decorateMarkdownReferences(element, STUDY_PATH, isFresh),
        ).toBe(0);
        // The forged span opens nothing.
        expect(
            findMarkdownRef(element.querySelector('.app-markdown-ref')),
        ).toBeNull();
        expect(findMarkdownRef(null)).toBeNull();
    });

    test('a page drawn again meanwhile is not touched, and a long one is left as written', async () => {
        const element = genArticle('<p>Nicodemus</p>');
        expect(
            await decorateMarkdownReferences(element, STUDY_PATH, () => true),
        ).toBe(0);
        expect(element.innerHTML).toBe('<p>Nicodemus</p>');

        const longElement = genArticle(
            `<p>${'x'.repeat(MAX_REFERENCE_TEXT_LENGTH)} Nicodemus</p>`,
        );
        expect(
            await decorateMarkdownReferences(longElement, STUDY_PATH, isFresh),
        ).toBe(0);
        expect(h.bookListCount).toBe(0);
    });

    test('what it reads is held while pages are drawn, and let go after', async () => {
        vi.useFakeTimers();
        const element = genArticle('<p>John 3:16</p>');
        await decorateMarkdownReferences(element, STUDY_PATH, isFresh);
        await decorateMarkdownReferences(
            genArticle('<p>John 3:17</p>'),
            STUDY_PATH,
            isFresh,
        );
        expect(h.bookListCount).toBe(1);
        vi.advanceTimersByTime(30_000);
        await decorateMarkdownReferences(
            genArticle('<p>John 3:18</p>'),
            STUDY_PATH,
            isFresh,
        );
        expect(h.bookListCount).toBe(2);
    });
});

describe('openResourceFileWindow', () => {
    test('a file of each kind opens in its own window, anything else in its folder', async () => {
        await openResourceFileWindow('/res/MAT.18.PDF');
        expect(h.openPdf).toHaveBeenCalledExactlyOnceWith('/res/MAT.18.PDF');
        await openResourceFileWindow('/res/JHN.3.Love.markdown');
        expect(h.openMarkdown).toHaveBeenCalledExactlyOnceWith(
            '/res/JHN.3.Love.markdown',
        );
        h.noteItems = [
            { kind: 'verse', verseKey: 'JHN 3:16' },
            { kind: 'note', id: 7, title: 'Sunday' },
        ];
        await openResourceFileWindow('/res/GEN.1.own');
        expect(h.openNote).toHaveBeenCalledExactlyOnceWith('/res/GEN.1.own', 7);
        h.noteItems = [];
        await openResourceFileWindow('/res/Empty.own');
        await openResourceFileWindow('/res/tool.exe');
        expect(h.reveal.mock.calls).toEqual([
            ['/res/Empty.own'],
            ['/res/tool.exe'],
        ]);
    });
});
