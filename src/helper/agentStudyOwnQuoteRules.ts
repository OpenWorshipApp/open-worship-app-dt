/**
 * A verse a model quoted in a form of its own (2026-11-13, EC-575).
 *
 * A study's passages are the app's quotes of an installed Bible -- `> **John
 * 3:16** (KJV)` and a verse a line -- and the prompt tells a model never to
 * quote a verse itself: `[^John 3:16]` alone on a line is quoted by the app.
 * EC-565 quoted again a passage a model wrote in the app's own form from
 * memory. One written the way a model writes a quote anywhere else --
 *
 *     > "For God so loved the world, he gave his one and only Son…" (John 3:16)
 *     > *For God so loved the world…* — John 3:16
 *     > **John 3:16** — For God so loved the world…
 *
 * -- was saved as written: words no Bible of the person's may have, under a
 * reference, with no Bible named. Pure, the rules: which paragraph quotes a
 * verse by its reference, how alike its words are to that verse as a Bible
 * reads it, where the app's quote goes, and what is said of it. The worker
 * (`requoteStudyOwnQuotes` in `agentStudyFileHelpers.ts`) reads the verse
 * from the Bible of the half the quote stands in (EC-570).
 *
 * - A QUOTE is a paragraph of a blockquote, or a paragraph wholly in quote
 *   marks or emphasis, naming ONE reference -- a book, a chapter and a
 *   verse -- at its end (`(John 3:16)`, `— John 3:16`, a last line of its
 *   own) or at its start (`**John 3:16**`, `John 3:16:`, a first line of
 *   its own), a Bible named beside it or not. A list item, a sentence of
 *   prose, a passage in the app's form (EC-565's), a verse token's line, a
 *   quote naming a second reference and a paragraph the file held as it is
 *   are none.
 * - Its words ARE the verse when each piece between its `…` is that Bible's
 *   words in order -- left as written --, OTHER WORDS FOR IT when alike
 *   enough -- quoted again --, and something else otherwise.
 * - ALIKE is read from letters (`textLikenessHelpers.ts`), so it holds for a
 *   script written without spaces between its words.
 */
import {
    countLetterRuns,
    measureLetterRunContainment,
    measureLetterRunLikeness,
} from '../chatbot/textLikenessHelpers';
import { listStudyVerseTokens, splitLinesByFence } from './agentStudyFileRules';

/** At most this many quotes are read from a Bible for one draft. */
export const STUDY_MAX_OWN_QUOTES = 12;

// Measured 2026-11-13 on the installed Bibles, read only: one Bible's words
// for a verse against another's, 400 verses a language. Words SET OUT as a
// quote are the verse in other words when the mean of the two likenesses
// reaches 0.42 -- missing 7% of English verses quoted in another Bible's
// words, 12% of French and 15% of Khmer, and taking a random verse 1.7%,
// 0.4% and 0% of the time.
const QUOTE_FORM_LIKENESS = 0.42;
// Words NOT set out as a quote may be a sentence about the verse, which
// scored 0.35 at the median: only words nearly the verse's own are taken.
const STATEMENT_LIKENESS = 0.6;
// A quote's words hold this many letters at least: a word or two is a name.
const MIN_QUOTE_LETTERS = 8;
// Longer than a range of verses is quoted (`STUDY_MAX_QUOTED_VERSES`).
const MAX_PARAGRAPH_CHARS = 6000;

// A chapter and a verse in any script's digits: `3:16`, `3.16`.
const CHAPTER_VERSE_SOURCE = '\\p{Nd}{1,3}\\s?[:.]\\s?\\p{Nd}{1,3}';
const CHAPTER_VERSE_PATTERN = new RegExp(CHAPTER_VERSE_SOURCE, 'u');
// A chapter and verse, not the end of a range (`3:16-4:2` is one).
const REFERENCE_COUNT_PATTERN = new RegExp(
    `(?<![-–]\\s?)${CHAPTER_VERSE_SOURCE}`,
    'gu',
);
// A reference: a book named in up to four words -- a number before it or
// not -- then a chapter and a verse, a range or a verse's letter after.
const REF_SOURCE =
    "(?:\\p{Nd}\\s?)?\\p{L}[\\p{L}\\p{M}.'’]*" +
    "(?:\\s\\p{L}[\\p{L}\\p{M}.'’]*){0,3}" +
    `\\s?${CHAPTER_VERSE_SOURCE}[a-c]?` +
    '(?:\\s?[-–]\\s?\\p{Nd}{1,3}(?:\\s?[:.]\\s?\\p{Nd}{1,3})?)?';
