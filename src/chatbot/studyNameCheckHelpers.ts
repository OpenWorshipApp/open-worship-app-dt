/**
 * The words a SAVED study's translation writes otherwise than the Bible it
 * quotes (2026-11-12, EC-536).
 *
 * The user's own John 3 study, its Khmer half translated by the window on
 * 2026-11-10 -- before EC-535 -- writes Aenon, Salim and the Pharisees each
 * with another vowel sign than the Khmer Bible it quotes a page above them.
 * EC-535 keeps a NEW translation from it; a saved one stays as it was
 * written, and asked to check or correct the file, the model reads it by
 * itself, where a vowel sign is the one difference it cannot see. This
 * reads a saved file the way a translation job reads its parts: the names
 * the English half's passages give in a verse or two (`toStudyNameGuide`),
 * the same verses as each translation under it quotes them, and every word
 * of those verses that translation's own words write with the vowel signs
 * of one letter otherwise (`listStudyNameSlips`) -- never in a passage it
 * quotes, a code block or a rule.
 *
 * Pure and read off the file: no call, nothing kept, and no church word --
 * a name the language's church words write otherwise is found by its verse
 * all the same. Measured on that study, read only: its three such words in
 * all five places they are written, nothing else, in 21 ms. A study with no
 * translation under it, or none quoting a passage the English half quotes,
 * has nothing to say.
 */
import {
    STUDY_MAX_REPLACES,
    STUDY_REPLACE_MAX_CHARS,
    type StudyReplacedType,
    type StudyReplaceType,
    type StudyTranslatePartType,
    applyStudyReplace,
    checkIsStudyReplaceWords,
    listStudyTranslations,
    splitStudyFooter,
    splitStudyForTranslation,
    splitStudyTranslations,
    toStudyReplaceList,
} from '../helper/agentStudyFileRules';
import {
    countStudyWordPlaces,
    findStudyWordVariants,
    listStudyNameSlips,
    readStudyQuoteVerses,
    toStudyNameGuide,
} from './studyNameHelpers';

// Translations read under one study, at most: a file holds a few.
const STUDY_NAME_CHECK_MAX_TRANSLATIONS = 6;
const TITLE_PATTERN = /^#\s+(\S.*)$/m;

export type StudyNameCheckSlipType = {
    /** The word as the translation writes it. */
    written: string;
    /** The word as the verse quoted writes it. */
    spelling: string;
    /** The verse, by its number in its passage. */
    key: string;
    /** How many times the translation's own words write it. */
    count: number;
};

/**
 * Words a translation left as no reader of its language writes them
 * (EC-559, `studyTranslationCheckHelpers.ts`).
 */
export type StudyLeftWordsType = {
    /** The words as the translation writes them: a replace's `from`. */
    written: string;
    /** How many times its own words write them. */
    count: number;
    /** The heading of the part they first stand in, or ''. */
    section: string;
    /** The letters round them there, for a letter of another script. */
    context?: string;
};

/**
 * A name its own words write with other letters than the verse giving it
 * (EC-560, `studyTranslationCheckHelpers.ts`).
 */
export type StudyNameOtherLettersType = StudyLeftWordsType & {
    /** The name as the English half writes it. */
    name: string;
    /** The word of that verse it comes closest to, as the verse writes it. */
    spelling: string;
    /** That verse, by its number in its passage. */
    key: string;
};

/**
 * A heading of a translation whose English heading is a church word of its
 * language, which it does not write (EC-596,
 * `studyTranslationCheckHelpers.ts`).
 */
export type StudyTermHeadingType = StudyLeftWordsType & {
    /** The English half's heading in its place. */
    english: string;
    /** The word its language writes for it, as a heading starts it. */
    word: string;
};

/**
 * A church word of the translation's language the English half uses, which
 * the translation never writes (EC-596, `studyTranslationCheckHelpers.ts`).
 */
export type StudyMissingTermType = {
    /** The word as the English half writes it. */
    english: string;
    /** As the language's Bible writes it. */
    word: string;
    /** How many times the English half's words use it. */
    count: number;
    /**
     * The heading of the translation's part where the English half first
     * uses it, or ''.
     */
    section: string;
    /** The translation's lines where the English half uses it, at most 3. */
    lines?: string[];
};

