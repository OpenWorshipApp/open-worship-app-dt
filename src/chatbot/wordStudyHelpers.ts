/**
 * Studying the WORDS of a passage a lookup conversation is about
 * (2026-10-23; the user, studying Genesis 8 in the Greek Bible with the
 * passage's card open: _give option like study vocabulary then choose verse
 * (if more than one verses) then list word to choose or choose all then
 * explain the word_, then _also have option to open the word in google
 * search_, and the goal _chatbot can help teaching vocabularies in the
 * selected bible verse_).
 *
 * The card's **Study the words** lists the passage's verses (none when it is
 * one verse), a verse its words in order -- each once, with **All words**
 * first -- and a word is taught by the assistant from the verse as the
 * passage's own Bible writes it. Everything up to that ask is the window's,
 * with no model: the verses come out of the record the card already read
 * (`passages[].text`, `(1): …` per verse), and a verse the record cut short
 * is read again by its key.
 *
 * Measured first, in the passage chat as it stood: asked in Khmer to explain
 * the words of Genesis 8:1 in the GB Bible, the answer quoted the verse as
 * `«(1):      ,    ,    ,  ᾿    ត·        ,    .»` -- every Greek letter
 * taken out by the answer cleaner as a "third script" -- so the words to
 * keep are the PASSAGE's script too (`toPassageAnswerKeep`).
 *
 * Pure, every rule a test.
 */
import type { LookupAskType } from '../helper/ai/lookupAskHelpers';
import type { AnswerKeepType } from './answerLanguageHelpers';
import { fillWords, tran, tranLabel } from './chatTranHelpers';
import { toAsciiDigits } from './chatLangHelpers';
import type { BotActionType } from './helpBotHelpers';
import { toLookupStudyAction } from './lookupStepHelpers';

export type StudyVerseType = {
    // `GEN 8:1`: what a read and a button carry.
    key: string;
    number: number;
    // The verse number as the Bible writes it (`១`).
    shownNumber: string;
    // `Genesis 8:1`: what the model and a web search are given.
    ref: string;
    // `លោកុប្បត្តិ ៨:១` in a Bible not in English, else the English one.
    title: string;
    // '' when the record did not carry this verse.
    text: string;
    // false when the record cut it short or did not carry it: read it again.
    isWhole: boolean;
};

// How many verse or word buttons one answer carries; **More …** pages on.
export const MAX_STUDY_VERSES = 24;
export const MAX_STUDY_WORDS = 30;
// A verse's words a button shows of it.
const VERSE_LABEL_WORDS = 4;
const VERSE_LABEL_CHARS = 32;
// A run of letters this long with no space between is a script written
// without them (Khmer with no zero-width spaces, Thai): cut into words.
const LONG_RUN_CHARS = 20;

const KEY_PATTERN =
    /^([0-9A-Z]{3}) (\d{1,3}):(\d{1,3})(?:-(?:(\d{1,3}):)?(\d{1,3}))?$/;
// `(1): ` / `(២១): ` in front of each verse of a record's passage.
const MARKER_PATTERN = /\((\p{Nd}{1,3})\):\s*/gu;
// A chapter's heading in a passage over chapters: `លោកុប្បត្តិ ៩:១-២`.
const HEADING_PATTERN = /(\p{Nd}{1,3})\s*[:៖]\s*\p{Nd}/u;
const DIGIT_PATTERN = /\p{Nd}/u;

/** A digit of any script's 0-9 as its value, or null. */
function readDigitValue(digit: string) {
    const ascii = toAsciiDigits(digit);
    if (/^\d$/.test(ascii)) {
        return Number(ascii);
    }
    // Every script's ten digits are a run of ten code points from its 0.
    const point = digit.codePointAt(0) ?? 0;
    let zero = point;
    while (
        point - zero < 9 &&
        DIGIT_PATTERN.test(String.fromCodePoint(zero - 1))
    ) {
        zero -= 1;
    }
    return DIGIT_PATTERN.test(digit) ? (point - zero) % 10 : null;
}

/** Digits of any script as a number, or NaN. */
export function readAnyDigits(text: string) {
    let value = 0;
    for (const digit of text) {
        const one = readDigitValue(digit);
        if (one === null) {
            return Number.NaN;
        }
        value = value * 10 + one;
    }
    return text.length === 0 ? Number.NaN : value;
}

