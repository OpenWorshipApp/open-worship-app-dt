export type TextSegmentType = {
    text: string;
    // The absolute URL to open, or null when this run is ordinary text.
    url: string | null;
};

// Bare URLs as they actually appear in prose: a full `http(s)://` one, or the
// `www.` shorthand people write in a copyright line. Stops at whitespace and at
// the quote/angle characters that can only be around a URL, never inside one.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

// A URL ending a sentence swallows the punctuation — give it back.
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?]+$/;

const BRACKET_PAIRS = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
] as const;

function countOf(text: string, character: string) {
    return text.split(character).length - 1;
}

function trimUrlTail(rawUrl: string) {
    let url = rawUrl;
    for (;;) {
        const trimmed = url.replace(TRAILING_PUNCTUATION_PATTERN, '');
        if (trimmed !== url) {
            url = trimmed;
            continue;
        }
        // A closing bracket belongs to the URL only when the URL opened it:
        // `…/Bible_(disambiguation)` keeps its `)`, `(see https://a.com)` does
        // not. Each pass shortens `url`, so this always terminates.
        const lastCharacter = url.at(-1) ?? '';
        const pair = BRACKET_PAIRS.find(([, close]) => {
            return close === lastCharacter;
        });
        if (
            pair !== undefined &&
            countOf(url, pair[0]) < countOf(url, pair[1])
        ) {
            url = url.slice(0, -1);
            continue;
        }
        return url;
    }
}

/**
 * Split prose into plain-text and URL runs so a renderer can turn the URL runs
 * into links WITHOUT injecting the source string as markup — these strings come
 * from imported bible files, and `sanitizeHtml` is still a no-op placeholder.
 * Text with no URL comes back as a single text-only segment.
 */
export function splitTextByUrl(text: string): TextSegmentType[] {
    const segments: TextSegmentType[] = [];
    let lastIndex = 0;
    // `matchAll` clones the regex, so the module-level `lastIndex` never leaks
    // between calls.
    for (const match of text.matchAll(URL_PATTERN)) {
        const url = trimUrlTail(match[0]);
        if (url === '') {
            continue;
        }
        if (match.index > lastIndex) {
            segments.push({
                text: text.slice(lastIndex, match.index),
                url: null,
            });
        }
        segments.push({
            text: url,
            url: url.toLowerCase().startsWith('www.') ? `https://${url}` : url,
        });
        lastIndex = match.index + url.length;
    }
    if (lastIndex < text.length) {
        segments.push({ text: text.slice(lastIndex), url: null });
    }
    return segments;
}
