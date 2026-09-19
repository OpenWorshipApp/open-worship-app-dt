import DOMPurify, { type Config } from 'dompurify';
import MarkdownIt from 'markdown-it';

/**
 * Turning a markdown file into the HTML the Markdown Preview window shows.
 *
 * The file comes from anywhere on the machine -- a Resources folder somebody
 * copied in, a download -- and every renderer in this app has Node. So:
 *
 *  - Raw HTML in the file is PARSED, the way GitHub shows a README (a centred
 *    `<p align="center"><img>`, a `<details>`), and then EVERYTHING the parser
 *    produced goes through DOMPurify (`sanitizePreviewHtml`) before it can
 *    reach the page: no script, no event handler, no form, no style sheet, no
 *    frame, no SVG. That pass is the line; the renderer lockdown and the
 *    page's CSP are what stands behind it. Nothing may reach the page's HTML
 *    without going through it.
 *  - Nothing in the result navigates. Links are classified here and acted on
 *    by the window's click handler (`classifyMarkdownHref`), which is the
 *    only place a press can leave the page.
 *  - A `mermaid` code block is drawn as its code, with a placeholder the
 *    window swaps for the diagram once `mermaid` has loaded -- and `mermaid`
 *    is loaded only by a file that has one.
 */

/** A local image path (as written in the file) to something `<img>` loads. */
export type ToLocalImageSrcType = (filePath: string) => string | null;

export type MarkdownPreviewRenderEnvType = {
    /** Filled while rendering: every `mermaid` block's source, in order. */
    mermaidSources: string[];
    /** Filled while rendering: heading slugs already handed out. */
    headingSlugCounts: Map<string, number>;
};

export type MarkdownPreviewRenderResultType = {
    html: string;
    mermaidSources: string[];
};

/**
 * Heading ids carry this prefix so a heading called `Root` cannot become
 * `id="root"` and collide with -- or clobber a global of -- the page's own
 * elements. An in-file link still writes `#root`; `toHeadingElementId`
 * applies the prefix when it is followed.
 */
const HEADING_ID_PREFIX = 'md-heading-';

export function toHeadingElementId(slug: string) {
    return `${HEADING_ID_PREFIX}${slug}`;
}

/**
 * GitHub's rule, which is what people writing `[see](#getting-started)` expect:
 * lower case, punctuation dropped, whitespace to hyphens. Letters, digits and
 * combining marks are kept in every script, so a Khmer heading keeps its words.
 */