// A Bible named beside the reference: a key or a name.
const BIBLE_SOURCE = '[^()\\n*_]{2,40}?';
const EMPHASIS_SOURCE = '(?:\\*{1,3}|_{1,3})?';
const DASH_SOURCE = '(?:[—–―~]|\\s-)';

// `words (John 3:16)`, `words (John 3:16, KJV)`.
const TRAIL_PAREN_PATTERN = new RegExp(
    `^(.*\\S)\\s*\\(\\s*(${REF_SOURCE})(?:\\s*[,;]?\\s*(${BIBLE_SOURCE}))?` +
        '\\s*\\)\\s*[.!?]?\\s*$',
    'u',
);
// `words — John 3:16`, `words — *John 3:16 (KJV)*`.
const TRAIL_DASH_PATTERN = new RegExp(
    `^(.*\\S)\\s*${DASH_SOURCE}\\s*${EMPHASIS_SOURCE}(${REF_SOURCE})` +
        `(?:\\s*[,(]\\s*(${BIBLE_SOURCE})\\s*\\)?)?${EMPHASIS_SOURCE}` +
        '\\s*[.]?\\s*$',
    'u',
);
// `**John 3:16** words`, `**John 3:16 (KJV):** words`.
const LEAD_EMPHASIS_PATTERN = new RegExp(
    `^(\\*{1,3}|_{1,3})(${REF_SOURCE})(?:\\s*\\((${BIBLE_SOURCE})\\))?` +
        `\\s*:?\\1(?:\\s*\\((${BIBLE_SOURCE})\\))?\\s*(?:[:—–―~]|\\s-)?\\s*(.*)$`,
    'u',
);
// `John 3:16: words`, `John 3:16 (KJV) — words`.
const LEAD_PLAIN_PATTERN = new RegExp(
    `^(${REF_SOURCE})(?:\\s*\\((${BIBLE_SOURCE})\\))?\\s*(?:[:—–―~]|\\s-)\\s*(.+)$`,
    'u',
);
// A line that is a reference alone: `— John 3:16`, `**John 3:16 (KJV)**`,
// `(John 3:16)` -- its dash, emphasis, reference and Bible.
const OWN_REF_LINE_PATTERN = new RegExp(
    '^((?:[—–―~]|-)\\s*)?(\\*{1,3}|_{1,3})?\\(?\\s*' +
        `(${REF_SOURCE})(?:\\s*[,(]?\\s*(${BIBLE_SOURCE})\\s*\\)?)?\\s*\\)?` +
        `${EMPHASIS_SOURCE}\\s*:?\\s*$`,
    'u',
);
// A lead before the words: `**Key Verse:**`, `Memory verse:`.
const LABEL_PATTERN =
    /^((?:\*\*|__)[^*_\n]{1,40}?:?(?:\*\*|__):?|\*[^*\n]{1,40}?:?\*:?|[^"“«„‘*_:\n]{1,40}?:)\s+(?=\S)/u;
const QUOTE_OPEN = '"“«„‘\'「『';
const QUOTE_CLOSE = '"”»“’\'」』';
const QUOTED_PATTERN = new RegExp(
    `^[*_]{0,3}[${QUOTE_OPEN}][\\s\\S]*[${QUOTE_CLOSE}][*_]{0,3}[.!?,;:]*[*_]{0,3}$`,
    'u',
);
const EMPHASIZED_PATTERN = /^(\*{1,3}|_{1,3})\S[\s\S]*\S\1[.!?,;:]*$/u;
const ELLIPSIS_PATTERN = /…|\.\s?\.\s?\./u;
const BLOCK_LINE_PATTERN = /^\s{0,3}>/;
const BLOCK_MARK_PATTERN = /^\s{0,3}>\s?/;
const BLOCK_SEPARATOR_PATTERN = /^\s{0,3}>\s*$/;
// A line that is no plain paragraph's: a heading, a list item, a table
// row, a rule, a quote or an indented block.
const NOT_PLAIN_PATTERN =
    /^(?:\s{0,3}(?:#|[-*+]\s|\d{1,9}[.)]\s|\||>|-{3,}|\*{3,}|_{3,})|\s{4})/;
// The app's own passage head (`toStudyQuoteLines`), EC-565's to read.
const APP_QUOTE_HEAD_PATTERN =
    /^\s{0,3}>\s*\*\*(.+?)\*\*\s*\(([^)\n]{1,40})\)\s*$/;

/** A verse a model quoted in a form of its own. */
export type StudyOwnQuoteType = {
    /** The paragraph's lines in `text.split('\n')`: `start` to `end`. */
    start: number;
    end: number;
    /** The reference as the words name it, and a Bible named beside it. */
    ref: string;
    bibleName: string | null;
    /** The quoted words, the reference, the lead and the marks taken off. */
    words: string;
    /** A lead written before the words (`**Key Verse:**`), kept above. */
    label: string;
    /**
     * Whether the words are set out as a quote: in quote marks or emphasis,
     * after a dash, under a reference, or beside a Bible's name -- else
     * they may be a sentence about the verse.
     */
    isQuoteForm: boolean;
};

type ParagraphType = {
    start: number;
    end: number;
    lines: string[];
    isBlock: boolean;
    /** Whether its blockquote holds a passage in the app's form. */
    isInPassage: boolean;
};

/**
 * The paragraphs of some lines a quote may stand in, outside a fenced
 * block: each paragraph of a blockquote (its `>` taken off), and each run
 * of plain lines.
 */
function listParagraphs(text: string): ParagraphType[] {
    const marked = splitLinesByFence(text);
    const paragraphs: ParagraphType[] = [];
    let current: ParagraphType | null = null;
    let blockList: ParagraphType[] = [];
    let isBlockPassage = false;
    const closeParagraph = () => {
        if (current !== null && current.lines.length > 0) {
            paragraphs.push(current);
            if (current.isBlock) {
                blockList.push(current);
            }
        }
        current = null;
    };
    // A blockquote holding the app's passage is EC-565's, every paragraph.
    const closeBlock = () => {
        closeParagraph();
        for (const paragraph of blockList) {
            paragraph.isInPassage = isBlockPassage;
        }
        blockList = [];
        isBlockPassage = false;
    };
    marked.forEach(({ line, isInFence }, index) => {
        const isBlock = !isInFence && BLOCK_LINE_PATTERN.test(line);
        if (!isBlock) {
            closeBlock();
        }
        if (isBlock && APP_QUOTE_HEAD_PATTERN.test(line)) {
            isBlockPassage = true;
        }
        if (isBlock && BLOCK_SEPARATOR_PATTERN.test(line)) {
            closeParagraph();
            return;
        }
        const isPlain =
            !isInFence && line.trim() !== '' && !NOT_PLAIN_PATTERN.test(line);
        if (!isBlock && !isPlain) {
            return;
        }
        if (current !== null && current.isBlock !== isBlock) {
            closeParagraph();
        }
        if (current === null) {
            current = {
                start: index,
                end: index,
                lines: [],
                isBlock,
                isInPassage: false,
            };
        }
        current.lines.push(
            isBlock ? line.replace(BLOCK_MARK_PATTERN, '').trim() : line.trim(),
        );
        current.end = index + 1;
    });
    closeBlock();
    return paragraphs;
}

/** A paragraph's words as compared with another text's: one key. */
function toParagraphKey(lines: string[]) {
    return lines.join('\n');
}

function toLetters(text: string) {
    return String(text ?? '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{M}]+/gu, '');
}

type AttributionType = {
    ref: string;
    bibleName: string | null;
    words: string;
    isQuoteForm: boolean;
};

function toBibleName(text: string | undefined) {
    const name = (text ?? '').trim();
    return name === '' ? null : name;
}

/** The reference a paragraph's words are quoted under, or null. */
function readAttribution(lines: string[]): AttributionType | null {
    const ownLast =
        lines.length > 1 ? OWN_REF_LINE_PATTERN.exec(lines.at(-1) ?? '') : null;
    if (ownLast !== null) {
        // Under the words, a reference in brackets alone is a sentence's.
        return {
            ref: ownLast[3].trim(),
            bibleName: toBibleName(ownLast[4]),
            words: lines.slice(0, -1).join(' '),
            isQuoteForm:
                ownLast[1] !== undefined ||
                ownLast[2] !== undefined ||
                ownLast[4] !== undefined,
        };
    }
    const ownFirst =
        lines.length > 1 ? OWN_REF_LINE_PATTERN.exec(lines[0]) : null;
    if (ownFirst !== null && ownFirst[1] === undefined) {
        return {
            ref: ownFirst[3].trim(),
            bibleName: toBibleName(ownFirst[4]),
            words: lines.slice(1).join(' '),
            isQuoteForm: true,
        };
    }
    const text = lines.join(' ');
    const paren = TRAIL_PAREN_PATTERN.exec(text);
    if (paren !== null) {
        return {
            ref: paren[2].trim(),
            bibleName: toBibleName(paren[3]),
            words: paren[1],
            isQuoteForm: paren[3] !== undefined,
        };
    }
    const dash = TRAIL_DASH_PATTERN.exec(text);
    if (dash !== null) {
        return {
            ref: dash[2].trim(),
            bibleName: toBibleName(dash[3]),
            words: dash[1],
            isQuoteForm: true,
        };
    }
    const leadEmphasis = LEAD_EMPHASIS_PATTERN.exec(text);
    if (leadEmphasis !== null && leadEmphasis[5].trim() !== '') {
        return {
            ref: leadEmphasis[2].trim(),
            bibleName: toBibleName(leadEmphasis[3] ?? leadEmphasis[4]),
            words: leadEmphasis[5],
            isQuoteForm: true,
        };
    }
    const leadPlain = LEAD_PLAIN_PATTERN.exec(text);
    if (leadPlain !== null) {
        return {
            ref: leadPlain[1].trim(),
            bibleName: toBibleName(leadPlain[2]),
            words: leadPlain[3],
            isQuoteForm: true,
        };
    }
    return null;
}

/** The words with a lead before them taken off, and that lead. */
function splitLabel(words: string) {
    const match = LABEL_PATTERN.exec(words);
    if (match === null || CHAPTER_VERSE_PATTERN.test(match[1])) {
        return { label: '', words };
    }
    return { label: match[1].trim(), words: words.slice(match[0].length) };
}

/** A paragraph as a verse quoted by its reference, or null. */
function readOwnQuote(paragraph: ParagraphType): StudyOwnQuoteType | null {
    const text = paragraph.lines.join(' ');
    if (
        text.length > MAX_PARAGRAPH_CHARS ||
        !CHAPTER_VERSE_PATTERN.test(text) ||
        (text.match(REFERENCE_COUNT_PATTERN) ?? []).length !== 1 ||
        listStudyVerseTokens(text).length > 0
    ) {
        return null;
    }
    const attribution = readAttribution(paragraph.lines);
    if (attribution === null) {
        return null;
    }
    const { label, words } = splitLabel(attribution.words.trim());
    const isQuoted = QUOTED_PATTERN.test(words);
    const isEmphasized = EMPHASIZED_PATTERN.test(words);
    // A plain paragraph is a quote only when its words say so themselves.
    if (!paragraph.isBlock && !isQuoted && !isEmphasized) {
        return null;
    }
    const plainWords = words
        .replace(/[*_]+/g, '')
        .replace(
            new RegExp(`^[${QUOTE_OPEN}]|[${QUOTE_CLOSE}][.!?,;:]*$`, 'gu'),
            '',
        )
        .trim();
    if (toLetters(plainWords).length < MIN_QUOTE_LETTERS) {
        return null;
    }
    return {
        start: paragraph.start,
        end: paragraph.end,
        ref: attribution.ref,
        bibleName: attribution.bibleName,
        words: plainWords,
        label,
        isQuoteForm: attribution.isQuoteForm || isQuoted || isEmphasized,
    };
}

/**
 * The verses new words quote in a form of their own (EC-575), in order, at
 * most `STUDY_MAX_OWN_QUOTES`: a paragraph the old text held as it is was
 * the person's own and stays. Lines are counted as `newText.split('\n')`.
 */
export function listStudyOwnQuotes(oldText: string, newText: string) {
    const text = String(newText ?? '');
    if (!CHAPTER_VERSE_PATTERN.test(text)) {
        return [];
    }
    const oldKeySet = new Set(
        listParagraphs(String(oldText ?? '').replace(/\r\n/g, '\n')).map(
            (paragraph) => {
                return toParagraphKey(paragraph.lines);
            },
        ),
    );
    const quotes: StudyOwnQuoteType[] = [];
    for (const paragraph of listParagraphs(text)) {
        if (quotes.length >= STUDY_MAX_OWN_QUOTES) {
            break;
        }
        if (
            paragraph.isInPassage ||
            oldKeySet.has(toParagraphKey(paragraph.lines))
        ) {
            continue;
        }
        const quote = readOwnQuote(paragraph);
        if (quote !== null) {
            quotes.push(quote);
        }
    }
    return quotes;
}

/** Whether every piece of the words between its `…` is the text's, in order. */
function checkIsExactQuote(words: string, verseText: string) {
    const letters = toLetters(verseText);
    let from = 0;
    let pieceCount = 0;
    for (const piece of words.split(ELLIPSIS_PATTERN)) {
        const pieceLetters = toLetters(piece);
        if (pieceLetters === '') {
            continue;
        }
        const at = letters.indexOf(pieceLetters, from);
        if (at < 0) {
            return false;
        }
        from = at + pieceLetters.length;
        pieceCount += 1;
    }
    return pieceCount > 0;
}

/**
 * What a quote's words are to the verse a Bible reads under its reference
 * (`verseText`): `exact` when they are its words, `like` when they are
 * other words for it -- by the bar their form sets --, `other` otherwise.
 */
export function judgeStudyOwnQuote(
    quote: { words: string; isQuoteForm: boolean },
    verseText: string,
): 'exact' | 'like' | 'other' {
    if (checkIsExactQuote(quote.words, verseText)) {
        return 'exact';
    }
    const runs = countLetterRuns(quote.words);
    const verseRuns = countLetterRuns(verseText);
    const likeness = measureLetterRunLikeness(runs, verseRuns);
    if (!quote.isQuoteForm) {
        return likeness >= STATEMENT_LIKENESS ? 'like' : 'other';
    }
    const containment = measureLetterRunContainment(runs, verseRuns);
    return (likeness + containment) / 2 >= QUOTE_FORM_LIKENESS
        ? 'like'
        : 'other';
}

// A quote line's verse number as the app writes it, or a bare one.
const QUOTE_LINE_NUMBER_PATTERN =
    /^\s{0,3}>\s*(?:\*\*[^*\n]+\*\*|\p{Nd}+)?\s*/u;

/** A passage's words: its lines after the head, the `>` and numbers off. */
export function toStudyPassageWords(lines: string[]) {
    return lines
        .slice(1)
        .map((line) => {
            return line.replace(QUOTE_LINE_NUMBER_PATTERN, '').trim();
        })
        .filter((line) => {
            return line !== '' && line !== '…';
        })
        .join(' ');
}

/**
 * Whether a passage in the app's form (EC-565) quotes the verses a Bible
 * reads under its reference, read by its words: a head with a short book
 * name and no verse numbered (`> **Joh 3:16** (KJV)` and the words alone).
 */
export function checkIsStudyPassageLike(
    passageLines: string[],
    quotedLines: string[],
) {
    const words = toStudyPassageWords(passageLines);
    return (
        toLetters(words).length >= MIN_QUOTE_LETTERS &&
        judgeStudyOwnQuote(
            { words, isQuoteForm: true },
            toStudyPassageWords(quotedLines),
        ) !== 'other'
    );
}

/**
 * The text with each quote's paragraph written anew (`lines`, the app's
 * quote under the quote's lead): a paragraph of a longer blockquote ends
 * it there -- the `>` line beside it a blank one -- so the passage is a
 * quote of its own, and a blank line parts it from plain words.
 */
export function replaceStudyOwnQuotes(
    text: string,
    replacements: readonly { start: number; end: number; lines: string[] }[],
) {
    const lines = String(text ?? '').split('\n');
    const outLines: string[] = [];
    let cursor = 0;
    for (const one of [...replacements].sort((a, b) => {
        return a.start - b.start;
    })) {
        outLines.push(...lines.slice(cursor, one.start));
        const before = outLines.at(-1);
        if (before !== undefined && BLOCK_SEPARATOR_PATTERN.test(before)) {
            outLines[outLines.length - 1] = '';
        } else if (before !== undefined && before.trim() !== '') {
            outLines.push('');
        }
        outLines.push(...one.lines);
        let next = one.end;
        const after = lines[next];
        if (after !== undefined && BLOCK_SEPARATOR_PATTERN.test(after)) {
            outLines.push('');
            next += 1;
        } else if (after !== undefined && after.trim() !== '') {
            outLines.push('');
        }
        cursor = next;
    }
    outLines.push(...lines.slice(cursor));
    return outLines.join('\n');
}

/** A quote written anew as a Bible reads it. */
export type StudyOwnQuoteRequotedType = { title: string; bibleKey: string };
/** A quote left as sent: its words are not the verse a Bible reads. */
export type StudyOwnQuoteUnlikeType = { ref: string; bibleKey: string };

const MAX_NAMED_QUOTES = 5;

function toNamedList(names: string[]) {
    const shown = names.slice(0, MAX_NAMED_QUOTES).join(', ');
    return names.length > MAX_NAMED_QUOTES
        ? `${shown} and ${names.length - MAX_NAMED_QUOTES} more`
        : shown;
}

/**
 * What the model and the card are told of quotes written anew as their
 * Bibles read them, and of quotes left as sent that do not read as their
 * verse (EC-575). '' for none.
 */
export function describeStudyOwnQuotes(
    requoted: readonly StudyOwnQuoteRequotedType[],
    unlike: readonly StudyOwnQuoteUnlikeType[],
) {
    const sentences: string[] = [];
    if (requoted.length > 0) {
        const isOne = requoted.length === 1;
        const names = toNamedList(
            requoted.map((one) => {
                return `“${one.title}” (${one.bibleKey})`;
            }),
        );
        sentences.push(
            `${isOne ? 'The quote' : 'The quotes'} ${names} ` +
                `${isOne ? 'was' : 'were'} written as ` +
                `${isOne ? 'that Bible reads it' : 'their Bibles read them'}, ` +
                "in the app's form: the words sent were not the Bible's, and a " +
                "verse quoted in a study is the Bible's own words. To quote a " +
                'verse, put its reference alone on a line, as [^John 3:16].',
        );
    }
    if (unlike.length > 0) {
        const isOne = unlike.length === 1;
        const names = toNamedList(
            unlike.map((one) => {
                return `“${one.ref}” (${one.bibleKey})`;
            }),
        );
        sentences.push(
            `The words quoted as ${names} ` +
                `${isOne ? 'do not read as that verse' : 'do not read as those verses'} ` +
                'in that Bible, so they were left as sent: check the ' +
                'reference, or put it alone on a line, as [^John 3:16], for ' +
                "the Bible's own words.",
        );
    }
    return sentences.join(' ');
}
