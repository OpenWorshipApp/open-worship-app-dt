/**
 * A request to MAKE something, typed in the person's own language
 * (2026-11-12, EC-516; the user's goal: _chatbot will be very smart to help
 * user create presenter documents, background resources, presenting flow,
 * bible item_). EC-514's, EC-515's and EC-518's readers know English words:
 * a new running order or slide document, passages saved to a Bibles list
 * or a new list, a background web page, a video or a track from a link.
 * Every other language says the same asks as DATA: `createAsks` in its
 * `typed.json` (or `assistant.json`) -- word LISTS, not patterns, so a
 * person who speaks the language can read and check every word:
 *
 * - `make`, `save`, `download`: the request forms of the verbs, never a
 *   past one (a line saying a file WAS made asks for nothing);
 * - `new`, `flow`, `slide`, `list`, `bibleList`, `webPage`, `background`,
 *   `video`, `audio`, `lyric`: what is asked for;
 * - `named` (before the name) and `namedAfter` (after it, as some languages
 *   put it), `nameStop`: where an unquoted name ends;
 * - `days`, `filler`: the words of a request that put nothing IN a file;
 * - `howTo`: a question about how, where or whether -- the guide's, never
 *   a request;
 * - `done`: words saying it is about something done already (yesterday,
 *   already, a past marker where verbs have no past form of their own):
 *   "I made a slide document yesterday" asks for nothing.
 *
 * An entry is matched in the lowered line as whole words where the script
 * spaces its words; `*` at its end lets letters follow (a stem), at its
 * start lets letters come before (an attached prefix or the first half of
 * a compound). Where the script does not space its words, an entry is
 * matched anywhere. Parts joined by an ellipsis match in order with up to
 * three words between (a noun and what it is of, an adjective between).
 *
 * What is read goes to the SAME routes as the English: `toTyped…Ask`
 * puts it in the English reader's shape. A name is read only next to a
 * `named` word, or quoted right after what is asked for: a wrong name is
 * worse than the day's. A day is not read (the default name has one).
 * Pure, every rule a test; `readCreateAskInOwnLanguage` picks the language.
 */
import type { BackgroundLinkAskType } from './backgroundLinkAskHelpers';
import type { BibleListAskType } from './bibleListAskHelpers';
import {
    DEFAULT_CHAT_LANG_CODE,
    detectTypedLanguage,
    getAppLangCode,
    getAssistantLanguage,
    listAssistantLanguages,
    listTypedLanguages,
} from './chatLangHelpers';
import type {
    DocumentCreateAskType,
    DocumentCreateKindType,
} from './documentCreateHelpers';
import type { WebBackgroundAskType } from './webBackgroundAskHelpers';
import { checkIsSpacedLocale } from '../helper/bibleVerseFindHelpers';

export const CREATE_ASK_WORD_GROUP_LIST = [
    'make',
    'new',
    'flow',
    'slide',
    'save',
    'list',
    'bibleList',
    'webPage',
    'background',
    'download',
    'video',
    'audio',
    'lyric',
    'named',
    'namedAfter',
    'nameStop',
    'days',
    'filler',
    'howTo',
    'done',
] as const;

export type CreateAskWordGroupType =
    (typeof CREATE_ASK_WORD_GROUP_LIST)[number];

export type CreateAskWordsType = Partial<
    Record<CreateAskWordGroupType, string[]>
>;

export type TypedCreateAskType =
    | {
          job: 'document';
          kind: DocumentCreateKindType;
          /** A `new` word was said: needed where one of the kind is open. */
          isNew: boolean;
          name: string | null;
          hasContent: boolean;
      }
    | ({ job: 'bibleList' } & BibleListAskType)
    | ({ job: 'webBackground' } & WebBackgroundAskType)
    | ({ job: 'backgroundLink' } & BackgroundLinkAskType);

type SpanType = [number, number];

