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
import {
    chunkStudyText,
    listStudyTranslations,
    splitStudyForTranslation,
    toStudyDiagramSource,
} from '../helper/agentStudyFileRules';
import languageNameMap from '../lang/data/en/language-names.json';
import {
    DEFAULT_CHAT_LANG_CODE,
    OTHER_CHAT_LANG_CODE,
    detectTypedLanguage,
    groupLettersByScript,
    listAssistantLanguages,
    toPackageLangCode,
} from './chatLangHelpers';
import {
    listStudyDiagramLabels,
    listStudySequenceIds,
    toStudyDiagramSeenWordsText,
    withStudySequenceNames,
} from './studyDiagramWordHelpers';
import {
    countLetterRuns,
    countLetters,
    listOftenUnwrittenLetters,
    measureLetterRunLikeness,
} from './textLikenessHelpers';

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
 * The scripts other than Latin some words are written in -- a language's
 * church words, or a saved translation's own (EC-559) -- when most of their
 * letters are: every one of them in the pattern (Japanese writes three
 * together), and the script's name when there is only one. Null for words
 * written in Latin letters.
 */
export function readStudyWordsScript(wordList: string[]) {
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

/**
 * What the translator is handed for some of a study's words. `bookText` is
 * how the language's Bible names the books they cite, and the references
 * the last answer named another way (`toStudyBookNamesText`, EC-534);
 * `nameText` the verses of the names they use as the Bible quoted writes
 * them, and the words the last answer wrote otherwise
 * (`toStudyNameVersesText`, EC-535).
 */
export function toStudyTextTranslationAsk(
    text: string,
    language: StudyTranslateLanguageType,
    missingTerms: [english: string, word: string][] = [],
    strayLetters: string[] = [],
    strayWords: string[] = [],
    bookText = '',
    nameText = '',
) {
    const termsText = toStudyTermsText(text, language);
    const strayText =
        strayLetters.length === 0
            ? ''
            : ' Your last translation had letters of another language in ' +
              `it (${strayLetters.join(' ')}); write every word in ` +
              `${language.name} letters.`;
    const strayWordsText =
        strayWords.length === 0
            ? ''
            : ' Your last translation left English words in it ' +
              `(${strayWords.join(', ')}); translate them into ` +
              `${language.name} too.`;
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
        bookText +
        nameText +
        missingText +
        strayText +
        strayWordsText +
        ' Answer with the translation alone, nothing else.)'
    );
}

/**
 * What the translator is handed for a diagram: its source and its rules --
 * the words a reader sees named for its kind (`toStudyDiagramSeenWordsText`,
 * EC-533: told "the words after a colon", it had left a timeline's periods
 * and a mindmap's branches English), and, asked again, the labels its last
 * answer left as they were; `bookText` and `nameText` as for a study's
 * words (EC-534, EC-535).
 */
