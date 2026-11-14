// @vitest-environment jsdom
//
// `readAgentDocumentWords` -- the app side of `owa_media_file info` on a
// document: each kind read through what the app already makes of it (the
// PowerPoint and Word converters, the PDF page reader, a slide document's
// editing head), the words put in sung order by the REAL parsers and rules,
// and the pages with no readable words drawn as pictures on request. The
// converters, the main process and the slide renderer are stood in for;
// every channel nobody routed throws, so an unexpected call fails the test.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    routes: {} as Record<string, (data: any) => unknown>,
    sentList: [] as { channel: string; data: any }[],
    getPptxData: vi.fn(),
    getDocxData: vi.fn(),
    getJsonData: vi.fn(),
    appDocumentGetInstance: vi.fn(),
    genSlideHtml: vi.fn(),
    collectFontFaceCss: vi.fn(),
}));

vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: async (channel: string, data: any) => {
        mocks.sentList.push({ channel, data });
        const route = mocks.routes[channel];
        if (route === undefined) {
            throw new Error(`No route for ${channel}`);
        }
        return route(data);
    },
}));
vi.mock('../server/pptxHelpers', () => ({
    getPptxData: mocks.getPptxData,
}));
vi.mock('../server/docxHelpers', () => ({
    getDocxData: mocks.getDocxData,
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: { getInstance: mocks.appDocumentGetInstance },
}));
vi.mock('../app-document-presenter/items/SlideRendererComp', () => ({
    genSlideHtml: mocks.genSlideHtml,
}));
vi.mock('./printCssHelpers', () => ({
    collectFontFaceCss: mocks.collectFontFaceCss,
}));

import {
    readAgentDocumentWords,
    toAgentDocumentKind,
} from './agentDocumentWordsHelpers';

const CAPTURE = 'main:app:capture-document-pages';
const PDF_PAGES = 'main:app:pdf-to-chat-pages';

// One `pptx-to-html-conv` shape: a `<g data-id>` moved by `translate`, sized
// by its `rect`, its words in `<p>`s naming a face.
function genPptxBox(
    id: string,
    box: { x: number; y: number; width: number; height: number },
    family: string,
    lines: string[],
) {
    return (
        `<g data-id="${id}" transform="translate(${box.x},${box.y})">` +
        `<rect width="${box.width}" height="${box.height}"/>` +
        `<foreignObject width="${box.width}" height="${box.height}">` +
        '<div xmlns="http://www.w3.org/1999/xhtml">' +
        lines
            .map((line) => {
                return `<p><span style="font-family:'${family}',sans-serif">${line}</span></p>`;
            })
            .join('') +
        '</div></foreignObject></g>'
    );
}

function genPptxPicture(id: string, width: number, height: number) {
    return (
        `<g data-id="${id}" transform="translate(0,0)">` +
        `<image width="${width}" height="${height}" href="images/a.png"/></g>`
    );
}

function genPptxSlide(...groups: string[]) {
    return (
        '<!DOCTYPE html><html><body><div class="slide">' +
        `<svg width="1280" height="720">${groups.join('')}</svg>` +
        '</div></body></html>'
    );
}

function genHymnSlide(lines: string[]) {
    return genPptxSlide(
        genPptxBox(
            '1',
            { x: 40, y: 20, width: 1200, height: 70 },
            'Display Face',
            ['Hymn 12 Grace'],
        ),
        genPptxBox(
            '2',
            { x: 40, y: 120, width: 1200, height: 500 },
            'Body Face',
            lines,
        ),
    );
}

function genPptxSlideData(html: string, index: number, isDisabled = false) {
    return {
        html,
        isDisabled,
        htmlFilePath: `/docs/Grace.pptx-htmls/slide${index + 1}.html`,
    };
}

