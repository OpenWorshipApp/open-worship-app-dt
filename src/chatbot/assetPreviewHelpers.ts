// Looking at an asset in a conversation, and taking it away.
//
// A conversation accumulates things: a picture the user took of their own
// screen, a file they dropped in, the report the window just wrote, the song
// the assistant created, a picture an answer pointed at. Every one of them is
// drawn as a chip -- and until now what a chip DID depended on what it was: a
// picture opened big, and everything else opened a file-manager window behind
// the app. So the only asset a volunteer could actually look at was the one
// kind they had usually just made themselves, and the only way to keep any of
// them was to go hunting in Explorer.
//
// Now every asset opens the same way, and every preview can be downloaded.
// Three rules hold it together:
//
//  1. NOTHING IS READ UNTIL IT IS OPENED, and nothing is held after it is
//     closed. The preview is state on one component, dropped when the overlay
//     closes -- this app runs on machines with nothing to spare, and a chip
//     that quietly read a 200 MB video into memory to draw a card would be
//     worse than the folder it replaced.
//  2. SIZE IS ASKED BEFORE CONTENT. A file too big to draw says so with its
//     size and still offers Download and Open folder -- which are the two
//     things that work whatever it is.
//  3. DOWNLOAD MEANS A COPY IN Downloads, AND SAYS WHERE. The app's own
//     save-and-reveal, so nothing here invents a second way to hand a file
//     over. A file ALREADY in Downloads is revealed rather than duplicated:
//     pressing Download three times must not leave three copies.

import FileSource from '../helper/FileSource';
import {
    downloadImageBase64Data,
    showFileOrDirExplorer,
} from '../server/appHelpers';
import {
    fsCheckFileExist,
    fsCopyFilePathToPath,
    fsGetFileSize,
    fsReadFile,
    fsReadFileBase64Sync,
    fsWriteFileSync,
    getDownloadPath,
} from '../server/fileHelpers';
import type { SrcData } from '../helper/FileSource';
import {
    checkIsImageName,
    checkIsReadableTextName,
    getAttachmentData,
    toAttachedText,
    toImageMediaType,
    type ChatAttachmentType,
} from './attachmentHelpers';

export type ChatAssetPreviewType = {
    id: string;
    name: string;
    // What the overlay DRAWS. `file` is the honest answer for everything this
    // window cannot render -- a video, a PDF, a document -- and is a card
    // rather than a refusal: its buttons still work.
    kind: 'image' | 'text' | 'file';
    imageDataUrl: string | null;
    text: string | null;
    filePath: string | null;
    byteSize: number | null;
    // One sentence saying what is not being shown and why. Never an error
    // code, and never absent when something IS missing.
    note: string | null;
};

// A picture bigger than this is not drawn. It is a whole data URL in memory
// for as long as the overlay is open, and a screenshot of a 4K projector is
// about 2 MB -- anything past this is a photo library, not a chat asset.
const MAX_PREVIEW_IMAGE_BYTES = 8 * 1024 * 1024;
// Text is read WHOLE by the app's own reader, so the cap is on whether it is
// read at all rather than on how much of it comes back.
const MAX_PREVIEW_TEXT_BYTES = 512 * 1024;
// ...and what the overlay puts on screen, which is a different number: past
// this it is a wall of characters nobody reads in a 460px window.
const MAX_PREVIEW_TEXT_LENGTH = 20000;
const CUT_TEXT_NOTE = '\n\n[... the rest is in the file ...]';

/**
 * Whether a chip stands for something that can be OPENED, as opposed to a
 * control in the app window, which is rung where it lives instead.
 */
export function checkIsAssetAttachment(attachment: ChatAttachmentType) {
    if (attachment.selector !== undefined || attachment.kind === 'element') {
        return false;
    }
    return (
        attachment.filePath !== undefined ||
        getAttachmentData(attachment.id) !== null ||
        (attachment.summary ?? '').length > 0
    );
}

