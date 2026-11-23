import {
    escapeXMLAttribute,
    escapeXMLText,
} from '../ms-office/officeXmlHelpers';
import {
    classifyMarkdownHref,
    toHeadingElementId,
} from './markdownPreviewRenderHelpers';

/**
 * The Markdown Preview's page as a Word document (2026-11-14, the user: _add
 * ms-word icon to click and export to microsoft word, like printing it has to
 * ask for add name/location-name bible detail at the end of last page_).
 *
 * The page is read as it is DRAWN -- the HTML the window shows, its diagrams
 * already drawn and its verses, people and places already made links -- and
 * written as WordprocessingML: headings, paragraphs, lists, quotes, code,
 * tables, links and pictures as Word's own, so the document can be edited,
 * not a picture of the page. Taking the page apart is synchronous
 * (`snapshotMarkdownWordPage`): the page is held only while it is read, and
 * the pictures, which take time, are loaded after it is let go
 * (`markdownWordExportHelpers.ts`). Imported only when Word is pressed.
 */

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const WORD_NAMESPACE =
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const RELATIONSHIP_NAMESPACE =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const DRAWING_NAMESPACE =
    'http://schemas.openxmlformats.org/drawingml/2006/main';
const PICTURE_NAMESPACE =
    'http://schemas.openxmlformats.org/drawingml/2006/picture';
const WORD_DRAWING_NAMESPACE =
    'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const PACKAGE_RELATIONSHIP_NAMESPACE =
    'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_RELATIONSHIP_TYPE =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// A page's inch is 1440 twips and 96 CSS pixels; a pixel is 9525 EMU.
const TWIPS_PER_PIXEL = 15;
const EMU_PER_PIXEL = 9525;
const PAGE_MARGIN_TWIPS = 1440;
const LIST_INDENT_TWIPS = 720;
const QUOTE_INDENT_TWIPS = 360;
// Word numbers nine levels of a list; a list nested deeper stays at the last.
const MAX_LIST_LEVEL = 8;

// The countries that print on Letter; everywhere else prints on A4.
const LETTER_REGION_SET = new Set([
    'US',
    'CA',
    'MX',
    'PH',
    'CL',
    'CO',
    'VE',
    'PR',
    'GT',
    'CR',
    'PA',
    'DO',
    'SV',
    'NI',
    'HN',
]);

export type WordPageSizeType = {
    widthTwips: number;
    heightTwips: number;
};

/** The paper the person's region prints on: Letter, else A4. */
export function genWordPageSize(locale?: string): WordPageSizeType {
    let region: string | undefined;
    try {
        const localeName =
            locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
        region = new Intl.Locale(localeName).maximize().region;
    } catch {
        region = undefined;
    }
    if (region !== undefined && LETTER_REGION_SET.has(region)) {
        return { widthTwips: 12240, heightTwips: 15840 };
    }
    return { widthTwips: 11906, heightTwips: 16838 };
}

/** The room between the margins, in CSS pixels: a picture fits in it. */
export function toWordContentBox(pageSize: WordPageSizeType) {
    return {
        width: Math.floor(
            (pageSize.widthTwips - 2 * PAGE_MARGIN_TWIPS) / TWIPS_PER_PIXEL,
        ),
        height: Math.floor(
            (pageSize.heightTwips - 2 * PAGE_MARGIN_TWIPS) / TWIPS_PER_PIXEL,
        ),
    };
}

export type WordPictureSourceType =
    | {
          // A diagram drawn on the page: its SVG, at the size it is drawn.
          kind: 'svg';
          svgText: string;
          width: number;
          height: number;
      }
    | {
          // A picture: its address, and the width the page gave it, if any.
          kind: 'src';
          src: string;
          width: number | null;
      };

export type WordPictureType = {
    source: WordPictureSourceType;
    // What is written in its place when it cannot be put in the document.
    alt: string;
};

export type WordListType = {
    kind: 'bullet' | 'decimal';
    level: number;
    start: number;
};

export type WordPageSnapshotType = {
    // `word/document.xml`'s body, each picture a token until it is loaded.
    bodyXml: string;
    pictures: WordPictureType[];
    // Web addresses the page links, `rIdLink<n>` from 1.
    links: string[];
    // One numbering per list, `numId` from 1.
    lists: WordListType[];
    pageSize: WordPageSizeType;
};

/** A picture put in the package, or null when it could not be. */
export type WordPlacedPictureType = {
    fileName: string;
    width: number;
    height: number;
} | null;

type RunStyleType = {
    isBold?: boolean;
    isItalic?: boolean;
    isUnderline?: boolean;
    isStrike?: boolean;
    isCode?: boolean;
    isHighlight?: boolean;
    vertAlign?: 'superscript' | 'subscript';
    // `r:<relationship id>` for a web address, `a:<bookmark>` for a heading.
    link?: string;
};

type RunType =
    | { kind: 'text'; text: string; style: RunStyleType }
    | { kind: 'break'; style: RunStyleType }
    | { kind: 'tab'; style: RunStyleType }
    | { kind: 'picture'; index: number; style: RunStyleType };

type ListItemStateType = {
    numId: number;
    level: number;
    // The item's first paragraph carries its bullet or number; the rest
    // are indented under it.
    isNumbered: boolean;
};

type BlockType = {
    styleId?: string;
    align?: 'left' | 'center' | 'right' | 'both';
    quoteDepth: number;
    indentSteps: number;
    listItem?: ListItemStateType;
    bookmark?: string;
    isInTable?: boolean;
};

