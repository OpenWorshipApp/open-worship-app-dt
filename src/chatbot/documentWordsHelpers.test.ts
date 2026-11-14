import { beforeEach, describe, expect, test, vi } from 'vitest';

// A document's words read off the disk the way the app reads its kind
// (EC-590). The disk, the main process's two converters, its PDF page
// reader and the md5 of a file are stood in for here; the HTML and JSON
// readers are the real ones. A converter writes what `convertedMap` says
// for that file's name into the folder it is handed, as the real one does.
const { diskState, sendState, md5State } = vi.hoisted(() => ({
    diskState: {
        sizeMap: new Map<string, number>(),
        textMap: new Map<string, string>(),
        deletedList: [] as string[],
        isDeleteFailing: false,
    },
    sendState: {
        channelList: [] as { channel: string; data: any }[],
        convertedMap: new Map<string, Record<string, string>>(),
        isConverting: true,
        pdfAnswer: null as any,
    },
    md5State: { map: new Map<string, string>() },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => {
        return diskState.textMap.has(filePath);
    },
    fsDeleteDir: async (dirPath: string) => {
        if (diskState.isDeleteFailing) {
            throw new Error(`EBUSY: ${dirPath}`);
        }
        diskState.deletedList.push(dirPath);
        for (const key of [...diskState.textMap.keys()]) {
            if (key.startsWith(`${dirPath}/`)) {
                diskState.textMap.delete(key);
            }
        }
    },
    fsGetFileSize: async (filePath: string) => {
        const size = diskState.sizeMap.get(filePath);
        if (size === undefined) {
            throw new Error(`ENOENT: ${filePath}`);
        }
        return size;
    },
    // As the real one: the converters' byte order mark taken off.
    fsReadFile: async (filePath: string) => {
        const text = diskState.textMap.get(filePath);
        if (text === undefined) {
            throw new Error(`ENOENT: ${filePath}`);
        }
        return text.replace(/^\uFEFF/, '');
    },
    getTempPath: () => {
        return '/tmp';
    },
    pathBasename: (filePath: string) => {
        return filePath.split('/').pop() ?? '';
    },
    pathDirname: (filePath: string) => {
        return filePath.split('/').slice(0, -1).join('/');
    },
    pathJoin: (...parts: string[]) => {
        return parts.join('/').replace(/\/+/g, '/');
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: async (channel: string, data: any) => {
        sendState.channelList.push({ channel, data });
        if (channel === 'main:app:pdf-to-chat-pages') {
            return sendState.pdfAnswer;
        }
        if (!sendState.isConverting) {
            return false;
        }
        const fileName = String(data.filePath).split('/').pop() ?? '';
        const written = sendState.convertedMap.get(fileName) ?? {};
        for (const [name, text] of Object.entries(written)) {
            diskState.textMap.set(`${data.outDir}/${name}`, text);
        }
        return true;
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            generateFileMD5: async (filePath: string) => {
                return md5State.map.get(filePath) ?? 'another-copy';
            },
        },
    },
}));

import {
    MAX_DOCUMENT_WORDS_FILE_BYTES,
    readDocumentWords,
} from './documentWordsHelpers';

const BOM = '\uFEFF';

function genSlideHtml(lines: string[]) {
    return (
        `${BOM}<!DOCTYPE html><html><head><title>Slide</title></head>` +
        '<body><style>p { margin: 0; }</style><svg><g><foreignObject>' +
        '<div>' +
        lines
            .map((line) => {
                return `<p><span>${line}</span></p>`;
            })
            .join('') +
        '</div></foreignObject></g></svg></body></html>'
    );
}

// A hymn as the deck converter writes it: the header every slide repeats,
// a hidden slide, and a name `info.json` lists that it never wrote.
const DECK_FILES = {
    'info.json': `${BOM}${JSON.stringify({
        slides: [
            { htmlFileName: 'slide1.html' },
            { htmlFileName: 'slide2.html', isDisabled: true },
            { htmlFileName: 'slide3.html' },
            { htmlFileName: '../outside.html' },
        ],
        checksum: { md5: 'deck-md5' },
    })}`,
    'slide1.html': genSlideHtml(['# 12 1/2', 'Amazing grace', 'how sweet']),
    'slide2.html': genSlideHtml(['Announcements']),
    'slide3.html': genSlideHtml(['# 12 2/2', 'I once was lost', 'now found']),
};

