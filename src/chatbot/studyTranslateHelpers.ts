/**
 * A study file TRANSLATED by the help window, part by part (2026-11-10,
 * EC-478; the user, with `JHN.3.The New Birth and God's Love.md` attached:
 * _translate all to khmer and then append the translated content to new
 * pages_ -- and _it fail_). The model had drafted a NEW file in Khmer, its
 * four diagrams gone, after a first try that ended in "I looked several
 * things up but could not settle on an answer": on the shared gemma4:cloud
 * a help round writes 2 000 tokens, the 13 KB study is several times that
 * in Khmer, and a change was the WHOLE new text in one call.
 *
 * Now the model only names the job -- `owa_resource_file` action
 * `translate` with `file`, `language` and `place` -- and the window does it:
 * the app splits the file (`translate`, `agentStudyFileHelpers.ts`), every
 * passage quoted again from an installed Bible in that language; the
 * translator (a Gemma 4 when one answers at no cost, the user's word for any
 * translation) is handed the words a part at a time and each diagram's
 * labels; a diagram whose translation would not draw stays as it was; and
 * the result is drafted like any change, for the person's **Save changes**.
 *
 * Pure: every rule a test. The running is `runStudyTranslate` in
 * `llmBotHelpers.ts`.
 */
import languageNameMap from '../lang/data/en/language-names.json';
import {
    groupLettersByScript,
    listAssistantLanguages,
} from './chatLangHelpers';

export const STUDY_TRANSLATE_PLACE_LIST = ['append', 'replace', 'new'] as const;
export type StudyTranslatePlaceType =
    (typeof STUDY_TRANSLATE_PLACE_LIST)[number];

/**
 * The words handed to the translator at once: ~450 tokens of English, which
 * comes back as up to ~2 000 in a script of its own -- inside the 4 000 a
 * translator's round has on a server of the user's own.
 */
export const STUDY_TRANSLATE_CHUNK_CHARS = 1600;
/** A part the translator got wrong is asked once more, then the job stops. */
export const STUDY_TRANSLATE_TRIES = 2;

export type StudyTranslateLanguageType = {
    code: string;
    name: string;
    nativeName: string;
    /** A letter of its own script, when it is not written in Latin. */
    scriptPattern: RegExp | null;
    /** The church's own words in it, by their English (`translationTerms`). */
    terms: Record<string, string>;
    /**
     * Its words take another form in a sentence -- an ending, a prefix --
     * so a church word is looked for by its stems, not letter for letter
     * (`churchWords.json`'s `wordsChangeForm`).
     */
    isWordFormChanging?: boolean;
    /**
     * The one script its church words are written in, when it is not Latin
     * (`withStudyChurchWords`): the script the translator is told to write.
     */
    scriptName?: string;
};

export type StudyTranslatePlanPartType = {
    kind: 'text' | 'diagram' | 'passage' | 'keep';
    text: string;
    quoted: string | null;
};

export type StudyTranslatePlanType = {
    file: string;
    name: string;
    hash: string;
    title: string | null;
    ref: string | null;
    bible: string | null;
    parts: StudyTranslatePlanPartType[];
    /**
     * The translations already added after the study (`translate`'s
     * `translations`): kept as they are, never translated again.
     */
    translations: string;
    footer: string;
};

/** The place a call names, or null. */
export function readStudyTranslatePlace(
    value: unknown,
): StudyTranslatePlaceType | null {
    const text = String(value ?? '')
        .trim()
        .toLowerCase();
    return (
        STUDY_TRANSLATE_PLACE_LIST.find((place) => {
            return place === text;
        }) ?? null
    );
}

function toNameWords(name: string) {
    return name
        .split(/[,;]/)
        .map((part) => {
            return part.split('(')[0].trim();
        })
        .filter((part) => {
            return part !== '';
        });
}

/**
 * The language a call names -- by its code, its English name or its own --
 * among the languages this computer knows first, then English's table of
 * every language's name. Null for nothing a language could be.
 */
