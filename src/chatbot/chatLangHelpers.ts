// Which language the help window speaks, and which one a question was asked
// in.
//
// Every language is DATA: `src/lang/data/<code>/assistant.json` beside the
// language's own package (the way `appMenus.ts` is kept out of it), so adding
// one is adding a file -- this module names no language but English, the
// fallback. A few kilobytes for all of them, read with the window's chunk: the
// package itself (its dictionary, fonts and plugins) is what `boot.ts` loads.
//
// No app imports: the window's entry, the provider loop and node-environment
// tests all read it.

type AssistantLanguageFileType = {
    name: string;
    nativeName: string;
    scriptPattern: string;
    nativeDigits?: string;
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
    removalWords?: string[];
    closingWords?: string[];
    menuWords?: string[];
    // How a Bible-Reader question is asked in this language
    // (`bibleReaderChatHelpers.ts`): its word for "chapter", the words that
    // ask for the Resources files, for the names and places, for a how-to
    // (the app's own work), and the app's own words that make such a
    // question an app question instead.
    bibleReaderWords?: {
        chapter?: string[];
        resources?: string[];
        names?: string[];
        howTo?: string[];
        exclude?: string[];
        // The words a question names a PERSON or PLACE with ("who was",
        // "where is"): the input aid asks the names lookup for these
        // (`bibleInputSuggestHelpers.ts`).
        nameAsk?: string[];
        // Particles in front of the name in such a question (`តើ`, `សូម`),
        // taken off before the name is looked up.
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
        // "how many" and the record's lists it can be counted from
        // (`readLookupCountAsk`, 2026-10-19, EC-371).
        count?: string[];
        countChildren?: string[];
        countSpouses?: string[];
        countSiblings?: string[];
        countParents?: string[];
    };
};

export type AssistantLanguageType = {
    code: string;
    name: string;
    nativeName: string;
    // A letter of this language's own script. Latin for English and French,
    // which tell each other apart by `functionWordSet` instead.
    scriptPattern: RegExp;
    isLatinScript: boolean;
    nativeDigits: string | null;
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
    // in English (`OPTIONS:` written `ជម្រើស:`).
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
    // See `AssistantLanguageFileType.bibleReaderWords`: every list is [] for
    // a language that does not say, so a new language cannot crash the
    // window before its data lands.
    bibleReaderWords: {
        chapter: string[];
        resources: string[];
        names: string[];
        howTo: string[];
        exclude: string[];
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
        count: string[];
        countChildren: string[];
        countSpouses: string[];
        countSiblings: string[];
        countParents: string[];
    };
};

// A pattern a language file got wrong is left out, never thrown: one bad
// line must not take the help window down with it (a test holds every file
// to patterns that compile).
function toPatternList(sourceList: string[] | undefined): RegExp[] {
    return (sourceList ?? []).flatMap((source) => {
        try {
            return [new RegExp(source, 'u')];
        } catch (_error) {
            return [];
        }
    });
}

export const DEFAULT_CHAT_LANG_CODE = 'en';

// What a question in a script no language here claims is answered in: the
// model is told to use the language it was written in.
export const OTHER_CHAT_LANG_CODE = 'other';

const LANGUAGE_FILE_MAP = import.meta.glob<AssistantLanguageFileType>(
    '../lang/data/*/assistant.json',
    { eager: true, import: 'default' },
);

function toLanguage(
    code: string,
    file: AssistantLanguageFileType,
): AssistantLanguageType {
    const scriptPattern = new RegExp(file.scriptPattern, 'u');
    return {
        code,
        name: file.name,
        nativeName: file.nativeName,
        scriptPattern,
        isLatinScript: scriptPattern.test('a'),
        nativeDigits:
            typeof file.nativeDigits === 'string' &&
            [...file.nativeDigits].length === 10
                ? file.nativeDigits
                : null,
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
        verseFindAskPatterns: toPatternList(file.verseFindAsks),
        verseAskPatterns: toPatternList(file.verseAsks),
        verseAskExcludeWords: file.verseAskExcludeWords ?? [],
        removalWords: (file.removalWords ?? []).map((word) => {
            return word.toLowerCase();
        }),
        closingWords: (file.closingWords ?? []).map((word) => {
            return word.toLowerCase();
        }),
        menuWords: file.menuWords ?? [],
        bibleReaderWords: {
            chapter: file.bibleReaderWords?.chapter ?? [],
            resources: file.bibleReaderWords?.resources ?? [],
            names: file.bibleReaderWords?.names ?? [],
            howTo: file.bibleReaderWords?.howTo ?? [],
            exclude: file.bibleReaderWords?.exclude ?? [],
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
            count: file.lookupWords?.count ?? [],
            countChildren: file.lookupWords?.countChildren ?? [],
            countSpouses: file.lookupWords?.countSpouses ?? [],
            countSiblings: file.lookupWords?.countSiblings ?? [],
            countParents: file.lookupWords?.countParents ?? [],
        },
    };
}