// A deck read off a church's: a heading over every verse, a hidden slide,
// and one slide that is a picture of the words.
function genDeck({
    dimensions,
    missingFontFamily,
}: {
    dimensions?: { width: number; height: number };
    missingFontFamily?: string[];
} = {}) {
    const htmls = [
        genHymnSlide([
            'Amazing grace how sweet the sound',
            'That saved a wretch like me',
        ]),
        genHymnSlide(['Announcements']),
        genHymnSlide(['I once was lost but now am found']),
        genPptxSlide(genPptxPicture('9', 1280, 720)),
    ];
    return {
        info: {
            dimensions,
            missingFontFamily,
            slides: htmls.map((html, index) => {
                return genPptxSlideData(html, index, index === 1);
            }),
        },
        baseDir: '/docs/Grace.pptx-htmls',
    };
}

const DECK_TEXT =
    'Hymn 12 Grace\n\n' +
    'Amazing grace how sweet the sound\nThat saved a wretch like me\n\n' +
    'I once was lost but now am found';

beforeEach(() => {
    for (const key of Object.keys(mocks.routes)) {
        delete mocks.routes[key];
    }
    mocks.sentList.length = 0;
    mocks.appDocumentGetInstance.mockImplementation(() => {
        return { getJsonData: mocks.getJsonData };
    });
    mocks.genSlideHtml.mockImplementation((canvasItems: any[]) => {
        const div = document.createElement('div');
        div.className = 'slide';
        div.textContent = `items:${canvasItems.length}`;
        return div;
    });
    mocks.collectFontFaceCss.mockImplementation(() => {
        return '@font-face { font-family: Body; }';
    });
});

describe('toAgentDocumentKind', () => {
    test('names each kind by its extension, in any case', () => {
        expect(toAgentDocumentKind('Grace.PPTX')).toBe('pptx');
        expect(toAgentDocumentKind('Grace.docx')).toBe('docx');
        expect(toAgentDocumentKind('Scan.Pdf')).toBe('pdf');
        expect(toAgentDocumentKind('Service.ows')).toBe('slide');
        expect(toAgentDocumentKind('Service.preview')).toBe('slide');
    });

    test('is null for any other file, and for a name with no extension', () => {
        expect(toAgentDocumentKind('notes.txt')).toBeNull();
        expect(toAgentDocumentKind('Grace.pptx.bak')).toBeNull();
        expect(toAgentDocumentKind('README')).toBeNull();
    });
});

describe('a file that is not a document', () => {
    test('is refused by name, and nothing is read', async () => {
        const result = await readAgentDocumentWords(
            '/docs/song.mp3',
            'song.mp3',
        );
        expect(result).toEqual({
            isError: true,
            reason:
                '"song.mp3" is not a PowerPoint, Word, PDF or slide ' +
                'document, so there are no words to read out of it here.',
        });
        expect(mocks.getPptxData).not.toHaveBeenCalled();
        expect(mocks.sentList).toEqual([]);
    });
});

