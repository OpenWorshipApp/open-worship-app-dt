/**
 * A document's pages as `documentWordsRules.ts` reads them: boxes of lines,
 * where each box sits, which face its letters are drawn in, and the pictures
 * on the page. One parser per kind, each over what the app ALREADY makes of
 * that kind -- the HTML `pptx-to-html-conv` / `docx-to-html-conv` write
 * beside the file (the user: _since we have tool to convert pptx to html
 * then it should convert then extract_), MuPDF's text of a PDF page, a slide
 * document's own JSON.
 *
 * A parsed copy, never the live page: `DOMParser` builds a detached document
 * whose scripts do not run and whose images do not load.
 */
import type {
    DocumentWordsPageType,
    DocumentWordsPictureType,
    DocumentWordsShapeType,
} from './documentWordsRules';

const BLOCK_TAG_LIST = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const DOCX_BLOCK_SELECTOR = BLOCK_TAG_LIST.join(', ');

/** `'Battambang', 'Arial', sans-serif` -> `Battambang`. */
export function toFirstFontFamily(value: string | null | undefined) {
    const first = (value ?? '').split(',')[0] ?? '';
    const family = first.replace(/^[\s"']+|[\s"']+$/g, '');
    return family === '' || /^(?:inherit|initial|unset)$/i.test(family)
        ? null
        : family;
}

function readStyleFontFamily(element: Element | null) {
    const style = element?.getAttribute('style') ?? '';
    const matched = /font-family\s*:\s*([^;]+)/i.exec(style);
    return matched === null ? null : toFirstFontFamily(matched[1]);
}

/** The face a text node is drawn in: the nearest box that names one. */
function findFontFamily(node: Node, stopAt: Element | null) {
    let element: Element | null = node.parentElement;
    while (element !== null) {
        const family = readStyleFontFamily(element);
        if (family !== null) {
            return family;
        }
        if (element === stopAt) {
            break;
        }
        element = element.parentElement;
    }
    return null;
}

function countVisibleLetters(text: string) {
    return text.replace(/\s/g, '').length;
}

/**
 * An element's words as LINES (a `<br>` breaks one) and the letters drawn
 * in each face. `defaultFamily` is what a run naming no face is drawn in.
 */
function readElementLines(
    element: Element,
    defaultFamily: string | null,
    fontCountMap: Record<string, number>,
) {
    const lines: string[] = [''];
    const walk = (node: Node) => {
        if (node.nodeType === 3) {
            const text = node.textContent ?? '';
            lines[lines.length - 1] += text;
            const family = findFontFamily(node, element) ?? defaultFamily;
            const count = countVisibleLetters(text);
            if (family !== null && count > 0) {
                fontCountMap[family] = (fontCountMap[family] ?? 0) + count;
            }
            return;
        }
        if (node.nodeType !== 1) {
            return;
        }
        const tagName = (node as Element).tagName.toLowerCase();
        if (tagName === 'br') {
            lines.push('');
            return;
        }
        if (tagName === 'script' || tagName === 'style') {
            return;
        }
        for (const child of Array.from(node.childNodes)) {
            walk(child);
        }
    };
    walk(element);
    return lines;
}

function toNumber(value: string | null | undefined, fallback = 0) {
    const parsed = Number.parseFloat(value ?? '');
    return Number.isFinite(parsed) ? parsed : fallback;
}

/** Every `translate(x,y)` from the box up to the page, added up. */
function readTranslate(element: Element) {
    let x = 0;
    let y = 0;
    let current: Element | null = element;
    while (current !== null) {
        const transform = current.getAttribute('transform') ?? '';
        const matched =
            /translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)/i.exec(
                transform,
            );
        if (matched !== null) {
            x += toNumber(matched[1]);
            y += toNumber(matched[2]);
        }
        current = current.parentElement;
    }
    return { x, y };
}

const SIZED_TAG_SET = new Set(['rect', 'foreignobject', 'image', 'img']);

// By lower-cased tag name rather than a selector: `foreignObject` is an SVG
// element with a camel-cased name, and how a selector matches its case in
// an HTML document is not something to lean on (jsdom misses it).
function readBoxSize(group: Element) {
    const sized =
        Array.from(group.getElementsByTagName('*')).find((element) => {
            return (
                SIZED_TAG_SET.has(element.tagName.toLowerCase()) &&
                element.getAttribute('width') !== null
            );
        }) ?? null;
    return {
        width: toNumber(sized?.getAttribute('width')),
        height: toNumber(sized?.getAttribute('height')),
    };
}

/**
 * One slide of `pptx-to-html-conv`'s HTML. Each shape is a `<g data-id>`
 * moved into place by `translate(x,y)`, sized by its first `rect` /
 * `foreignObject`, its text in `<p>`s of `<span>`s naming their face, a
 * picture an `<img>` (or an SVG `<image>`) inside it.
 */
export function parsePptxSlideHtml(
    html: string,
    page: { number: number; isHidden: boolean; width: number; height: number },
): DocumentWordsPageType {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const shapes: DocumentWordsShapeType[] = [];
    const pictures: DocumentWordsPictureType[] = [];
    for (const group of Array.from(doc.querySelectorAll('g[data-id]'))) {
        // A group inside another is read as part of the outer one's words
        // only when it holds no box of its own; its own box is its own shape.
        const { x, y } = readTranslate(group);
        const { width, height } = readBoxSize(group);
        if (group.querySelector('img, image') !== null) {
            pictures.push({ x, y, width, height });
        }
        const paragraphs = Array.from(group.querySelectorAll('p')).filter(
            (paragraph) => {
                return paragraph.closest('g[data-id]') === group;
            },
        );
        if (paragraphs.length === 0) {
            continue;
        }
        const fontCountMap: Record<string, number> = {};
        const lines = paragraphs.flatMap((paragraph) => {
            return readElementLines(
                paragraph,
                readStyleFontFamily(paragraph),
                fontCountMap,
            );
        });
        shapes.push({ x, y, width, height, lines, fontCountMap });
    }
    return { ...page, shapes, pictures };
}

/**
 * One page of `docx-to-html-conv`'s HTML: paragraphs, list items and
 * headings in order, an empty paragraph parting stanzas. A heading is a box
 * of its own (`isHeading`), so a song's title over its words is not sung.
 * The page's own body face is what a run naming none is drawn in.
 */
export function parseDocxPageHtml(
    html: string,
    page: { number: number; width: number; height: number },
): DocumentWordsPageType {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const bodyFamily = readStyleFontFamily(doc.body);
    const shapes: DocumentWordsShapeType[] = [];
    const pictures: DocumentWordsPictureType[] = [];
    let body: DocumentWordsShapeType | null = null;
    let order = 0;
    const blocks = Array.from(doc.querySelectorAll(DOCX_BLOCK_SELECTOR)).filter(
        (element) => {
            // A list item holding a paragraph is read once, by the paragraph.
            return element.querySelector(DOCX_BLOCK_SELECTOR) === null;
        },
    );
    for (const element of blocks) {
        order += 1;
        const fontCountMap: Record<string, number> = {};
        const lines = readElementLines(
            element,
            readStyleFontFamily(element) ?? bodyFamily,
            fontCountMap,
        );
        if (/^h[1-6]$/i.test(element.tagName)) {
            body = null;
            shapes.push({
                x: 0,
                y: order,
                width: page.width,
                height: 1,
                lines,
                fontCountMap,
                isHeading: true,
            });
            continue;
        }
        if (body === null) {
            body = {
                x: 0,
                y: order,
                width: page.width,
                height: 1,
                lines: [],
                fontCountMap: {},
            };
            shapes.push(body);
        }
        body.lines.push(...lines);
        body.height += 1;
        for (const [family, count] of Object.entries(fontCountMap)) {
            body.fontCountMap[family] =
                (body.fontCountMap[family] ?? 0) + count;
        }
    }
    for (const image of Array.from(doc.querySelectorAll('img'))) {
        pictures.push({
            x: 0,
            y: 0,
            width: toNumber(
                image.getAttribute('width') ??
                    /width\s*:\s*([\d.]+)px/i.exec(
                        image.getAttribute('style') ?? '',
                    )?.[1],
            ),
            height: toNumber(
                image.getAttribute('height') ??
                    /height\s*:\s*([\d.]+)px/i.exec(
                        image.getAttribute('style') ?? '',
                    )?.[1],
            ),
        });
    }
    return { ...page, isHidden: false, shapes, pictures };
}

/**
 * One PDF page's text as MuPDF reads it (`pdf-to-chat-images.mjs`
 * `pageTexts`). A page with no text at all is a scan: the page itself is
 * the picture to read.
 */
export function parsePdfPageText(
    text: string | null,
    page: { number: number; width: number; height: number },
): DocumentWordsPageType {
    const lines = (text ?? '').split(/\r?\n/);
    const isEmpty = lines.every((line) => {
        return line.trim() === '';
    });
    return {
        ...page,
        isHidden: false,
        shapes: isEmpty
            ? []
            : [
                  {
                      x: 0,
                      y: 0,
                      width: page.width,
                      height: page.height,
                      lines,
                      fontCountMap: {},
                  },
              ],
        pictures: isEmpty
            ? [{ x: 0, y: 0, width: page.width, height: page.height }]
            : [],
    };
}

function readHtmlItemLines(html: string) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fontCountMap: Record<string, number> = {};
    const lines: string[] = [];
    const blocks = Array.from(doc.body.querySelectorAll('p, div, li')).filter(
        (element) => {
            return element.querySelector('p, div, li') === null;
        },
    );
    const targets = blocks.length > 0 ? blocks : [doc.body];
    for (const element of targets) {
        lines.push(
            ...readElementLines(
                element,
                readStyleFontFamily(element),
                fontCountMap,
            ),
        );
    }
    return { lines, fontCountMap };
}