const MAX_ASK_LENGTH = 600;
const MAX_URL_LENGTH = 600;
const MAX_NAME_LENGTH = 60;
const MAX_NAME_WORDS = 6;
const MAX_NAME_WORDS_BEFORE = 4;
const MAX_UNSPACED_NAME_LENGTH = 30;
const MAX_REFERENCE_COUNT = 20;
const MAX_UNSPACED_BOOK_LENGTH = 12;
const MAX_PART_GAP_WORDS = 3;
const MAX_UNSPACED_PART_GAP = 8;

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/giu;
const WORD_CHAR_PATTERN = /[\p{L}\p{M}\p{N}]/u;
const LETTER_OR_DIGIT_PATTERN = /[\p{L}\p{N}]/u;
const DIGIT_PATTERN = /\p{Nd}/u;
// Quote marks of every script: an opening one, words, a closing one (a
// German closing mark is an opening one elsewhere). The straight
// apostrophe is no quote: it is an elision.
const QUOTE_OPEN = String.raw`["\p{Pi}\p{Ps}]`;
const QUOTE_CLOSE = String.raw`["\p{Pi}\p{Pf}\p{Pe}]`;
const QUOTE_INSIDE = String.raw`[^"\p{Pi}\p{Pf}\p{Ps}\p{Pe}\n]`;
const QUOTED_AT_START_PATTERN = new RegExp(
    String.raw`^\s*${QUOTE_OPEN}\s*(${QUOTE_INSIDE}{1,80}?)\s*${QUOTE_CLOSE}`,
    'u',
);
const QUOTED_AT_END_PATTERN = new RegExp(
    String.raw`${QUOTE_OPEN}\s*(${QUOTE_INSIDE}{1,80}?)\s*${QUOTE_CLOSE}\s*$`,
    'u',
);
// A chapter, and a verse or a range, in any script's digits: "3:16",
// "3.16", "3,16-18".
const CHAPTER_VERSE_PATTERN =
    /\p{Nd}{1,3}(?:\s?[:.,]\s?\p{Nd}{1,3}(?:\s?[-–~]\s?\p{Nd}{1,3}(?:\s?[:.,]\s?\p{Nd}{1,3})?)?)?/gu;

// The line as typed, one letter for one: what a name is cut from, so it
// keeps the person's own apostrophe and okina.
function toShownLine(text: string) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// The line as read: every apostrophe the straight one, which no quote is.
function toAskLine(text: string) {
    return toShownLine(text).replace(/[‘’ʻʼ]/g, "'");
}

// Lower case, with a capital dotted I lowered to the plain one: the
// runtime writes it as an i and a combining dot, which no word holds and
// which would put every span after it one place out.
function toLowerLine(text: string) {
    return text.toLowerCase().replace(/i\u0307/g, 'i');
}

/** A typed line as word lists are read against (`findWordSpans`). */
export function toLowerAskLine(text: string) {
    return toLowerLine(toAskLine(text));
}

// A letter beyond the first plane is two units: read it whole.
function checkIsWordChar(text: string, index: number) {
    if (index < 0 || index >= text.length) {
        return false;
    }
    const code = text.charCodeAt(index);
    if (code >= 0xdc00 && code <= 0xdfff && index > 0) {
        return WORD_CHAR_PATTERN.test(text.slice(index - 1, index + 1));
    }
    if (code >= 0xd800 && code <= 0xdbff) {
        return WORD_CHAR_PATTERN.test(text.slice(index, index + 2));
    }
    return WORD_CHAR_PATTERN.test(text[index]);
}

