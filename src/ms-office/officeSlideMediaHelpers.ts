// A VIDEO or a SOUND put on a slide for `owa_office_edit` (2026-11-21, the
// goal _chatbot can change do everything on a given pptx_: "play this clip
// on slide 4"). The person's own file, attached to the chat, embedded the
// way PowerPoint 2010 and later embed one: a picture frame (`p:pic`) over a
// poster, naming the clip twice -- the old `a:videoFile` link every reader
// knows and the `p14:media` embed PowerPoint plays -- and nodes in the
// slide's timing tree, without which PowerPoint shows no play button.
//
// Pure, strings and bytes in and out: what the bytes are, read off their
// header and, for MP4 and MOV, a few boxes (nothing decoded or copied), a
// poster PNG made here, where the frame goes, its XML, and the timing nodes
// put in and taken out. The zip, relationships and content types are the
// caller's.
//
// The timing is written as PowerPoint writes it (a PowerPoint for Mac deck
// set to "Start: Automatically", and python-pptx's notes on a deck where
// PowerPoint added two clips "When Clicked On"): the media node
// (`p:video` / `p:audio` > `p:cMediaNode`), an interactive sequence that a
// click on the frame starts (`togglePause`), and for "Automatically" a play
// step (`playFrom(0.0)`) starting with the slide in the main sequence.
// Every other node of the tree -- the entrance animations
// `officeSlideAnimationHelpers` writes -- is kept byte for byte.

import {
    type ElementType,
    listChildElements,
    scanTags,
    unescapeXml,
} from './officeXmlEditHelpers';
import { escapeXMLAttribute } from './officeXmlHelpers';

export type OfficeMediaKindType = 'video' | 'audio';

export type OfficeMediaInfoType = {
    kind: OfficeMediaKindType;
    // as written into ppt/media, lower case
    extension: string;
    // what PowerPoint writes in [Content_Types].xml for that extension
    contentType: string;
    // a video's frame when its bytes say it, else 16:9; a sound's icon
    width: number;
    height: number;
};

export const OFFICE_MEDIA_REL_TYPE: {
    video: string;
    audio: string;
    media: string;
} = {
    video: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video',
    audio: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio',
    media: 'http://schemas.microsoft.com/office/2007/relationships/media',
};

const MEDIA_EXT_URI = '{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}';
const P14_NAMESPACE =
    'http://schemas.microsoft.com/office/powerpoint/2010/main';

// a video whose bytes give no size is taken as 16:9
const DEFAULT_VIDEO_SIZE = { width: 1920, height: 1080 };
const VIDEO_POSTER_SIZE = { width: 256, height: 144 };
const AUDIO_POSTER_SIDE = 128;
// a sound's icon: half an inch, a quarter inch off the corner
const AUDIO_ICON_SIDE = 457200;
const AUDIO_ICON_MARGIN = 228600;
// how much of the slide a video takes at most, either way
const VIDEO_FIT = 0.6;

type MediaFamilyType = 'iso' | 'mp3' | 'wav' | 'avi' | 'asf';

type MediaFormatType = {
    kind: OfficeMediaKindType;
    contentType: string;
    // how the bytes are told apart
    family: MediaFamilyType;
};

// What PowerPoint plays (Microsoft's "Video and audio file formats supported
// in PowerPoint"); mp4 is `video/mp4` as PowerPoint for Mac writes it, the
// rest as Windows registers them.
const MEDIA_FORMAT_MAP: Record<string, MediaFormatType> = {
    mp4: { kind: 'video', contentType: 'video/mp4', family: 'iso' },
    m4v: { kind: 'video', contentType: 'video/mp4', family: 'iso' },
    mov: { kind: 'video', contentType: 'video/quicktime', family: 'iso' },
    wmv: { kind: 'video', contentType: 'video/x-ms-wmv', family: 'asf' },
    avi: { kind: 'video', contentType: 'video/x-msvideo', family: 'avi' },
    mp3: { kind: 'audio', contentType: 'audio/mpeg', family: 'mp3' },
    m4a: { kind: 'audio', contentType: 'audio/mp4', family: 'iso' },
    wav: { kind: 'audio', contentType: 'audio/wav', family: 'wav' },
    wma: { kind: 'audio', contentType: 'audio/x-ms-wma', family: 'asf' },
};

// --- reading the bytes ---------------------------------------------------

function readUint32BigEndian(bytes: Uint8Array, at: number) {
    return (
        ((bytes[at] << 24) >>> 0) +
        (bytes[at + 1] << 16) +
        (bytes[at + 2] << 8) +
        bytes[at + 3]
    );
}

function readInt32BigEndian(bytes: Uint8Array, at: number) {
    return (
        (bytes[at] << 24) |
        (bytes[at + 1] << 16) |
        (bytes[at + 2] << 8) |
        bytes[at + 3]
    );
}

function readUint32LittleEndian(bytes: Uint8Array, at: number) {
    return (
        (bytes[at] |
            (bytes[at + 1] << 8) |
            (bytes[at + 2] << 16) |
            (bytes[at + 3] << 24)) >>>
        0
    );
}

function readText(bytes: Uint8Array, at: number, length: number) {
    let text = '';
    for (let index = 0; index < length; index++) {
        text += String.fromCharCode(bytes[at + index]);
    }
    return text;
}

function checkText(bytes: Uint8Array, at: number, text: string) {
    if (at < 0 || at + text.length > bytes.length) {
        return false;
    }
    for (let index = 0; index < text.length; index++) {
        if (bytes[at + index] !== text.charCodeAt(index)) {
            return false;
        }
    }
    return true;
}

// in ms; a day or more is a header that does not know
function toDurationMs(value: number) {
    return Number.isFinite(value) && value > 0 && value < 86400000
        ? Math.max(1, Math.round(value))
        : null;
}

type SizeType = { width: number; height: number };

type BoxType = { type: string; body: number; end: number };

/**
 * The MP4 / MOV boxes in `[from, to)`, as far as `budget` allows: one
 * running past `to` is cut at it, one shorter than its own header (or past
 * what a number holds) ends the walk -- a cut or hostile file can neither
 * loop it nor send it outside the bytes.
 */
function listIsoBoxes(
    bytes: Uint8Array,
    from: number,
    to: number,
    budget: { left: number },
) {
    const out: BoxType[] = [];
    let at = from;
    while (at + 8 <= to && budget.left > 0) {
        budget.left--;
        let size = readUint32BigEndian(bytes, at);
        let header = 8;
        if (size === 1) {
            // a 64-bit size follows: a big `mdat` is stepped over by it
            if (at + 16 > to) {
                break;
            }
            const high = readUint32BigEndian(bytes, at + 8);
            if (high > 0x1fffff) {
                break;
            }
            size = high * 0x100000000 + readUint32BigEndian(bytes, at + 12);
            header = 16;
        } else if (size === 0) {
            // to the end of what holds it
            size = to - at;
        }
        if (size < header) {
            break;
        }
        out.push({
            type: readText(bytes, at + 4, 4),
            body: at + header,
            end: Math.min(at + size, to),
        });
        at += size;
    }
    return out;
}