describe('a PowerPoint deck', () => {
    test('that cannot be converted is an error naming the file', async () => {
        mocks.getPptxData.mockResolvedValue(null);
        const result = await readAgentDocumentWords(
            '/docs/Grace.pptx',
            'Grace.pptx',
        );
        expect(mocks.getPptxData).toHaveBeenCalledWith('/docs/Grace.pptx');
        expect(result).toEqual({
            isError: true,
            reason: '"Grace.pptx" could not be opened to read its words.',
        });
    });

    test('is read slide by slide: heading named, hidden slide left out, picture slide listed', async () => {
        mocks.getPptxData.mockResolvedValue(
            genDeck({ missingFontFamily: ['Display Face'] }),
        );
        const result = await readAgentDocumentWords(
            '/docs/Grace.pptx',
            'Grace.pptx',
        );
        expect(result).toEqual({
            kind: 'document',
            name: 'Grace.pptx',
            documentKind: 'pptx',
            title: 'Hymn 12 Grace',
            headings: ['Hymn 12 Grace'],
            fontFamily: 'Body Face',
            text: DECK_TEXT,
            characters: DECK_TEXT.length,
            blocks: [
                {
                    page: 1,
                    text:
                        'Amazing grace how sweet the sound\n' +
                        'That saved a wretch like me',
                },
                { page: 3, text: 'I once was lost but now am found' },
            ],
            skipped: { hidden: 1, headings: 2, numbers: 0, empty: 0 },
            pageCount: 4,
            readablePages: [1, 3],
            pictureNeededPages: [4],
        });
        // Not asked for pictures: nothing is drawn.
        expect(mocks.sentList).toEqual([]);
    });

    test("says so when the song's own face is one the computer lacks", async () => {
        mocks.getPptxData.mockResolvedValue(
            genDeck({ missingFontFamily: ['Body Face'] }),
        );
        const result = await readAgentDocumentWords(
            '/docs/Grace.pptx',
            'Grace.pptx',
        );
        expect(result.fontFamily).toBe('Body Face');
        expect(result.isFontMissing).toBe(true);
    });

    test('draws the picture slides at the deck size, from the converted folder', async () => {
        mocks.getPptxData.mockResolvedValue(
            genDeck({ dimensions: { width: 1280, height: 720 } }),
        );
        mocks.routes[CAPTURE] = () => {
            return {
                isSuccessful: true,
                dataUrls: ['data:image/png;base64,A'],
            };
        };
        const result = await readAgentDocumentWords(
            '/docs/Grace.pptx',
            'Grace.pptx',
            { pictures: true },
        );
        expect(mocks.sentList).toEqual([
            {
                channel: CAPTURE,
                data: {
                    dirPath: '/docs/Grace.pptx-htmls',
                    filePaths: ['/docs/Grace.pptx-htmls/slide4.html'],
                    width: 1280,
                    height: 720,
                },
            },
        ]);
        expect(result.pictureFor).toEqual([4]);
        expect(result.images).toEqual(['data:image/png;base64,A']);
        expect(result.isFontMissing).toBeUndefined();
    });

    test('a deck with no size of its own is drawn at 1920 by 1080', async () => {
        mocks.getPptxData.mockResolvedValue(genDeck());
        mocks.routes[CAPTURE] = () => {
            return {
                isSuccessful: true,
                dataUrls: ['data:image/png;base64,B'],
            };
        };
        await readAgentDocumentWords('/docs/Grace.pptx', 'Grace.pptx', {
            pictures: true,
        });
        expect(mocks.sentList[0].data).toMatchObject({
            width: 1920,
            height: 1080,
        });
    });

    test('a capture that fails, or draws nothing, leaves a note instead of pictures', async () => {
        mocks.getPptxData.mockResolvedValue(genDeck());
        const answers: unknown[] = [
            { isSuccessful: false, message: 'gone' },
            { isSuccessful: true, dataUrls: [] },
            { isSuccessful: true },
            null,
        ];
        mocks.routes[CAPTURE] = () => {
            return answers.shift();
        };
        for (let index = 0; index < 4; index += 1) {
            const result = await readAgentDocumentWords(
                '/docs/Grace.pptx',
                'Grace.pptx',
                { pictures: true },
            );
            expect(result.pictureNote).toBe(
                'The pages without readable words could not be drawn as ' +
                    'pictures.',
            );
            expect(result.images).toBeUndefined();
            expect(result.pictureFor).toBeUndefined();
            // The words are still all there.
            expect(result.text).toBe(DECK_TEXT);
        }
        expect(answers).toEqual([]);
    });

    test('draws eight picture pages at most, and names only those drawn', async () => {
        const slides = Array.from({ length: 10 }, (_one, index) => {
            return genPptxSlideData(
                genPptxSlide(genPptxPicture(`p${index}`, 1280, 720)),
                index,
            );
        });
        mocks.getPptxData.mockResolvedValue({
            info: { slides, missingFontFamily: [] },
            baseDir: '/docs/Grace.pptx-htmls',
        });
        // The capture stops at the first page it could not draw.
        mocks.routes[CAPTURE] = () => {
            return {
                isSuccessful: true,
                dataUrls: ['data:a', 'data:b', 'data:c'],
            };
        };
        const result = await readAgentDocumentWords(
            '/docs/Pictures.pptx',
            'Pictures.pptx',
            { pictures: true },
        );
        expect(result.pictureNeededPages).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ]);
        expect(mocks.sentList[0].data.filePaths).toEqual(
            [1, 2, 3, 4, 5, 6, 7, 8].map((number) => {
                return `/docs/Grace.pptx-htmls/slide${number}.html`;
            }),
        );
        expect(result.pictureFor).toEqual([1, 2, 3]);
        expect(result.images).toEqual(['data:a', 'data:b', 'data:c']);
        // No words at all: the title is the file's own name.
        expect(result.title).toBe('Pictures');
        expect(result.text).toBe('Pictures');
    });

    test('a deck where every page reads asks for no picture even when pictures are wanted', async () => {
        mocks.getPptxData.mockResolvedValue({
            info: {
                slides: [
                    genPptxSlideData(
                        genHymnSlide(['Amazing grace how sweet the sound']),
                        0,
                    ),
                ],
            },
            baseDir: '/docs/Grace.pptx-htmls',
        });
        const result = await readAgentDocumentWords(
            '/docs/Grace.pptx',
            'Grace.pptx',
            { pictures: true },
        );
        expect(result.pictureNeededPages).toEqual([]);
        expect(result.pictureNote).toBeUndefined();
        expect(result.images).toBeUndefined();
        expect(mocks.sentList).toEqual([]);
    });
});

