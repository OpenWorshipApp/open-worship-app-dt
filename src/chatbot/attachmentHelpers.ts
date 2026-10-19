// What the user can hand the assistant besides a sentence of English.
//
// The window took one kind of input -- typed words -- and that is the wrong
// shape for the person it is written for. A volunteer who cannot NAME what they
// are looking at can still photograph it, and "this thing here" is one press
// where describing it is five rounds of the model guessing. So the ask box now
// takes a picture, a file, a screenshot of the app, and a control pointed at in
// the app window itself.
//
// The one rule that shapes everything in this file: the bytes are NEVER
// persisted. `chatbot-sessions` is read whole, synchronously, at startup on a
// machine chosen for having nothing to spare -- one screenshot in it would cost
// more than every conversation the window has ever held. So a message carries
// the DESCRIPTION of what was attached (which survives a restart and is what the
// transcript draws), and the picture itself lives in a bounded map here that
// dies with the window. A reopened tab shows the chip greyed out, which is the
// truth rather than a broken thumbnail.

import { checkIsBibleNoteFileName } from '../bible-list/note/bibleNotePreviewHelpers';
import { tran } from './chatTranHelpers';
import type { AttachmentWindowType } from './windowAimHelpers';

/**
 * The four things that can be attached, and they are not alike. A `file` is
 * a PDF: the model is shown its first pages as PICTURES (2026-10-17, the
 * user, with a picture of the assistant saying _I cannot open PDF files_:
 * _convert to images for pdf pages then send image as attachment_), held
 * beside its id like a picture's bytes, and a problem report takes the file
 * itself along for the people who can open it (2026-10-13: _and accept files
 * like markdown pdf_) -- read off the disk at the press that sends it.
 */
export type ChatAttachmentKindType = 'image' | 'text' | 'element' | 'file';

/**
 * What is stored ON the message, and so written to disk. No bytes, ever -- see
 * the note at the top of this file. Everything here is small enough to sit in a
 * settings blob sixty messages deep.
 */
export type ChatAttachmentType = {
    id: string;
    kind: ChatAttachmentKindType;
    // What the chip says: a file name, or the label of the control picked.
    name: string;
    mimeType: string;
    byteSize: number;
    // `element` only -- the unique CSS selector the picker resolved.
    selector?: string;
    // Where it came from on disk, when it came from disk at all (a drop or the
    // paperclip; a pasted picture has no path). Persisted, unlike the bytes: a
    // path is a short string, and it is what lets a chip still open the folder
    // it came from after the window has been closed and reopened.
    filePath?: string;
    // `element` and `text` -- the lines actually sent to the model. Kept
    // because they ARE the attachment for those two kinds: unlike a picture,
    // they cost nothing to persist, and re-asking without them would be
    // re-asking a different question.
    summary?: string;
    // The number its chip shows (2026-10-13, the user, with four chips all
    // called "my screen" in a picture: _attachment should have id like `1`
    // `2` `3` ... so user can mention in the text_). One per attachment in
    // a tab, given when it is attached and never changed -- "the button is
    // missing in 2" must still mean the same picture after another chip is
    // taken off. A chip an ANSWER draws has none.
    number?: number;
    // `image` from the 📷 and `element` from the ◎ -- WHICH window of the app
    // it was taken in, so the model can aim its tools there and a pointed-at
    // chip is rung where it was pointed at (`windowAimHelpers.ts`).
    window?: AttachmentWindowType;
    // `file` -- how many pages the PDF has in all, when MuPDF could count
    // them. Its first pages, as pictures, are held in this window only
    // (`getAttachmentPages`); this is what says how many were left out.
    pageCount?: number;
};

/**
 * The attachments just added, each with the next number of its tab: one past
 * the highest already given there, on a message or still in the box
 * (`taken`). One that has a number keeps it.
 */
export function numberAttachments(
    added: ChatAttachmentType[],
    taken: readonly ChatAttachmentType[],
): ChatAttachmentType[] {
    let highest = taken.reduce((most, one) => {
        return Math.max(most, one.number ?? 0);
    }, 0);
    return added.map((one) => {
        if (one.number !== undefined) {
            highest = Math.max(highest, one.number);
            return one;
        }
        highest += 1;
        return { ...one, number: highest };
    });
}

