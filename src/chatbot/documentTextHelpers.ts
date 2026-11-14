/**
 * The words of a document a song can be made from, read with no model
 * (2026-11-13, `EC-590`; the user: _it should use the tool pptx-to-html-conv
 * like what the app using, then extract text from the html_, then _after
 * powerpoint to lyric then appdocument to lyric_ and _also add other
 * support like docx pdf ..._). Each kind is read out of what the app's own
 * readers hand over:
 *
 * - a PowerPoint deck and a Word file, out of the pages the app's converters
 *   write (`pptx-to-html-conv`, `docx-to-html-conv`) -- the same HTML the
 *   Documents list shows as their slides;
 * - a slide document (`.ows`), out of its text boxes;
 * - a PDF, out of its text layer, as MuPDF reads it for the help window.
 *
 * Pure, every rule a test: HTML, JSON or page text in, lines out. The
 * reading of the files is `documentWordsHelpers.ts`.
 */

const OFFICE_TEXT_FILE_PATTERN = /\.(pptx|docx)$/i;
const SONG_DOCUMENT_FILE_PATTERN = /\.(pptx|docx|pdf|ows)$/i;

/** A PowerPoint deck or a Word file: read through the app's converters. */
export function checkIsOfficeTextName(name: string) {
    return OFFICE_TEXT_FILE_PATTERN.test(String(name ?? ''));
}

/**
 * A file the window makes a song out of with no model: a slide document, a
 * PowerPoint deck, a Word file or a PDF. `.ppt` and `.doc` are not -- the
 * converters read the zipped kinds only.
 */
export function checkIsSongDocumentName(name: string) {
    return SONG_DOCUMENT_FILE_PATTERN.test(String(name ?? ''));
}

// Markup that is never words on the page: a comment, the doctype, the head
// (its title is the file's name), the style sheet the converters write
// inside the body, a script, and a chart's axis labels (SVG `text`).
const SKIPPED_PART_PATTERN =
    /<!--[\s\S]*?-->|<![^>]*>|<\?[^>]*>|<(head|style|script|title|text)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
// A paragraph's bullet, as the deck converter writes it: a span right after
// the paragraph opens, then a no-break space (`textRenderer.js`). The glyph
// or the automatic number is the slide's furniture, never the song's.
const BULLET_PATTERN = /(<p\b[^>]*>)<span\b[^>]*>[^<]{1,12}<\/span>&nbsp;/gi;
const TOKEN_PATTERN = /<(\/?)([a-zA-Z][\w:-]*)\b([^>]*)>|([^<]+)/g;
// What ends a line of words without being a paragraph.
const BLOCK_TAG_SET = new Set([
    'address',
    'article',
    'aside',
    'blockquote',
    'body',
    'caption',
    'dd',
    'div',
    'dl',
    'dt',
    'figcaption',
    'figure',
    'footer',
    'foreignobject',
    'g',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hr',
    'html',
    'li',
    'main',
    'nav',
    'ol',
    'pre',
    'section',
    'svg',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
]);
// The Word converter's tab: an empty span of its own width.
const INLINE_BLOCK_PATTERN = /display\s*:\s*inline-block/i;

const NAMED_ENTITY_MAP: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

function decodeHtmlText(text: string) {
    return text.replace(
        /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
        (whole, code: string) => {
            if (code.startsWith('#')) {
                const point =
                    code[1].toLowerCase() === 'x'
                        ? Number.parseInt(code.slice(2), 16)
                        : Number.parseInt(code.slice(1), 10);
                return Number.isFinite(point) && point > 0 && point <= 0x10ffff
                    ? String.fromCodePoint(point)
                    : whole;
            }
            return NAMED_ENTITY_MAP[code.toLowerCase()] ?? whole;
        },
    );
}

