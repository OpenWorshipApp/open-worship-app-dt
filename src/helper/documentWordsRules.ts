/**
 * The words of a document -- a PowerPoint's slides, a Word file's pages, a
 * PDF's pages, a slide document -- put into the order a song is sung in, for
 * the song drafter (`owa_lyric_validate` `mode: "draft"`). Pure: the parsing
 * is `documentWordsParsers.ts`, the reading of files
 * `agentDocumentWordsHelpers.ts`. Asked for 2026-11-10: _user ask to create
 * lyric from powerpoint file … chatbot should use all api to extract text
 * and prepare for the lyric_.
 *
 * What a church's song deck looks like, read off a real one (two hymns in
 * one deck): every slide has a HEADING box at the top -- the hymn's number
 * and name, in a display face -- over a taller box of the verse in the body
 * face; a slide that only says "Amen"; a hidden slide; a slide holding the
 * little audio icon and nothing else. So:
 *
 * - a heading is not sung: it becomes the title (the first one) and is NAMED
 *   in the answer, so a sung line taken for one can be seen;
 * - a slide number, a hidden slide and an empty slide are left out, counted;
 * - the face the most WORDS are drawn in is the song's font -- the body's,
 *   never the heading's;
 * - a page whose words cannot be read -- none, or a legacy font's Latin
 *   letters standing in for another script's (`checkLooksUnreadable`) -- is
 *   a picture page: the help window can have an assistant read it off a
 *   picture instead.
 *
 * The text handed to the drafter starts with the title alone on its first
 * line: the drafter always takes a lone first line as the title and leaves
 * it out of the song, and a sung first line would vanish that way.
 */

export type DocumentWordsShapeType = {
    // Where the box sits on its page, in the page's own pixels.
    x: number;
    y: number;
    width: number;
    height: number;
    lines: string[];
    // How many letters are drawn in each family: the FIRST family of each
    // run's stack, the one asked for (`'Battambang', sans-serif`).
    fontCountMap: Record<string, number>;
    // The document SAYS it is a heading (a Word `h1`); a slide's heading is
    // worked out from where it sits.
    isHeading?: boolean;
};

export type DocumentWordsPictureType = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type DocumentWordsPageType = {
    // As the app numbers it: slide 1, page 1.
    number: number;
    isHidden: boolean;
    width: number;
    height: number;
    shapes: DocumentWordsShapeType[];
    pictures: DocumentWordsPictureType[];
};

// One page's words, its lines joined by line breaks.
export type DocumentWordsBlockType = {
    page: number;
    text: string;
};

export type DocumentWordsResultType = {
    title: string;
    // Every heading left out, each once, in the order met.
    headings: string[];
    fontFamily: string | null;
    // Title line, a blank line, then the blocks.
    text: string;
    characters: number;
    isTruncated: boolean;
    // The pages' words apart, for words read off pictures to join in order.
    blocks: DocumentWordsBlockType[];
    skipped: {
        hidden: number;
        headings: number;
        numbers: number;
        empty: number;
    };
    // Pages with words the app could read, and pages that need a picture
    // read instead (no readable words, but a picture or words drawn in a
    // face that does not decode).
    readablePages: number[];
    pictureNeededPages: number[];
};

/** Rows of boxes this close in height read as one row, left to right. */
const SAME_ROW_TOLERANCE = 8;
/** What the drafter echoes is cut at 12 000; this leaves its notation room. */
export const MAX_DOCUMENT_WORDS_CHARS = 9000;
/** The drafter's own limit for a title line. */
const MAX_TITLE_LENGTH = 80;
/** A picture covering less of a page than this is an icon, not the page. */
const PICTURE_COVER_RATIO = 0.25;

const SLIDE_NUMBER_PATTERN = /^[\p{Nd}\s./-]{1,6}$/u;
// A section label the drafter would read as one: a title that IS one would
// be taken for a section (and a sung title is no title).
const SECTION_LABEL_PATTERN =
    /^(?:verse|chorus|refrain|bridge|pre-?chorus|intro|outro|tag|ending|interlude)\b/i;
