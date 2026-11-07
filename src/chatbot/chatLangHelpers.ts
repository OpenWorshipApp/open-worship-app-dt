// Which language the help window speaks, and which one a question was asked
// in.
//
// Every language is DATA: `src/lang/data/online/<code>/assistant.json` beside the
// language's own package (the way `appMenus.json` is kept out of it), so adding
// one is adding a file -- this module names no language but English, the
// fallback. Since 2026-11-04 every language but English is a PLUGIN, and its
// file comes from it (`src/lang/langFileStore.ts`): the help window's entry
// loads every enabled language's before this module is evaluated, a few
// kilobytes each; the package itself (its dictionary, fonts and plugins) is
// what `boot.ts` loads.
//
// A person may TYPE in a language the app is not shown in (2026-11-03, the
// user: _no matter what language I type it work seamlessly_). Each language
// says how it is told apart -- a name, the script, the little words and
// letters that tell it from its neighbours, its words for yes and no -- in its
// own `typed.json` (`src/lang/data/online/<code>/typed.json`), so a Spanish
// question is answered in Spanish rather than in the French whose `la` and
// `de` it shares, and a Thai one keeps the buttons written in Thai under it.
// That file is LANGUAGE DATA and comes with the installed language like the
// rest (2026-11-04, the user: _everything related to a language have to be
// loaded from the language data (from language installation catalog), must
// not ship in the app, except english_): a language that is not installed is
// not named, and a question in a script no language here claims -- or in
// Latin letters English never writes, with no word English or an installed
// language claims -- is answered in the language it was written in
// (`OTHER_CHAT_LANG_CODE`).
//
// No app imports: the window's entry, the provider loop and node-environment
// tests all read it.
import { listLangFiles } from '../lang/langFileStore';

type AssistantLanguageFileType = {
    name: string;
    nativeName: string;
    scriptPattern: string;
    // Letters that tell a language written in Latin letters from its
    // neighbours (its accented letters), read with its little words.
    letters?: string;
    nativeDigits?: string;
    // The punctuation of a script of its own (2026-11-03): the marks that
    // end a sentence beside `.`, `!` and `?`, and the one it writes for a
    // colon. Every reader of a sentence, a label or a reference takes every
    // package's (`SENTENCE_END_MARKS`, `COLON_MARKS`), so no code names one.
    sentenceEndMarks?: string;
    colonMarks?: string;
    // A sign that stacks the NEXT letter under this one (a subscript
    // joiner): text is never cut right after it, or half a syllable is drawn.
    functionWords?: string[];
    yesWords?: string[];
    noWords?: string[];
    yesReply?: string;
    noReply?: string;
    yesNoQuestionLeads?: string[];
    yesNoQuestionEndings?: string[];
    walkthroughEchoWords?: string[];
    frameAliases?: Record<string, string[]>;
    translationTerms?: Record<string, string>;
    glossary?: Record<string, string>;
    verseFindAsks?: string[];
    verseAsks?: string[];
    verseAskExcludeWords?: string[];
    // A typed request to install a language (group `language`: its name),
    // read by `langInstallChatHelpers.ts` beside English's own words.
    langInstallAsks?: string[];
    // Knowledge ABOUT the Bible (_who wrote Psalms?_), read as English's
    // `readBibleContentAsk` reads it (2026-10-29): a question word and a
    // Bible word, and not a who-was / where-is (the names lookup's),
    // something the person has open, nor a word of the app (`appWords`,
    // English's `APP_WORD_PATTERN`: show, search, a page, references).
    bibleKnowledgeWords?: {
        leads?: string[];
        cues?: string[];
        nameLeads?: string[];
        ownState?: string[];
        appWords?: string[];
    };
    removalWords?: string[];
    closingWords?: string[];
    menuWords?: string[];
    // "That is wrong", as this language says it (`disputeHelpers.ts`):
    // patterns, read whatever their case.
    disputeAsks?: string[];
    // A question about reading the Bible in this language's words
    // (`readerRouteHelpers.ts`): a Bible word and a reading word, and the
    // presenting words that make it the Presenter's work instead.
    readerRouteWords?: {
        bible?: string[];
        reading?: string[];
        presenting?: string[];
    };
    // What a cross-references line opens with (`resourcesChatHelpers.ts`).
    crossReferenceLabels?: string[];
    // A person not sure which (`waitingInputHelpers.ts`): "maybe", "or".
    unsureWords?: string[];
    // The word between the two chapter numbers of a range, "6 to 9"
    // (`verseFindChatHelpers.ts`).
    rangeWords?: string[];
    // How a Bible-Reader question is asked in this language
    // (`bibleReaderChatHelpers.ts`): its word for "chapter", the words that
    // ask for the Resources files, for the names and places, for a how-to
    // (the app's own work), and the app's own words that make such a
    // question an app question instead.
    bibleReaderWords?: {
        chapter?: string[];
        resources?: string[];
        names?: string[];
        // A how-do-I -- what the PERSON does, never "how did God…" --
        // as words, and as patterns for what words cannot say (a French
        // "how" before an infinitive). Read case as written.
        howTo?: string[];
        howToAsks?: string[];
        // The app's own words the language's Bibles do not use: the app's
        // work wherever they are.
        exclude?: string[];
        // The app's own words its Bibles use too (size, save, a window):
        // the app's work only in a how-do-I (2026-10-29).
        excludeInHowTo?: string[];
        // The words a question names a PERSON or PLACE with ("who was",
        // "where is"): the input aid asks the names lookup for these
        // (`bibleInputSuggestHelpers.ts`).
        nameAsk?: string[];
        // Particles in front of the name in such a question (a question
        // word, a please), taken off before the name is looked up.
        nameAskLead?: string[];
    };
    // How a question under a passage card asks for one of the card's own
    // actions (`lookupChatHelpers.ts`): the words a volunteer says for save,
    // copy, another Bible, the Bible Lookup, the previous / next chapter,
    // and the verbs that ask to SEE the passage (2026-10-19). `lineage` and
    // `jesus` are how a question asks for a family line to Jesus, answered
    // from the Bible's own genealogies (2026-10-19, EC-369).
    lookupWords?: {
        save?: string[];
        copy?: string[];
        anotherBible?: string[];
        openLookup?: string[];
        previous?: string[];
        next?: string[];
        showPassage?: string[];
        lineage?: string[];
        jesus?: string[];
        // Jesus and the person IN ORDER ("names in order from David to
        // Jesus") ask for the line; the two alone do not (2026-10-22).
        lineageOrder?: string[];
        // A place seen on a map (`checkIsLookupMapAsk`, 2026-10-22).
        map?: string[];
        // An answer saying the Bible does not say it (`findNotStatedNudge`,
        // 2026-10-23).
        notStated?: string[];
        // What a question under a passage asks of its surroundings
        // (`readLookupAskContext`, 2026-10-23): a verse by its number, the
        // verses before it, after it, or a length of time (both).
        verseNumber?: string[];
        beforeAsk?: string[];
        afterAsk?: string[];
        timeAsk?: string[];
        namesAsk?: string[];
        // "how many" and the record's lists it can be counted from
        // (`readLookupCountAsk`, 2026-10-19, EC-371).
        count?: string[];
        countChildren?: string[];
        countSpouses?: string[];
        countSiblings?: string[];
        countParents?: string[];
        // A question asking to study the passage's words one by one
        // (`readLookupWordStudyAsk`, 2026-10-23): "vocabulary", "each word".
        vocabulary?: string[];
    };
};

