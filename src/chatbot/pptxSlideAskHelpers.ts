/**
 * A PowerPoint made into a slide document, asked for in the help window
 * (2026-11-20, `EC-763`; the user's story: _as a user I want to ask chatbot
 * to help convert the pptx file to app-document file_, the goal: _chatbot
 * help convert .pptx to .ows file with 95% alike_).
 *
 * The app shows a PowerPoint in its Documents list, but a slide document is
 * what its Slide Editor changes, its stages show and its chatbot edits. The
 * window answers such an ask itself, on any assistant and with no model:
 * the PowerPoints of the Documents list as one button each, or -- the ask
 * naming one -- that one converted at once (`owa_media_file` `convert`,
 * which says how alike the new slides measure).
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import { fillWords, tran } from './chatTranHelpers';
import { pickDeckFiles, toDeckFilePath } from './deckSongAskHelpers';

/**
 * The pseudo tool a PowerPoint's button carries (`args.filePath`,
 * `args.name`): the window converts that file. Never sent to a model.
 */
export const PPTX_SLIDES_TOOL_NAME = 'owa-pptx-slides';

/** How many PowerPoints of the Documents list are offered as buttons. */
export const MAX_PPTX_BUTTON_COUNT = 6;

const MAX_PPTX_SLIDES_ASK_WORDS = 24;
// A line with no verb in it: _the Easter pptx to ows_.
const MAX_BARE_ASK_WORDS = 6;

// The PowerPoint, as a volunteer says it.
const PPTX_WORD_SOURCE =
    '(?:power\\s*-?\\s*points?|\\.?pptx|\\.?ppt|slide\\s*-?\\s*decks?|decks?)';
// This app's own slides, said by name: never a bare "slides", which a
// PowerPoint is made of too.
const OWS_WORD_SOURCE =
    '(?:\\.?ows(?:\\s+files?)?|slide\\s*-?\\s*documents?|' +
    'app\\s*-?\\s*documents?(?:\\s+files?)?|presenter\\s+documents?|' +
    "(?:this|the)\\s+app(?:'s|s)?\\s+(?:own\\s+)?(?:format|documents?|slides?))";
// "slides" alone, only said the way round a PowerPoint is made into them.
const SLIDES_WORD_SOURCE = '(?:editable\\s+)?slides?';
const INTO_SOURCE =
    '\\b(?:to|into|as)\\s+(?:an?\\s+|the\\s+|my\\s+|our\\s+|new\\s+|editable\\s+|own\\s+)*';
const PPTX_INTO_OWS_PATTERN = new RegExp(
    `\\b${PPTX_WORD_SOURCE}\\b.*${INTO_SOURCE}${OWS_WORD_SOURCE}`,
    'i',
);
const PPTX_INTO_SLIDES_PATTERN = new RegExp(
    `\\b${PPTX_WORD_SOURCE}\\b.*${INTO_SOURCE}${SLIDES_WORD_SOURCE}\\b`,
    'i',
);
const OWS_FROM_PPTX_PATTERN = new RegExp(
    `${OWS_WORD_SOURCE}\\b.*\\b(?:from|out\\s+of|of)\\s+.*\\b${PPTX_WORD_SOURCE}\\b`,
    'i',
);
const SLIDES_FROM_PPTX_PATTERN = new RegExp(
    `\\b${SLIDES_WORD_SOURCE}\\s+(?:from|out\\s+of)\\s+.*\\b${PPTX_WORD_SOURCE}\\b`,
    'i',
);
const TURN_WORD_PATTERN =
    /\b(?:turn|turns|turning|convert|converts|converting|conversion|change|transform|make|makes|making|create|creating|import|importing|build|generate|get|save|bring|open)\b/i;
// A song out of a deck is the song drafter's (`deckSongAskHelpers.ts`).
const SONG_WORD_PATTERN = /\b(?:songs?|lyrics?|hymns?)\b/i;
// The app's own name is no deck's name.
const APP_NAME_PATTERN = /\bopen\s*-?\s*worship(?:\s+app)?\b/gi;

const ASK_FILLER_WORD_SET = new Set(
    (
        'a an the my our your this that these those it its them all any ' +
        'every each some to into from of for with in on at as by and or ' +
        'please can could would will you i me us we do does how what which ' +
        'is are be there here out up file files document documents doc docs ' +
        'list folder new one ones called named titled power point points ' +
        'powerpoint powerpoints pptx ppt slide slides deck decks app apps ' +
        'ows presenter format own editable turn turns turning convert ' +
        'converts converting conversion change transform make makes making ' +
        'create creating import importing build generate get save bring ' +
        'open want need help like just so it s'
    ).split(' '),
);

export type PptxSlidesAskType = {
    /** Words that may name the PowerPoint (lower case), none when none. */
    nameWords: string[];
};