export function toReadableSize(byteSize: number | null) {
    if (byteSize === null) {
        return '';
    }
    if (byteSize < 1024) {
        return `${byteSize.toString()} bytes`;
    }
    if (byteSize < 1024 * 1024) {
        return `${Math.round(byteSize / 1024).toString()} KB`;
    }
    return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

function toCutText(text: string) {
    return text.length > MAX_PREVIEW_TEXT_LENGTH
        ? text.slice(0, MAX_PREVIEW_TEXT_LENGTH) + CUT_TEXT_NOTE
        : text;
}

async function readFilePreview(
    attachment: ChatAttachmentType,
    filePath: string,
): Promise<ChatAssetPreviewType> {
    const base = {
        id: attachment.id,
        name: attachment.name,
        filePath,
        imageDataUrl: null,
        text: null,
    };
    if (!(await fsCheckFileExist(filePath))) {
        return {
            ...base,
            kind: 'file',
            byteSize: null,
            // The one case where Download cannot work either, so it says so
            // here rather than failing under a press.
            note: 'This file is not on this machine any more. It may have been moved, renamed or deleted.',
        };
    }
    let byteSize: number | null = null;
    try {
        byteSize = await fsGetFileSize(filePath);
    } catch (_error) {
        // A size that cannot be read is not a reason to refuse the file: the
        // caps below simply do not fire, and the content read is attempted.
    }
    const isTooBig = (limit: number) => {
        return byteSize !== null && byteSize > limit;
    };
    if (checkIsImageName(attachment.name) || checkIsImageName(filePath)) {
        if (isTooBig(MAX_PREVIEW_IMAGE_BYTES)) {
            return {
                ...base,
                kind: 'file',
                byteSize,
                note: `This picture is ${toReadableSize(byteSize)}, too big to show here. Download it or open its folder to look at it.`,
            };
        }
        try {
            const mediaType =
                toImageMediaType(attachment.name) ??
                toImageMediaType(filePath) ??
                'image/png';
            const base64 = fsReadFileBase64Sync(filePath);
            return {
                ...base,
                kind: 'image',
                byteSize,
                imageDataUrl: `data:${mediaType};base64,${base64}`,
                note: null,
            };
        } catch (_error) {
            return {
                ...base,
                kind: 'file',
                byteSize,
                note: 'I could not read that picture from the disk.',
            };
        }
    }
    // By NAME, or because the window is already holding this file's words --
    // it read them once, so they are words. NOT by `kind`: everything an
    // answer offers as a file arrives typed `text`, video and PDF included,
    // and reading one of those as UTF-8 is a wall of mojibake at best and a
    // whole video in memory at worst.
    const heldText = toAttachedText(attachment);
    if (checkIsReadableTextName(attachment.name) || heldText.length > 0) {
        if (isTooBig(MAX_PREVIEW_TEXT_BYTES)) {
            return {
                ...base,
                kind: 'file',
                byteSize,
                note: `This file is ${toReadableSize(byteSize)}, too big to show here. Download it or open its folder to read it.`,
            };
        }
        try {
            const text = await fsReadFile(filePath);
            return {
                ...base,
                kind: 'text',
                byteSize,
                text: toCutText(text),
                note: null,
            };
        } catch (_error) {
            // The disk is the truth, but a copy this window already holds is
            // better than a card saying nothing.
            if (heldText.length > 0) {
                return {
                    ...base,
                    kind: 'text',
                    byteSize,
                    text: toCutText(heldText),
                    note: 'I could not re-read the file, so this is the copy attached to your question.',
                };
            }
        }
    }
    return {
        ...base,
        kind: 'file',
        byteSize,
        note: null,
    };
}

/**
 * What the overlay should draw for one chip, read ON DEMAND. Never throws:
 * every way this can go wrong is a `note` the user can read, because the
 * alternative is a chip that opens nothing and says nothing.
 */
export async function readAssetPreview(
    attachment: ChatAttachmentType,
): Promise<ChatAssetPreviewType> {
    // A picture whose bytes are still in this window: no disk, no wait. This
    // is the common one -- a screenshot taken a minute ago.
    const liveDataUrl =
        attachment.kind === 'image' ? getAttachmentData(attachment.id) : null;
    if (liveDataUrl !== null) {
        return {
            id: attachment.id,
            name: attachment.name,
            kind: 'image',
            imageDataUrl: liveDataUrl,
            text: null,
            filePath: attachment.filePath ?? null,
            byteSize: attachment.byteSize > 0 ? attachment.byteSize : null,
            note: null,
        };
    }
    if (attachment.filePath !== undefined) {
        try {
            return await readFilePreview(attachment, attachment.filePath);
        } catch (error: any) {
            return {
                id: attachment.id,
                name: attachment.name,
                kind: 'file',
                imageDataUrl: null,
                text: null,
                filePath: attachment.filePath,
                byteSize: null,
                note: `I could not open that one: ${error.message}`,
            };
        }
    }
    const text = toAttachedText(attachment);
    if (text.length > 0) {
        // Words this window is holding itself, with no file behind them.
        return {
            id: attachment.id,
            name: attachment.name,
            kind: 'text',
            imageDataUrl: null,
            text: toCutText(text),
            filePath: null,
            byteSize: attachment.byteSize > 0 ? attachment.byteSize : null,
            note: null,
        };
    }
    return {
        id: attachment.id,
        name: attachment.name,
        kind: 'file',
        imageDataUrl: null,
        text: null,
        filePath: null,
        byteSize: null,
        note:
            attachment.kind === 'image'
                ? 'That picture is not attached any more — pictures are kept only while this window is open.'
                : 'There is nothing left to show for that one.',
    };
}

function toComparableDir(dirPath: string) {
    return dirPath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * A name for something this window is holding that never came off a disk.
 * Timestamped rather than asked about: a save dialog in a popup over a live
 * service is a thing to get out of, not a thing to answer.
 */
function toSavedTextName(name: string) {
    const clean = name.replace(/[\\/:*?"<>|]/g, '-').trim();
    const safe = clean.length > 0 ? clean : 'text';
    return /\.[a-z0-9]{1,8}$/i.test(safe) ? safe : `${safe}.txt`;
}

export type AssetDownloadResultType = {
    filePath: string | null;
    // Said in the transcript. One sentence, in the words a volunteer uses.
    message: string;
};

/**
 * Download: a copy in the user's Downloads folder, revealed there, whatever
 * kind of asset it is. The one exception is a file that is ALREADY in
 * Downloads -- that is revealed rather than copied, because a second press
 * must not leave a second copy.
 *
 * The REVEAL happens here rather than in the caller, because the app's own
 * picture save does it for itself: a caller that revealed as well would open
 * the folder twice for one press.
 */
export async function downloadAsset(
    preview: ChatAssetPreviewType,
): Promise<AssetDownloadResultType> {
    const downloadDirPath = getDownloadPath();
    if (preview.filePath !== null) {
        if (!(await fsCheckFileExist(preview.filePath))) {
            return {
                filePath: null,
                message:
                    'That file is not on this machine any more, so there is ' +
                    'nothing to download.',
            };
        }
        const fileSource = FileSource.getInstance(preview.filePath);
        if (
            toComparableDir(fileSource.baseDirPath) ===
            toComparableDir(downloadDirPath)
        ) {
            showFileOrDirExplorer(preview.filePath);
            return {
                filePath: preview.filePath,
                message: `“${preview.name}” is already in your Downloads folder — I opened it for you.`,
            };
        }
        const savedFilePath = await fsCopyFilePathToPath(
            preview.filePath,
            downloadDirPath,
        );
        if (savedFilePath === null || savedFilePath === undefined) {
            return {
                filePath: null,
                message: 'I could not save a copy into your Downloads folder.',
            };
        }
        showFileOrDirExplorer(savedFilePath);
        return {
            filePath: savedFilePath,
            message: `Saved “${FileSource.getInstance(savedFilePath).fullName}” into your Downloads folder.`,
        };
    }
    if (preview.imageDataUrl !== null) {
        // The app's own save-and-reveal, which names the picture and opens
        // the folder itself.
        const savedFilePath = downloadImageBase64Data(
            preview.imageDataUrl as SrcData,
        );
        return savedFilePath === null
            ? {
                  filePath: null,
                  message: 'I could not save that picture.',
              }
            : {
                  filePath: savedFilePath,
                  message: 'Saved the picture into your Downloads folder.',
              };
    }
    if (preview.text !== null) {
        const targetFilePath = await FileSource.getInstance(
            `${downloadDirPath}/${toSavedTextName(preview.name)}`,
        ).genNextFilePath();
        fsWriteFileSync(targetFilePath, preview.text);
        showFileOrDirExplorer(targetFilePath);
        return {
            filePath: targetFilePath,
            message: `Saved “${FileSource.getInstance(targetFilePath).fullName}” into your Downloads folder.`,
        };
    }
    return {
        filePath: null,
        message: 'There is nothing left of that one to download.',
    };
}