/**
 * An image on its way to a provider. The raw base64 and its media type are kept
 * APART rather than as a data URL, because Anthropic wants the two separately
 * and OpenAI's `url` form is rebuilt from them in one line -- carrying the data
 * URL instead means every Anthropic call has to parse a megabyte-long string
 * back apart.
 */
export type BotImageType = {
    mediaType: string;
    data: string;
};

// Four on one question. More than this is not a question, it is a folder -- and
// each one is re-billed on every round of the tool loop.
export const MAX_ATTACHMENT_COUNT = 4;

// The live store's ceilings. Small on purpose: this is memory held for the life
// of the window, and the app's rule is that nothing accumulates.
const MAX_LIVE_ATTACHMENTS = 8;
const MAX_LIVE_BYTES = 12 * 1024 * 1024;

// What a picture is cut down to before it goes anywhere.
//
// The number that matters is the LONG EDGE, not the file size: a provider
// charges for an image by its dimensions (roughly width x height / 750 tokens),
// so re-encoding without resizing saves bytes on the wire and not one token.
// 1024 costs ~1000 tokens, reads a control's label perfectly well, and is half
// what an unresized 1920-wide screenshot costs on every one of up to ten rounds.
const MAX_IMAGE_EDGE = 1024;
// PNG FIRST, deliberately. The obvious move is JPEG for the smaller file, but
// the subject here is a screen full of small text and thin borders, which is
// exactly what JPEG rings around -- and since the token price is set by the
// dimensions, the smaller file buys nothing the model can see. JPEG is the
// fallback only when the PNG comes back photo-sized (a background picture, a
// camera frame), where it is both smaller AND indistinguishable.
const MAX_PNG_BYTES = 900 * 1024;
const JPEG_QUALITY = 0.85;

// What a text attachment may contribute. The same lesson as `MAX_MODEL_BYTES`
// in `help.mjs`: the cap is on what the MODEL is handed, and a cut is announced,
// because a file that stops mid-line is read as a file that ends there.
const MAX_TEXT_LENGTH = 16 * 1024;

// One entry per ATTACHMENT, however many pictures it is: a picture is one, a
// PDF is its pages. So the ceilings count what was attached, and a PDF is
// let go of whole rather than page by page -- half a document in front of a
// model reads as a document that ends there.
const liveDataMap = new Map<string, string[]>();
let liveByteCount = 0;

function toDataByteSize(dataUrl: string) {
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex === -1 ? dataUrl.length : dataUrl.length - commaIndex - 1;
}

function toListByteSize(dataUrls: string[]) {
    return dataUrls.reduce((total, dataUrl) => {
        return total + toDataByteSize(dataUrl);
    }, 0);
}

export function dropAttachmentData(id: string) {
    const existing = liveDataMap.get(id);
    if (existing === undefined) {
        return;
    }
    liveByteCount -= toListByteSize(existing);
    liveDataMap.delete(id);
}

export function putAttachmentData(id: string, dataUrl: string) {
    putAttachmentPages(id, [dataUrl]);
}

/**
 * Hold the bytes for one attachment, dropping the oldest when either ceiling is
 * reached. A `Map` iterates in insertion order, which is what makes "oldest"
 * free -- and re-putting an id deletes first, so a replaced attachment does not
 * hold its old size against the total.
 */
export function putAttachmentPages(id: string, dataUrls: string[]) {
    dropAttachmentData(id);
    if (dataUrls.length === 0) {
        return;
    }
    liveDataMap.set(id, dataUrls);
    liveByteCount += toListByteSize(dataUrls);
    for (const key of [...liveDataMap.keys()]) {
        if (
            liveDataMap.size <= MAX_LIVE_ATTACHMENTS &&
            liveByteCount <= MAX_LIVE_BYTES
        ) {
            break;
        }
        // Never evict the one just added: the caller is about to send it.
        if (key !== id) {
            dropAttachmentData(key);
        }
    }
}

export function getAttachmentData(id: string) {
    return liveDataMap.get(id)?.[0] ?? null;
}

