import { fileUrlToPath } from '../ms-office/pptxStyleHelpers';
import { fsGetFileSize, fsReadFileBytes } from '../server/fileHelpers';
import type { WordPictureSourceType } from './markdownWordHelpers';
import { fitWordPictureSize } from './markdownWordHelpers';

/**
 * The pictures of a Markdown Preview page made into what a Word document
 * holds (`markdownWordExportHelpers.ts`), one at a time: each is read, made
 * into its file and handed on before the next is read, so a page of large
 * photos never sits in memory at once.
 *
 *  - A PNG, JPEG, GIF or BMP goes in as its own bytes; its size is read from
 *    its header, never by drawing it.
 *  - Any other picture (WebP, AVIF, SVG, ...) and a photo the camera turned
 *    (an EXIF orientation) are drawn once and go in as PNG / JPEG.
 *  - A diagram drawn on the page is drawn again as a picture, with the faces
 *    it was drawn in (`genSvgFontCss`): a picture made of an SVG reaches no
 *    face of the page, and a label drawn in another face than it was
 *    measured in runs out of its box.
 */

export type WordLoadedPictureType = {
    bytes: Uint8Array;
    extension: 'png' | 'jpeg' | 'gif' | 'bmp';
    width: number;
    height: number;
};

export type WordPictureLoadContextType = {
    // The room between the page's margins, in CSS pixels.
    maxBox: { width: number; height: number };
    // The @font-face rules a diagram is drawn with (`genSvgFontCss`).
    svgFontCss: string;
};

// A picture larger than this is left out, its name written in its place.
const MAX_PICTURE_BYTES = 30 * 1024 * 1024;
// A picture from the web that takes longer than this is left out.
const WEB_PICTURE_WAIT_MILLISECONDS = 15_000;
// A diagram is drawn at twice its size, so it stays sharp on paper -- and
// never past this many pixels a side, for a low-spec machine's memory.
const SVG_PICTURE_SCALE = 2;
const MAX_CANVAS_SIDE = 4096;
const JPEG_QUALITY = 0.92;

function readUint16BE(bytes: Uint8Array, offset: number) {
    return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32BE(bytes: Uint8Array, offset: number) {
    return (
        ((bytes[offset] << 24) >>> 0) +
        (bytes[offset + 1] << 16) +
        (bytes[offset + 2] << 8) +
        bytes[offset + 3]
    );
}

function readUint16LE(bytes: Uint8Array, offset: number) {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function readInt32LE(bytes: Uint8Array, offset: number) {
    return (
        bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)
    );
}

function checkStartsWith(bytes: Uint8Array, signature: number[]) {
    return (
        bytes.length >= signature.length &&
        signature.every((value, index) => {
            return bytes[index] === value;
        })
    );
}

/** The orientation a JPEG's EXIF names, 1 (as stored) when it names none. */
function readJpegExifOrientation(bytes: Uint8Array, app1Offset: number) {
    // `Exif\0\0`, then a TIFF header: byte order, 42, the first IFD.
    const tiffOffset = app1Offset + 10;
    if (
        !checkStartsWith(
            bytes.subarray(app1Offset + 4),
            [0x45, 0x78, 0x69, 0x66, 0, 0],
        ) ||
        tiffOffset + 8 > bytes.length
    ) {
        return 1;
    }
    const isLittleEndian = bytes[tiffOffset] === 0x49;
    const read16 = (offset: number) => {
        return isLittleEndian
            ? readUint16LE(bytes, offset)
            : readUint16BE(bytes, offset);
    };
    const read32 = (offset: number) => {
        return isLittleEndian
            ? readInt32LE(bytes, offset) >>> 0
            : readUint32BE(bytes, offset);
    };
    const ifdOffset = tiffOffset + read32(tiffOffset + 4);
    if (ifdOffset + 2 > bytes.length) {
        return 1;
    }
    const entryCount = read16(ifdOffset);
    for (let index = 0; index < entryCount; index++) {
        const entryOffset = ifdOffset + 2 + index * 12;
        if (entryOffset + 12 > bytes.length) {
            return 1;
        }
        if (read16(entryOffset) === 0x0112) {
            return read16(entryOffset + 8);
        }
    }
    return 1;
}

function readJpegInfo(bytes: Uint8Array) {
    let orientation = 1;
    let offset = 2;
    while (offset + 4 <= bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset++;
            continue;
        }
        const marker = bytes[offset + 1];
        if (marker === 0xff) {
            offset++;
            continue;
        }
        // Markers that carry no length.
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
            offset += 2;
            continue;
        }
        if (marker === 0xe1) {
            orientation = readJpegExifOrientation(bytes, offset);
        }
        const isFrameMarker =
            marker >= 0xc0 &&
            marker <= 0xcf &&
            marker !== 0xc4 &&
            marker !== 0xc8 &&
            marker !== 0xcc;
        if (isFrameMarker && offset + 9 <= bytes.length) {
            return {
                height: readUint16BE(bytes, offset + 5),
                width: readUint16BE(bytes, offset + 7),
                orientation,
            };
        }
        offset += 2 + readUint16BE(bytes, offset + 2);
    }
    return null;
}