export type StudyNameCheckType = {
    /** The translation's title: its first heading. */
    title: string;
    /** The passages it quotes, as it names them, each with its Bible. */
    passages: string[];
    slips: StudyNameCheckSlipType[];
    /** Names written with other letters than their verse. */
    otherLetterNames?: StudyNameOtherLettersType[];
    /** Words with a letter of a script neither its own nor the English's. */
    otherScriptWords?: StudyLeftWordsType[];
    /** English words left between two of its own script's letters. */
    englishWords?: StudyLeftWordsType[];
    /** A diagram's labels left in English. */
    englishLabels?: StudyLeftWordsType[];
    /** Headings that are a church word of its language written otherwise. */
    termHeadings?: StudyTermHeadingType[];
    /** Church words of its language it never writes. */
    missingTerms?: StudyMissingTermType[];
};

/** A part list's own words and diagrams, as one text. */
export function toWordsText(parts: readonly StudyTranslatePartType[]) {
    return parts
        .filter((part) => {
            return part.kind === 'text' || part.kind === 'diagram';
        })
        .map((part) => {
            return part.text;
        })
        .join('\n\n');
}

function toVerseKeyText(text: string) {
    return [...readStudyQuoteVerses(text).keys()].join(' ');
}

/**
 * The English half's passages, by their place among its passages, each with
 * the translation's passage quoting the same verses: in their order when
 * both quote as many, else by the verses each holds -- and never one quoted
 * from the same Bible, as a translation into a language with no Bible of
 * its own quotes the English again.
 */
export function pairStudyQuotedPassages(
    englishList: readonly StudyTranslatePartType[],
    translatedList: readonly StudyTranslatePartType[],
) {
    const quotedMap = new Map<number, StudyTranslatePartType>();
    if (englishList.length === translatedList.length) {
        translatedList.forEach((translated, index) => {
            if (translated.bibleKey !== englishList[index].bibleKey) {
                quotedMap.set(index, translated);
            }
        });
        return quotedMap;
    }
    for (const translated of translatedList) {
        const keyText = toVerseKeyText(translated.text);
        const index = englishList.findIndex((english, englishIndex) => {
            return (
                keyText !== '' &&
                !quotedMap.has(englishIndex) &&
                english.bibleKey !== translated.bibleKey &&
                toVerseKeyText(english.text) === keyText
            );
        });
        if (index >= 0) {
            quotedMap.set(index, translated);
        }
    }
    return quotedMap;
}

/** One translation under a saved study, as `readSavedStudyTranslations` reads it. */
export type SavedStudyTranslationType = {
    /** Its text, from the rule above its title. */
    text: string;
    title: string;
    parts: StudyTranslatePartType[];
};

/**
 * A saved study's English half in its parts and each translation under it,
 * six at most; null when there is none.
 */
export function readSavedStudyTranslations(text: string) {
    const { body } = splitStudyFooter(
        String(text ?? '').replace(/\r\n?/g, '\n'),
    );
    const { original, translations } = splitStudyTranslations(body);
    if (translations.trim() === '') {
        return null;
    }
    return {
        englishParts: splitStudyForTranslation(original),
        translations: listStudyTranslations(
            translations,
            STUDY_NAME_CHECK_MAX_TRANSLATIONS,
        ).map((translation): SavedStudyTranslationType => {
            return {
                text: translation,
                title: TITLE_PATTERN.exec(translation)?.[1].trim() ?? '',
                parts: splitStudyForTranslation(translation),
            };
        }),
    };
}

/**
 * The passages a translation quotes the English half's in, each with its
 * Bible, and the words of their verses its own words write otherwise (see
 * the top); null when it quotes none of them.
 */
export function readStudyTranslationNameSlips(
    englishParts: readonly StudyTranslatePartType[],
    parts: readonly StudyTranslatePartType[],
) {
    const englishPassages = englishParts.filter((part) => {
        return part.kind === 'passage';
    });
    if (englishPassages.length === 0) {
        return null;
    }
    const quotedMap = pairStudyQuotedPassages(
        englishPassages,
        parts.filter((part) => {
            return part.kind === 'passage';
        }),
    );
    if (quotedMap.size === 0) {
        return null;
    }
    let passageIndex = -1;
    const guide = toStudyNameGuide(
        englishParts.map((part) => {
            if (part.kind !== 'passage') {
                return part;
            }
            passageIndex += 1;
            return {
                ...part,
                quoted: quotedMap.get(passageIndex)?.text ?? null,
            };
        }),
        {},
        // A name written with other letters is read by the places a
        // replace takes (`listStudyNameOtherLetters`, EC-560), not here.
        false,
    );
    const words = toWordsText(parts);
    const slips = listStudyNameSlips(
        toWordsText(englishParts),
        words,
        guide,
    ).map((slip) => {
        return {
            ...slip,
            count: Math.max(1, countStudyWordPlaces(words, slip.written)),
        };
    });
    return {
        passages: [...quotedMap.values()].map((part) => {
            return `${part.title ?? ''} (${part.bibleKey ?? ''})`;
        }),
        slips,
    };
}

