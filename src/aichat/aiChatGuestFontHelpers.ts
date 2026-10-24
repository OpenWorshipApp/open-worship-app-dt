// The app language's letters drawn in its own face INSIDE an AI Chat site
// (2026-10-17, the user's picture of Claude's page with its Khmer in the
// operating system's fallback face: _ai chat, make font-family effect page
// body as well_).
//
// The site is a stranger's page in a guest (`aichat.md`), so nothing of the
// app is fetched by it and nothing of it reaches back: the window reads the
// language pack's own font files and hands their BYTES to the page as
// `FontFace` objects -- no address, so no request the guest's wall or the
// site's own Content-Security-Policy would have to allow. Each face covers
// only the language's letters (`unicode-range`, from the language's
// `scriptPattern`), and is added under the font names the site already
// draws its text in, so its Latin text and its icon fonts are exactly as
// they were and a Khmer letter in that text takes this face instead of
// whatever the OS falls back to. A site drawing its text in system fonts
// gets one rule more, on its body: the face's own name in front of the
// site's own list.
//
// A face the user picked in Settings → General → Font Family is handed only
// its NAME (it is a face installed on this computer, with no bytes here to
// give), by the same two moves: a `local()` face under every loaded site
// face's name with the same weight, style and stretch, and one body rule in
// front of the site's own list. Both come AFTER the language face's, so a
// letter they both cover is the picked face's -- an explicit pick outranks
// the pack's. To keep the site's icon fonts its own, the borrowed faces
// cover only text letters (`GUEST_TEXT_UNICODE_RANGE`; the report of
// 2026-10-20: the custom font had no effect on the AI Chat page either,
// then _it should effect inside the page as well_).
//
// Each face is added with the SAME weight, style and stretch as the site's
// face of that name (the user's same-day report: _ai chat font-family not
// effect the website_). Chromium picks ONE group of faces per name by those
// three, and only inside a group does `unicode-range` share the letters
// out: a Khmer face at weight 400 beside claude.ai's `anthropic-sans` at
// `300 800` won the group for regular text, and its Latin fell through to
// Segoe UI. The cost: in a site face covering every weight, bold Khmer is
// drawn in the regular file, since one group holds one face per letter.
//
// Which names: the site faces the browser has LOADED -- it loads a web font
// only for text drawn in it -- and every one it loads later (`loadingdone`),
// so an answer drawn in a face nothing on the page used at load still gets
// it. A site face whose own `unicode-range` cannot hold the letters
// (claude.ai's Latin-only Georgia fallbacks) is passed over.

import type { AiChatGuestElementType } from './webviewTypes';

export type LanguageFontType = {
    // The name the app's own pages know the face by (`app-Battambang`).
    family: string;
    // The language pack's @font-face sheet (`genCss`), read for its files.
    css: string;
    // `U+1780-17FF, U+19E0-19FF`: the letters the face is for.
    unicodeRange: string;
};

let languageFont: LanguageFontType | null = null;

/** Set once by the window's entry, when its language has a face of its own. */
export function setLanguageFont(font: LanguageFontType | null) {
    languageFont = font;
}

// The Settings → General face, NAME only (it is installed on this computer).
let appFontFamily: string | null = null;

/** Set once by the window's entry, when Settings → General picks a face. */
export function setAppFontFamily(family: string | null) {
    appFontFamily = family;
}

/**
 * The letters a language's script pattern names, as a CSS `unicode-range`:
 * `[ក-៿᧠-᧿]` → `U+1780-17FF, U+19E0-19FF`. Null for a
 * pattern written another way -- no range, no face.
 */
export function toUnicodeRange(patternSource: string): string | null {
    const ranges = [
        ...patternSource.matchAll(/\\u([0-9A-Fa-f]{4})-\\u([0-9A-Fa-f]{4})/g),
    ].map(([, from, to]) => {
        return `U+${from.toUpperCase()}-${to.toUpperCase()}`;
    });
    return ranges.length === 0 ? null : ranges.join(', ');
}