const WORD_FILES = {
    'info.json': `${BOM}${JSON.stringify({
        pages: [{ htmlFileName: 'page1.html' }, { htmlFileName: 'page2.html' }],
        checksum: { md5: 'word-md5' },
    })}`,
    'page1.html':
        '<body><div class="page-header"><p>Hymnal</p></div>' +
        '<div class="document"><p>Amazing grace</p><p>&nbsp;</p>' +
        '<p>I once was lost</p></div>' +
        '<div class="page-footer"><p>1</p></div></body>',
    'page2.html':
        '<body><div class="document"><p>Was blind</p></div>' +
        '<div class="page-footer"><p>2</p></div></body>',
};

const DECK_WORDS = 'Amazing grace\nhow sweet\n\nI once was lost\nnow found';

function putFile(filePath: string, size = 1000) {
    diskState.sizeMap.set(filePath, size);
}

function putFolder(dirPath: string, files: Record<string, string>) {
    for (const [name, text] of Object.entries(files)) {
        diskState.textMap.set(`${dirPath}/${name}`, text);
    }
}

function listConverted() {
    return sendState.channelList.filter((one) => {
        return one.channel !== 'main:app:pdf-to-chat-pages';
    });
}

beforeEach(() => {
    diskState.sizeMap.clear();
    diskState.textMap.clear();
    diskState.deletedList.length = 0;
    diskState.isDeleteFailing = false;
    sendState.channelList.length = 0;
    sendState.convertedMap.clear();
    sendState.isConverting = true;
    sendState.pdfAnswer = null;
    md5State.map.clear();
});