// The stand-in letters a font with no real encoding is read as, and the
// private-use area such fonts are also drawn from.
const BROKEN_CHARACTER_PATTERN = new RegExp(
    `[${String.fromCharCode(0xfffd)}${String.fromCharCode(0xe000)}-${String.fromCharCode(0xf8ff)}]`,
    'gu',
);
// A letter, then something that is neither a letter, a mark, a space, an
// apostrophe, a hyphen nor a full stop, then a letter: `eyIg;xJ` is a legacy
// font's Latin standing in for another script; `don't` and `e.g.` are words.
const GLUED_WORD_PATTERN = /\p{L}[^\p{L}\p{M}\s'’.-]+\p{L}/u;
const LOWER_UPPER_PATTERN = /\p{Ll}\p{Lu}/gu;

export function toCleanLine(line: string) {
    // `\s` takes a no-break space and a tab too: a slide's `&nbsp;` is a space.
    return line.replace(/\s+/g, ' ').trim();
}

export function checkIsSlideNumberLine(line: string) {
    return SLIDE_NUMBER_PATTERN.test(line) && /\p{Nd}/u.test(line);
}

/**
 * Whether words read off a page are NOT what a person sees there: no letter
 * at all, characters that decode to nothing, or words of glued symbols and
 * case flips -- what a legacy font's text layer gives, its Latin letters
 * standing in for the glyphs drawn. Names no language: it looks at the
 * shape of the words alone. Never by LENGTH: a slide that only says "Amen"
 * is three letters of some scripts, and it is read.
 */
export function checkLooksUnreadable(text: string) {
    if (!/\p{L}/u.test(text)) {
        return true;
    }
    const characters = text.replace(/\s/g, '').length;
    const broken = text.match(BROKEN_CHARACTER_PATTERN)?.length ?? 0;
    if (broken > characters * 0.01) {
        return true;
    }
    const words = text.split(/\s+/).filter((word) => {
        return word.length >= 3;
    });
    if (words.length === 0) {
        return false;
    }
    const oddWords = words.filter((word) => {
        return (
            GLUED_WORD_PATTERN.test(word) ||
            (word.match(LOWER_UPPER_PATTERN)?.length ?? 0) >= 2
        );
    });
    return oddWords.length > words.length * 0.25;
}

/** Top to bottom; boxes on one row left to right. */
export function toReadingOrder<T extends { x: number; y: number }>(
    boxes: readonly T[],
) {
    return [...boxes].sort((a, b) => {
        if (Math.abs(a.y - b.y) > SAME_ROW_TOLERANCE) {
            return a.y - b.y;
        }
        return a.x - b.x;
    });
}

function toMainFont(fontCountMap: Record<string, number>) {
    let best: string | null = null;
    let bestCount = 0;
    for (const [family, count] of Object.entries(fontCountMap)) {
        if (count > bestCount) {
            best = family;
            bestCount = count;
        }
    }
    return best;
}

function addCounts(
    target: Record<string, number>,
    source: Record<string, number>,
) {
    for (const [family, count] of Object.entries(source)) {
        target[family] = (target[family] ?? 0) + count;
    }
}

type CleanShapeType = DocumentWordsShapeType & { text: string };

function toCleanShapes(
    page: DocumentWordsPageType,
    counts: { numbers: number },
) {
    const shapes: CleanShapeType[] = [];
    for (const shape of toReadingOrder(page.shapes)) {
        const lines: string[] = [];
        for (const line of shape.lines) {
            const cleanLine = toCleanLine(line);
            if (cleanLine !== '' && checkIsSlideNumberLine(cleanLine)) {
                counts.numbers += 1;
                continue;
            }
            lines.push(cleanLine);
        }
        // Blank lines at either end say nothing; inside, they part stanzas.
        while (lines.length > 0 && lines[0] === '') {
            lines.shift();
        }
        while (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        if (lines.length === 0) {
            continue;
        }
        shapes.push({ ...shape, lines, text: lines.join(' ') });
    }
    return shapes;
}

/**
 * The top box of a page is its heading when it is one line over a TALLER
 * box drawn in another face -- a hymn's number and name over its verse --
 * or when the same words top at least half the pages that have words.
 */
function findHeadingShapes(pageShapes: CleanShapeType[][]) {
    const topCountMap = new Map<string, number>();
    const pagesWithWords = pageShapes.filter((shapes) => {
        return shapes.length > 0;
    });
    for (const shapes of pagesWithWords) {
        const key = shapes[0].text.toLowerCase();
        topCountMap.set(key, (topCountMap.get(key) ?? 0) + 1);
    }
    const headingSet = new Set<CleanShapeType>();
    for (const shapes of pagesWithWords) {
        // A "Chorus" box over the words is the song's own section label: it
        // stays, for the drafter to name the part by.
        for (const shape of shapes) {
            if (
                shape.isHeading === true &&
                !SECTION_LABEL_PATTERN.test(shape.text)
            ) {
                headingSet.add(shape);
            }
        }
        if (shapes.length < 2) {
            continue;
        }
        const top = shapes[0];
        if (SECTION_LABEL_PATTERN.test(top.text)) {
            continue;
        }
        const nonBlankLines = top.lines.filter((line) => {
            return line !== '';
        });
        if (nonBlankLines.length !== 1) {
            continue;
        }
        const repeatCount = topCountMap.get(top.text.toLowerCase()) ?? 0;
        const isRepeated =
            pagesWithWords.length >= 2 &&
            repeatCount >= 2 &&
            repeatCount >= pagesWithWords.length / 2;
        const topFont = toMainFont(top.fontCountMap);
        const isOverBody = shapes.slice(1).some((shape) => {
            return (
                shape.y >= top.y + top.height / 2 &&
                shape.height > top.height &&
                toMainFont(shape.fontCountMap) !== topFont
            );
        });
        if (isRepeated || isOverBody) {
            headingSet.add(top);
        }
    }
    return headingSet;
}

/** The same first or last line on two or more pages: a running header. */
function findRunningLines(pageShapes: CleanShapeType[][]) {
    const edgeCountMap = new Map<string, number>();
    for (const shapes of pageShapes) {
        const lines = shapes.flatMap((shape) => {
            return shape.lines.filter((line) => {
                return line !== '';
            });
        });
        if (lines.length < 3) {
            continue;
        }
        for (const line of new Set([lines[0], lines[lines.length - 1]])) {
            const key = line.toLowerCase();
            edgeCountMap.set(key, (edgeCountMap.get(key) ?? 0) + 1);
        }
    }
    return new Set(
        [...edgeCountMap.entries()]
            .filter(([, count]) => {
                return count >= 2;
            })
            .map(([key]) => {
                return key;
            }),
    );
}

function toTitle(text: string, fallback: string) {
    let title = toCleanLine(text);
    if (title.length > MAX_TITLE_LENGTH) {
        const cut = title.slice(0, MAX_TITLE_LENGTH);
        const lastSpace = cut.lastIndexOf(' ');
        title = (
            lastSpace > MAX_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut
        )
            .replace(/[\s,;:.-]+$/, '')
            .trim();
    }
    if (title === '' || SECTION_LABEL_PATTERN.test(title)) {
        return toCleanLine(fallback).slice(0, MAX_TITLE_LENGTH) || 'Untitled';
    }
    return title;
}

function checkHasCoveringPicture(page: DocumentWordsPageType) {
    const pageArea = Math.max(1, page.width * page.height);
    return page.pictures.some((picture) => {
        return (
            (Math.max(0, picture.width) * Math.max(0, picture.height)) /
                pageArea >=
            PICTURE_COVER_RATIO
        );
    });
}

/**
 * The song's words out of a document's pages. `fileTitle` names the song
 * when no heading or title page does (the file's name without extension).
 * `isRunningLineDropped` is for a PDF, whose every page may carry the same
 * header and footer lines; a slide deck's repeated top box is its heading.
 */
export function genDocumentWords(
    pages: readonly DocumentWordsPageType[],
    {
        fileTitle,
        isRunningLineDropped = false,
    }: { fileTitle: string; isRunningLineDropped?: boolean },
): DocumentWordsResultType {
    const counts = { numbers: 0 };
    const skipped = { hidden: 0, headings: 0, numbers: 0, empty: 0 };
    const visiblePages = pages.filter((page) => {
        if (page.isHidden) {
            skipped.hidden += 1;
            return false;
        }
        return true;
    });
    const pageShapes = visiblePages.map((page) => {
        return toCleanShapes(page, counts);
    });
    skipped.numbers = counts.numbers;
    const headingSet = findHeadingShapes(pageShapes);
    const runningLineSet = isRunningLineDropped
        ? findRunningLines(pageShapes)
        : new Set<string>();

    const headings: string[] = [];
    const blocks: { page: number; lines: string[] }[] = [];
    const readablePages: number[] = [];
    const pictureNeededPages: number[] = [];
    const bodyFontCountMap: Record<string, number> = {};
    let titleFromPage: string | null = null;

    visiblePages.forEach((page, index) => {
        const shapes = pageShapes[index];
        const bodyLines: string[] = [];
        const pageFontCountMap: Record<string, number> = {};
        for (const shape of shapes) {
            if (headingSet.has(shape)) {
                skipped.headings += 1;
                if (!headings.includes(shape.text)) {
                    headings.push(shape.text);
                }
                continue;
            }
            const lines = shape.lines.filter((line) => {
                return !runningLineSet.has(line.toLowerCase());
            });
            if (lines.every((line) => line === '')) {
                continue;
            }
            if (bodyLines.length > 0) {
                bodyLines.push('');
            }
            bodyLines.push(...lines);
            addCounts(pageFontCountMap, shape.fontCountMap);
        }
        const pageText = bodyLines.join(' ');
        const isUnreadable =
            bodyLines.length > 0 && checkLooksUnreadable(pageText);
        if (bodyLines.length === 0 || isUnreadable) {
            // Letters that do not decode, or a picture as big as a quarter
            // of the page, may hold the words; anything else (a slide with
            // the audio icon alone, a copyright line of digits) holds none.
            if (
                (isUnreadable && /\p{L}/u.test(pageText)) ||
                checkHasCoveringPicture(page)
            ) {
                pictureNeededPages.push(page.number);
            } else {
                skipped.empty += 1;
            }
            return;
        }
        // A first page of ONE short line, in a deck that goes on after it,
        // is the song's title page. Two lines are not: a verse of two short
        // lines is the commonest slide there is.
        const isTitlePage =
            blocks.length === 0 &&
            titleFromPage === null &&
            headings.length === 0 &&
            index < visiblePages.length - 1 &&
            bodyLines.filter((line) => line !== '').length === 1 &&
            pageText.length <= MAX_TITLE_LENGTH;
        if (isTitlePage) {
            titleFromPage = pageText;
            readablePages.push(page.number);
            return;
        }
        addCounts(bodyFontCountMap, pageFontCountMap);
        readablePages.push(page.number);
        blocks.push({ page: page.number, lines: bodyLines });
    });

    // A lone short line opening the words, a blank line under it and more
    // after, is the song's title -- what the drafter itself reads off a
    // paste, and what a Word file of a hymn starts with.
    let titleFromLine: string | null = null;
    const firstLines = blocks[0]?.lines ?? [];
    if (
        headings.length === 0 &&
        titleFromPage === null &&
        firstLines.length > 2 &&
        firstLines[1] === '' &&
        firstLines[0].length <= MAX_TITLE_LENGTH &&
        !SECTION_LABEL_PATTERN.test(firstLines[0])
    ) {
        titleFromLine = firstLines[0];
        blocks[0].lines = firstLines.slice(2);
    }
    // A title page names the song over a heading every slide repeats.
    const title = toTitle(
        titleFromPage ?? headings[0] ?? titleFromLine ?? '',
        fileTitle,
    );
    const pageBlocks = blocks.map((block) => {
        return { page: block.page, text: block.lines.join('\n') };
    });
    const { text, isTruncated } = joinDocumentWords(title, pageBlocks);
    return {
        title,
        headings,
        fontFamily: toMainFont(bodyFontCountMap),
        text,
        characters: text.length,
        isTruncated,
        blocks: pageBlocks,
        skipped,
        readablePages,
        pictureNeededPages,
    };
}

/**
 * The text the drafter is given: the title alone on the first line, then
 * each page's words in page order, a blank line between, cut on a page
 * boundary at `MAX_DOCUMENT_WORDS_CHARS`. The help window joins words an
 * assistant read off pictures in with the same call, so the two halves of a
 * document are joined one way.
 */
export function joinDocumentWords(
    title: string,
    blocks: readonly DocumentWordsBlockType[],
) {
    let text = title;
    let isTruncated = false;
    const ordered = [...blocks].sort((a, b) => {
        return a.page - b.page;
    });
    for (const block of ordered) {
        const words = block.text
            .split(/\r?\n/)
            .map(toCleanLine)
            .join('\n')
            .trim();
        if (words === '') {
            continue;
        }
        const piece = `\n\n${words}`;
        if (text.length + piece.length > MAX_DOCUMENT_WORDS_CHARS) {
            isTruncated = true;
            break;
        }
        text += piece;
    }
    // Collapse runs of blank lines a stanza break inside a box can leave.
    return { text: text.replace(/\n{3,}/g, '\n\n'), isTruncated };
}

/**
 * Words read off pictures, merged back among the pages read as text, page
 * by page, in the document's order. `pictureTexts` maps a page number to
 * the words an assistant read off that page's picture.
 */
export function mergePictureWords(
    pages: readonly DocumentWordsPageType[],
    pictureTexts: ReadonlyMap<number, string>,
): DocumentWordsPageType[] {
    return pages.map((page) => {
        const words = pictureTexts.get(page.number);
        if (words === undefined) {
            return page;
        }
        const lines = words.split(/\r?\n/).map(toCleanLine);
        return {
            ...page,
            shapes: [
                {
                    x: 0,
                    y: 0,
                    width: page.width,
                    height: page.height,
                    lines,
                    fontCountMap: {},
                },
            ],
            pictures: [],
        };
    });
}