/** A PDF's pages as pictures, in order; none once the window let them go. */
export function getAttachmentPages(id: string): readonly string[] {
    return liveDataMap.get(id) ?? [];
}

export function checkHasAttachmentData(attachment: ChatAttachmentType) {
    return attachment.kind !== 'image' || liveDataMap.has(attachment.id);
}

export function genAttachmentId() {
    const salt = Math.random().toString(36).slice(2, 10);
    return `a${Date.now().toString(36)}${salt}`;
}

function loadImageElement(dataUrl: string) {
    return new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.onload = () => {
            resolve(image);
        };
        image.onerror = () => {
            resolve(null);
        };
        image.src = dataUrl;
    });
}

function readAsDataUrl(blob: Blob) {
    return new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            resolve(typeof result === 'string' ? result : null);
        };
        reader.onerror = () => {
            resolve(null);
        };
        reader.readAsDataURL(blob);
    });
}

const SENDABLE_IMAGE_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,/i;

/**
 * A picture cut down to what is worth sending: at most `MAX_IMAGE_EDGE` on its
 * long side, PNG unless that comes back photo-sized.
 *
 * Returns the ORIGINAL untouched when it is already small enough and already a
 * format every provider takes -- re-encoding a 300x80 crop of a toolbar through
 * a canvas can only make it worse.
 */
export async function normalizeImage(source: Blob | string) {
    const sourceDataUrl =
        typeof source === 'string' ? source : await readAsDataUrl(source);
    if (sourceDataUrl === null) {
        return null;
    }
    const image = await loadImageElement(sourceDataUrl);
    if (image === null || image.width === 0 || image.height === 0) {
        return null;
    }
    const longEdge = Math.max(image.width, image.height);
    const scale = longEdge > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longEdge : 1;
    if (scale === 1 && SENDABLE_IMAGE_PATTERN.test(sourceDataUrl)) {
        return {
            dataUrl: sourceDataUrl,
            width: image.width,
            height: image.height,
            byteSize: toDataByteSize(sourceDataUrl),
        };
    }
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) {
        return null;
    }
    context.drawImage(image, 0, 0, width, height);
    let dataUrl = canvas.toDataURL('image/png');
    if (toDataByteSize(dataUrl) > MAX_PNG_BYTES) {
        dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    }
    return { dataUrl, width, height, byteSize: toDataByteSize(dataUrl) };
}

/**
 * A picture onto the clipboard. Chromium's async clipboard takes `image/png`
 * and nothing else, so anything else is drawn through a canvas first -- a
 * JPEG, which is what a photo-sized capture comes back as, would otherwise be
 * refused with "Type image/jpeg not supported". Throws on failure so the
 * caller can say so: a Copy that looks as though it worked and did not is the
 * worse one -- in the window's language, since the preview prints the reason.
 */
export async function copyImageToClipboard(dataUrl: string) {
    let blob = await (await fetch(dataUrl)).blob();
    if (blob.type !== 'image/png') {
        const image = await loadImageElement(dataUrl);
        if (image === null || image.width === 0 || image.height === 0) {
            throw new Error(tran('the picture could not be read'));
        }
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (context === null) {
            throw new Error(tran('the picture could not be redrawn'));
        }
        context.drawImage(image, 0, 0);
        const png = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });
        if (png === null) {
            throw new Error(tran('the picture could not be redrawn'));
        }
        blob = png;
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

/**
 * The two halves of a data URL, or null. Anything that is not a base64 image
 * data URL is refused here rather than sent and 400'd by the provider.
 */
export function toBotImage(dataUrl: string): BotImageType | null {
    const matched = /^data:(image\/[a-z+]+);base64,(.+)$/is.exec(dataUrl ?? '');
    if (matched === null) {
        return null;
    }
    return { mediaType: matched[1].toLowerCase(), data: matched[2] };
}

export async function genImageAttachment(
    source: Blob | string,
    name: string,
    filePath?: string,
    // The app window the picture is of -- the 📷, a report's picture.
    takenIn?: AttachmentWindowType | null,
): Promise<ChatAttachmentType | null> {
    const normalized = await normalizeImage(source);
    if (normalized === null) {
        return null;
    }
    const id = genAttachmentId();
    putAttachmentData(id, normalized.dataUrl);
    return {
        id,
        kind: 'image',
        name,
        mimeType: toBotImage(normalized.dataUrl)?.mediaType ?? 'image/png',
        byteSize: normalized.byteSize,
        ...(filePath ? { filePath } : {}),
        ...(takenIn ? { window: takenIn } : {}),
    };
}