/**
 * A PNG, JPEG, GIF or BMP Word takes as it is, with its size; null for any
 * other picture, and for a JPEG the camera turned (Word would show it as
 * stored, on its side).
 */
export function readWordReadyPicture(
    bytes: Uint8Array,
): WordLoadedPictureType | null {
    if (
        checkStartsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]) &&
        bytes.length >= 24
    ) {
        return {
            bytes,
            extension: 'png',
            width: readUint32BE(bytes, 16),
            height: readUint32BE(bytes, 20),
        };
    }
    if (checkStartsWith(bytes, [0xff, 0xd8, 0xff])) {
        const info = readJpegInfo(bytes);
        if (info === null || info.orientation !== 1) {
            return null;
        }
        return {
            bytes,
            extension: 'jpeg',
            width: info.width,
            height: info.height,
        };
    }
    if (
        checkStartsWith(bytes, [0x47, 0x49, 0x46, 0x38]) &&
        bytes.length >= 10
    ) {
        return {
            bytes,
            extension: 'gif',
            width: readUint16LE(bytes, 6),
            height: readUint16LE(bytes, 8),
        };
    }
    if (checkStartsWith(bytes, [0x42, 0x4d]) && bytes.length >= 26) {
        return {
            bytes,
            extension: 'bmp',
            width: readInt32LE(bytes, 18),
            height: Math.abs(readInt32LE(bytes, 22)),
        };
    }
    return null;
}

function checkIsSvgBytes(bytes: Uint8Array) {
    const head = new TextDecoder()
        .decode(bytes.subarray(0, 1024))
        .trimStart()
        .toLowerCase();
    return (
        head.startsWith('<svg') ||
        (head.startsWith('<?xml') && head.includes('<svg')) ||
        (head.startsWith('<!--') && head.includes('<svg'))
    );
}

function readAsDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(String(reader.result));
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('The data could not be read'));
        };
        reader.readAsDataURL(blob);
    });
}

/**
 * A canvas `width` x `height` to draw on, no larger a side than
 * `MAX_CANVAS_SIDE`, white under what is drawn: Word's page is paper.
 */
function genCanvas(width: number, height: number) {
    const scale = Math.min(1, MAX_CANVAS_SIDE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (context === null) {
        throw new Error('A canvas could not be drawn on');
    }
    return { canvas, context };
}

async function takeCanvasBytes(canvas: HTMLCanvasElement, isPhoto: boolean) {
    try {
        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(
                resolve,
                isPhoto ? 'image/jpeg' : 'image/png',
                JPEG_QUALITY,
            );
        });
        if (blob === null) {
            throw new Error('The picture could not be made');
        }
        return new Uint8Array(await blob.arrayBuffer());
    } finally {
        // The pixels are let go now, not when the canvas is collected.
        canvas.width = 0;
        canvas.height = 0;
    }
}