/**
 * Every translation under a saved study that writes a word of a verse it
 * quotes otherwise than that verse does (see the top), eight words a
 * translation at most; empty when none does.
 */
export function listSavedStudyNameSlips(text: string): StudyNameCheckType[] {
    const saved = readSavedStudyTranslations(text);
    if (saved === null) {
        return [];
    }
    return saved.translations.flatMap((translation) => {
        const named = readStudyTranslationNameSlips(
            saved.englishParts,
            translation.parts,
        );
        return named === null || named.slips.length === 0
            ? []
            : [{ title: translation.title, ...named }];
    });
}

const STUDY_NAME_CHECK_INTRO =
    'The app read each translation under it letter by letter: against the ' +
    'Bible it quotes, and for words its own language does not write.';

// What each kind of word found is, said once above its list.
const STUDY_SLIPS_LEAD =
    'Words of its verses -- the names the passages give, and the rest -- ' +
    'its own words write with the vowel signs of one letter otherwise ' +
    'than that Bible writes them, a difference too small to see in the ' +
    'file:';
const STUDY_OTHER_LETTERS_LEAD =
    'Names the passages give, which its own words write with other ' +
    'letters than the verse giving them, each beside the word of that ' +
    'verse its letters come closest to -- if that word is not the name, ' +
    'say so and leave it:';
const STUDY_OTHER_SCRIPT_LEAD =
    'Letters of another script than its own, which no reader of its ' +
    'language reads:';
const STUDY_ENGLISH_WORDS_LEAD = 'English words left between its own:';
const STUDY_ENGLISH_LABELS_LEAD = "Its diagrams' labels left in English:";
const STUDY_TERM_HEADINGS_LEAD =
    'Headings that are a church word of its language, which it heads ' +
    "otherwise -- each with the English half's heading in its place and " +
    'the word its language writes for it:';
const STUDY_MISSING_TERMS_LEAD =
    'Church words the English half uses, which it never writes as its ' +
    "language's Bible does -- each with the Bible's word and its lines " +
    'where the English half uses it, to see how it says it there:';

const STUDY_NAME_CHECK_RULES =
    'When they ask to check, correct or proofread the study or its ' +
    'translation, or ask about one of these words, say each: how it is ' +
    'written, how many times, and how it should be -- a word of a verse as ' +
    'the verse writes it, a heading or a church word as the word given, ' +
    'the others in the language of the translation. A name is written as ' +
    'the Bible quoted writes it; two real words can be a vowel sign apart, ' +
    'so a word that is no name may be right as written -- say so rather ' +
    'than call it wrong. A church word said another way may be right as ' +
    'well: say how its lines say it, and offer the word given, the one ' +
    'its Bible writes. Offer to put them right, as an OPTION, and change ' +
    'the file only when they ask: owa_resource_file `draft` with `file`, ' +
    "`section` naming the translation's title and `replace` -- each word " +
    'as written here, or as its line writes it, `from`, and `to` as its ' +
    'verse writes it, the word given or in the language of the ' +
    'translation -- which they save; the section keeps the English half, ' +
    'which may write the same English words, as it is. With five or more ' +
    'to put right, offer too to translate the study into that language ' +
    'again (owa_resource_file `translate` with `place` `append`): the ' +
    'window writes a new translation, held to these checks, in place of ' +
    'this one. Asked something else, answer it, and if no answer in this ' +
    'conversation has said so yet, end with ONE short line saying the app ' +
    'found these words and offering to show them.';

function toTimesText(count: number) {
    return count === 1 ? 'once' : `${count} times`;
}

/** One line for words a translation left: how often, where, and round it. */
function toLeftWordsLine(left: StudyLeftWordsType) {
    const place = left.section === '' ? '' : ` in “${left.section}”`;
    const context =
        left.context === undefined ? '' : `, as in “${left.context}”`;
    return (
        `- "${left.written}", written ${toTimesText(left.count)}` +
        `${place}${context}.`
    );
}

/** One line for a name written with other letters: how often, where, its verse. */
function toOtherLettersLine(named: StudyNameOtherLettersType) {
    const place = named.section === '' ? '' : ` in “${named.section}”`;
    return (
        `- ${named.name}: "${named.written}", written ` +
        `${toTimesText(named.count)}${place}; verse ${named.key} writes ` +
        `"${named.spelling}".`
    );
}