// What a line's edges can carry and show nothing of: spaces, and a
// zero-width space or a word joiner left there by the program that wrote it
// (EC-590: a hymnal deck's title slide ended its number line "No. 5 : ", a
// zero-width space before the last space, which hid the colon the title is
// read by). A direction mark stays wherever it is: it can set which way a
// line reads.
const LINE_EDGE_BLANK_PATTERN = /^[\s\u200b\u2060]+|[\s\u200b\u2060]+$/g;

// A line's words with their spacing made plain; a line of nothing but
// spaces and invisible marks is an empty line. A zero-width space between
// two words is kept: Khmer writes its word breaks with it.
function toLineText(words: string) {
    const line = words
        .replace(/\s+/g, ' ')
        .replace(LINE_EDGE_BLANK_PATTERN, '');
    return /^[\s\p{Cf}]*$/u.test(line) ? '' : line;
}

/**
 * The lines of words in a page of HTML, in order: a paragraph is a line, a
 * break inside one starts the next, and an empty paragraph is an empty line.
 * Text outside a paragraph is a line where a block of the page ends it.
 */
export function readHtmlLines(html: string): string[] {
    const body = String(html ?? '')
        .replace(/^\uFEFF/, '')
        .replace(SKIPPED_PART_PATTERN, ' ')
        .replace(BULLET_PATTERN, '$1');
    const lineList: string[] = [];
    let words = '';
    const endLine = (isKept: boolean) => {
        const line = toLineText(words);
        words = '';
        if (line !== '' || isKept) {
            lineList.push(line);
        }
    };
    for (const match of body.matchAll(TOKEN_PATTERN)) {
        if (match[4] !== undefined) {
            words += decodeHtmlText(match[4]);
            continue;
        }
        const isClosing = match[1] === '/';
        const name = match[2].toLowerCase().replace(/^.*:/, '');
        if (name === 'p') {
            endLine(isClosing);
        } else if (name === 'br') {
            endLine(true);
        } else if (BLOCK_TAG_SET.has(name)) {
            endLine(false);
        } else if (
            !isClosing &&
            name === 'span' &&
            INLINE_BLOCK_PATTERN.test(match[3])
        ) {
            words += ' ';
        }
    }
    endLine(false);
    return lineList;
}

/** A deck's slide, as the converter writes it: its lines of words. */
export function readSlideHtmlLines(html: string): string[] {
    return readHtmlLines(html).filter((line) => {
        return line !== '';
    });
}

/**
 * A Word page, as the converter writes it: the lines of its body, the empty
 * ones kept -- they are a song's breaks between verses. The page's header
 * and footer (a church's name, a page number) are left out.
 */
export function readWordPageLines(html: string): string[] {
    const text = String(html ?? '');
    const start = text.search(/<div\b[^>]*\bclass="document"[^>]*>/i);
    if (start < 0) {
        return readHtmlLines(text);
    }
    const rest = text.slice(start);
    const end = rest.search(/<div\b[^>]*\bclass="page-footer"|<\/body\s*>/i);
    return readHtmlLines(end < 0 ? rest : rest.slice(0, end));
}

