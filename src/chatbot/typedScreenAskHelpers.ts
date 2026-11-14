/**
 * A line about the SCREENS' own controls typed in the person's own
 * language (2026-11-14, EC-614; the user's goal: _chatbot is very smart to
 * help user control screen_). `readScreenControlAsk` reads English; every
 * other language says the same asks as DATA: `screenAsks` in its
 * `typed.json` (or `assistant.json`) -- word LISTS, read the way
 * `createAsks` are (`findWordSpans`: a `*` at an entry's end lets letters
 * follow, at its start lets letters come before, parts joined by an
 * ellipsis match in order a few words apart; where the script does not
 * space its words, an entry of its letters matches anywhere, and one of
 * other letters -- `tv`, `kjv` -- as a whole word of them):
 *
 * - `howTo`: how, where, can I, is it possible -- a question for the
 *   guide. Never "what" or "which": _which versions are on screen 1?_ is
 *   the screens read, and the screens' tool answers it;
 * - `screen`: a screen named (screen, projector, TV, monitor);
 * - `bible`: the Bible text a screen shows (the Bible, a verse, a passage);
 * - one list per control, as the English reader names them: `style`,
 *   `versions`, `lineSync`, `transition`, `display`, `group`, `lock`,
 *   `stage`, `select`, `clear`;
 * - `exclude`: another conversation's subject (a song's words, a note, a
 *   countdown, the app's own settings, a group of PEOPLE): never a screen's
 *   control.
 *
 * A control is read when its words are there with a screen named or, on
 * the Presenter, the Bible text -- in the Reader and the editors the Bible
 * text is the page's own. A transition and Line Sync name nothing else, so
 * on the Presenter their words are enough. A screen called by its number --
 * _screen 0_, _screen #2_ -- with no control's words is `screen`: whatever
 * is asked of a numbered screen is the screens' tool's (EC-623). Only null
 * or not decides the route; the kind says which control, for the tests.
 *
 * A screen ADDED (EC-630) is read in another language by the Mini Screen
 * menu's own words alone, as the window shows them -- no package lists
 * words for it (`checkHasNewScreenLabel`).
 */
import {
    DEFAULT_CHAT_LANG_CODE,
    detectTypedLanguage,
    getAppLangCode,
    getAssistantLanguage,
    listAssistantLanguages,
    listTypedLanguages,
    toAsciiDigits,
} from './chatLangHelpers';
import {
    readScreenControlAsk,
    type ScreenAskKindType,
} from './screenChatHelpers';
import { findWordSpans, toLowerAskLine } from './typedCreateAskHelpers';
import { tran } from './chatTranHelpers';
import { checkIsSpacedLocale } from '../helper/bibleVerseFindHelpers';

export const SCREEN_ASK_KIND_ORDER_LIST = [
    'transition',
    'lineSync',
    'display',
    'group',
    'lock',
    'stage',
    'versions',
    'select',
    'clear',
    'style',
] as const satisfies readonly ScreenAskKindType[];

export const SCREEN_ASK_WORD_GROUP_LIST = [
    'howTo',
    'screen',
    'bible',
    ...SCREEN_ASK_KIND_ORDER_LIST,
    'exclude',
] as const;

export type ScreenAskWordGroupType =
    (typeof SCREEN_ASK_WORD_GROUP_LIST)[number];

export type ScreenAskWordsType = Partial<
    Record<ScreenAskWordGroupType, string[]>
>;

/**
 * What a line asks of the screens: one control, or `screen` -- a screen
 * called by its number with no control's words beside it.
 */
export type ScreenAskReadType = ScreenAskKindType | 'screen';

// The controls whose words name nothing but a screen's control.
const ALONE_KIND_SET: ReadonlySet<ScreenAskKindType> = new Set([
    'transition',
    'lineSync',
]);

const MAX_ASK_LENGTH = 600;