// the brands of a picture kept in the same box format (HEIC, AVIF, a
// camera's raw): an MP4 by its name, never a clip
const IMAGE_BRAND_SET = new Set([
    'heic',
    'heix',
    'hevc',
    'hevx',
    'heim',
    'heis',
    'mif1',
    'msf1',
    'avif',
    'avis',
    'crx ',
]);
// an old QuickTime movie may start without a `ftyp`
const QUICKTIME_FIRST_BOX_SET = new Set([
    'moov',
    'mdat',
    'wide',
    'free',
    'skip',
    'pnot',
]);

function checkIsIsoMedia(bytes: Uint8Array, isQuickTime: boolean) {
    if (bytes.length < 16) {
        return false;
    }
    const size = readUint32BigEndian(bytes, 0);
    const type = readText(bytes, 4, 4);
    if (type === 'ftyp') {
        return size >= 16 && !IMAGE_BRAND_SET.has(readText(bytes, 8, 4));
    }
    return (
        isQuickTime &&
        QUICKTIME_FIRST_BOX_SET.has(type) &&
        (size === 0 || size === 1 || size >= 8)
    );
}

// The track's frame (`tkhd` width and height, 16.16 fixed point), turned
// when its matrix turns it a quarter -- a phone held upright.
function readTkhdSize(bytes: Uint8Array, box: BoxType): SizeType | null {
    if (box.body >= box.end) {
        return null;
    }
    const isLong = bytes[box.body] === 1;
    const matrixAt = box.body + (isLong ? 52 : 40);
    const sizeAt = box.body + (isLong ? 88 : 76);
    if (sizeAt + 8 > box.end) {
        return null;
    }
    const width = Math.round(readUint32BigEndian(bytes, sizeAt) / 65536);
    const height = Math.round(readUint32BigEndian(bytes, sizeAt + 4) / 65536);
    if (width <= 0 || height <= 0) {
        return null;
    }
    // the matrix's a and b: a quarter turn has a = 0, b = +-1
    const isTurned =
        Math.abs(readInt32BigEndian(bytes, matrixAt + 4)) >
        Math.abs(readInt32BigEndian(bytes, matrixAt));
    return isTurned ? { width: height, height: width } : { width, height };
}

function readMvhdDurationMs(bytes: Uint8Array, box: BoxType) {
    if (box.body >= box.end) {
        return null;
    }
    const isLong = bytes[box.body] === 1;
    const at = box.body + (isLong ? 20 : 12);
    if (at + (isLong ? 12 : 8) > box.end) {
        return null;
    }
    const timescale = readUint32BigEndian(bytes, at);
    const duration = isLong
        ? readUint32BigEndian(bytes, at + 4) * 0x100000000 +
          readUint32BigEndian(bytes, at + 8)
        : readUint32BigEndian(bytes, at + 4);
    if (timescale === 0 || (!isLong && duration === 0xffffffff)) {
        return null;
    }
    return toDurationMs((duration / timescale) * 1000);
}

// moov > mvhd for how long, moov > trak > tkhd for the frame: the first
// track with a frame (a sound track's is 0 x 0)
function readIsoFacts(bytes: Uint8Array) {
    const budget = { left: 2048 };
    let size: SizeType | null = null;
    let durationMs: number | null = null;
    const moov = listIsoBoxes(bytes, 0, bytes.length, budget).find((box) => {
        return box.type === 'moov';
    });
    if (moov === undefined) {
        return { size, durationMs };
    }
    for (const box of listIsoBoxes(bytes, moov.body, moov.end, budget)) {
        if (box.type === 'mvhd' && durationMs === null) {
            durationMs = readMvhdDurationMs(bytes, box);
        } else if (box.type === 'trak' && size === null) {
            const tkhd = listIsoBoxes(bytes, box.body, box.end, budget).find(
                (child) => {
                    return child.type === 'tkhd';
                },
            );
            size = tkhd === undefined ? null : readTkhdSize(bytes, tkhd);
        }
    }
    return { size, durationMs };
}

// An MPEG audio frame header: the sync, then no reserved version, layer,
// bit rate or sample rate.
function checkIsMpegFrame(bytes: Uint8Array, at: number) {
    if (at + 4 > bytes.length || bytes[at] !== 0xff) {
        return false;
    }
    const second = bytes[at + 1];
    const third = bytes[at + 2];
    return (
        (second & 0xe0) === 0xe0 &&
        ((second >> 3) & 3) !== 1 &&
        ((second >> 1) & 3) !== 0 &&
        third >> 4 !== 15 &&
        ((third >> 2) & 3) !== 3
    );
}

// An ID3 tag, and an MPEG audio frame after it (within 4 KB of padding),
// or a frame at the start: a FLAC or an AAC carrying an ID3 tag is not one.
function checkIsMp3(bytes: Uint8Array) {
    if (!checkText(bytes, 0, 'ID3')) {
        return checkIsMpegFrame(bytes, 0);
    }
    if (bytes.length < 10) {
        return false;
    }
    const tagSize =
        ((bytes[6] & 0x7f) << 21) |
        ((bytes[7] & 0x7f) << 14) |
        ((bytes[8] & 0x7f) << 7) |
        (bytes[9] & 0x7f);
    const from = 10 + tagSize + ((bytes[5] & 0x10) !== 0 ? 10 : 0);
    const last = Math.min(bytes.length - 4, from + 4096);
    for (let at = from; at <= last; at++) {
        if (checkIsMpegFrame(bytes, at)) {
            return true;
        }
    }
    return false;
}

// RIFF chunks are a 4-letter id, a little-endian length, and the bytes,
// padded to an even length
function readRiffChunkEnd(bytes: Uint8Array, at: number) {
    const length = readUint32LittleEndian(bytes, at + 4);
    return at + 8 + length + (length % 2);
}

function readWavDurationMs(bytes: Uint8Array) {
    let byteRate = 0;
    let at = 12;
    for (let count = 0; count < 64 && at + 8 <= bytes.length; count++) {
        if (checkText(bytes, at, 'fmt ') && at + 20 <= bytes.length) {
            byteRate = readUint32LittleEndian(bytes, at + 16);
        } else if (checkText(bytes, at, 'data')) {
            const length = Math.min(
                readUint32LittleEndian(bytes, at + 4),
                bytes.length - at - 8,
            );
            return byteRate > 0
                ? toDurationMs((length / byteRate) * 1000)
                : null;
        }
        at = readRiffChunkEnd(bytes, at);
    }
    return null;
}