function toNameWords(text: string): string[] {
    const quoted = /["“”«»]([^"“”«»\n]{2,80})["“”«»]/u.exec(text)?.[1];
    const source = (quoted ?? text).replace(APP_NAME_PATTERN, ' ');
    const words = source
        .toLowerCase()
        .split(/[^\p{L}\p{M}\p{N}]+/u)
        .filter((word) => {
            return word !== '' && !ASK_FILLER_WORD_SET.has(word);
        });
    return [...new Set(words)];
}

/**
 * Is this an ask to make a PowerPoint into a slide document of this app --
 * _convert .pptx to .ows_, _turn the pptx file into an app document_,
 * _make a slide document from my PowerPoint_, _import the deck as slides_
 * -- and, when it names the PowerPoint, its name's words? Null for anything
 * else: a song out of a deck (the song drafter's), a slide document put into
 * a PowerPoint, a PowerPoint's slides talked about, a long message.
 */
export function readPptxSlidesAsk(text: string): PptxSlidesAskType | null {
    const trimmed = String(text ?? '').trim();
    if (
        trimmed === '' ||
        trimmed.startsWith('/') ||
        trimmed.includes('\n') ||
        trimmed.includes('```') ||
        /https?:\/\//i.test(trimmed) ||
        trimmed.split(/\s+/).length > MAX_PPTX_SLIDES_ASK_WORDS ||
        SONG_WORD_PATTERN.test(trimmed)
    ) {
        return null;
    }
    // _an Open Worship slide document_ is a slide document.
    const plain = trimmed.replace(APP_NAME_PATTERN, ' ').replace(/\s+/g, ' ');
    // No verb: only a short line naming both, _pptx to ows_, as the song
    // drafter takes _powerpoint to lyric_ -- never _powerpoint slides_.
    if (!TURN_WORD_PATTERN.test(trimmed)) {
        return plain.split(' ').length <= MAX_BARE_ASK_WORDS &&
            PPTX_INTO_OWS_PATTERN.test(plain)
            ? { nameWords: toNameWords(trimmed) }
            : null;
    }
    if (
        !PPTX_INTO_OWS_PATTERN.test(plain) &&
        !PPTX_INTO_SLIDES_PATTERN.test(plain) &&
        !OWS_FROM_PPTX_PATTERN.test(plain) &&
        !SLIDES_FROM_PPTX_PATTERN.test(plain)
    ) {
        return null;
    }
    return { nameWords: toNameWords(trimmed) };
}

/** A PowerPoint the converter reads: `.pptx`, never an older `.ppt`. */
export function checkIsPptxFileName(name: string) {
    return /\.pptx$/i.test(name);
}

/**
 * The PowerPoints of the Documents list an ask is about: every one whose
 * name holds the words named, else the ones holding the most of them, else
 * all -- in the list's own order. `isNamed` says the words chose them.
 */
export function pickPptxFiles(
    names: readonly string[],
    nameWords: readonly string[],
) {
    return pickDeckFiles(names.filter(checkIsPptxFileName), nameWords, [
        'pptx',
    ]);
}

export type PptxSlidesActionType = {
    label: string;
    toolName: string;
    args: { filePath: string; name: string };
};

/**
 * The answer to such an ask when no one PowerPoint is settled: a button
 * each (`MAX_PPTX_BUTTON_COUNT` at most, how many more said) -- or, with
 * none in the list, how to put one there. Labels in English: the window
 * translates them where drawn (`Make a slide document from "{name}"`).
 */
export function genPptxSlidesListAnswer(
    folder: string,
    files: readonly string[],
): { text: string; actions: PptxSlidesActionType[] } {
    if (files.length === 0) {
        return {
            text: tran(
                'Your Documents list has no PowerPoint to make a slide ' +
                    'document of. Drop the PowerPoint file on the Documents ' +
                    'list, then ask me again.',
            ),
            actions: [],
        };
    }
    const shown = files.slice(0, MAX_PPTX_BUTTON_COUNT);
    const lines = [
        tran(
            'I can make a slide document of a PowerPoint in your Documents ' +
                'list, each slide looking the same and each shape a box you ' +
                'can change. Press one of them below.',
        ),
    ];
    if (files.length > shown.length) {
        lines.push(
            fillWords(
                tran(
                    'These are {shown} of the {count} in your Documents ' +
                        'list. Say the file’s name in your question to find ' +
                        'another one.',
                ),
                { shown: shown.length, count: files.length },
            ),
        );
    }
    return {
        text: lines.join('\n\n'),
        actions: shown.map((name) => {
            return {
                label: `Make a slide document from "${name}"`,
                toolName: PPTX_SLIDES_TOOL_NAME,
                args: { filePath: toDeckFilePath(folder, name), name },
            };
        }),
    };
}

/** A PowerPoint button's file, or null when its arguments are not one. */
export function readPptxSlidesArgs(
    args: unknown,
): { filePath: string; name: string } | null {
    const value = args as { filePath?: unknown; name?: unknown } | null;
    const filePath = value?.filePath;
    if (typeof filePath !== 'string' || !checkIsPptxFileName(filePath)) {
        return null;
    }
    const name =
        typeof value?.name === 'string' && checkIsPptxFileName(value.name)
            ? value.name
            : (filePath.split(/[\\/]/).pop() ?? filePath);
    return { filePath, name };
}