/**
 * Whether one list reads in a lowered line. In a list of a script that
 * does not space its words, an entry holding none of the language's own
 * letters -- `tv` or `kjv` written in Latin beside them -- is a whole word
 * of its own letters, which the language's letters may still touch
 * (`otherLower` has them as spaces): matched anywhere, `niv` was read
 * inside _university_, and every installed language's lists are tried on
 * every line.
 */
function checkHasListWords(
    reading: ReadingType,
    entryList: readonly string[] | undefined,
    isSpaced: boolean,
    ownLetterPattern: RegExp | null,
) {
    if (isSpaced || ownLetterPattern === null || reading.otherLower === null) {
        return findWordSpans(reading.lower, entryList, isSpaced).length > 0;
    }
    const [ownList, otherList] = splitByLetters(entryList, ownLetterPattern);
    return (
        findWordSpans(reading.lower, ownList, false).length > 0 ||
        findWordSpans(reading.otherLower, otherList, true).length > 0
    );
}

type ReadingType = { lower: string; otherLower: string | null };
type SpanType = ReturnType<typeof findWordSpans>[number];

// A list's entries of the language's own letters, and the others.
function splitByLetters(
    entryList: readonly string[] | undefined,
    ownLetterPattern: RegExp,
) {
    const ownList: string[] = [];
    const otherList: string[] = [];
    for (const entry of entryList ?? []) {
        if (typeof entry === 'string') {
            (ownLetterPattern.test(entry) ? ownList : otherList).push(entry);
        }
    }
    return [ownList, otherList] as const;
}

// Where a list's entries are in the line, read as `checkHasListWords`
// reads them.
function listListWordSpans(
    reading: ReadingType,
    entryList: readonly string[] | undefined,
    isSpaced: boolean,
    ownLetterPattern: RegExp | null,
): SpanType[] {
    if (isSpaced || ownLetterPattern === null || reading.otherLower === null) {
        return findWordSpans(reading.lower, entryList, isSpaced);
    }
    const [ownList, otherList] = splitByLetters(entryList, ownLetterPattern);
    return [
        ...findWordSpans(reading.lower, ownList, false),
        ...findWordSpans(reading.otherLower, otherList, true),
    ];
}

// How many places of the line spans hold, the overlapping ones once.
function countSpanPlaces(spanList: SpanType[]) {
    let count = 0;
    let end = -1;
    for (const [start, stop] of [...spanList].sort((a, b) => {
        return a[0] - b[0];
    })) {
        if (start >= end) {
            count += 1;
        }
        end = Math.max(end, stop);
    }
    return count;
}

/**
 * A Bible's short name both names the Bible and asks for a version: beside
 * a chapter's or a verse's number, with no other word for a version and no
 * second Bible, it is the passage put up in that Bible -- _present Psalm 23
 * NIV_ had read as versions in the 71 languages that list the NIV.
 */
function checkIsPassageInBible(
    source: string,
    reading: ReadingType,
    words: ScreenAskWordsType,
    isSpaced: boolean,
    ownLetterPattern: RegExp | null,
) {
    if (!/\d/.test(toAsciiDigits(source))) {
        return false;
    }
    const bibleSet = new Set(words.bible ?? []);
    const versionList = words.versions ?? [];
    const otherList = versionList.filter((entry) => {
        return !bibleSet.has(entry);
    });
    if (checkHasListWords(reading, otherList, isSpaced, ownLetterPattern)) {
        return false;
    }
    const nameList = versionList.filter((entry) => {
        return bibleSet.has(entry);
    });
    return (
        countSpanPlaces(
            listListWordSpans(reading, nameList, isSpaced, ownLetterPattern),
        ) < 2
    );
}

// The lowered line, and -- for a list of a script that does not space its
// words -- the same line with that script's letters made spaces, as long as
// the line, so a place in one is the same place in the other.
function toReading(
    text: string,
    isSpaced: boolean,
    ownLetterPattern: RegExp | null,
) {
    const lower = toLowerAskLine(text);
    return {
        lower,
        otherLower:
            isSpaced || ownLetterPattern === null
                ? null
                : lower.replace(
                      new RegExp(ownLetterPattern.source, 'gu'),
                      (letter) => {
                          return ' '.repeat(letter.length);
                      },
                  ),
    };
}