// A language a person may type that the app is not shown in (an installed
// language's `typed.json`, by code -- one folder may name two, Chinese's
// `zh` and `zh-Hant`): its script by Unicode's names (`Han Hiragana
// Katakana`), its little words and its letters each one string with spaces,
// in lower case. Languages that share a family (`malay`: Indonesian and
// Malay) and cannot be told apart go to the first one listed: `order` is
// each one's place in the list they were written in.
type TypedLanguageFileType = {
    name: string;
    nativeName: string;
    script: string;
    words?: string;
    letters?: string;
    family?: string;
    yes?: string[];
    no?: string[];
    order?: number;
};

export type AssistantLanguageType = {
    code: string;
    name: string;
    nativeName: string;
    // A package of its own (`src/lang/data/online/<code>/`): a language the app can
    // be SHOWN in, its manual translated and every list below its own. A
    // language only typed has its name, script and yes and no, the rest empty.
    isPackaged: boolean;
    // A letter of this language's own script. Latin for English and French,
    // which tell each other apart by `functionWordSet` instead.
    scriptPattern: RegExp;
    isLatinScript: boolean;
    nativeDigits: string | null;
    // See `AssistantLanguageFileType.sentenceEndMarks`: '' for none.
    sentenceEndMarks: string;
    colonMarks: string;
    functionWordSet: Set<string>;
    yesWords: string[];
    noWords: string[];
    // The two buttons a yes-or-no question in this language gets
    // (`genQuickReplies`), and how such a question starts or ends.
    yesReply: string | null;
    noReply: string | null;
    yesNoQuestionLeads: string[];
    yesNoQuestionEndings: string[];
    // An option that only says what **Show me step by step** / **Do it for
    // me** already say (`checkIsWalkthroughEcho`).
    walkthroughEchoWords: string[];
    // The words a model writes in place of a frame marker it was told to keep
    // in English (`OPTIONS:` written as that word in the language).
    frameAliases: Record<string, string[]>;
    // The church's own words in this language, by their English: what a
    // translation must say for "Old Testament" or "verse" rather than a
    // model's own choice (`chatTranslateHelpers`).
    translationTerms: Record<string, string>;
    // How a verse is asked for in this language, read by
    // `verseAskLanguageHelpers.ts`: "help me find a verse [in «X»][: words]"
    // (groups `bible` and `words`), a verse by what it says (group
    // `words`), and the words that make either the app's own work instead.
    verseFindAskPatterns: RegExp[];
    verseAskPatterns: RegExp[];
    verseAskExcludeWords: string[];
    // See `AssistantLanguageFileType.langInstallAsks`.
    langInstallAskPatterns: RegExp[];
    // See `AssistantLanguageFileType.bibleKnowledgeWords`.
    bibleKnowledgeWords: {
        leads: string[];
        cues: string[];
        nameLeads: string[];
        ownState: string[];
        appWords: string[];
    };
    // The words that make a reply chip a REMOVAL (delete, remove, reset), in
    // lower case: a chip is a one-press yes, and a removal is said in words
    // (`checkIsRemovalReply`).
    removalWords: string[];
    // How a thank-you or a goodbye starts in this language, in lower case:
    // a line that is one ends a verse search (`checkIsClosingLine`).
    closingWords: string[];
    // The language's word for a MENU: the menu bar's English name after it
    // is kept as the bar shows it (`answerLanguageHelpers.ts`).
    menuWords: string[];
    // See the file type: every list is [] for a language that does not say.
    disputeAskPatterns: RegExp[];
    readerRouteWords: {
        bible: string[];
        reading: string[];
        presenting: string[];
    };
    crossReferenceLabels: string[];
    unsureWords: string[];
    rangeWords: string[];
    // See `AssistantLanguageFileType.bibleReaderWords`: every list is [] for
    // a language that does not say, so a new language cannot crash the
    // window before its data lands.
    bibleReaderWords: {
        chapter: string[];
        resources: string[];
        names: string[];
        howTo: string[];
        howToAskPatterns: RegExp[];
        exclude: string[];
        excludeInHowTo: string[];
        nameAsk: string[];
        nameAskLead: string[];
    };
    // See `AssistantLanguageFileType.lookupWords`: every list is [] for a
    // language that does not say.
    lookupWords: {
        save: string[];
        copy: string[];
        anotherBible: string[];
        openLookup: string[];
        previous: string[];
        next: string[];
        showPassage: string[];
        lineage: string[];
        jesus: string[];
        lineageOrder: string[];
        map: string[];
        notStated: string[];
        verseNumber: string[];
        beforeAsk: string[];
        afterAsk: string[];
        timeAsk: string[];
        namesAsk: string[];
        count: string[];
        countChildren: string[];
        countSpouses: string[];
        countSiblings: string[];
        countParents: string[];
        vocabulary: string[];
    };
};