export function resolveStudyTranslateLanguage(
    value: unknown,
): StudyTranslateLanguageType | null {
    const text = String(value ?? '').trim();
    if (text === '' || text.length > 60) {
        return null;
    }
    const key = text.toLowerCase();
    const known = listAssistantLanguages().find((language) => {
        return (
            language.code.toLowerCase() === key ||
            language.code.toLowerCase().split('-')[0] === key ||
            language.name.toLowerCase() === key ||
            language.nativeName.toLowerCase() === key
        );
    });
    if (known !== undefined) {
        return {
            code: known.code,
            name: known.name,
            nativeName: known.nativeName,
            scriptPattern: known.isLatinScript ? null : known.scriptPattern,
            terms: known.translationTerms,
        };
    }
    for (const [code, name] of Object.entries(
        languageNameMap as Record<string, string>,
    )) {
        const words = toNameWords(name);
        if (
            code.toLowerCase() === key ||
            words.some((word) => {
                return word.toLowerCase() === key;
            })
        ) {
            return {
                code,
                name: words[0] ?? name,
                nativeName: words[0] ?? name,
                scriptPattern: null,
                terms: {},
            };
        }
    }
    // A name the table lacks, said in letters: asked as it was said.
    return /^[\p{L}\p{M}][\p{L}\p{M} '-]{1,40}$/u.test(text)
        ? {
              code: '',
              name: text,
              nativeName: text,
              scriptPattern: null,
              terms: {},
          }
        : null;
}

function readArray(value: unknown) {
    return Array.isArray(value) ? value : [];
}

function toTextOrNull(value: unknown) {
    return typeof value === 'string' && value !== '' ? value : null;
}

/** A `translate` result as a plan, or null for a refusal. */
export function readStudyTranslatePlan(
    text: string,
): StudyTranslatePlanType | null {
    let result: any;
    try {
        result = JSON.parse(String(text ?? ''));
    } catch (_error) {
        return null;
    }
    if (
        result?.translating !== true ||
        typeof result.file !== 'string' ||
        typeof result.name !== 'string' ||
        typeof result.hash !== 'string'
    ) {
        return null;
    }
    const parts = readArray(result.parts).flatMap(
        (part: any): StudyTranslatePlanPartType[] => {
            const kind = part?.kind;
            if (
                typeof part?.text !== 'string' ||
                !['text', 'diagram', 'passage', 'keep'].includes(kind)
            ) {
                return [];
            }
            return [
                {
                    kind,
                    text: part.text,
                    quoted: toTextOrNull(part.quoted),
                },
            ];
        },
    );
    return {
        file: result.file,
        name: result.name,
        hash: result.hash,
        title: toTextOrNull(result.title),
        ref: toTextOrNull(result.ref),
        bible: toTextOrNull(result.bible),
        parts,
        translations:
            typeof result.translations === 'string' ? result.translations : '',
        footer: typeof result.footer === 'string' ? result.footer : '',
    };
}

/** A part's blank lines before and after its words, kept as they were. */
export function splitEdgeLines(text: string) {
    const lead = /^\n*/.exec(text)?.[0] ?? '';
    const trail = /\n*$/.exec(text.slice(lead.length))?.[0] ?? '';
    return {
        lead,
        words: text.slice(lead.length, text.length - trail.length),
        trail,
    };
}

function toLanguageText(language: StudyTranslateLanguageType) {
    const name =
        language.nativeName !== '' && language.nativeName !== language.name
            ? `${language.name} (${language.nativeName})`
            : language.name;
    return language.scriptName === undefined
        ? name
        : `${name}, written in ${language.scriptName} letters`;
}

/**
 * What the translator is handed for some of a study's words: the words,
 * then what to keep (the frame of `toAnswerTranslationAsk`, whose system
 * prompt says to translate exactly as the note after the text says).
 */
function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The church's words some English uses, as the translator is told them --
 * only those it uses, so the frame stays short (`listUsedTerms`' rule).
 */
export function toStudyTermsText(
    text: string,
    language: StudyTranslateLanguageType,
) {
    const used = Object.entries(language.terms)
        .filter(([english]) => {
            return new RegExp(`\\b${escapeRegExp(english)}\\b`, 'i').test(text);
        })
        .map(([english, word]) => {
            return `${english} = ${word}`;
        });
    return used.length === 0
        ? ''
        : ` Use the church's own words in ${language.name}: ${used.join('; ')}.`;
}

/**
 * The app's own labels that are a study's church words (2026-11-11,
 * EC-488). Every language package names the Reader's Cross References panel
 * and the two Testaments in its own church's words, so a language with no
 * `translationTerms` of its own still gets them -- only Khmer and French had
 * a list, and the other packages' translators were told the meaning rule
 * alone.
 */
export const STUDY_TERM_LABEL_LIST = [
    'Cross References',
    'Cross Reference',
    'Old Testament',
    'New Testament',
];

/**
 * The file an installed language carries its labels in: the plugin build
 * writes the dictionary as `tran.json`, its keys in lower case, and ships
 * no `dictionary.json` (that is the source package's name for it).
 */
export const STUDY_LABEL_FILE_NAME = 'tran.json';

/**
 * The language with those labels added to its church words, read off its
 * labels for the one translation (`runStudyTranslate`), a key as written or
 * in lower case: its own `translationTerms` win where both name one, and a
 * label left in English or empty adds nothing. No labels, no change.
 */
export function withStudyLabelTerms(
    language: StudyTranslateLanguageType,
    dictionary: unknown,
): StudyTranslateLanguageType {
    if (dictionary === null || typeof dictionary !== 'object') {
        return language;
    }
    const record = dictionary as Record<string, unknown>;
    const ownKeySet = new Set(
        Object.keys(language.terms).map((english) => {
            return english.toLowerCase();
        }),
    );
    const labelTermList = STUDY_TERM_LABEL_LIST.flatMap((label) => {
        const word = record[label] ?? record[label.toLowerCase()];
        if (typeof word !== 'string' || ownKeySet.has(label.toLowerCase())) {
            return [];
        }
        const trimmed = word.trim();
        return trimmed === '' || trimmed.toLowerCase() === label.toLowerCase()
            ? []
            : [[label, trimmed] as [string, string]];
    });
    if (labelTermList.length === 0) {
        return language;
    }
    return {
        ...language,
        terms: { ...Object.fromEntries(labelTermList), ...language.terms },
    };
}

/**
 * The file a language keeps its Bible's own words in (2026-11-11, EC-491):
 * what a Bible study names -- _Son of Man_, _eternal life_, _the
 * Pharisees_, Moses and Peter -- as that language's Bible writes them, each
 * read off the Bible's own verses, and whether its words change form in a
 * sentence. The four labels above were all a language without a list of its
 * own had, and only Khmer and French had a list.
 */
export const STUDY_CHURCH_WORDS_FILE_NAME = 'churchWords.json';

/**
 * The scripts other than Latin some church words are written in, when most
 * of their letters are: every one of them in the pattern (Japanese writes
 * three together), and the script's name when there is only one. Null for
 * words written in Latin letters.
 */
function readStudyWordsScript(wordList: string[]) {
    const letterMap = groupLettersByScript(wordList.join(' '));
    let letterCount = 0;
    const otherList: [name: string, count: number][] = [];
    for (const [name, letters] of letterMap) {
        letterCount += letters.length;
        if (name !== 'Latin') {
            otherList.push([name, letters.length]);
        }
    }
    const otherCount = otherList.reduce((sum, [, count]) => {
        return sum + count;
    }, 0);
    if (otherCount === 0 || otherCount * 2 < letterCount) {
        return null;
    }
    return {
        pattern: new RegExp(
            `[${otherList
                .map(([name]) => {
                    return `\\p{Script=${name}}`;
                })
                .join('')}]`,
            'u',
        ),
        name: otherList.length === 1 ? otherList[0][0] : undefined,
    };
}

/**
 * The language with its Bible's words (`churchWords.json`, read for the one
 * translation) under its own `translationTerms`, which win where both name
 * one, a key as written or in another case (_Gospel_ and _gospel_ are one
 * word, never two the translator is told at once). A word left as its
 * English, or not a word at all, adds nothing.
 *
 * The words also say the SCRIPT its Bible writes (2026-11-11, EC-491): a
 * language written in two -- Serbian in Cyrillic and in Latin letters --
 * came back in the one its words were not, so every word handed over was
 * "missing". The translator is told that script, and a language with no
 * script of its own here is held to it.
 */
export function withStudyChurchWords(
    language: StudyTranslateLanguageType,
    file: unknown,
): StudyTranslateLanguageType {
    if (file === null || typeof file !== 'object') {
        return language;
    }
    const { words, wordsChangeForm } = file as Record<string, unknown>;
    const ownKeySet = new Set(
        Object.keys(language.terms).map((english) => {
            return english.trim().toLowerCase();
        }),
    );
    const wordList =
        words === null || typeof words !== 'object'
            ? []
            : Object.entries(words as Record<string, unknown>).flatMap(
                  ([english, word]) => {
                      if (typeof word !== 'string') {
                          return [];
                      }
                      const trimmed = word.trim();
                      return trimmed === '' ||
                          english.trim() === '' ||
                          ownKeySet.has(english.trim().toLowerCase()) ||
                          trimmed.toLowerCase() === english.toLowerCase()
                          ? []
                          : [[english.trim(), trimmed] as [string, string]];
                  },
              );
    if (wordList.length === 0) {
        return language;
    }
    const script = readStudyWordsScript(
        wordList.map(([, word]) => {
            return word;
        }),
    );
    return {
        ...language,
        terms: { ...Object.fromEntries(wordList), ...language.terms },
        isWordFormChanging: wordsChangeForm === true,
        ...(script === null
            ? {}
            : {
                  scriptPattern: language.scriptPattern ?? script.pattern,
                  ...(script.name === undefined
                      ? {}
                      : { scriptName: script.name }),
              }),
    };
}

/**
 * What a word MEANS, never how it sounds (2026-11-10, EC-486): the Gemma 4
 * translator wrote a study's _Cross references_ heading as the English
 * "Cross" spelled out in Khmer letters, in two studies on the same day --
 * a word no reader knows. Said to every language's translator.
 */
export const STUDY_MEANING_RULE =
    'Translate what each word means in a Bible study, never how it ' +
    "sounds: spell no English word out in the language's letters, a " +
    "person's or a place's name aside -- Cross references are other " +
    'Bible verses on the same subject, not a cross.';

export function toStudyTextTranslationAsk(
    text: string,
    language: StudyTranslateLanguageType,
    missingTerms: [english: string, word: string][] = [],
    strayLetters: string[] = [],
) {
    const termsText = toStudyTermsText(text, language);
    const strayText =
        strayLetters.length === 0
            ? ''
            : ' Your last translation had letters of another language in ' +
              `it (${strayLetters.join(' ')}); write every word in ` +
              `${language.name} letters.`;
    const missingText =
        missingTerms.length === 0
            ? ''
            : ' Your last translation wrote these another way; write them ' +
              `so: ${missingTerms
                  .map(([english, word]) => {
                      return `${english} = ${word}`;
                  })
                  .join('; ')}.`;
    return (
        `${text.trim()}\n\n(Translate the part of a Bible study above into ` +
        `${toLanguageText(language)}, in plain words a church reads aloud. ` +
        'Keep exactly as written: every Markdown mark (#, -, 1., **, *, >, ' +
        '| of a table, ---), every line break and blank line, links, numbers ' +
        'and Bible references (write the book in that language), and every ' +
        '[^…] token. Translate every other word -- headings and table cells ' +
        `too; leave nothing in the language it was in. ${STUDY_MEANING_RULE}` +
        termsText +
        missingText +
        strayText +
        ' Answer with the translation alone, nothing else.)'
    );
}

/** What the translator is handed for a diagram: its source and its rules. */
export function toStudyDiagramTranslationAsk(
    source: string,
    language: StudyTranslateLanguageType,
) {
    return (
        `${source.trim()}\n\n(This is a mermaid diagram from a Bible study. ` +
        `Translate only the words a reader sees into ` +
        `${toLanguageText(language)}: the labels in quotes and brackets, ` +
        'the words after a colon in a timeline or a mindmap, a title. Keep ' +
        'everything else exactly as written: the first line, every node id, ' +
        'arrow, bracket, quote mark, colon, indent and line break.' +
        toStudyTermsText(source, language) +
        ' Answer with the diagram alone, no ``` fence.)'
    );
}

/**
 * The translator's answer as the words: a fence it put round them taken
 * off, and nothing it added in front ("Here is the translation:").
 */
export function cleanStudyTranslation(answer: string) {
    let text = String(answer ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
    const fenced = /^(```|~~~)[\w-]*\n([\s\S]*?)\n\1\s*$/.exec(text);
    if (fenced !== null) {
        text = fenced[2];
    }
    return text.trim();
}

const HEADING_LINE_PATTERN = /^(\s{0,3}#{1,6})[ \t]+(.+?)[ \t]*$/;

/** A heading's words as a term is keyed: no `The`, bold or colon, any case. */
function toHeadingTermKey(words: string) {
    return words
        .replace(/\*\*|__/g, '')
        .replace(/[ \t]+#+$/, '')
        .replace(/[:.][ \t]*$/, '')
        .replace(/^the[ \t]+/i, '')
        .trim()
        .toLowerCase();
}

/**
 * A church word as a heading starts it: its first letter a capital in a
 * script that has them (a Bible's words are kept as they stand in a
 * sentence -- _the Pharisees_ -- EC-491).
 */
function toHeadingWord(word: string, langCode: string) {
    const [first = '', ...rest] = [...word];
    let upper = first.toUpperCase();
    try {
        upper = first.toLocaleUpperCase(langCode === '' ? undefined : langCode);
    } catch (_error) {
        // A code no locale has: the plain capital.
    }
    return upper + rest.join('');
}

/**
 * A heading whose words ARE one of the language's church words (`terms`),
 * written as that word whatever the translator wrote (EC-486): _Cross
 * references_ came back as no word at all twice, with the word in the list.
 * Headings are paired in their order, and only when the translation has as
 * many as the words handed in.
 */
export function applyStudyHeadingTerms(
    source: string,
    translated: string,
    language: StudyTranslateLanguageType,
) {
    const wordByKey = new Map(
        Object.entries(language.terms).map(([english, word]) => {
            return [toHeadingTermKey(english), word];
        }),
    );
    const sourceHeadingList = source.split('\n').flatMap((line) => {
        const match = HEADING_LINE_PATTERN.exec(line);
        return match === null ? [] : [match[2]];
    });
    const lines = translated.split('\n');
    const headingIndexList = lines.flatMap((line, index) => {
        return HEADING_LINE_PATTERN.test(line) ? [index] : [];
    });
    if (
        wordByKey.size === 0 ||
        sourceHeadingList.length === 0 ||
        headingIndexList.length !== sourceHeadingList.length
    ) {
        return translated;
    }
    sourceHeadingList.forEach((words, order) => {
        const word = wordByKey.get(toHeadingTermKey(words));
        if (word === undefined) {
            return;
        }
        const index = headingIndexList[order];
        const marks = HEADING_LINE_PATTERN.exec(lines[index])?.[1] ?? '##';
        lines[index] = `${marks} ${toHeadingWord(word, language.code)}`;
    });
    return lines.join('\n');
}

// What a Bible's own text puts between words and a translator does not --
// zero-width spaces and joiners -- left out when one is looked for in the
// other, and a curly apostrophe or the turned comma some alphabets write as
// a letter read as the straight one a term is written with.
const INVISIBLE_MARK_PATTERN = /[\u200B-\u200D\u2060\uFEFF]/g;
const APOSTROPHE_PATTERN = /[\u2018\u2019\u02BB\u02BC]/g;
// Every combining mark once a letter is taken apart: the vowel points,
// accents, tone marks and dots one writer puts on a word and another
// leaves off (EC-491: a Bible's fully pointed word was "missing" from every
// unpointed translation, and the old spelling's cedilla from the new one's
// comma). Leaving them out only ever finds more.
const COMBINING_MARK_PATTERN = /\p{M}/gu;

function toFindableText(text: string) {
    return text
        .replace(INVISIBLE_MARK_PATTERN, '')
        .replace(APOSTROPHE_PATTERN, "'")
        .normalize('NFD')
        .toLowerCase()
        .replace(COMBINING_MARK_PATTERN, '');
}

// Scripts one language writes together -- Japanese's three, Korean's Hangul
// with Han: never a stray letter among one another.
const SHARED_TEXT_SCRIPT_SET = new Set([
    'Han',
    'Hiragana',
    'Katakana',
    'Hangul',
    'Bopomofo',
    'Yi',
]);

/**
 * The letters of a translated part in a script that is neither the one most
 * of its letters are in nor one the words handed in use, each once, eight at
 * most: a letter of another language a translator slips into a word
 * (2026-11-11, EC-490: a letter of a third script in a translated
 * sentence). Latin is never stray -- a name, the app's words.
 */
export function listStudyStrayLetters(source: string, translated: string) {
    const letterMap = groupLettersByScript(translated);
    let mainName: string | null = null;
    let mainCount = 0;
    for (const [name, letters] of letterMap) {
        if (letters.length > mainCount) {
            mainName = name;
            mainCount = letters.length;
        }
    }
    if (mainName === null) {
        return [];
    }
    const sourceNameSet = new Set(groupLettersByScript(source).keys());
    const isMainShared = SHARED_TEXT_SCRIPT_SET.has(mainName);
    const straySet = new Set<string>();
    for (const [name, letters] of letterMap) {
        if (
            name === 'Latin' ||
            name === mainName ||
            sourceNameSet.has(name) ||
            (isMainShared && SHARED_TEXT_SCRIPT_SET.has(name))
        ) {
            continue;
        }
        for (const letter of letters) {
            straySet.add(letter);
        }
    }
    return [...straySet].slice(0, 8);
}

// A word shorter than this is never looked for by a stem: two or three
// letters are in most sentences of the language anyway.
const STEM_WORD_MIN_LETTERS = 4;
// How much of a longer word a stem is: an ending or a prefix the sentence
// put on it changes the rest (EC-491).
const STEM_SHARE = 0.6;

/**
 * Whether a church word is in a translation whose words change form
 * (`isWordFormChanging`): each of its words of four letters or more by a
 * stem -- three fifths of its letters in a row, at any place in it --
 * wherever it stands. Letter for letter, a word put after "of" in such a
 * language was "missing" from every sentence that said it right, and the
 * retry pushed the translator to write it wrong.
 */
function checkHasWordStems(findable: string, word: string) {
    return toFindableText(word)
        .split(/[\s-]+/)
        .every((piece) => {
            const letters = [...piece];
            if (letters.length < STEM_WORD_MIN_LETTERS) {
                return true;
            }
            const size = Math.ceil(letters.length * STEM_SHARE);
            for (let start = 0; start + size <= letters.length; start++) {
                if (
                    findable.includes(
                        letters.slice(start, start + size).join(''),
                    )
                ) {
                    return true;
                }
            }
            return false;
        });
}

/**
 * The language's church words of more than one word -- the name of a
 * thing, said one way (_bronze serpent_) -- that the English uses and the
 * translation does not write, as `[english, word]`. One word (_God_,
 * _verse_) is left out: a translation may fairly say it another way.
 */
export function listMissingStudyTerms(
    source: string,
    translated: string,
    language: StudyTranslateLanguageType,
): [english: string, word: string][] {
    const findable = toFindableText(translated);
    return Object.entries(language.terms).filter(([english, word]) => {
        return (
            /\s/.test(english.trim()) &&
            new RegExp(`\\b${escapeRegExp(english)}\\b`, 'i').test(source) &&
            !(language.isWordFormChanging === true
                ? checkHasWordStems(findable, word)
                : findable.includes(toFindableText(word)))
        );
    });
}

function countMatches(text: string, pattern: RegExp) {
    return [...text.matchAll(pattern)].length;
}

function countScriptLetters(text: string, scriptPattern: RegExp) {
    const flags = scriptPattern.flags.includes('g')
        ? scriptPattern.flags
        : `${scriptPattern.flags}g`;
    return countMatches(text, new RegExp(scriptPattern.source, flags));
}

function countWordLetters(text: string) {
    return countMatches(text, /\p{L}/gu);
}

/**
 * Whether some of a study's words came back translated: not the words
 * handed in, not cut to a stub or run on past them, in the language's own
 * letters where it has a script of its own, and with its `[^…]` tokens and
 * its tables still there.
 */
export function checkIsStudyTextTranslated(
    source: string,
    translated: string,
    language: StudyTranslateLanguageType,
) {
    const from = source.trim();
    const to = translated.trim();
    if (to === '' || to === from) {
        return false;
    }
    if (to.length < from.length * 0.25 || to.length > from.length * 6 + 200) {
        return false;
    }
    const tokenPattern = /\[\^[^\]\n]{1,80}\]/g;
    if (countMatches(to, tokenPattern) < countMatches(from, tokenPattern)) {
        return false;
    }
    if (countMatches(to, /^\s*\|/gm) < countMatches(from, /^\s*\|/gm)) {
        return false;
    }
    if (language.scriptPattern !== null && countWordLetters(from) >= 12) {
        // Most of a part's letters are its own script's, a name or a
        // number left in Latin aside.
        return (
            countScriptLetters(to, language.scriptPattern) >=
            countWordLetters(to) * 0.4
        );
    }
    return true;
}

/**
 * Whether a diagram came back as the same diagram with other words: its
 * first word, its line count and its arrows as they were. Whether it DRAWS
 * is mermaid's to say, in the window.
 */
export function checkIsStudyDiagramTranslated(
    source: string,
    translated: string,
) {
    const from = source.trim().split('\n');
    const to = translated.trim().split('\n');
    const firstWord = (lines: string[]) => {
        return (lines[0] ?? '').trim().split(/\s+/)[0];
    };
    const arrowPattern = /-->|---|==>|-\.->|->>|-->>|->|<--/g;
    return (
        translated.trim() !== '' &&
        firstWord(from) === firstWord(to) &&
        Math.abs(from.length - to.length) <= 1 &&
        countMatches(translated, arrowPattern) ===
            countMatches(source, arrowPattern) &&
        !/<[a-z][^>]*>/i.test(translated)
    );
}

export type StudyTranslateResultType = {
    /** The translated body: title, passage, words, diagrams, no footer. */
    body: string;
    diagramCount: number;
    /** Diagrams left as they were: their translation would not draw. */
    keptDiagramCount: number;
    passageCount: number;
    /** Passages left as they were: no Bible in that language read them. */
    keptPassageCount: number;
};

/**
 * The plan put together again in the new language: each word part's
 * translation (`textByPart`, by the part's place), each diagram's
 * (`diagramByPart`, null when it is kept), each passage as quoted again, or
 * as it was.
 */
export function assembleStudyTranslation(
    plan: StudyTranslatePlanType,
    textByPart: Map<number, string>,
    diagramByPart: Map<number, string | null>,
): StudyTranslateResultType {
    let diagramCount = 0;
    let keptDiagramCount = 0;
    let passageCount = 0;
    let keptPassageCount = 0;
    const pieces = plan.parts.map((part, index) => {
        if (part.kind === 'text') {
            const { lead, words, trail } = splitEdgeLines(part.text);
            const translated = textByPart.get(index);
            return translated === undefined || words.trim() === ''
                ? part.text
                : `${lead}${translated}${trail}`;
        }
        if (part.kind === 'diagram') {
            diagramCount += 1;
            const translated = diagramByPart.get(index) ?? null;
            if (translated === null) {
                keptDiagramCount += 1;
                return part.text;
            }
            return translated;
        }
        if (part.kind === 'passage') {
            passageCount += 1;
            if (part.quoted === null) {
                keptPassageCount += 1;
                return part.text;
            }
            return part.quoted;
        }
        return part.text;
    });
    return {
        body: pieces.join('\n'),
        diagramCount,
        keptDiagramCount,
        passageCount,
        keptPassageCount,
    };
}

/**
 * The `draft` call that holds the translation, for the place asked: added
 * after the file, in place of its words, or a copy of its own -- a copy is
 * drafted like a new study (`ref` off the file's name, the translated title,
 * the words under the passage), so the app quotes its passage from `bible`.
 */
export function toStudyTranslateDraftArgs(
    plan: StudyTranslatePlanType,
    body: string,
    place: StudyTranslatePlaceType,
    language: StudyTranslateLanguageType,
): Record<string, string> | { reason: string } {
    const trimmed = body.trim();
    if (place === 'append') {
        return {
            action: 'draft',
            file: plan.file,
            append: `---\n\n${trimmed}`,
            ...(plan.bible === null ? {} : { bible: plan.bible }),
        };
    }
    if (place === 'replace') {
        // In place of the study's own words: the translations added after
        // it stay where they were.
        const translations = plan.translations.trim();
        return {
            action: 'draft',
            file: plan.file,
            content:
                translations === ''
                    ? `${trimmed}\n${plan.footer}`
                    : `${trimmed}\n\n${translations}\n${plan.footer}`,
            ...(plan.bible === null ? {} : { bible: plan.bible }),
        };
    }
    if (plan.ref === null) {
        return {
            reason:
                `${plan.name} is not named for a passage, so a copy cannot ` +
                'be named for one: add the translation after it (place ' +
                '"append") instead.',
        };
    }
    const lines = trimmed.split('\n');
    const titleIndex = lines.findIndex((line) => {
        return /^#\s+\S/.test(line);
    });
    const title =
        titleIndex === -1
            ? `${plan.title ?? plan.name} (${language.name})`
            : lines[titleIndex].replace(/^#\s+/, '').replace(/\s+#*\s*$/, '');
    let rest = titleIndex === -1 ? lines : lines.slice(titleIndex + 1);
    // The passage right under the title is the app's to quote again.
    const firstWords = rest.findIndex((line) => {
        return line.trim() !== '';
    });
    if (firstWords !== -1 && /^\s{0,3}>/.test(rest[firstWords])) {
        let end = firstWords;
        while (end < rest.length && /^\s{0,3}>/.test(rest[end])) {
            end += 1;
        }
        rest = rest.slice(end);
    }
    return {
        action: 'draft',
        ref: plan.ref,
        title: title.slice(0, 60).trim(),
        content: rest.join('\n').trim(),
        ...(plan.bible === null ? {} : { bible: plan.bible }),
    };
}

/** What the model is told the window did, in place of the plan. */
export function describeStudyTranslation(
    plan: StudyTranslatePlanType,
    result: StudyTranslateResultType,
    language: StudyTranslateLanguageType,
    place: StudyTranslatePlaceType,
    translatorName: string,
) {
    const sentences = [
        `The window translated ${plan.name} into ${language.name} part by ` +
            `part with ${translatorName}` +
            (place === 'append'
                ? ', to be added after the file as it is'
                : place === 'replace'
                  ? ', in place of its words'
                  : ', as a copy of its own') +
            '.',
    ];
    if (result.diagramCount > 0) {
        sentences.push(
            result.keptDiagramCount === 0
                ? `Its ${result.diagramCount} diagram(s) are translated.`
                : `${result.diagramCount - result.keptDiagramCount} of its ` +
                      `${result.diagramCount} diagrams are translated; ` +
                      `${result.keptDiagramCount} kept as they were, since ` +
                      'their translation would not draw.',
        );
    }
    if (plan.translations.trim() !== '') {
        sentences.push(
            'Only the study as it was written was translated: the ' +
                'translations already added after it are kept as they are.',
        );
    }
    if (result.passageCount > 0) {
        sentences.push(
            result.keptPassageCount === 0
                ? `Its Bible passages are quoted from ${plan.bible}.`
                : plan.bible === null
                  ? `No ${language.name} Bible is installed, so its Bible ` +
                    'passages are quoted as they were.'
                  : `${result.keptPassageCount} Bible passage(s) could not ` +
                    `be read in ${plan.bible} and are quoted as they were.`,
        );
    }
    return sentences.join(' ');
}