/**
 * The regular and bold files of `family` in a language pack's sheet. The
 * other weights stay home: each face handed over is parsed by the page.
 */
export function readLanguageFontFiles(css: string, family: string) {
    const files: { url: string; weight: '400' | '700' }[] = [];
    for (const [, block] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
        const name = /font-family:\s*["']?([^;"']+)["']?\s*;/.exec(block)?.[1];
        const url = /url\(\s*["']?([^)"']+)["']?\s*\)/.exec(block)?.[1];
        const weightWord =
            /font-weight:\s*([\w]+)/.exec(block)?.[1] ?? 'normal';
        const weight =
            weightWord === 'normal' || weightWord === '400'
                ? '400'
                : weightWord === 'bold' || weightWord === '700'
                  ? '700'
                  : null;
        if (name?.trim() !== family || url === undefined || weight === null) {
            continue;
        }
        if (
            !files.some((file) => {
                return file.weight === weight;
            })
        ) {
            files.push({ url, weight });
        }
    }
    return files;
}

/**
 * A font list read off the page, kept to what a font list can hold: the
 * names and the commas between them. Whatever else the page answered is not
 * written into a style. Cut between names, never inside one: claude.ai's
 * list ran past the old limit, and a cut through `"Noto Sans"` left an open
 * quote that swallowed the end of the rule.
 */