// RIFF 'AVI ' > LIST 'hdrl' > 'avih', the main header: the time a frame
// shows (in microseconds), the frame count, then the frame's size
function readAviFacts(bytes: Uint8Array) {
    const none = { size: null, durationMs: null };
    if (!checkText(bytes, 12, 'LIST') || !checkText(bytes, 20, 'hdrl')) {
        return none;
    }
    const end = Math.min(bytes.length, 20 + readUint32LittleEndian(bytes, 16));
    let at = 24;
    for (let count = 0; count < 32 && at + 8 <= end; count++) {
        if (checkText(bytes, at, 'avih')) {
            const body = at + 8;
            if (body + 40 > bytes.length) {
                return none;
            }
            const width = readUint32LittleEndian(bytes, body + 32);
            const height = readUint32LittleEndian(bytes, body + 36);
            const isSized =
                width > 0 && height > 0 && width <= 65535 && height <= 65535;
            return {
                size: isSized ? { width, height } : null,
                durationMs: toDurationMs(
                    (readUint32LittleEndian(bytes, body) *
                        readUint32LittleEndian(bytes, body + 16)) /
                        1000,
                ),
            };
        }
        at = readRiffChunkEnd(bytes, at);
    }
    return none;
}

// the ASF header object's GUID, what every WMV and WMA starts with
const ASF_HEADER_GUID = [
    0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa,
    0x00, 0x62, 0xce, 0x6c,
];

function checkIsFamily(
    bytes: Uint8Array,
    family: MediaFamilyType,
    extension: string,
) {
    switch (family) {
        case 'iso':
            return checkIsIsoMedia(bytes, extension === 'mov');
        case 'mp3':
            return checkIsMp3(bytes);
        case 'wav':
            return (
                (checkText(bytes, 0, 'RIFF') || checkText(bytes, 0, 'RF64')) &&
                checkText(bytes, 8, 'WAVE')
            );
        case 'avi':
            return checkText(bytes, 0, 'RIFF') && checkText(bytes, 8, 'AVI ');
        case 'asf':
            return ASF_HEADER_GUID.every((value, index) => {
                return bytes[index] === value;
            });
    }
}

function readExtension(name: string) {
    const base = name.split(/[\\/]/).pop() ?? '';
    const dot = base.lastIndexOf('.');
    return dot < 0 ? '' : base.slice(dot + 1).toLowerCase();
}

// the file's format, when its name is one PowerPoint plays AND its bytes
// are that format
function readMediaFormat(name: string, bytes: Uint8Array) {
    const extension = readExtension(name);
    if (!Object.hasOwn(MEDIA_FORMAT_MAP, extension)) {
        return null;
    }
    const format = MEDIA_FORMAT_MAP[extension];
    return checkIsFamily(bytes, format.family, extension)
        ? { extension, ...format }
        : null;
}

/**
 * A video or a sound PowerPoint plays -- MP4, M4V, MOV, WMV, AVI, MP3,
 * M4A, WAV or WMA -- by its name AND its bytes (a renamed file of another
 * kind is null), with a video's frame size where its header says it (an
 * MP4 / MOV track's `tkhd`, an AVI's main header), else 16:9; a sound's
 * size is its square icon's.
 */
export function readOfficeMediaInfo(
    name: string,
    bytes: Uint8Array,
): OfficeMediaInfoType | null {
    const format = readMediaFormat(name, bytes);
    if (format === null) {
        return null;
    }
    const { kind, extension, contentType } = format;
    if (kind === 'audio') {
        return {
            kind,
            extension,
            contentType,
            width: AUDIO_POSTER_SIDE,
            height: AUDIO_POSTER_SIDE,
        };
    }
    let size: SizeType | null = null;
    if (format.family === 'iso') {
        size = readIsoFacts(bytes).size;
    } else if (format.family === 'avi') {
        size = readAviFacts(bytes).size;
    }
    return { kind, extension, contentType, ...(size ?? DEFAULT_VIDEO_SIZE) };
}

/**
 * How long the clip plays, in ms, where its header says it (MP4, M4V,
 * MOV, M4A, WAV, AVI), else null: what PowerPoint writes as the length of
 * an "Automatically" play step (`addMediaTimingXml`'s `durationMs`).
 */
export function readOfficeMediaDurationMs(
    name: string,
    bytes: Uint8Array,
): number | null {
    const format = readMediaFormat(name, bytes);
    if (format === null) {
        return null;
    }
    switch (format.family) {
        case 'iso':
            return readIsoFacts(bytes).durationMs;
        case 'wav':
            return readWavDurationMs(bytes);
        case 'avi':
            return readAviFacts(bytes).durationMs;
        default:
            return null;
    }
}

// --- the poster ----------------------------------------------------------

function genCrcTable() {
    const table = new Uint32Array(256);
    for (let value = 0; value < 256; value++) {
        let crc = value;
        for (let bit = 0; bit < 8; bit++) {
            crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
        table[value] = crc >>> 0;
    }
    return table;
}

function writeUint32BigEndian(bytes: Uint8Array, at: number, value: number) {
    bytes[at] = (value >>> 24) & 0xff;
    bytes[at + 1] = (value >>> 16) & 0xff;
    bytes[at + 2] = (value >>> 8) & 0xff;
    bytes[at + 3] = value & 0xff;
}

// A zlib stream of STORED deflate blocks: a poster of a few KB needs no
// compressor, and none is brought in for it.
function genStoredZlib(raw: Uint8Array) {
    const blockCount = Math.max(1, Math.ceil(raw.length / 65535));
    const out = new Uint8Array(2 + blockCount * 5 + raw.length + 4);
    // deflate, a 32K window, no dictionary; 0x7801 is a multiple of 31
    out[0] = 0x78;
    out[1] = 0x01;
    let at = 2;
    for (let block = 0; block < blockCount; block++) {
        const from = block * 65535;
        const length = Math.min(65535, raw.length - from);
        out[at] = block === blockCount - 1 ? 1 : 0;
        out[at + 1] = length & 0xff;
        out[at + 2] = (length >>> 8) & 0xff;
        out[at + 3] = ~length & 0xff;
        out[at + 4] = (~length >>> 8) & 0xff;
        out.set(raw.subarray(from, from + length), at + 5);
        at += 5 + length;
    }
    let low = 1;
    let high = 0;
    for (const value of raw) {
        low = (low + value) % 65521;
        high = (high + low) % 65521;
    }
    writeUint32BigEndian(out, at, ((high << 16) | low) >>> 0);
    return out;
}

/**
 * A two-colour (1 bit, palette) PNG of `width` x `height`, a pixel inked
 * where `checkIsInk` says at its centre.
 */
function genTwoColourPng(
    width: number,
    height: number,
    palette: number[],
    checkIsInk: (x: number, y: number) => boolean,
) {
    const rowLength = 1 + Math.ceil(width / 8);
    // each row starts with its filter, 0 (none)
    const raw = new Uint8Array(rowLength * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (checkIsInk(x + 0.5, y + 0.5)) {
                raw[y * rowLength + 1 + (x >> 3)] |= 0x80 >> (x & 7);
            }
        }
    }
    const header = new Uint8Array(13);
    writeUint32BigEndian(header, 0, width);
    writeUint32BigEndian(header, 4, height);
    // 1 bit, palette, deflate, no filter method, no interlace
    header.set([1, 3, 0, 0, 0], 8);
    const chunks: [string, Uint8Array][] = [
        ['IHDR', header],
        ['PLTE', Uint8Array.from(palette)],
        ['IDAT', genStoredZlib(raw)],
        ['IEND', new Uint8Array(0)],
    ];
    const total = chunks.reduce((sum, [, data]) => {
        return sum + 12 + data.length;
    }, 8);
    const out = new Uint8Array(total);
    out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const table = genCrcTable();
    let at = 8;
    for (const [type, data] of chunks) {
        writeUint32BigEndian(out, at, data.length);
        for (let index = 0; index < 4; index++) {
            out[at + 4 + index] = type.charCodeAt(index);
        }
        out.set(data, at + 8);
        // the CRC covers the type and the data
        let crc = 0xffffffff;
        for (let index = at + 4; index < at + 8 + data.length; index++) {
            crc = table[(crc ^ out[index]) & 0xff] ^ (crc >>> 8);
        }
        writeUint32BigEndian(
            out,
            at + 8 + data.length,
            (crc ^ 0xffffffff) >>> 0,
        );
        at += 12 + data.length;
    }
    return out;
}