// A pattern a language file got wrong is left out, never thrown: one bad
// line must not take the help window down with it (a test holds every file
// to patterns that compile). A verse ask is read whatever its case (a
// question that starts with a capital or not); a how-to pattern reads case
// as written, because a French infinitive after its "how" is lower case and
// a name is not (the same "how" before Peter's name asks about Peter).
function toPatternList(
    sourceList: string[] | undefined,
    flags = 'u',
): RegExp[] {
    return (sourceList ?? []).flatMap((source) => {
        try {
            return [new RegExp(source, flags)];
        } catch (_error) {
            return [];
        }
    });
}

export const DEFAULT_CHAT_LANG_CODE = 'en';

// What a question in a script no language here claims is answered in: the
// model is told to use the language it was written in.
export const OTHER_CHAT_LANG_CODE = 'other';

const LANGUAGE_FILE_LIST =
    listLangFiles<AssistantLanguageFileType>('assistant.json');

function toLanguage(
    code: string,
    file: AssistantLanguageFileType,
    isPackaged = true,
): AssistantLanguageType {
    const scriptPattern = new RegExp(file.scriptPattern, 'u');
    return {
        code,
        name: file.name,
        nativeName: file.nativeName,
        isPackaged,
        scriptPattern,
        isLatinScript: scriptPattern.test('a'),
        nativeDigits:
            typeof file.nativeDigits === 'string' &&
            [...file.nativeDigits].length === 10
                ? file.nativeDigits
                : null,
        sentenceEndMarks: file.sentenceEndMarks ?? '',
        colonMarks: file.colonMarks ?? '',
        functionWordSet: new Set(
            (file.functionWords ?? []).map((word) => {
                return word.toLowerCase();
            }),
        ),
        yesWords: file.yesWords ?? [],
        noWords: file.noWords ?? [],
        yesReply: file.yesReply ?? null,
        noReply: file.noReply ?? null,
        yesNoQuestionLeads: file.yesNoQuestionLeads ?? [],
        yesNoQuestionEndings: file.yesNoQuestionEndings ?? [],
        walkthroughEchoWords: file.walkthroughEchoWords ?? [],
        frameAliases: file.frameAliases ?? {},
        translationTerms: file.translationTerms ?? {},
        verseFindAskPatterns: toPatternList(file.verseFindAsks, 'iu'),
        verseAskPatterns: toPatternList(file.verseAsks, 'iu'),
        verseAskExcludeWords: file.verseAskExcludeWords ?? [],
        langInstallAskPatterns: toPatternList(file.langInstallAsks, 'iu'),
        bibleKnowledgeWords: {
            leads: file.bibleKnowledgeWords?.leads ?? [],
            cues: file.bibleKnowledgeWords?.cues ?? [],
            nameLeads: file.bibleKnowledgeWords?.nameLeads ?? [],
            ownState: file.bibleKnowledgeWords?.ownState ?? [],
            appWords: file.bibleKnowledgeWords?.appWords ?? [],
        },
        removalWords: (file.removalWords ?? []).map((word) => {
            return word.toLowerCase();
        }),
        closingWords: (file.closingWords ?? []).map((word) => {
            return word.toLowerCase();
        }),
        menuWords: file.menuWords ?? [],
        disputeAskPatterns: toPatternList(file.disputeAsks, 'iu'),
        readerRouteWords: {
            bible: file.readerRouteWords?.bible ?? [],
            reading: file.readerRouteWords?.reading ?? [],
            presenting: file.readerRouteWords?.presenting ?? [],
        },
        crossReferenceLabels: file.crossReferenceLabels ?? [],
        unsureWords: file.unsureWords ?? [],
        rangeWords: file.rangeWords ?? [],
        bibleReaderWords: {
            chapter: file.bibleReaderWords?.chapter ?? [],
            resources: file.bibleReaderWords?.resources ?? [],
            names: file.bibleReaderWords?.names ?? [],
            howTo: file.bibleReaderWords?.howTo ?? [],
            howToAskPatterns: toPatternList(file.bibleReaderWords?.howToAsks),
            exclude: file.bibleReaderWords?.exclude ?? [],
            excludeInHowTo: file.bibleReaderWords?.excludeInHowTo ?? [],
            nameAsk: file.bibleReaderWords?.nameAsk ?? [],
            nameAskLead: file.bibleReaderWords?.nameAskLead ?? [],
        },
        lookupWords: {
            save: file.lookupWords?.save ?? [],
            copy: file.lookupWords?.copy ?? [],
            anotherBible: file.lookupWords?.anotherBible ?? [],
            openLookup: file.lookupWords?.openLookup ?? [],
            previous: file.lookupWords?.previous ?? [],
            next: file.lookupWords?.next ?? [],
            showPassage: file.lookupWords?.showPassage ?? [],
            lineage: file.lookupWords?.lineage ?? [],
            jesus: file.lookupWords?.jesus ?? [],
            lineageOrder: file.lookupWords?.lineageOrder ?? [],
            map: file.lookupWords?.map ?? [],
            notStated: file.lookupWords?.notStated ?? [],
            verseNumber: file.lookupWords?.verseNumber ?? [],
            beforeAsk: file.lookupWords?.beforeAsk ?? [],
            afterAsk: file.lookupWords?.afterAsk ?? [],
            timeAsk: file.lookupWords?.timeAsk ?? [],
            namesAsk: file.lookupWords?.namesAsk ?? [],
            count: file.lookupWords?.count ?? [],
            countChildren: file.lookupWords?.countChildren ?? [],
            countSpouses: file.lookupWords?.countSpouses ?? [],
            countSiblings: file.lookupWords?.countSiblings ?? [],
            countParents: file.lookupWords?.countParents ?? [],
            vocabulary: file.lookupWords?.vocabulary ?? [],
        },
    };
}