/** A number in the digits `sample` is written in (`៨` for a Khmer one). */
export function toDigitsLike(value: number, sample: string) {
    const first = [...sample].find((one) => {
        return DIGIT_PATTERN.test(one);
    });
    const firstValue = first === undefined ? null : readDigitValue(first);
    if (first === undefined || firstValue === null || /\d/.test(first)) {
        return String(value);
    }
    const zero = (first.codePointAt(0) ?? 0) - firstValue;
    return String(value).replaceAll(/\d/g, (digit) => {
        return String.fromCodePoint(zero + Number(digit));
    });
}

/**
 * The verses of a passage record, in order, each with its words: off the
 * card's own record, with no read. A single-chapter passage lists every
 * verse of its span even past where the record's text was cut; such a verse
 * has no words yet (`isWhole` false), and is read by its key when studied.
 */
export function listStudyVerses(facts: any): StudyVerseType[] {
    const verses: StudyVerseType[] = [];
    const seen = new Set<string>();
    const passages = Array.isArray(facts?.passages) ? facts.passages : [];
    for (const passage of passages) {
        const keyMatch =
            typeof passage?.key === 'string'
                ? KEY_PATTERN.exec(passage.key.trim())
                : null;
        if (keyMatch === null) {
            continue;
        }
        const book = keyMatch[1];
        let chapter = Number(keyMatch[2]);
        const bookName =
            typeof passage.ref === 'string'
                ? passage.ref.replace(/\s+\d+:\d+.*$/, '').trim() || book
                : book;
        // The Bible's own book name, off its title (`លោកុប្បត្តិ ៨:១-២២`).
        const bookTitle =
            typeof passage.title === 'string'
                ? passage.title.replace(/\s*\p{Nd}+\s*[:៖].*$/u, '').trim()
                : '';
        const text = typeof passage.text === 'string' ? passage.text : '';
        const isCut = text.trimEnd().endsWith('…');
        let sample = '';
        const own: StudyVerseType[] = [];
        for (const line of text.split(/\r?\n/)) {
            const markers = [...line.matchAll(MARKER_PATTERN)];
            if (markers.length === 0) {
                const heading = HEADING_PATTERN.exec(line);
                const headingChapter =
                    heading === null ? Number.NaN : readAnyDigits(heading[1]);
                if (Number.isInteger(headingChapter) && headingChapter > 0) {
                    chapter = headingChapter;
                }
                continue;
            }
            markers.forEach((marker, index) => {
                const number = readAnyDigits(marker[1]);
                if (!Number.isInteger(number) || number <= 0) {
                    return;
                }
                sample = marker[1];
                const start = (marker.index ?? 0) + marker[0].length;
                const end = markers[index + 1]?.index ?? line.length;
                own.push(
                    toStudyVerse({
                        book,
                        bookName,
                        bookTitle,
                        chapter,
                        number,
                        shownNumber: marker[1],
                        text: line.slice(start, end).trim(),
                    }),
                );
            });
        }
        if (isCut && own.length > 0) {
            const last = own[own.length - 1];
            last.text = last.text.replace(/…$/, '').trimEnd();
            last.isWhole = false;
        }
        // Every verse of one chapter's span, words or none.
        const isOneChapter = keyMatch[4] === undefined;
        if (isOneChapter && passages.length === 1) {
            const first = Number(keyMatch[3]);
            const last =
                keyMatch[5] === undefined ? first : Number(keyMatch[5]);
            for (let number = first; number <= last; number++) {
                if (
                    own.some((verse) => {
                        return verse.number === number;
                    })
                ) {
                    continue;
                }
                own.push({
                    ...toStudyVerse({
                        book,
                        bookName,
                        bookTitle,
                        chapter,
                        number,
                        shownNumber: toDigitsLike(number, sample),
                        text: '',
                    }),
                    isWhole: false,
                });
            }
            own.sort((one, other) => {
                return one.number - other.number;
            });
        }
        for (const verse of own) {
            if (!seen.has(verse.key)) {
                seen.add(verse.key);
                verses.push(verse);
            }
        }
    }
    return verses;
}