// A line with its numbers taken out -- in any script's digits -- so "Hymn 12
// 1/4" and "Hymn 12 2/4" are the same running header; and its invisible
// marks, a zero-width space typed into one slide's copy and not another's.
function toRunningKey(line: string) {
    return line
        .replace(/\p{Cf}+/gu, '')
        .replace(/[\p{Nd}/.:()-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * The slides' words without the line every slide repeats: a header such as
 * a hymn's number and its page (`# 12 1/4`, `# 12 2/4`), the same but for
 * its numbers on most slides, is the deck's furniture and no line of the
 * song. A repeated LAST line -- a copyright -- is kept once, on the last
 * slide, where a song's credit goes.
 */
export function dropRunningLines(slideList: string[][]): string[][] {
    const filled = slideList.filter((lines) => {
        return lines.length > 0;
    });
    const findRunning = (pick: (lines: string[]) => string | undefined) => {
        const countMap = new Map<string, number>();
        for (const lines of filled) {
            const key = toRunningKey(pick(lines) ?? '');
            if (key !== '') {
                countMap.set(key, (countMap.get(key) ?? 0) + 1);
            }
        }
        const runningSet = new Set<string>();
        for (const [key, count] of countMap) {
            if (count >= 2 && count * 2 >= filled.length) {
                runningSet.add(key);
            }
        }
        return runningSet;
    };
    const headerSet = findRunning((lines) => {
        return lines[0];
    });
    const footerSet = findRunning((lines) => {
        return lines.length > 1 ? lines[lines.length - 1] : undefined;
    });
    return filled.map((lines, index) => {
        let kept = lines;
        if (headerSet.has(toRunningKey(kept[0] ?? ''))) {
            kept = kept.slice(1);
        }
        if (
            index < filled.length - 1 &&
            kept.length > 0 &&
            footerSet.has(toRunningKey(kept[kept.length - 1]))
        ) {
            kept = kept.slice(0, -1);
        }
        return kept;
    });
}

/**
 * Blocks of lines as one text: a blank line between blocks, never more than
 * one blank line in a row, nothing at either end. '' when there are no words.
 */
export function joinBlocks(blockList: string[][]) {
    return blockList
        .map((lines) => {
            return lines
                .join('\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        })
        .filter((block) => {
            return block !== '';
        })
        .join('\n\n');
}

/**
 * A slide document's words, a slide a block: every text box's lines, in the
 * order the slide holds them, a slide turned off in the Presenter left out.
 * Null for a file that is not a slide document.
 */
export function toSlideDocumentBlocks(fileText: string): string[][] | null {
    let json: any;
    try {
        json = JSON.parse(String(fileText ?? '').replace(/^\uFEFF/, ''));
    } catch (_error) {
        return null;
    }
    if (!Array.isArray(json?.items)) {
        return null;
    }
    const blockList = json.items
        .filter((slide: any) => {
            return slide?.isDisabled !== true;
        })
        .map((slide: any) => {
            const items: any[] = Array.isArray(slide?.canvasItems)
                ? slide.canvasItems
                : [];
            return items.flatMap((item) => {
                if (item?.type !== 'text' || typeof item.text !== 'string') {
                    return [];
                }
                return item.text
                    .split(/\r?\n/)
                    .map(toLineText)
                    .filter((line: string) => {
                        return line !== '';
                    });
            });
        });
    return dropRunningLines(blockList);
}

// A page's own number standing alone on its first or last line: `3`,
// `- 3 -`, `Page 3`, `3 / 12`, `3 of 12`, in any script's digits.
const PAGE_NUMBER_LINE_PATTERN =
    /^[\s\-–—]*(?:page\s*)?\p{Nd}+(?:\s*(?:\/|of)\s*\p{Nd}+)?[\s\-–—]*$/iu;

function trimEmptyEdges(lines: string[]) {
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start] === '') {
        start += 1;
    }
    while (end > start && lines[end - 1] === '') {
        end -= 1;
    }
    return lines.slice(start, end);
}

/**
 * A PDF's words, a page a block: each page's text layer as lines, its
 * empty lines kept as a song's breaks, its own number on its first or last
 * line left out, and a header every page repeats taken off. A page with no
 * text (a scan) gives nothing.
 */
export function toPdfPageBlocks(
    pageTexts: readonly { text?: string | null }[],
): string[][] {
    const blockList = pageTexts.map((page) => {
        if (typeof page?.text !== 'string') {
            return [];
        }
        let lines = trimEmptyEdges(page.text.split(/\r?\n/).map(toLineText));
        if (lines.length > 0 && PAGE_NUMBER_LINE_PATTERN.test(lines[0])) {
            lines = trimEmptyEdges(lines.slice(1));
        }
        if (
            lines.length > 0 &&
            PAGE_NUMBER_LINE_PATTERN.test(lines[lines.length - 1])
        ) {
            lines = trimEmptyEdges(lines.slice(0, -1));
        }
        return lines;
    });
    return dropRunningLines(blockList).map(trimEmptyEdges);
}
