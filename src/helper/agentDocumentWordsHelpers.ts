/**
 * The words of one Documents-folder file, for a song made from it -- the app
 * side of `owa_media_file info` on `kind: "document"` (2026-11-10, the user:
 * _create lyric from powerpoint file … chatbot should use all api to extract
 * text and prepare for the lyric_). Imported LAZILY by
 * `agentMediaFileHelpers.ts`: the PowerPoint and Word readers carry the
 * progress bar, the toasts and the language helpers, and the media relay is
 * loaded in every window that answers a data request.
 *
 * Each kind goes through what the app ALREADY makes of it:
 *
 * - a PowerPoint is CONVERTED (`getPptxData`, the converter the Documents
 *   list's preview uses, cached beside the file and checked against it), and
 *   each slide's HTML read (the user: _since we have tool to convert pptx to
 *   html then it should convert then extract_);
 * - a Word file the same way (`getDocxData`);
 * - a PDF's first pages through MuPDF (`main:app:pdf-to-chat-pages`, the
 *   help window's own PDF reader, disk-cached by its options -- so asking
 *   for the pictures afterwards is the same call answered from the cache);
 * - a slide document from its editing head, what the person sees.
 *
 * With `pictures`, a page whose words could not be read (a scan, a picture
 * slide, a legacy font's text layer) is DRAWN and handed back as a picture
 * (the user: _for document that unable to extract text the mcp should
 * convert to image then send image to llm_): a PDF's pages are already
 * pictures; a converted slide or page, or a slide document's slide, is
 * drawn by the main process (`main:app:capture-document-pages`).
 */
import { electronSendAsync } from '../server/electronSendHelpers';
import {
    parseAppDocumentSlide,
    parseDocxPageHtml,
    parsePdfPageText,
    parsePptxSlideHtml,
} from './documentWordsParsers';
import {
    genDocumentWords,
    type DocumentWordsPageType,
} from './documentWordsRules';

export type AgentDocumentKindType = 'pptx' | 'docx' | 'pdf' | 'slide';

type AgentResultType = Record<string, unknown>;

const MAX_PICTURES = 8;
// A PDF's pages as the help window reads them: the first eight.
const MAX_PDF_PAGES = 8;
// A PDF page has no size of its own here; only the shape matters.
const PDF_PAGE_SIZE = { width: 612, height: 792 };
const DEFAULT_SLIDE_SIZE = { width: 1920, height: 1080 };

type PdfChatPagesType = {
    isSuccessful: boolean;
    pageCount?: number;
    startPage?: number;
    pageTexts?: { page: number; text: string | null }[];
    dataUrls?: string[];
};

type CaptureResultType = {
    isSuccessful: boolean;
    message?: string;
    dataUrls?: string[];
};

type ReadDocumentType = {
    pages: DocumentWordsPageType[];
    pageCount: number;
    missingFontFamilies: string[];
    // How to draw page N as a picture, when it has to be.
    drawPages: (numbers: number[]) => Promise<string[] | null>;
};

export function toAgentDocumentKind(
    fullName: string,
): AgentDocumentKindType | null {
    const extension = /\.([^.]+)$/.exec(fullName)?.[1]?.toLowerCase() ?? '';
    if (extension === 'pptx') {
        return 'pptx';
    }
    if (extension === 'docx') {
        return 'docx';
    }
    if (extension === 'pdf') {
        return 'pdf';
    }
    if (extension === 'ows' || extension === 'preview') {
        return 'slide';
    }
    return null;
}

function toFileTitle(fullName: string) {
    return fullName.replace(/\.[^.]+$/, '').trim();
}

async function captureConvertedPages(
    dirPath: string,
    filePaths: string[],
    size: { width: number; height: number },
) {
    const result = await electronSendAsync<CaptureResultType>(
        'main:app:capture-document-pages',
        { dirPath, filePaths, width: size.width, height: size.height },
    );
    return result?.isSuccessful === true && Array.isArray(result.dataUrls)
        ? result.dataUrls
        : null;
}