function toStudyVerse(parts: {
    book: string;
    bookName: string;
    bookTitle: string;
    chapter: number;
    number: number;
    shownNumber: string;
    text: string;
}): StudyVerseType {
    const ref = `${parts.bookName} ${parts.chapter}:${parts.number}`;
    return {
        key: `${parts.book} ${parts.chapter}:${parts.number}`,
        number: parts.number,
        shownNumber: parts.shownNumber,
        ref,
        title:
            parts.bookTitle.length > 0
                ? `${parts.bookTitle} ${toDigitsLike(
                      parts.chapter,
                      parts.shownNumber,
                  )}:${parts.shownNumber}`
                : ref,
        text: parts.text,
        isWhole: parts.text.length > 0,
    };
}

/** One verse read by its key, as a passage read of it comes back. */
export function readStudyVerse(facts: any, key: string) {
    return (
        listStudyVerses(facts).find((verse) => {
            return verse.key === key && verse.isWhole;
        }) ?? null
    );
}

// What is not part of a word at either end of it: punctuation (`,` `·`
// `។`), symbols and the zero-width joiners -- never `᾿`, the Greek mark of
// a letter left off (`μετ᾿`), which is a modifier symbol.
const WORD_EDGE_PATTERN =
    /^[\p{P}\p{Sm}\p{Sc}\p{So}\p{Cf}]+|[\p{P}\p{Sm}\p{Sc}\p{So}\p{Cf}]+$/gu;