// A name stops at a sign of punctuation, but not at what names carry, nor
// at a mark between two letters: a script that marks its syllables apart,
// or a middle dot inside a word.
function checkIsNameStopAt(text: string, index: number) {
    const char = text[index];
    return (
        /[\p{P}\p{S}]/u.test(char) &&
        !/['\-.&+#]/.test(char) &&
        !(checkIsWordChar(text, index - 1) && checkIsWordChar(text, index + 1))
    );
}

// Where one entry, or one part of a parted one, is in the lowered line.
// With `isCoreKept`, an entry that lets letters come before it starts where
// its own letters do: a marker joined to the name it follows.
function findEntrySpans(
    lower: string,
    entry: string,
    isSpaced: boolean,
    isCoreKept = false,
) {
    const spans: SpanType[] = [];
    const isStem = entry.endsWith('*');
    const isTail = entry.startsWith('*');
    const core = entry.replace(/^\*+|\*+$/g, '').trim();
    if (core === '') {
        return spans;
    }
    let from = 0;
    for (;;) {
        const index = lower.indexOf(core, from);
        if (index < 0) {
            break;
        }
        from = index + 1;
        let start = index;
        let end = index + core.length;
        if (isSpaced) {
            if (checkIsWordChar(lower, start - 1)) {
                if (!isTail) {
                    continue;
                }
                while (
                    !isCoreKept &&
                    start > 0 &&
                    checkIsWordChar(lower, start - 1)
                ) {
                    start -= 1;
                }
            }
            if (checkIsWordChar(lower, end)) {
                if (!isStem) {
                    continue;
                }
                while (end < lower.length && checkIsWordChar(lower, end)) {
                    end += 1;
                }
            }
        }
        spans.push([start, end]);
    }
    return spans;
}

// Whether what stands between two parts of an entry is short enough.
function checkIsPartGap(gap: string, isSpaced: boolean) {
    if (!isSpaced) {
        return gap.length <= MAX_UNSPACED_PART_GAP;
    }
    const wordList = gap.trim().split(/\s+/).filter(Boolean);
    return wordList.length <= MAX_PART_GAP_WORDS;
}

/**
 * Where a word list's entries are in the lowered line. An entry of parts
 * ("order \u2026 service") matches them in that order with up to three
 * words between: an adjective between a noun and what it is of ("a NEW
 * order of service" said "order new of service").
 */
export function findWordSpans(
    lower: string,
    entries: readonly string[] | undefined,
    isSpaced: boolean,
    isCoreKept = false,
): SpanType[] {
    const spans: SpanType[] = [];
    for (const raw of entries ?? []) {
        if (typeof raw !== 'string') {
            continue;
        }
        const partList = toLowerLine(toAskLine(raw))
            .split(/\s*(?:\u2026|\.\.\.)\s*/u)
            .filter(Boolean);
        if (partList.length === 0) {
            continue;
        }
        let found = findEntrySpans(lower, partList[0], isSpaced, isCoreKept);
        for (const part of partList.slice(1)) {
            const nextList = findEntrySpans(lower, part, isSpaced, isCoreKept);
            found = found.flatMap(([start, end]) => {
                const next = nextList.find((span) => {
                    return (
                        span[0] >= end &&
                        checkIsPartGap(lower.slice(end, span[0]), isSpaced)
                    );
                });
                return next === undefined ? [] : [[start, next[1]] as SpanType];
            });
        }
        spans.push(...found);
    }
    return spans.sort((one, other) => {
        return one[0] - other[0];
    });
}

type ReadingType = {
    source: string;
    shown: string;
    urlList: string[];
    lower: string;
    isSpaced: boolean;
    words: CreateAskWordsType;
    spanMap: Map<CreateAskWordGroupType, SpanType[]>;
};

function listSpans(
    reading: ReadingType,
    groups: readonly CreateAskWordGroupType[],
) {
    return groups
        .flatMap((group) => {
            return reading.spanMap.get(group) ?? [];
        })
        .sort((one, other) => {
            return one[0] - other[0];
        });
}

function checkHas(reading: ReadingType, group: CreateAskWordGroupType) {
    return (reading.spanMap.get(group) ?? []).length > 0;
}

// Where a sentence ends, in any script: a stop, a question or an
// exclamation mark before a space or the line's end ("3.16" goes on), or
// one of the marks that need no space after them (the Khmer khan, the
// Chinese full stop, the Devanagari danda, the Ethiopic and Myanmar ones).
const SENTENCE_END_PATTERN =
    /\p{Sentence_Terminal}+(?=\s|$)|[^\P{Sentence_Terminal}.!?]+/gu;

// The sentences of a line, as places in it.
function listSentenceRanges(lower: string): SpanType[] {
    const ranges: SpanType[] = [];
    let start = 0;
    for (const match of lower.matchAll(SENTENCE_END_PATTERN)) {
        const end = (match.index ?? 0) + match[0].length;
        ranges.push([start, end]);
        start = end;
    }
    ranges.push([start, lower.length]);
    return ranges;
}

/**
 * Whether one sentence of the line says the word to make AND what is made
 * (2026-11-21, `EC-783`): _my presentation is open in PowerPoint, but
 * PowerPoint is closed. What do I do?_ said a slide document in its first
 * sentence and the French "do" (_faire_, also "make") in its second, and a
 * slide document was made.
 */
function checkHasTogether(
    reading: ReadingType,
    group: CreateAskWordGroupType,
    other: CreateAskWordGroupType,
) {
    const startList = (reading.spanMap.get(group) ?? []).map(([start]) => {
        return start;
    });
    const otherStartList = (reading.spanMap.get(other) ?? []).map(([start]) => {
        return start;
    });
    return listSentenceRanges(reading.lower).some(([start, end]) => {
        const isIn = (place: number) => {
            return place >= start && place < end;
        };
        return startList.some(isIn) && otherStartList.some(isIn);
    });
}

// Every word the lists read, but the name markers: what a passage's book
// name never runs into.
const STOP_GROUP_LIST = CREATE_ASK_WORD_GROUP_LIST.filter((group) => {
    return group !== 'named' && group !== 'namedAfter';
});
// Where an unquoted name stops. After its marker in a spaced script, only
// at the words saying what goes IN the file, and at the request's verb
// where it comes last ("a list named Easter make"): a name holds little
// words and a day ("Evening of Easter"). Elsewhere at any word of a
// request but a day, the one way to tell where words run together or come
// first.
const NAME_STOP_GROUP_LIST: CreateAskWordGroupType[] = [
    'nameStop',
    'make',
    'save',
    'download',
];
const NAME_EDGE_GROUP_LIST = STOP_GROUP_LIST.filter((group) => {
    return group !== 'days';
});
// The words of the request itself, which a book of the Bible is never
// named by: a noun may be one (Psalms is "songs" in more than one
// language), so nouns and days are not among them.
const REQUEST_GROUP_LIST: CreateAskWordGroupType[] = [
    'make',
    'new',
    'save',
    'list',
    'bibleList',
    'download',
    'named',
    'namedAfter',
    'nameStop',
    'filler',
];
const NOUN_GROUP_LIST: CreateAskWordGroupType[] = [
    'flow',
    'slide',
    'list',
    'bibleList',
    'webPage',
];

function listFillerWords(reading: ReadingType) {
    return (reading.words.filler ?? []).map((word) => {
        return toLowerLine(toAskLine(word));
    });
}

function toCleanName(name: string, reading?: ReadingType) {
    let clean = name
        .replace(/^(?:(?!#)[\s\p{Po}])+|[\s\p{Po}]+$/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    // An article or a little word at either end is the sentence's, not the
    // name's: "called the Youth Night", "named Easter please".
    if (reading !== undefined && reading.isSpaced) {
        const fillerList = listFillerWords(reading);
        const wordList = clean.split(' ');
        while (
            wordList.length > 1 &&
            fillerList.includes(toLowerLine(wordList[0]))
        ) {
            wordList.shift();
        }
        while (
            wordList.length > 1 &&
            fillerList.includes(toLowerLine(wordList[wordList.length - 1]))
        ) {
            wordList.pop();
        }
        clean = wordList.join(' ');
    }
    return clean.length > 0 &&
        clean.length <= MAX_NAME_LENGTH &&
        LETTER_OR_DIGIT_PATTERN.test(clean)
        ? clean
        : null;
}

type NameType = { name: string; span: SpanType };

// The name as it was typed: the same letters cut from the line as shown.
function toNameFound(
    reading: ReadingType,
    name: string | null,
    span: SpanType,
): NameType | null {
    if (name === null) {
        return null;
    }
    const index = reading.source.indexOf(name, span[0]);
    return {
        name:
            index < 0 ? name : reading.shown.slice(index, index + name.length),
        span,
    };
}

// Where a quoted name starts after its marker, past the little words
// before it: Samoan says "named it 'Afio Mai'".
function findQuoteStart(reading: ReadingType, start: number) {
    if (!reading.isSpaced) {
        return start;
    }
    const lead = new RegExp(
        String.raw`^((?:[^\s"\p{Pi}\p{Ps}]+\s+){1,2})(?=${QUOTE_OPEN})`,
        'u',
    ).exec(reading.source.slice(start));
    if (lead === null) {
        return start;
    }
    const fillerList = listFillerWords(reading);
    return lead[1]
        .trim()
        .split(/\s+/)
        .every((word) => {
            return fillerList.includes(toLowerLine(word));
        })
        ? start + lead[1].length
        : start;
}

function readNameAfterMarker(
    reading: ReadingType,
    markerEnd: number,
    stopSpans: SpanType[],
): NameType | null {
    const { source, isSpaced } = reading;
    const lead = /^[\s:]*/u.exec(source.slice(markerEnd))?.[0].length ?? 0;
    const start = markerEnd + lead;
    const quoteStart = findQuoteStart(reading, start);
    const quoted = QUOTED_AT_START_PATTERN.exec(source.slice(quoteStart));
    if (quoted !== null) {
        return toNameFound(reading, toCleanName(quoted[1]), [
            start,
            quoteStart + quoted[0].length,
        ]);
    }
    const nextStop =
        stopSpans.find((span) => {
            return span[0] >= start;
        })?.[0] ?? source.length;
    let end = start;
    while (end < nextStop && !checkIsNameStopAt(source, end)) {
        if (!isSpaced && /\s/.test(source[end])) {
            break;
        }
        // A full stop that ends the sentence ends the name; one inside it
        // ("St. John") does not.
        if (
            source[end] === '.' &&
            /^\.(?:\s|$)/u.test(source.slice(end, end + 2))
        ) {
            break;
        }
        end += 1;
    }
    const raw = source.slice(start, end);
    if (
        isSpaced
            ? raw.trim().split(/\s+/).length > MAX_NAME_WORDS
            : raw.length > MAX_UNSPACED_NAME_LENGTH
    ) {
        return null;
    }
    return toNameFound(reading, toCleanName(raw, reading), [start, end]);
}

function readNameBeforeMarker(
    reading: ReadingType,
    markerStart: number,
    stopSpans: SpanType[],
): NameType | null {
    const { source, isSpaced } = reading;
    const before = source.slice(0, markerStart);
    const quoted = QUOTED_AT_END_PATTERN.exec(before);
    if (quoted !== null) {
        return toNameFound(reading, toCleanName(quoted[1]), [
            quoted.index,
            markerStart,
        ]);
    }
    // A space before the marker is not the name's end, where a script
    // writes none between its words.
    let nameEnd = markerStart;
    while (nameEnd > 0 && /\s/.test(source[nameEnd - 1])) {
        nameEnd -= 1;
    }
    const lastStop = stopSpans.reduce((found, span) => {
        return span[1] <= nameEnd ? Math.max(found, span[1]) : found;
    }, 0);
    let start = nameEnd;
    while (start > lastStop && !checkIsNameStopAt(source, start - 1)) {
        if (!isSpaced && /\s/.test(source[start - 1])) {
            break;
        }
        start -= 1;
    }
    let raw = source.slice(start, nameEnd);
    if (isSpaced) {
        const wordList = raw.trim().split(/\s+/);
        if (wordList.length > MAX_NAME_WORDS_BEFORE) {
            raw = wordList.slice(-MAX_NAME_WORDS_BEFORE).join(' ');
            start = nameEnd - raw.length;
        }
    } else if (raw.length > MAX_UNSPACED_NAME_LENGTH) {
        return null;
    }
    return toNameFound(reading, toCleanName(raw, reading), [
        start,
        markerStart,
    ]);
}

/** The name the line gives, and where it is, or null. */
function readTypedName(reading: ReadingType): NameType | null {
    const edgeSpans = listSpans(reading, NAME_EDGE_GROUP_LIST);
    // A name holds no marker of a name: the second half of one said in two
    // ("by the name Easter so-called") ends it.
    const markerSpans = listSpans(reading, ['named', 'namedAfter']);
    const afterSpans = [
        ...(reading.isSpaced
            ? listSpans(reading, NAME_STOP_GROUP_LIST)
            : edgeSpans),
        ...markerSpans,
    ].sort((one, other) => {
        return one[0] - other[0];
    });
    for (const [, end] of reading.spanMap.get('named') ?? []) {
        const named = readNameAfterMarker(reading, end, afterSpans);
        if (named !== null) {
            return named;
        }
    }
    // A marker joined to the name before it starts where its own letters
    // do; of two that end alike, the longer leaves the shorter name.
    const beforeList = findWordSpans(
        reading.lower,
        reading.words.namedAfter,
        reading.isSpaced,
        true,
    );
    for (const [start] of beforeList) {
        const named = readNameBeforeMarker(reading, start, edgeSpans);
        if (named !== null) {
            return named;
        }
    }
    // Quoted right after what is asked for: a new slide document "Name".
    for (const [, end] of listSpans(reading, NOUN_GROUP_LIST)) {
        const quoted = QUOTED_AT_START_PATTERN.exec(reading.source.slice(end));
        const found =
            quoted === null
                ? null
                : toNameFound(reading, toCleanName(quoted[1]), [
                      end,
                      end + quoted[0].length,
                  ]);
        if (found !== null) {
            return found;
        }
    }
    return null;
}

/** Whether words are left that put something IN the file. */
function checkHasContent(reading: ReadingType, name: NameType | null) {
    const { lower, isSpaced } = reading;
    const spans = [
        ...listSpans(reading, CREATE_ASK_WORD_GROUP_LIST),
        ...(name === null ? [] : [name.span]),
    ];
    // Mask by unit index: `lower` is read by units, and so are the spans.
    const unitList = lower.split('');
    for (const [start, end] of spans) {
        for (let index = start; index < end; index += 1) {
            unitList[index] = ' ';
        }
    }
    const left = unitList.join('');
    if (DIGIT_PATTERN.test(left)) {
        return true;
    }
    if (isSpaced) {
        return left.split(/[^\p{L}\p{M}\p{N}]+/u).some((word) => {
            return (
                [...word].filter((char) => {
                    return /\p{L}/u.test(char);
                }).length >= 3
            );
        });
    }
    return [...left.matchAll(/\p{L}/gu)].length >= 2;
}

/**
 * The passages in a line, each as written -- a book's name in any script
 * and a chapter, a verse or a range in any script's digits -- for
 * `owa_bible_item`, which reads each with every installed Bible's names.
 * The list's own words never run into a book's name.
 */
function readTypedReferences(reading: ReadingType): string[] {
    const { source, isSpaced } = reading;
    const units = source.split('');
    for (const [start, end] of listSpans(reading, REQUEST_GROUP_LIST)) {
        for (let index = start; index < end; index += 1) {
            units[index] = '\u0000';
        }
    }
    const masked = units.join('');
    const references: string[] = [];
    for (const match of masked.matchAll(CHAPTER_VERSE_PATTERN)) {
        const digitStart = match.index;
        const digitEnd = digitStart + match[0].length;
        if (
            DIGIT_PATTERN.test(masked[digitStart - 1] ?? '') ||
            DIGIT_PATTERN.test(masked[digitEnd] ?? '')
        ) {
            continue;
        }
        let bookStart = digitStart;
        let bookEnd = digitStart;
        if (isSpaced) {
            // One or two words, a number before them: "1 Corinthians".
            if (bookEnd > 0 && masked[bookEnd - 1] === ' ') {
                bookEnd -= 1;
            } else if (checkIsWordChar(masked, bookEnd - 1)) {
                continue;
            }
            let cursor = bookEnd;
            let wordCount = 0;
            while (wordCount < 2) {
                let wordStart = cursor;
                while (
                    wordStart > 0 &&
                    (checkIsWordChar(masked, wordStart - 1) ||
                        /['.\-]/.test(masked[wordStart - 1]))
                ) {
                    wordStart -= 1;
                }
                const word = masked.slice(wordStart, cursor);
                if (!/\p{L}/u.test(word)) {
                    break;
                }
                bookStart = wordStart;
                wordCount += 1;
                if (wordStart === 0 || masked[wordStart - 1] !== ' ') {
                    break;
                }
                cursor = wordStart - 1;
            }
            const numbered = /([1-3]) $/u.exec(masked.slice(0, bookStart));
            if (numbered !== null) {
                bookStart = numbered.index;
            }
        } else {
            // Run together, or one space between: the letters before it.
            if (masked[bookEnd - 1] === ' ') {
                bookEnd -= 1;
            }
            bookStart = bookEnd;
            while (
                bookStart > 0 &&
                bookEnd - bookStart < MAX_UNSPACED_BOOK_LENGTH &&
                /[\p{L}\p{M}]/u.test(masked[bookStart - 1])
            ) {
                bookStart -= 1;
            }
        }
        const book = source.slice(bookStart, bookEnd).trim();
        if (!/\p{L}/u.test(book)) {
            continue;
        }
        references.push(`${book} ${match[0].replace(/\s+/g, '')}`);
        if (references.length >= MAX_REFERENCE_COUNT) {
            break;
        }
    }
    return references;
}

/**
 * Whether a line asks, in a language's own words, for something made, and
 * what. `isSpaced`: the language's script puts spaces between its words.
 */
export function readTypedCreateAsk(
    text: string,
    words: CreateAskWordsType | null | undefined,
    isSpaced: boolean,
): TypedCreateAskType | null {
    return readTypedCreateAskScored(text, words, isSpaced)?.ask ?? null;
}

// How many letters of the line a language's words read: of two languages
// that both read a line, the one that knows more of it.
function measureCoverage(reading: ReadingType) {
    const covered = new Set<number>();
    for (const spans of reading.spanMap.values()) {
        for (const [start, end] of spans) {
            for (let index = start; index < end; index += 1) {
                covered.add(index);
            }
        }
    }
    return covered.size;
}

function readTypedCreateAskScored(
    text: string,
    words: CreateAskWordsType | null | undefined,
    isSpaced: boolean,
): { ask: TypedCreateAskType; coverage: number } | null {
    const reading = toReading(text, words, isSpaced);
    if (reading === null) {
        return null;
    }
    const ask = readAsk(reading);
    return ask === null ? null : { ask, coverage: measureCoverage(reading) };
}

function toReading(
    text: string,
    words: CreateAskWordsType | null | undefined,
    isSpaced: boolean,
): ReadingType | null {
    if (words === null || words === undefined) {
        return null;
    }
    const shownLine = toShownLine(text);
    const line = toAskLine(text);
    if (line === '' || line.startsWith('/') || line.length > MAX_ASK_LENGTH) {
        return null;
    }
    const urlList = line.match(URL_PATTERN) ?? [];
    const lowered = toLowerLine(line);
    // A lowered letter of another length leaves the spans on the lowered
    // line: a name then keeps its lower case.
    const source = lowered.length === line.length ? line : lowered;
    const lower = lowered.replace(URL_PATTERN, (url) => {
        return ' '.repeat(url.length);
    });
    const masked = source.replace(URL_PATTERN, (url) => {
        return ' '.repeat(url.length);
    });
    const reading: ReadingType = {
        source: masked,
        // The same letters as typed, where lowering kept every place.
        shown: source === line ? shownLine : masked,
        urlList,
        lower,
        isSpaced,
        words,
        spanMap: new Map(
            CREATE_ASK_WORD_GROUP_LIST.map((group) => {
                return [group, findWordSpans(lower, words[group], isSpaced)];
            }),
        ),
    };
    return reading;
}

function readAsk(reading: ReadingType): TypedCreateAskType | null {
    const { urlList } = reading;
    if (checkHas(reading, 'howTo') || checkHas(reading, 'done')) {
        return null;
    }
    const has = (group: CreateAskWordGroupType) => {
        return checkHas(reading, group);
    };
    // A line with a link is about the link: one video or track to bring
    // in, or nobody's ask here.
    if (urlList.length > 0) {
        if (
            urlList.length !== 1 ||
            !(has('download') || has('save') || has('make')) ||
            has('lyric') ||
            has('slide')
        ) {
            return null;
        }
        const url = urlList[0].replace(/[.,;:!?)\]]+$/u, '');
        if (url.length > MAX_URL_LENGTH) {
            return null;
        }
        if (has('audio') && !has('video')) {
            return { job: 'backgroundLink', kind: 'audio', url };
        }
        return has('video') || has('background')
            ? { job: 'backgroundLink', kind: 'video', url }
            : null;
    }
    const references = readTypedReferences(reading);
    if (
        has('save') &&
        (has('list') || has('bibleList')) &&
        references.length > 0
    ) {
        return {
            job: 'bibleList',
            listName: readTypedName(reading)?.name ?? null,
            isNewList: false,
            references,
        };
    }
    if (!has('make')) {
        return null;
    }
    const madeWith = (group: CreateAskWordGroupType) => {
        return checkHasTogether(reading, 'make', group);
    };
    if (madeWith('webPage')) {
        return {
            job: 'webBackground',
            name: readTypedName(reading)?.name ?? null,
            description: '',
        };
    }
    if (madeWith('flow') || madeWith('slide')) {
        const name = readTypedName(reading);
        return {
            job: 'document',
            kind: madeWith('flow') ? 'flow' : 'slide',
            isNew: has('new'),
            name: name?.name ?? null,
            hasContent: checkHasContent(reading, name),
        };
    }
    // A Bibles list, or a NEW list given a name: the help window makes no
    // other. Its words may stand apart -- "a list, a new one, of the Bible
    // called Easter". Unnamed, a new list may be a running order said in
    // words the language's list does not hold: no guess.
    const listName = readTypedName(reading)?.name ?? null;
    if (
        madeWith('bibleList') ||
        (madeWith('list') && has('new') && listName !== null)
    ) {
        return {
            job: 'bibleList',
            listName,
            isNewList: true,
            references,
        };
    }
    return null;
}

function checkHasQuestionWords(
    lower: string,
    words: CreateAskWordsType,
    isSpaced: boolean,
) {
    return (
        findWordSpans(lower, words.howTo, isSpaced).length > 0 ||
        findWordSpans(lower, words.done, isSpaced).length > 0
    );
}

function toQuestionLine(text: string) {
    return toLowerLine(toAskLine(text)).replace(URL_PATTERN, (url) => {
        return ' '.repeat(url.length);
    });
}

// The words that say what a line is about: a request, or a thing made.
const SUBJECT_GROUP_LIST = [
    'make',
    'save',
    'download',
    'flow',
    'slide',
    'list',
    'bibleList',
    'webPage',
    'background',
    'video',
    'audio',
    'lyric',
] as const;

/** A question in the language a line is typed in: about a thing it names. */
function checkHasOwnQuestion(
    text: string,
    words: CreateAskWordsType,
    isSpaced: boolean,
) {
    const lower = toQuestionLine(text);
    return (
        checkHasQuestionWords(lower, words, isSpaced) &&
        SUBJECT_GROUP_LIST.some((group) => {
            return findWordSpans(lower, words[group], isSpaced).length > 0;
        })
    );
}

/**
 * Whether a line holds a language's how-to words: a question, no ask. For a
 * language the line is NOT typed in, only beside that language's own word to
 * make, save or fetch -- its "how" may be this one's syllable.
 */
function checkHasTypedHowTo(
    text: string,
    words: CreateAskWordsType,
    isSpaced: boolean,
) {
    const lower = toQuestionLine(text);
    return (
        checkHasQuestionWords(lower, words, isSpaced) &&
        (['make', 'save', 'download'] as const).some((group) => {
            return findWordSpans(lower, words[group], isSpaced).length > 0;
        })
    );
}

/**
 * A line in the person's own language, read with the words of the language
 * it is typed in first, then the app's, then any other installed one's (a
 * line told apart from its neighbour by a word or two -- Malay and
 * Indonesian -- is named the first of them); of the languages that read it,
 * the one whose words cover the most of it. A how-to in ANY of them reads
 * nothing: a neighbour's list that lacks this language's question words
 * must not take its question for a request. A how-to is that language's
 * question word with its own word to make, save or fetch: one language's
 * "what" is another's "name" (an Igbo ask had been read as a Maori
 * question). English, and a line no installed language's words read, is
 * null: English has its readers.
 */
export function readCreateAskInOwnLanguage(
    text: string,
    appLangCode: string = getAppLangCode(),
): TypedCreateAskType | null {
    const typedCode = detectTypedLanguage(text, appLangCode);
    if (typedCode === DEFAULT_CHAT_LANG_CODE) {
        return null;
    }
    const firstCodeList = [typedCode, appLangCode].filter(
        (code): code is string => {
            return code !== null;
        },
    );
    const languageList = [
        ...firstCodeList.map((code) => {
            return getAssistantLanguage(code);
        }),
        ...listAssistantLanguages(),
        ...listTypedLanguages(),
    ].filter((language, index, list) => {
        return (
            language.code !== DEFAULT_CHAT_LANG_CODE &&
            language.createAskWords !== null &&
            list.indexOf(language) === index
        );
    });
    const readerList = languageList.map((language) => {
        return {
            words: language.createAskWords as CreateAskWordsType,
            isSpaced: checkIsSpacedLocale(language.code),
        };
    });
    // The language it is typed in says so by its question words beside any
    // word of its own for a thing to make: a Nepali _I made a Bible list
    // last week but it is empty_ was null in Nepali and read as a NEW list
    // by a neighbour of the same script, whose word to make took the Nepali
    // past form (EC-516's held-out set). Not by its question words alone:
    // a Maori line named Shona held the Shona "why", which is the Maori
    // "this".
    const typedLanguage =
        typedCode === null ? null : getAssistantLanguage(typedCode);
    if (
        typedLanguage !== null &&
        typedLanguage.code === typedCode &&
        typedLanguage.createAskWords !== null &&
        checkHasOwnQuestion(
            text,
            typedLanguage.createAskWords as CreateAskWordsType,
            checkIsSpacedLocale(typedLanguage.code),
        )
    ) {
        return null;
    }
    if (
        readerList.some(({ words, isSpaced }) => {
            return checkHasTypedHowTo(text, words, isSpaced);
        })
    ) {
        return null;
    }
    // The language that reads the most of the line; of two alike, the
    // first -- the one it is typed in, then the app's.
    let best: { ask: TypedCreateAskType; coverage: number } | null = null;
    for (const { words, isSpaced } of readerList) {
        const scored = readTypedCreateAskScored(text, words, isSpaced);
        if (
            scored !== null &&
            (best === null || scored.coverage > best.coverage)
        ) {
            best = scored;
        }
    }
    return best?.ask ?? null;
}

/** A new running order or slide document, as `readDocumentCreateAsk` says it. */
export function toTypedDocumentCreateAsk(
    ask: TypedCreateAskType | null,
    openKinds: readonly DocumentCreateKindType[] = [],
): DocumentCreateAskType | null {
    if (ask?.job !== 'document') {
        return null;
    }
    // A kind already open in the tab is THAT file's: only a new one is made.
    if (openKinds.includes(ask.kind) && !ask.isNew) {
        return null;
    }
    return {
        kind: ask.kind,
        name: ask.name,
        dayName: null,
        hasContent: ask.hasContent,
    };
}

/** Passages for a Bibles list, as `readBibleListAsk` says it. */
export function toTypedBibleListAsk(
    ask: TypedCreateAskType | null,
): BibleListAskType | null {
    if (ask?.job !== 'bibleList') {
        return null;
    }
    return {
        listName: ask.listName,
        isNewList: ask.isNewList,
        references: ask.references,
    };
}

/** A background web page, as `readWebBackgroundAsk` says it. */
export function toTypedWebBackgroundAsk(
    ask: TypedCreateAskType | null,
): WebBackgroundAskType | null {
    if (ask?.job !== 'webBackground') {
        return null;
    }
    return { name: ask.name, description: ask.description };
}

/** A video or a track from a link, as `readBackgroundLinkAsk` says it. */
export function toTypedBackgroundLinkAsk(
    ask: TypedCreateAskType | null,
): BackgroundLinkAskType | null {
    if (ask?.job !== 'backgroundLink') {
        return null;
    }
    return { kind: ask.kind, url: ask.url };
}