// Unicode's scripts this window tells apart (`\p{Script=…}`): every one a
// language here is written in, and others a person or a Bible may write in.
// A letter of none of them is a script nobody here names (`other`).
const SCRIPT_NAME_LIST = [
    'Latin',
    'Cyrillic',
    'Greek',
    'Armenian',
    'Georgian',
    'Hebrew',
    'Arabic',
    'Syriac',
    'Thaana',
    'Devanagari',
    'Bengali',
    'Gurmukhi',
    'Gujarati',
    'Oriya',
    'Tamil',
    'Telugu',
    'Kannada',
    'Malayalam',
    'Sinhala',
    'Thai',
    'Lao',
    'Tibetan',
    'Myanmar',
    'Khmer',
    'Mongolian',
    'Hangul',
    'Hiragana',
    'Katakana',
    'Han',
    'Bopomofo',
    'Yi',
    'Ethiopic',
    'Cherokee',
    'Canadian_Aboriginal',
    'Tifinagh',
    'Vai',
    'Nko',
    'Adlam',
    'Ol_Chiki',
    'Javanese',
    'Balinese',
    'Sundanese',
    'Coptic',
    'Tai_Viet',
    'Tai_Tham',
    'New_Tai_Lue',
    'Cham',
];

// A script whose one letter is a syllable or a word: three Hangul letters say
// as much as a short English word does, so they are weighed against Latin
// letters three to one (a Korean question around _Bible Lookup_ is
// Korean).
const DENSE_SCRIPT_NAME_SET = new Set([
    'Han',
    'Hiragana',
    'Katakana',
    'Hangul',
    'Yi',
    'Bopomofo',
]);

const SCRIPT_LIST = SCRIPT_NAME_LIST.flatMap((name) => {
    try {
        return [{ name, pattern: new RegExp(`\\p{Script=${name}}`, 'u') }];
    } catch (_error) {
        return [];
    }
});
const SCRIPT_PATTERN_MAP = new Map(
    SCRIPT_LIST.map((script) => {
        return [script.name, script.pattern];
    }),
);

const LANGUAGE_LIST: AssistantLanguageType[] = LANGUAGE_FILE_LIST.map(
    ({ langCode, file }) => {
        return toLanguage(langCode, file);
    },
);

const PACKAGED_CODE_SET = new Set(
    LANGUAGE_LIST.map((language) => {
        return language.code;
    }),
);

const TYPED_FILE_LIST =
    listLangFiles<Record<string, TypedLanguageFileType>>('typed.json');

// The code a package's `typed.json` names its language by, by the package's
// folder: usually the same, but Filipino's folder `fil` names `tl` and
// Norwegian's `nb` names `no` (the first of its rows by `order` when it does
// not name its own).
const TYPED_CODE_BY_FOLDER_MAP = new Map(
    TYPED_FILE_LIST.map(({ langCode, file }) => {
        const ownCode =
            langCode in file
                ? langCode
                : (Object.entries(file).sort(([, one], [, other]) => {
                      return (
                          (one.order ?? Number.MAX_SAFE_INTEGER) -
                          (other.order ?? Number.MAX_SAFE_INTEGER)
                      );
                  })[0]?.[0] ?? langCode);
        return [langCode, ownCode];
    }),
);

const TYPED_FILE_ENTRY_LIST = TYPED_FILE_LIST.flatMap(({ file }) => {
    return Object.entries(file);
})
    .filter(([code]) => {
        return !PACKAGED_CODE_SET.has(code);
    })
    .sort(([, one], [, other]) => {
        return (
            (one.order ?? Number.MAX_SAFE_INTEGER) -
            (other.order ?? Number.MAX_SAFE_INTEGER)
        );
    });

function toScriptNameList(script: string) {
    return script.split(/\s+/).filter((name) => {
        return SCRIPT_PATTERN_MAP.has(name);
    });
}

// A language only typed, in the shape of a package with nothing but its name,
// script and yes and no: every reader of a package's lists finds them empty.
function toTypedLanguage(code: string, file: TypedLanguageFileType) {
    const scriptNameList = toScriptNameList(file.script);
    const scriptPatternSource =
        scriptNameList.length === 0
            ? '(?!)'
            : `[${scriptNameList
                  .map((name) => {
                      return `\\p{Script=${name}}`;
                  })
                  .join('')}]`;
    return toLanguage(
        code,
        {
            name: file.name,
            nativeName: file.nativeName,
            scriptPattern: scriptPatternSource,
            functionWords: (file.words ?? '')
                .normalize('NFC')
                .split(/\s+/)
                .filter((word) => {
                    return word.length > 0;
                }),
            yesWords: file.yes ?? [],
            noWords: file.no ?? [],
        },
        false,
    );
}

const TYPED_LANGUAGE_LIST: AssistantLanguageType[] = TYPED_FILE_ENTRY_LIST.map(
    ([code, file]) => {
        return toTypedLanguage(code, file);
    },
);

const ENGLISH_LANGUAGE: AssistantLanguageType =
    LANGUAGE_LIST.find((language) => {
        return language.code === DEFAULT_CHAT_LANG_CODE;
    }) ??
    toLanguage(DEFAULT_CHAT_LANG_CODE, {
        name: 'English',
        nativeName: 'English',
        scriptPattern: '[A-Za-z]',
    });

/** The languages the app can be SHOWN in: each has a package of its own. */
export function listAssistantLanguages() {
    return LANGUAGE_LIST;
}

/** The languages a person may only TYPE (an installed one's `typed.json`). */
export function listTypedLanguages() {
    return TYPED_LANGUAGE_LIST;
}

