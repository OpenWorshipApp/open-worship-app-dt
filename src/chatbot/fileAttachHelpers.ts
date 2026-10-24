// A file on disk, made into something the assistant can read: a PDF's pages
// as pictures, a picture as itself, a Bible note as its words, a text file
// as its text.
//
// The one place that READS for an attachment by path -- the paperclip and a
// drop hand in a `File`, but a file pressed in the Resources panel arrives
// as a path, and a file still open in a tab after the window was closed has
// only its path left to be read again from. Nothing here is read until
// somebody attaches the file, and nothing is held but what the attachment
// store holds (`attachmentHelpers.ts`, bounded, gone with the window).

import { checkIsBibleNoteFileName } from '../bible-list/note/bibleNotePreviewHelpers';
import { toResourceFileName } from '../helper/agentResourceNameHelpers';
import { getResourcesFolderList } from '../resources/resourcesFolderHelpers';
import { electronSendAsync } from '../server/electronSendHelpers';
import {
    fsGetFileSize,
    fsReadFile,
    fsReadFileBytes,
    pathBasename,
    pathSeparator,
    toPathCompareKey,
} from '../server/fileHelpers';
import {
    type ChatAttachmentType,
    checkIsCarriedFileName,
    checkIsFileAttachment,
    checkIsImageName,
    checkIsReadableTextName,
    genFileAttachment,
    genImageAttachment,
    genTextAttachment,
    getAttachmentData,
    getAttachmentPages,
    normalizeImage,
    putAttachmentData,
    putAttachmentPages,
    toImageMediaType,
} from './attachmentHelpers';
import { fillWords, tran } from './chatTranHelpers';
import { toNoteFileText } from './noteFileTextHelpers';

// What is read off the disk for one attachment, at most. A picture is cut to
// 1024px before it is held; a text file to 16 KB of words; a note file is
// parsed whole, and `JSON.parse` has no incremental mode -- the same ceiling
// the Resources panel holds a note to (`MAX_RESOURCE_NOTE_FILE_SIZE`).
const MAX_READ_BYTES = 16 * 1024 * 1024;

type PdfChatPagesType = {
    isSuccessful: boolean;
    message?: string;
    pageCount?: number;
    dataUrls?: string[];
};

const PAGE_DATA_URL_PATTERN = /^data:image\/(png|jpeg);base64,/;

/**
 * The first pages of a PDF as pictures, drawn by MuPDF in a child process of
 * main (`pdf-to-chat-images.mjs`); null when it could not be opened.
 */
async function readPdfPages(filePath: string) {
    try {
        const result = await electronSendAsync<PdfChatPagesType>(
            'main:app:pdf-to-chat-pages',
            { filePath },
        );
        if (result?.isSuccessful !== true || !Array.isArray(result.dataUrls)) {
            return null;
        }
        return {
            pageCount:
                typeof result.pageCount === 'number'
                    ? result.pageCount
                    : undefined,
            dataUrls: result.dataUrls.filter((dataUrl) => {
                return (
                    typeof dataUrl === 'string' &&
                    PAGE_DATA_URL_PATTERN.test(dataUrl)
                );
            }),
        };
    } catch (_error) {
        return null;
    }
}

/**
 * A PDF, with its first pages held as pictures for the model. One that
 * cannot be drawn is still attached -- the model is then told it cannot see
 * inside it, and a problem report still carries it.
 */
export async function genPdfAttachment(
    name: string,
    byteSize: number,
    filePath: string,
) {
    const pages = await readPdfPages(filePath);
    const attachment = genFileAttachment(
        name,
        byteSize,
        filePath,
        pages?.pageCount,
    );
    if (pages !== null) {
        putAttachmentPages(attachment.id, pages.dataUrls);
    }
    return attachment;
}

/**
 * Bring back what a file still open in a tab has lost -- a PDF's pages, a
 * picture's bytes -- by reading it again from where it is on disk. The
 * window lets them go when it closes, and a tab reopened the next day is
 * still about the same file. Quietly does nothing for a file that has
 * moved: the model is then told the pages are not there.
 */
