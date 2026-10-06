import createDOMPurify, { type Config } from 'dompurify';

const mediaTags = new Set(['img', 'video', 'audio', 'source']);
const youtubeHosts = new Set([
    'youtube.com',
    'www.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
]);
const baseConfig: Config = {
    // Lyrics carry computed styles, inline SVG and application data attributes.
    // Keep a leading style element in the fragment instead of losing it to HEAD.
    FORCE_BODY: true,
    FORBID_TAGS: ['object', 'embed', 'base', 'link', 'meta', 'form'],
    FORBID_ATTR: ['srcdoc', 'srcset'],
    RETURN_TRUSTED_TYPE: false,
};
let documentPurifier: ReturnType<typeof createDOMPurify> | null = null;
let slidePurifier: ReturnType<typeof createDOMPurify> | null = null;

function createPurifier(isComposedSlide: boolean) {
    // Do not create a DOM at import time: text/path helpers also load in Node.
    // No fallback may return unsanitized content when a DOM is unavailable.
    if (!globalThis.window?.document) {
        throw new Error('HTML sanitization requires a DOM');
    }
    const purifier = createDOMPurify(globalThis.window);
    if (!purifier.isSupported) {
        throw new Error('HTML sanitization is unavailable');
    }
    purifier.setConfig({
        ...baseConfig,
        ...(isComposedSlide
            ? {
                  ADD_TAGS: ['iframe'],
                  ADD_ATTR: [
                      'allow',
                      'allowfullscreen',
                      'referrerpolicy',
                      'loading',
                  ],
              }
            : { FORBID_TAGS: [...baseConfig.FORBID_TAGS!, 'iframe'] }),
    });
    purifier.addHook('uponSanitizeAttribute', (node, event) => {
        // Only typed website/camera components may ask the screen to hydrate
        // media. Document HTML must not impersonate those components.
        if (
            !isComposedSlide &&
            /^data-(website|camera)-/.test(event.attrName)
        ) {
            event.keepAttr = false;
        }
        if (
            event.attrName !== 'src' ||
            !mediaTags.has(node.nodeName.toLowerCase())
        ) {
            return;
        }
        try {
            const { protocol } = new URL(event.attrValue);
            // DOMPurify's default URI policy excludes local Electron media.
            // This exception is SRC on media only, never a link or a frame.
            if (
                protocol === 'file:' ||
                protocol === 'blob:' ||
                protocol === 'owa:'
            ) {
                event.forceKeepAttr = true;
            }
        } catch {
            // Relative sources still go through DOMPurify's default policy.
        }
    });
    if (isComposedSlide) {
        purifier.addHook('uponSanitizeElement', (node, event) => {
            if (event.tagName !== 'iframe' || !(node instanceof Element)) {
                return;
            }
            try {
                const url = new URL(node.getAttribute('src') ?? '');
                if (
                    url.protocol === 'https:' &&
                    youtubeHosts.has(url.hostname) &&
                    url.port === '' &&
                    url.username === '' &&
                    url.password === '' &&
                    /^\/embed\/[^/]+$/.test(url.pathname)
                ) {
                    return;
                }
            } catch {
                // A malformed/missing source is not an approved embed.
            }
            node.parentNode?.removeChild(node);
        });
        purifier.addHook('afterSanitizeAttributes', (node) => {
            if (node.nodeName.toLowerCase() === 'iframe') {
                node.setAttribute(
                    'sandbox',
                    'allow-scripts allow-same-origin allow-presentation',
                );
            }
        });
    }
    return purifier;
}

function sanitize(dirty: string, isComposedSlide: boolean): string {
    if (dirty === '') {
        return '';
    }
    const purifier = isComposedSlide
        ? (slidePurifier ??= createPurifier(true))
        : (documentPurifier ??= createPurifier(false));
    try {
        return purifier.sanitize(dirty);
    } finally {
        // Removed nodes can retain a whole parsed slide. No history/cache of
        // documents belongs here; React memoizes only each mounted item's HTML.
        purifier.removed = [];
    }
}

/** Untrusted HTML from a document, Bible or popup. No embedded documents. */
export function sanitizeHtml(dirty: string): string {
    return sanitize(dirty, false);
}

/**
 * Only for the output of SlideRendererComp, AFTER its HTML/Bible items have
 * passed sanitizeHtml. Keeps typed camera/website markers and YouTube embeds.
 */
export function sanitizeSlideHtml(dirty: string): string {
    return sanitize(dirty, true);
}

/**
 * Text the user controls -- a file or folder name -- on its way into a string
 * that is rendered as HTML (`showAppConfirm`'s body). Escape before composing
 * the markup so a name containing `<` remains text rather than an HTML tag.
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