async function readPptx(filePath: string): Promise<ReadDocumentType | null> {
    const { getPptxData } = await import('../server/pptxHelpers');
    const data = await getPptxData(filePath);
    if (data === null) {
        return null;
    }
    const size = data.info.dimensions ?? DEFAULT_SLIDE_SIZE;
    const slides = data.info.slides;
    return {
        pages: slides.map((slide, index) => {
            return parsePptxSlideHtml(slide.html, {
                number: index + 1,
                isHidden: slide.isDisabled === true,
                width: size.width,
                height: size.height,
            });
        }),
        pageCount: slides.length,
        missingFontFamilies: data.info.missingFontFamily ?? [],
        drawPages: (numbers) => {
            return captureConvertedPages(
                data.baseDir,
                numbers.map((number) => {
                    return slides[number - 1].htmlFilePath;
                }),
                size,
            );
        },
    };
}

async function readDocx(filePath: string): Promise<ReadDocumentType | null> {
    const { getDocxData } = await import('../server/docxHelpers');
    const data = await getDocxData(filePath);
    if (data === null) {
        return null;
    }
    // `getDocxData` adds each page's `htmlFilePath` beside what `info.json`
    // says of it.
    const pages: any[] = data.info.pages;
    const sizeOf = (index: number) => {
        return {
            width: Number(pages[index]?.width) || 816,
            height: Number(pages[index]?.height) || 1056,
        };
    };
    return {
        pages: pages.map((page, index) => {
            return parseDocxPageHtml(String(page.html ?? ''), {
                number: index + 1,
                ...sizeOf(index),
            });
        }),
        pageCount: pages.length,
        missingFontFamilies: data.info.missingFontFamily ?? [],
        drawPages: (numbers) => {
            return captureConvertedPages(
                data.baseDirPath,
                numbers.map((number) => {
                    return String(pages[number - 1]?.htmlFilePath ?? '');
                }),
                sizeOf(numbers[0] - 1),
            );
        },
    };
}

async function readPdf(filePath: string): Promise<ReadDocumentType | null> {
    const result = await electronSendAsync<PdfChatPagesType>(
        'main:app:pdf-to-chat-pages',
        { filePath, startPage: 0, maxPages: MAX_PDF_PAGES },
    );
    if (result?.isSuccessful !== true || !Array.isArray(result.pageTexts)) {
        return null;
    }
    const dataUrls = Array.isArray(result.dataUrls) ? result.dataUrls : [];
    return {
        pages: result.pageTexts.map((one) => {
            return parsePdfPageText(one.text, {
                number: one.page,
                ...PDF_PAGE_SIZE,
            });
        }),
        pageCount: result.pageCount ?? result.pageTexts.length,
        missingFontFamilies: [],
        drawPages: async (numbers) => {
            return numbers
                .map((number) => {
                    return dataUrls[number - 1 - (result.startPage ?? 0)];
                })
                .filter((dataUrl): dataUrl is string => {
                    return typeof dataUrl === 'string';
                });
        },
    };
}

async function genSlidePageHtml(slide: any) {
    const [{ genSlideHtml }, { collectFontFaceCss }] = await Promise.all([
        import('../app-document-presenter/items/SlideRendererComp'),
        import('./printCssHelpers'),
    ]);
    const width = Number(slide?.metadata?.width) || DEFAULT_SLIDE_SIZE.width;
    const height = Number(slide?.metadata?.height) || DEFAULT_SLIDE_SIZE.height;
    const slideDiv = genSlideHtml(slide.canvasItems ?? []);
    Object.assign(slideDiv.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: `${width}px`,
        height: `${height}px`,
    });
    const bodyHtml = slideDiv.outerHTML;
    return (
        '<!DOCTYPE html><html><head><meta charset="utf-8" /><style>' +
        collectFontFaceCss(bodyHtml) +
        'html, body { margin: 0; padding: 0; overflow: hidden; ' +
        'background: #000; }' +
        `</style></head><body>${bodyHtml}</body></html>`
    );
}