const POSTER_PALETTE = [0x20, 0x20, 0x20, 0xd9, 0xd9, 0xd9];

// a ring and a play triangle pointing right, its centroid on the centre
function checkIsVideoInk(x: number, y: number) {
    const centreX = VIDEO_POSTER_SIZE.width / 2;
    const centreY = VIDEO_POSTER_SIZE.height / 2;
    if (Math.abs(Math.hypot(x - centreX, y - centreY) - 44) <= 2.5) {
        return true;
    }
    const left = centreX - 12;
    const right = centreX + 24;
    return (
        x >= left &&
        x <= right &&
        Math.abs(y - centreY) <= ((right - x) / (right - left)) * 20.8
    );
}

// a speaker: its magnet, its cone, and two waves coming off it
function checkIsAudioInk(x: number, y: number) {
    const u = x / AUDIO_POSTER_SIDE;
    const v = y / AUDIO_POSTER_SIDE;
    const off = Math.abs(v - 0.5);
    if (u >= 0.2 && u <= 0.34 && off <= 0.1) {
        return true;
    }
    if (u >= 0.34 && u <= 0.54 && off <= 0.1 + (u - 0.34)) {
        return true;
    }
    const distance = Math.hypot(u - 0.54, v - 0.5);
    return (
        u > 0.56 &&
        u - 0.54 >= distance * 0.67 &&
        (Math.abs(distance - 0.14) <= 0.025 ||
            Math.abs(distance - 0.26) <= 0.025)
    );
}

/**
 * The poster frame shown while the clip is not playing: a dark 16:9 frame
 * with a play button for a video, a speaker for a sound -- a PNG of a few
 * KB made here, the same bytes every time.
 */
export function genMediaPosterPng(kind: OfficeMediaKindType): Uint8Array {
    return kind === 'audio'
        ? genTwoColourPng(
              AUDIO_POSTER_SIDE,
              AUDIO_POSTER_SIDE,
              POSTER_PALETTE,
              checkIsAudioInk,
          )
        : genTwoColourPng(
              VIDEO_POSTER_SIZE.width,
              VIDEO_POSTER_SIZE.height,
              POSTER_PALETTE,
              checkIsVideoInk,
          );
}

// --- the frame -----------------------------------------------------------

/**
 * Where a new clip goes, in EMU: a video centred, its own shape kept, in
 * three fifths of the slide each way; a sound a half-inch square icon in
 * the bottom-right corner, a quarter inch off it.
 */
export function fitMediaBox(
    info: OfficeMediaInfoType,
    size: { cx: number; cy: number },
): { x: number; y: number; cx: number; cy: number } {
    if (info.kind === 'audio') {
        const side = Math.max(
            1,
            Math.round(Math.min(AUDIO_ICON_SIDE, size.cx / 4, size.cy / 4)),
        );
        const margin = Math.round(Math.min(AUDIO_ICON_MARGIN, side / 2));
        return {
            x: size.cx - side - margin,
            y: size.cy - side - margin,
            cx: side,
            cy: side,
        };
    }
    const ratio =
        info.width > 0 && info.height > 0
            ? info.width / info.height
            : DEFAULT_VIDEO_SIZE.width / DEFAULT_VIDEO_SIZE.height;
    const cx = Math.min(size.cx * VIDEO_FIT, size.cy * VIDEO_FIT * ratio);
    const cy = cx / ratio;
    return {
        x: Math.round((size.cx - cx) / 2),
        y: Math.round((size.cy - cy) / 2),
        cx: Math.max(1, Math.round(cx)),
        cy: Math.max(1, Math.round(cy)),
    };
}

/**
 * The clip's `<p:pic>` as PowerPoint 2010+ writes an embedded movie or
 * sound: a click on it plays it (`ppaction://media`), the old link
 * (`a:videoFile` / `a:audioFile`, `linkRelId`) and the embed PowerPoint
 * plays (`p14:media`, `mediaRelId`, its prefix declared on it), over the
 * poster (`posterRelId`). The slide's root declares `a`, `r` and `p`.
 */
export function genMediaPicXml(options: {
    shapeId: string | number;
    name: string;
    description: string;
    kind: OfficeMediaKindType;
    linkRelId: string;
    mediaRelId: string;
    posterRelId: string;
    place: { x: number; y: number; cx: number; cy: number };
}): string {
    const { kind, place } = options;
    const fileTag = kind === 'audio' ? 'a:audioFile' : 'a:videoFile';
    const value = (text: string | number) => {
        return escapeXMLAttribute(String(text));
    };
    return (
        '<p:pic><p:nvPicPr>' +
        `<p:cNvPr id="${value(options.shapeId)}" name="${value(options.name)}" ` +
        `descr="${value(options.description)}">` +
        '<a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr>' +
        '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr>' +
        `<${fileTag} r:link="${value(options.linkRelId)}"/>` +
        `<p:extLst><p:ext uri="${MEDIA_EXT_URI}">` +
        `<p14:media xmlns:p14="${P14_NAMESPACE}" ` +
        `r:embed="${value(options.mediaRelId)}"/></p:ext></p:extLst>` +
        '</p:nvPr></p:nvPicPr>' +
        `<p:blipFill><a:blip r:embed="${value(options.posterRelId)}"/>` +
        '<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm>' +
        `<a:off x="${Math.round(place.x)}" y="${Math.round(place.y)}"/>` +
        `<a:ext cx="${Math.round(place.cx)}" cy="${Math.round(place.cy)}"/>` +
        '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
        '</p:pic>'
    );
}