function joinMarks(pick: (language: AssistantLanguageType) => string) {
    return [
        ...new Set(
            LANGUAGE_LIST.flatMap((language) => {
                return [...pick(language)];
            }),
        ),
    ].join('');
}

/**
 * Every package's own sentence-end marks (beside `.`, `!`, `?`) and colon
 * marks, as one string each -- for a reader of a sentence, a label or a
 * reference written in any language here.
 */
export const SENTENCE_END_MARKS = joinMarks((language) => {
    return language.sentenceEndMarks;
});
export const COLON_MARKS = joinMarks((language) => {
    return language.colonMarks;
});

/** Characters as the inside of a regex character class, escaped. */
export function toCharClassSource(characters: string) {
    return characters.replace(/[\\\]^-]/g, '\\$&');
}

const WORD_CHARACTER_PATTERN = /[\p{L}\p{M}\p{N}]/u;

/**
 * Whether the text holds one of the words: as a whole word in a language
 * written with spaces between words (Latin), anywhere in one written
 * without them -- a Khmer word sits inside a run of letters.
 */
export function checkHasLanguageWord(
    text: string,
    language: AssistantLanguageType,
    wordList: readonly string[],
) {
    const lower = text.toLowerCase();
    return wordList.some((word) => {
        const wanted = word.toLowerCase();
        if (wanted.length === 0) {
            return false;
        }
        if (!language.isLatinScript) {
            return lower.includes(wanted);
        }
        let at = lower.indexOf(wanted);
        while (at !== -1) {
            const before = lower.charAt(at - 1);
            const after = lower.charAt(at + wanted.length);
            if (
                !WORD_CHARACTER_PATTERN.test(before) &&
                !WORD_CHARACTER_PATTERN.test(after)
            ) {
                return true;
            }
            at = lower.indexOf(wanted, at + 1);
        }
        return false;
    });
}

/** Whether any package's own words of one kind are in the text. */
export function checkHasAnyLanguageWord(
    text: string,
    pick: (language: AssistantLanguageType) => readonly string[],
) {
    return LANGUAGE_LIST.some((language) => {
        return checkHasLanguageWord(text, language, pick(language));
    });
}

/**
 * The facts of one language, English for a code nothing here knows: a
 * package's, or a language only typed (`isPackaged` false, its lists empty).
 */
export function getAssistantLanguage(code: string): AssistantLanguageType {
    return (
        LANGUAGE_LIST.find((language) => {
            return language.code === code;
        }) ??
        TYPED_LANGUAGE_LIST.find((language) => {
            return language.code === code;
        }) ??
        ENGLISH_LANGUAGE
    );
}

// How a language is told from the others: the scripts it is written in (a
// package says its script as a pattern instead), its little words and its
// letters, and the family whose members cannot always be told apart.
type LanguageIdentityType = {
    language: AssistantLanguageType;
    scriptNameList: string[];
    isDenseScript: boolean;
    letterSet: Set<string>;
    family: string | null;
};

function toLetterSet(letters: string | undefined) {
    return new Set([...(letters ?? '').normalize('NFC').toLowerCase()]);
}

const IDENTITY_LIST: LanguageIdentityType[] = [
    ...LANGUAGE_LIST.map((language) => {
        const file = LANGUAGE_FILE_LIST.find(({ langCode }) => {
            return langCode === language.code;
        })?.file;
        return {
            language,
            scriptNameList: [],
            isDenseScript: false,
            letterSet: toLetterSet(file?.letters),
            family: null,
        };
    }),
    ...TYPED_LANGUAGE_LIST.map((language, index) => {
        const file = TYPED_FILE_ENTRY_LIST[index][1];
        const scriptNameList = toScriptNameList(file.script);
        return {
            language,
            scriptNameList,
            isDenseScript: scriptNameList.some((name) => {
                return DENSE_SCRIPT_NAME_SET.has(name);
            }),
            letterSet: toLetterSet(file.letters),
            family: file.family ?? null,
        };
    }),
];

// How much a little word or a letter says: one only one language uses says
// all of it, one five languages share a fifth -- `la` is French, Spanish,
// Italian and Catalan, Spanish's accented "what" is Spanish alone.
function genWeightMap(listOf: (identity: LanguageIdentityType) => string[]) {
    const countMap = new Map<string, number>();
    for (const identity of IDENTITY_LIST) {
        for (const item of new Set(listOf(identity))) {
            countMap.set(item, (countMap.get(item) ?? 0) + 1);
        }
    }
    return new Map(
        [...countMap].map(([item, count]) => {
            return [item, 1 / count];
        }),
    );
}

const WORD_WEIGHT_MAP = genWeightMap((identity) => {
    return [...identity.language.functionWordSet];
});
const LETTER_WEIGHT_MAP = genWeightMap((identity) => {
    return [...identity.letterSet];
});

/**
 * The language the app is SHOWN in. `<html lang>` and not the setting: the
 * setting changes when a language is clicked in Settings, the windows only
 * when Apply reloads them -- and `boot.ts` sets the attribute on every load
 * of every window, this one included. Read at the moment it is needed, never
 * at module load, so a window whose `init` has not finished yet is asked
 * again later.
 */
export function getAppLangCode(): string {
    const lang =
        typeof document === 'undefined'
            ? ''
            : (document.documentElement.lang ?? '');
    const code = lang.split('-')[0].toLowerCase();
    if (
        LANGUAGE_LIST.some((language) => {
            return language.code === code;
        })
    ) {
        return code;
    }
    // A language installed with a dictionary and its `typed.json` but no
    // `assistant.json` of its own -- 48 of the 50 (2026-11-05, the robot
    // run: a window shown in Spanish, Hebrew, Afrikaans or Amharic answered
    // every pressed question in English, its chips English too, the
    // control names alone put into the window's words). It is answered in
    // as a typed language is, by its name and script.
    const typedCode = TYPED_CODE_BY_FOLDER_MAP.get(code);
    return typedCode !== undefined &&
        TYPED_LANGUAGE_LIST.some((language) => {
            return language.code === typedCode;
        })
        ? typedCode
        : DEFAULT_CHAT_LANG_CODE;
}

