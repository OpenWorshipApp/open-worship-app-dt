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

/** The three things that can be attached, and they are not alike. */
export type ChatAttachmentKindType = 'image' | 'text' | 'element';

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
};

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

const liveDataMap = new Map<string, string>();
let liveByteCount = 0;

function toDataByteSize(dataUrl: string) {
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex === -1 ? dataUrl.length : dataUrl.length - commaIndex - 1;
}

export function dropAttachmentData(id: string) {
    const existing = liveDataMap.get(id);
    if (existing === undefined) {
        return;
    }
    liveByteCount -= toDataByteSize(existing);
    liveDataMap.delete(id);
}

/**
 * Hold the bytes for one attachment, dropping the oldest when either ceiling is
 * reached. A `Map` iterates in insertion order, which is what makes "oldest"
 * free -- and re-putting an id deletes first, so a replaced attachment does not
 * hold its old size against the total.
 */
export function putAttachmentData(id: string, dataUrl: string) {
    dropAttachmentData(id);
    liveDataMap.set(id, dataUrl);
    liveByteCount += toDataByteSize(dataUrl);
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
    return liveDataMap.get(id) ?? null;
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
 * worse one.
 */
export async function copyImageToClipboard(dataUrl: string) {
    let blob = await (await fetch(dataUrl)).blob();
    if (blob.type !== 'image/png') {
        const image = await loadImageElement(dataUrl);
        if (image === null || image.width === 0 || image.height === 0) {
            throw new Error('the picture could not be read');
        }
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (context === null) {
            throw new Error('the picture could not be redrawn');
        }
        context.drawImage(image, 0, 0);
        const png = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });
        if (png === null) {
            throw new Error('the picture could not be redrawn');
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
    };
}

// What can be read as words. An allowlist, and a short one: this is a help
// window, and the useful non-picture attachment is a note, a log or one of the
// app's own text documents. Anything else is refused by name rather than sent
// as mojibake -- a model handed the first 16 KB of a .docx answers about the
// bytes rather than saying it cannot read it.
const TEXT_FILE_PATTERN =
    /\.(txt|md|json|csv|log|xml|html?|ya?ml|ini|srt|vtt|owl|ows|owpf|lyric)$/i;

/**
 * By NAME alone -- for the places that have a path and no `File`: a chip being
 * opened for a preview, a document the assistant created. One pattern for both
 * or the window offers to show a file it will then refuse to read.
 */
export function checkIsReadableTextName(fileName: string) {
    return TEXT_FILE_PATTERN.test(fileName);
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

export function genElementAttachment(described: any): ChatAttachmentType {
    const label = toChipName(described);
    const lines = [
        'The user pointed at a control in the app window. It is:',
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
    };
}

/**
 * The images of a set of attachments, in order, skipping any whose bytes have
 * gone -- which is what "session only" means when a tab is re-asked after a
 * reload.
 */
export function toBotImages(attachments: ChatAttachmentType[]) {
    const images: BotImageType[] = [];
    for (const attachment of attachments) {
        if (attachment.kind !== 'image') {
            continue;
        }
        const dataUrl = getAttachmentData(attachment.id);
        if (dataUrl === null) {
            continue;
        }
        const image = toBotImage(dataUrl);
        if (image !== null) {
            images.push(image);
        }
    }
    return images;
}

/** Everything that is text rather than pixels, as one block for the question. */
export function toAttachmentText(attachments: ChatAttachmentType[]) {
    const parts = attachments
        .map((attachment) => {
            return attachment.summary ?? '';
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
) {
    const attachedText = toAttachmentText(attachments);
    const asked = (
        attachedText.length === 0 ? typed : typed + '\n\n' + attachedText
    ).trim();
    // Never for an empty box with nothing clipped to it -- that is not a
    // question at all, and the window turns it away before reaching here.
    return asked.length === 0 && attachments.length > 0
        ? ATTACHMENT_ONLY_QUESTION
        : asked;
}

/**
 * What the TRANSCRIPT says was attached -- never the picture itself, and never a
 * data URL. This line is the one that survives a restart, rides in the history
 * of every later question in the tab, and so has to stay a handful of words. A
 * data URL here would be clipped to 800 characters of base64 and re-sent on
 * every round of every later question in the tab.
 */
export function toAttachmentNote(attachments: ChatAttachmentType[]) {
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