// --- the timing tree -----------------------------------------------------

function readAttribute(attributes: string, name: string) {
    const matched = new RegExp(
        `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    ).exec(attributes);
    if (matched === null) {
        return null;
    }
    return unescapeXml(matched[1] ?? matched[2] ?? '');
}

function checkIsSelfClosing(element: ElementType) {
    return element.openEnd === element.end;
}

function listChildren(xml: string, parent: ElementType) {
    return checkIsSelfClosing(parent)
        ? []
        : listChildElements(xml, parent.openEnd, parent.closeStart);
}

function findChild(xml: string, parent: ElementType | null, name: string) {
    if (parent === null) {
        return null;
    }
    return (
        listChildren(xml, parent).find((child) => {
            return child.name === name;
        }) ?? null
    );
}

function readOpenTag(xml: string, element: ElementType) {
    return xml.slice(element.start, element.openEnd);
}

/**
 * `childXml` put into `parent`: before its first child named in `before`
 * (null: before every child), else last. A parent closing itself is opened.
 */
function insertChildXml(
    xml: string,
    parent: ElementType,
    childXml: string,
    before: string[] | null,
) {
    if (checkIsSelfClosing(parent)) {
        const tag = readOpenTag(xml, parent).replace(/\s*\/>$/, '>');
        return (
            xml.slice(0, parent.start) +
            tag +
            childXml +
            `</${parent.name}>` +
            xml.slice(parent.end)
        );
    }
    const children = listChildren(xml, parent);
    const next =
        before === null
            ? children[0]
            : children.find((child) => {
                  return before.includes(child.name);
              });
    const at = next?.start ?? parent.closeStart;
    return xml.slice(0, at) + childXml + xml.slice(at);
}

// whether a `p:spTgt` inside `element` names the shape
function checkTargets(xml: string, element: ElementType, spid: string) {
    for (const tag of scanTags(xml, element.start, element.end)) {
        if (
            tag.name === 'p:spTgt' &&
            !tag.isClose &&
            readAttribute(tag.attributes, 'spid') === spid
        ) {
            return true;
        }
    }
    return false;
}

// `timingXml` is one `p:timing` element
function readTimingFrame(timingXml: string) {
    const timing =
        listChildElements(timingXml, 0, timingXml.length).find((child) => {
            return child.name === 'p:timing';
        }) ?? null;
    const tnLst = findChild(timingXml, timing, 'p:tnLst');
    const root = findChild(timingXml, tnLst, 'p:par');
    const rootTn = findChild(timingXml, root, 'p:cTn');
    const rootList = findChild(timingXml, rootTn, 'p:childTnLst');
    return { timing, tnLst, root, rootTn, rootList };
}

// the node a `p:par` or `p:seq` times, and the list of its children
function readTimeNode(xml: string, element: ElementType) {
    const cTn = findChild(xml, element, 'p:cTn');
    const list = findChild(xml, cTn, 'p:childTnLst');
    return {
        cTn,
        list: list === null || checkIsSelfClosing(list) ? null : list,
    };
}

function readNodeType(xml: string, element: ElementType) {
    const { cTn } = readTimeNode(xml, element);
    return cTn === null
        ? null
        : readAttribute(readOpenTag(xml, cTn), 'nodeType');
}

function findMainSeq(xml: string, rootList: ElementType) {
    return (
        listChildren(xml, rootList).find((child) => {
            return (
                child.name === 'p:seq' && readNodeType(xml, child) === 'mainSeq'
            );
        }) ?? null
    );
}

// a group of the main sequence starting with the slide, not on a click
function checkIsAutoGroup(xml: string, group: ElementType) {
    const { cTn } = readTimeNode(xml, group);
    const conditions = findChild(xml, cTn, 'p:stCondLst');
    return (
        conditions !== null &&
        /\sevt="onBegin"/.test(xml.slice(conditions.start, conditions.end))
    );
}

function readMaxTimeNodeId(xml: string) {
    let max = 0;
    for (const tag of scanTags(xml)) {
        if (tag.name === 'p:cTn' && !tag.isClose) {
            const id = Number(readAttribute(tag.attributes, 'id'));
            if (Number.isInteger(id) && id > max) {
                max = id;
            }
        }
    }
    return max;
}

type IdSourceType = () => string;

const SLIDE_CONDITIONS =
    '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/>' +
    '</p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond ' +
    'evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>' +
    '</p:nextCondLst>';

function genTargetXml(spid: string) {
    return `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;
}

// what makes PowerPoint show the play bar and play the clip at all
function genMediaNodeXml(
    kind: OfficeMediaKindType,
    spid: string,
    nextId: IdSourceType,
) {
    const tag = kind === 'audio' ? 'p:audio' : 'p:video';
    return (
        `<${tag}><p:cMediaNode vol="80000"><p:cTn id="${nextId()}" ` +
        'fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/>' +
        `</p:stCondLst></p:cTn>${genTargetXml(spid)}</p:cMediaNode></${tag}>`
    );
}

// "When Clicked On": a sequence a click on the frame starts, pausing and
// resuming the clip
function genToggleSeqXml(spid: string, nextId: IdSourceType) {
    const click = `<p:cond evt="onClick" delay="0">${genTargetXml(spid)}</p:cond>`;
    const seqId = nextId();
    const groupId = nextId();
    const stepId = nextId();
    const effectId = nextId();
    const commandId = nextId();
    return (
        `<p:seq concurrent="1" nextAc="seek"><p:cTn id="${seqId}" ` +
        'restart="whenNotActive" fill="hold" evtFilter="cancelBubble" ' +
        `nodeType="interactiveSeq"><p:stCondLst>${click}</p:stCondLst>` +
        '<p:endSync evt="end" delay="0"><p:rtn val="all"/></p:endSync>' +
        `<p:childTnLst><p:par><p:cTn id="${groupId}" fill="hold">` +
        '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
        `<p:par><p:cTn id="${stepId}" fill="hold"><p:stCondLst>` +
        '<p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
        `<p:par><p:cTn id="${effectId}" presetID="2" ` +
        'presetClass="mediacall" presetSubtype="0" fill="hold" ' +
        'nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/>' +
        '</p:stCondLst><p:childTnLst><p:cmd type="call" cmd="togglePause">' +
        `<p:cBhvr><p:cTn id="${commandId}" dur="1" fill="hold"/>` +
        `${genTargetXml(spid)}</p:cBhvr></p:cmd></p:childTnLst></p:cTn>` +
        '</p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>' +
        '</p:par></p:childTnLst></p:cTn>' +
        `<p:nextCondLst>${click}</p:nextCondLst></p:seq>`
    );
}

// the play step of "Automatically": the clip from its start, for its length
function genPlayEffectXml(
    spid: string,
    nodeType: string,
    length: string,
    nextId: IdSourceType,
) {
    const effectId = nextId();
    const commandId = nextId();
    return (
        `<p:par><p:cTn id="${effectId}" presetID="1" presetClass="mediacall" ` +
        `presetSubtype="0" fill="hold" nodeType="${nodeType}"><p:stCondLst>` +
        '<p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" ' +
        `cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="${commandId}" ` +
        `dur="${length}" fill="hold"/>${genTargetXml(spid)}</p:cBhvr>` +
        '</p:cmd></p:childTnLst></p:cTn></p:par>'
    );
}

// a group of the main sequence that starts with the slide, its one step
function genAutoGroupXml(
    mainSeqId: string,
    spid: string,
    length: string,
    nextId: IdSourceType,
) {
    const groupId = nextId();
    const stepId = nextId();
    return (
        `<p:par><p:cTn id="${groupId}" fill="hold"><p:stCondLst>` +
        '<p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0">' +
        `<p:tn val="${mainSeqId}"/></p:cond></p:stCondLst><p:childTnLst>` +
        `<p:par><p:cTn id="${stepId}" fill="hold"><p:stCondLst>` +
        '<p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
        genPlayEffectXml(spid, 'afterEffect', length, nextId) +
        '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
    );
}

function genMainSeqXml(spid: string, length: string, nextId: IdSourceType) {
    const mainSeqId = nextId();
    return (
        `<p:seq concurrent="1" nextAc="seek"><p:cTn id="${mainSeqId}" ` +
        'dur="indefinite" nodeType="mainSeq"><p:childTnLst>' +
        genAutoGroupXml(mainSeqId, spid, length, nextId) +
        `</p:childTnLst></p:cTn>${SLIDE_CONDITIONS}</p:seq>`
    );
}

/**
 * The play step put in an existing main sequence: with the slide's own
 * first step when its first group starts with the slide, else a group of
 * its own before every click. Null when that group is not laid out as
 * PowerPoint lays one out.
 */
function insertAutoPlay(
    xml: string,
    mainSeq: ElementType,
    spid: string,
    length: string,
    nextId: IdSourceType,
) {
    const { cTn } = readTimeNode(xml, mainSeq);
    if (cTn === null) {
        return null;
    }
    const mainSeqId = readAttribute(readOpenTag(xml, cTn), 'id') ?? '';
    const list = findChild(xml, cTn, 'p:childTnLst');
    if (list === null || checkIsSelfClosing(list)) {
        const groupXml = genAutoGroupXml(mainSeqId, spid, length, nextId);
        return list === null
            ? insertChildXml(
                  xml,
                  cTn,
                  `<p:childTnLst>${groupXml}</p:childTnLst>`,
                  ['p:subTnLst'],
              )
            : insertChildXml(xml, list, groupXml, null);
    }
    const first = listChildren(xml, list)[0];
    if (first === undefined || !checkIsAutoGroup(xml, first)) {
        return insertChildXml(
            xml,
            list,
            genAutoGroupXml(mainSeqId, spid, length, nextId),
            null,
        );
    }
    const groupList = readTimeNode(xml, first).list;
    const step =
        groupList === null ? undefined : listChildren(xml, groupList)[0];
    const stepList = step === undefined ? null : readTimeNode(xml, step).list;
    if (step === undefined || step.name !== 'p:par' || stepList === null) {
        return null;
    }
    return insertChildXml(
        xml,
        stepList,
        genPlayEffectXml(spid, 'withEffect', length, nextId),
        [],
    );
}

/** One `p:timing` with the clip's nodes added, or null when unreadable. */
function addTimingNodes(
    timingXml: string,
    spid: string,
    kind: OfficeMediaKindType,
    isAuto: boolean,
    length: string,
) {
    let next = readMaxTimeNodeId(timingXml) + 1;
    const nextId = () => {
        return String(next++);
    };
    let xml = timingXml;
    let frame = readTimingFrame(xml);
    if (
        frame.timing === null ||
        (frame.root !== null && frame.rootTn === null)
    ) {
        return null;
    }
    // a root made here is numbered first, as PowerPoint numbers it
    const rootId = frame.rootTn === null ? nextId() : '';
    let lead = '';
    if (isAuto) {
        const mainSeq =
            frame.rootList === null ? null : findMainSeq(xml, frame.rootList);
        if (mainSeq === null) {
            lead = genMainSeqXml(spid, length, nextId);
        } else {
            const inserted = insertAutoPlay(xml, mainSeq, spid, length, nextId);
            if (inserted === null) {
                return null;
            }
            xml = inserted;
            frame = readTimingFrame(xml);
        }
    }
    const tail =
        genMediaNodeXml(kind, spid, nextId) + genToggleSeqXml(spid, nextId);
    const { rootList } = frame;
    if (rootList !== null) {
        if (checkIsSelfClosing(rootList)) {
            return insertChildXml(xml, rootList, lead + tail, null);
        }
        // a new main sequence goes first, the media after everything
        const withTail =
            xml.slice(0, rootList.closeStart) +
            tail +
            xml.slice(rootList.closeStart);
        return (
            withTail.slice(0, rootList.openEnd) +
            lead +
            withTail.slice(rootList.openEnd)
        );
    }
    const listXml = `<p:childTnLst>${lead}${tail}</p:childTnLst>`;
    if (frame.rootTn !== null) {
        return insertChildXml(xml, frame.rootTn, listXml, ['p:subTnLst']);
    }
    const rootXml =
        `<p:par><p:cTn id="${rootId}" dur="indefinite" restart="never" ` +
        `nodeType="tmRoot">${listXml}</p:cTn></p:par>`;
    if (frame.tnLst !== null) {
        return insertChildXml(xml, frame.tnLst, rootXml, null);
    }
    return insertChildXml(
        xml,
        frame.timing as ElementType,
        `<p:tnLst>${rootXml}</p:tnLst>`,
        null,
    );
}

// --- taking nodes out ----------------------------------------------------

type EditType = { start: number; end: number; text: string };

function genCut(element: ElementType): EditType {
    return { start: element.start, end: element.end, text: '' };
}

function applyEdits(xml: string, edits: EditType[]) {
    let out = xml;
    for (const edit of [...edits].sort((a, b) => {
        return b.start - a.start;
    })) {
        out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    }
    return out;
}

// A step's start (its first condition's delay) and where that number is.
function readStepDelay(xml: string, step: ElementType) {
    const { cTn } = readTimeNode(xml, step);
    const conditions = findChild(xml, cTn, 'p:stCondLst');
    const first =
        conditions === null ? undefined : listChildren(xml, conditions)[0];
    if (first === undefined) {
        return null;
    }
    const tag = readOpenTag(xml, first);
    const matched = /\sdelay="(\d+)"/.exec(tag);
    if (matched === null) {
        return null;
    }
    const start = first.start + matched.index + matched[0].indexOf('"') + 1;
    return {
        value: Number(matched[1]),
        start,
        end: start + matched[1].length,
    };
}

// An effect's node made the first of a click: `nodeType="clickEffect"`.
function genClickEffectEdit(xml: string, effect: ElementType): EditType | null {
    const { cTn } = readTimeNode(xml, effect);
    if (cTn === null) {
        return null;
    }
    const tag = readOpenTag(xml, cTn);
    const matched = /\snodeType="([^"]*)"/.exec(tag);
    if (matched !== null) {
        if (matched[1] === 'clickEffect') {
            return null;
        }
        const start = cTn.start + matched.index;
        return {
            start,
            end: start + matched[0].length,
            text: ' nodeType="clickEffect"',
        };
    }
    const end = cTn.start + tag.replace(/\s*\/?>$/, '').length;
    return { start: end, end, text: ' nodeType="clickEffect"' };
}

