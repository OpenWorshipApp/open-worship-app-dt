import { checkIsLocalNetworkUrl } from '../../electron/customLlmProtocol';

/**
 * A picture, a video or a sound from a LINK the person typed, put into the
 * PowerPoint they attached (2026-11-21, `EC-777`; the goal _chatbot can
 * change do everything on a given pptx_: "a picture from the web" had been
 * refused as PowerPoint's). The MODEL decides a link is meant as a picture
 * -- a link may as well be one to put on a title -- by giving it as a
 * change's `picture` or `media`; the WINDOW puts it in only when the person
 * typed that very link in this chat, downloads it from a public address
 * alone, keeps it only when its first bytes are a kind a deck takes, and
 * hands the change the file (`officeLinkMediaDownload.ts`). Pure.
 */

export type OfficeLinkKindType = 'picture' | 'media';

/** The most bytes a picture from a link may be. */
export const MAX_LINK_PICTURE_BYTES = 20 * 1024 * 1024;
/** The most bytes a video or a sound from a link may be. */
export const MAX_LINK_MEDIA_BYTES = 100 * 1024 * 1024;
// the most links one question's words are read for
const MAX_TYPED_LINKS = 12;
const LINK_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;
// what closes a sentence or a bracket after a link, never part of it
const LINK_TAIL_PATTERN = /[.,;:!?)\]}>»"'’”]+$/;

/** A link as one string to compare: what `URL` makes of it, else null. */
export function toLinkKey(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim().replace(LINK_TAIL_PATTERN, '');
    if (!/^https?:\/\//i.test(text)) {
        return null;
    }
    try {
        return new URL(text).href;
    } catch (_error) {
        return null;
    }
}

/** Whether a change's value is a link rather than an attached name. */
export function checkIsOfficeLinkValue(value: unknown) {
    return typeof value === 'string' && /^\s*https?:\/\//i.test(value);
}

/** The links in words the person typed, each once, in the order typed. */
export function readTypedLinks(texts: readonly string[]) {
    const found: string[] = [];
    for (const text of texts) {
        for (const match of text.match(LINK_PATTERN) ?? []) {
            const key = toLinkKey(match);
            if (key !== null && !found.includes(key)) {
                found.push(key);
            }
        }
    }
    return found.slice(-MAX_TYPED_LINKS);
}

/**
 * Whether a link may be downloaded: http or https, no name and password in
 * it, and an address on the internet -- never this computer or the
 * church's own network, which a link someone sent could otherwise reach.
 * Read off the address; a redirect is held to the same.
 */
export function checkIsAllowedLinkUrl(value: string) {
    let url: URL;
    try {
        url = new URL(value);
    } catch (_error) {
        return false;
    }
    return (
        (url.protocol === 'https:' || url.protocol === 'http:') &&
        url.username === '' &&
        url.password === '' &&
        url.hostname !== '' &&
        !checkIsLocalNetworkUrl(url.href) &&
        (!checkIsIpAddress(url.hostname) || checkIsPublicAddress(url.hostname))
    );
}

function checkIsIpAddress(hostname: string) {
    return (
        hostname.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    );
}

