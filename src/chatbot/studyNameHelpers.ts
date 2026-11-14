/**
 * The names of people and places in a translated study, written as the
 * Bible its passages are quoted from writes them (2026-11-12, EC-535).
 *
 * The user's John 3 study, translated into Khmer by the window (EC-478),
 * quotes the chapter from a Khmer Bible and, in its own words a page
 * further on, wrote three of the passage's places as no Khmer Bible does --
 * Aenon and Salim with another vowel sign, the Jordan with other letters --
 * while the verses quoted above them write all three. The translator was
 * never shown the passage it was writing about. And the language's church
 * words (EC-491), read off another of its Bibles, write the Pharisees with
 * another vowel sign than the Bible the study quotes.
 *
 * Now, with the passages quoted in the language (the `translate` plan's
 * `quoted`), for each part:
 * - a name the passage gives in a verse or two, and no church word gives,
 *   is shown to the translator with its verse as that Bible writes it
 *   (`toStudyNameVersesText`), so it is written from there;
 * - a church word the passage writes with the same letters and another
 *   vowel sign is told as the passage writes it (`toStudyNameGuide`), and
 *   a church word for a name written so in the answer is put right in code
 *   (`repairStudyNameSpellings`): that word is known to be the name;
 * - a word of a shown verse the answer writes with the same letters and
 *   another vowel sign is named in the part's one retry
 *   (`listStudyNameSlips`): a verse's words are not all names, and two
 *   real words can differ by one vowel sign, so only the translator can
 *   tell;
 * - a name written with OTHER letters than its verse is named in that
 *   retry too (2026-11-13, EC-561), read off the words standing for it as
 *   a saved translation's are (`listStudyNameOtherLetters`, EC-560): the
 *   part's bold span naming it and the answer's in its place
 *   (`pairStudyBoldSpans`). It had only been shown -- the Jordan above was
 *   named first by the check of the saved file. The English name goes
 *   with it: the verse's word coming closest may be another word.
 *
 * Only a vowel sign of the script's own is ever a difference: the signs any
 * writer may put on or leave off -- an accent, a cedilla, the short-vowel
 * marks scripts share (`\p{Script=Inherited}`) -- are left out, and a sign
 * that is not a vowel -- a virama, a tone mark, a point (`\p{Diacritic}`)
 * -- must be the same, so a word pointed in the Bible is no slip for the
 * same word written without its points.
 *
 * Pure. The running is `runStudyTranslate` and `translateStudyPart` in
 * `llmBotHelpers.ts`.
 */
import { toAsciiDigitText } from '../helper/bibleVerseFindHelpers';
import { checkIsClusterEdge } from '../helper/scriptClusterHelpers';

/** A verse of the passage as the Bible quoted writes it, and its own words. */
export type StudyNameVerseType = {
    key: string;
    text: string;
    words: string[];
};

/** What a job knows of the names its passages give. */
export type StudyNameGuideType = {
    /** A name the passage gives in a verse or two -> those verses. */
    verseMap: Map<string, StudyNameVerseType[]>;
    /** A church word for a name -> as the Bible quoted writes it. */
    spellingMap: Map<string, string>;
    /** The church words, each as the Bible quoted writes it. */
    terms: Record<string, string>;
    /** Every word the passages quoted write. */
    wordSet: Set<string>;
    /** The words that may write each name the passages give (EC-561). */
    nameWords: StudyNameWordsType;
};

/**
 * A word of a shown verse the answer wrote with another vowel sign -- or,
 * with `name`, the words standing for that name written with other letters
 * than the verse's word coming closest (EC-561).
 */
export type StudyNameSlipType = {
    written: string;
    spelling: string;
    key: string;
    /** The name as the English writes it, for one written with other letters. */
    name?: string;
};

/** A word of the Bible quoted that may write a name, and a verse it is in. */
export type StudyNameWordType = {
    word: string;
    key: string;
};

/** The words that may write each name a passage gives (EC-560). */
export type StudyNameWordsType = {
    nameMap: Map<string, StudyNameWordType[]>;
    /** Every word the verses quoted write. */
    wordSet: Set<string>;
};

/** A name some words write with other letters than its verse (EC-560). */
export type StudyNameLettersType = {
    /** The name as the English writes it. */
    name: string;
    /** Where the words standing for it write it. */
    start: number;
    end: number;
    /** The word of its verse it comes closest to, as that verse writes it. */
    spelling: string;
    /** That verse, by its number in its passage. */
    key: string;
};

/** A text's line, or a span of it, and where it starts in the text. */
export type StudyTextSpanType = { text: string; start: number };

/** An English bold span, and the translation's in its place (EC-560). */
export type StudyBoldPairType = { english: string; span: StudyTextSpanType };

type PassagePartType = {
    kind: string;
    text: string;
    quoted?: string | null;
};

type PassagePairType = {
    english: Map<string, string>;
    target: Map<string, string>;
};

type LetterUnitType = {
    start: number;
    end: number;
    base: string;
    vowels: string;
    signs: string;
};

