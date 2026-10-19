/**
 * `owa_resource_file`: the Resources panel's files, listed and read for a
 * model (2026-10-17, the user, from a conversation about `LUK.6.pdf`: _let
 * chatbot access all in `Resources` to allow user to ask everything in
 * `Resources`, like followup other chapter (look into other pdf files)_).
 *
 * Reached through the `owa-agent-data` relay (`domHelpers.ts`), loaded
 * when the tool is first called. Reads only, and only inside the folders
 * the panel lists (`getResourcesFolderList`): a name is resolved under its
 * folder and refused when it lands anywhere else.
 *
 * A PDF is answered with its pages as PICTURES -- a Khmer PDF set in a
 * legacy font has nonsense for a text layer -- drawn by MuPDF in a child
 * process of main (`main:app:pdf-to-chat-pages`). An MCP read returns every
 * remaining page unless its caller deliberately supplies a smaller `pages`
 * count. The renderer may retain the PDF's own text layer in its disposable
 * cache, but the tool never sends that layer to the model: a legacy font can
 * make unrelated Latin characters look like valid Khmer evidence. Pagination
 * says whether every
 * page has been returned, so a long file is never silently cut. A
 * Bible note is its notes' words (`toNoteFileText`), a text file its words
 * cut to 16 KB, a picture itself at the long edge the help window sends.
 * The tool puts the pictures where the model sees pictures; everything else
 * is text.
 */
import { normalizeImage } from '../chatbot/attachmentHelpers';
import { toNoteFileText } from '../chatbot/noteFileTextHelpers';
import { getResourcesFolderList } from '../resources/resourcesFolderHelpers';
import {
    MAX_SCAN_DEPTH,
    MAX_SCAN_ENTRIES,
    scanResourceFiles,
} from '../resources/resourcesScanHelpers';
import { electronSendAsync } from '../server/electronSendHelpers';
import {
    checkIsHiddenName,
    checkIsSystemFileName,
    fsGetFileSize,
    fsListDirents,
    fsReadFile,
    fsReadFileBytes,
    pathBasename,
    pathJoin,
    pathResolve,
    pathSeparator,
    toPathCompareKey,
} from '../server/fileHelpers';
import {
    genResourceFolderLabels,
    resolveResourceBookKeyFromMaps,
    splitResourceFileName,
    toPageSpanText,
    toResourceBookKey,
    toResourceFileKind,
} from './agentResourceNameHelpers';
import { genResourceOverview } from './agentResourceOverviewHelpers';
import { parseRefParts } from './bibleVerseFindHelpers';
import { getAllLocalBibleInfoList } from './bible-helpers/bibleDownloadHelpers';
import { getBibleInfo } from './bible-helpers/bibleInfoHelpers';

export type AgentResourcesRequestType = {
    action?: unknown;
    book?: unknown;
    chapter?: unknown;
    ref?: unknown;
    search?: unknown;
    file?: unknown;
    page?: unknown;
    pages?: unknown;
    detail?: unknown;
};

type RefusalType = { isError: true; reason: string };

function toReason(reason: string): RefusalType {
    return { isError: true, reason };
}

// A listing a model reads in one round; past it, it is told to narrow.
const MAX_LISTED_FILES = 60;
const MAX_TEXT_CHARS = 16 * 1024;
const MAX_READ_BYTES = 16 * 1024 * 1024;
// What a deliberately partial read may carry. The default MCP read is the
// entire PDF; ordinary chat attachments retain the renderer's bounded default.
const MAX_PDF_PAGES = 8;

type ResourceFolderType = { label: string; dirPath: string };

function getResourceFolders(): ResourceFolderType[] {
    const dirPaths = getResourcesFolderList();
    const labels = genResourceFolderLabels(dirPaths, pathBasename);
    return dirPaths.map((dirPath, index) => {
        return { label: labels[index], dirPath };
    });
}

function toInnerName(folder: ResourceFolderType, filePath: string) {
    const inner = filePath.slice(folder.dirPath.length).replaceAll('\\', '/');
    return `${folder.label}/${inner.replace(/^\/+/, '')}`;
}

function checkIsInside(dirPath: string, filePath: string) {
    const dirKey = toPathCompareKey(pathResolve(dirPath));
    const fileKey = toPathCompareKey(pathResolve(filePath));
    return fileKey.startsWith(
        dirKey.endsWith(pathSeparator) ? dirKey : dirKey + pathSeparator,
    );
}

function toWholeNumber(value: unknown) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

/**
 * A book's key from its code, its English name, or its name in any installed
 * Bible's own language (`យ៉ូហាន`). The English and code halves are pure and
 * tried first; only a name in another language reads the installed Bibles'
 * book maps, so the ordinary call does no I/O (2026-10-18).
 */