const LETTER_PATTERN = /\p{L}/u;
// Where a verse's words part: spaces, the zero-width spaces a Khmer Bible
// puts between its words, and the Hebrew maqaf (־), which joins two words
// into one sound -- `אֶת־הָרָקִיעַ` is the object marker and "the
// firmament", two words a lexicon lists apart (2026-10-23: one button
// taught both, its sound run together).
const WORD_GAP_PATTERN = /[\s\u200B\u05BE]+/;
// A Greek word ending in an apostrophe is elided -- `ἀλλ’` is ἀλλά -- and
// the mark is part of it, whichever apostrophe the Bible typed (the GNT
// 1904 types ’, a punctuation mark the edges would take).
const GREEK_ELISION_PATTERN = /\p{Script=Greek}\p{M}*$/u;
const ELISION_MARK_PATTERN = /^['’ʼ]/u;
// The Hebrew accents (te'amim, U+0591-U+05AF) and the meteg say how a word
// is CHANTED in its verse, not which word it is: `אֲשֶׁר֙` and `אֲשֶׁ֖ר` are
// one word, and no lexicon writes them.
const HEBREW_ACCENT_PATTERN = /[\u0591-\u05AF\u05BD\u05C4\u05C5]/g;

/**
 * A word as the verse writes it, with what does not belong to it off both
 * ends -- the mark of an elided Greek letter kept.
 */
function toStudyWord(token: string) {
    const bare = token.replace(WORD_EDGE_PATTERN, '');
    const rest = token.slice(token.indexOf(bare) + bare.length);
    return GREEK_ELISION_PATTERN.test(bare) && ELISION_MARK_PATTERN.test(rest)
        ? bare + rest[0]
        : bare;
}

/**
 * What makes two of a verse's words the same word to learn: its case,
 * its Hebrew accents, and the grave a Greek word takes inside a sentence
 * (`Θεὸς` is `Θεός`) left out.
 */
export function toStudyWordKey(word: string) {
    return word
        .normalize('NFD')
        .replace(HEBREW_ACCENT_PATTERN, '')
        .replaceAll('̀', '́')
        .normalize('NFC')
        .toLocaleLowerCase();
}

function cutLongRun(run: string): string[] {
    if ([...run].length <= LONG_RUN_CHARS || typeof Intl === 'undefined') {
        return [run];
    }
    const Segmenter = (Intl as any).Segmenter;
    if (typeof Segmenter !== 'function') {
        return [run];
    }
    const words = [
        ...new Segmenter(undefined, { granularity: 'word' }).segment(run),
    ]
        .filter((one: any) => {
            return one.isWordLike === true;
        })
        .map((one: any) => {
            return String(one.segment);
        });
    return words.length > 0 ? words : [run];
}

/**
 * A verse's words in the order it has them, each once (a word that comes
 * again is the same word to learn, `toStudyWordKey`), as the verse first
 * writes it: split at spaces, at the zero-width spaces a Khmer Bible puts
 * between its words and at the Hebrew maqaf, the punctuation off both
 * ends, a number left out.
 */
export function listStudyWords(text: string): string[] {
    const words: string[] = [];
    const seen = new Set<string>();
    for (const token of text.split(WORD_GAP_PATTERN)) {
        const bare = toStudyWord(token);
        if (!LETTER_PATTERN.test(bare)) {
            continue;
        }
        for (const word of cutLongRun(bare)) {
            const same = toStudyWordKey(word);
            if (!LETTER_PATTERN.test(word) || seen.has(same)) {
                continue;
            }
            seen.add(same);
            words.push(word);
        }
    }
    return words;
}

function toVerseLabel(verse: StudyVerseType) {
    if (verse.text.length === 0) {
        return verse.shownNumber;
    }
    const words = verse.text.split(/[\s\u200B]+/).filter((one) => {
        return one.length > 0;
    });
    let shown = words.slice(0, VERSE_LABEL_WORDS).join(' ');
    if (shown.length > VERSE_LABEL_CHARS) {
        shown = shown.slice(0, VERSE_LABEL_CHARS).trimEnd();
    }
    const isAll =
        shown.length === verse.text.length && words.length <= VERSE_LABEL_WORDS;
    return `${verse.shownNumber} · ${shown}${isAll ? '' : '…'}`;
}

/** **Study the words**, a passage of several verses: which one. */
export function genStudyVersesAnswer(
    ask: LookupAskType,
    verses: StudyVerseType[],
    from = 0,
): { text: string; actions: BotActionType[] } {
    if (verses.length === 0) {
        return {
            text: fillWords(
                tran('I could not read the words of {name} just now.'),
                { name: ask.title },
            ),
            actions: [],
        };
    }
    const start = from < verses.length ? from : 0;
    const shown = verses.slice(start, start + MAX_STUDY_VERSES);
    const actions = shown.map((verse) => {
        return toLookupStudyAction(
            toVerseLabel(verse),
            'words',
            ask,
            { verse: verse.key, ref: verse.ref },
            true,
        );
    });
    if (start + MAX_STUDY_VERSES < verses.length) {
        actions.push(
            toLookupStudyAction('More verses', 'words', ask, {
                from: start + MAX_STUDY_VERSES,
            }),
        );
    }
    return {
        text: fillWords(
            tran(
                'Which verse of {name} do you want to study? Press one, ' +
                    'and I will list its words.',
            ),
            { name: ask.title },
        ),
        actions,
    };
}

/**
 * A verse's words to press, **All words** first: the verse as its Bible
 * writes it above them.
 */
export function genStudyWordsAnswer(
    ask: LookupAskType,
    verse: StudyVerseType,
    verseCount: number,
    from = 0,
): { text: string; actions: BotActionType[] } {
    const words = listStudyWords(verse.text);
    if (words.length === 0) {
        return {
            text: fillWords(
                tran('I could not read the words of {name} just now.'),
                { name: verse.title },
            ),
            actions:
                verseCount > 1
                    ? [toLookupStudyAction('Another verse', 'words', ask)]
                    : [],
        };
    }
    const start = from < words.length ? from : 0;
    const place = { verse: verse.key, ref: verse.ref };
    const actions = [
        toLookupStudyAction('All words', 'verseWords', ask, place),
        ...words.slice(start, start + MAX_STUDY_WORDS).map((word) => {
            return toLookupStudyAction(
                word,
                'word',
                ask,
                { ...place, word },
                true,
            );
        }),
    ];
    if (start + MAX_STUDY_WORDS < words.length) {
        actions.push(
            toLookupStudyAction('More words', 'words', ask, {
                ...place,
                from: start + MAX_STUDY_WORDS,
            }),
        );
    }
    if (verseCount > 1) {
        actions.push(toLookupStudyAction('Another verse', 'words', ask));
    }
    return {
        text: [
            `**${verse.title}**`,
            verse.text,
            fillWords(
                tran(
                    'Press a word to learn it, or {all} to learn every ' +
                        'word of the verse.',
                ),
                { all: `**${tranLabel('All words')}**` },
            ),
        ].join('\n\n'),
        actions,
    };
}

/**
 * What stands under the assistant's teaching of a word -- the next word, the
 * verse's words again, the word on Google -- or of a whole verse: its words
 * one at a time, the next verse, another.
 */
export function genWordStudyActions(
    ask: LookupAskType,
    verses: StudyVerseType[],
    verse: StudyVerseType,
    word: string | null,
): BotActionType[] {
    const place = { verse: verse.key, ref: verse.ref };
    const actions: BotActionType[] = [];
    if (word !== null) {
        const words = listStudyWords(verse.text);
        const key = toStudyWordKey(word);
        const index = words.findIndex((one) => {
            return toStudyWordKey(one) === key;
        });
        const next = index < 0 ? undefined : words[index + 1];
        if (next !== undefined) {
            actions.push(
                toLookupStudyAction(
                    fillWords(tran('Next word: {word}'), { word: next }),
                    'word',
                    ask,
                    { ...place, word: next },
                    true,
                ),
            );
        }
        actions.push(
            toLookupStudyAction('Choose a word', 'words', ask, place),
            toLookupStudyAction(
                fillWords(tran('Search Google for {word}'), { word }),
                'wordWeb',
                ask,
                { ...place, word },
                true,
            ),
        );
        return actions;
    }
    actions.push(toLookupStudyAction('Choose a word', 'words', ask, place));
    const index = verses.findIndex((one) => {
        return one.key === verse.key;
    });
    const next = index < 0 ? undefined : verses[index + 1];
    if (next !== undefined) {
        actions.push(
            toLookupStudyAction('Next verse', 'verseWords', ask, {
                verse: next.key,
                ref: next.ref,
            }),
        );
    }
    if (verses.length > 1) {
        actions.push(toLookupStudyAction('Another verse', 'words', ask));
    }
    return actions;
}

/**
 * What the model is asked, in English: short, because it is also what the
 * translation is planned on and what the conversation's history keeps. How
 * to teach it, and the verse itself, are `toWordStudyContext`'s.
 */
export function toWordStudyQuestion(
    verse: StudyVerseType,
    word: string | null,
) {
    return word === null
        ? `Teach me every word of ${verse.ref}, one by one.`
        : `Teach me the word “${word}” in ${verse.ref}.`;
}

// What "its form here" means in the languages a Bible is studied in, so a
// small model names the form rather than skipping it (EC-433: τὸν glossed
// as "to", a verb's tense and case left out). Read off the verse's letters.
const GRAMMAR_HINT_LIST: [RegExp, string][] = [
    [
        /\p{Script=Greek}/u,
        'For a noun, adjective, article or pronoun: its case, number and ' +
            'gender. For a verb: its tense, voice, mood, person and number ' +
            '(a participle: its case, number and gender too).',
    ],
    [
        /\p{Script=Hebrew}/u,
        // The stems in Hebrew letters, which an answer keeps: given as Qal,
        // Niphal, Piel, they came back in Latin letters inside the Khmer.
        // No "state": a noun with no article was called definite.
        'For a verb: its stem (קַל, נִפְעַל, פִּעֵל, הִפְעִיל …), whether ' +
            'it is completed or ongoing (with the וַ of a narrative), or a ' +
            'command, an infinitive or a participle, and its person, gender ' +
            'and number. For a noun: its gender and number. Every part ' +
            'joined to it -- וְ "and", הַ "the", בְּ "in", לְ "to", כְּ ' +
            '"like", מִ "from", an ending -- named apart, with what it means.',
    ],
];

/**
 * The verse as its Bible writes it, and how to teach it, under the record
 * (`toLookupAsk` / `toLookupQuestion`'s `contextText`). A small model asked
 * with the verse only in the record had read it again with a tool and
 * explained phrases, not words. `answerLanguage`: the language the answer is
 * shown in -- a verse written in its own script (a Khmer verse in a Khmer
 * window) needs no way to say it, and a romanised Khmer word (_Srolanh_)
 * is English letters to a reader of none (2026-10-23, two lessons in two).
 */
export function toWordStudyContext(
    verse: StudyVerseType,
    word: string | null,
    bibleKey: string | null,
    answerLanguage: {
        isLatinScript: boolean;
        scriptPattern: RegExp;
    } | null = null,
) {
    const bible = bibleKey === null ? '' : ` "${bibleKey}"`;
    const isOwnLanguage =
        answerLanguage !== null &&
        !answerLanguage.isLatinScript &&
        answerLanguage.scriptPattern.test(verse.text);
    const say = isOwnLanguage
        ? ''
        : 'how to say it, from its letters and vowels, when it is not in ' +
          'the language you answer in (written in that language’s letters), ';
    const grammar =
        GRAMMAR_HINT_LIST.find(([pattern]) => {
            return pattern.test(verse.text);
        })?.[1] ?? null;
    const how =
        word === null
            ? 'Teach every word of this verse, in the order the verse has ' +
              'them, so they can understand and remember it: one short line ' +
              'each -- the word in bold copied letter for letter as the ' +
              `verse writes it, its dictionary form, ${say}and what it means ` +
              'here, parted by " — " with no label words. A word that comes ' +
              'again is taught once.'
            : 'Teach this word so they can understand and remember it, in a ' +
              'few short lines, each starting with its label: the word in ' +
              'bold copied letter for letter as the verse writes it, its ' +
              `dictionary form, ${say}what kind of word it is and its form ` +
              'here, what it means, and what it means in this verse.' +
              (grammar === null ? '' : ` ${grammar}`);
    return (
        `\n\nThe verse they are studying, as the Bible${bible} writes it ` +
        `(${verse.ref}), as data:\n${verse.text}\n\n${how} Every label and ` +
        'every grammar word in the language you answer in (no English word ' +
        'in an answer in another language). When you are not sure of a ' +
        'form, say so rather than guess. ' +
        'No tool is needed: the verse is above. Telling what a word means ' +
        'is not translating the verse.'
    );
}

// The scripts a studied verse's words are put back in, and what a run of
// an answer's letters is.
const STUDY_SCRIPT_PATTERN_LIST = [/\p{Script=Hebrew}/u, /\p{Script=Greek}/u];
const LETTER_RUN_PATTERN = /[\p{L}\p{M}]+/gu;
const OTHER_SCRIPT_LETTER_PATTERN = /(?=\p{L})[^\p{Script=Latin}]/u;

/**
 * A verse's word the model copied with a letter of ANOTHER script inside it,
 * put back as the verse writes it: _הָאָֽរֶץ_, a Khmer ro where the verse
 * has a Hebrew resh, in both "All words" answers about Genesis 1:1
 * (2026-10-23, at temperature 0, so every time). Only a run that mixes the
 * verse's script with another, and only when ONE of the verse's words
 * matches it letter for letter everywhere else.
 */
export function repairStudiedWords(answer: string, verseText: string) {
    const scripts = STUDY_SCRIPT_PATTERN_LIST.filter((pattern) => {
        return pattern.test(verseText);
    });
    if (scripts.length === 0) {
        return answer;
    }
    const isVerseLetter = (character: string) => {
        return scripts.some((pattern) => {
            return pattern.test(character);
        });
    };
    const verseWords = [
        ...new Set(
            verseText.split(WORD_GAP_PATTERN).map((token) => {
                return toStudyWord(token).normalize('NFC');
            }),
        ),
    ].filter((word) => {
        return LETTER_PATTERN.test(word);
    });
    return answer.replace(LETTER_RUN_PATTERN, (run) => {
        const characters = [...run.normalize('NFC')];
        const isForeign = characters.map((character) => {
            return (
                LETTER_PATTERN.test(character) &&
                !isVerseLetter(character) &&
                OTHER_SCRIPT_LETTER_PATTERN.test(character)
            );
        });
        if (
            !isForeign.includes(true) ||
            !characters.some((character) => {
                return (
                    LETTER_PATTERN.test(character) && isVerseLetter(character)
                );
            })
        ) {
            return run;
        }
        const matches = verseWords.filter((word) => {
            const letters = [...word];
            return (
                letters.length === characters.length &&
                letters.every((letter, index) => {
                    return isForeign[index] || letter === characters[index];
                })
            );
        });
        return matches.length === 1 ? matches[0] : run;
    });
}

/** The transcript's line for the press, in the app's language. */
export function toWordStudyEcho(verse: StudyVerseType, word: string | null) {
    return word === null
        ? fillWords(tran('Teach me every word of {verse}'), {
              verse: verse.title,
          })
        : fillWords(tran('Teach me the word {word}'), { word });
}

// The language a word's letters say it is in, for a search to name: only
// where the letters leave no doubt. A Greek word with breathings or the
// accents of the old texts is biblical Greek, one without is Greek.
const WORD_LANGUAGE_LIST: [RegExp, string][] = [
    [/[\u1F00-\u1FFF]|\u0313|\u0314|\u0342|\u0345/u, 'biblical Greek'],
    [/\p{Script=Greek}/u, 'Greek'],
    [/\p{Script=Hebrew}/u, 'biblical Hebrew'],
    [/\p{Script=Khmer}/u, 'Khmer'],
    [/\p{Script=Thai}/u, 'Thai'],
    [/\p{Script=Lao}/u, 'Lao'],
    [/\p{Script=Hangul}/u, 'Korean'],
    [/[\p{Script=Hiragana}\p{Script=Katakana}]/u, 'Japanese'],
    [/\p{Script=Han}/u, 'Chinese'],
];

/**
 * A Greek word as a dictionary spells it: the grave accent a word takes
 * only inside a sentence -- _Θεὸς_, _καὶ_ -- is its acute.
 */
function toDictionaryAccent(word: string) {
    // A Hebrew word keeps its vowels and loses the accents that say how
    // its verse is chanted: a lexicon writes `אֱלֹהִים`, never `אֱלֹהִ֑ים`.
    if (/\p{Script=Hebrew}/u.test(word)) {
        return word
            .normalize('NFD')
            .replace(HEBREW_ACCENT_PATTERN, '')
            .normalize('NFC');
    }
    if (!/\p{Script=Greek}/u.test(word)) {
        return word;
    }
    return word
        .normalize('NFD')
        .replaceAll('\u0300', '\u0301')
        .normalize('NFC');
}

/**
 * **Search Google for …**: the address the window writes from the word --
 * never one a model wrote. A search for the WORD, not its verse (2026-10-23,
 * the user, with Google's overview of Genesis 1:1 up for _Θεὸς Genesis 1:1
 * meaning_: _I'd like to learn the word not the verse_): the word quoted, in
 * its dictionary accent, with the language its letters are in, which is what
 * brings a lexicon up first (Strong's G2316 for _"Θεός" biblical Greek word
 * meaning_). The zero-width joiners a Khmer word carries are taken out, or
 * the search looks for them too.
 */
export function toWordSearchUrl(word: string) {
    const asWritten = word
        .replaceAll(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .trim();
    // Read off the word as the verse writes it: its accents are what say
    // the Greek is the old texts'.
    const language =
        WORD_LANGUAGE_LIST.find(([pattern]) => {
            return pattern.test(asWritten);
        })?.[1] ?? null;
    const bare = toDictionaryAccent(asWritten);
    const query =
        language === null
            ? `"${bare}" meaning`
            : `"${bare}" ${language} word meaning`;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

const LATIN_LETTER_PATTERN = /\p{Script=Latin}/u;
const ANY_LETTER_PATTERN = /\p{L}/gu;

/**
 * What an answer about this passage keeps when it is shown in a language
 * other than the passage's (`toAnswerShownInLanguage`): the passage's own
 * letters. Latin is kept only for a word study of a verse written in it --
 * an English verse's words ARE the lesson there, where an ordinary answer
 * about the KJV in a Khmer window still loses an English word it slips in.
 */
export function toPassageAnswerKeep(
    facts: any,
    studiedText: string | null = null,
): AnswerKeepType | undefined {
    if (studiedText !== null) {
        const letters = studiedText.match(ANY_LETTER_PATTERN) ?? [];
        const latin = letters.filter((one) => {
            return LATIN_LETTER_PATTERN.test(one);
        });
        return {
            scriptText: studiedText,
            isLatinKept:
                letters.length > 0 && latin.length * 2 > letters.length,
        };
    }
    const text = (Array.isArray(facts?.passages) ? facts.passages : [])
        .map((passage: any) => {
            return typeof passage?.text === 'string' ? passage.text : '';
        })
        .join('\n');
    return text.trim().length === 0 ? undefined : { scriptText: text };
}