// A name in more verses of the passage than this is one a translator knows.
const STUDY_NAME_RARE_VERSES = 2;
// The most verses shown for one part, and the most of their words.
const STUDY_NAME_SHOWN_VERSES = 4;
const STUDY_NAME_SHOWN_CHARS = 900;
// A word of fewer letters is too short to be told from another by them.
const STUDY_NAME_MIN_LETTERS = 3;
// The most slips named in one retry.
const STUDY_NAME_MAX_SLIPS = 8;
// How alike a place's letters must be to a verse's word to be that word
// written with other letters: twice the letters both write in the same
// order over the letters of both, signs aside (EC-560). The Jordan the
// user's study wrote with a letter fewer and other signs is 0.86.
const STUDY_NAME_LIKE_RATE = 0.75;
// The letters such a place may have more or fewer than the word.
const STUDY_NAME_LIKE_REACH = 2;
// How alike a place must be that is not all the words standing for the
// name: the more letters beside it, the more places for a word to come
// close by chance (EC-561, measured: two whole words of a heading paired
// with the wrong name came to 0.75 of one of its verse's words).
const STUDY_NAME_PART_LIKE_RATE = 0.8;
// A word that may write a name is in the verses giving it and in few
// others: of all the verses either is in, half at least hold both.
const STUDY_NAME_WORD_SHARE = 0.5;
// Words in bold, on one line: `**Jordan**`.
const BOLD_SPAN_PATTERN = /\*\*([^*\n]+?)\*\*/g;
// A line of a passage quoted, whose bold is a verse's number.
const QUOTE_LINE_PATTERN = /^\s{0,3}>/;