describe('a deck or a Word file, through the converter', () => {
    test("the app's preview of this copy is read as it stands", async () => {
        putFile('/docs/Grace.pptx');
        putFolder('/docs/Grace.pptx-htmls', DECK_FILES);
        md5State.map.set('/docs/Grace.pptx', 'deck-md5');
        expect(await readDocumentWords('/docs/Grace.pptx')).toBe(DECK_WORDS);
        // Nothing converted, nothing deleted: the preview is the app's own.
        expect(listConverted()).toEqual([]);
        expect(diskState.deletedList).toEqual([]);
    });

    test('with no preview, a copy is converted in the temporary folder and deleted', async () => {
        putFile('/docs/Grace.pptx');
        sendState.convertedMap.set('Grace.pptx', DECK_FILES);
        expect(await readDocumentWords('/docs/Grace.pptx')).toBe(DECK_WORDS);
        const [converted] = listConverted();
        expect(converted.channel).toBe('main:app:pptx-to-htmls');
        expect(converted.data.filePath).toBe('/docs/Grace.pptx');
        // Never beside the person's file.
        expect(converted.data.outDir).toMatch(
            /^\/tmp\/open-worship-app-song-words\/[0-9a-f-]{36}$/,
        );
        expect(diskState.deletedList).toEqual([converted.data.outDir]);
        expect(
            [...diskState.textMap.keys()].some((key) => {
                return key.startsWith('/tmp/');
            }),
        ).toBe(false);
    });

    test('a preview of another copy of the file is not read', async () => {
        putFile('/docs/Grace.pptx');
        putFolder('/docs/Grace.pptx-htmls', {
            ...DECK_FILES,
            'slide1.html': genSlideHtml(['Old words']),
        });
        sendState.convertedMap.set('Grace.pptx', DECK_FILES);
        expect(await readDocumentWords('/docs/Grace.pptx')).toBe(DECK_WORDS);
        expect(listConverted()).toHaveLength(1);
    });

    test("a Word file's pages are one block, its header and footer left out", async () => {
        putFile('/docs/Hymn.docx');
        sendState.convertedMap.set('Hymn.docx', WORD_FILES);
        expect(await readDocumentWords('/docs/Hymn.docx')).toBe(
            'Amazing grace\n\nI once was lost\nWas blind',
        );
        expect(listConverted()[0].channel).toBe('main:app:docx-to-htmls');
        putFolder('/docs/Hymn.docx-docx-htmls', WORD_FILES);
        md5State.map.set('/docs/Hymn.docx', 'word-md5');
        sendState.channelList.length = 0;
        expect(await readDocumentWords('/docs/Hymn.docx')).toBe(
            'Amazing grace\n\nI once was lost\nWas blind',
        );
        expect(listConverted()).toEqual([]);
    });

    test('a conversion that fails is no words, and its folder still goes', async () => {
        putFile('/docs/Grace.pptx');
        sendState.isConverting = false;
        expect(await readDocumentWords('/docs/Grace.pptx')).toBeNull();
        expect(diskState.deletedList).toHaveLength(1);
    });

    test('a folder that cannot be deleted does not lose the words', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        putFile('/docs/Grace.pptx');
        sendState.convertedMap.set('Grace.pptx', DECK_FILES);
        diskState.isDeleteFailing = true;
        expect(await readDocumentWords('/docs/Grace.pptx')).toBe(DECK_WORDS);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    test('a deck with no words in it is none', async () => {
        putFile('/docs/Pictures.pptx');
        sendState.convertedMap.set('Pictures.pptx', {
            'info.json': JSON.stringify({
                slides: [{ htmlFileName: 'slide1.html' }],
            }),
            'slide1.html': genSlideHtml([]),
        });
        expect(await readDocumentWords('/docs/Pictures.pptx')).toBeNull();
    });
});

describe('a PDF, through the page reader', () => {
    test('its text layer, eight pages at most, the pictures as small as drawn', async () => {
        putFile('/docs/Hymn.pdf');
        sendState.pdfAnswer = {
            isSuccessful: true,
            pageCount: 2,
            pageTexts: [
                { page: 1, text: 'Amazing grace\nhow sweet\n\n1' },
                { page: 2, text: 'I once was lost\n2' },
            ],
            dataUrls: [],
        };
        expect(await readDocumentWords('/docs/Hymn.pdf')).toBe(
            'Amazing grace\nhow sweet\n\nI once was lost',
        );
        expect(sendState.channelList).toEqual([
            {
                channel: 'main:app:pdf-to-chat-pages',
                data: { filePath: '/docs/Hymn.pdf', maxPages: 8, longEdge: 64 },
            },
        ]);
    });

    test('a scan, or a PDF the reader could not open, is no words', async () => {
        putFile('/docs/Scan.pdf');
        sendState.pdfAnswer = {
            isSuccessful: true,
            pageTexts: [{ page: 1, text: null }],
        };
        expect(await readDocumentWords('/docs/Scan.pdf')).toBeNull();
        sendState.pdfAnswer = { isSuccessful: false };
        expect(await readDocumentWords('/docs/Scan.pdf')).toBeNull();
    });
});

describe('a slide document, as the JSON it is', () => {
    test('its text boxes, a slide a block', async () => {
        putFile('/docs/Sunday.ows');
        diskState.textMap.set(
            '/docs/Sunday.ows',
            JSON.stringify({
                items: [
                    {
                        canvasItems: [
                            { type: 'text', text: 'Amazing grace\nhow sweet' },
                        ],
                    },
                    {
                        canvasItems: [
                            { type: 'text', text: 'I once was lost' },
                        ],
                    },
                ],
            }),
        );
        expect(await readDocumentWords('/docs/Sunday.ows')).toBe(
            'Amazing grace\nhow sweet\n\nI once was lost',
        );
        expect(sendState.channelList).toEqual([]);
    });

    test('a file that is no slide document is no words', async () => {
        putFile('/docs/Broken.ows');
        diskState.textMap.set('/docs/Broken.ows', '{ not json');
        expect(await readDocumentWords('/docs/Broken.ows')).toBeNull();
    });
});

describe('what is never read', () => {
    test('another kind of file, one too large, one not there', async () => {
        putFile('/docs/song.owl');
        expect(await readDocumentWords('/docs/song.owl')).toBeNull();
        putFile('/docs/old.ppt');
        expect(await readDocumentWords('/docs/old.ppt')).toBeNull();
        putFile('/docs/Huge.pptx', MAX_DOCUMENT_WORDS_FILE_BYTES + 1);
        sendState.convertedMap.set('Huge.pptx', DECK_FILES);
        expect(await readDocumentWords('/docs/Huge.pptx')).toBeNull();
        expect(sendState.channelList).toEqual([]);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(await readDocumentWords('/docs/Gone.pptx')).toBeNull();
        warn.mockRestore();
    });
});