export function getAppLanguage(): AssistantLanguageType {
    return getAssistantLanguage(getAppLangCode());
}

/** Whether the text carries a letter of this language's own script. */
export function checkIsInLanguageScript(
    text: string,
    language: AssistantLanguageType,
) {
    return language.scriptPattern.test(text);
}

// What a question carries that says nothing about the language it is in: an
// address, a code span, a key name, a Bible reference's numbers.
const NOISE_PATTERN_LIST = [
    /https?:\/\/\S+/gi,
    /`[^`]*`/g,
    /\b(?:ctrl|shift|alt|cmd|esc|tab|enter|f\d{1,2})\b/gi,
];

function countMatches(text: string, pattern: RegExp) {
    let count = 0;
    for (const character of text) {
        if (pattern.test(character)) {
            count += 1;
        }
    }
    return count;
}

// A letter of a script that is not Latin.
const NON_LATIN_LETTER_PATTERN = /(?=\p{L})\P{Script=Latin}/u;
// A Latin letter English never writes: one with an accent, a cedilla or a
// tilde, or a letter of its own.
const MARKED_LATIN_LETTER_PATTERN = /(?![A-Za-z])\p{Script=Latin}/u;

/**
 * The script of one character, by Unicode's name, or null for a digit, a
 * mark every script shares, a sign, or a script nobody here names.
 */
function findScriptName(character: string): string | null {
    for (const script of SCRIPT_LIST) {
        if (script.pattern.test(character)) {
            return script.name;
        }
    }
    return null;
}

/**
 * The patterns of the scripts other than Latin a text is written in -- the
 * letters a Greek passage, a Thai answer, a Khmer button name are made of --
 * each found once.
 */
export function listTextScriptPatterns(text: string | undefined): RegExp[] {
    if (text === undefined || text.length === 0) {
        return [];
    }
    return SCRIPT_LIST.filter((script) => {
        return script.name !== 'Latin' && script.pattern.test(text);
    }).map((script) => {
        return script.pattern;
    });
}

// How many letters of each script a text holds, by script name, one test per
// distinct character.
function countScriptLetters(text: string) {
    const nameOf = new Map<string, string | null>();
    const countMap = new Map<string, number>();
    for (const character of text) {
        let name = nameOf.get(character);
        if (name === undefined) {
            name = findScriptName(character);
            nameOf.set(character, name);
        }
        if (name !== null) {
            countMap.set(name, (countMap.get(name) ?? 0) + 1);
        }
    }
    return countMap;
}

// What a language's little words and letters say a text is in, each weighed
// by how few languages share it (`WORD_WEIGHT_MAP`). An elided little word is
// the front of a token (a French article or pronoun cut short before a
// vowel): the language lists it with its apostrophe (2026-10-29, a French
// line about God making man in his image had read as no language at all).
function scoreEvidence(
    identity: LanguageIdentityType,
    wordList: string[],
    letterSet: Set<string>,
) {
    const { functionWordSet } = identity.language;
    let score = 0;
    for (const word of wordList) {
        if (functionWordSet.has(word)) {
            score += WORD_WEIGHT_MAP.get(word) ?? 0;
            continue;
        }
        const elidedAt = word.indexOf("'");
        const elided = elidedAt > 0 ? word.slice(0, elidedAt + 1) : '';
        if (elided.length > 0 && functionWordSet.has(elided)) {
            score += WORD_WEIGHT_MAP.get(elided) ?? 0;
        }
    }
    for (const letter of identity.letterSet) {
        if (letterSet.has(letter)) {
            score += LETTER_WEIGHT_MAP.get(letter) ?? 0;
        }
    }
    return score;
}

// Two sums of fractions as near as this are one score.
const SCORE_TIE = 1e-9;

// The languages the app is shown in are the ones its people write most
// often, so one of them is believed on half the evidence a language only
// typed needs: _Que dit Jean 3:16 ?_ is made of little words French shares
// with Spanish, Italian and Catalan, and had read as no language at all
// (2026-11-03, the parity rows); a Spanish line still says itself in words
// no package has (its accented question words, its upside-down mark).
const PACKAGED_PRIOR = 2;

/**
 * The language a question was WRITTEN in, or null when its words cannot say:
 * "ok", "F5", "John 3:16", two English words, a line whose little words two
 * unrelated languages share alike. Script first -- a Khmer sentence is Khmer
 * whatever a button name in it reads, Japanese is the Han letters WITH kana
 * -- then, among the languages that share a script (Latin, Cyrillic, Arabic,
 * Devanagari), whichever one's little words and letters it uses most, a word
 * five languages share counting a fifth. `other` is a script none of the
 * languages here claims, or Latin letters English never writes in a line
 * whose words no language here claims (a language not installed).
 */
export function detectTypedLanguage(text: string): string | null {
    // A letter typed as a base and its accent is the letter: an e and a
    // combining acute are the accented e.
    let clean = text.normalize('NFC');
    for (const pattern of NOISE_PATTERN_LIST) {
        clean = clean.replace(pattern, ' ');
    }
    const scriptCountMap = countScriptLetters(clean);
    const latinCount = scriptCountMap.get('Latin') ?? 0;
    // A curly apostrophe is the straight one, so an elided French article
    // reads as typed
    // on any keyboard. A word keeps its vowel signs: a Hindi word is one word.
    const lowerText = clean.toLowerCase().replaceAll('’', "'");
    // A word in capitals in a line that has small letters is a label or an
    // acronym -- "Chat IA", "KJV" -- never one of a language's little words:
    // French's "IA" is Indonesian's "ia", and with only the INSTALLED
    // languages weighed (2026-11-04) it had tied a French line with
    // Indonesian. A line typed all in capitals keeps every word.
    const hasSmallLetter = /\p{Ll}/u.test(clean);
    const wordList = (
        clean.replaceAll('’', "'").match(/[\p{L}\p{M}']+/gu) ?? []
    )
        .filter((word) => {
            return (
                !hasSmallLetter ||
                [...word].length < 2 ||
                word !== word.toUpperCase() ||
                word === word.toLowerCase()
            );
        })
        .map((word) => {
            return word.toLowerCase();
        });
    const letterSet = new Set([...lowerText]);
    let best: {
        identity: LanguageIdentityType;
        count: number;
        score: number;
    } | null = null;
    for (const identity of IDENTITY_LIST) {
        if (identity.language.isLatinScript) {
            continue;
        }
        const count =
            identity.scriptNameList.length === 0
                ? countMatches(clean, identity.language.scriptPattern)
                : identity.scriptNameList.reduce((sum, name) => {
                      return sum + (scriptCountMap.get(name) ?? 0);
                  }, 0);
        if (
            count < 2 ||
            count * (identity.isDenseScript ? 3 : 1) < latinCount
        ) {
            continue;
        }
        // More of the text in its scripts first, so Japanese is not Chinese
        // for the Han letters they share; then its words and letters, so
        // Ukrainian is not Russian; then the first listed.
        const score = scoreEvidence(identity, wordList, letterSet);
        if (
            best === null ||
            count > best.count ||
            (count === best.count && score > best.score + SCORE_TIE)
        ) {
            best = { identity, count, score };
        }
    }
    if (best !== null) {
        return best.identity.language.code;
    }
    const otherCount = countMatches(clean, NON_LATIN_LETTER_PATTERN);
    if (otherCount >= 2 && otherCount >= latinCount) {
        return OTHER_CHAT_LANG_CODE;
    }
    if (wordList.length < 3) {
        return null;
    }
    let bestScore = 0;
    let tiedList: LanguageIdentityType[] = [];
    for (const identity of IDENTITY_LIST) {
        if (!identity.language.isLatinScript) {
            continue;
        }
        const score =
            scoreEvidence(identity, wordList, letterSet) *
            (identity.language.isPackaged ? PACKAGED_PRIOR : 1);
        if (score <= SCORE_TIE) {
            continue;
        }
        if (score > bestScore + SCORE_TIE) {
            bestScore = score;
            tiedList = [identity];
        } else if (score >= bestScore - SCORE_TIE) {
            tiedList.push(identity);
        }
    }
    if (tiedList.length === 0) {
        // No word of it is English's or an installed language's, and it
        // writes letters English never does: a language that is not
        // installed (2026-11-04: only English ships), answered in the
        // language it was written in, like a script nobody here names. It
        // had read as no language and been answered in the app's.
        return countMatches(clean, MARKED_LATIN_LETTER_PATTERN) > 0
            ? OTHER_CHAT_LANG_CODE
            : null;
    }
    // A tie is a doubt, which goes to the app language -- unless the tied are
    // one family, where either is read by the person (Indonesian and Malay).
    const family = tiedList[0].family;
    const isOneFamily =
        family !== null &&
        tiedList.every((identity) => {
            return identity.family === family;
        });
    return tiedList.length === 1 || isOneFamily
        ? tiedList[0].language.code
        : null;
}

/**
 * The language an answer is written in: what the person typed, and the app's
 * own language whenever that cannot be told -- a "yes", a number, a command,
 * and anything PRESSED (a chip, an option, a walkthrough button), which is
 * the app's words, not theirs. The people this window is for are often older
 * and read only the language their app is in, so the doubt always goes that
 * way.
 */
export function pickReplyLanguage(
    typed: string,
    {
        appLangCode = getAppLangCode(),
        isPressed = false,
    }: { appLangCode?: string; isPressed?: boolean } = {},
): string {
    if (isPressed) {
        return appLangCode;
    }
    const typedLangCode = detectTypedLanguage(typed);
    // A question that carries the app's own script is written by somebody
    // who reads it, whatever English it quotes: a Khmer question about
    // where the verse "all things work together for good" is had more Latin
    // letters than Khmer and was answered in English, to a person who reads
    // none
    // (2026-10-17, the elder-persona run).
    if (
        typedLangCode !== appLangCode &&
        checkIsInAppScript(typed, appLangCode)
    ) {
        return appLangCode;
    }
    return typedLangCode ?? appLangCode;
}

function checkIsInAppScript(typed: string, appLangCode: string) {
    const appLanguage = getAssistantLanguage(appLangCode);
    if (appLanguage.code !== appLangCode || appLanguage.isLatinScript) {
        return false;
    }
    let clean = typed;
    for (const pattern of NOISE_PATTERN_LIST) {
        clean = clean.replace(pattern, ' ');
    }
    return countMatches(clean, appLanguage.scriptPattern) >= 2;
}

// The English of `removalWords`, kept in code like the other English
// readers: "Clear" alone is a search box as often as a projector.
const ENGLISH_REMOVAL_PATTERN =
    /\b(?:delete|remove|erase|wipe|uninstall|trash|reset|clear\s+(?:all|everything))\b/i;

/**
 * Whether a reply chip offers a REMOVAL -- deleting, resetting, uninstalling
 * -- in English or in any language's own words. A chip is a one-press yes,
 * and a removal must be asked for in words (2026-10-17, the elder-persona
 * run: a frustrated _delete everything, I want to start over_ was answered
 * with three buttons, _delete all documents_, _delete the app's settings_,
 * _delete the installed Bibles_, one press each from a model with tools that
 * remove).
 */
export function checkIsRemovalReply(reply: string) {
    const lower = reply.trim().toLowerCase();
    // Asking to be SHOWN a control that removes is pointing, not removing:
    // _Show me_ and a removal button's own name names the button.
    const isPointing =
        /^(?:show\s+me|where\s+is|where's|point\s+(?:to|at))\b/.test(lower) ||
        LANGUAGE_LIST.some((language) => {
            return language.walkthroughEchoWords.some((word) => {
                return word.length > 0 && lower.startsWith(word.toLowerCase());
            });
        });
    if (isPointing) {
        return false;
    }
    if (ENGLISH_REMOVAL_PATTERN.test(lower)) {
        return true;
    }
    return LANGUAGE_LIST.some((language) => {
        return language.removalWords.some((word) => {
            return word.length > 0 && lower.includes(word);
        });
    });
}

/** The language's own digits written as 0-9, so a Khmer two is the 2 it means. */
export function toAsciiDigits(text: string) {
    let result = text;
    for (const language of LANGUAGE_LIST) {
        if (language.nativeDigits === null) {
            continue;
        }
        [...language.nativeDigits].forEach((digit, index) => {
            result = result.replaceAll(digit, String(index));
        });
    }
    return result;
}

/**
 * 0-9 written as the app language's own digits -- `74` in Khmer digits in a
 * Khmer window -- for a count the window writes beside references the Bible
 * already writes in them (2026-10-22: a count in 0-9 had stood beside
 * references written in the Bible's own digits).
 */
export function toShownDigits(value: number | string) {
    const digits = getAppLanguage().nativeDigits;
    const text = String(value);
    return digits === null
        ? text
        : text.replaceAll(/[0-9]/g, (digit) => {
              return [...digits][Number(digit)];
          });
}

// What a short reply may end with: a sentence's end in any script here, a
// comma, and the full-width and Arabic marks a reply typed on such a
// keyboard carries.
const REPLY_END_PATTERN = new RegExp(
    `[.!?${toCharClassSource(SENTENCE_END_MARKS)},，、。！？؟]+$`,
    'u',
);

/**
 * Whether a short reply is one of a language's own words for yes (or no), in
 * any language here, packaged or only typed (a Spanish, a Japanese, a
 * Russian yes). Whole reply only: a bare no is a no, a sentence ending in
 * that word is not.
 */
export function checkIsLanguageWord(
    reply: string,
    kind: 'yes' | 'no',
): boolean {
    const text = reply
        .normalize('NFC')
        .trim()
        .replace(REPLY_END_PATTERN, '')
        .trim()
        .toLowerCase();
    if (text.length === 0) {
        return false;
    }
    return [...LANGUAGE_LIST, ...TYPED_LANGUAGE_LIST].some((language) => {
        const wordList = kind === 'yes' ? language.yesWords : language.noWords;
        return wordList.some((word) => {
            return word.normalize('NFC').toLowerCase() === text;
        });
    });
}

/** Every word a model may have written in place of an English frame marker. */
export function listFrameAliases(marker: string): string[] {
    return LANGUAGE_LIST.flatMap((language) => {
        return language.frameAliases[marker] ?? [];
    });
}

/**
 * Whether a chip in a script other than Latin is in a language somebody
 * chose: the language of the answer around it, or the language the app is
 * shown in. A chip in a script neither of them uses is the model changing
 * language on its own (measured on the free tier: a Chinese "please confirm
 * this button is shown" under an
 * English answer). By SCRIPT, not by a list of languages: a Thai answer's
 * Thai chips are as chosen as a Khmer answer's Khmer ones -- every answer in
 * Chinese, Thai, Korean, Russian and Arabic had lost its chips while only a
 * package's script counted (2026-11-03).
 */
export function checkIsChosenScript(
    reply: string,
    answerText: string,
    appLangCode = getAppLangCode(),
) {
    const appLanguage = getAssistantLanguage(appLangCode);
    let hasOwnLetter = false;
    for (const character of reply) {
        if (!NON_LATIN_LETTER_PATTERN.test(character)) {
            continue;
        }
        hasOwnLetter = true;
        if (
            !appLanguage.isLatinScript &&
            appLanguage.scriptPattern.test(character)
        ) {
            continue;
        }
        const scriptName = findScriptName(character);
        const isInAnswer =
            scriptName === null
                ? answerText.includes(character)
                : SCRIPT_PATTERN_MAP.get(scriptName)?.test(answerText) === true;
        if (!isInAnswer) {
            return false;
        }
    }
    return hasOwnLetter;
}

function toQuestionWords(question: string) {
    return question
        .trim()
        .replace(/[?？]+$/u, '')
        .trim()
        .toLowerCase();
}

/**
 * The yes and no buttons for a question asked in one of the languages here,
 * read by how that language starts (French, with its "do you want") or
 * ends (Khmer, with its question particle) a yes-or-no question. Null for
 * one it cannot tell -- English is
 * read by its own lead-ins in `quickReplyHelpers`.
 */
export function findYesNoReplies(question: string): [string, string] | null {
    const words = toQuestionWords(question);
    if (words.length === 0) {
        return null;
    }
    for (const language of LANGUAGE_LIST) {
        if (language.yesReply === null || language.noReply === null) {
            continue;
        }
        if (!language.isLatinScript && !language.scriptPattern.test(words)) {
            continue;
        }
        const isLead = language.yesNoQuestionLeads.some((lead) => {
            return words.startsWith(lead.toLowerCase());
        });
        const isEnding = language.yesNoQuestionEndings.some((ending) => {
            return words.endsWith(ending.toLowerCase());
        });
        if (isLead || isEnding) {
            return [language.yesReply, language.noReply];
        }
    }
    return null;
}

/**
 * Whether a reply only says, in one of the languages here, what the
 * walkthrough buttons already say -- or is that language's bare yes, the
 * natural reply to the offer those buttons answer.
 */
export function checkIsWalkthroughEchoWord(reply: string) {
    const text = reply.trim().toLowerCase();
    if (checkIsLanguageWord(text, 'yes')) {
        return true;
    }
    return LANGUAGE_LIST.some((language) => {
        return language.walkthroughEchoWords.some((word) => {
            return text.includes(word.toLowerCase());
        });
    });
}