/**
 * The screen control one language's words read in a line: null for none, a
 * how-to and another conversation's subject.
 */
export function readTypedScreenAsk(
    text: string,
    words: ScreenAskWordsType,
    isSpaced: boolean,
    focus: string | null = 'presenter',
    ownLetterPattern: RegExp | null = null,
): ScreenAskReadType | null {
    const source = String(text ?? '');
    if (source.length > MAX_ASK_LENGTH || source.trim().startsWith('/')) {
        return null;
    }
    const reading = toReading(source, isSpaced, ownLetterPattern);
    if (reading.lower === '') {
        return null;
    }
    const checkHas = (group: ScreenAskWordGroupType) => {
        return checkHasListWords(
            reading,
            words[group],
            isSpaced,
            ownLetterPattern,
        );
    };
    const isPresenter = focus === 'presenter';
    const isScreen = checkHas('screen');
    const isNamed = isScreen || (isPresenter && checkHas('bible'));
    // A control's words count beside a screen's or a Bible's, or alone for
    // a control that names nothing else -- asked in that order, so a line
    // naming neither costs two lists of the ten, not ten: every installed
    // language's lists are tried on every line.
    const controlKind =
        SCREEN_ASK_KIND_ORDER_LIST.find((kind) => {
            return (
                (isNamed || (isPresenter && ALONE_KIND_SET.has(kind))) &&
                checkHas(kind) &&
                (kind !== 'versions' ||
                    isScreen ||
                    !checkIsPassageInBible(
                        source,
                        reading,
                        words,
                        isSpaced,
                        ownLetterPattern,
                    ))
            );
        }) ?? null;
    // A screen called by its number is the screens' whatever is asked of
    // it (EC-623): their controls are said in a long tail of ways, and a
    // third of a fresh set's misses named _screen 0_ beside words no list
    // held. What a screen shows, or whether it is on, the screens' tool
    // answers from its read, and it turns one on only when asked.
    const kind: ScreenAskReadType | null =
        controlKind ??
        (isScreen &&
        checkHasScreenNumber(reading, words, isSpaced, ownLetterPattern)
            ? 'screen'
            : null);
    // A how-to, or another conversation's subject, reads nothing: looked
    // for once something is read, which most lines in most languages are
    // not.
    if (kind === null || checkHas('howTo') || checkHas('exclude')) {
        return null;
    }
    return kind;
}

// A number right after a screen's word -- _screen 1_, _screen #2_ -- of
// one or two digits of any script, never a verse's _3:16_ or a longer one.
const SCREEN_NUMBER_PATTERN = /^\s?#?\s?\p{Nd}{1,2}(?!\p{Nd}|[:.,]\p{Nd})/u;
// Where a number ends: no more of it, nor a verse's place.
const NUMBER_END_PATTERN = /^(?!\p{Nd}|[:.,]\p{Nd})/u;
const ENDS_IN_NUMBER_PATTERN = /\p{Nd}$/u;

/**
 * Whether a screen's word has its number right after it. A language whose
 * word for a screen is also an everyday word lists it only with a number
 * after it, as one entry: there the number is the entry's own.
 */
function checkHasScreenNumber(
    reading: ReadingType,
    words: ScreenAskWordsType,
    isSpaced: boolean,
    ownLetterPattern: RegExp | null,
) {
    return listListWordSpans(
        reading,
        words.screen,
        isSpaced,
        ownLetterPattern,
    ).some(([start, end]) => {
        const after = reading.lower.slice(end);
        return (
            SCREEN_NUMBER_PATTERN.test(after) ||
            (ENDS_IN_NUMBER_PATTERN.test(reading.lower.slice(start, end)) &&
                NUMBER_END_PATTERN.test(after))
        );
    });
}