export function toSafeFontList(text: unknown): string {
    if (typeof text !== 'string') {
        return '';
    }
    const names: string[] = [];
    let length = 0;
    for (const part of text.replace(/[^\w\s,"'-]/g, '').split(',')) {
        const name = part.trim();
        const isQuoteOpen = ['"', "'"].some((quote) => {
            return name.split(quote).length % 2 === 0;
        });
        if (name === '' || isQuoteOpen) {
            continue;
        }
        length += name.length + 2;
        if (length > 1200) {
            break;
        }
        names.push(name);
    }
    return names.join(', ');
}

async function toBase64(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not read ${url}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    const CHUNK = 0x8000;
    for (let index = 0; index < bytes.length; index += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
    }
    return btoa(binary);
}

// Set on the page's window by the script below; read first, so the second
// load event of a page sends no font over again.
const GUEST_FONT_MARK = '__owaLanguageFont';
// The letter blocks the world's writing systems live in, Khmer's included
// (U+1780 and U+19E0 are both under this). Everything ABOVE it -- the
// Private Use Area an icon font's letters live in, the symbol planes, the
// emoji -- stays the site's own face under a name we borrow, or an answer
// full of ✓ and arrows would empty out the moment a custom font is picked.
export const GUEST_TEXT_UNICODE_RANGE = 'U+0-2FFF';

/**
 * What runs in the page for the face picked in Settings → General → Font
 * Family, once per document: under the name of every loaded site face (and
 * every one loaded later) a FontFace pointing AT THIS COMPUTER'S copy of
 * the picked face (`local(...)`, nothing fetched, the same weight, style
 * and stretch as the site's face), limited to text letters -- added AFTER
 * the language face's, so where they both cover a letter this one wins, an
 * explicit pick outranking the pack's. Hands back the body's font list for
 * the rule that names it outright. Sets the page's font mark itself, for a
 * language with no face of its own.
 *
 * The `local()` name traps, measured on the user's Battambang: unlike a
 * bare CSS `font-family` name, `local()` wants the face's FULL name
 * (`Battambang Regular`) or its PostScript name (`Battambang-Regular`) --
 * the bare family name loads nothing and the face ends in `error` status
 * ("A network error occurred", on the host page as much as in a guest), so
 * each borrow tries all three spellings (regular AND bold, picked by the
 * site face's weight, as the language script picks its two files). A face
 * nothing loads for is skipped by the letter matcher, so a failed borrow
 * leaves the site's own face alone.
 */
export function genGuestAppFontScript(family: string) {
    return `(() => {
    window.${GUEST_FONT_MARK} = true;
    const family = ${JSON.stringify(family)};
    const regularSource =
        [' Regular', '-Regular', ''].map((suffix) => {
            return 'local(' + JSON.stringify(family + suffix) + ')';
        }).join(', ');
    const boldSource =
        [' Bold', '-Bold'].map((suffix) => {
            return 'local(' + JSON.stringify(family + suffix) + ')';
        }).join(', ');
    const unicodeRange = ${JSON.stringify(GUEST_TEXT_UNICODE_RANGE)};
    const clean = (name) => name.trim().replace(/^["']|["']$/g, '');
    const toRanges = (text) => {
        return String(text).split(',').map((part) => {
            const match = /U\\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?/.exec(part);
            if (match === null) {
                return null;
            }
            const last = match[2] ?? match[1];
            return [
                parseInt(match[1].replace(/\\?/g, '0'), 16),
                parseInt(last.replace(/\\?/g, 'F'), 16),
            ];
        }).filter((range) => range !== null);
    };
    const letters = toRanges(unicodeRange);
    const canDraw = (face) => {
        return toRanges(face.unicodeRange).some(([from, to]) => {
            return letters.some(([start, end]) => from <= end && start <= to);
        });
    };
    const followed = new Set();
    const follow = (face) => {
        const name = clean(face.family);
        const key = [name, face.weight, face.style, face.stretch].join('|');
        if (
            name === family ||
            face.family === family ||
            followed.has(key) ||
            followed.size >= ${MAX_FOLLOWED_FACES} ||
            !canDraw(face)
        ) {
            return;
        }
        followed.add(key);
        const lightest = face.weight === 'bold' ? 700 : parseFloat(face.weight);
        try {
            document.fonts.add(new FontFace(name, lightest >= 600 ? boldSource : regularSource, {
                weight: face.weight,
                style: face.style,
                stretch: face.stretch,
                unicodeRange,
            }));
        } catch (_error) {
            // A name the page cannot take a face under: left as it is.
        }
    };
    for (const face of document.fonts) {
        if (face.status === 'loaded') {
            follow(face);
        }
    }
    document.fonts.addEventListener('loadingdone', (event) => {
        for (const face of event.fontfaces) {
            follow(face);
        }
    });
    return document.body ? getComputedStyle(document.body).fontFamily : '';
})()`;
}
// Each face handed over is a copy of the file the page parses and keeps.
const MAX_FOLLOWED_FACES = 12;

/**
 * What runs in the page, once per document: the language's face under its
 * own name (regular and bold), then under the name of every site face that
 * is loaded or loads later, with that face's weight, style and stretch; and
 * the body's own list handed back for the rule that puts the face in front
 * of it -- empty when the body's first face already took the language's.
 * Null when the page already has it.
 */
export function genGuestFontScript(
    faces: { data: string; weight: string }[],
    family: string,
    unicodeRange: string,
) {
    return `(() => {
    if (window.${GUEST_FONT_MARK} === true) {
        return null;
    }
    window.${GUEST_FONT_MARK} = true;
    const faces = ${JSON.stringify(faces)};
    const family = ${JSON.stringify(family)};
    const unicodeRange = ${JSON.stringify(unicodeRange)};
    const buffers = faces.map((face) => {
        return {
            weight: face.weight,
            buffer: Uint8Array.from(atob(face.data), (letter) => {
                return letter.charCodeAt(0);
            }).buffer,
        };
    });
    const regular = buffers.find((one) => one.weight === '400') ?? buffers[0];
    const bold = buffers.find((one) => one.weight === '700') ?? regular;
    const clean = (name) => name.trim().replace(/^["']|["']$/g, '');
    const toRanges = (text) => {
        return String(text).split(',').map((part) => {
            const match = /U\\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?/.exec(part);
            if (match === null) {
                return null;
            }
            const last = match[2] ?? match[1];
            return [
                parseInt(match[1].replace(/\\?/g, '0'), 16),
                parseInt(last.replace(/\\?/g, 'F'), 16),
            ];
        }).filter((range) => range !== null);
    };
    const letters = toRanges(unicodeRange);
    const canDraw = (face) => {
        return toRanges(face.unicodeRange).some(([from, to]) => {
            return letters.some(([start, end]) => from <= end && start <= to);
        });
    };
    const ours = new WeakSet();
    const add = (name, buffer, descriptors) => {
        try {
            const face = new FontFace(name, buffer, { ...descriptors, unicodeRange });
            ours.add(face);
            document.fonts.add(face);
        } catch (_error) {
            // A name the page cannot take a face under: left as it is.
        }
    };
    const followed = new Set();
    const follow = (face) => {
        const name = clean(face.family);
        const key = [name, face.weight, face.style, face.stretch].join('|');
        if (
            ours.has(face) ||
            name === family ||
            followed.has(key) ||
            followed.size >= ${MAX_FOLLOWED_FACES} ||
            !canDraw(face)
        ) {
            return;
        }
        followed.add(key);
        const lightest = face.weight === 'bold' ? 700 : parseFloat(face.weight);
        add(name, (lightest >= 600 ? bold : regular).buffer, {
            weight: face.weight,
            style: face.style,
            stretch: face.stretch,
        });
    };
    for (const { weight, buffer } of buffers) {
        add(family, buffer, { weight });
    }
    for (const face of document.fonts) {
        if (face.status === 'loaded') {
            follow(face);
        }
    }
    document.fonts.addEventListener('loadingdone', (event) => {
        for (const face of event.fontfaces) {
            follow(face);
        }
    });
    const bodyFonts = document.body ? getComputedStyle(document.body).fontFamily : '';
    const firstName = clean(bodyFonts.split(',')[0] ?? '');
    const hasFace = [...followed].some((key) => key.startsWith(firstName + '|'));
    return hasFace ? '' : bodyFonts;
})()`;
}

// The guests a face is being handed to right now: a page's `dom-ready` and
// `did-stop-loading` can come in the same moment.
const handingOver = new WeakSet<AiChatGuestElementType>();

/**
 * The language's face put into one guest, once its page is up. Quiet on
 * every failure: a site that will not take it is left as it was.
 */
export async function applyGuestLanguageFont(guest: AiChatGuestElementType) {
    const font = languageFont;
    const appFont = toSafeFontList(appFontFamily);
    const files =
        font === null ? [] : readLanguageFontFiles(font.css, font.family);
    if ((files.length === 0 && appFont === '') || handingOver.has(guest)) {
        return;
    }
    handingOver.add(guest);
    try {
        if (
            (await guest.executeJavaScript(
                `window.${GUEST_FONT_MARK} === true`,
            )) === true
        ) {
            return;
        }
        if (font !== null && files.length > 0) {
            const faces = await Promise.all(
                files.map(async (file) => {
                    return {
                        data: await toBase64(file.url),
                        weight: file.weight,
                    };
                }),
            );
            const bodyFonts = toSafeFontList(
                await guest.executeJavaScript(
                    genGuestFontScript(faces, font.family, font.unicodeRange),
                ),
            );
            const family = toSafeFontList(font.family);
            if (bodyFonts.length > 0 && !bodyFonts.includes(family)) {
                await guest.insertCSS(
                    `body { font-family: "${family}", ${bodyFonts}; }`,
                );
            }
        }
        if (appFont !== '') {
            const bodyFonts = toSafeFontList(
                await guest.executeJavaScript(genGuestAppFontScript(appFont)),
            );
            if (bodyFonts.length > 0 && !bodyFonts.includes(appFont)) {
                await guest.insertCSS(
                    `body { font-family: "${appFont}", ${bodyFonts}; }`,
                );
            }
        }
    } catch (_error) {
        // The page went away, or would not run it: nothing to put right.
    } finally {
        handingOver.delete(guest);
    }
}