// `> **23** And John…`: a verse as a study quotes it, its number in the
// Bible's own digits, or `> **3:36** …` across chapters.
const QUOTE_VERSE_PATTERN = /^>\s*\*\*(\p{Nd}+(?:[:.]\p{Nd}+)?)\*\*\s+(\S.*)$/u;
// A note a Bible puts in brackets (`[Deut. 18:18.]`) is none of its words.
const BRACKET_NOTE_PATTERN = /\[[^\]]*\]/gu;
const NAME_WORD_PATTERN = /\p{L}[\p{L}\p{M}]*(?:['’]\p{L}+)?/gu;
const POSSESSIVE_PATTERN = /['’]s$/u;
// What a word starting a sentence, a quotation or a bracket follows.
const SENTENCE_START_PATTERN = /[.!?:;"“”‘’(«»—–]$/u;
// Words a Bible writes with a capital for God and with none for anybody
// else -- never a name.
const PRONOUN_SET = new Set([
    'i',
    'me',
    'my',
    'mine',
    'myself',
    'you',
    'your',
    'yours',
    'yourself',
    'yourselves',
    'he',
    'him',
    'his',
    'himself',
    'she',
    'her',
    'hers',
    'herself',
    'it',
    'its',
    'itself',
    'we',
    'us',
    'our',
    'ours',
    'ourselves',
    'they',
    'them',
    'their',
    'theirs',
    'themselves',
    'who',
    'whom',
    'whose',
    'which',
    'that',
    'thou',
    'thee',
    'thy',
    'thine',
    'ye',
]);
// The gaps between a verse's words: spaces, the invisible ones a Bible's
// text puts between words, punctuation and signs.
const WORD_GAP_PATTERN = /[\s\u200B\u2060\uFEFF\p{P}\p{S}]+/u;
const WORD_GAP_CHAR_PATTERN = /^[\s\u200B\u2060\uFEFF\p{P}\p{S}]$/u;
// The invisible word gaps a Bible's text has and a study's words do not.
const WORD_GAP_MARK_PATTERN = /[\u200B\u2060\uFEFF]/g;
const INVISIBLE_PATTERN = /[\u200B-\u200D\u2060\uFEFF]/u;
// An invisible gap, or a joiner that keeps two words apart, between words.
const WORD_JOINER_PATTERN = /[\u200B\u200C\u2060\uFEFF]/u;
const LETTER_OR_DIGIT_PATTERN = /[\p{L}\p{N}]/u;
const MARK_PATTERN = /\p{M}/u;
const SHARED_MARK_PATTERN = /\p{Script=Inherited}/u;
const LETTER_SIGN_PATTERN = /\p{Alphabetic}/u;
const DIACRITIC_PATTERN = /\p{Diacritic}/u;

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A quoted passage's verses: each verse's number in 0-9 -> its words. */
export function readStudyQuoteVerses(text: string) {
    const verseMap = new Map<string, string>();
    for (const line of text.split('\n')) {
        const match = QUOTE_VERSE_PATTERN.exec(line.trim());
        if (match !== null) {
            verseMap.set(
                toAsciiDigitText(match[1]).replace('.', ':'),
                match[2].trim(),
            );
        }
    }
    return verseMap;
}

/**
 * The names a passage gives -> every verse they are in: words it writes
 * with a capital inside a sentence and never without one, a note in
 * brackets and a pronoun left out.
 */
export function listStudyPassageNames(verseMap: Map<string, string>) {
    const keyMap = new Map<string, Set<string>>();
    const nameSet = new Set<string>();
    const lowerSet = new Set<string>();
    for (const [key, verse] of verseMap) {
        const words = verse.replace(BRACKET_NOTE_PATTERN, ' ');
        for (const match of words.matchAll(NAME_WORD_PATTERN)) {
            const word = match[0].replace(POSSESSIVE_PATTERN, '');
            if (/^\p{Ll}/u.test(word)) {
                lowerSet.add(word.toLowerCase());
                continue;
            }
            if (!/^\p{Lu}\p{Ll}/u.test(word)) {
                continue;
            }
            const keySet = keyMap.get(word) ?? new Set<string>();
            keySet.add(key);
            keyMap.set(word, keySet);
            const before = words.slice(0, match.index).trimEnd();
            if (before !== '' && !SENTENCE_START_PATTERN.test(before)) {
                nameSet.add(word);
            }
        }
    }
    const nameMap = new Map<string, Set<string>>();
    for (const name of nameSet) {
        const lower = name.toLowerCase();
        if (!lowerSet.has(lower) && !PRONOUN_SET.has(lower)) {
            nameMap.set(name, keyMap.get(name) ?? new Set());
        }
    }
    return nameMap;
}

/** A sign written on a letter, by kind: none (a shared one), a vowel or not. */
function toSignKind(sign: string) {
    if (SHARED_MARK_PATTERN.test(sign)) {
        return null;
    }
    return LETTER_SIGN_PATTERN.test(sign) && !DIACRITIC_PATTERN.test(sign)
        ? 'vowel'
        : 'sign';
}

/**
 * A text's letters, each with the vowel signs and the other signs written
 * on it that are its script's own -- the shared ones dropped, and the
 * invisible joiners and gaps taken in with the letter before them.
 */
function splitLetterUnits(text: string) {
    const units: LetterUnitType[] = [];
    let index = 0;
    const addSign = (unit: LetterUnitType, sign: string) => {
        const kind = toSignKind(sign);
        if (kind === 'vowel') {
            unit.vowels += sign;
        } else if (kind === 'sign') {
            unit.signs += sign;
        }
    };
    for (const char of text) {
        const isMark = MARK_PATTERN.test(char);
        const last = units[units.length - 1];
        if (last !== undefined && (isMark || INVISIBLE_PATTERN.test(char))) {
            last.end = index + char.length;
            if (isMark) {
                addSign(last, char);
            }
        } else {
            // A letter written whole with its sign (an e with an accent
            // as one character) is its letter and its signs.
            const [base, ...signs] = [...char.normalize('NFD')];
            const unit: LetterUnitType = {
                start: index,
                end: index + char.length,
                base: base.toLowerCase(),
                vowels: '',
                signs: '',
            };
            signs.forEach((sign) => {
                addSign(unit, sign);
            });
            units.push(unit);
        }
        index += char.length;
    }
    return units;
}

function checkHasVowelSigns(units: LetterUnitType[]) {
    return units.some((unit) => {
        return unit.vowels !== '';
    });
}

/**
 * Where `word` is written in `units`: the same letters with the same signs
 * and as many vowel signs on each, `changed` 0 for the word as it is and 1
 * for the word with the vowel signs of one letter written otherwise.
 */
function findWordPlaces(units: LetterUnitType[], wordUnits: LetterUnitType[]) {
    const placeList: { index: number; changed: number }[] = [];
    const size = wordUnits.length;
    for (let index = 0; index + size <= units.length; index++) {
        let changed = 0;
        let isSame = true;
        for (let offset = 0; offset < size && isSame; offset++) {
            const unit = units[index + offset];
            const wordUnit = wordUnits[offset];
            isSame =
                unit.base === wordUnit.base &&
                unit.signs === wordUnit.signs &&
                [...unit.vowels].length === [...wordUnit.vowels].length;
            if (isSame && unit.vowels !== wordUnit.vowels) {
                changed += 1;
            }
        }
        if (isSame && changed <= 1) {
            placeList.push({ index, changed });
        }
    }
    return placeList;
}

/** A Bible's word as a study writes it: without its invisible gaps. */
function toWrittenWord(word: string) {
    return word.replace(WORD_GAP_MARK_PATTERN, '');
}

function splitVerseWords(verse: string) {
    return verse
        .split(WORD_GAP_PATTERN)
        .map(toWrittenWord)
        .filter((word) => {
            return word !== '';
        });
}

/** Whether `start`..`end` of a text is a word of it, gaps on both sides. */
function checkIsWholeWord(text: string, start: number, end: number) {
    const before = [...text.slice(0, start)].pop();
    const inside = [...text.slice(start, end)].pop() ?? '';
    const after = [...text.slice(end)][0];
    return (
        (before === undefined || WORD_GAP_CHAR_PATTERN.test(before)) &&
        (after === undefined ||
            WORD_GAP_CHAR_PATTERN.test(after) ||
            WORD_GAP_CHAR_PATTERN.test(inside))
    );
}

/**
 * The word a verse writes for a church word: the church word itself when
 * the verse has it, the verse's own word when that is the church word with
 * the vowel signs of one letter written otherwise, or null.
 */
function findVerseSpelling(verse: string, word: string) {
    const wordUnits = splitLetterUnits(toWrittenWord(word));
    if (wordUnits.length === 0) {
        return null;
    }
    const units = splitLetterUnits(verse);
    const placeList = findWordPlaces(units, wordUnits);
    if (
        placeList.some((place) => {
            return place.changed === 0;
        })
    ) {
        return word;
    }
    if (wordUnits.length < STUDY_NAME_MIN_LETTERS) {
        return null;
    }
    for (const place of placeList) {
        const start = units[place.index].start;
        const end = units[place.index + wordUnits.length - 1].end;
        if (checkIsWholeWord(verse, start, end)) {
            return toWrittenWord(verse.slice(start, end));
        }
    }
    return null;
}

function toNameFinder(name: string) {
    return new RegExp(
        `(?<![\\p{L}\\p{M}])${escapeRegExp(name)}(?![\\p{L}\\p{M}])`,
        'u',
    );
}

/** Whether a church word's English is `name`, or its plural or singular. */
function checkIsTermName(english: string, name: string) {
    const term = english.trim().toLowerCase();
    const lower = name.toLowerCase();
    return term === lower || term === `${lower}s` || `${term}s` === lower;
}

function readPassagePairs(parts: readonly PassagePartType[]) {
    return parts.flatMap((part): PassagePairType[] => {
        if (part.kind !== 'passage' || typeof part.quoted !== 'string') {
            return [];
        }
        const pair = {
            english: readStudyQuoteVerses(part.text),
            target: readStudyQuoteVerses(part.quoted),
        };
        return pair.english.size === 0 || pair.target.size === 0 ? [] : [pair];
    });
}

/** The church words as the passages' verses write them (see the top). */
function applyPassageTerms(
    guide: StudyNameGuideType,
    pairList: PassagePairType[],
    terms: Record<string, string>,
) {
    // A word no English verse has is never looked for by a pattern: of the
    // sixty a language may list, a passage has a few, and the first job of
    // a window paid 140 ms compiling the others (EC-535, measured).
    const passageText = pairList
        .flatMap((pair) => {
            return [...pair.english.values()];
        })
        .join('\n')
        .toLowerCase();
    for (const [english, word] of Object.entries(terms)) {
        if (!passageText.includes(english.trim().toLowerCase())) {
            continue;
        }
        const finder = new RegExp(
            `(?<![\\p{L}\\p{M}])${escapeRegExp(english.trim())}s?(?![\\p{L}\\p{M}])`,
            'iu',
        );
        let spelling: string | null = null;
        for (const pair of pairList) {
            for (const [key, verse] of pair.english) {
                const target = pair.target.get(key);
                if (target !== undefined && finder.test(verse)) {
                    spelling = findVerseSpelling(target, word);
                }
                if (spelling !== null) {
                    break;
                }
            }
            if (spelling !== null) {
                break;
            }
        }
        if (spelling === null) {
            continue;
        }
        guide.terms[english] = spelling;
        if (/^\p{Lu}/u.test(english.trim())) {
            guide.spellingMap.set(english.trim(), spelling);
        }
    }
}

/**
 * The verses, in the Bible quoted, of the passages a translation quotes --
 * a passage part with the English as the study quotes it and the same
 * verses quoted in the language -- read once for the job: its church words
 * as that Bible writes them, the names the passages give in a verse or
 * two, and their verses -- and, unless `isNameWordsRead` is false, the
 * words that may write each name they give (EC-561): a saved
 * translation's check reads those its own way (EC-560).
 */
export function toStudyNameGuide(
    parts: readonly PassagePartType[],
    terms: Record<string, string>,
    isNameWordsRead = true,
): StudyNameGuideType {
    const pairList = readPassagePairs(parts);
    const guide: StudyNameGuideType = {
        verseMap: new Map(),
        spellingMap: new Map(),
        terms: { ...terms },
        wordSet: new Set(),
        nameWords: { nameMap: new Map(), wordSet: new Set() },
    };
    if (pairList.length === 0) {
        return guide;
    }
    applyPassageTerms(guide, pairList, terms);
    for (const pair of isNameWordsRead ? pairList : []) {
        addStudyNameWords(guide.nameWords, pair.english, pair.target);
    }
    // How many verses each of the Bible's words is in: a word in one verse
    // alone is that verse's own -- a name, or a word no other verse needs.
    const verseCountMap = new Map<string, number>();
    for (const pair of pairList) {
        for (const verse of pair.target.values()) {
            for (const word of new Set(splitVerseWords(verse))) {
                guide.wordSet.add(word);
                verseCountMap.set(word, (verseCountMap.get(word) ?? 0) + 1);
            }
        }
    }
    const termEnglishList = Object.keys(terms);
    for (const pair of pairList) {
        for (const [name, keySet] of listStudyPassageNames(pair.english)) {
            if (
                keySet.size > STUDY_NAME_RARE_VERSES ||
                guide.verseMap.has(name) ||
                termEnglishList.some((english) => {
                    return checkIsTermName(english, name);
                })
            ) {
                continue;
            }
            const verseList = [...keySet].flatMap((key) => {
                const target = pair.target.get(key);
                if (target === undefined) {
                    return [];
                }
                const words = [...new Set(splitVerseWords(target))].filter(
                    (word) => {
                        const units = splitLetterUnits(word);
                        return (
                            verseCountMap.get(word) === 1 &&
                            units.length >= STUDY_NAME_MIN_LETTERS &&
                            checkHasVowelSigns(units)
                        );
                    },
                );
                return [{ key, text: toWrittenWord(target), words }];
            });
            if (verseList.length > 0) {
                guide.verseMap.set(name, verseList);
            }
        }
    }
    return guide;
}

/** The names of `guide.verseMap` the words use, in the order they do. */
function listUsedNames(source: string, guide: StudyNameGuideType) {
    return [...guide.verseMap.keys()]
        .map((name) => {
            return {
                name,
                index: source.includes(name)
                    ? source.search(toNameFinder(name))
                    : -1,
            };
        })
        .filter(({ index }) => {
            return index >= 0;
        })
        .sort((first, second) => {
            return first.index - second.index;
        })
        .map(({ name }) => {
            return name;
        });
}

/**
 * The words a last answer wrote another way than their verse, for the
 * retry: one with another vowel sign as its verse's word, one with other
 * letters with its English name too -- that word may be another (EC-561).
 */
function toStudyNameSlipText(slips: readonly StudyNameSlipType[]) {
    if (slips.length === 0) {
        return '';
    }
    const slipList = slips.map((slip) => {
        const verseText = `verse ${slip.key} writes "${slip.spelling}"`;
        return slip.name === undefined
            ? `"${slip.written}" (${verseText})`
            : `${slip.name} as "${slip.written}" (${verseText}, if that ` +
                  `word is ${slip.name})`;
    });
    return (
        ' Your last translation wrote these another way than their ' +
        `verse: ${slipList.join(', ')}; write each name as its verse does.`
    );
}

/**
 * What the translator is told of the names some words use that the
 * passage gives in a verse or two: each with its verse as the Bible quoted
 * writes it, a verse once, four and 900 letters at most -- and, asked
 * again, the words its last answer wrote another way than their verse
 * (`listStudyNameSlips`), named even when no verse is shown. Empty with
 * none.
 */
export function toStudyNameVersesText(
    source: string,
    guide: StudyNameGuideType | null,
    languageName: string,
    slips: readonly StudyNameSlipType[] = [],
) {
    if (guide === null) {
        return '';
    }
    const verseByKey = new Map<string, { names: string[]; text: string }>();
    for (const name of listUsedNames(source, guide)) {
        for (const verse of guide.verseMap.get(name) ?? []) {
            const shown = verseByKey.get(verse.key);
            if (shown === undefined) {
                verseByKey.set(verse.key, { names: [name], text: verse.text });
            } else if (!shown.names.includes(name)) {
                shown.names.push(name);
            }
        }
    }
    const shownList: string[] = [];
    let charCount = 0;
    for (const [key, { names, text }] of verseByKey) {
        if (
            shownList.length >= STUDY_NAME_SHOWN_VERSES ||
            charCount + text.length > STUDY_NAME_SHOWN_CHARS
        ) {
            continue;
        }
        charCount += text.length;
        shownList.push(`${names.join(', ')} -- verse ${key}: "${text}"`);
    }
    const slipText = toStudyNameSlipText(slips);
    if (shownList.length === 0) {
        return slipText;
    }
    return (
        ' Write each name of a person or a place as the ' +
        `${languageName} Bible writes it in its verse: ` +
        `${shownList.join('; ')}.${slipText}`
    );
}

/**
 * The church words for the names some words use, as the Bible quoted
 * writes them: what `repairStudyNameSpellings` writes a name with.
 */
export function listStudyNameSpellings(
    source: string,
    guide: StudyNameGuideType | null,
) {
    if (guide === null) {
        return [];
    }
    const spellingSet = new Set<string>();
    for (const [english, spelling] of guide.spellingMap) {
        const singular = english.replace(/s$/u, '');
        if (
            source.includes(singular) &&
            (toNameFinder(english).test(source) ||
                (singular !== english && toNameFinder(singular).test(source)))
        ) {
            spellingSet.add(spelling);
        }
    }
    return [...spellingSet];
}

/**
 * Translated words with a church word for a name written with the vowel
 * signs of one letter changed written as the Bible quoted writes it
 * (`spellings`, from `listStudyNameSpellings`).
 */
export function repairStudyNameSpellings(
    text: string,
    spellings: readonly string[],
) {
    const repaired: [written: string, spelling: string][] = [];
    const wordList = spellings
        .map((spelling) => {
            const word = toWrittenWord(spelling);
            return { word, units: splitLetterUnits(word) };
        })
        .filter(({ units }) => {
            return (
                units.length >= STUDY_NAME_MIN_LETTERS &&
                checkHasVowelSigns(units)
            );
        });
    if (wordList.length === 0) {
        return { text, repaired };
    }
    const units = splitLetterUnits(text);
    const changeList: { start: number; end: number; word: string }[] = [];
    for (const { word, units: wordUnits } of wordList) {
        for (const place of findWordPlaces(units, wordUnits)) {
            if (place.changed === 0) {
                continue;
            }
            const start = units[place.index].start;
            const end = units[place.index + wordUnits.length - 1].end;
            const isTaken = changeList.some((change) => {
                return start < change.end && change.start < end;
            });
            if (!isTaken) {
                changeList.push({ start, end, word });
            }
        }
    }
    let result = text;
    changeList
        .sort((first, second) => {
            return second.start - first.start;
        })
        .forEach(({ start, end, word }) => {
            repaired.unshift([result.slice(start, end), word]);
            result = result.slice(0, start) + word + result.slice(end);
        });
    return { text: result, repaired };
}

/**
 * The names some words use that their translation writes with other
 * letters than the verse giving them, read off the bold span naming each
 * and the translation's in its place (`pairStudyBoldSpans`) as a saved
 * translation's are (EC-560): each with the verse's word coming closest
 * and its English name (EC-561). A place starts and ends between letter
 * clusters.
 */
function listStudyNameLetterSlips(
    source: string,
    translated: string,
    words: StudyNameWordsType,
) {
    if (words.nameMap.size === 0 || !source.includes('**')) {
        return [];
    }
    return pairStudyBoldSpans(source, translated).flatMap(
        ({ english, span }) => {
            const checkIsPlace = (start: number, end: number) => {
                return (
                    checkIsClusterEdge(span.text, start) &&
                    checkIsClusterEdge(span.text, end)
                );
            };
            return listStudyNameOtherLetters(
                english,
                span.text,
                words,
                checkIsPlace,
            ).map((found): StudyNameSlipType => {
                return {
                    written: toWrittenWord(
                        span.text.slice(found.start, found.end),
                    ),
                    spelling: found.spelling,
                    key: found.key,
                    name: found.name,
                };
            });
        },
    );
}

/**
 * The words of the verses shown for some words that their translation
 * writes with the same letters and the vowel signs of one letter written
 * otherwise -- never a word the passages themselves write -- and the names
 * it writes with other letters than their verse (EC-561), each once,
 * eight at most: named in the part's retry.
 */
export function listStudyNameSlips(
    source: string,
    translated: string,
    guide: StudyNameGuideType | null,
): StudyNameSlipType[] {
    if (guide === null) {
        return [];
    }
    const slipList: StudyNameSlipType[] = [];
    const seenSet = new Set<string>();
    const addSlip = (slip: StudyNameSlipType) => {
        const seenKey = `${slip.written}\n${slip.spelling}`;
        if (!seenSet.has(seenKey)) {
            seenSet.add(seenKey);
            slipList.push(slip);
        }
    };
    const nameList = listUsedNames(source, guide);
    const units = nameList.length === 0 ? [] : splitLetterUnits(translated);
    for (const name of nameList) {
        for (const verse of guide.verseMap.get(name) ?? []) {
            for (const spelling of verse.words) {
                const wordUnits = splitLetterUnits(spelling);
                if (
                    wordUnits.length < STUDY_NAME_MIN_LETTERS ||
                    !checkHasVowelSigns(wordUnits)
                ) {
                    continue;
                }
                for (const place of findWordPlaces(units, wordUnits)) {
                    const written = toWrittenWord(
                        translated.slice(
                            units[place.index].start,
                            units[place.index + wordUnits.length - 1].end,
                        ),
                    );
                    if (place.changed !== 0 && !guide.wordSet.has(written)) {
                        addSlip({ written, spelling, key: verse.key });
                    }
                }
            }
        }
    }
    listStudyNameLetterSlips(source, translated, guide.nameWords).forEach(
        addSlip,
    );
    return slipList.slice(0, STUDY_NAME_MAX_SLIPS);
}

/**
 * How many times a text writes a word: the same letters with the same
 * signs, a sign any writer may leave off and an invisible gap aside --
 * inside a longer run of letters too, as a script written without spaces
 * writes it (EC-536).
 */
export function countStudyWordPlaces(text: string, word: string) {
    const wordUnits = splitLetterUnits(toWrittenWord(word));
    if (wordUnits.length === 0) {
        return 0;
    }
    return findWordPlaces(splitLetterUnits(text), wordUnits).filter((place) => {
        return place.changed === 0;
    }).length;
}

/**
 * Where a text writes a word as it is (`changed` 0) or with the vowel signs
 * of one letter written otherwise (1) -- the difference a model cannot see
 * (EC-541) -- each place ending before an invisible gap after it.
 */
export function findStudyWordVariants(text: string, word: string) {
    const wordUnits = splitLetterUnits(toWrittenWord(word));
    if (wordUnits.length === 0) {
        return [];
    }
    const units = splitLetterUnits(text);
    return findWordPlaces(units, wordUnits).map(({ index, changed }) => {
        return {
            ...toPlaceEdges(text, units, index, wordUnits.length),
            changed,
        };
    });
}

// --- a name written with other letters (2026-11-13, EC-560) ----------------
//
// The check of a saved translation (EC-536) names the words of its verses
// written with another vowel sign. A name written with OTHER letters -- the
// user's John 3 study writes the Jordan with a letter fewer and other signs
// than verse 26 -- was only ever shown (EC-535): a verse's words are not
// all names, and nothing told which of them an English name stands for.
// The study's own words tell: its English half's bold span naming the
// Jordan, and the translation's bold span in its place.

type StudyNameLetterPlaceType = {
    start: number;
    end: number;
    /** The word as it is, with another vowel sign, or other letters. */
    kind: 'same' | 'vowel' | 'other';
    /** How alike: see `STUDY_NAME_LIKE_RATE`. */
    rate: number;
};

/** Where `length` letters from `index` start and end, a gap after them out. */
function toPlaceEdges(
    text: string,
    units: readonly LetterUnitType[],
    index: number,
    length: number,
) {
    const start = units[index].start;
    let end = units[index + length - 1].end;
    while (end > start && INVISIBLE_PATTERN.test(text[end - 1])) {
        end -= 1;
    }
    return { start, end };
}

/** How many letters two words write in the same order, signs aside. */
function countCommonLetters(
    first: readonly LetterUnitType[],
    second: readonly LetterUnitType[],
) {
    const row = new Array<number>(second.length + 1).fill(0);
    for (const unit of first) {
        let diagonal = 0;
        for (let index = 1; index <= second.length; index++) {
            const above = row[index];
            row[index] =
                unit.base === second[index - 1].base
                    ? diagonal + 1
                    : Math.max(above, row[index - 1]);
            diagonal = above;
        }
    }
    return row[second.length];
}

/** Whether letters carry no sign: a word written without its points. */
function checkIsBare(units: readonly LetterUnitType[]) {
    return units.every((unit) => {
        return unit.vowels === '' && unit.signs === '';
    });
}

// One word segmenter for the life of the page: a constant, not a cache.
let wordSegmenter: Intl.Segmenter | null | undefined;

function getWordSegmenter() {
    if (wordSegmenter === undefined) {
        wordSegmenter =
            typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
                ? new Intl.Segmenter(undefined, { granularity: 'word' })
                : null;
    }
    return wordSegmenter;
}

/**
 * Where a text's words start and end, as the platform's word breaking
 * reads them -- in a script written with no spaces, by its dictionary, a
 * name it does not know split into its syllables -- or null with none.
 */
function listWordEdges(text: string) {
    const segmenter = getWordSegmenter();
    if (segmenter === null) {
        return null;
    }
    const edgeSet = new Set<number>([0, text.length]);
    for (const { index, segment } of segmenter.segment(text)) {
        edgeSet.add(index);
        edgeSet.add(index + segment.length);
    }
    return edgeSet;
}

/** Whether `start`..`end` of a text holds every letter and digit of it. */
function checkIsAllLetters(text: string, start: number, end: number) {
    return (
        !LETTER_OR_DIGIT_PATTERN.test(text.slice(0, start)) &&
        !LETTER_OR_DIGIT_PATTERN.test(text.slice(end))
    );
}

/**
 * Whether `start`..`end` of a text is whole words (EC-561): no word of the
 * text cut, an invisible gap or joiner on either side being an edge -- the
 * word breaking glues a joiner to the word before it. Measured on the
 * user's study, a name paired with another heading's words came closest
 * to a verse's word inside a longer one ("share", "born"); the name
 * itself, a word unknown to the dictionary, keeps both its edges.
 */
function checkIsWordPlace(
    text: string,
    edgeSet: ReadonlySet<number> | null,
    start: number,
    end: number,
) {
    if (edgeSet === null) {
        return true;
    }
    return [start, end].every((index) => {
        return (
            edgeSet.has(index) ||
            WORD_JOINER_PATTERN.test(text[index - 1] ?? '') ||
            WORD_JOINER_PATTERN.test(text[index] ?? '')
        );
    });
}

/**
 * The words of the verses quoted that may write each name the English
 * verses give: three letters or more, in a verse giving the name and in
 * few others (`STUDY_NAME_WORD_SHARE`) -- a name's own word, and the words
 * of its verses no other verse needs. Which of them is the name only
 * words standing for it can tell.
 */
export function listStudyNameWords(
    english: Map<string, string>,
    target: Map<string, string>,
): StudyNameWordsType {
    const keyMap = new Map<string, Set<string>>();
    for (const [key, verse] of target) {
        for (const word of splitVerseWords(verse)) {
            const keySet = keyMap.get(word) ?? new Set<string>();
            keySet.add(key);
            keyMap.set(word, keySet);
        }
    }
    const words: StudyNameWordsType = {
        nameMap: new Map(),
        wordSet: new Set(keyMap.keys()),
    };
    const nameList = [...listStudyPassageNames(english)];
    if (nameList.length === 0) {
        return words;
    }
    const longList = [...keyMap].filter(([word]) => {
        return splitLetterUnits(word).length >= STUDY_NAME_MIN_LETTERS;
    });
    for (const [name, nameKeySet] of nameList) {
        const wordList: StudyNameWordType[] = [];
        for (const [word, keySet] of longList) {
            const sharedList = [...keySet].filter((key) => {
                return nameKeySet.has(key);
            });
            const allCount = keySet.size + nameKeySet.size - sharedList.length;
            if (
                sharedList.length > 0 &&
                sharedList.length >= allCount * STUDY_NAME_WORD_SHARE
            ) {
                wordList.push({ word, key: sharedList[0] });
            }
        }
        if (wordList.length > 0) {
            words.nameMap.set(name, wordList);
        }
    }
    return words;
}

/**
 * Where a text -- words standing for a name -- writes a verse's word: as it
 * is or without its points (`same`), with the vowel signs of one letter
 * otherwise (`vowel`, EC-536's), else the places of other letters coming
 * close to it -- three letters or more, no word gap inside, as alike as
 * `STUDY_NAME_LIKE_RATE` at least -- the most alike first.
 */
export function listStudyNameLetterPlaces(
    text: string,
    word: string,
): StudyNameLetterPlaceType[] {
    const wordUnits = splitLetterUnits(toWrittenWord(word));
    const size = wordUnits.length;
    if (size < STUDY_NAME_MIN_LETTERS) {
        return [];
    }
    const units = splitLetterUnits(text);
    const sameList = findWordPlaces(units, wordUnits).map(
        ({ index, changed }): StudyNameLetterPlaceType => {
            return {
                ...toPlaceEdges(text, units, index, size),
                kind: changed === 0 ? 'same' : 'vowel',
                rate: 1,
            };
        },
    );
    if (sameList.length > 0) {
        return sameList;
    }
    const placeList: StudyNameLetterPlaceType[] = [];
    for (let index = 0; index < units.length; index++) {
        const longest = Math.min(
            size + STUDY_NAME_LIKE_REACH,
            units.length - index,
        );
        for (
            let length = Math.max(
                STUDY_NAME_MIN_LETTERS,
                size - STUDY_NAME_LIKE_REACH,
            );
            length <= longest;
            length++
        ) {
            const edges = toPlaceEdges(text, units, index, length);
            if (WORD_GAP_PATTERN.test(text.slice(edges.start, edges.end))) {
                break;
            }
            const placeUnits = units.slice(index, index + length);
            const common = countCommonLetters(placeUnits, wordUnits);
            if (
                common === size &&
                length === size &&
                (checkIsBare(placeUnits) || checkIsBare(wordUnits))
            ) {
                return [{ ...edges, kind: 'same', rate: 1 }];
            }
            const rate = (2 * common) / (length + size);
            if (rate >= STUDY_NAME_LIKE_RATE) {
                placeList.push({ ...edges, kind: 'other', rate });
            }
        }
    }
    return placeList.sort((first, second) => {
        return second.rate - first.rate || first.start - second.start;
    });
}

/**
 * The names some English words use, as the words standing for them in a
 * translation write them otherwise than every word of their verses (see
 * above): none of those words written there as it is or with another
 * vowel sign, and a place of other letters coming close to one -- whole
 * words of the translation (`checkIsWordPlace`), all its letters or
 * closer still (`STUDY_NAME_PART_LIKE_RATE`), no word the verses quoted
 * write, and one `checkIsPlace` takes -- the closest. Each place once.
 */
export function listStudyNameOtherLetters(
    english: string,
    translated: string,
    words: StudyNameWordsType,
    checkIsPlace: (start: number, end: number) => boolean,
) {
    const foundList: StudyNameLettersType[] = [];
    let edgeSet: Set<number> | null | undefined;
    for (const [name, wordList] of words.nameMap) {
        if (!english.includes(name) || !toNameFinder(name).test(english)) {
            continue;
        }
        edgeSet = edgeSet === undefined ? listWordEdges(translated) : edgeSet;
        const wordEdgeSet = edgeSet;
        let best: {
            place: StudyNameLetterPlaceType;
            nameWord: StudyNameWordType;
        } | null = null;
        let isWritten = false;
        for (const nameWord of wordList) {
            const placeList = listStudyNameLetterPlaces(
                translated,
                nameWord.word,
            );
            isWritten = placeList.some((place) => {
                return place.kind !== 'other';
            });
            if (isWritten) {
                break;
            }
            const bestRate: number = best?.place.rate ?? 0;
            const place: StudyNameLetterPlaceType | undefined = placeList.find(
                (item) => {
                    return (
                        item.rate > bestRate &&
                        (item.rate >= STUDY_NAME_PART_LIKE_RATE ||
                            checkIsAllLetters(
                                translated,
                                item.start,
                                item.end,
                            )) &&
                        checkIsWordPlace(
                            translated,
                            wordEdgeSet,
                            item.start,
                            item.end,
                        ) &&
                        !words.wordSet.has(
                            translated.slice(item.start, item.end),
                        ) &&
                        checkIsPlace(item.start, item.end)
                    );
                },
            );
            if (place !== undefined) {
                best = { place, nameWord };
            }
        }
        if (isWritten || best === null) {
            continue;
        }
        const { place, nameWord } = best;
        const isTaken = foundList.some((found) => {
            return place.start < found.end && found.start < place.end;
        });
        if (!isTaken) {
            foundList.push({
                name,
                start: place.start,
                end: place.end,
                spelling: toWrittenWord(nameWord.word),
                key: nameWord.key,
            });
        }
    }
    return foundList;
}

// --- the words standing for a name: bold spans (EC-560, EC-561) ------------

/** A text's lines that hold words, each with where it starts in the text. */
export function listStudyWordLines(text: string) {
    const lineList: StudyTextSpanType[] = [];
    let start = 0;
    for (const line of text.split('\n')) {
        if (line.trim() !== '') {
            lineList.push({ text: line, start });
        }
        start += line.length + 1;
    }
    return lineList;
}

/** The spans in bold of some lines but quoted ones, where their words start. */
function listBoldSpans(lineList: readonly StudyTextSpanType[]) {
    return lineList.flatMap((line) => {
        if (QUOTE_LINE_PATTERN.test(line.text)) {
            return [];
        }
        return [...line.text.matchAll(BOLD_SPAN_PATTERN)].map(
            (match): StudyTextSpanType => {
                return {
                    text: match[1],
                    start: line.start + (match.index ?? 0) + 2,
                };
            },
        );
    });
}

function toBoldPairs(
    englishList: readonly StudyTextSpanType[],
    spanList: readonly StudyTextSpanType[],
) {
    if (englishList.length !== spanList.length) {
        return [];
    }
    return spanList.map((span, index): StudyBoldPairType => {
        return { english: englishList[index].text, span };
    });
}

/**
 * Some English words' bold spans, each with their translation's in its
 * place: in their order when both bold as many, else line by line -- the
 * lines holding words, when both have as many -- in lines bolding as many.
 * A quoted line's bold is a verse's number, and left out. None when
 * neither tells.
 */
export function pairStudyBoldSpans(english: string, translated: string) {
    const englishLines = listStudyWordLines(english);
    const lines = listStudyWordLines(translated);
    const pairList = toBoldPairs(
        listBoldSpans(englishLines),
        listBoldSpans(lines),
    );
    if (pairList.length > 0 || englishLines.length !== lines.length) {
        return pairList;
    }
    return lines.flatMap((line, index) => {
        return toBoldPairs(
            listBoldSpans([englishLines[index]]),
            listBoldSpans([line]),
        );
    });
}

/**
 * Adds to `words` the words that may write each name one passage gives
 * (`listStudyNameWords`): a name two passages give keeps the words of both.
 */
export function addStudyNameWords(
    words: StudyNameWordsType,
    english: Map<string, string>,
    target: Map<string, string>,
) {
    const passageWords = listStudyNameWords(english, target);
    passageWords.wordSet.forEach((word) => {
        words.wordSet.add(word);
    });
    for (const [name, wordList] of passageWords.nameMap) {
        words.nameMap.set(name, [
            ...(words.nameMap.get(name) ?? []),
            ...wordList,
        ]);
    }
}