const LANGUAGE_LIST: AssistantLanguageType[] = Object.entries(
    LANGUAGE_FILE_MAP,
).map(([filePath, file]) => {
    const code = /\/data\/([^/]+)\/assistant\.json$/.exec(filePath)?.[1] ?? '';
    return toLanguage(code, file);
});

const ENGLISH_LANGUAGE: AssistantLanguageType =
    LANGUAGE_LIST.find((language) => {
        return language.code === DEFAULT_CHAT_LANG_CODE;
    }) ??
    toLanguage(DEFAULT_CHAT_LANG_CODE, {
        name: 'English',
        nativeName: 'English',
        scriptPattern: '[A-Za-z]',
    });

export function listAssistantLanguages() {
    return LANGUAGE_LIST;
}

/** The facts of one language, English for a code nothing here knows. */
export function getAssistantLanguage(code: string): AssistantLanguageType {
    return (
        LANGUAGE_LIST.find((language) => {
            return language.code === code;
        }) ?? ENGLISH_LANGUAGE
    );
}

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
    return LANGUAGE_LIST.some((language) => {
        return language.code === code;
    })
        ? code
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

/**
 * The language a question was WRITTEN in, or null when its words cannot say:
 * "ok", "F5", "John 3:16", two English words. Script first -- a Khmer
 * sentence is Khmer whatever a button name in it reads -- then, among the
 * languages written in Latin letters, whichever one's little words it uses.
 * `other` is a script none of the languages here claims.
 */
export function detectTypedLanguage(text: string): string | null {
    let clean = text;
    for (const pattern of NOISE_PATTERN_LIST) {
        clean = clean.replace(pattern, ' ');
    }
    const latinCount = countMatches(clean, /\p{Script=Latin}/u);
    let best: { code: string; count: number } | null = null;
    for (const language of LANGUAGE_LIST) {
        if (language.isLatinScript) {
            continue;
        }
        const count = countMatches(clean, language.scriptPattern);
        if (count >= 2 && (best === null || count > best.count)) {
            best = { code: language.code, count };
        }
    }
    if (best !== null && best.count >= latinCount) {
        return best.code;
    }
    const otherCount = countMatches(clean, NON_LATIN_LETTER_PATTERN);
    if (best === null && otherCount >= 2 && otherCount >= latinCount) {
        return OTHER_CHAT_LANG_CODE;
    }
    const wordList = clean.toLowerCase().match(/[\p{L}']+/gu) ?? [];
    if (wordList.length < 3) {
        return null;
    }
    let bestLatin: { code: string; hits: number } | null = null;
    let isTie = false;
    for (const language of LANGUAGE_LIST) {
        if (!language.isLatinScript || language.functionWordSet.size === 0) {
            continue;
        }
        const hits = wordList.filter((word) => {
            return language.functionWordSet.has(word);
        }).length;
        if (hits === 0) {
            continue;
        }
        if (bestLatin === null || hits > bestLatin.hits) {
            bestLatin = { code: language.code, hits };
            isTie = false;
        } else if (hits === bestLatin.hits) {
            isTie = true;
        }
    }
    return bestLatin === null || isTie ? null : bestLatin.code;
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
    // who reads it, whatever English it quotes: _ខគម្ពីរដែលនិយាយថា all
    // things work together for good នោះនៅឯណា?_ has more Latin letters than
    // Khmer and was answered in English, to a person who reads none
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
    // _Show me លុបព្រះគម្ពីរ_ names the button.
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

/** The language's own digits written as 0-9, so "២" is the 2 it means. */
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
 * Whether a short reply is one of a language's own words for yes (or no).
 * Whole reply only: "ទេ" alone is a no, a sentence ending in it is not.
 */
export function checkIsLanguageWord(
    reply: string,
    kind: 'yes' | 'no',
): boolean {
    const text = reply
        .trim()
        .replace(/[.!?។៕,，、]+$/u, '')
        .trim()
        .toLowerCase();
    if (text.length === 0) {
        return false;
    }
    return LANGUAGE_LIST.some((language) => {
        const wordList = kind === 'yes' ? language.yesWords : language.noWords;
        return wordList.some((word) => {
            return word.toLowerCase() === text;
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
 * language on its own (measured on the free tier: `请确认显示这个按钮` under an
 * English answer).
 */
export function checkIsChosenScript(
    reply: string,
    answerText: string,
    appLangCode = getAppLangCode(),
) {
    return LANGUAGE_LIST.some((language) => {
        return (
            !language.isLatinScript &&
            language.scriptPattern.test(reply) &&
            (language.code === appLangCode ||
                language.scriptPattern.test(answerText))
        );
    });
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
 * read by how that language starts (French `voulez-vous`) or ends (Khmer
 * `…ទេ?`) a yes-or-no question. Null for one it cannot tell -- English is
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