/**
 * One slide of a slide document (`.ows`): its text boxes (`type: "text"`,
 * the words with their own line breaks and ONE face), its HTML boxes, its
 * pictures (`type: "image"`). A Bible box is the app's own verse, not the
 * slide's words.
 */
export function parseAppDocumentSlide(
    slide: any,
    page: { number: number; width: number; height: number },
): DocumentWordsPageType {
    const shapes: DocumentWordsShapeType[] = [];
    const pictures: DocumentWordsPictureType[] = [];
    const canvasItems: any[] = Array.isArray(slide?.canvasItems)
        ? slide.canvasItems
        : [];
    for (const item of canvasItems) {
        if (item === null || typeof item !== 'object') {
            continue;
        }
        const box = {
            x: toNumber(item.left),
            y: toNumber(item.top),
            width: toNumber(item.width),
            height: toNumber(item.height),
        };
        if (item.type === 'image') {
            pictures.push(box);
            continue;
        }
        if (item.type === 'text' && typeof item.text === 'string') {
            const family = toFirstFontFamily(item.fontFamily);
            const count = countVisibleLetters(item.text);
            shapes.push({
                ...box,
                lines: item.text.split(/\r?\n/),
                fontCountMap:
                    family === null || count === 0 ? {} : { [family]: count },
            });
            continue;
        }
        const html =
            typeof item.html === 'string'
                ? item.html
                : typeof item.htmlText === 'string'
                  ? item.htmlText
                  : null;
        if (item.type === 'html' && html !== null) {
            shapes.push({ ...box, ...readHtmlItemLines(html) });
        }
    }
    return {
        ...page,
        isHidden: slide?.isDisabled === true,
        shapes,
        pictures,
    };
}