export function toHeadingSlug(text: string) {
    return text
        .trim()
        .toLowerCase()
        .replaceAll(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
        .replaceAll(/\s/g, '-');
}

export type MarkdownHrefType =
    | { kind: 'anchor'; slug: string }
    | { kind: 'web'; url: string }
    | { kind: 'local'; filePath: string }
    | { kind: 'unsupported' };

const WINDOWS_DRIVE_PATH_REGEX = /^[a-zA-Z]:[\\/]/;
const SCHEME_REGEX = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

function safeDecodeURIComponent(text: string) {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
}

/**
 * What an `href` or an image `src` written in the file points at.
 *
 * `http(s)` only on the web side, for the reason `openResourceLinkUrl` gives:
 * the system browser hand-off is `shell.openExternal`, which launches whatever
 * program registered any other scheme. A path is anything without a scheme --
 * relative, rooted, or a Windows drive path -- decoded, because markdown-it
 * percent-encodes the URLs it renders (`My%20Notes.md`).
 */
export function classifyMarkdownHref(href: string): MarkdownHrefType {
    const trimmedHref = href.trim();
    if (trimmedHref === '') {
        return { kind: 'unsupported' };
    }
    if (trimmedHref.startsWith('#')) {
        return {
            kind: 'anchor',
            slug: safeDecodeURIComponent(trimmedHref.slice(1)),
        };
    }
    // Tested DECODED: markdown-it writes `C:\notes.md` as `C:%5Cnotes.md`,
    // which reads as a `c:` scheme until the backslash is put back.
    const isWindowsDrivePath = WINDOWS_DRIVE_PATH_REGEX.test(
        safeDecodeURIComponent(trimmedHref),
    );
    if (!isWindowsDrivePath && SCHEME_REGEX.test(trimmedHref)) {
        if (!URL.canParse(trimmedHref)) {
            return { kind: 'unsupported' };
        }
        const { protocol } = new URL(trimmedHref);
        if (protocol === 'http:' || protocol === 'https:') {
            return { kind: 'web', url: trimmedHref };
        }
        return { kind: 'unsupported' };
    }
    // Protocol-relative: a web address with its scheme left to the page's,
    // which here is the app's own. Not a path, not followed.
    if (trimmedHref.startsWith('//')) {
        return { kind: 'unsupported' };
    }
    // The fragment and query belong to a web page, not to a file on disk.
    const pathPart = trimmedHref.split(/[?#]/)[0];
    if (pathPart === '') {
        return { kind: 'unsupported' };
    }
    return { kind: 'local', filePath: safeDecodeURIComponent(pathPart) };
}

const SAFE_DATA_IMAGE_REGEX = /^data:image\/(gif|png|jpeg|webp);/i;

function toImageSrc(src: string, toLocalImageSrc: ToLocalImageSrcType) {
    const trimmedSrc = src.trim();
    if (SAFE_DATA_IMAGE_REGEX.test(trimmedSrc)) {
        return trimmedSrc;
    }
    const target = classifyMarkdownHref(trimmedSrc);
    if (target.kind === 'web') {
        return target.url;
    }
    if (target.kind === 'local') {
        return toLocalImageSrc(target.filePath) ?? '';
    }
    return '';
}

/**
 * What survives of the HTML, whoever wrote it -- the file's own tags and the
 * ones markdown-it generated alike, because after `render` they cannot be
 * told apart.
 *
 * The HTML profile only (no SVG, no MathML), minus everything that takes
 * input, submits, styles the page or holds a document of its own.
 */
const SANITIZE_CONFIG: Config = {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
        'style',
        'form',
        'input',
        'button',
        'textarea',
        'select',
        'option',
        'dialog',
        'template',
    ],
    FORBID_ATTR: ['srcset'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['data-mermaid-index'],
};

/**
 * `style` only as the one declaration markdown-it writes on an aligned table
 * column. Anything more is how a file lays a transparent link over the
 * window's own Reload and Open buttons.
 */
const TEXT_ALIGN_STYLE_REGEX =
    /^\s*text-align\s*:\s*(left|right|center)\s*;?\s*$/i;
/**
 * The classes this window styles, and no others: a file writing Bootstrap's
 * `position-fixed w-100 h-100` would otherwise get the page's own rules.
 */
const KEPT_CLASS_REGEX = /^(language-[\w-]+|app-markdown-[\w-]+)$/;
/** The page's own mount point, and the ids the diagram renderer looks up. */
const RESERVED_ID_REGEX = /^(root$|app-|dapp-)/i;

function toNoLocalImageSrc() {
    return null;
}

let activeToLocalImageSrc: ToLocalImageSrcType = toNoLocalImageSrc;
let purifierInstance: ReturnType<typeof DOMPurify> | null = null;

function getPurifier() {
    if (purifierInstance !== null) {
        return purifierInstance;
    }
    const purifier = DOMPurify(globalThis.window);
    // An image's address is resolved HERE, not by DOMPurify's own address
    // check, which knows nothing of a file on this machine and would drop
    // `C:\notes\map.png` along with `javascript:`. It is taken off in the
    // attribute pass and put back, already resolved, once that pass is over.
    const imageSrcMap = new WeakMap<Element, string>();
    purifier.addHook('uponSanitizeAttribute', (node, hookEvent) => {
        const { attrName, attrValue } = hookEvent;
        if (attrName === 'src' && node.nodeName === 'IMG') {
            imageSrcMap.set(node, toImageSrc(attrValue, activeToLocalImageSrc));
            hookEvent.keepAttr = false;
        } else if (attrName === 'style') {
            hookEvent.keepAttr = TEXT_ALIGN_STYLE_REGEX.test(attrValue);
        } else if (attrName === 'class') {
            hookEvent.attrValue = attrValue
                .split(/\s+/)
                .filter((className) => {
                    return KEPT_CLASS_REGEX.test(className);
                })
                .join(' ');
        } else if (
            (attrName === 'id' || attrName === 'name') &&
            RESERVED_ID_REGEX.test(attrValue)
        ) {
            hookEvent.keepAttr = false;
        }
    });
    purifier.addHook('afterSanitizeAttributes', (node) => {
        if (node.nodeName !== 'IMG') {
            return;
        }
        const src = imageSrcMap.get(node) ?? '';
        if (src !== '') {
            node.setAttribute('src', src);
        }
        // A long document full of pictures loads the ones scrolled to.
        node.setAttribute('loading', 'lazy');
    });
    purifierInstance = purifier;
    return purifier;
}

export function sanitizePreviewHtml(
    html: string,
    toLocalImageSrc: ToLocalImageSrcType,
) {
    const purifier = getPurifier();
    // Read by the hooks, which cannot be handed an argument. The pass is
    // synchronous, so no other render can be in the middle of one.
    activeToLocalImageSrc = toLocalImageSrc;
    try {
        return purifier.sanitize(html, SANITIZE_CONFIG);
    } finally {
        activeToLocalImageSrc = toNoLocalImageSrc;
    }
}

function genMarkdownIt() {
    const markdownIt = new MarkdownIt({
        // Parsed, then sanitized -- see the top of this file.
        html: true,
        linkify: true,
        typographer: false,
    });
    const { rules } = markdownIt.renderer;

    const renderFenceDefault = rules.fence!;
    rules.fence = (tokens, index, options, env, self) => {
        const token = tokens[index];
        const language = token.info.trim().split(/\s+/)[0]?.toLowerCase();
        if (language !== 'mermaid') {
            return renderFenceDefault(tokens, index, options, env, self);
        }
        const mermaidIndex = env.mermaidSources.push(token.content) - 1;
        // The code, drawn as code, until the diagram replaces it -- which is
        // also exactly what stays if the diagram cannot be drawn.
        return (
            `<div class="app-markdown-mermaid" ` +
            `data-mermaid-index="${mermaidIndex}"><pre><code>` +
            `${markdownIt.utils.escapeHtml(token.content)}` +
            `</code></pre></div>\n`
        );
    };

    rules.heading_open = (tokens, index, options, _env, self) => {
        const env = _env as MarkdownPreviewRenderEnvType;
        const inlineToken = tokens[index + 1];
        const text = (inlineToken?.children ?? [])
            .filter((child) => {
                return child.type === 'text' || child.type === 'code_inline';
            })
            .map((child) => {
                return child.content;
            })
            .join('');
        const slug = toHeadingSlug(text);
        if (slug !== '') {
            // `#usage` is the first "Usage", `#usage-1` the second: GitHub's
            // numbering, so links written against it land.
            const count = env.headingSlugCounts.get(slug) ?? 0;
            env.headingSlugCounts.set(slug, count + 1);
            const uniqueSlug = count === 0 ? slug : `${slug}-${count}`;
            tokens[index].attrSet('id', toHeadingElementId(uniqueSlug));
        }
        return self.renderToken(tokens, index, options);
    };

    rules.table_open = () => {
        return '<div class="app-markdown-table"><table>\n';
    };
    rules.table_close = () => {
        return '</table></div>\n';
    };
    return markdownIt;
}

// One parser for the window: building one sets up every rule table, and a
// preview re-renders on each save of the file it is showing.
let markdownItInstance: MarkdownIt | null = null;

export function renderPreviewMarkdown(
    text: string,
    toLocalImageSrc: ToLocalImageSrcType,
): MarkdownPreviewRenderResultType {
    markdownItInstance ??= genMarkdownIt();
    const env: MarkdownPreviewRenderEnvType = {
        mermaidSources: [],
        headingSlugCounts: new Map(),
    };
    const html = sanitizePreviewHtml(
        markdownItInstance.render(text, env),
        toLocalImageSrc,
    );
    return { html, mermaidSources: env.mermaidSources };
}