export async function reloadFileAttachment(attachment: ChatAttachmentType) {
    const filePath = attachment.filePath;
    if (filePath === undefined) {
        return;
    }
    if (attachment.kind === 'file') {
        if (getAttachmentPages(attachment.id).length > 0) {
            return;
        }
        const pages = await readPdfPages(filePath);
        if (pages !== null) {
            putAttachmentPages(attachment.id, pages.dataUrls);
        }
        return;
    }
    if (
        attachment.kind !== 'image' ||
        getAttachmentData(attachment.id) !== null
    ) {
        return;
    }
    const dataUrl = await readImageDataUrl(filePath, attachment.name);
    if (dataUrl !== null) {
        // Held under the id the tab already knows it by.
        putAttachmentData(attachment.id, dataUrl);
    }
}

// A picture off the disk, already cut to what is worth sending.
async function readImageDataUrl(filePath: string, name: string) {
    try {
        if ((await fsGetFileSize(filePath)) > MAX_READ_BYTES) {
            return null;
        }
        const bytes = await fsReadFileBytes(filePath);
        const blob = new Blob([bytes as BlobPart], {
            type: toImageMediaType(name) ?? 'image/png',
        });
        return (await normalizeImage(blob))?.dataUrl ?? null;
    } catch (_error) {
        return null;
    }
}

/**
 * The files of these attachments that live inside a Resources folder, named
 * as `owa_resource_file` names them (`pdf/LUK.6.pdf`) -- what makes a
 * question a `resources` one (`resourcesChatHelpers.ts`). Read fresh each
 * ask: the folder list is a setting the panel can change at any time.
 */
export function findResourceFileNames(attachments: ChatAttachmentType[]) {
    // No setting is read for a question with no file of the disk on it --
    // most of them, and every slash command.
    const files = attachments.filter(checkIsFileAttachment);
    if (files.length === 0) {
        return [];
    }
    let dirPaths: string[];
    try {
        dirPaths = getResourcesFolderList();
    } catch (_error) {
        return [];
    }
    if (dirPaths.length === 0) {
        return [];
    }
    const names: string[] = [];
    for (const attachment of files) {
        const name = toResourceFileName(attachment.filePath ?? '', dirPaths, {
            toBaseName: pathBasename,
            toCompareKey: toPathCompareKey,
            separator: pathSeparator,
        });
        if (name !== null && !names.includes(name)) {
            names.push(name);
        }
    }
    return names;
}

export type FileAttachResultType =
    { attachment: ChatAttachmentType } | { failure: string };

/**
 * A file by its path, as an attachment -- or, in the window's language, why
 * it cannot be one.
 */
export async function genAttachmentFromPath(
    filePath: string,
): Promise<FileAttachResultType> {
    const name = pathBasename(filePath);
    const cannotRead = fillWords(
        tran('I cannot read {names} — try a picture of it instead.'),
        { names: name },
    );
    let byteSize: number;
    try {
        byteSize = await fsGetFileSize(filePath);
    } catch (_error) {
        return {
            failure: fillWords(tran('{name} is not there any more.'), {
                name,
            }),
        };
    }
    if (checkIsCarriedFileName(name)) {
        return { attachment: await genPdfAttachment(name, byteSize, filePath) };
    }
    if (byteSize > MAX_READ_BYTES) {
        return {
            failure: fillWords(
                tran('{names} is too large to attach — {size} MB at most.'),
                {
                    names: name,
                    size: Math.round(MAX_READ_BYTES / (1024 * 1024)).toString(),
                },
            ),
        };
    }
    if (checkIsImageName(name)) {
        const dataUrl = await readImageDataUrl(filePath, name);
        const attachment =
            dataUrl === null
                ? null
                : await genImageAttachment(dataUrl, name, filePath);
        return attachment === null ? { failure: cannotRead } : { attachment };
    }
    if (checkIsBibleNoteFileName(name) || checkIsReadableTextName(name)) {
        try {
            const text = await fsReadFile(filePath);
            const noteText = checkIsBibleNoteFileName(name)
                ? toNoteFileText(text)
                : null;
            return {
                attachment: genTextAttachment(name, noteText ?? text, filePath),
            };
        } catch (_error) {
            return { failure: cannotRead };
        }
    }
    return { failure: cannotRead };
}