/** What `owa_media_file` `convert` answers, as far as the window reads it. */
export type PptxSlidesResultType = {
    created: string;
    from: string;
    filePath: string;
    slideCount: number;
    stepSlideCount?: number;
    likeness?: {
        percent: number;
        lowestSlide: number;
        lowestPercent: number;
        measuredSlides: number[];
    };
    missingFonts?: string[];
    leftOut?: {
        videoSlides?: number[];
        audioSlides?: number[];
        transitionSlides?: number[];
    };
    undoId?: string;
};

/** The tool's answer, or null when it is not one of its conversions. */
export function readPptxSlidesResult(
    value: unknown,
): PptxSlidesResultType | null {
    const result = value as PptxSlidesResultType | null;
    if (
        typeof result?.created !== 'string' ||
        result.created === '' ||
        typeof result.filePath !== 'string' ||
        !/\.ows$/i.test(result.filePath) ||
        typeof result.slideCount !== 'number'
    ) {
        return null;
    }
    return result;
}

const MAX_NAMED_FONT_COUNT = 6;
const MAX_NAMED_SLIDE_COUNT = 12;

function toNumberList(...lists: (number[] | undefined)[]) {
    const numberSet = new Set<number>();
    for (const list of lists) {
        for (const one of Array.isArray(list) ? list : []) {
            if (Number.isInteger(one) && one > 0) {
                numberSet.add(one);
            }
        }
    }
    return Array.from(numberSet).sort((a, b) => {
        return a - b;
    });
}

function toShortList(list: readonly (string | number)[], max: number) {
    const shown = list.slice(0, max).join(', ');
    return list.length > max ? `${shown}, …` : shown;
}

// A list cut at the end of a sentence ends in `…`; the sentence's own full
// stop after it would read `….` (seen live in the help window, 2026-11-20).
function dropStopAfterEllipsis(text: string) {
    return text.replace(/…\./g, '…');
}

/**
 * What the window says of a conversion: the document made and from what,
 * how alike its slides measured, the steps a build became, and what did
 * not come over -- the fonts this computer lacks, the videos, sounds and
 * transitions.
 */
export function genPptxSlidesMadeText(result: PptxSlidesResultType) {
    const lines = [
        fillWords(
            tran(
                'I made “{name}” from “{from}”: {count} slides, each shape a ' +
                    'box of its own. It is in Documents now.',
            ),
            {
                name: result.created,
                from: result.from,
                count: result.slideCount,
            },
        ),
    ];
    const likeness = result.likeness;
    if (likeness !== undefined && Array.isArray(likeness.measuredSlides)) {
        lines.push(
            fillWords(
                tran(
                    'Drawn side by side, {measured} of its slides look ' +
                        '{percent}% like the PowerPoint. The least alike is ' +
                        'slide {slide}, at {lowest}%.',
                ),
                {
                    measured: likeness.measuredSlides.length,
                    percent: likeness.percent,
                    slide: likeness.lowestSlide,
                    lowest: likeness.lowestPercent,
                },
            ),
        );
    }
    if ((result.stepSlideCount ?? 0) > 0) {
        lines.push(
            tran(
                'A slide the PowerPoint builds click by click is a slide for ' +
                    'each click here.',
            ),
        );
    }
    const fonts = (result.missingFonts ?? []).filter((one) => {
        return typeof one === 'string' && one !== '';
    });
    if (fonts.length > 0) {
        lines.push(
            dropStopAfterEllipsis(
                fillWords(
                    tran(
                        'These fonts are not on this computer, so another ' +
                            'font is used: {fonts}.',
                    ),
                    { fonts: toShortList(fonts, MAX_NAMED_FONT_COUNT) },
                ),
            ),
        );
    }
    const leftOutSlides = toNumberList(
        result.leftOut?.videoSlides,
        result.leftOut?.audioSlides,
        result.leftOut?.transitionSlides,
    );
    if (leftOutSlides.length > 0) {
        lines.push(
            fillWords(
                tran(
                    'Videos, sounds and slide transitions are not carried ' +
                        'over (slides {slides}).',
                ),
                { slides: toShortList(leftOutSlides, MAX_NAMED_SLIDE_COUNT) },
            ),
        );
    }
    return lines.join('\n\n');
}

/** The sentence for a PowerPoint that could not be converted. */
export function genPptxSlidesFailedText(name: string) {
    return fillWords(
        tran(
            'I could not make a slide document of “{name}”. It may be ' +
                'damaged, locked by a password, or open in PowerPoint.',
        ),
        { name },
    );
}

/** The wait's line while a PowerPoint is converted. */
export function genPptxSlidesProgressText(name: string) {
    return fillWords(tran('Making a slide document of “{name}”'), { name });
}
