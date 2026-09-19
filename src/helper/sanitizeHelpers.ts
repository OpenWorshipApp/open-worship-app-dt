export function sanitizeHtml(dirty: string): string {
    // TODO: Implement a proper HTML sanitizer. For now, this is a placeholder
    // that simply returns the input string.
    return dirty;
}

/**
 * Text the user controls -- a file or folder name -- on its way into a string
 * that is rendered as HTML (`showAppConfirm`'s body). `sanitizeHtml` above is
 * still a no-op, and a name on macOS or Linux may hold `<`, in a renderer with
 * node integration.
 */
export function escapeHtmlText(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

const NAMED_HTML_ENTITY_MAP: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

/**
 * The text a page's `<title>` reads as, for a caller that took it out of the
 * raw HTML with a pattern. `Tom &amp; Jerry` is a title a browser shows as
 * `Tom & Jerry`, and naming a downloaded file after the escaped form put the
 * entity itself into the file name. An entity it does not know is left as
 * written rather than guessed at.
 */
export function decodeHtmlEntities(text: string): string {
    return text.replaceAll(
        /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi,
        (match, body: string) => {
            if (body.startsWith('#')) {
                const isHex = body[1] === 'x' || body[1] === 'X';
                const codePoint = Number.parseInt(
                    body.slice(isHex ? 2 : 1),
                    isHex ? 16 : 10,
                );
                if (
                    !Number.isFinite(codePoint) ||
                    codePoint <= 0 ||
                    codePoint > 0x10ffff
                ) {
                    return match;
                }
                return String.fromCodePoint(codePoint);
            }
            return NAMED_HTML_ENTITY_MAP[body.toLowerCase()] ?? match;
        },
    );
}

export function sanitizeCssValue(value: string): string {
    // Remove characters that could break out of CSS context
    return value.replaceAll(/[;{}'"\\<>]/g, '');
}