// `::ffff:10.0.0.1` and `::ffff:a00:1`: an IPv4 address written as IPv6
function toMappedIpv4(bare: string) {
    const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(bare);
    if (dotted !== null) {
        return dotted[1];
    }
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(bare);
    if (hex === null) {
        return null;
    }
    const high = Number.parseInt(hex[1], 16);
    const low = Number.parseInt(hex[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

/**
 * Whether an IP address -- a link's, or the one a download CONNECTED to,
 * which is what a public name may turn out to be -- is on the internet:
 * never this computer, the church's own network, a link-local, multicast or
 * reserved one, IPv4 written as IPv6 included. Anything not an address is
 * not.
 */
export function checkIsPublicAddress(address: string) {
    const bare = address.replace(/^\[|\]$/g, '').toLowerCase();
    if (bare.includes(':')) {
        const mapped = toMappedIpv4(bare);
        if (mapped !== null) {
            return checkIsPublicAddress(mapped);
        }
        if (!/^[0-9a-f:.]+$/.test(bare)) {
            return false;
        }
        const first = Number.parseInt(bare.split(':')[0] || '0', 16);
        return !(
            first === 0 ||
            // fc00::/7 unique-local, fe80::/10 link-local, fec0::/10
            // site-local, ff00::/8 multicast
            (first & 0xfe00) === 0xfc00 ||
            (first & 0xffc0) === 0xfe80 ||
            (first & 0xffc0) === 0xfec0 ||
            (first & 0xff00) === 0xff00
        );
    }
    const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bare);
    if (match === null) {
        return false;
    }
    const [one, two] = [Number(match[1]), Number(match[2])];
    return !(
        one === 0 ||
        one === 10 ||
        one === 127 ||
        one >= 224 ||
        (one === 169 && two === 254) ||
        (one === 172 && two >= 16 && two <= 31) ||
        (one === 192 && two === 168) ||
        (one === 100 && two >= 64 && two <= 127)
    );
}

function checkStartsWith(head: Uint8Array, bytes: number[], at = 0) {
    return bytes.every((byte, index) => {
        return head[at + index] === byte;
    });
}

function readAscii(head: Uint8Array, at: number, length: number) {
    return String.fromCharCode(...head.slice(at, at + length));
}

/**
 * What a file's first bytes say it is, as a deck takes it: a picture (PNG,
 * JPEG, GIF, BMP) or a video or a sound (MP4, MOV, M4A, MP3, WAV, AVI, WMV,
 * WMA), with the ending it is kept under -- never the link's own word for
 * it. `unsupported` names a picture a deck does not take (WebP, AVIF,
 * SVG), so the answer can say which; null is anything else (a web page).
 */
export function findLinkMediaKind(
    head: Uint8Array,
    linkPath = '',
): { kind: OfficeLinkKindType; ext: string } | { unsupported: string } | null {
    if (
        checkStartsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ) {
        return { kind: 'picture', ext: 'png' };
    }
    if (checkStartsWith(head, [0xff, 0xd8, 0xff])) {
        return { kind: 'picture', ext: 'jpg' };
    }
    if (readAscii(head, 0, 4) === 'GIF8') {
        return { kind: 'picture', ext: 'gif' };
    }
    if (readAscii(head, 0, 4) === 'RIFF') {
        const form = readAscii(head, 8, 4);
        if (form === 'WAVE') {
            return { kind: 'media', ext: 'wav' };
        }
        if (form === 'AVI ') {
            return { kind: 'media', ext: 'avi' };
        }
        if (form === 'WEBP') {
            return { unsupported: 'WebP' };
        }
        return null;
    }
    if (readAscii(head, 4, 4) === 'ftyp') {
        const brand = readAscii(head, 8, 4);
        if (/^avi[fs]$/.test(brand)) {
            return { unsupported: 'AVIF' };
        }
        if (/^hei[cx]|^mif1$/.test(brand)) {
            return { unsupported: 'HEIC' };
        }
        if (brand === 'M4A ' || brand === 'M4B ') {
            return { kind: 'media', ext: 'm4a' };
        }
        if (brand === 'qt  ') {
            return { kind: 'media', ext: 'mov' };
        }
        return { kind: 'media', ext: 'mp4' };
    }
    if (
        checkStartsWith(head, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11])
    ) {
        return {
            kind: 'media',
            ext: /\.wma$/i.test(linkPath) ? 'wma' : 'wmv',
        };
    }
    if (
        readAscii(head, 0, 3) === 'ID3' ||
        (head[0] === 0xff && head.length > 1 && (head[1] & 0xe0) === 0xe0)
    ) {
        return { kind: 'media', ext: 'mp3' };
    }
    if (readAscii(head, 0, 2) === 'BM' && head.length >= 14) {
        return { kind: 'picture', ext: 'bmp' };
    }
    const start = readAscii(head, 0, Math.min(head.length, 64))
        .trimStart()
        .toLowerCase();
    if (start.startsWith('<svg') || start.startsWith('<?xml')) {
        return /\.svg$/i.test(linkPath) || start.startsWith('<svg')
            ? { unsupported: 'SVG' }
            : null;
    }
    return null;
}

/**
 * The name a file from a link is shown and named by: the link's last part,
 * read, in letters, digits, spaces and a few marks, under the ending its
 * bytes gave -- else "picture" or "video" with it.
 */
export function toLinkFileName(
    url: string,
    kind: OfficeLinkKindType,
    ext: string,
) {
    let last = '';
    try {
        const parts = new URL(url).pathname.split('/').filter(Boolean);
        last = decodeURIComponent(parts.at(-1) ?? '');
    } catch (_error) {
        // a link URL cannot read, or a broken %-escape: no name from it
    }
    const stem = last
        .replace(/\.[a-z0-9]{1,5}$/i, '')
        .replace(/[^\p{L}\p{N} ._-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[.\s]+/, '')
        .trim()
        .slice(0, 60)
        .trim();
    const fallback = kind === 'picture' ? 'picture' : 'video';
    return `${stem === '' ? fallback : stem}.${ext}`;
}

/** A name no other attached file has: "photo.jpg", then "photo (2).jpg". */
export function toFreeLinkFileName(
    name: string,
    takenNames: readonly string[],
) {
    const taken = new Set(
        takenNames.map((one) => {
            return one.toLowerCase();
        }),
    );
    if (!taken.has(name.toLowerCase())) {
        return name;
    }
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let index = 2; ; index++) {
        const next = `${stem} (${index})${ext}`;
        if (!taken.has(next.toLowerCase())) {
            return next;
        }
    }
}

/** What the change is told when a link is not one they typed. */
export const OFFICE_LINK_NOT_TYPED_REASON =
    'A picture, video or sound from the web goes in only from a link THEY ' +
    'typed in this chat, written exactly as they typed it. Ask them for ' +
    "the picture's own link (right-click the picture, Copy Image Address), " +
    'or to save it and drag the file in.';