/** One line for a heading that is a church word: its English, the word. */
function toTermHeadingLine(heading: StudyTermHeadingType) {
    return (
        `- "${heading.written}", written ${toTimesText(heading.count)}: ` +
        `the heading of “${heading.english}”, which its language writes ` +
        `"${heading.word}".`
    );
}

/** One line for a church word never written: its Bible's word, its lines. */
function toMissingTermLine(term: StudyMissingTermType) {
    const place = term.section === '' ? '' : `, first in “${term.section}”`;
    const lines = (term.lines ?? []).map((line) => {
        return `“${line}”`;
    });
    return (
        `- ${term.english}: its Bible writes "${term.word}"; the English ` +
        `half uses it ${toTimesText(term.count)}${place}` +
        (lines.length === 0 ? '.' : `, in: ${lines.join('; ')}.`)
    );
}

/** One translation's lists, from a blank line and its title on. */
function toStudyCheckLines(check: StudyNameCheckType) {
    const title = check.title === '' ? '' : ` "${check.title}"`;
    const quoting =
        check.passages.length === 0
            ? ''
            : `, quoting ${check.passages.join('; ')}`;
    const lines = ['', `The translation${title}${quoting}:`];
    if (check.slips.length > 0) {
        lines.push(STUDY_SLIPS_LEAD);
    }
    for (const slip of check.slips) {
        lines.push(
            `- "${slip.written}", written ${toTimesText(slip.count)}: ` +
                `verse ${slip.key} writes "${slip.spelling}".`,
        );
    }
    const otherLetterNames = check.otherLetterNames ?? [];
    if (otherLetterNames.length > 0) {
        lines.push(
            STUDY_OTHER_LETTERS_LEAD,
            ...otherLetterNames.map(toOtherLettersLine),
        );
    }
    const leftLists: [string, StudyLeftWordsType[] | undefined][] = [
        [STUDY_OTHER_SCRIPT_LEAD, check.otherScriptWords],
        [STUDY_ENGLISH_WORDS_LEAD, check.englishWords],
        [STUDY_ENGLISH_LABELS_LEAD, check.englishLabels],
    ];
    for (const [lead, leftList] of leftLists) {
        if (leftList !== undefined && leftList.length > 0) {
            lines.push(lead, ...leftList.map(toLeftWordsLine));
        }
    }
    const termHeadings = check.termHeadings ?? [];
    if (termHeadings.length > 0) {
        lines.push(
            STUDY_TERM_HEADINGS_LEAD,
            ...termHeadings.map(toTermHeadingLine),
        );
    }
    const missingTerms = check.missingTerms ?? [];
    if (missingTerms.length > 0) {
        lines.push(
            STUDY_MISSING_TERMS_LEAD,
            ...missingTerms.map(toMissingTermLine),
        );
    }
    return lines;
}

/**
 * What a question about a study file carries when its translation writes
 * such words: each translation's, with the verse writing each otherwise --
 * and, read by `listSavedStudyTranslationChecks`, its names written with
 * other letters (EC-560), its letters of another script and its English
 * left (EC-559), and by `readSavedStudyTranslationChecks` its headings and
 * church words its language writes otherwise (EC-596). Null when there are
 * none -- most files, and nothing is said of them.
 */
export function toStudyNameCheckText(
    checkList: readonly StudyNameCheckType[],
    fileName: string,
) {
    if (checkList.length === 0) {
        return null;
    }
    return [
        `(About the study file "${fileName}". ${STUDY_NAME_CHECK_INTRO}`,
        ...checkList.flatMap(toStudyCheckLines),
        '',
        `${STUDY_NAME_CHECK_RULES})`,
    ].join('\n');
}

// --- what a translation just drafted still leaves (2026-11-13, EC-600) ------
//
// The window's translate job asks its translator about a part's slips once
// more and keeps the answer with fewer, never stopping the job: a part may
// keep an English word, a letter of another script or a church word
// written otherwise, and the model was told only that the study was
// translated -- the person saved it and found it partly English. Before
// they save, the new translation is read as the check above reads a saved
// one, and the model is told what is left. It is put right in the same
// ask: a `replace` naming the file is drafted onto the change the card
// holds (`chainStudyPartEdit`) -- or, for a copy of its own, onto the new
// study the card holds (`chainHeldNewStudyEdit`, EC-604) -- while an
// option pressed later is a new ask, which holds neither. What may be
// right as written -- a word a vowel sign from its verse, a name or a
// church word said another way -- is only said.

