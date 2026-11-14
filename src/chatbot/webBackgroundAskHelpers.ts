/**
 * A background WEB PAGE asked for in an ordinary chat (2026-11-12, EC-518;
 * the user's goal: _chatbot will be very smart to help user create … background
 * resoures_). _Make a background web page with a soft blue gradient_ had been
 * answered, on Auto, with the Webs tab's steps: the one tool that writes a
 * page into the Webs folder, `owa_media_file`, is withheld from the model,
 * because a misread ask must never rename or trash someone's pictures and
 * clips (`modelTools.mjs`).
 *
 * So the model is handed no tool. It is asked to WRITE the page, HTML and CSS
 * in one fenced block; the WINDOW takes the block out of the answer, makes it
 * safe (`toSafeWebPage`: no script, no frame, nothing loaded from anywhere)
 * and makes it as a NEW page in Webs -- `create` never writes over a file --
 * with **Undo this change** under the answer.
 *
 * English in code (EC-516). Pure but for `toSafeWebPage`, which needs a DOM.
 */
import createDOMPurify from 'dompurify';

import { readAskedName } from './documentCreateHelpers';

export const MEDIA_FILE_TOOL_NAME = 'owa_media_file';

export type WebBackgroundAskType = {
    /** The name asked for, or null for one made from the day. */
    name: string | null;
    /** What the page is to show, in their words; '' when nothing was said. */
    description: string;
};

const MAX_ASK_LENGTH = 600;
const MAX_NAME_LENGTH = 60;
const MAX_PAGE_LENGTH = 60_000;

const HOW_TO_PATTERN =
    /^\s*(?:how|where|what|why|when|which|who|is there|are there|is it|does|do i|can i|could i|should i|may i)\b/i;
const POLITE_LEAD_PATTERN =
    /^\s*(?:(?:please|pls|kindly)\s+|(?:can|could|would|will)\s+you\s+(?:please\s+)?)+/i;
const REQUEST_PATTERN =
    /^(?:i\s+(?:need|want|would\s+like)|make|create|build|design|write|generate|give\s+me|get\s+me|draw)\s+(?:me\s+|us\s+)?/i;
// What the page IS: a web page for the background, in the ways it is said.
const NOUN_PATTERN = new RegExp(
    [
        String.raw`(?:a|an|one)\s+(?:new\s+)?(?:(?:animated|moving|simple|nice|beautiful|plain)\s+)?`,
        '(?:',
        [
            String.raw`background\s+web\s*page`,
            String.raw`web\s*page\s+background`,
            String.raw`web\s+background`,
            String.raw`html\s+(?:background|page\s+(?:background|for\s+the\s+background))`,
            String.raw`web\s*page\s+for\s+(?:the|a|my|our)\s+background`,
            String.raw`webs?\s+(?:tab\s+)?page`,
        ].join('|'),
        String.raw`)\b`,
    ].join(''),
    'i',
);

function toAskLine(text: string) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/[‘’ʼ]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Whether a line asks for a NEW background web page, its name and what it
 * shows. Null for anything else -- a how-to above all, and a picture or a
 * video background, which are files of the person's own.
 */
