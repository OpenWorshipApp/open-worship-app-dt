/**
 * A document's words for a song, read off the disk the way the app reads
 * each kind (2026-11-13, `EC-590`; the rules are `documentTextHelpers.ts`):
 *
 * - a PowerPoint deck or a Word file through the app's own converter
 *   (`main:app:pptx-to-htmls` / `main:app:docx-to-htmls`, the ones the
 *   Documents list shows them with). The app's preview of it, when one is
 *   there and of this copy of the file (its `info.json` md5, the check the
 *   Documents list makes), is read as it stands; otherwise the file is
 *   converted into a folder of its own in the temporary folder, read, and
 *   that folder deleted -- nothing is written beside the person's file, and
 *   nothing is kept;
 * - a PDF's text layer through the help window's own page reader
 *   (`main:app:pdf-to-chat-pages`): its first eight pages, the pictures it
 *   draws beside them as small as it draws one;
 * - a slide document as the JSON it is.
 *
 * One page is read at a time and let go of; only the words come back.
 */
import appProvider from '../server/appProvider';
import { electronSendAsync } from '../server/electronSendHelpers';
import {
    fsCheckFileExist,
    fsDeleteDir,
    fsGetFileSize,
    fsReadFile,
    fsReadFileBytes,
    getTempPath,
    pathBasename,
    pathDirname,
    pathJoin,
} from '../server/fileHelpers';
import {
    checkIsSongDocumentName,
    dropRunningLines,
    joinBlocks,
    readSlideHtmlLines,
    readWordPageLines,
    toPdfPageBlocks,
    toSlideDocumentBlocks,
} from './documentTextHelpers';

/** The largest file read for its words: a file dropped in the window's. */
export const MAX_DOCUMENT_WORDS_FILE_BYTES = 16 * 1024 * 1024;
const MAX_SLIDE_COUNT = 300;
const MAX_WORD_PAGE_COUNT = 200;
// The page reader's own ceiling, and the smallest picture it draws.
const MAX_PDF_PAGE_COUNT = 8;
const PDF_PICTURE_EDGE = 64;
const TEMP_FOLDER_NAME = 'open-worship-app-song-words';
// A page the converter wrote is named by it (`slide3.html`, `page2.html`);
// any other name in `info.json` is not read.
const PAGE_FILE_NAME_PATTERN = /^[A-Za-z0-9_-]+\.html$/;

type OfficeKindType = 'pptx' | 'docx';

const OFFICE_KIND_MAP: Record<
    OfficeKindType,
    { channel: string; previewSuffix: string }
> = {
    pptx: { channel: 'main:app:pptx-to-htmls', previewSuffix: '-htmls' },
    docx: { channel: 'main:app:docx-to-htmls', previewSuffix: '-docx-htmls' },
};

function toWordsText(blockList: string[][]) {
    const text = joinBlocks(blockList);
    return text === '' ? null : text;
}

async function readJsonFile(filePath: string): Promise<any> {
    try {
        if (!(await fsCheckFileExist(filePath))) {
            return null;
        }
        return JSON.parse(await fsReadFile(filePath));
    } catch (_error) {
        return null;
    }
}

async function readPageHtml(dirPath: string, fileName: unknown) {
    if (
        typeof fileName !== 'string' ||
        !PAGE_FILE_NAME_PATTERN.test(fileName)
    ) {
        return null;
    }
    try {
        return await fsReadFile(pathJoin(dirPath, fileName));
    } catch (_error) {
        return null;
    }
}

// The words of a converted file, a page at a time: a deck's slides each a
// block (a hidden slide left out, the header every slide repeats taken
// off), a Word file's pages one block with its empty lines kept.
async function readConvertedWords(
    dirPath: string,
    info: any,
    kind: OfficeKindType,
): Promise<string | null> {
    if (kind === 'pptx') {
        const slides: any[] = Array.isArray(info?.slides)
            ? info.slides.slice(0, MAX_SLIDE_COUNT)
            : [];
        const blockList: string[][] = [];
        for (const slide of slides) {
            if (slide?.isDisabled === true) {
                continue;
            }
            const html = await readPageHtml(dirPath, slide?.htmlFileName);
            if (html !== null) {
                blockList.push(readSlideHtmlLines(html));
            }
        }
        return toWordsText(dropRunningLines(blockList));
    }
    const pages: any[] = Array.isArray(info?.pages)
        ? info.pages.slice(0, MAX_WORD_PAGE_COUNT)
        : [];
    const lines: string[] = [];
    for (const page of pages) {
        const html = await readPageHtml(dirPath, page?.htmlFileName);
        if (html !== null) {
            lines.push(...readWordPageLines(html));
        }
    }
    return toWordsText([lines]);
}

// The app's own preview of the file, when it is there and of this copy:
// `{ words }` (null when the preview holds none), or null with no preview to
// read.
async function readPreviewWords(
    filePath: string,
    kind: OfficeKindType,
): Promise<{ words: string | null } | null> {
    const dirPath = pathJoin(
        pathDirname(filePath),
        `${pathBasename(filePath)}${OFFICE_KIND_MAP[kind].previewSuffix}`,
    );
    const info = await readJsonFile(pathJoin(dirPath, 'info.json'));
    const previewMd5 = info?.checksum?.md5;
    if (typeof previewMd5 !== 'string' || previewMd5 === '') {
        return null;
    }
    try {
        const fileMd5 = await appProvider.systemUtils.generateFileMD5(filePath);
        return fileMd5 === previewMd5
            ? { words: await readConvertedWords(dirPath, info, kind) }
            : null;
    } catch (_error) {
        return null;
    }
}