type WalkContextType = {
    block: BlockType;
    run: RunStyleType;
    listDepth: number;
    isPre: boolean;
};

/**
 * What an installed language says of a piece of text -- the face its words
 * are written in, and whether it reads right to left -- or null when no
 * installed language claims it. Every language is the same here: each
 * package's own script facts decide (`checkIsThisLang`).
 */
export type WordTextLangType = { fontFamily: string | null; isRtl: boolean };
export type WordTextLangPickerType = (text: string) => WordTextLangType | null;

// eslint-disable-next-line no-control-regex -- a NUL never reaches the XML from text
const PICTURE_TOKEN_REGEX = /\u0000P(\d+)\u0000/g;
const COLLAPSIBLE_SPACE_REGEX = /[ \t\n\r\f]+/g;
const FIRST_LETTER_REGEX = /\p{L}/u;

const SKIPPED_TAG_SET = new Set([
    'script',
    'style',
    'template',
    'noscript',
    'button',
    'input',
    'select',
    'textarea',
    'iframe',
    'object',
    'embed',
    'video',
    'audio',
    'canvas',
    'head',
]);

const BLOCK_TAG_SET = new Set([
    'address',
    'article',
    'aside',
    'center',
    'dd',
    'details',
    'div',
    'dl',
    'dt',
    'figcaption',
    'figure',
    'footer',
    'header',
    'main',
    'nav',
    'p',
    'section',
    'summary',
]);

const INLINE_STYLE_MAP: Record<string, RunStyleType> = {
    strong: { isBold: true },
    b: { isBold: true },
    em: { isItalic: true },
    i: { isItalic: true },
    cite: { isItalic: true },
    dfn: { isItalic: true },
    var: { isItalic: true },
    u: { isUnderline: true },
    ins: { isUnderline: true },
    s: { isStrike: true },
    del: { isStrike: true },
    strike: { isStrike: true },
    code: { isCode: true },
    kbd: { isCode: true },
    samp: { isCode: true },
    tt: { isCode: true },
    mark: { isHighlight: true },
    sup: { vertAlign: 'superscript' },
    sub: { vertAlign: 'subscript' },
    summary: { isBold: true },
    dt: { isBold: true },
};

// The page's own marks this writer reads (`markdownMermaidHelpers.ts`,
// `markdownPrintHelpers.ts`).
const MERMAID_CLASS_NAME = 'app-markdown-mermaid';
const MERMAID_DRAWN_CLASS_NAME = 'app-markdown-mermaid--rendered';
// A dark window's diagram whose light picture, drawn for paper, follows it.
const MERMAID_HAS_PRINT_CLASS_NAME = 'app-markdown-mermaid--has-print';
const PRINT_APPENDIX_CLASS_NAME = 'app-markdown-print-appendix';

function toPictureToken(index: number) {
    return `\u0000P${index}\u0000`;
}

function readAlign(element: Element): BlockType['align'] | undefined {
    const value = (
        (element as HTMLElement).style?.textAlign ||
        element.getAttribute('align') ||
        ''
    ).toLowerCase();
    if (value === 'center' || value === 'right' || value === 'left') {
        return value;
    }
    if (value === 'justify') {
        return 'both';
    }
    return undefined;
}

function genRunPropsXml(
    style: RunStyleType,
    fontFamily: string | null,
    isRtl: boolean,
) {
    // `CT_RPr` fixes the child order.
    const partList: string[] = [];
    if (style.link !== undefined) {
        partList.push('<w:rStyle w:val="Hyperlink"/>');
    } else if (style.isCode) {
        partList.push('<w:rStyle w:val="VerbatimChar"/>');
    }
    if (fontFamily !== null) {
        const name = escapeXMLAttribute(fontFamily);
        partList.push(
            `<w:rFonts w:ascii="${name}" w:hAnsi="${name}" ` +
                `w:eastAsia="${name}" w:cs="${name}"/>`,
        );
    }
    if (style.isBold) {
        partList.push('<w:b/><w:bCs/>');
    }
    if (style.isItalic) {
        partList.push('<w:i/><w:iCs/>');
    }
    if (style.isStrike) {
        partList.push('<w:strike/>');
    }
    if (style.isHighlight) {
        partList.push('<w:highlight w:val="yellow"/>');
    }
    if (style.isUnderline && style.link === undefined) {
        partList.push('<w:u w:val="single"/>');
    }
    if (style.vertAlign !== undefined) {
        partList.push(`<w:vertAlign w:val="${style.vertAlign}"/>`);
    }
    if (isRtl) {
        partList.push('<w:rtl/>');
    }
    return partList.length === 0 ? '' : `<w:rPr>${partList.join('')}</w:rPr>`;
}