describe('a Word file', () => {
    const HEADER = '<p>Hymnal of the Parish</p>';

    function genWordPage(body: string) {
        return (
            '<html><body style="font-family:\'Word Body\',serif">' +
            `${HEADER}${body}</body></html>`
        );
    }

    test('that cannot be converted is an error', async () => {
        mocks.getDocxData.mockResolvedValue(null);
        const result = await readAgentDocumentWords(
            '/docs/Grace.docx',
            'Grace.docx',
        );
        expect(mocks.getDocxData).toHaveBeenCalledWith('/docs/Grace.docx');
        expect(result).toMatchObject({ isError: true });
    });

    test('is read page by page: its heading the title, the header every page repeats left out', async () => {
        mocks.getDocxData.mockResolvedValue({
            info: {
                pages: [
                    {
                        html: genWordPage(
                            '<h1>Amazing Grace</h1>' +
                                '<p>Amazing grace how sweet the sound</p>' +
                                '<p>That saved a wretch like me</p>',
                        ),
                        width: '816',
                        height: '1056',
                        htmlFilePath: '/docs/Grace.docx-docx-htmls/page1.html',
                    },
                    {
                        html: genWordPage(
                            '<p>I once was lost but now am found</p>' +
                                '<p>Was blind but now I see</p>',
                        ),
                        htmlFilePath: '/docs/Grace.docx-docx-htmls/page2.html',
                    },
                    // A page the converter wrote nothing for.
                    { htmlFilePath: '/docs/Grace.docx-docx-htmls/page3.html' },
                ],
                missingFontFamily: ['Word Body'],
            },
            baseDirPath: '/docs/Grace.docx-docx-htmls',
        });
        const result = await readAgentDocumentWords(
            '/docs/Grace.docx',
            'Grace.docx',
        );
        expect(result).toMatchObject({
            documentKind: 'docx',
            title: 'Amazing Grace',
            headings: ['Amazing Grace'],
            fontFamily: 'Word Body',
            isFontMissing: true,
            text:
                'Amazing Grace\n\n' +
                'Amazing grace how sweet the sound\n' +
                'That saved a wretch like me\n\n' +
                'I once was lost but now am found\nWas blind but now I see',
            pageCount: 3,
            readablePages: [1, 2],
            pictureNeededPages: [],
            skipped: { hidden: 0, headings: 1, numbers: 0, empty: 1 },
        });
        expect(result.text).not.toContain('Hymnal');
    });

    test('a page that is a picture is drawn at its own size, from the converted folder', async () => {
        mocks.getDocxData.mockResolvedValue({
            info: {
                pages: [
                    {
                        html: '<html><body><p>Amazing grace how sweet</p></body></html>',
                        width: 800,
                        height: 1000,
                        htmlFilePath: '/w/page1.html',
                    },
                    {
                        html: '<html><body><img width="700" height="900"></body></html>',
                        width: 700,
                        height: 900,
                        htmlFilePath: '/w/page2.html',
                    },
                    {
                        html: '<html><body><img width="816" height="1056"></body></html>',
                        htmlFilePath: '/w/page3.html',
                    },
                ],
            },
            baseDirPath: '/w',
        });
        mocks.routes[CAPTURE] = () => {
            return { isSuccessful: true, dataUrls: ['data:2', 'data:3'] };
        };
        const result = await readAgentDocumentWords(
            '/docs/Scan.docx',
            'Scan.docx',
            { pictures: true },
        );
        expect(result.pictureNeededPages).toEqual([2, 3]);
        expect(mocks.sentList).toEqual([
            {
                channel: CAPTURE,
                data: {
                    dirPath: '/w',
                    filePaths: ['/w/page2.html', '/w/page3.html'],
                    // The first page drawn sets the size.
                    width: 700,
                    height: 900,
                },
            },
        ]);
        expect(result.pictureFor).toEqual([2, 3]);
        expect(result.images).toEqual(['data:2', 'data:3']);
        expect(result.fontFamily).toBeNull();
        expect(result.isFontMissing).toBeUndefined();
    });

    test('a page with no size of its own is drawn at the Letter page size', async () => {
        mocks.getDocxData.mockResolvedValue({
            info: {
                pages: [
                    {
                        html: '<html><body><img width="816" height="1056"></body></html>',
                        htmlFilePath: '/w/page1.html',
                    },
                ],
            },
            baseDirPath: '/w',
        });
        mocks.routes[CAPTURE] = () => {
            return { isSuccessful: true, dataUrls: ['data:1'] };
        };
        await readAgentDocumentWords('/docs/Scan.docx', 'Scan.docx', {
            pictures: true,
        });
        expect(mocks.sentList[0].data).toMatchObject({
            width: 816,
            height: 1056,
        });
    });
});