async function readSlideDocument(
    filePath: string,
): Promise<ReadDocumentType | null> {
    const { default: AppDocument } =
        await import('../app-document-list/AppDocument');
    const jsonData: any = await AppDocument.getInstance(filePath).getJsonData();
    const items: any[] = Array.isArray(jsonData?.items) ? jsonData.items : [];
    const sizeOf = (slide: any) => {
        return {
            width: Number(slide?.metadata?.width) || DEFAULT_SLIDE_SIZE.width,
            height:
                Number(slide?.metadata?.height) || DEFAULT_SLIDE_SIZE.height,
        };
    };
    return {
        pages: items.map((slide, index) => {
            return parseAppDocumentSlide(slide, {
                number: index + 1,
                ...sizeOf(slide),
            });
        }),
        pageCount: items.length,
        missingFontFamilies: [],
        drawPages: async (numbers) => {
            const htmlTexts = await Promise.all(
                numbers.map((number) => {
                    return genSlidePageHtml(items[number - 1]);
                }),
            );
            const size = sizeOf(items[numbers[0] - 1]);
            const result = await electronSendAsync<CaptureResultType>(
                'main:app:capture-document-pages',
                { htmlTexts, width: size.width, height: size.height },
            );
            return result?.isSuccessful === true &&
                Array.isArray(result.dataUrls)
                ? result.dataUrls
                : null;
        },
    };
}

function readDocument(kind: AgentDocumentKindType, filePath: string) {
    if (kind === 'pptx') {
        return readPptx(filePath);
    }
    if (kind === 'docx') {
        return readDocx(filePath);
    }
    if (kind === 'pdf') {
        return readPdf(filePath);
    }
    return readSlideDocument(filePath);
}

/**
 * The song's words out of one document. `pictures`: also draw the pages
 * whose words could not be read (eight at most) and hand them back as
 * `images`, in the order `pictureFor` lists their page numbers.
 */
export async function readAgentDocumentWords(
    filePath: string,
    fullName: string,
    { pictures = false }: { pictures?: boolean } = {},
): Promise<AgentResultType> {
    const kind = toAgentDocumentKind(fullName);
    if (kind === null) {
        return {
            isError: true,
            reason:
                `"${fullName}" is not a PowerPoint, Word, PDF or slide ` +
                'document, so there are no words to read out of it here.',
        };
    }
    const read = await readDocument(kind, filePath);
    if (read === null) {
        return {
            isError: true,
            reason: `"${fullName}" could not be opened to read its words.`,
        };
    }
    const words = genDocumentWords(read.pages, {
        fileTitle: toFileTitle(fullName),
        isRunningLineDropped: kind === 'pdf' || kind === 'docx',
    });
    const isFontMissing =
        words.fontFamily !== null &&
        read.missingFontFamilies.includes(words.fontFamily);
    const result: AgentResultType = {
        kind: 'document',
        name: fullName,
        documentKind: kind,
        title: words.title,
        headings: words.headings,
        fontFamily: words.fontFamily,
        ...(isFontMissing ? { isFontMissing: true } : {}),
        text: words.text,
        characters: words.characters,
        ...(words.isTruncated ? { isTruncated: true } : {}),
        blocks: words.blocks,
        skipped: words.skipped,
        pageCount: read.pageCount,
        ...(kind === 'pdf' && read.pageCount > MAX_PDF_PAGES
            ? { readPageCount: MAX_PDF_PAGES }
            : {}),
        readablePages: words.readablePages,
        pictureNeededPages: words.pictureNeededPages,
    };
    if (!pictures || words.pictureNeededPages.length === 0) {
        return result;
    }
    const pictureFor = words.pictureNeededPages.slice(0, MAX_PICTURES);
    const images = await read.drawPages(pictureFor);
    if (images === null || images.length === 0) {
        return {
            ...result,
            pictureNote:
                'The pages without readable words could not be drawn as ' +
                'pictures.',
        };
    }
    return {
        ...result,
        pictureFor: pictureFor.slice(0, images.length),
        images,
    };
}