function genParagraphPropsXml(block: BlockType, isRtl: boolean) {
    // `CT_PPr` fixes the child order.
    const partList: string[] = [];
    if (block.styleId !== undefined) {
        partList.push(`<w:pStyle w:val="${block.styleId}"/>`);
    }
    const listItem = block.listItem;
    let indentTwips: number | null = null;
    if (listItem !== undefined && !listItem.isNumbered) {
        listItem.isNumbered = true;
        partList.push(
            `<w:numPr><w:ilvl w:val="${listItem.level}"/>` +
                `<w:numId w:val="${listItem.numId}"/></w:numPr>`,
        );
    } else if (listItem !== undefined) {
        indentTwips = LIST_INDENT_TWIPS * (listItem.level + 1);
    } else if (block.quoteDepth > 1 || block.indentSteps > 0) {
        indentTwips =
            QUOTE_INDENT_TWIPS * block.quoteDepth +
            LIST_INDENT_TWIPS * block.indentSteps;
    }
    if (isRtl) {
        partList.push('<w:bidi/>');
    }
    if (block.isInTable) {
        partList.push('<w:spacing w:before="40" w:after="40"/>');
    }
    if (indentTwips !== null) {
        partList.push(`<w:ind w:left="${indentTwips}"/>`);
    }
    if (block.align !== undefined) {
        partList.push(`<w:jc w:val="${block.align}"/>`);
    }
    return partList.length === 0 ? '' : `<w:pPr>${partList.join('')}</w:pPr>`;
}

function genLinkStartXml(link: string) {
    const value = escapeXMLAttribute(link.slice(2));
    return link.startsWith('r:')
        ? `<w:hyperlink r:id="${value}" w:history="1">`
        : `<w:hyperlink w:anchor="${value}" w:history="1">`;
}