describe('a PDF', () => {
    test('is read through the help window page reader, eight pages at most', async () => {
        mocks.routes[PDF_PAGES] = () => {
            return {
                isSuccessful: true,
                pageCount: 12,
                startPage: 0,
                pageTexts: [
                    {
                        page: 1,
                        text: 'Amazing grace how sweet the sound\nThat saved a wretch like me',
                    },
                    { page: 2, text: null },
                    { page: 3, text: 'I once was lost but now am found' },
                ],
                dataUrls: ['data:p1', 'data:p2', 'data:p3'],
            };
        };
        const result = await readAgentDocumentWords(
            '/docs/Hymn.pdf',
            'Hymn.pdf',
        );
        expect(mocks.sentList).toEqual([
            {
                channel: PDF_PAGES,
                data: { filePath: '/docs/Hymn.pdf', startPage: 0, maxPages: 8 },
            },
        ]);
        expect(result).toMatchObject({
            documentKind: 'pdf',
            title: 'Hymn',
            fontFamily: null,
            pageCount: 12,
            readPageCount: 8,
            readablePages: [1, 3],
            pictureNeededPages: [2],
            text:
                'Hymn\n\nAmazing grace how sweet the sound\n' +
                'That saved a wretch like me\n\nI once was lost but now am found',
        });
        expect(result.images).toBeUndefined();
    });

    test("a scanned page's picture is the one the reader already drew, by page number", async () => {
        mocks.routes[PDF_PAGES] = () => {
            return {
                isSuccessful: true,
                startPage: 4,
                pageTexts: [
                    { page: 5, text: 'Amazing grace how sweet the sound' },
                    { page: 6, text: '' },
                    { page: 7, text: null },
                ],
                dataUrls: ['data:p5', 'data:p6', 'data:p7'],
            };
        };
        const result = await readAgentDocumentWords(
            '/docs/Hymn.pdf',
            'Hymn.pdf',
            { pictures: true },
        );
        // No page count of its own: the pages read are all there is.
        expect(result.pageCount).toBe(3);
        expect(result.readPageCount).toBeUndefined();
        expect(result.pictureNeededPages).toEqual([6, 7]);
        expect(result.pictureFor).toEqual([6, 7]);
        expect(result.images).toEqual(['data:p6', 'data:p7']);
        // Answered from the first reading: no second call.
        expect(mocks.sentList).toHaveLength(1);
    });

    test('pictures of pages the reader did not draw are a note, not a gap', async () => {
        mocks.routes[PDF_PAGES] = () => {
            return {
                isSuccessful: true,
                pageCount: 1,
                pageTexts: [{ page: 1, text: null }],
            };
        };
        const result = await readAgentDocumentWords(
            '/docs/Scan.pdf',
            'Scan.pdf',
            { pictures: true },
        );
        expect(result.pictureNeededPages).toEqual([1]);
        expect(result.pictureNote).toBe(
            'The pages without readable words could not be drawn as pictures.',
        );
    });

    test('a PDF the reader could not open is an error', async () => {
        const answers: unknown[] = [
            null,
            { isSuccessful: false },
            { isSuccessful: true, pageTexts: 'none' },
        ];
        mocks.routes[PDF_PAGES] = () => {
            return answers.shift();
        };
        for (let index = 0; index < 3; index += 1) {
            expect(
                await readAgentDocumentWords('/docs/Bad.pdf', 'Bad.pdf'),
            ).toEqual({
                isError: true,
                reason: '"Bad.pdf" could not be opened to read its words.',
            });
        }
    });
});