const STUDY_TRANSLATION_LEFT_INTRO =
    'What it still leaves -- the app read the new translation as it reads ' +
    'a saved one, after the translator was asked about each part twice:';

/**
 * The draft a translation's slips are put right in: the file the card
 * holds a change of, or the name of the new study it holds (`isNew`).
 */
export type StudyTranslationLeftTargetType = { file: string; isNew: boolean };

/**
 * What the model is told a translation the window drafted still leaves
 * (see above), with the ONE call that puts its slips right on what the
 * card holds -- a change of the file, kept to the translation's part by
 * `section`, or the new study, which is all translation. Null with
 * nothing left.
 */
export function toStudyTranslationLeftText(
    checkList: readonly StudyNameCheckType[],
    languageName: string,
    target: StudyTranslationLeftTargetType,
) {
    if (checkList.length === 0) {
        return null;
    }
    const place = target.isNew
        ? `\`file\` "${target.file}" -- the new study the card holds --`
        : `\`file\` "${target.file}", \`section\` naming the translation's ` +
          'title -- never left out: it keeps the rest of the file as it is --';
    const rules = [
        'Put right now, in ONE call before you answer, the English words, ' +
            "the diagrams' labels, the letters of another script and the " +
            `headings listed: owa_resource_file \`draft\` with ${place} and ` +
            '`replace`, each as written here `from`, and `to` in ' +
            `${languageName}, a heading as the word given. The card then ` +
            `holds the ${target.isNew ? 'new study' : 'translation'} with ` +
            'them put right, nothing else of it changed.',
        'Leave the rest as written -- a word a vowel sign from its verse, ' +
            'a name or a church word said another way may be right -- and ' +
            'say each: as written, and as its verse or its Bible writes it.',
        'Then say in a sentence what you put right and what is left, never ' +
            `that every word is in ${languageName}: what is left can be put ` +
            'right by asking once it is saved.',
    ];
    return [
        `(${STUDY_TRANSLATION_LEFT_INTRO}`,
        ...checkList.flatMap(toStudyCheckLines),
        '',
        `${rules.join(' ')})`,
    ].join('\n');
}

// --- a replace put right (2026-11-12, EC-541) --------------------------------
//
// The check above hands a model each word with its verse's spelling, and
// `replace` (EC-537) writes the word anew. But the two spellings are a vowel
// sign apart -- the one difference a model cannot see -- so it may send the
// verse's spelling as `from`, the pair turned round, or `from` and `to`
// alike, and a refusal saying to copy the file letter for letter is one it
// cannot act on. The app found those words itself: a pair that would be
// refused and names one of them -- as the file writes it, as the verse
// does, or with another vowel sign -- is written from the file's spelling
// to the verse's, and the answer says so.

export type StudyReplaceRepairType = {
    /** The pair's place in the call, from 1. */
    pair: number;
    asked: StudyReplaceType;
    written: StudyReplaceType;
};

type StudySlipSpellingType = { written: string; spelling: string };

/**
 * Each word a translation under the study writes otherwise than the verse
 * it quotes, once; a word two verses spell otherwise is left out, as which
 * one was meant cannot be told.
 */
function listStudySlipSpellings(text: string): StudySlipSpellingType[] {
    const spellingMap = new Map<string, string | null>();
    for (const check of listSavedStudyNameSlips(text)) {
        for (const { written, spelling } of check.slips) {
            const known = spellingMap.get(written);
            spellingMap.set(
                written,
                known === undefined || known === spelling ? spelling : null,
            );
        }
    }
    return [...spellingMap].flatMap(([written, spelling]) => {
        return spelling === null ? [] : [{ written, spelling }];
    });
}

/**
 * Some words with each place that writes a slip's word -- as the file
 * writes it, as the verse does, or with the vowel signs of one letter
 * otherwise -- written as `toWord` gives it: only words a replace could
 * write over, the nearest spelling first, a place two words claim alike
 * left as it is.
 */