/**
 * An SVG drawn into a PNG of `width` x `height` CSS pixels. Drawn from a
 * `data:` address, never a `blob:` one: Chromium taints a canvas a `blob:`
 * SVG holding HTML (mermaid's labels) is drawn on, and a tainted canvas
 * cannot be read back.
 */
async function drawSvgPicture(
    svgText: string,
    width: number,
    height: number,
    fontCss: string,
): Promise<WordLoadedPictureType> {
    let text = svgText;
    if (fontCss !== '') {
        const tagEnd = text.indexOf('>', text.indexOf('<svg'));
        if (tagEnd > 0) {
            text =
                text.slice(0, tagEnd + 1) +
                `<style><![CDATA[${fontCss}]]></style>` +
                text.slice(tagEnd + 1);
        }
    }
    const image = new Image();
    image.src = await readAsDataUrl(
        new Blob([text], { type: 'image/svg+xml' }),
    );
    await image.decode();
    const { canvas, context } = genCanvas(
        width * SVG_PICTURE_SCALE,
        height * SVG_PICTURE_SCALE,
    );
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = '';
    return {
        bytes: await takeCanvasBytes(canvas, false),
        extension: 'png',
        width,
        height,
    };
}

/**
 * A picture Word cannot take as it is, drawn once into one it can: a photo
 * as JPEG (turned as its camera said), anything else as PNG.
 */