describe('a slide document', () => {
    function genTextItem(text: string, top: number, height = 400) {
        return {
            type: 'text',
            text,
            fontFamily: "'Slide Face', sans-serif",
            left: 40,
            top,
            width: 1200,
            height,
        };
    }

    const SLIDES = [
        {
            id: 1,
            metadata: { width: 1280, height: 720 },
            canvasItems: [
                genTextItem(
                    'Amazing grace how sweet the sound\nThat saved a wretch like me',
                    100,
                ),
            ],
        },
        {
            id: 2,
            isDisabled: true,
            metadata: { width: 1280, height: 720 },
            canvasItems: [genTextItem('Hidden words here', 100)],
        },
        {
            id: 3,
            metadata: { width: 1280, height: 720 },
            canvasItems: [
                {
                    type: 'image',
                    left: 0,
                    top: 0,
                    width: 1280,
                    height: 720,
                },
            ],
        },
        // No size and no items of its own.
        { id: 4 },
    ];

    test('is read from its editing head, a slide a page', async () => {
        mocks.getJsonData.mockResolvedValue({ items: SLIDES });
        const result = await readAgentDocumentWords(
            '/docs/Service.ows',
            'Service.ows',
        );
        expect(mocks.appDocumentGetInstance).toHaveBeenCalledWith(
            '/docs/Service.ows',
        );
        expect(result).toMatchObject({
            documentKind: 'slide',
            title: 'Service',
            fontFamily: 'Slide Face',
            text:
                'Service\n\nAmazing grace how sweet the sound\n' +
                'That saved a wretch like me',
            pageCount: 4,
            readablePages: [1],
            pictureNeededPages: [3],
            skipped: { hidden: 1, headings: 0, numbers: 0, empty: 1 },
        });
    });

    test('a picture slide is written out as a page of its own and drawn at its size', async () => {
        mocks.getJsonData.mockResolvedValue({ items: SLIDES });
        mocks.routes[CAPTURE] = () => {
            return { isSuccessful: true, dataUrls: ['data:s3'] };
        };
        const result = await readAgentDocumentWords(
            '/docs/Service.ows',
            'Service.ows',
            { pictures: true },
        );
        expect(mocks.genSlideHtml).toHaveBeenCalledWith(SLIDES[2].canvasItems);
        expect(mocks.sentList).toHaveLength(1);
        const { channel, data } = mocks.sentList[0];
        expect(channel).toBe(CAPTURE);
        expect(data.width).toBe(1280);
        expect(data.height).toBe(720);
        expect(data.htmlTexts).toHaveLength(1);
        const [htmlText] = data.htmlTexts;
        expect(htmlText.startsWith('<!DOCTYPE html><html><head>')).toBe(true);
        expect(htmlText).toContain('@font-face { font-family: Body; }');
        expect(htmlText).toContain('background: #000;');
        // The slide pinned to the page at its own size.
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const slide = doc.querySelector<HTMLElement>('body > div.slide')!;
        expect(slide.textContent).toBe('items:1');
        expect(slide.style.position).toBe('absolute');
        expect(slide.style.width).toBe('1280px');
        expect(slide.style.height).toBe('720px');
        // Fonts are collected from the slide that is drawn.
        expect(mocks.collectFontFaceCss).toHaveBeenCalledWith(slide.outerHTML);
        expect(result.pictureFor).toEqual([3]);
        expect(result.images).toEqual(['data:s3']);
    });

    test('a slide with no size or items of its own is drawn at 1920 by 1080', async () => {
        mocks.getJsonData.mockResolvedValue({
            items: [{ id: 1, canvasItems: [] }],
        });
        // An empty slide holds no words and no picture: nothing to draw.
        const empty = await readAgentDocumentWords(
            '/docs/Blank.ows',
            'Blank.ows',
            { pictures: true },
        );
        expect(empty.skipped).toMatchObject({ empty: 1 });
        expect(mocks.sentList).toEqual([]);

        mocks.getJsonData.mockResolvedValue({
            items: [
                {
                    id: 1,
                    canvasItems: [
                        // A face that does not decode: words that need a picture.
                        genTextItem('xQz;Kp vB;wR qL;nT', 100),
                    ],
                },
                { id: 2 },
            ],
        });
        mocks.routes[CAPTURE] = () => {
            return { isSuccessful: true, dataUrls: ['data:s1'] };
        };
        const result = await readAgentDocumentWords(
            '/docs/Legacy.ows',
            'Legacy.ows',
            { pictures: true },
        );
        expect(result.pictureNeededPages).toEqual([1]);
        expect(mocks.sentList[0].data).toMatchObject({
            width: 1920,
            height: 1080,
        });
        expect(mocks.sentList[0].data.htmlTexts[0]).toContain('width: 1920px');
        expect(result.images).toEqual(['data:s1']);
    });

    test('a slide with no items list is drawn from none', async () => {
        mocks.getJsonData.mockResolvedValue({
            items: [
                {
                    id: 1,
                    canvasItems: [genTextItem('xQz;Kp vB;wR qL;nT', 100)],
                },
            ],
        });
        mocks.routes[CAPTURE] = () => {
            return null;
        };
        const result = await readAgentDocumentWords(
            '/docs/Legacy.ows',
            'Legacy.ows',
            { pictures: true },
        );
        expect(result.pictureNote).toBe(
            'The pages without readable words could not be drawn as pictures.',
        );
    });

    test('a document whose head cannot be read has no pages', async () => {
        mocks.getJsonData.mockResolvedValue(null);
        const result = await readAgentDocumentWords(
            '/docs/Service.preview',
            'Service.preview',
        );
        expect(result).toMatchObject({
            documentKind: 'slide',
            title: 'Service',
            text: 'Service',
            pageCount: 0,
            blocks: [],
            readablePages: [],
            pictureNeededPages: [],
        });
    });
});

describe('a long document', () => {
    test('is cut on a page boundary and says so', async () => {
        const verse = Array.from({ length: 6 }, () => {
            return 'Amazing grace how sweet the sound that saved a wretch like me';
        });
        const slides = Array.from({ length: 40 }, (_one, index) => {
            return genPptxSlideData(
                genPptxSlide(
                    genPptxBox(
                        `b${index}`,
                        { x: 40, y: 100, width: 1200, height: 500 },
                        'Body Face',
                        verse,
                    ),
                ),
                index,
            );
        });
        mocks.getPptxData.mockResolvedValue({
            info: { slides },
            baseDir: '/docs/Long.pptx-htmls',
        });
        const result = await readAgentDocumentWords(
            '/docs/Long.pptx',
            'Long.pptx',
        );
        expect(result.isTruncated).toBe(true);
        expect(result.characters).toBeLessThanOrEqual(9000);
        expect(result.characters).toBe((result.text as string).length);
        expect((result.blocks as unknown[]).length).toBe(40);
    });
});