// Whether a language's own words call the line a how-to, or -- with
// `isExcludeRead` -- another conversation's subject.
function checkIsHowToOrExcluded(
    text: string,
    language: {
        code: string;
        scriptPattern: RegExp | null;
        screenAskWords: ScreenAskWordsType | null;
    },
    isExcludeRead = true,
) {
    const words = language.screenAskWords;
    if (words === null) {
        return false;
    }
    const isSpaced = checkIsSpacedLocale(language.code);
    const reading = toReading(text, isSpaced, language.scriptPattern);
    return (
        checkHasListWords(
            reading,
            words.howTo,
            isSpaced,
            language.scriptPattern,
        ) ||
        (isExcludeRead &&
            checkHasListWords(
                reading,
                words.exclude,
                isSpaced,
                language.scriptPattern,
            ))
    );
}

// Every installed language that says its screen asks: the one the line is
// typed in first, then the app's, then the rest.
function listScreenAskLanguages(typedCode: string | null, appLangCode: string) {
    const firstCodeList = [typedCode, appLangCode].filter(
        (code): code is string => {
            return code !== null;
        },
    );
    return [
        ...firstCodeList.map((code) => {
            return getAssistantLanguage(code);
        }),
        ...listAssistantLanguages(),
        ...listTypedLanguages(),
    ].filter((language, index, list) => {
        return (
            language.code !== DEFAULT_CHAT_LANG_CODE &&
            language.screenAskWords !== null &&
            list.indexOf(language) === index
        );
    });
}

// How much of a line the menu's own words must be: a word or two beside
// them -- a please -- still asks for it; the label named in a longer
// sentence (_the button … does nothing_) is about the button.
const NEW_SCREEN_LABEL_SHARE = 0.6;

function countAskLetters(text: string) {
    return (text.match(/[\p{L}\p{M}\p{N}]/gu) ?? []).length;
}

/**
 * Whether a line asks for a screen added by the Mini Screen menu's own
 * words as the window shows them (`tran('Add New Screen')`, 2026-11-14,
 * EC-630), in whatever language the app is in: no package names it in
 * words of its own. Its other words are English's alone
 * (`readScreenControlAsk`): another language's "another" or "new" beside
 * its word for a screen says other things too -- a screen there is, on
 * the other side of the room.
 */
function checkHasNewScreenLabel(text: string, appLangCode: string) {
    const label = toLowerAskLine(tran('Add New Screen'));
    const labelLetterCount = countAskLetters(label);
    if (labelLetterCount === 0) {
        return false;
    }
    const lower = toLowerAskLine(text);
    return (
        labelLetterCount >= NEW_SCREEN_LABEL_SHARE * countAskLetters(lower) &&
        findWordSpans(lower, [label], checkIsSpacedLocale(appLangCode)).length >
            0
    );
}

/**
 * How a typed line reads beside a passage it names (2026-11-14, EC-622,
 * `typedVerseAskHelpers.ts`), by the same words the screen asks are read
 * by: the language it is typed in (`detectTypedLanguage`: a code, `other`
 * or null), whether any installed language's how-to words read it -- as
 * `readScreenAsk` stops a how-to -- and whether the language it is typed in
 * calls it another conversation's subject: a song, a note, a countdown, a
 * clock, the app's settings.
 */
export function readTypedLineSubject(
    text: string,
    appLangCode: string = getAppLangCode(),
) {
    const typedCode = detectTypedLanguage(text, appLangCode);
    const isHowTo = listScreenAskLanguages(typedCode, appLangCode).some(
        (language) => {
            return checkIsHowToOrExcluded(text, language, false);
        },
    );
    const typedLanguage =
        typedCode === null ? null : getAssistantLanguage(typedCode);
    const isOtherSubject =
        typedLanguage !== null &&
        typedLanguage.code === typedCode &&
        typedLanguage.screenAskWords !== null &&
        checkIsHowToOrExcluded(text, typedLanguage);
    return { typedCode, isHowTo, isOtherSubject };
}