export function readWebBackgroundAsk(
    text: string,
): WebBackgroundAskType | null {
    const line = toAskLine(text);
    if (
        line === '' ||
        line.startsWith('/') ||
        line.length > MAX_ASK_LENGTH ||
        HOW_TO_PATTERN.test(line)
    ) {
        return null;
    }
    const asked = line.replace(POLITE_LEAD_PATTERN, '');
    const request = REQUEST_PATTERN.exec(asked);
    if (request === null) {
        return null;
    }
    const afterVerb = asked.slice(request[0].length);
    const noun = NOUN_PATTERN.exec(afterVerb);
    if (noun === null || noun.index !== 0) {
        return null;
    }
    const afterNoun = afterVerb.slice(noun[0].length);
    const named = readAskedName(afterNoun);
    const name =
        named.name !== null && named.name.length <= MAX_NAME_LENGTH
            ? named.name
            : null;
    const description = (
        named.start >= 0
            ? afterNoun.slice(0, named.start) + ' ' + afterNoun.slice(named.end)
            : afterNoun
    )
        .replace(
            /^[\s,:;-]*(?:with|showing|saying|that\s+(?:shows|has|says|reads)|of|for)?\s*/i,
            '',
        )
        .replace(/[\s.!?]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    return { name, description };
}

/** The name a page gets when the ask names none. */
export function genDefaultWebPageName(date: Date) {
    const day = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
    return `Background ${day}`;
}

/**
 * What the model is told on the ask alone: write the page, in ONE block,
 * with nothing a projector cannot show on its own.
 */
export function genWebBackgroundHint(name: string) {
    return (
        '(They asked for a NEW background web page, which the window will ' +
        `save in the Webs tab as "${name}" from what you write. Do not tell ` +
        'them how to make one by hand and call no tool to make it. Write ' +
        'the whole page as ONE complete HTML document in a single fenced ' +
        '```html block: HTML and CSS only -- no script, no on* attribute, ' +
        'no iframe, and nothing loaded from anywhere (no link, no web font, ' +
        'no picture or video by address; draw with CSS gradients, shapes ' +
        'and text). It fills the whole screen at any size (html and body ' +
        '100% wide and high, margin 0, overflow hidden), any words on it ' +
        'large enough to read from the back of a church. It runs for a ' +
        'whole service on an old computer: anything that moves is slow, ' +
        'and moves ONLY by animating transform or opacity -- an element ' +
        'larger than the screen slid or turned, never an animated ' +
        'background, background-position, colour, filter or shadow, ' +
        'which repaint the whole screen every frame. Before the block ' +
        'write ONE ' +
        'short sentence saying what it shows; nothing after it, and no ' +
        'OPTIONS line.)'
    );
}

const HTML_BLOCK_PATTERN = /```[ \t]*html[^\n]*\n([\s\S]*?)```/i;

/**
 * The page in an answer, and the answer without it -- null when the answer
 * holds no ```html block, or one that is no page.
 */
export function readHtmlBlock(answer: string) {
    const match = HTML_BLOCK_PATTERN.exec(String(answer ?? ''));
    if (match === null) {
        return null;
    }
    const html = match[1].trim();
    if (
        html.length === 0 ||
        html.length > MAX_PAGE_LENGTH ||
        !/<(?:html|body|style|div|svg|main|section)\b/i.test(html)
    ) {
        return null;
    }
    const rest = (
        answer.slice(0, match.index) +
        answer.slice(match.index + match[0].length)
    )
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return { html, rest };
}

// A CSS address that would load something: every url() but a data: one
// (a gradient needs none, and a data: picture loads nothing), and @import.
const CSS_REMOTE_URL_PATTERN =
    /url\(\s*(?!["']?\s*data:)[^)]*\)|@import\b[^;]*;?/gi;

function toQuietCss(css: string) {
    return css.replace(CSS_REMOTE_URL_PATTERN, 'none');
}

/**
 * The page as it may be saved: one whole document, nothing that runs and
 * nothing that loads. DOMPurify takes the scripts, frames, event attributes
 * and `javascript:` addresses; every `src`, `href`, `srcset`, `poster` and
 * `action` goes, and a stylesheet keeps no address but a `data:` one.
 */
export function toSafeWebPage(html: string, title: string) {
    if (!globalThis.window?.document) {
        throw new Error('HTML sanitization requires a DOM');
    }
    const purifier = createDOMPurify(globalThis.window);
    purifier.addHook('uponSanitizeAttribute', (_node, event) => {
        if (
            /^(?:src|href|xlink:href|srcset|poster|action|formaction|background|ping|srcdoc)$/i.test(
                event.attrName,
            )
        ) {
            event.keepAttr = false;
            return;
        }
        if (event.attrName === 'style') {
            event.attrValue = toQuietCss(event.attrValue);
        }
    });
    purifier.addHook('uponSanitizeElement', (node) => {
        if (node.nodeName.toLowerCase() === 'style' && node.textContent) {
            node.textContent = toQuietCss(node.textContent);
        }
    });
    const clean = String(
        purifier.sanitize(html, {
            WHOLE_DOCUMENT: true,
            ADD_TAGS: ['style'],
            FORBID_TAGS: [
                'script',
                'iframe',
                'frame',
                'frameset',
                'object',
                'embed',
                'base',
                'link',
                'meta',
                'form',
                'input',
                'button',
                'textarea',
                'select',
                'img',
                'video',
                'audio',
                'source',
                'track',
                'picture',
                'portal',
            ],
            RETURN_TRUSTED_TYPE: false,
        }),
    );
    const parsed = new globalThis.window.DOMParser().parseFromString(
        clean,
        'text/html',
    );
    const styles = [...parsed.head.querySelectorAll('style')]
        .map((one) => {
            return one.textContent ?? '';
        })
        .join('\n');
    const safeTitle = String(title).replace(/[<>&"]/g, '');
    return [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '    <meta charset="UTF-8">',
        `    <title>${safeTitle}</title>`,
        '    <style>',
        'html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }',
        styles,
        '    </style>',
        '</head>',
        `<body${toBodyAttributes(parsed.body)}>`,
        parsed.body.innerHTML.trim(),
        '</body>',
        '</html>',
        '',
    ].join('\n');
}

function toBodyAttributes(body: HTMLElement) {
    return [...body.attributes]
        .filter((one) => {
            return /^(?:class|style|id)$/i.test(one.name);
        })
        .map((one) => {
            return ` ${one.name}="${one.value.replace(/"/g, '&quot;')}"`;
        })
        .join('');
}