/**
 * A group of a sequence with the effects `checkGoes` picks taken out: a
 * step left empty goes and the steps after it move up by its time; a
 * click's group whose first effect went starts with the next one on that
 * click. Null when nothing in it goes.
 */
function takeGroupEffects(
    xml: string,
    group: ElementType,
    checkGoes: (element: ElementType) => boolean,
) {
    const groupList = readTimeNode(xml, group).list;
    if (group.name !== 'p:par' || groupList === null) {
        return checkGoes(group) ? { edits: [], isEmpty: true } : null;
    }
    const steps = listChildren(xml, groupList);
    const edits: EditType[] = [];
    let isChanged = false;
    let isFirstGone = false;
    let newFirst: ElementType | null = null;
    let keptCount = 0;
    let shift = 0;
    for (let index = 0; index < steps.length; index++) {
        const step = steps[index];
        const stepList = readTimeNode(xml, step).list;
        const effects =
            step.name === 'p:par' && stepList !== null
                ? listChildren(xml, stepList)
                : [step];
        const gone = effects.filter(checkGoes);
        const delay = readStepDelay(xml, step);
        if (gone.length > 0 && gone.length === effects.length) {
            isChanged = true;
            edits.push(genCut(step));
            isFirstGone = isFirstGone || index === 0;
            const nextDelay =
                index + 1 < steps.length
                    ? readStepDelay(xml, steps[index + 1])
                    : null;
            if (delay !== null && nextDelay !== null) {
                shift += Math.max(0, nextDelay.value - delay.value);
            }
            continue;
        }
        if (gone.length > 0) {
            isChanged = true;
            edits.push(...gone.map(genCut));
            isFirstGone =
                isFirstGone || (index === 0 && gone[0] === effects[0]);
        }
        if (keptCount === 0 && isFirstGone && stepList !== null) {
            newFirst =
                effects.find((effect) => {
                    return !gone.includes(effect);
                }) ?? null;
        }
        keptCount++;
        if (shift > 0 && delay !== null) {
            edits.push({
                start: delay.start,
                end: delay.end,
                text: String(Math.max(0, delay.value - shift)),
            });
        }
    }
    if (!isChanged) {
        return null;
    }
    if (keptCount === 0) {
        return { edits: [], isEmpty: true };
    }
    if (newFirst !== null && !checkIsAutoGroup(xml, group)) {
        const edit = genClickEffectEdit(xml, newFirst);
        if (edit !== null) {
            edits.push(edit);
        }
    }
    return { edits, isEmpty: false };
}