async function resolveResourceBookKey(book: unknown) {
    const englishOrCode = toResourceBookKey(book);
    if (englishOrCode !== null) {
        return englishOrCode;
    }
    const mapList: { [bookKey: string]: string }[] = [];
    try {
        const infoList = (await getAllLocalBibleInfoList()) ?? [];
        for (const info of infoList.slice(0, 8)) {
            const bibleInfo = await getBibleInfo(info.key).catch(() => {
                return null;
            });
            if (bibleInfo?.keyBookMap !== undefined) {
                mapList.push(bibleInfo.keyBookMap);
            }
        }
    } catch (_error) {
        // The English half still works.
    }
    return resolveResourceBookKeyFromMaps(book, mapList);
}

/**
 * Every file name in a folder and the folders under it, as deep and as many
 * as the panel's own walk goes (`MAX_SCAN_DEPTH`, `MAX_SCAN_ENTRIES`),
 * breadth first. Names only: nothing is opened.
 */
async function listFolderFileNames(dirPath: string) {
    const names: string[] = [];
    const queue = [{ dirPath, depth: 0 }];
    let entryCount = 0;
    let isCut = false;
    while (queue.length > 0) {
        const current = queue.shift() as { dirPath: string; depth: number };
        let direntList;
        try {
            direntList = await fsListDirents(current.dirPath);
        } catch (_error) {
            continue;
        }
        entryCount += direntList.length;
        if (entryCount > MAX_SCAN_ENTRIES) {
            isCut = true;
            break;
        }
        for (const { name, isFile, isDirectory } of direntList) {
            if (checkIsHiddenName(name) || checkIsSystemFileName(name)) {
                continue;
            }
            if (isFile) {
                names.push(name);
            } else if (isDirectory && current.depth < MAX_SCAN_DEPTH) {
                queue.push({
                    dirPath: pathJoin(current.dirPath, name),
                    depth: current.depth + 1,
                });
            }
        }
    }
    return { names, isCut };
}

async function genOverviewAnswer(folders: ResourceFolderType[]) {
    const overview = [];
    for (const folder of folders) {
        const { names, isCut } = await listFolderFileNames(folder.dirPath);
        overview.push({
            folder: folder.label,
            ...genResourceOverview(names),
            ...(isCut ? { isCut: true } : {}),
        });
    }
    return {
        overview,
        note:
            'Books by code with the chapters that have files (0 is the ' +
            'introduction). `list` with `book` and `chapter` names the ' +
            'files to `read`.',
    };
}

async function listResources(request: AgentResourcesRequestType) {
    const folders = getResourceFolders();
    if (folders.length === 0) {
        return toReason(
            'No Resources folder is set up on this computer, so there are ' +
                'no files to read. The Resources panel in the Bible Lookup ' +
                'is where a folder is added.',
        );
    }
    // `<book> <chapter>` together (`ref: "John 3"`, `ref: "យ៉ូហាន 3"`), or
    // the two fields. The panel's own file names use the KJV's codes, and
    // the book may be named the way the person's Bible writes it.
    const ref = typeof request.ref === 'string' ? request.ref.trim() : '';
    const refParts = ref.length === 0 ? null : parseRefParts(ref);
    if (ref.length > 0 && refParts === null) {
        return toReason(
            `"${ref}" is not a book and chapter. Write it as "John 3", ` +
                'the book as their Bible names it and the chapter.',
        );
    }
    const askedBook =
        request.book !== undefined ? request.book : (refParts?.book ?? null);
    const bookKey =
        askedBook === null ? null : await resolveResourceBookKey(askedBook);
    if (askedBook !== null && bookKey === null) {
        return toReason(
            `"${String(askedBook)}" is not a Bible book. Give its name the ` +
                'way the Bible writes it, its English name or its code ' +
                '(e.g. "Luke" or "LUK").',
        );
    }
    const chapter = toWholeNumber(
        request.chapter !== undefined
            ? request.chapter
            : (refParts?.chapter ?? null),
    );
    const search = typeof request.search === 'string' ? request.search : '';
    // A whole book is every file named `<BOOK>.`; a chapter is the panel's
    // own match, its book-level files (`<BOOK>.0`) included.
    const targets =
        bookKey !== null && chapter !== null ? [{ bookKey, chapter }] : [];
    const searchText =
        bookKey !== null && chapter === null ? `${bookKey}.` : search;
    // Nothing to narrow it: what is on the shelf, folder by folder.
    if (targets.length === 0 && searchText.trim().length === 0) {
        return await genOverviewAnswer(folders);
    }
    const files: { file: string; kind: string }[] = [];
    let isMore = false;
    for (const folder of folders) {
        let result;
        try {
            result = await scanResourceFiles(
                folder.dirPath,
                targets,
                searchText,
            );
        } catch (_error) {
            continue;
        }
        for (const filePath of [
            ...(result?.filePaths ?? []),
            ...(result?.searchedFilePaths ?? []),
        ]) {
            if (files.length >= MAX_LISTED_FILES) {
                isMore = true;
                break;
            }
            files.push({
                file: toInnerName(folder, filePath),
                kind: toResourceFileKind(filePath) ?? 'other (cannot be read)',
            });
        }
        isMore = isMore || result?.isSearchTruncated === true;
    }
    return {
        folders: folders.map((folder) => {
            return folder.label;
        }),
        files,
        ...(isMore
            ? { note: 'There are more: narrow it with `chapter` or `search`.' }
            : {}),
        ...(files.length === 0
            ? { note: 'No file in Resources matched.' }
            : {}),
    };
}