/**
 * The screen control a typed line asks about, in any language: English by
 * `readScreenControlAsk`, every other installed language by its own words
 * -- the language it is typed in first, then the app's, then any other
 * installed one's; the first that reads a control decides. A how-to or
 * another conversation's subject in the language it is typed in reads
 * nothing, whatever English or a neighbour's words would read: a how-to
 * in another language that names the transition by the English word is
 * still a how-to, though English reads its "transition" (seven of 616
 * lines that only look like a screen ask, each such a how-to, had gone to
 * the screens). And any line is a how-to when ANY installed language's
 * how-to words read it, whichever language it is taken for: a line no
 * language here can name (a fifth of the blind asks), and one taken for
 * the wrong language -- a how-to taken for English for its English words,
 * or for a neighbour that shares most of its own. Not their other
 * subjects: one language's word for a song is another's word for a thing,
 * and had stopped a group ask. With every language installed that costs
 * about a millisecond a line that reads nothing, and two for one that
 * reads a control (measured 2026-11-14 on a development machine).
 */
export function readScreenAsk(
    text: string,
    focus: string | null = 'presenter',
    appLangCode: string = getAppLangCode(),
): ScreenAskReadType | null {
    const typedCode = detectTypedLanguage(text, appLangCode);
    const languageList = listScreenAskLanguages(typedCode, appLangCode);
    const kind = readScreenAskKind(
        text,
        focus,
        typedCode,
        languageList,
        appLangCode,
    );
    // A how-to in any installed language's words reads nothing, whichever
    // language the line is taken for: nothing else would stop English's
    // words, which read a transition alone, from reading a how-to that
    // names it by the English word -- a line no language here can name,
    // or one taken for the wrong language. Looked for once a control is
    // read: every installed language's how-to words cost more than the
    // rest of a line that reads nothing.
    if (
        kind === null ||
        languageList.some((language) => {
            return checkIsHowToOrExcluded(text, language, false);
        })
    ) {
        return null;
    }
    return kind;
}

// What `readScreenAsk` reads before any installed language's how-to words
// are looked for.
function readScreenAskKind(
    text: string,
    focus: string | null,
    typedCode: string | null,
    languageList: ReturnType<typeof listScreenAskLanguages>,
    appLangCode: string,
): ScreenAskReadType | null {
    if (typedCode === DEFAULT_CHAT_LANG_CODE) {
        return readScreenControlAsk(text, focus);
    }
    // Another subject in the language it is typed in reads nothing.
    const typedLanguage =
        typedCode === null ? null : getAssistantLanguage(typedCode);
    const isTypedNamed =
        typedLanguage !== null &&
        typedLanguage.code === typedCode &&
        typedLanguage.screenAskWords !== null;
    if (isTypedNamed && checkIsHowToOrExcluded(text, typedLanguage)) {
        return null;
    }
    if (checkHasNewScreenLabel(text, appLangCode)) {
        return 'newScreen';
    }
    const englishKind = readScreenControlAsk(text, focus);
    if (englishKind !== null) {
        return englishKind;
    }
    // A control any language names is said before a screen called by its
    // number alone.
    let numberedKind: ScreenAskReadType | null = null;
    for (const language of languageList) {
        const kind = readTypedScreenAsk(
            text,
            language.screenAskWords as ScreenAskWordsType,
            checkIsSpacedLocale(language.code),
            focus,
            language.scriptPattern,
        );
        if (kind === 'screen') {
            numberedKind ??= kind;
        } else if (kind !== null) {
            return kind;
        }
    }
    // A number beside a screen's word is all such a line has: one named no
    // language is stopped by another subject in ANY installed language's
    // words. _A 5-minute countdown on the screen_ says the screen's word and
    // then a number, and is named its language in its own app alone. Not
    // one named a language: one's word for a phone is another's _open_.
    if (
        numberedKind !== null &&
        !isTypedNamed &&
        languageList.some((language) => {
            return checkIsHowToOrExcluded(text, language);
        })
    ) {
        return null;
    }
    return numberedKind;
}