/** The groups of a sequence's list with `checkGoes`'s effects taken out. */
function takeSeqEffects(
    xml: string,
    list: ElementType,
    checkGoes: (element: ElementType) => boolean,
) {
    const edits: EditType[] = [];
    let keptCount = 0;
    let isChanged = false;
    for (const group of listChildren(xml, list)) {
        const taken = takeGroupEffects(xml, group, checkGoes);
        if (taken === null) {
            keptCount++;
            continue;
        }
        isChanged = true;
        if (taken.isEmpty) {
            edits.push(genCut(group));
            continue;
        }
        keptCount++;
        edits.push(...taken.edits);
    }
    return { edits, isChanged, isEmpty: keptCount === 0 };
}

/** Nothing left but an empty main sequence: the timing can go. */
function checkIsEmptyTiming(xml: string) {
    const { rootList } = readTimingFrame(xml);
    const nodes = rootList === null ? [] : listChildren(xml, rootList);
    return nodes.every((node) => {
        return (
            node.name === 'p:seq' &&
            readNodeType(xml, node) === 'mainSeq' &&
            readTimeNode(xml, node).list === null
        );
    });
}

/**
 * One `p:timing` without the shape's media nodes -- and, `isWholeShape`,
 * without every node naming it -- '' when nothing is left in it.
 */
function dropTimingNodes(
    timingXml: string,
    spid: string,
    isWholeShape: boolean,
) {
    const frame = readTimingFrame(timingXml);
    if (frame.timing === null) {
        return timingXml;
    }
    const xml = timingXml;
    const checkGoes = (element: ElementType) => {
        if (!checkTargets(xml, element, spid)) {
            return false;
        }
        if (isWholeShape) {
            return true;
        }
        const { cTn } = readTimeNode(xml, element);
        return (
            cTn !== null &&
            readAttribute(readOpenTag(xml, cTn), 'presetClass') === 'mediacall'
        );
    };
    const edits: EditType[] = [];
    for (const node of frame.rootList === null
        ? []
        : listChildren(xml, frame.rootList)) {
        if (node.name === 'p:video' || node.name === 'p:audio') {
            if (checkTargets(xml, node, spid)) {
                edits.push(genCut(node));
            }
            continue;
        }
        if (node.name !== 'p:seq') {
            if (isWholeShape && checkTargets(xml, node, spid)) {
                edits.push(genCut(node));
            }
            continue;
        }
        const { cTn, list } = readTimeNode(xml, node);
        const isMain = readNodeType(xml, node) === 'mainSeq';
        const trigger = findChild(xml, cTn, 'p:stCondLst');
        // a sequence the shape's own click starts has nothing to start it
        if (
            isWholeShape &&
            !isMain &&
            trigger !== null &&
            checkTargets(xml, trigger, spid)
        ) {
            edits.push(genCut(node));
            continue;
        }
        if (list === null) {
            continue;
        }
        const taken = takeSeqEffects(xml, list, checkGoes);
        if (!taken.isChanged) {
            continue;
        }
        if (!taken.isEmpty) {
            edits.push(...taken.edits);
        } else {
            // an empty time list is not allowed: the main sequence keeps
            // its shell, another sequence goes
            edits.push(genCut(isMain ? list : node));
        }
    }
    const buildList = isWholeShape
        ? findChild(xml, frame.timing, 'p:bldLst')
        : null;
    if (buildList !== null) {
        const builds = listChildren(xml, buildList);
        const gone = builds.filter((build) => {
            return readAttribute(readOpenTag(xml, build), 'spid') === spid;
        });
        if (gone.length > 0 && gone.length === builds.length) {
            edits.push(genCut(buildList));
        } else {
            edits.push(...gone.map(genCut));
        }
    }
    if (edits.length === 0) {
        return timingXml;
    }
    const edited = applyEdits(xml, edits);
    return checkIsEmptyTiming(edited) ? '' : edited;
}