// The file converted into a folder of the temporary folder's, read, and
// that folder deleted whatever happened.
async function readConvertedCopyWords(filePath: string, kind: OfficeKindType) {
    const dirPath = pathJoin(
        getTempPath(),
        TEMP_FOLDER_NAME,
        crypto.randomUUID(),
    );
    try {
        const isConverted = await electronSendAsync<boolean>(
            OFFICE_KIND_MAP[kind].channel,
            { filePath, outDir: dirPath },
        );
        if (isConverted !== true) {
            return null;
        }
        const info = await readJsonFile(pathJoin(dirPath, 'info.json'));
        return info === null
            ? null
            : await readConvertedWords(dirPath, info, kind);
    } finally {
        await fsDeleteDir(dirPath).catch((error) => {
            console.warn('A converted copy could not be deleted:', error);
        });
    }
}

/**
 * A deck's or a Word file's words as the app's own reader reads them, a
 * slide a block -- a SmartArt's boxes too, which the converter draws as a
 * picture (2026-11-21, EC-787: an org chart deck, its every word in a
 * SmartArt, could not be attached at all: _I cannot read it_).
 */
export function toOfficeReadBlocks(read: any): string[][] {
    const toWords = (list: unknown) => {
        return (Array.isArray(list) ? list : [])
            .map((one) => {
                return typeof one === 'string' ? one : one?.text;
            })
            .filter((one): one is string => {
                return typeof one === 'string' && one.trim() !== '';
            });
    };
    if (Array.isArray(read?.slides)) {
        return read.slides
            .map((slide: any) => {
                return [
                    ...toWords(slide?.lines),
                    ...(Array.isArray(slide?.boxes) ? slide.boxes : []).flatMap(
                        (box: any) => {
                            return box?.kind === 'smartart'
                                ? toWords(box?.words)
                                : [];
                        },
                    ),
                ];
            })
            .filter((block: string[]) => {
                return block.length > 0;
            });
    }
    const lines = toWords(read?.lines);
    return lines.length === 0 ? [] : [lines];
}

// loaded only for a file the converter found no words in
async function readOwnOfficeWords(filePath: string, kind: OfficeKindType) {
    try {
        const [
            { openOfficePackage },
            { readOfficeDocument, toOfficeReadResult },
        ] = await Promise.all([
            import('../ms-office/officePackageIoHelpers'),
            import('../ms-office/officePackageEditHelpers'),
        ]);
        const opened = openOfficePackage(await fsReadFileBytes(filePath));
        if ('reason' in opened) {
            return null;
        }
        const document = await readOfficeDocument(opened.pkg, kind);
        if ('reason' in document) {
            return null;
        }
        return toWordsText(toOfficeReadBlocks(toOfficeReadResult(document, 0)));
    } catch (_error) {
        return null;
    }
}

async function readPdfWords(filePath: string) {
    const result = await electronSendAsync<any>('main:app:pdf-to-chat-pages', {
        filePath,
        maxPages: MAX_PDF_PAGE_COUNT,
        longEdge: PDF_PICTURE_EDGE,
    });
    if (result?.isSuccessful !== true || !Array.isArray(result.pageTexts)) {
        return null;
    }
    return toWordsText(toPdfPageBlocks(result.pageTexts));
}

async function readSlideDocumentWords(filePath: string) {
    const blockList = toSlideDocumentBlocks(await fsReadFile(filePath));
    return blockList === null ? null : toWordsText(blockList);
}

/**
 * The words of a slide document, a PowerPoint deck, a Word file or a PDF,
 * as lines with a blank line between verses -- what a song is drafted from.
 * Null for a file of another kind, one over 16 MB, one that cannot be read,
 * and one with no words (a scanned PDF).
 */
export async function readDocumentWords(
    filePath: string,
): Promise<string | null> {
    if (typeof filePath !== 'string' || !checkIsSongDocumentName(filePath)) {
        return null;
    }
    try {
        if ((await fsGetFileSize(filePath)) > MAX_DOCUMENT_WORDS_FILE_BYTES) {
            return null;
        }
        const extension = /\.([a-z]+)$/i.exec(filePath)?.[1].toLowerCase();
        if (extension === 'pdf') {
            return await readPdfWords(filePath);
        }
        if (extension === 'ows') {
            return await readSlideDocumentWords(filePath);
        }
        const kind: OfficeKindType = extension === 'pptx' ? 'pptx' : 'docx';
        const preview = await readPreviewWords(filePath, kind);
        const words =
            preview !== null
                ? preview.words
                : await readConvertedCopyWords(filePath, kind);
        return words ?? (await readOwnOfficeWords(filePath, kind));
    } catch (error) {
        console.warn('The words of a document could not be read:', error);
        return null;
    }
}