function resolveResourceFile(fileName: unknown) {
    const split = splitResourceFileName(String(fileName ?? ''));
    if (split === null) {
        return null;
    }
    const folder = getResourceFolders().find((one) => {
        return one.label.toLowerCase() === split.folder.toLowerCase();
    });
    if (folder === undefined) {
        return null;
    }
    const filePath = pathJoin(folder.dirPath, ...split.innerParts);
    if (!checkIsInside(folder.dirPath, filePath)) {
        return null;
    }
    return { folder, filePath, name: toInnerName(folder, filePath) };
}

type PdfChatPagesType = {
    isSuccessful: boolean;
    message?: string;
    pageCount?: number;
    startPage?: number;
    pageTexts?: { page: number; text: string | null }[];
    dataUrls?: string[];
};

async function readPdf(
    filePath: string,
    name: string,
    request: AgentResourcesRequestType,
) {
    const firstPage = Math.max(1, toWholeNumber(request.page) ?? 1);
    const isHighDetail = request.detail === 'high';
    const requestedPages = toWholeNumber(request.pages);
    const maxPages =
        requestedPages === null
            ? undefined
            : Math.max(1, Math.min(MAX_PDF_PAGES, requestedPages));
    const result = await electronSendAsync<PdfChatPagesType>(
        'main:app:pdf-to-chat-pages',
        {
            filePath,
            startPage: firstPage - 1,
            ...(maxPages === undefined ? { allPages: true } : { maxPages }),
            ...(isHighDetail ? { longEdge: 2048 } : {}),
        },
    );
    if (result?.isSuccessful !== true || !Array.isArray(result.dataUrls)) {
        return toReason(`${name} could not be opened as a PDF.`);
    }
    const pageCount = result.pageCount ?? result.dataUrls.length;
    if (result.dataUrls.length === 0) {
        return toReason(
            `${name} has ${pageCount.toString()} pages; there is no page ` +
                `${firstPage.toString()}.`,
        );
    }
    const shown = toPageSpanText(firstPage, result.dataUrls.length);
    const lastShown = firstPage + result.dataUrls.length - 1;
    const isComplete = lastShown >= pageCount;
    return {
        file: name,
        kind: 'pdf',
        pageCount,
        pages: shown,
        firstPage,
        lastPage: lastShown,
        isComplete,
        ...(!isComplete ? { nextPage: lastShown + 1 } : {}),
        note:
            `Its complete pages ${shown} are the pictures after this, in order. ` +
            'Treat them as one continuous document and join a paragraph that ' +
            'continues across consecutive pictures. ' +
            'The pictures are authoritative. The embedded PDF text layer is ' +
            'deliberately excluded because legacy fonts can turn it into ' +
            'unrelated characters.' +
            (!isComplete
                ? ` Read on from \`page\` ${(lastShown + 1).toString()}.`
                : ' Every page of this PDF has now been returned.'),
        images: result.dataUrls,
    };
}

async function readResource(request: AgentResourcesRequestType) {
    const resolved = resolveResourceFile(request.file);
    if (resolved === null) {
        return toReason(
            'Name a file as `list` gives it, `<folder>/<file>` -- e.g. ' +
                '"pdf/LUK.7.pdf". Only files in the Resources folders can be ' +
                'read.',
        );
    }
    const { filePath, name } = resolved;
    const kind = toResourceFileKind(filePath);
    if (kind === null) {
        return toReason(
            `${name} is not a kind of file that can be read here (a PDF, a ` +
                'picture, a Bible note or a text file can).',
        );
    }
    let byteSize: number;
    try {
        byteSize = await fsGetFileSize(filePath);
    } catch (_error) {
        return toReason(`${name} is not there.`);
    }
    if (kind === 'pdf') {
        return await readPdf(filePath, name, request);
    }
    if (byteSize > MAX_READ_BYTES) {
        return toReason(`${name} is too large to read here.`);
    }
    if (kind === 'picture') {
        const bytes = await fsReadFileBytes(filePath);
        const normalized = await normalizeImage(new Blob([bytes as BlobPart]));
        if (normalized === null) {
            return toReason(`${name} could not be read as a picture.`);
        }
        return {
            file: name,
            kind,
            note: 'It is the picture after this.',
            images: [normalized.dataUrl],
        };
    }
    const raw = await fsReadFile(filePath);
    const text = (kind === 'note' ? toNoteFileText(raw) : null) ?? raw;
    return {
        file: name,
        kind,
        text: text.slice(0, MAX_TEXT_CHARS),
        ...(text.length > MAX_TEXT_CHARS
            ? { note: 'Only the start of it is here.' }
            : {}),
    };
}

export async function handleAgentResourcesRequest(
    request: AgentResourcesRequestType,
) {
    if (request.action === 'list') {
        return await listResources(request);
    }
    if (request.action === 'read') {
        return await readResource(request);
    }
    return toReason(
        'Give action: "list" (by `book`, `chapter` or `search`) or "read" ' +
            '(a `file` as listed).',
    );
}