async function drawOtherPicture(
    bytes: Uint8Array,
): Promise<WordLoadedPictureType | null> {
    if (checkIsSvgBytes(bytes)) {
        const svgText = new TextDecoder().decode(bytes);
        const image = new Image();
        image.src = await readAsDataUrl(
            new Blob([svgText], { type: 'image/svg+xml' }),
        );
        await image.decode();
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        image.src = '';
        if (!(width > 0 && height > 0)) {
            return null;
        }
        return await drawSvgPicture(svgText, width, height, '');
    }
    const isJpeg = checkStartsWith(bytes, [0xff, 0xd8, 0xff]);
    const bitmap = await createImageBitmap(
        new Blob([bytes as Uint8Array<ArrayBuffer>]),
    );
    try {
        const { canvas, context } = genCanvas(bitmap.width, bitmap.height);
        if (isJpeg) {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return {
            bytes: await takeCanvasBytes(canvas, isJpeg),
            extension: isJpeg ? 'jpeg' : 'png',
            width: bitmap.width,
            height: bitmap.height,
        };
    } finally {
        bitmap.close();
    }
}

async function fetchPictureBytes(url: string) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
        abortController.abort();
    }, WEB_PICTURE_WAIT_MILLISECONDS);
    try {
        const response = await fetch(url, { signal: abortController.signal });
        const length = Number(response.headers.get('content-length') ?? '0');
        if (!response.ok || length > MAX_PICTURE_BYTES) {
            return null;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        return bytes.length > MAX_PICTURE_BYTES ? null : bytes;
    } catch {
        // Offline, refused, or a site that does not share its pictures.
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * A picture's bytes from where the page loaded it: a file on this machine
 * (`file:`, or the packaged app's own file address), the web, or the page
 * itself (`data:`). Null when it cannot be had.
 */
async function readPictureBytes(src: string) {
    let url: URL;
    try {
        url = new URL(src);
    } catch {
        return null;
    }
    if (
        url.protocol === 'http:' ||
        url.protocol === 'https:' ||
        url.protocol === 'data:'
    ) {
        return await fetchPictureBytes(src);
    }
    try {
        const filePath = fileUrlToPath(src);
        if ((await fsGetFileSize(filePath)) > MAX_PICTURE_BYTES) {
            return null;
        }
        return await fsReadFileBytes(filePath);
    } catch {
        return null;
    }
}

export async function loadWordPicture(
    source: WordPictureSourceType,
    context: WordPictureLoadContextType,
): Promise<WordLoadedPictureType | null> {
    if (source.kind === 'svg') {
        const size = fitWordPictureSize(
            source.width,
            source.height,
            context.maxBox,
        );
        if (size === null) {
            return null;
        }
        return await drawSvgPicture(
            source.svgText,
            size.width,
            size.height,
            context.svgFontCss,
        );
    }
    const bytes = await readPictureBytes(source.src);
    if (bytes === null || bytes.length === 0) {
        return null;
    }
    const picture =
        readWordReadyPicture(bytes) ?? (await drawOtherPicture(bytes));
    if (picture === null) {
        return null;
    }
    let { width, height } = picture;
    // A width the page gave the picture is kept, its height in proportion.
    if (source.width !== null && width > 0) {
        height = (height * source.width) / width;
        width = source.width;
    }
    const size = fitWordPictureSize(width, height, context.maxBox);
    return size === null ? null : { ...picture, ...size };
}

/** Whether `family` is named in `text` as a whole name, not inside another. */
function checkNamesFamily(text: string, family: string) {
    const isBoundary = (char: string | undefined) => {
        return char === undefined || !/[\w-]/.test(char);
    };
    let index = text.indexOf(family);
    while (index >= 0) {
        if (
            isBoundary(text[index - 1]) &&
            isBoundary(text[index + family.length])
        ) {
            return true;
        }
        index = text.indexOf(family, index + 1);
    }
    return false;
}

function readFontFaceUrl(rule: CSSFontFaceRule, baseUrl: string) {
    const match = /url\(\s*(["']?)([^"')]+)\1\s*\)/.exec(
        rule.style.getPropertyValue('src'),
    );
    if (match === null) {
        return null;
    }
    try {
        return new URL(match[2], baseUrl).href;
    } catch {
        return null;
    }
}

/**
 * The @font-face rules of the faces the diagrams name, each font file in
 * them as a `data:` address -- the regular weight, and the bold one only when
 * a diagram draws bold. Read once per export and let go with it.
 */
export async function genSvgFontCss(svgTextList: string[]) {
    if (svgTextList.length === 0) {
        return '';
    }
    const isBoldUsed = svgTextList.some((text) => {
        return /font-weight\s*[:=]\s*["']?\s*(?:bold|[6-9]00)/.test(text);
    });
    const dataUrlMap = new Map<string, string>();
    const seenFaceSet = new Set<string>();
    const ruleTextList: string[] = [];
    for (const styleSheet of Array.from(document.styleSheets)) {
        let ruleList: CSSRuleList;
        try {
            ruleList = styleSheet.cssRules;
        } catch {
            continue;
        }
        for (let index = 0; index < ruleList.length; index++) {
            const rule = ruleList[index];
            if (!(rule instanceof CSSFontFaceRule)) {
                continue;
            }
            const family = rule.style
                .getPropertyValue('font-family')
                .replaceAll(/["']/g, '')
                .trim();
            const style = rule.style.getPropertyValue('font-style') || 'normal';
            const weight =
                rule.style.getPropertyValue('font-weight') || 'normal';
            const isRegular = weight === 'normal' || weight === '400';
            const isBold = weight === 'bold' || weight === '700';
            const faceKey = `${family}|${isBold ? 'bold' : 'normal'}`;
            if (
                family === '' ||
                style !== 'normal' ||
                seenFaceSet.has(faceKey) ||
                !(isRegular || (isBold && isBoldUsed)) ||
                !svgTextList.some((text) => {
                    return checkNamesFamily(text, family);
                })
            ) {
                continue;
            }
            const url = readFontFaceUrl(
                rule,
                styleSheet.href ?? globalThis.location.href,
            );
            if (url === null) {
                continue;
            }
            let dataUrl = dataUrlMap.get(url);
            if (dataUrl === undefined) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        continue;
                    }
                    dataUrl = await readAsDataUrl(await response.blob());
                } catch {
                    continue;
                }
                dataUrlMap.set(url, dataUrl);
            }
            seenFaceSet.add(faceKey);
            ruleTextList.push(
                `@font-face{font-family:"${family}";src:url("${dataUrl}");` +
                    `font-weight:${weight};font-style:normal;}`,
            );
        }
    }
    return ruleTextList.join('');
}