// What can be read as words. An allowlist, and a short one: this is a help
// window, and the useful non-picture attachment is a note, a log or one of the
// app's own text documents. Anything else is refused by name rather than sent
// as mojibake -- a model handed the first 16 KB of a .docx answers about the
// bytes rather than saying it cannot read it.
const TEXT_FILE_PATTERN =
    /\.(txt|md|markdown|json|csv|log|xml|html?|ya?ml|ini|srt|vtt|owl|ows|owpf|lyric)$/i;

/**
 * By NAME alone -- for the places that have a path and no `File`: a chip being
 * opened for a preview, a document the assistant created. One pattern for both
 * or the window offers to show a file it will then refuse to read.
 */
export function checkIsReadableTextName(fileName: string) {
    return TEXT_FILE_PATTERN.test(fileName);
}

// A document: its pages are shown to the model as pictures, and the file
// itself goes with a problem report.
const CARRIED_FILE_PATTERN = /\.pdf$/i;
// What a report may carry in one file (`REPORT_FILE_MAX_BYTES` in
// `electron/customLlmProtocol.ts`; a test holds the two together).
export const MAX_CARRIED_FILE_BYTES = 5 * 1024 * 1024;

export function checkIsCarriedFileName(fileName: string) {
    return CARRIED_FILE_PATTERN.test(fileName);
}