/** The size a picture is put in the document at: its own, made to fit. */
export function fitWordPictureSize(
    width: number,
    height: number,
    maxBox: { width: number; height: number },
) {
    if (!(width > 0) || !(height > 0)) {
        return null;
    }
    const scale = Math.min(1, maxBox.width / width, maxBox.height / height);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

function readPictureAlt(element: Element, src: string) {
    const alt = (element.getAttribute('alt') ?? '').trim();
    if (alt !== '' || src.startsWith('data:')) {
        return alt;
    }
    // The file's own name says what was there.
    const pathPart = src.split(/[?#]/)[0];
    try {
        return decodeURIComponent(pathPart.split('/').at(-1) ?? '');
    } catch {
        return pathPart.split('/').at(-1) ?? '';
    }
}

/**
 * The SVG of a diagram drawn on the page, sized as drawn. A dark window's
 * light picture for paper is not on screen, so its size comes from its
 * `viewBox` -- which mermaid gives the size it drew it at.
 */
function readViewBoxSize(svgElement: SVGSVGElement) {
    const viewBox = svgElement.viewBox?.baseVal;
    if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
        return { width: viewBox.width, height: viewBox.height };
    }
    const partList = (svgElement.getAttribute('viewBox') ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
    if (partList.length === 4 && partList[2] > 0 && partList[3] > 0) {
        return { width: partList[2], height: partList[3] };
    }
    return { width: 0, height: 0 };
}

function readSvgPicture(
    svgElement: SVGSVGElement,
): WordPictureSourceType | null {
    let { width, height } = readViewBoxSize(svgElement);
    if (!(width > 0 && height > 0)) {
        const rect = svgElement.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
    }
    if (!(width > 0 && height > 0)) {
        return null;
    }
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.style.removeProperty('max-width');
    // As drawn, not as moved or zoomed in the window
    // (`markdownMermaidViewHelpers.ts`).
    clone.style.removeProperty('transform');
    clone.style.removeProperty('transform-origin');
    delete clone.dataset.appView;
    if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    return {
        kind: 'svg',
        svgText: new XMLSerializer().serializeToString(clone),
        width,
        height,
    };
}

class WordPageWriter {
    readonly pictures: WordPictureType[] = [];
    readonly links: string[] = [];
    readonly lists: WordListType[] = [];
    private partList: string[] = [];
    private runList: RunType[] = [];
    private paragraphBlock: BlockType | null = null;
    private bookmarkId = 0;
    private readonly linkIdMap = new Map<string, string>();
    private readonly bookmarkMap: Map<string, string>;
    private readonly pickTextLang: WordTextLangPickerType;
    private readonly pageSize: WordPageSizeType;

    constructor(
        bookmarkMap: Map<string, string>,
        pickTextLang: WordTextLangPickerType,
        pageSize: WordPageSizeType,
    ) {
        this.bookmarkMap = bookmarkMap;
        this.pickTextLang = pickTextLang;
        this.pageSize = pageSize;
    }

    get bodyXml() {
        this.flushParagraph();
        return this.partList.join('');
    }

    walkRoot(root: Element) {
        this.walkChildren(root, {
            block: { quoteDepth: 0, indentSteps: 0 },
            run: {},
            listDepth: 0,
            isPre: false,
        });
        this.flushParagraph();
    }

    private addRun(run: RunType, context: WalkContextType) {
        if (this.runList.length === 0) {
            this.paragraphBlock = context.block;
        }
        this.runList.push(run);
    }

    private checkIsAtLineStart() {
        const lastRun = this.runList.at(-1);
        if (lastRun === undefined || lastRun.kind === 'break') {
            return true;
        }
        return lastRun.kind === 'text' && lastRun.text.endsWith(' ');
    }

    private addText(text: string, context: WalkContextType) {
        if (context.isPre) {
            text.split('\n').forEach((line, lineIndex) => {
                if (lineIndex > 0) {
                    this.addRun({ kind: 'break', style: context.run }, context);
                }
                line.split('\t').forEach((part, partIndex) => {
                    if (partIndex > 0) {
                        this.addRun(
                            { kind: 'tab', style: context.run },
                            context,
                        );
                    }
                    if (part !== '') {
                        this.addRun(
                            { kind: 'text', text: part, style: context.run },
                            context,
                        );
                    }
                });
            });
            return;
        }
        // Spaces as the page shows them: one, and none at a line's start.
        let collapsedText = text.replaceAll(COLLAPSIBLE_SPACE_REGEX, ' ');
        if (collapsedText.startsWith(' ') && this.checkIsAtLineStart()) {
            collapsedText = collapsedText.slice(1);
        }
        if (collapsedText !== '') {
            this.addRun(
                { kind: 'text', text: collapsedText, style: context.run },
                context,
            );
        }
    }

    private genRunXml(run: RunType) {
        if (run.kind === 'picture') {
            return toPictureToken(run.index);
        }
        if (run.kind === 'break') {
            return `<w:r>${genRunPropsXml(run.style, null, false)}<w:br/></w:r>`;
        }
        if (run.kind === 'tab') {
            return `<w:r>${genRunPropsXml(run.style, null, false)}<w:tab/></w:r>`;
        }
        const textLang = this.pickTextLang(run.text);
        const propsXml = genRunPropsXml(
            run.style,
            textLang?.fontFamily ?? null,
            textLang?.isRtl === true,
        );
        return (
            `<w:r>${propsXml}<w:t xml:space="preserve">` +
            `${escapeXMLText(run.text)}</w:t></w:r>`
        );
    }

    private trimParagraphRuns(runList: RunType[], block: BlockType) {
        if (block.styleId === 'SourceCode') {
            // A code block's last line ends with the line break before
            // the fence.
            while (runList.at(-1)?.kind === 'break') {
                runList.pop();
            }
            return;
        }
        while (runList.length > 0) {
            const lastRun = runList[runList.length - 1];
            if (lastRun.kind === 'break') {
                runList.pop();
                continue;
            }
            if (lastRun.kind !== 'text') {
                return;
            }
            const trimmedText = lastRun.text.trimEnd();
            if (trimmedText !== '') {
                runList[runList.length - 1] = { ...lastRun, text: trimmedText };
                return;
            }
            runList.pop();
        }
    }

    private flushParagraph() {
        const runList = this.runList;
        const block = this.paragraphBlock;
        this.runList = [];
        this.paragraphBlock = null;
        if (block === null) {
            return;
        }
        this.trimParagraphRuns(runList, block);
        if (runList.length === 0) {
            return;
        }
        const firstText = runList
            .map((run) => {
                return run.kind === 'text' ? run.text : '';
            })
            .join('')
            .match(FIRST_LETTER_REGEX)?.[0];
        const isRtl =
            firstText !== undefined &&
            this.pickTextLang(firstText)?.isRtl === true;
        let runsXml = '';
        let openLink: string | null = null;
        for (const run of runList) {
            const link = run.style.link ?? null;
            if (link !== openLink) {
                if (openLink !== null) {
                    runsXml += '</w:hyperlink>';
                }
                if (link !== null) {
                    runsXml += genLinkStartXml(link);
                }
                openLink = link;
            }
            runsXml += this.genRunXml(run);
        }
        if (openLink !== null) {
            runsXml += '</w:hyperlink>';
        }
        if (block.bookmark !== undefined) {
            const id = this.bookmarkId++;
            runsXml =
                `<w:bookmarkStart w:id="${id}" ` +
                `w:name="${escapeXMLAttribute(block.bookmark)}"/>` +
                runsXml +
                `<w:bookmarkEnd w:id="${id}"/>`;
        }
        this.partList.push(
            `<w:p>${genParagraphPropsXml(block, isRtl)}${runsXml}</w:p>`,
        );
    }

    private walkChildren(element: Element, context: WalkContextType) {
        for (const childNode of element.childNodes) {
            this.walkNode(childNode, context);
        }
    }

    private walkNode(node: Node, context: WalkContextType) {
        if (node.nodeType === Node.TEXT_NODE) {
            this.addText(node.nodeValue ?? '', context);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
        }
        const element = node as Element;
        const tagName = element.localName.toLowerCase();
        if (
            SKIPPED_TAG_SET.has(tagName) ||
            element.hasAttribute('hidden') ||
            element.classList.contains(PRINT_APPENDIX_CLASS_NAME) ||
            element.classList.contains(MERMAID_HAS_PRINT_CLASS_NAME)
        ) {
            return;
        }
        if (this.walkSpecialElement(element, tagName, context)) {
            return;
        }
        const inlineStyle = INLINE_STYLE_MAP[tagName];
        const runStyle =
            inlineStyle === undefined
                ? context.run
                : {
                      ...context.run,
                      ...(context.isPre && inlineStyle.isCode
                          ? {}
                          : inlineStyle),
                  };
        if (tagName === 'a') {
            this.walkLink(element, { ...context, run: runStyle });
            return;
        }
        if (BLOCK_TAG_SET.has(tagName)) {
            this.walkBlock(element, {
                ...context,
                run: runStyle,
                block: {
                    ...context.block,
                    align: readAlign(element) ?? context.block.align,
                    indentSteps:
                        context.block.indentSteps + (tagName === 'dd' ? 1 : 0),
                },
            });
            return;
        }
        this.walkChildren(element, { ...context, run: runStyle });
    }

    /** True when `element` was written here. */
    private walkSpecialElement(
        element: Element,
        tagName: string,
        context: WalkContextType,
    ) {
        if (/^h[1-6]$/.test(tagName)) {
            this.walkBlock(element, {
                ...context,
                block: {
                    ...context.block,
                    styleId: `Heading${tagName[1]}`,
                    align: readAlign(element),
                    bookmark: this.bookmarkMap.get(element.id),
                    listItem: undefined,
                },
            });
            return true;
        }
        if (tagName === 'br') {
            this.addRun({ kind: 'break', style: context.run }, context);
            return true;
        }
        if (tagName === 'hr') {
            this.flushParagraph();
            this.partList.push(
                '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" ' +
                    'w:space="1" w:color="BFBFBF"/></w:pBdr></w:pPr></w:p>',
            );
            return true;
        }
        if (tagName === 'img') {
            this.addPicture(element, context);
            return true;
        }
        if (tagName === 'svg') {
            this.addSvgPicture(element as SVGSVGElement, context);
            return true;
        }
        if (tagName === 'pre') {
            this.walkBlock(element, {
                ...context,
                isPre: true,
                block: { ...context.block, styleId: 'SourceCode' },
            });
            return true;
        }
        if (tagName === 'blockquote') {
            this.walkBlock(element, {
                ...context,
                block: {
                    ...context.block,
                    styleId: 'Quote',
                    quoteDepth: context.block.quoteDepth + 1,
                },
            });
            return true;
        }
        if (tagName === 'ul' || tagName === 'ol') {
            this.walkList(element, context, tagName === 'ol');
            return true;
        }
        if (tagName === 'table') {
            this.walkTable(element as HTMLTableElement, context);
            return true;
        }
        if (
            element.classList.contains(MERMAID_CLASS_NAME) &&
            element.classList.contains(MERMAID_DRAWN_CLASS_NAME)
        ) {
            const svgElement = element.querySelector('svg');
            if (svgElement === null) {
                return false;
            }
            // A diagram is a paragraph of its own, in the middle as on the
            // page.
            this.flushParagraph();
            this.addSvgPicture(svgElement, {
                ...context,
                block: { ...context.block, align: 'center' },
            });
            this.flushParagraph();
            return true;
        }
        return false;
    }

    private walkBlock(element: Element, context: WalkContextType) {
        this.flushParagraph();
        this.walkChildren(element, context);
        this.flushParagraph();
    }

    private walkLink(element: Element, context: WalkContextType) {
        const href = element.getAttribute('href');
        const link = href === null ? undefined : this.toLink(href);
        this.walkChildren(
            element,
            link === undefined
                ? context
                : { ...context, run: { ...context.run, link } },
        );
    }

    private toLink(href: string) {
        const target = classifyMarkdownHref(href);
        if (target.kind === 'anchor') {
            const bookmark =
                this.bookmarkMap.get(toHeadingElementId(target.slug)) ??
                this.bookmarkMap.get(target.slug);
            return bookmark === undefined ? undefined : `a:${bookmark}`;
        }
        if (target.kind !== 'web') {
            // A file on this machine means nothing in a document sent on.
            return undefined;
        }
        let id = this.linkIdMap.get(target.url);
        if (id === undefined) {
            id = `rIdLink${this.links.push(target.url)}`;
            this.linkIdMap.set(target.url, id);
        }
        return `r:${id}`;
    }

    private addPicture(element: Element, context: WalkContextType) {
        const src = (element as HTMLImageElement).src || '';
        const alt = readPictureAlt(element, src);
        if (src === '') {
            if (alt !== '') {
                this.addText(`[${alt}]`, context);
            }
            return;
        }
        const widthAttribute = Number.parseFloat(
            element.getAttribute('width') ?? '',
        );
        const index =
            this.pictures.push({
                source: {
                    kind: 'src',
                    src,
                    width: widthAttribute > 0 ? widthAttribute : null,
                },
                alt,
            }) - 1;
        this.addRun({ kind: 'picture', index, style: context.run }, context);
    }

    private addSvgPicture(svgElement: SVGSVGElement, context: WalkContextType) {
        const source = readSvgPicture(svgElement);
        if (source === null) {
            return;
        }
        const index =
            this.pictures.push({
                source,
                alt: svgElement.getAttribute('aria-roledescription') ?? '',
            }) - 1;
        this.addRun({ kind: 'picture', index, style: context.run }, context);
    }

    private walkList(
        element: Element,
        context: WalkContextType,
        isOrdered: boolean,
    ) {
        this.flushParagraph();
        const level = Math.min(context.listDepth, MAX_LIST_LEVEL);
        const start = Number.parseInt(element.getAttribute('start') ?? '', 10);
        const numId = this.lists.push({
            kind: isOrdered ? 'decimal' : 'bullet',
            level,
            start: isOrdered && Number.isFinite(start) ? start : 1,
        });
        const listContext: WalkContextType = {
            ...context,
            listDepth: context.listDepth + 1,
        };
        for (const childNode of element.childNodes) {
            if (
                childNode.nodeType === Node.ELEMENT_NODE &&
                (childNode as Element).localName.toLowerCase() === 'li'
            ) {
                this.walkBlock(childNode as Element, {
                    ...listContext,
                    block: {
                        ...context.block,
                        listItem: { numId, level, isNumbered: false },
                    },
                });
            } else {
                this.walkNode(childNode, listContext);
            }
        }
        this.flushParagraph();
    }

    private collectCellXml(
        cell: HTMLTableCellElement,
        context: WalkContextType,
    ) {
        const outerPartList = this.partList;
        this.partList = [];
        this.walkChildren(cell, {
            ...context,
            run:
                cell.localName.toLowerCase() === 'th'
                    ? { ...context.run, isBold: true }
                    : context.run,
            block: {
                quoteDepth: 0,
                indentSteps: 0,
                align: readAlign(cell),
                isInTable: true,
            },
            listDepth: 0,
        });
        this.flushParagraph();
        const cellXml = this.partList.join('');
        this.partList = outerPartList;
        // A cell ends with a paragraph, whatever it holds.
        return cellXml.endsWith('</w:p>') ? cellXml : `${cellXml}<w:p/>`;
    }

    private walkTable(table: HTMLTableElement, context: WalkContextType) {
        this.flushParagraph();
        const rowList = Array.from(table.rows);
        if (rowList.length === 0) {
            return;
        }
        const columnCount = Math.max(
            1,
            ...rowList.map((row) => {
                return Array.from(row.cells).reduce((count, cell) => {
                    return count + Math.max(1, cell.colSpan || 1);
                }, 0);
            }),
        );
        const contentTwips = this.pageSize.widthTwips - 2 * PAGE_MARGIN_TWIPS;
        const columnTwips = Math.floor(contentTwips / columnCount);
        let xml =
            '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>' +
            '<w:tblW w:w="5000" w:type="pct"/>' +
            '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" ' +
            'w:firstColumn="0" w:lastColumn="0" w:noHBand="0" ' +
            'w:noVBand="1"/></w:tblPr><w:tblGrid>' +
            `<w:gridCol w:w="${columnTwips}"/>`.repeat(columnCount) +
            '</w:tblGrid>';
        for (const row of rowList) {
            const cellList = Array.from(row.cells);
            if (cellList.length === 0) {
                continue;
            }
            const isHeader =
                row.parentElement?.localName.toLowerCase() === 'thead';
            xml += `<w:tr>${isHeader ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`;
            for (const cell of cellList) {
                const span = Math.max(1, cell.colSpan || 1);
                xml +=
                    `<w:tc><w:tcPr><w:tcW w:w="${columnTwips * span}" ` +
                    'w:type="dxa"/>' +
                    (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '') +
                    `</w:tcPr>${this.collectCellXml(cell, context)}</w:tc>`;
            }
            xml += '</w:tr>';
        }
        this.partList.push(`${xml}</w:tbl>`);
    }
}

/**
 * Every heading the roots hold, to a bookmark name Word takes (a letter
 * first, at most 40 characters): an in-page link to a heading goes there.
 */
function genBookmarkMap(rootList: Element[]) {
    const bookmarkMap = new Map<string, string>();
    for (const root of rootList) {
        for (const element of root.querySelectorAll(
            'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]',
        )) {
            if (element.id !== '' && !bookmarkMap.has(element.id)) {
                bookmarkMap.set(element.id, `_md${bookmarkMap.size + 1}`);
            }
        }
    }
    return bookmarkMap;
}

/**
 * The page -- and after it the appendix asked for, when there is one -- as
 * the body of a Word document. Synchronous, so the page cannot be drawn
 * again while it is read.
 */
export function snapshotMarkdownWordPage(
    rootList: Element[],
    {
        pickTextLang,
        pageSize = genWordPageSize(),
    }: {
        pickTextLang: WordTextLangPickerType;
        pageSize?: WordPageSizeType;
    },
): WordPageSnapshotType {
    const writer = new WordPageWriter(
        genBookmarkMap(rootList),
        pickTextLang,
        pageSize,
    );
    for (const root of rootList) {
        writer.walkRoot(root);
    }
    return {
        bodyXml: writer.bodyXml,
        pictures: writer.pictures,
        links: writer.links,
        lists: writer.lists,
        pageSize,
    };
}

function genPictureRunXml(
    index: number,
    placed: NonNullable<WordPlacedPictureType>,
    alt: string,
) {
    const id = index + 1;
    const cx = placed.width * EMU_PER_PIXEL;
    const cy = placed.height * EMU_PER_PIXEL;
    const descr = escapeXMLAttribute(alt);
    return (
        '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" ' +
        `distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
        `<wp:docPr id="${id}" name="Picture ${id}" descr="${descr}"/>` +
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/>' +
        `</wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="${PICTURE_NAMESPACE}">` +
        `<pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" ` +
        `name="${escapeXMLAttribute(placed.fileName)}" descr="${descr}"/>` +
        '<pic:cNvPicPr/></pic:nvPicPr><pic:blipFill>' +
        `<a:blip r:embed="rIdImage${id}"/><a:stretch><a:fillRect/>` +
        '</a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/>' +
        `<a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect">` +
        '<a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData>' +
        '</a:graphic></wp:inline></w:drawing></w:r>'
    );
}

function genMissingPictureRunXml(alt: string) {
    if (alt === '') {
        return '';
    }
    return (
        '<w:r><w:rPr><w:i/><w:iCs/></w:rPr><w:t xml:space="preserve">' +
        `[${escapeXMLText(alt)}]</w:t></w:r>`
    );
}

export function genWordDocumentXml(
    snapshot: WordPageSnapshotType,
    placedList: WordPlacedPictureType[],
) {
    const bodyXml = snapshot.bodyXml.replaceAll(
        PICTURE_TOKEN_REGEX,
        (_match, indexText: string) => {
            const index = Number(indexText);
            const placed = placedList[index] ?? null;
            const alt = snapshot.pictures[index]?.alt ?? '';
            return placed === null
                ? genMissingPictureRunXml(alt)
                : genPictureRunXml(index, placed, alt);
        },
    );
    const { widthTwips, heightTwips } = snapshot.pageSize;
    // Word wants a paragraph last, before the section's properties.
    const lastXml =
        bodyXml.endsWith('</w:tbl>') || bodyXml === '' ? '<w:p/>' : '';
    return (
        `${XML_HEADER}<w:document xmlns:w="${WORD_NAMESPACE}" ` +
        `xmlns:r="${RELATIONSHIP_NAMESPACE}" ` +
        `xmlns:wp="${WORD_DRAWING_NAMESPACE}" ` +
        `xmlns:a="${DRAWING_NAMESPACE}" xmlns:pic="${PICTURE_NAMESPACE}">` +
        `<w:body>${bodyXml}${lastXml}<w:sectPr>` +
        `<w:pgSz w:w="${widthTwips}" w:h="${heightTwips}"/>` +
        `<w:pgMar w:top="${PAGE_MARGIN_TWIPS}" w:right="${PAGE_MARGIN_TWIPS}" ` +
        `w:bottom="${PAGE_MARGIN_TWIPS}" w:left="${PAGE_MARGIN_TWIPS}" ` +
        'w:header="720" w:footer="720" w:gutter="0"/>' +
        '</w:sectPr></w:body></w:document>'
    );
}

export function genWordDocumentRelsXml(
    snapshot: WordPageSnapshotType,
    placedList: WordPlacedPictureType[],
) {
    const relationshipList = [
        `<Relationship Id="rIdStyles" Type="${OFFICE_RELATIONSHIP_TYPE}/styles" Target="styles.xml"/>`,
        `<Relationship Id="rIdNumbering" Type="${OFFICE_RELATIONSHIP_TYPE}/numbering" Target="numbering.xml"/>`,
        `<Relationship Id="rIdSettings" Type="${OFFICE_RELATIONSHIP_TYPE}/settings" Target="settings.xml"/>`,
    ];
    placedList.forEach((placed, index) => {
        if (placed !== null) {
            relationshipList.push(
                `<Relationship Id="rIdImage${index + 1}" ` +
                    `Type="${OFFICE_RELATIONSHIP_TYPE}/image" ` +
                    `Target="media/${escapeXMLAttribute(placed.fileName)}"/>`,
            );
        }
    });
    snapshot.links.forEach((url, index) => {
        relationshipList.push(
            `<Relationship Id="rIdLink${index + 1}" ` +
                `Type="${OFFICE_RELATIONSHIP_TYPE}/hyperlink" ` +
                `Target="${escapeXMLAttribute(url)}" TargetMode="External"/>`,
        );
    });
    return (
        `${XML_HEADER}<Relationships xmlns="${PACKAGE_RELATIONSHIP_NAMESPACE}">` +
        `${relationshipList.join('')}</Relationships>`
    );
}

// A dot, a ring and a square, as Word's own lists go, in faces every
// machine has.
const BULLET_LEVEL_LIST = [
    { text: '•', font: 'Arial' },
    { text: 'o', font: 'Courier New' },
    { text: '▪', font: 'Arial' },
];

function genAbstractNumXml(abstractNumId: number, isBullet: boolean) {
    let xml =
        `<w:abstractNum w:abstractNumId="${abstractNumId}">` +
        '<w:multiLevelType w:val="hybridMultilevel"/>';
    for (let level = 0; level <= MAX_LIST_LEVEL; level++) {
        const bullet = BULLET_LEVEL_LIST[level % BULLET_LEVEL_LIST.length];
        const left = LIST_INDENT_TWIPS * (level + 1);
        xml +=
            `<w:lvl w:ilvl="${level}"><w:start w:val="1"/>` +
            (isBullet
                ? '<w:numFmt w:val="bullet"/>' +
                  `<w:lvlText w:val="${bullet.text}"/>`
                : '<w:numFmt w:val="decimal"/>' +
                  `<w:lvlText w:val="%${level + 1}."/>`) +
            '<w:lvlJc w:val="left"/>' +
            `<w:pPr><w:ind w:left="${left}" w:hanging="360"/></w:pPr>` +
            (isBullet
                ? `<w:rPr><w:rFonts w:ascii="${bullet.font}" ` +
                  `w:hAnsi="${bullet.font}" w:hint="default"/></w:rPr>`
                : '') +
            '</w:lvl>';
    }
    return `${xml}</w:abstractNum>`;
}

export function genWordNumberingXml(listList: WordListType[]) {
    // Every list is a numbering of its own, so each numbered one counts from
    // its own start.
    const numXml = listList
        .map((list, index) => {
            const abstractNumId = list.kind === 'bullet' ? 0 : 1;
            const overrideXml =
                list.kind === 'decimal'
                    ? `<w:lvlOverride w:ilvl="${list.level}">` +
                      `<w:startOverride w:val="${list.start}"/></w:lvlOverride>`
                    : '';
            return (
                `<w:num w:numId="${index + 1}">` +
                `<w:abstractNumId w:val="${abstractNumId}"/>${overrideXml}</w:num>`
            );
        })
        .join('');
    return (
        `${XML_HEADER}<w:numbering xmlns:w="${WORD_NAMESPACE}">` +
        genAbstractNumXml(0, true) +
        genAbstractNumXml(1, false) +
        `${numXml}</w:numbering>`
    );
}

function genHeadingStyleXml(level: number, halfPointSize: number) {
    return (
        `<w:style w:type="paragraph" w:styleId="Heading${level}">` +
        `<w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/>` +
        '<w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
        '<w:pPr><w:keepNext/><w:keepLines/>' +
        `<w:spacing w:before="${level <= 2 ? 360 : 240}" w:after="120"/>` +
        `<w:outlineLvl w:val="${level - 1}"/></w:pPr>` +
        `<w:rPr><w:b/><w:bCs/>${level === 6 ? '<w:i/><w:iCs/>' : ''}` +
        `<w:sz w:val="${halfPointSize}"/><w:szCs w:val="${halfPointSize}"/>` +
        '</w:rPr></w:style>'
    );
}

export function genWordStylesXml() {
    const headingSizeList = [40, 32, 28, 24, 22, 22];
    return (
        `${XML_HEADER}<w:styles xmlns:w="${WORD_NAMESPACE}">` +
        '<w:docDefaults><w:rPrDefault><w:rPr>' +
        '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" ' +
        'w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/>' +
        '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>' +
        '<w:spacing w:after="160" w:line="276" w:lineRule="auto"/>' +
        '</w:pPr></w:pPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
        '<w:name w:val="Normal"/><w:qFormat/></w:style>' +
        '<w:style w:type="character" w:default="1" ' +
        'w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph ' +
        'Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>' +
        headingSizeList
            .map((size, index) => {
                return genHeadingStyleXml(index + 1, size);
            })
            .join('') +
        '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/>' +
        '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
        '<w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" ' +
        'w:color="D0D7DE"/></w:pBdr><w:ind w:left="360"/></w:pPr>' +
        '<w:rPr><w:color w:val="57606A"/></w:rPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="SourceCode">' +
        '<w:name w:val="Source Code"/><w:basedOn w:val="Normal"/>' +
        '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F6F8FA"/>' +
        '<w:spacing w:after="160" w:line="240" w:lineRule="auto"/></w:pPr>' +
        '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" ' +
        'w:cs="Consolas"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>' +
        '</w:style>' +
        '<w:style w:type="character" w:styleId="VerbatimChar">' +
        '<w:name w:val="Verbatim Char"/><w:rPr><w:rFonts w:ascii="Consolas" ' +
        'w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/>' +
        '<w:szCs w:val="20"/><w:shd w:val="clear" w:color="auto" ' +
        'w:fill="EFF1F3"/></w:rPr></w:style>' +
        '<w:style w:type="character" w:styleId="Hyperlink">' +
        '<w:name w:val="Hyperlink"/><w:uiPriority w:val="99"/><w:rPr>' +
        '<w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
        '<w:style w:type="table" w:default="1" w:styleId="TableNormal">' +
        '<w:name w:val="Normal Table"/><w:semiHidden/><w:tblPr>' +
        '<w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar>' +
        '<w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
        '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/>' +
        '</w:tblCellMar></w:tblPr></w:style>' +
        '<w:style w:type="table" w:styleId="TableGrid">' +
        '<w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/>' +
        '<w:tblPr><w:tblBorders>' +
        ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
            .map((side) => {
                return (
                    `<w:${side} w:val="single" w:sz="4" w:space="0" ` +
                    'w:color="BFBFBF"/>'
                );
            })
            .join('') +
        '</w:tblBorders></w:tblPr></w:style></w:styles>'
    );
}

export function genWordSettingsXml() {
    // Without the compatibility mode, Word opens the file in "Compatibility
    // Mode" as though it came from Word 2007.
    return (
        `${XML_HEADER}<w:settings xmlns:w="${WORD_NAMESPACE}">` +
        '<w:defaultTabStop w:val="720"/><w:compat><w:compatSetting ' +
        'w:name="compatibilityMode" ' +
        'w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>' +
        '</w:compat></w:settings>'
    );
}

export function genWordContentTypesXml() {
    const typePrefix = 'application/vnd.openxmlformats-officedocument.';
    return (
        `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/` +
        '2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.' +
        'openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
        '<Default Extension="gif" ContentType="image/gif"/>' +
        '<Default Extension="bmp" ContentType="image/bmp"/>' +
        '<Override PartName="/word/document.xml" ContentType="' +
        `${typePrefix}wordprocessingml.document.main+xml"/>` +
        '<Override PartName="/word/styles.xml" ContentType="' +
        `${typePrefix}wordprocessingml.styles+xml"/>` +
        '<Override PartName="/word/numbering.xml" ContentType="' +
        `${typePrefix}wordprocessingml.numbering+xml"/>` +
        '<Override PartName="/word/settings.xml" ContentType="' +
        `${typePrefix}wordprocessingml.settings+xml"/>` +
        '<Override PartName="/docProps/core.xml" ContentType="application/' +
        'vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>'
    );
}

export function genWordPackageRelsXml() {
    return (
        `${XML_HEADER}<Relationships xmlns="${PACKAGE_RELATIONSHIP_NAMESPACE}">` +
        `<Relationship Id="rId1" Type="${OFFICE_RELATIONSHIP_TYPE}/officeDocument" ` +
        'Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/' +
        'package/2006/relationships/metadata/core-properties" ' +
        'Target="docProps/core.xml"/></Relationships>'
    );
}

export function genWordCorePropsXml(title: string, date = new Date()) {
    const dateText = `${date.toISOString().split('.')[0]}Z`;
    return (
        `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.` +
        'openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
        'xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        `<dc:title>${escapeXMLText(title)}</dc:title>` +
        '<dc:creator>Open Worship App</dc:creator>' +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${dateText}</dcterms:created>` +
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${dateText}</dcterms:modified>` +
        '</cp:coreProperties>'
    );
}