function rewriteSlipWords(
    text: string,
    slips: readonly StudySlipSpellingType[],
    toWord: (slip: StudySlipSpellingType) => string,
) {
    const places = slips
        .flatMap((slip) => {
            return findStudyWordVariants(text, slip.written)
                .filter(({ start, end }) => {
                    return checkIsStudyReplaceWords(text, start, end);
                })
                .map((place) => {
                    return { ...place, word: toWord(slip) };
                });
        })
        .sort((a, b) => {
            return a.start - b.start || a.changed - b.changed || b.end - a.end;
        });
    let written = '';
    let cursor = 0;
    for (const place of places) {
        const isClaimedAlike = places.some((other) => {
            return (
                other.start === place.start &&
                other.end === place.end &&
                other.changed === place.changed &&
                other.word !== place.word
            );
        });
        if (place.start < cursor || isClaimedAlike) {
            continue;
        }
        written += text.slice(cursor, place.start) + place.word;
        cursor = place.end;
    }
    return written + text.slice(cursor);
}

/** A `replace` as sent, when every pair is some words on one line. */
function toWordPairs(value: unknown): StudyReplaceType[] | null {
    if (
        !Array.isArray(value) ||
        value.length === 0 ||
        value.length > STUDY_MAX_REPLACES
    ) {
        return null;
    }
    const pairs: StudyReplaceType[] = [];
    for (const item of value) {
        const from = typeof item?.from === 'string' ? item.from : '';
        const to = typeof item?.to === 'string' ? item.to : null;
        if (
            from.trim() === '' ||
            to === null ||
            /[\r\n]/.test(from + to) ||
            from.length > STUDY_REPLACE_MAX_CHARS ||
            to.length > STUDY_REPLACE_MAX_CHARS
        ) {
            return null;
        }
        pairs.push({ from, to });
    }
    return pairs;
}

/**
 * The pairs put right where the study's own check names their words (see
 * above): each pair refused alone -- its `from` its own `to`, or nowhere a
 * replace writes -- with a slip's word in `from` written as the file writes
 * it and in `to` as its verse does, the same pair twice made once. Null
 * when no pair changes, or the pairs put right are still refused.
 */
function repairStudyReplace(text: string, value: unknown, section: string) {
    const pairs = toWordPairs(value);
    const slips = pairs === null ? [] : listStudySlipSpellings(text);
    if (pairs === null || slips.length === 0) {
        return null;
    }
    const repaired: StudyReplaceRepairType[] = [];
    const list: StudyReplaceType[] = [];
    pairs.forEach((pair, index) => {
        const isRefused =
            pair.from === pair.to ||
            'reason' in applyStudyReplace(text, [pair], section);
        const written = isRefused
            ? {
                  from: rewriteSlipWords(pair.from, slips, (slip) => {
                      return slip.written;
                  }),
                  to: rewriteSlipWords(pair.to, slips, (slip) => {
                      return slip.spelling;
                  }),
              }
            : pair;
        if (written.from !== pair.from || written.to !== pair.to) {
            repaired.push({ pair: index + 1, asked: pair, written });
        }
        const isListed = list.some(({ from, to }) => {
            return from === written.from && to === written.to;
        });
        if (!isListed) {
            list.push(written);
        }
    });
    const checked = toStudyReplaceList(list);
    if (repaired.length === 0 || 'reason' in checked) {
        return null;
    }
    const edited = applyStudyReplace(text, checked.list, section);
    return 'reason' in edited ? null : { ...edited, repaired };
}

/**
 * `replace` checked and written into a study's text, as the tool's worker
 * and the window's chain write it (`toStudyReplaceList`,
 * `applyStudyReplace`): a call that would be refused is tried once more
 * with its pairs put right where the study's own check names their words
 * (EC-541), else refused as it was.
 */
export function applyStudyReplaceChecked(
    text: string,
    value: unknown,
    section = '',
):
    | {
          text: string;
          replaced: StudyReplacedType[];
          repaired: StudyReplaceRepairType[];
      }
    | { reason: string } {
    const list = toStudyReplaceList(value);
    const edited =
        'reason' in list ? list : applyStudyReplace(text, list.list, section);
    if (!('reason' in edited)) {
        return { ...edited, repaired: [] };
    }
    return repairStudyReplace(text, value, section) ?? edited;
}

/** One English sentence for the model: the pairs the app put right. */
export function describeStudyReplaceRepair(
    repaired: readonly StudyReplaceRepairType[],
) {
    if (repaired.length === 0) {
        return '';
    }
    const numbers = repaired.map(({ pair }) => {
        return pair;
    });
    const named =
        numbers.length === 1
            ? `pair ${numbers[0]}`
            : `pairs ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`;
    return (
        `The app put ${named} right: a word its check of this study found ` +
        'written otherwise than its verse, a vowel sign apart, is written ' +
        "from the file's spelling to the verse's."
    );
}