function toShortSize(byteSize: number) {
    return byteSize < 1024 * 1024
        ? `${Math.max(1, Math.round(byteSize / 1024)).toString()} KB`
        : `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

function toPdfAbout(name: string, byteSize: number, pageCount?: number) {
    const pages =
        pageCount === undefined
            ? ''
            : `${pageCount.toString()} ${pageCount === 1 ? 'page' : 'pages'}, `;
    return (
        `The user attached a file called "${name}" (a PDF, ` +
        `${pages}${toShortSize(byteSize)}).`
    );
}

/**
 * A PDF. Its first pages go to the model as pictures once they are put
 * beside its id (`putAttachmentPages`, by `genPdfAttachment` in
 * `fileAttachHelpers.ts`); the report sends the file itself, from
 * `filePath`, when Send is pressed. The `summary` kept on it is the
 * sentence for when no page could be drawn -- what the model is told is
 * worked out at the ask (`toFileSummary`), from what this window still
 * holds.
 */
export function genFileAttachment(
    name: string,
    byteSize: number,
    filePath: string,
    pageCount?: number,
): ChatAttachmentType {
    return {
        id: genAttachmentId(),
        kind: 'file',
        name,
        mimeType: 'application/pdf',
        byteSize,
        filePath,
        ...(pageCount === undefined ? {} : { pageCount }),
        summary:
            `${toPdfAbout(name, byteSize, pageCount)} You cannot read what ` +
            'is inside it, so do not guess: if what they ask depends on it, ' +
            'say you cannot open it and ask them to say what it shows or ' +
            'attach a picture of the page. It is sent as it is with a ' +
            'problem report.',
    };
}

/**
 * What the model is told of a PDF NOW. With pages held, it reads them --
 * and is told which pages were left out, so "it is not in the file" is never
 * said of a page it was not shown. With none (drawing them failed, or the
 * window has been closed since), it is the sentence that says it cannot.
 */
function toFileSummary(attachment: ChatAttachmentType) {
    const shownCount = getAttachmentPages(attachment.id).length;
    if (shownCount === 0) {
        return attachment.summary ?? '';
    }
    const total = attachment.pageCount ?? shownCount;
    const shown =
        shownCount >= total
            ? total === 1
                ? 'Its page is attached as a picture'
                : `All ${total.toString()} of its pages are attached as ` +
                  'pictures, in order'
            : `Its first ${shownCount.toString()} pages are attached as ` +
              `pictures, in order; pages ${(shownCount + 1).toString()} to ` +
              `${total.toString()} are NOT, so if the answer may be on them, ` +
              'say so rather than that the file does not say';
    return (
        `${toPdfAbout(attachment.name, attachment.byteSize, attachment.pageCount)} ` +
        `${shown}. Read them to answer, in the words the page uses, and say ` +
        'which page a thing is on. It is sent as it is with a problem report.'
    );
}

export function checkIsReadableTextFile(file: File) {
    return (
        file.type.startsWith('text/') ||
        file.type === 'application/json' ||
        checkIsReadableTextName(file.name)
    );
}

// The pictures this window will draw from a path. Deliberately raster only:
// an SVG is a document that can carry script, and nothing here needs one.
const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;

export function checkIsImageName(fileName: string) {
    return IMAGE_FILE_PATTERN.test(fileName);
}

/**
 * Whether the assistant can be handed this file at all, by its NAME: a
 * picture, a PDF (its pages), a Bible note (its words) or a text kind. What
 * the Resources panel offers its 🤖 on, so it is never offered on a file
 * the window would then refuse.
 */
export function checkCanAttachFileName(fileName: string) {
    return (
        checkIsImageName(fileName) ||
        checkIsCarriedFileName(fileName) ||
        checkIsBibleNoteFileName(fileName) ||
        checkIsReadableTextName(fileName)
    );
}

/** The media type for a picture read off the disk, by its name. */
export function toImageMediaType(fileName: string) {
    const matched = IMAGE_FILE_PATTERN.exec(fileName);
    if (matched === null) {
        return null;
    }
    const extension = matched[1].toLowerCase();
    if (extension === 'jpg' || extension === 'jpeg') {
        return 'image/jpeg';
    }
    return `image/${extension}`;
}

// The line the model is given above a file's words, so it knows what it is
// reading. Written and stripped in the same module deliberately: the preview
// shows the FILE, not the sentence this window wrapped around it.
function genAttachedTextHeader(name: string) {
    return `The user attached a file called "${name}":\n`;
}

/** What was in the file, without the line written for the model. */
export function toAttachedText(attachment: ChatAttachmentType) {
    // A carried file holds a sentence for the model, never the file's words.
    if (attachment.kind === 'file') {
        return '';
    }
    const summary = attachment.summary ?? '';
    const header = genAttachedTextHeader(attachment.name);
    return summary.startsWith(header) ? summary.slice(header.length) : summary;
}

export function genTextAttachment(
    name: string,
    text: string,
    filePath?: string,
): ChatAttachmentType {
    const trimmed = text.slice(0, MAX_TEXT_LENGTH);
    const lastBreak = trimmed.lastIndexOf('\n');
    const body =
        trimmed.length < text.length
            ? trimmed.slice(0, lastBreak > 0 ? lastBreak : trimmed.length) +
              '\n[... the rest of this file was not included ...]'
            : trimmed;
    return {
        id: genAttachmentId(),
        kind: 'text',
        name,
        mimeType: 'text/plain',
        byteSize: text.length,
        ...(filePath ? { filePath } : {}),
        summary: `${genAttachedTextHeader(name)}${body}`,
    };
}

/**
 * A control the user pointed at, as the model should read it.
 *
 * The SELECTOR is what this feature was asked for and it goes in -- but
 * deliberately last, and told plainly not to come back out. The model is
 * answering a volunteer, and an answer quoting a CSS selector at them is exactly
 * the internals leak the rest of this window is written to prevent.
 */
/**
 * The name a person reads on the chip.
 *
 * The matcher's own `label` JOINS every way an element is named, which is what
 * makes matching tolerant and what makes a chip unreadable: the settings button
 * carries the same word as its text and its aria-label and comes back "Setting
 * Setting", and the bible lookup button comes back with its whole tooltip
 * attached. The parts are kept apart for exactly this, so the SHORTEST of them
 * is taken -- the name, rather than the explanation of it.
 */
function toChipName(described: any) {
    const parts: string[] = Array.isArray(described?.labelParts)
        ? described.labelParts
              .map((part: any) => {
                  return String(part ?? '').trim();
              })
              .filter((part: string) => {
                  return part.length > 0;
              })
        : [];
    if (parts.length > 0) {
        return parts.reduce((best, part) => {
            return part.length < best.length ? part : best;
        });
    }
    return String(described?.label ?? '').trim();
}

export function genElementAttachment(
    described: any,
    // The app window it was pointed at in.
    takenIn?: AttachmentWindowType | null,
): ChatAttachmentType {
    const label = toChipName(described);
    const lines = [
        `The user pointed at a control in ${toWindowWords(takenIn)}. It is:`,
        `- what it says: ${label.length > 0 ? label : '(no words on it)'}`,
    ];
    if (described?.inPanel) {
        lines.push(`- the panel it is in: ${described.inPanel}`);
    }
    if (described?.where) {
        lines.push(`- where it is: ${described.where}`);
    }
    if (described?.isVisible === false) {
        lines.push(
            described?.showsOnHover === true
                ? '- it only shows while the mouse is over that part of the' +
                      ' window'
                : '- it is not on screen at the moment',
        );
    }
    if (described?.isEnabled === false) {
        lines.push('- it is greyed out');
    }
    if (described?.selector) {
        lines.push(
            '- how to find it again, for your own tool calls only, never to' +
                ` be repeated to the user: ${described.selector}`,
        );
    }
    return {
        id: genAttachmentId(),
        kind: 'element',
        name: label.length > 0 ? label : 'the control they pointed at',
        mimeType: 'application/x-owa-element',
        byteSize: 0,
        ...(described?.selector
            ? { selector: String(described.selector) }
            : {}),
        summary: lines.join('\n'),
        ...(takenIn ? { window: takenIn } : {}),
    };
}

/**
 * The window in words: "the Settings window", "the main window (on the
 * Presenter)". Kept apart from its `page`, which is good for one launch and
 * is worked out at the ask (`toAttachmentLegend`), never stored in words.
 */
function toWindowWords(takenIn?: AttachmentWindowType | null) {
    if (!takenIn) {
        return 'the app window';
    }
    return takenIn.isMain
        ? `the main window (on the ${takenIn.label})`
        : `the ${takenIn.label} window`;
}

/**
 * The images of a set of attachments, in order, skipping any whose bytes have
 * gone -- which is what "session only" means when a tab is re-asked after a
 * reload.
 */
export function toBotImages(attachments: ChatAttachmentType[]) {
    const images: BotImageType[] = [];
    for (const attachment of attachments) {
        // A picture, or a PDF's pages -- each page a picture of its own, in
        // the order the legend counts them.
        if (attachment.kind !== 'image' && attachment.kind !== 'file') {
            continue;
        }
        for (const dataUrl of getAttachmentPages(attachment.id)) {
            const image = toBotImage(dataUrl);
            if (image !== null) {
                images.push(image);
            }
        }
    }
    return images;
}

/** Everything that is text rather than pixels, as one block for the question. */
export function toAttachmentText(
    attachments: ChatAttachmentType[],
    // False for a model the pictures are NOT sent to: a PDF is then the
    // sentence saying it cannot be opened, never "its pages are attached".
    isSeeing = true,
) {
    const parts = attachments
        .map((attachment) => {
            return attachment.kind === 'file' && isSeeing
                ? toFileSummary(attachment)
                : (attachment.summary ?? '');
        })
        .filter((part) => {
            return part.length > 0;
        });
    return parts.join('\n\n');
}

/**
 * What a picture with an empty box is asking. A photograph of the screen IS the
 * whole question -- the window lets an empty box through on purpose when
 * something is clipped to it -- but only an `element` or a file attachment
 * carries WORDS, so a picture on its own composes to nothing, and nothing is
 * not a question any provider will take. Anthropic refuses it outright ("text
 * content blocks must be non-empty"), which is what a volunteer got back after
 * the assistant had just ASKED them for a screenshot: an error, with the
 * offline bot's greeting underneath it.
 *
 * Deliberately open-ended. The model already has the turn where it asked for
 * the picture, so this only has to stop it being handed a blank.
 */
export const ATTACHMENT_ONLY_QUESTION =
    'The user sent this without typing a question. Look at what they ' +
    'attached, say what you can see, and help with whatever looks wrong or ' +
    'unfinished — ask them what they need if that is not clear.';

/**
 * ...and what a FILE with an empty box is asking. A document from their
 * folder is not a screen with something wrong on it: "help with whatever
 * looks wrong" sent a model hunting a sermon's notes for a fault.
 */
export const FILE_ONLY_QUESTION =
    'The user sent this file without typing a question. Say in a few ' +
    'sentences what it is and what it covers, then ask what they would ' +
    'like to know about it.';

/**
 * Attached from a FILE on their computer -- a PDF, a text file, a picture
 * from a folder -- rather than a picture of the app or a control pointed
 * at. What a person goes on asking about, question after question
 * (`findOpenFileAttachments`).
 */
export function checkIsFileAttachment(attachment: ChatAttachmentType) {
    return (
        attachment.kind !== 'element' &&
        attachment.filePath !== undefined &&
        attachment.window === undefined
    );
}

/**
 * The files a tab's next question is still about: those of the LAST
 * question that had a file attached, unless the tab has closed them since
 * (`closedAfterId`, the id of the message they were closed at).
 *
 * Asked for by the user (2026-10-17): a file opened from Resources is for
 * asking about _around the content in the file_, and a model is handed
 * pictures and a file's words on the question they came with alone -- the
 * history keeps only "(with the file attached)". So the second question
 * about a sermon's notes was asked of a model that had never seen them.
 * Only files: a picture of the app is of the app as it WAS.
 */
export function findOpenFileAttachments(
    messages: readonly {
        id: number;
        author: string;
        attachments?: ChatAttachmentType[];
    }[],
    closedAfterId?: number,
): ChatAttachmentType[] {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.author !== 'you') {
            continue;
        }
        const files = (message.attachments ?? []).filter(checkIsFileAttachment);
        if (files.length === 0) {
            continue;
        }
        return closedAfterId !== undefined && message.id <= closedAfterId
            ? []
            : files;
    }
    return [];
}

function toOrdinal(count: number) {
    const tail = count % 100;
    const ending =
        tail >= 11 && tail <= 13
            ? 'th'
            : (['th', 'st', 'nd', 'rd'][count % 10] ?? 'th');
    return `${count.toString()}${ending}`;
}

/**
 * Which attachment each number is, for the model: the person sees a number
 * on every chip and writes "in 2 the button is missing", and a model is
 * handed pictures with no names on them at all. A picture is placed by its
 * ORDER among the ones that reach the model -- the only thing it can tell
 * them apart by. '' when nothing is numbered.
 */
export function toAttachmentLegend(
    attachments: ChatAttachmentType[],
    // The `page` that reaches an attachment's window NOW
    // (`toAttachmentWindowPage`); its stored id when nobody says.
    toWindowPage: (takenIn: AttachmentWindowType) => string | undefined = (
        takenIn,
    ) => {
        return takenIn.id;
    },
) {
    let pictureCount = 0;
    const lines: string[] = [];
    for (const attachment of attachments) {
        let what: string;
        if (attachment.kind === 'image') {
            if (liveDataMap.has(attachment.id)) {
                pictureCount += 1;
                what =
                    `a picture called "${attachment.name}" -- the ` +
                    `${toOrdinal(pictureCount)} picture attached here`;
            } else {
                what = `a picture called "${attachment.name}", no longer attached`;
            }
        } else if (attachment.kind === 'element') {
            what = `the control "${attachment.name}" they pointed at`;
        } else {
            what = `the file "${attachment.name}"`;
            // A PDF's pages are pictures among the others, and counted with
            // them: the 2nd picture may well be its first page.
            const pageTotal =
                attachment.kind === 'file'
                    ? getAttachmentPages(attachment.id).length
                    : 0;
            if (pageTotal === 1) {
                pictureCount += 1;
                what +=
                    ` -- its page is the ${toOrdinal(pictureCount)} ` +
                    'picture attached here';
            } else if (pageTotal > 1) {
                const first = pictureCount + 1;
                pictureCount += pageTotal;
                what +=
                    ` -- its pages 1 to ${pageTotal.toString()} are the ` +
                    `${toOrdinal(first)} to ${toOrdinal(pictureCount)} ` +
                    'pictures attached here';
            }
        }
        // WHICH window, and how a tool reaches it: a picture of a Settings
        // window read against the main window's controls is a wrong answer
        // with the right picture in front of it.
        if (attachment.window !== undefined) {
            const page = toWindowPage(attachment.window);
            what +=
                `, in ${toWindowWords(attachment.window)}` +
                (page === undefined
                    ? ''
                    : ` -- for your tool calls about it, page "${page}"`);
        }
        if (attachment.number !== undefined) {
            lines.push(`[${attachment.number.toString()}] ${what}`);
        }
    }
    return lines.length === 0
        ? ''
        : 'Each thing the user attached shows a number, and they may call ' +
              'it by that number ("in 2 the button is missing"):\n' +
              lines.join('\n');
}

/**
 * What the MODEL is asked, which is not always what the user typed: the words
 * an element or a file attachment carries are folded in after their sentence,
 * and a bare picture is asked as the question it plainly is.
 *
 * The TRANSCRIPT is deliberately not built from this. That bubble stays their
 * own sentence and their chips, because words a user never typed must never be
 * drawn as theirs -- and because a bubble reading back a control's selector is
 * the internals leak this window exists to avoid.
 */
export function toAskedOfModel(
    typed: string,
    attachments: ChatAttachmentType[],
    toWindowPage?: (takenIn: AttachmentWindowType) => string | undefined,
) {
    const attachedText = toAttachmentText(attachments);
    const asked = (
        attachedText.length === 0 ? typed : typed + '\n\n' + attachedText
    ).trim();
    // Never for an empty box with nothing clipped to it -- that is not a
    // question at all, and the window turns it away before reaching here.
    let question = asked;
    if (typed.trim().length === 0 && attachments.length > 0) {
        if (attachments.every(checkIsFileAttachment)) {
            // A file's words alone are not a question either.
            question = [FILE_ONLY_QUESTION, attachedText]
                .filter((part) => {
                    return part.length > 0;
                })
                .join('\n\n');
        } else if (asked.length === 0) {
            question = ATTACHMENT_ONLY_QUESTION;
        }
    }
    // Which number is which, last: it is a key to what stands above it.
    const legend = toAttachmentLegend(attachments, toWindowPage);
    return legend.length === 0 || question.length === 0
        ? question
        : `${question}\n\n${legend}`;
}

/**
 * What the TRANSCRIPT says was attached -- never the picture itself, and never a
 * data URL. This line is the one that survives a restart, rides in the history
 * of every later question in the tab, and so has to stay a handful of words. A
 * data URL here would be clipped to 800 characters of base64 and re-sent on
 * every round of every later question in the tab.
 */
export function toAttachmentNote(attachments: ChatAttachmentType[]) {
    // With numbers on them, each by its own: "picture [2]" is what a later
    // "look at 2 again" refers to.
    if (
        attachments.some((attachment) => {
            return attachment.number !== undefined;
        })
    ) {
        const named = attachments.map((attachment) => {
            // The window rides into the history by NAME only: a later "look
            // at 2 again" knows which window, and no launch-bound id is kept.
            const where =
                attachment.window === undefined
                    ? ''
                    : ` in ${toWindowWords(attachment.window)}`;
            const what =
                attachment.kind === 'image'
                    ? 'picture'
                    : attachment.kind === 'element'
                      ? `the "${attachment.name}" control`
                      : `the file "${attachment.name}"`;
            return (
                (attachment.number === undefined
                    ? what
                    : `${what} [${attachment.number.toString()}]`) + where
            );
        });
        const last = named.pop() ?? '';
        return `(with ${named.length === 0 ? last : `${named.join(', ')} and ${last}`} attached)`;
    }
    const imageCount = attachments.filter((attachment) => {
        return attachment.kind === 'image';
    }).length;
    const parts: string[] = [];
    if (imageCount === 1) {
        parts.push('a picture');
    } else if (imageCount > 1) {
        parts.push(`${imageCount} pictures`);
    }
    for (const attachment of attachments) {
        if (attachment.kind === 'image') {
            continue;
        }
        parts.push(
            attachment.kind === 'element'
                ? `the "${attachment.name}" control`
                : `the file "${attachment.name}"`,
        );
    }
    return parts.length === 0 ? '' : `(with ${parts.join(' and ')} attached)`;
}