export function toStudyDiagramTranslationAsk(
    source: string,
    language: StudyTranslateLanguageType,
    leftLabels: string[] = [],
    bookText = '',
    nameText = '',
) {
    // Eight at most: the rest are in the diagram right above.
    const leftText =
        leftLabels.length === 0
            ? ''
            : ' Your last translation left these as they were; translate ' +
              `them too: ${leftLabels
                  .slice(0, 8)
                  .map((label) => {
                      return `"${label}"`;
                  })
                  .join(', ')}.`;
    return (
        `${source.trim()}\n\n(This is a mermaid diagram from a Bible study. ` +
        `Translate every word a reader sees into ` +
        `${toLanguageText(language)}: ` +
        `${toStudyDiagramSeenWordsText(source)}. Keep everything else ` +
        'exactly as written: the first line, every node id, arrow, ' +
        'bracket, quote mark, colon, indent and line break.' +
        toStudyTermsText(source, language) +
        bookText +
        nameText +
        leftText +
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

/**
 * A heading's words as they read: no bold, closing marks or colon -- for a
 * translation's, the words a replace writes over.
 */
function toHeadingText(words: string) {
    return words
        .replace(/\*\*|__/g, '')
        .replace(/[ \t]+#+$/, '')
        .replace(/[:.][ \t]*$/, '')
        .trim();
}

/** A heading's words as a term is keyed: no `The`, bold or colon, any case. */
function toHeadingTermKey(words: string) {
    return toHeadingText(words)
        .replace(/^the[ \t]+/i, '')
        .trim()
        .toLowerCase();
}

/** The words of each heading of some words, in their order. */
function listHeadingWords(text: string) {
    return text.split('\n').flatMap((line) => {
        const match = HEADING_LINE_PATTERN.exec(line);
        return match === null ? [] : [match[2]];
    });
}

/** The language's church words by the key a heading's words are read by. */
function toHeadingTermMap(language: StudyTranslateLanguageType) {
    return new Map(
        Object.entries(language.terms).map(([english, word]) => {
            return [toHeadingTermKey(english), word];
        }),
    );
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
    const wordByKey = toHeadingTermMap(language);
    const sourceHeadingList = listHeadingWords(source);
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
    return [...findStudyStrayLetterSet(source, translated)].slice(0, 8);
}

/**
 * Every stray letter of `listStudyStrayLetters`, each once: what a saved
 * translation's words are read for (EC-559), its main script read off
 * `scriptText` -- its prose, where its diagrams' Latin syntax and labels
 * left in English could outnumber the letters of its own.
 */
export function findStudyStrayLetterSet(
    source: string,
    translated: string,
    scriptText = translated,
) {
    const straySet = new Set<string>();
    const letterMap = groupLettersByScript(translated);
    let mainName: string | null = null;
    let mainCount = 0;
    const scriptMap =
        scriptText === translated
            ? letterMap
            : groupLettersByScript(scriptText);
    for (const [name, letters] of scriptMap) {
        if (letters.length > mainCount) {
            mainName = name;
            mainCount = letters.length;
        }
    }
    if (mainName === null) {
        return straySet;
    }
    const sourceNameSet = new Set(groupLettersByScript(source).keys());
    const isMainShared = SHARED_TEXT_SCRIPT_SET.has(mainName);
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
    return straySet;
}

// What a translated part keeps in Latin letters by right: a code span, a
// link's address, a `[^…]` token, a tag, an entity, a web address.
const KEPT_LATIN_PATTERN =
    /`[^`\n]*`|\]\([^)\n]*\)|\[\^[^\]\n]*\]|<[^>\n]*>|&[a-z]+;|\b(?:https?:\/\/|www\.)\S+/g;
const LATIN_WORD_PATTERN = /[A-Za-z][A-Za-z'’]*/g;
const LOWER_LATIN_WORD_PATTERN = /^[a-z][a-z'’]*[a-z]$/;
const LATIN_EDGE_PATTERN = /^[^A-Za-z]+|[^A-Za-z]+$/g;
// What sets one word apart as a term named: italics, bold, quote marks.
const TERM_MARK_PATTERN = /["*_'“”‘’]/;

// The words of one stretch between two of the script's letters, when one
// of them is an English word left: a lowercase word of two letters or more
// (a capitalised one alone may be a name). One word set apart as a term --
// _agape_ in italics or quotes -- is named, not left.
function readStrayWords(piece: string) {
    const wordList = piece.match(LATIN_WORD_PATTERN) ?? [];
    if (
        !wordList.some((word) => {
            return LOWER_LATIN_WORD_PATTERN.test(word);
        })
    ) {
        return null;
    }
    const words = piece.replace(LATIN_EDGE_PATTERN, '');
    if (wordList.length === 1) {
        const at = piece.indexOf(words);
        if (
            TERM_MARK_PATTERN.test(piece[at - 1] ?? '') &&
            TERM_MARK_PATTERN.test(piece[at + words.length] ?? '')
        ) {
            return null;
        }
    }
    return words.length > 40 ? `${words.slice(0, 40).trim()}…` : words;
}

/**
 * English words a translation into a language with a script of its own
 * left between that script's words, each once, eight at most (2026-11-12,
 * EC-533: the user's John 3 study, its Khmer half translated by the window,
 * kept "and" twice and "between" -- a reader of Khmer alone stops at each).
 * Only what stands BETWEEN two of the script's letters on a line: a line's
 * end may be a name or a key, and a code span, a link's address, a `[^…]`
 * token and a web address keep their Latin letters by right. None for a
 * language written in Latin letters: its words cannot be told from English
 * this way.
 */
export function listStudyStrayWords(
    translated: string,
    language: Pick<StudyTranslateLanguageType, 'scriptPattern'>,
) {
    if (language.scriptPattern === null) {
        return [];
    }
    const scriptRunPattern = new RegExp(
        `(?:${language.scriptPattern.source})+`,
        'gu',
    );
    const straySet = new Set<string>();
    for (const rawLine of translated.split('\n')) {
        const line = rawLine.replace(KEPT_LATIN_PATTERN, ' ');
        let lastEnd = -1;
        for (const match of line.matchAll(scriptRunPattern)) {
            if (lastEnd >= 0) {
                const words = readStrayWords(line.slice(lastEnd, match.index));
                if (words !== null) {
                    straySet.add(words);
                }
            }
            lastEnd = match.index + match[0].length;
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

// What may stand between the words of a church word, or not at all: a
// space, a hyphen or a soft one (2026-11-13, EC-596: a Bible writes John
// the Baptist with a hyphen between its two words, and a translation with
// a space, with nothing, or with a line's break -- one word all the same).
const TERM_JOIN_PATTERN = /[\s\u00AD\u2010\u2011-]+/gu;

/** Some words as a church word is looked for in them (`toFindableText`). */
function toTermFindableText(text: string) {
    return toFindableText(text).replace(TERM_JOIN_PATTERN, '');
}

/**
 * Whether some words, read by `toTermFindableText`, write a church word: by
 * its stems in a language whose words change form (`checkHasWordStems`),
 * else letter for letter.
 */
function checkHasStudyTerm(
    findable: string,
    word: string,
    language: StudyTranslateLanguageType,
) {
    return language.isWordFormChanging === true
        ? checkHasWordStems(findable, word)
        : findable.includes(toTermFindableText(word));
}

/** Where some words use a church word: each place, whole words, any case. */
export function listStudyTermPlaces(text: string, english: string) {
    return [
        ...text.matchAll(new RegExp(`\\b${escapeRegExp(english)}\\b`, 'gi')),
    ].map((match) => {
        return match.index ?? 0;
    });
}

function checkIsTermUsed(source: string, english: string) {
    return new RegExp(`\\b${escapeRegExp(english)}\\b`, 'i').test(source);
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
    const findable = toTermFindableText(translated);
    return Object.entries(language.terms).filter(([english, word]) => {
        return (
            /\s/.test(english.trim()) &&
            checkIsTermUsed(source, english) &&
            !checkHasStudyTerm(findable, word, language)
        );
    });
}

/**
 * Whether a translation is in `language` by its church words: of those the
 * English uses, one word or more, it writes at least half (2026-11-13,
 * EC-596). A saved translation's language is read off its words by the
 * languages installed, so a language that is not can be read as a near one
 * that is -- and that one's church words would all be "missing" from it.
 * Too few used to tell, two at least, and it is not judged.
 */
export function checkIsStudyTermLanguage(
    source: string,
    translated: string,
    language: StudyTranslateLanguageType,
) {
    const findable = toTermFindableText(translated);
    let usedCount = 0;
    let writtenCount = 0;
    for (const [english, word] of Object.entries(language.terms)) {
        if (!checkIsTermUsed(source, english)) {
            continue;
        }
        usedCount += 1;
        if (checkHasStudyTerm(findable, word, language)) {
            writtenCount += 1;
        }
    }
    return usedCount >= 2 && writtenCount * 2 >= usedCount;
}

/** A translation's heading that is a church word it does not write. */
export type StudyHeadingTermSlipType = {
    /** The English half's heading in its place, as it reads. */
    english: string;
    /** The church word, as a heading starts it. */
    word: string;
    /** The translation's heading words: what a replace writes over. */
    written: string;
};

/**
 * The headings of a translation whose English heading IS one of its
 * language's church words (`terms`) and that do not write that word
 * (2026-11-13, EC-596): what `applyStudyHeadingTerms` writes as the word in
 * a NEW translation, read in a saved one -- the user's John 3 study,
 * translated before EC-486, heads its Cross references with no word of its
 * language. Headings are paired in their order, only when both have as
 * many; none for a language with no church words.
 */
export function listStudyHeadingTermSlips(
    source: string,
    translated: string,
    language: StudyTranslateLanguageType,
): StudyHeadingTermSlipType[] {
    const wordByKey = toHeadingTermMap(language);
    const sourceHeadingList = listHeadingWords(source);
    const headingList = listHeadingWords(translated);
    if (
        wordByKey.size === 0 ||
        sourceHeadingList.length === 0 ||
        headingList.length !== sourceHeadingList.length
    ) {
        return [];
    }
    return sourceHeadingList.flatMap((words, order) => {
        const word = wordByKey.get(toHeadingTermKey(words));
        const written = toHeadingText(headingList[order]);
        if (
            word === undefined ||
            written === '' ||
            checkHasStudyTerm(toTermFindableText(written), word, language)
        ) {
            return [];
        }
        return [
            {
                english: toHeadingText(words),
                word: toHeadingWord(word, language.code),
                written,
            },
        ];
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

// The share of a part's letters its language's own script must have, a
// name or a number left in Latin aside.
const STUDY_SCRIPT_SHARE = 0.4;

/**
 * Whether some of a study's words hold a letter to translate: one outside a
 * code span, a link's address, a `[^…]` token, a tag or a web address.
 */
function checkHasStudyWords(text: string) {
    return /\p{L}/u.test(text.replace(KEPT_LATIN_PATTERN, ' '));
}

/**
 * Whether some of a study's words are in the language already, or hold
 * nothing to translate (2026-11-13, EC-589). Found on the user's Genesis 4
 * study, written in Khmer, after _change all to khmer_ had left its
 * dialogue's boxes English: asked again, every part went to the translator,
 * a part in Khmer came back as it was -- which is no translation
 * (`checkIsStudyTextTranslated`) -- twice, and the job stopped with nothing
 * drafted, so a study left partly English could never be finished by asking
 * again. Into a language with a script of its own, words are in it when
 * every letter is that script's, but for a single Latin letter (a list's
 * mark) and one word set apart as a term (_agape_): a name or a Bible's key
 * in Latin letters is English left, which such a language writes in its
 * own. Into one written in Latin letters, words cannot be told from English
 * so: they go to the translator, which may give them back.
 */
export function checkIsStudyTextInLanguage(
    text: string,
    language: Pick<StudyTranslateLanguageType, 'scriptPattern'>,
) {
    if (!checkHasStudyWords(text)) {
        return true;
    }
    if (language.scriptPattern === null) {
        return false;
    }
    const words = text.replace(KEPT_LATIN_PATTERN, ' ');
    const rest = words.replace(
        LATIN_WORD_PATTERN,
        (word: string, at: number) => {
            const core = word.replace(/['’]+$/, '');
            const isTerm =
                TERM_MARK_PATTERN.test(words[at - 1] ?? '') &&
                TERM_MARK_PATTERN.test(words[at + core.length] ?? '');
            return core.length === 1 || isTerm ? ' ' : word;
        },
    );
    const scriptPattern = new RegExp(language.scriptPattern.source, 'u');
    return (rest.match(/\p{L}/gu) ?? []).every((letter) => {
        return scriptPattern.test(letter);
    });
}

/**
 * Whether a diagram's every label is in the language already
 * (`checkIsStudyTextInLanguage`): kept as it is, never asked (EC-589). A
 * sequence diagram's box drawn by its id is a label. One with no label read
 * -- a kind not known -- is asked, as is every diagram into a language
 * written in Latin letters.
 */
export function checkIsStudyDiagramInLanguage(
    block: string,
    language: Pick<StudyTranslateLanguageType, 'scriptPattern'>,
) {
    if (language.scriptPattern === null) {
        return false;
    }
    const labelList = listStudyDiagramLabels(toStudyDiagramSource(block));
    return (
        labelList.length > 0 &&
        labelList.every((label) => {
            return checkIsStudyTextInLanguage(label, language);
        })
    );
}

/**
 * Whether a passage the study quotes is in the language already, its
 * Bible's key after the reference aside (EC-589): kept as it was, never
 * quoted again from another Bible. None into a language written in Latin
 * letters, whose passages are quoted again as before.
 */
export function checkIsStudyPassageInLanguage(
    text: string,
    language: Pick<StudyTranslateLanguageType, 'scriptPattern'>,
) {
    if (language.scriptPattern === null) {
        return false;
    }
    const lines = text.split('\n').map((line) => {
        return line.replace(/^\s{0,3}>\s?/, '');
    });
    lines[0] = (lines[0] ?? '').replace(/\([^()\n]*\)\s*$/, ' ');
    return checkIsStudyTextInLanguage(lines.join('\n'), language);
}

/**
 * Whether words the translator gave back as they were are in the language
 * already, and so taken (EC-589). Into a language with a script of its own:
 * when most of their letters are its own -- they were asked for a Latin
 * name or a Bible's key among them, which the translator may keep. Into one
 * written in Latin letters: when the help window's reader names that
 * language too (`readLanguage`). The words handed back are never taken on
 * the translator's word alone: one that echoes English is what the rule is
 * for.
 */
function checkIsStudyTextGivenBack(
    text: string,
    language: StudyTranslateLanguageType,
    readLanguage: (text: string) => string | null,
) {
    if (language.scriptPattern !== null) {
        const scriptCount = countScriptLetters(text, language.scriptPattern);
        return (
            scriptCount > 0 &&
            scriptCount >= countWordLetters(text) * STUDY_SCRIPT_SHARE
        );
    }
    return (
        language.code !== '' &&
        readLanguage(text) === toPackageLangCode(language.code)
    );
}

/**
 * Whether some of a study's words came back translated: not cut to a stub
 * or run on past them, in the language's own letters where it has a script
 * of its own, and with its `[^…]` tokens and its tables still there. The
 * words handed in, given back as they were, are taken only when they are
 * in the language already (`checkIsStudyTextGivenBack`, EC-589).
 */
export function checkIsStudyTextTranslated(
    source: string,
    translated: string,
    language: StudyTranslateLanguageType,
    readLanguage: (text: string) => string | null = readStudyTextLanguage,
) {
    const from = source.trim();
    const to = translated.trim();
    if (to === '') {
        return false;
    }
    if (to === from) {
        return checkIsStudyTextGivenBack(from, language, readLanguage);
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
            countWordLetters(to) * STUDY_SCRIPT_SHARE
        );
    }
    return true;
}

/** One piece of a study's words: to translate, or kept as it is. */
export type StudyTextPieceType = { text: string; isKept: boolean };

/**
 * What the translator is asked for one part: a part of words in its
 * pieces (`pieces`; `chunks` the ones to translate, in order), or a
 * diagram's source as it is handed over (`chunks` alone).
 */
export type StudyTranslateJobType = {
    index: number;
    kind: 'text' | 'diagram';
    chunks: string[];
    pieces: StudyTextPieceType[];
};

/**
 * What of a study is in the language already, kept as it was and never
 * asked (EC-589): its paragraphs of words, and the places of its diagrams
 * and passages.
 */
export type StudyInLanguageType = {
    textCount: number;
    diagramIndexes: readonly number[];
    passageIndexes: readonly number[];
};

const NONE_IN_LANGUAGE: StudyInLanguageType = {
    textCount: 0,
    diagramIndexes: [],
    passageIndexes: [],
};

/**
 * A part's words in pieces: each paragraph in the language already, or
 * with nothing to translate (`checkIsStudyTextInLanguage`), kept as it is,
 * and the paragraphs between them in pieces of at most `maxChars` to
 * translate, as `chunkStudyText` cuts them -- all of them when none is
 * kept, as before (EC-589).
 */
function planStudyTextPieces(
    words: string,
    language: Pick<StudyTranslateLanguageType, 'scriptPattern'>,
    maxChars: number,
) {
    const pieces: StudyTextPieceType[] = [];
    let waitingList: string[] = [];
    const flush = () => {
        for (const chunk of chunkStudyText(
            waitingList.join('\n\n'),
            maxChars,
        )) {
            pieces.push({ text: chunk, isKept: false });
        }
        waitingList = [];
    };
    // Each paragraph alone: none is joined to another at a size of 0.
    for (const paragraph of chunkStudyText(words, 0)) {
        if (checkIsStudyTextInLanguage(paragraph, language)) {
            flush();
            pieces.push({ text: paragraph, isKept: true });
        } else {
            waitingList.push(paragraph);
        }
    }
    flush();
    return pieces;
}

/**
 * The translator's jobs for a study, in the order of its parts: each part
 * of words in its pieces (`planStudyTextPieces`), each diagram whose labels
 * are not all in the language with every participant drawn by its id given
 * that id as its name (`withStudySequenceNames`, EC-582) -- and what is in
 * the language already, kept and never asked (EC-589): a part whose every
 * paragraph is has no job, nor has a diagram whose every label is, and a
 * passage in it is not quoted again.
 */
export function planStudyTranslateJobs(
    plan: Pick<StudyTranslatePlanType, 'parts'>,
    language: Pick<StudyTranslateLanguageType, 'scriptPattern'>,
    maxChars: number,
) {
    let textCount = 0;
    const diagramIndexes: number[] = [];
    const passageIndexes: number[] = [];
    const jobs = plan.parts.flatMap((part, index): StudyTranslateJobType[] => {
        if (part.kind === 'text') {
            const { words } = splitEdgeLines(part.text);
            if (words.trim() === '') {
                return [];
            }
            const pieces = planStudyTextPieces(words, language, maxChars);
            // A paragraph with nothing to translate is not one in it.
            textCount += pieces.filter((piece) => {
                return piece.isKept && checkHasStudyWords(piece.text);
            }).length;
            const chunks = pieces
                .filter((piece) => {
                    return !piece.isKept;
                })
                .map((piece) => {
                    return piece.text;
                });
            return chunks.length === 0
                ? []
                : [{ index, kind: 'text', chunks, pieces }];
        }
        if (part.kind === 'diagram') {
            if (checkIsStudyDiagramInLanguage(part.text, language)) {
                diagramIndexes.push(index);
                return [];
            }
            return [
                {
                    index,
                    kind: 'diagram',
                    chunks: [
                        withStudySequenceNames(toStudyDiagramSource(part.text)),
                    ],
                    pieces: [],
                },
            ];
        }
        if (
            part.kind === 'passage' &&
            checkIsStudyPassageInLanguage(part.text, language)
        ) {
            passageIndexes.push(index);
        }
        return [];
    });
    const inLanguage: StudyInLanguageType = {
        textCount,
        diagramIndexes,
        passageIndexes,
    };
    return { jobs, inLanguage };
}

/**
 * A part's words again, its pieces in order: those kept as they were, the
 * others as translated (`translatedList`, in the order asked).
 */
export function joinStudyTextPieces(
    pieces: readonly StudyTextPieceType[],
    translatedList: readonly string[],
) {
    let at = 0;
    return pieces
        .map((piece) => {
            if (piece.isKept) {
                return piece.text;
            }
            const text = translatedList[at] ?? piece.text;
            at += 1;
            return text;
        })
        .join('\n\n');
}

/**
 * Whether a diagram came back as the same diagram with other words: its
 * first word, its line count and its arrows as they were, and a sequence
 * diagram's participants by their ids, in their order (EC-582: an id
 * written in the language on one line and not on the next draws a second
 * box). Whether it DRAWS is mermaid's to say, in the window.
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
        !/<[a-z][^>]*>/i.test(translated) &&
        listStudySequenceIds(translated).join('\n') ===
            listStudySequenceIds(source).join('\n')
    );
}

export type StudyTranslateResultType = {
    /** The translated body: title, passage, words, diagrams, no footer. */
    body: string;
    diagramCount: number;
    /**
     * Diagrams left as they were: their translation would not draw, or came
     * back with every label as it was (EC-533).
     */
    keptDiagramCount: number;
    passageCount: number;
    /** Passages left as they were: no Bible in that language read them. */
    keptPassageCount: number;
    /**
     * Paragraphs of words, diagrams and passages in the language already
     * (`planStudyTranslateJobs`, EC-589): kept as they were, never asked.
     * Absent, none.
     */
    inLanguageTextCount?: number;
    inLanguageDiagramCount?: number;
    inLanguagePassageCount?: number;
};

/** The study's own words as they were written: its parts joined again. */
export function toStudyOriginalBody(
    plan: Pick<StudyTranslatePlanType, 'parts'>,
) {
    return plan.parts
        .map((part) => {
            return part.text;
        })
        .join('\n');
}

/**
 * The plan put together again in the new language: each word part's
 * translation (`textByPart`, by the part's place), each diagram's
 * (`diagramByPart`, null when it is kept), each passage as quoted again, or
 * as it was -- and a diagram or a passage in the language already
 * (`inLanguage`, EC-589) as it was.
 */
export function assembleStudyTranslation(
    plan: StudyTranslatePlanType,
    textByPart: Map<number, string>,
    diagramByPart: Map<number, string | null>,
    inLanguage: StudyInLanguageType = NONE_IN_LANGUAGE,
): StudyTranslateResultType {
    let diagramCount = 0;
    let keptDiagramCount = 0;
    let inLanguageDiagramCount = 0;
    let passageCount = 0;
    let keptPassageCount = 0;
    let inLanguagePassageCount = 0;
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
            if (inLanguage.diagramIndexes.includes(index)) {
                inLanguageDiagramCount += 1;
                return part.text;
            }
            const translated = diagramByPart.get(index) ?? null;
            if (translated === null) {
                keptDiagramCount += 1;
                return part.text;
            }
            return translated;
        }
        if (part.kind === 'passage') {
            passageCount += 1;
            if (inLanguage.passageIndexes.includes(index)) {
                inLanguagePassageCount += 1;
                return part.text;
            }
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
        inLanguageTextCount: inLanguage.textCount,
        inLanguageDiagramCount,
        inLanguagePassageCount,
    };
}

/**
 * What a translation's language is read by: its own words, never a diagram
 * (its syntax is English), a passage or a code block -- the first 2 000
 * letters, read in about a millisecond.
 */
const STUDY_LANGUAGE_SAMPLE_CHARS = 2000;

/** The own words of some parts, as their language is read off them. */
function toTextPartsText(parts: readonly { kind: string; text: string }[]) {
    return parts
        .filter((part) => {
            return part.kind === 'text';
        })
        .map((part) => {
            return part.text;
        })
        .join('\n');
}

function toStudyTextPartsText(text: string) {
    return toTextPartsText(splitStudyForTranslation(text));
}

/**
 * How alike a translation added after the study must be written to the new
 * one, the whole of each (`measureLetterRunLikeness`), to be in its
 * language. The detector knows only the INSTALLED languages, so the words of
 * one that is not can read as one that is -- a near language's little words
 * are the same words -- and the new translation, in the language asked, is
 * the one sure sample of it. It reads what is said as much as the
 * language -- a Bible's chapter against a study of that chapter, both in
 * one language, read 0.35 to 0.55 -- so a translation of words much changed
 * since stays, the new one added after it as before. Measured 2026-11-13,
 * whole against whole: of the same chapter in two installed Bibles of one
 * language, three languages measured, 684 of 690 pairs were 0.65 or more
 * -- the rest one Bible written in another church's words against three
 * others on one chapter, 0.56 at the lowest, added after as before -- and
 * none wrote a letter the other never writes
 * (`listOftenUnwrittenLetters`); of 2 312 pairs of Bibles in two languages
 * none passed both, and of the packages' dictionaries, the same strings in
 * every language, 24 of 7 656 pairs, each two near-identical languages.
 */
const STUDY_SAME_LANGUAGE_LIKENESS = 0.65;

/**
 * The language some words are in, as the help window reads a typed line
 * (`detectTypedLanguage`), by the code it is typed by: null when the words
 * cannot say, or for a language no installed package names.
 */
function readStudyTypedLanguage(text: string) {
    const code = detectTypedLanguage(text, DEFAULT_CHAT_LANG_CODE);
    return code === null || code === OTHER_CHAT_LANG_CODE ? null : code;
}

/** `readStudyTypedLanguage`, by the code its package goes by. */
function readStudyTextLanguage(text: string) {
    const code = readStudyTypedLanguage(text);
    return code === null ? null : toPackageLangCode(code);
}

/**
 * The language a translation's parts are written in, read off their own
 * words as `findStudyTranslationsInLanguage` reads one, by the code it is
 * typed by (EC-596): null when they cannot say.
 */
export function readStudyPartsLanguage(
    parts: readonly { kind: string; text: string }[],
) {
    return readStudyTypedLanguage(
        toTextPartsText(parts).slice(0, STUDY_LANGUAGE_SAMPLE_CHARS),
    );
}

/**
 * The places, among the translations added after a study (`translations`,
 * `listStudyTranslations`), of those written in `language` (2026-11-13,
 * EC-547): a study translated again into a language it holds had had the
 * new translation added after the old one, two of it in the file. Only a
 * language the words can be read as -- none for a language with no code or
 * no package here -- and only words written much like `translated`, the new
 * translation (`STUDY_SAME_LANGUAGE_LIKENESS`): a translation in a language
 * not installed is never taken for one that is and dropped.
 */
export function findStudyTranslationsInLanguage(
    translations: string,
    language: StudyTranslateLanguageType,
    translated: string,
    readLanguage: (text: string) => string | null = readStudyTextLanguage,
) {
    if (language.code === '' || translations.trim() === '') {
        return [];
    }
    const code = toPackageLangCode(language.code);
    // The new translation is counted once, and only when a piece reads as
    // its language: a language the study does not hold yet costs nothing.
    let translatedCounts: {
        runMap: Map<string, number>;
        letterMap: Map<string, number>;
    } | null = null;
    return listStudyTranslations(translations).flatMap((piece, index) => {
        const pieceText = toStudyTextPartsText(piece);
        if (
            readLanguage(pieceText.slice(0, STUDY_LANGUAGE_SAMPLE_CHARS)) !==
            code
        ) {
            return [];
        }
        if (translatedCounts === null) {
            const translatedText = toStudyTextPartsText(translated);
            translatedCounts = {
                runMap: countLetterRuns(translatedText),
                letterMap: countLetters(translatedText),
            };
        }
        const isAlike =
            measureLetterRunLikeness(
                countLetterRuns(pieceText),
                translatedCounts.runMap,
            ) >= STUDY_SAME_LANGUAGE_LIKENESS &&
            listOftenUnwrittenLetters(
                countLetters(pieceText),
                translatedCounts.letterMap,
            ).length === 0;
        return isAlike ? [index] : [];
    });
}

/**
 * The translations added after a study with those at `taken` out, the new
 * one in the first's place: its rule and the blank lines after it, and the
 * blank lines under it, as they were.
 */
function toTranslationsWithNew(
    translations: string,
    taken: readonly number[],
    translated: string,
) {
    return listStudyTranslations(translations)
        .flatMap((piece, index) => {
            if (index !== taken[0]) {
                return taken.includes(index) ? [] : [piece];
            }
            const lines = piece.split('\n');
            const titleIndex = lines.findIndex((line) => {
                return /^#\s+\S/.test(line);
            });
            const head = lines.slice(0, Math.max(titleIndex, 1)).join('\n');
            return [`${head}\n${translated}${splitEdgeLines(piece).trail}`];
        })
        .join('\n');
}

/**
 * The `draft` call that holds the translation, for the place asked: added
 * after the file, in place of its words, or a copy of its own -- a copy is
 * drafted like a new study (`ref` off the file's name, the translated title,
 * the words under the passage), so the app quotes its passage from `bible`.
 * `taken` are the places of the translations already in that language
 * (`findStudyTranslationsInLanguage`, EC-547): added after the file, the
 * translation goes in the first one's place and the others go; in place of
 * the study's words, they all go, those words being in that language now.
 */
export function toStudyTranslateDraftArgs(
    plan: StudyTranslatePlanType,
    body: string,
    place: StudyTranslatePlaceType,
    language: StudyTranslateLanguageType,
    taken: readonly number[] = [],
): Record<string, string> | { reason: string } {
    const trimmed = body.trim();
    if (place === 'append' && taken.length === 0) {
        return {
            action: 'draft',
            file: plan.file,
            append: `---\n\n${trimmed}`,
            ...(plan.bible === null ? {} : { bible: plan.bible }),
        };
    }
    if (place === 'append') {
        // The study as it was written, every other translation as it was.
        const original = toStudyOriginalBody(plan);
        const translations = toTranslationsWithNew(
            plan.translations,
            taken,
            trimmed,
        ).trimEnd();
        return {
            action: 'draft',
            file: plan.file,
            content: `${original}\n${translations}\n${plan.footer}`,
            ...(plan.bible === null ? {} : { bible: plan.bible }),
        };
    }
    if (place === 'replace') {
        // In place of the study's own words: the translations added after
        // it stay where they were, but for those in that language.
        const translations = (
            taken.length === 0
                ? plan.translations
                : listStudyTranslations(plan.translations)
                      .filter((_piece, index) => {
                          return !taken.includes(index);
                      })
                      .join('\n')
        ).trim();
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

/**
 * What of a study was in the language already (EC-589), as the model is
 * told it: "12 paragraph(s) of its words and 3 diagram(s)", or '' for
 * nothing.
 */
function listStudyInLanguageParts(result: StudyTranslateResultType) {
    const itemList = (
        [
            [result.inLanguageTextCount ?? 0, 'paragraph(s) of its words'],
            [result.inLanguageDiagramCount ?? 0, 'diagram(s)'],
            [result.inLanguagePassageCount ?? 0, 'Bible passage(s)'],
        ] as const
    ).flatMap(([count, what]) => {
        return count > 0 ? [`${count} ${what}`] : [];
    });
    return itemList.length <= 1
        ? itemList.join('')
        : `${itemList.slice(0, -1).join(', ')} and ${itemList.at(-1)}`;
}

/**
 * What the model is told the window did, in place of the plan. `takenCount`
 * translations already in that language go (EC-547), and what was in that
 * language already is said kept as it was (EC-589).
 */
export function describeStudyTranslation(
    plan: StudyTranslatePlanType,
    result: StudyTranslateResultType,
    language: StudyTranslateLanguageType,
    place: StudyTranslatePlaceType,
    translatorName: string,
    takenCount = 0,
) {
    const taken =
        place === 'new' || takenCount === 0
            ? ''
            : takenCount === 1
              ? `its translation into ${language.name} already added after it`
              : `its ${takenCount} translations into ${language.name} ` +
                'already added after it';
    const inLanguageText = listStudyInLanguageParts(result);
    const sentences = [
        'The window translated ' +
            (inLanguageText === ''
                ? `${plan.name} into ${language.name}`
                : `what of ${plan.name} was not in ${language.name} yet`) +
            ` part by part with ${translatorName}` +
            (place === 'append'
                ? taken === ''
                    ? ', to be added after the file as it is'
                    : `, in place of ${taken}: never a second one`
                : place === 'replace'
                  ? ', in place of its words'
                  : ', as a copy of its own') +
            '.',
    ];
    if (place === 'replace' && taken !== '') {
        sentences.push(
            `Those words being in ${language.name} now, ${taken} ` +
                (takenCount === 1 ? 'is' : 'are') +
                ' taken out.',
        );
    }
    if (inLanguageText !== '') {
        sentences.push(
            `${inLanguageText} were in ${language.name} already, so are ` +
                'kept as they were.',
        );
    }
    const askedDiagramCount =
        result.diagramCount - (result.inLanguageDiagramCount ?? 0);
    if (askedDiagramCount > 0) {
        const translatedCount = askedDiagramCount - result.keptDiagramCount;
        sentences.push(
            result.keptDiagramCount === 0 &&
                askedDiagramCount === result.diagramCount
                ? `Its ${result.diagramCount} diagram(s) are translated.`
                : `${translatedCount} of its ${result.diagramCount} ` +
                      'diagrams are translated' +
                      (result.keptDiagramCount === 0
                          ? '.'
                          : `; ${result.keptDiagramCount} kept as they ` +
                            'were, since their translation would not draw ' +
                            'or left their words untranslated.'),
        );
    }
    if (plan.translations.trim() !== '') {
        const otherCount =
            taken === ''
                ? 1
                : listStudyTranslations(plan.translations).length - takenCount;
        sentences.push(
            'Only the study as it was written was translated' +
                (otherCount <= 0
                    ? '.'
                    : taken === ''
                      ? ': the translations already added after it are ' +
                        'kept as they are.'
                      : ': the other translations added after it are kept ' +
                        'as they are.'),
        );
    }
    const askedPassageCount =
        result.passageCount - (result.inLanguagePassageCount ?? 0);
    if (askedPassageCount > 0) {
        const other = askedPassageCount < result.passageCount ? 'other ' : '';
        sentences.push(
            result.keptPassageCount === 0
                ? `Its ${other}Bible passages are quoted from ${plan.bible}.`
                : plan.bible === null
                  ? `No ${language.name} Bible is installed, so its ` +
                    `${other}Bible passages are quoted as they were.`
                  : `${result.keptPassageCount} Bible passage(s) could not ` +
                    `be read in ${plan.bible} and are quoted as they were.`,
        );
    }
    return sentences.join(' ');
}

/**
 * What the model is told when the translation came out as the study was
 * (EC-589): every part in the language already -- a study written in it,
 * asked again -- or what is not could not be translated. Nothing is
 * drafted: added after the file, its copy would be the study again.
 */
export function describeStudyNothingTranslated(
    plan: StudyTranslatePlanType,
    result: StudyTranslateResultType,
    language: StudyTranslateLanguageType,
) {
    const leftList: string[] = [];
    if (result.keptDiagramCount > 0) {
        leftList.push(
            `${result.keptDiagramCount} diagram(s), whose translation would ` +
                'not draw or left their words untranslated',
        );
    }
    if (result.keptPassageCount > 0) {
        leftList.push(
            plan.bible === null
                ? `${result.keptPassageCount} Bible passage(s), with no ` +
                      `${language.name} Bible installed to quote them`
                : `${result.keptPassageCount} Bible passage(s) ` +
                      `${plan.bible} could not quote`,
        );
    }
    if (leftList.length === 0) {
        return (
            `Nothing was translated: every part of ${plan.name} is in ` +
            `${language.name} already, so nothing was drafted. Tell them so ` +
            'in a sentence -- never that it was translated or changed.'
        );
    }
    return (
        `Nothing was translated: of ${plan.name}, what is not in ` +
        `${language.name} yet -- ${leftList.join('; ')} -- is kept as it ` +
        `was, and the rest is in ${language.name} already. Nothing was ` +
        'drafted. Tell them so in a sentence and offer to try again -- ' +
        'never that it was translated or changed.'
    );
}

/**
 * What the model is told when a translation is to be added after a study
 * whose words are all in that language already (EC-589): it would be the
 * study again, so nothing is drafted, and the person is offered the parts
 * not in it yet put into it in their place.
 */
export function genStudyAppendInLanguageRefusal(
    plan: StudyTranslatePlanType,
    language: StudyTranslateLanguageType,
) {
    return (
        `Tool refused: The words of ${plan.name} are in ${language.name} ` +
        'already, so a translation added after it would be the study ' +
        'again. Nothing was drafted. Tell them so in a sentence, and offer ' +
        `to put what is not in ${language.name} yet into it in its place ` +
        '(place "replace").'
    );
}