// --- the slide -----------------------------------------------------------

// `p:sld`'s own children; `p:cSld` holds an `p:extLst` of its own.
function readSlideChildren(slideXml: string) {
    const open = /<p:sld\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/.exec(slideXml);
    const closeStart = slideXml.lastIndexOf('</p:sld>');
    if (open === null || open[1] === '/' || closeStart < 0) {
        return null;
    }
    return {
        closeStart,
        children: listChildElements(
            slideXml,
            open.index + open[0].length,
            closeStart,
        ),
    };
}

// The slide's `p:timing`, or both copies Office keeps of one in an
// `mc:AlternateContent` (the newer reader's and the fallback, in order).
function listTimingCopies(slideXml: string, children: ElementType[]) {
    const plain = children.find((child) => {
        return child.name === 'p:timing';
    });
    if (plain !== undefined) {
        return { copies: [plain], wrapper: null };
    }
    for (const child of children) {
        if (child.name !== 'mc:AlternateContent') {
            continue;
        }
        const copies = listChildren(slideXml, child)
            .map((choice) => {
                return findChild(slideXml, choice, 'p:timing');
            })
            .filter((timing): timing is ElementType => {
                return timing !== null;
            });
        if (copies.length > 0) {
            return { copies, wrapper: child };
        }
    }
    return { copies: [] as ElementType[], wrapper: null };
}

function checkHasShape(slideXml: string, spid: string) {
    for (const tag of scanTags(slideXml)) {
        if (
            tag.name === 'p:cNvPr' &&
            !tag.isClose &&
            readAttribute(tag.attributes, 'id') === spid
        ) {
            return true;
        }
    }
    return false;
}

function toShapeId(shapeId: string | number) {
    const spid = String(shapeId).trim();
    return /^\d+$/.test(spid) ? spid : null;
}

function dropSlideTiming(
    slideXml: string,
    spid: string,
    isWholeShape: boolean,
) {
    const slide = readSlideChildren(slideXml);
    if (slide === null) {
        return null;
    }
    const { copies, wrapper } = listTimingCopies(slideXml, slide.children);
    const sources = copies.map((copy) => {
        return slideXml.slice(copy.start, copy.end);
    });
    const edited = sources.map((source) => {
        return dropTimingNodes(source, spid, isWholeShape);
    });
    if (
        edited.every((one, index) => {
            return one === sources[index];
        })
    ) {
        return slideXml;
    }
    if (
        wrapper !== null &&
        edited.every((one) => {
            return one === '';
        })
    ) {
        return slideXml.slice(0, wrapper.start) + slideXml.slice(wrapper.end);
    }
    let xml = slideXml;
    for (let index = copies.length - 1; index >= 0; index--) {
        // a copy inside Office's wrapper stays, empty
        const one =
            edited[index] === '' && wrapper !== null
                ? '<p:timing/>'
                : edited[index];
        xml =
            xml.slice(0, copies[index].start) +
            one +
            xml.slice(copies[index].end);
    }
    return xml;
}

/**
 * The slide with what lets PowerPoint play the clip in the frame whose
 * `p:cNvPr id` is `shapeId`: its media node and "When Clicked On" (a click
 * on the frame plays and pauses it), and for `play` 'auto' a play step that
 * starts with the slide in the main sequence. `durationMs`, the clip's
 * length (`readOfficeMediaDurationMs`), is the step's length as PowerPoint
 * writes it; unknown, 1 ms. A timing the slide has is kept, every node of
 * it byte for byte, the new nodes numbered past its highest id; any media
 * node the frame already had is replaced. Null when the slide's timing
 * cannot be read (or there is no `p:sld`, no such frame, or `shapeId` is
 * not a number).
 */
export function addMediaTimingXml(
    slideXml: string,
    shapeId: string | number,
    kind: OfficeMediaKindType,
    play: 'click' | 'auto',
    durationMs: number | null = null,
): string | null {
    const spid = toShapeId(shapeId);
    if (spid === null || !checkHasShape(slideXml, spid)) {
        return null;
    }
    const xml = dropSlideTiming(slideXml, spid, false);
    const slide = xml === null ? null : readSlideChildren(xml);
    if (xml === null || slide === null) {
        return null;
    }
    const length = String(
        (durationMs === null ? null : toDurationMs(durationMs)) ?? 1,
    );
    const isAuto = play === 'auto';
    const { copies } = listTimingCopies(xml, slide.children);
    if (copies.length === 0) {
        const made = addTimingNodes('<p:timing/>', spid, kind, isAuto, length);
        if (made === null) {
            return null;
        }
        // after the colour map and the transition (an `mc:AlternateContent`
        // holding one too), before the slide's own extension list
        const at =
            slide.children.find((child) => {
                return child.name === 'p:extLst';
            })?.start ?? slide.closeStart;
        return xml.slice(0, at) + made + xml.slice(at);
    }
    let out = xml;
    for (let index = copies.length - 1; index >= 0; index--) {
        const copy = copies[index];
        const made = addTimingNodes(
            xml.slice(copy.start, copy.end),
            spid,
            kind,
            isAuto,
            length,
        );
        if (made === null) {
            return null;
        }
        out = out.slice(0, copy.start) + made + out.slice(copy.end);
    }
    return out;
}

/**
 * The slide without the timing of the clip in the frame whose `p:cNvPr id`
 * is `shapeId`: its media node, its play / pause / stop steps and a
 * sequence left empty by them; with `isWholeShape`, every node naming the
 * frame (its entrance or exit effects, its build entries, a sequence its
 * click starts) -- what a frame taken off the slide needs, or PowerPoint
 * asks to repair the file. The rest is kept byte for byte (a later step
 * moved up by the time of one taken out), and a timing left empty goes.
 * The slide as it was when nothing names it; null when it has no `p:sld`.
 */
export function dropMediaTimingXml(
    slideXml: string,
    shapeId: string | number,
    isWholeShape = false,
): string | null {
    const spid = toShapeId(shapeId);
    if (spid === null) {
        return slideXml;
    }
    return dropSlideTiming(slideXml, spid, isWholeShape);
}
