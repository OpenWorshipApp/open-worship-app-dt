// The person's language behind the scenes (2026-10-17, the user's ask: _for
// <a language>, behind the scene it should translate all <of it> to english
// to work with llm or post directly to llm if it is gemma 4 family, then
// translate back to show to user … for translation recommend using gemma 4
// models. make sure to make it generic, this will be the template for all
// supporting language_, and _use gemma 4 as sub assistant (if gemma 4 models
// available) to help translation_).
//
// - **A Gemma 4 model is asked in their language and answers in it**: that
//   family reads and writes the languages the app is shown in well enough to
//   be handed them directly (a non-Latin script measured on gemma-4-12b,
//   2026-10-16).
// - **Any other model works in ENGLISH**, which every model here reads and
//   writes best and which the guide and the tools are written in: what they
//   typed is put into English first, the assistant is asked in English under
//   the English prompt, and its answer is put into their language before it
//   is shown. The translating is done by a Gemma 4 model that can answer at
//   no cost -- a SUB-assistant, one round with no tools each way.
// - **With no Gemma 4 to translate**, or when a translation fails, the
//   assistant is asked directly in their language, as before: an answer in
//   their language from the assistant itself beats none.
//
// No language is named here: a language is one with an `assistant.json`, or
// one only typed that an installed language's `typed.json` names (`chatLangHelpers.ts`,
// 2026-11-03 -- a Spanish or a Thai question is worked in English the same
// way), and English needs nothing. Pure, so every rule is a test: the window
// hands in who translates and how a model is asked.
import {
    DEFAULT_CHAT_LANG_CODE,
    detectTypedLanguage,
    getAssistantLanguage,
    OTHER_CHAT_LANG_CODE,
    type AssistantLanguageType,
} from './chatLangHelpers';

/**
 * The Gemma 4 family, by the words in a model's id or shown name
 * (`gemma-4-12b`, `google/gemma-4-e4b`, `gemma4:e4b`): the models asked in
 * the person's own language, and the ones that translate for the rest.
 */
export const TRANSLATION_MODEL_PATTERN = /gemma[-_\s]?4/i;

/** Whether a model is one of those handed the person's language directly. */
export function checkIsLanguageNativeModel(modelName: string) {
    return TRANSLATION_MODEL_PATTERN.test(modelName);
}

/**
 * The language an ask is worked in behind the scenes, or null to ask the
 * model as it is: English needs nothing, a script no language here claims
 * has no data to go by, and a Gemma 4 model is asked in the language itself.
 */
export function findTranslatedLanguage(
    replyLang: string,
    modelName: string,
): AssistantLanguageType | null {
    if (
        replyLang === DEFAULT_CHAT_LANG_CODE ||
        replyLang === OTHER_CHAT_LANG_CODE ||
        checkIsLanguageNativeModel(modelName)
    ) {
        return null;
    }
    const language = getAssistantLanguage(replyLang);
    return language.code === replyLang ? language : null;
}

/**
 * The language the guide's pages are read in for an ask answered in
 * `replyLang` as it stands (no translation behind the scenes), or null for
 * the English page: English, a script no language here claims, a language
 * with no data, and a language only TYPED -- the manual is translated into
 * the languages the app is shown in alone. A model asked to write another
 * language from the English page copied its sentences into the answer as
 * they stood (2026-10-17, gemma4:cloud); the translated page has every
 * button, message and step in the words the app shows in that language
 * (`W-31@<code>`, and the English page where none is current).
 */
export function findPageLanguage(replyLang: string | null | undefined) {
    if (
        typeof replyLang !== 'string' ||
        replyLang === DEFAULT_CHAT_LANG_CODE ||
        replyLang === OTHER_CHAT_LANG_CODE
    ) {
        return null;
    }
    const language = getAssistantLanguage(replyLang);
    return language.code === replyLang && language.isPackaged
        ? replyLang
        : null;
}

/** Whether what they typed is in that language, and so needs translating. */
export function checkIsWrittenIn(text: string, langCode: string) {
    return detectTypedLanguage(text) === langCode;
}

function escapeRegExp(text: string) {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The church's words a text uses, as `{english} = {word}` lines for the
 * translator (`translationTerms` in the language's data): only those that
 * occur, so the frame stays a few words long. An English term is matched as
 * a whole word, ignoring case; a word of the language anywhere it is
 * written.
 */
export function listUsedTerms(
    text: string,
    language: AssistantLanguageType,
    from: 'english' | 'language',
) {
    const entries = Object.entries(language.translationTerms);
    if (from === 'english') {
        return entries
            .filter(([english]) => {
                return new RegExp(`\\b${escapeRegExp(english)}\\b`, 'i').test(
                    text,
                );
            })
            .map(([english, word]) => {
                return `${english} = ${word}`;
            });
    }
    // Longest first, each taken out of the text once found: in a script
    // written without spaces a short word sits inside a longer one (one
    // language's "God" inside its "Bible" and "Jesus"), and must not be read there.
    let rest = text;
    const used: string[] = [];
    for (const [english, word] of [...entries].sort((one, other) => {
        return other[1].length - one[1].length;
    })) {
        if (rest.includes(word)) {
            used.push(`${word} = ${english}`);
            rest = rest.split(word).join(' ');
        }
    }
    return used;
}

function toTermsText(terms: string[], lead: string) {
    return terms.length === 0 ? '' : ` ${lead} ${terms.join('; ')}.`;
}

// Every translation is one short frame AFTER the words: a small model reads
// what comes last as its job.
export function toQuestionTranslationAsk(
    text: string,
    language: AssistantLanguageType,
) {
    return (
        `${text.trim()}\n\n(Translate the message above from ` +
        `${language.name} into English. It is a church volunteer's question ` +
        'to the help assistant of Open Worship, a church presentation app. ' +
        'Keep links, numbers, Bible references, key names (F5, Ctrl+B), ' +
        'anything in quotes, and words they want WRITTEN somewhere (a line ' +
        'to add, a title to give) exactly as written, in their language.' +
        toTermsText(
            listUsedTerms(text, language, 'language'),
            'These words mean:',
        ) +
        ' Answer with the English alone, nothing else.)'
    );
}

export function toAnswerTranslationAsk(
    text: string,
    language: AssistantLanguageType,
) {
    return (
        `${text.trim()}\n\n(Translate the answer above from English into ` +
        `${language.name} (${language.nativeName}) for an older church ` +
        'volunteer: plain everyday words, short sentences. Keep exactly as ' +
        'written: the markdown (**, _, `, -, 1.), the line breaks, links, ' +
        'numbers, Bible references, key names (F5, Ctrl+B), every word ' +
        'in ** ** (the name of a button on their screen, already in the ' +
        'words the screen shows, or a Bible word being taught), and every ' +
        'word in a script that is not English’s (Greek, Hebrew). A line ' +
        'starting with NEEDS:, SHOWS: or ' +
        'DO: stays as it is. On a line starting with OPTIONS:, keep ' +
        'OPTIONS: and translate the options after it.' +
        toTermsText(
            listUsedTerms(text, language, 'english'),
            `Use the church's own words in ${language.name}:`,
        ) +
        ' Answer with the translation alone, nothing else.)'
    );
}

/**
 * The options under an answer, one numbered line each, for the translator
 * to put into their language on their own (2026-11-03): riding the answer as
 * an `OPTIONS:` line, they came back with no such line under 6 of 6 answers
 * on the free tier, and what was left were the model's English chips.
 */
export function toRepliesTranslationAsk(
    replies: string[],
    language: AssistantLanguageType,
) {
    const lines = replies.map((reply, index) => {
        return `${index + 1}. ${reply.trim()}`;
    });
    return (
        `${lines.join('\n')}\n\n(Translate each numbered line above from ` +
        `English into ${language.name} (${language.nativeName}): short ` +
        'replies an older church volunteer presses as buttons under an ' +
        'answer. Keep each number and one line each, in the same order. Keep ' +
        'every word in ** **, every key name (F5, Ctrl+B) and every Bible ' +
        'reference as written. Answer with the numbered lines alone, nothing ' +
        'else.)'
    );
}

/**
 * The options put into the language, in their order, or null for an answer
 * that is not that: a number missing or empty, all of them the English
 * handed back, or -- for a language with a script of its own -- a changed
 * line with none of its letters. One line may stay as it was: _No_ is
 * Spanish too, _F5_ is a key in every language.
 */
export function readRepliesTranslation(
    answerText: string,
    replies: string[],
    language: AssistantLanguageType,
): string[] | null {
    const byNumber = new Map<number, string>();
    for (const line of stripWrapping(answerText).split(/\r?\n/)) {
        const match = /^\s*(\d{1,2})\s*[.)、．]\s*(.+?)\s*$/u.exec(line);
        if (match !== null && !byNumber.has(Number(match[1]))) {
            byNumber.set(Number(match[1]), stripWrapping(match[2]));
        }
    }
    const translated = replies.map((_reply, index) => {
        return byNumber.get(index + 1) ?? '';
    });
    const isUnchanged = (reply: string, index: number) => {
        return reply === replies[index].trim();
    };
    const isUsable =
        translated.every((reply, index) => {
            return (
                reply.length > 0 &&
                (language.isLatinScript ||
                    isUnchanged(reply, index) ||
                    language.scriptPattern.test(reply))
            );
        }) &&
        translated.some((reply, index) => {
            return !isUnchanged(reply, index);
        });
    return isUsable ? translated : null;
}

// A label a model put in front of its answer, and quote marks or a code
// fence round the whole of it.
const LEAD_LABEL_PATTERN =
    /^\s*(?:english|translation|translated(?:\s+text)?|answer)\s*:\s*/i;

// What a local model's template leaks into its words now and then: a
// control token like `<audio|>` or `<|im_end|>`, once seen in the middle of
// a translated word (gemma-4-12b, 2026-10-17). Never the words of an answer.
const MODEL_TOKEN_PATTERN =
    /<\|[^<>|\s]{1,40}\|?>|<[a-z_]{1,30}\|>|<\/?(?:start|end)_of_turn>/gi;

function stripWrapping(text: string) {
    let clean = text.replace(MODEL_TOKEN_PATTERN, '').trim();
    const fenced = /^```[\w-]*\n([\s\S]*?)\n```$/.exec(clean);
    if (fenced !== null) {
        clean = fenced[1].trim();
    }
    clean = clean.replace(LEAD_LABEL_PATTERN, '');
    if (/^["“][^"“”]*["”]$/.test(clean)) {
        clean = clean.slice(1, -1).trim();
    }
    return clean;
}

/**
 * The English a translating model answered for a question, or null for an
 * answer that is not one: no Latin letter in it (it answered in the words it
 * was given), or empty.
 */
export function readQuestionTranslation(answerText: string): string | null {
    const english = stripWrapping(answerText);
    if (english.length === 0 || !/\p{Script=Latin}/u.test(english)) {
        return null;
    }
    return english;
}

/**
 * The answer put into the language, or null for one that is not: empty, the
 * English handed back, or -- for a language with a script of its own -- not
 * a letter of that script in it.
 */
// A "translation" that is the English handed back with a word or two changed
// (2026-11-09, BN-48, the 87-language run: a Catalan answer was shown in
// English with no note -- for a language in Latin letters anything that
// differed from the English had been taken). Most of its words are the
// English it was given; a real one shares the button names and little else,
// so the bar is high.
const ENGLISH_ECHO_SHARE = 0.6;
const ENGLISH_ECHO_MIN_WORDS = 6;

function toLetterWords(text: string) {
    return text.toLowerCase().match(/\p{L}+/gu) ?? [];
}

/** Whether a translation is the English it was given, near enough. */
export function checkIsEnglishEcho(translated: string, english: string) {
    const words = toLetterWords(translated);
    if (words.length < ENGLISH_ECHO_MIN_WORDS) {
        return false;
    }
    const englishWordSet = new Set(toLetterWords(english));
    const shared = words.filter((word) => {
        return englishWordSet.has(word);
    }).length;
    return shared / words.length > ENGLISH_ECHO_SHARE;
}

/**
 * An answer that came back in English when another language was asked for
 * (BN-48: a Gemma 4, handed the person's language, answered a Xhosa ask in
 * English). A few words are no evidence either way.
 */
export function checkIsEnglishAnswer(text: string, replyLang: string) {
    if (
        replyLang === DEFAULT_CHAT_LANG_CODE ||
        replyLang === OTHER_CHAT_LANG_CODE ||
        toLetterWords(text).length < ENGLISH_ECHO_MIN_WORDS
    ) {
        return false;
    }
    return (
        detectTypedLanguage(text, DEFAULT_CHAT_LANG_CODE) ===
        DEFAULT_CHAT_LANG_CODE
    );
}

export function readAnswerTranslation(
    answerText: string,
    english: string,
    language: AssistantLanguageType,
): string | null {
    const translated = stripWrapping(answerText);
    if (
        translated.length === 0 ||
        translated === english.trim() ||
        checkIsEnglishEcho(translated, english)
    ) {
        return null;
    }
    if (!language.isLatinScript && !language.scriptPattern.test(translated)) {
        return null;
    }
    return translated;
}

/**
 * A button named in English in **bold**, written in the words the screen
 * shows (`translateLabel`, the app's own dictionary) BEFORE the answer is
 * translated -- the translator keeps bold words as they are, and a name it
 * translated itself would not be the one on the button. Words the dictionary
 * does not have stay for the translator.
 */
export function toBoldLabelsShown(
    text: string,
    translateLabel: (label: string) => string,
) {
    return text.replace(/\*\*([^*\n]{1,80})\*\*/g, (whole, label: string) => {
        if (!/\p{Script=Latin}/u.test(label)) {
            return whole;
        }
        const shown = translateLabel(label.trim());
        return shown === label.trim() ? whole : `**${shown}**`;
    });
}

export type TranslatorType = {
    provider: string;
    model: string;
    // The model in the pickers' own words, for the line that says who is
    // translating.
    label: string;
};

/**
 * One ask worked in English behind the scenes. Made once per question and
 * asked once per assistant tried (Auto may try three): the translator is
 * looked for once, the question translated once, and only for an assistant
 * that is not one of the language's own.
 */
export function genAskTranslation({
    replyLang,
    words,
    isWordsEnglish = false,
    findTranslator,
    translate,
}: {
    replyLang: string;
    // What they typed (a general question's own words), in their language.
    words: string;
    // The words are the corpus's English already, with the person's own part
    // in it (a fill-in row, `findTemplateAsk`): that part -- the words for a
    // slide, a song's title -- is theirs and is never translated.
    isWordsEnglish?: boolean;
    findTranslator: () => Promise<TranslatorType | null>;
    // One round of the translator: the ask in, its raw answer out. Throws on
    // a Stop, which ends the question. `replies` runs beside `answer`, so the
    // waiting line need not say it twice.
    translate: (
        ask: string,
        translator: TranslatorType,
        kind: 'question' | 'answer' | 'replies',
    ) => Promise<string>;
}) {
    let translatorAsk: Promise<TranslatorType | null> | null = null;
    let englishAsk: Promise<string | null> | null = null;
    const getTranslator = () => {
        translatorAsk ??= findTranslator().catch(() => {
            return null;
        });
        return translatorAsk;
    };
    return {
        /**
         * How to ask this assistant: `null` as it is, or the language to work
         * in behind the scenes with the English words to ask (`english`, the
         * words themselves when they were English already).
         */
        async planFor(modelName: string): Promise<{
            language: AssistantLanguageType;
            translator: TranslatorType;
            english: string;
        } | null> {
            const language = findTranslatedLanguage(replyLang, modelName);
            if (language === null) {
                return null;
            }
            const translator = await getTranslator();
            if (translator === null) {
                return null;
            }
            if (isWordsEnglish || !checkIsWrittenIn(words, language.code)) {
                return { language, translator, english: words };
            }
            englishAsk ??= translate(
                toQuestionTranslationAsk(words, language),
                translator,
                'question',
            ).then(readQuestionTranslation);
            const english = await englishAsk;
            return english === null ? null : { language, translator, english };
        },
        /**
         * The language and translator to put an answer that came back in
         * English into theirs after the fact, whoever answered -- a model
         * handed their own language (a Gemma 4, never translated for) that
         * answered in English (BN-48) -- or null.
         */
        async planForEnglishAnswer(): Promise<{
            language: AssistantLanguageType;
            translator: TranslatorType;
        } | null> {
            if (
                replyLang === DEFAULT_CHAT_LANG_CODE ||
                replyLang === OTHER_CHAT_LANG_CODE
            ) {
                return null;
            }
            const language = getAssistantLanguage(replyLang);
            if (language.code !== replyLang) {
                return null;
            }
            const translator = await getTranslator();
            return translator === null ? null : { language, translator };
        },
        /** The answer in their language, or null to show it as it came. */
        async translateAnswer(
            text: string,
            language: AssistantLanguageType,
            translator: TranslatorType,
            translateLabel: (label: string) => string,
        ): Promise<string | null> {
            // Already theirs -- an answer the app wrote itself, in the
            // language it is shown in: nothing to put into it.
            if (checkIsWrittenIn(text, language.code)) {
                return text;
            }
            const english = toBoldLabelsShown(text, translateLabel);
            const answered = await translate(
                toAnswerTranslationAsk(english, language),
                translator,
                'answer',
            );
            return readAnswerTranslation(answered, english, language);
        },
        /**
         * The options under the answer in their language, asked of the
         * translator on their own and beside the answer; null for none to
         * show -- never the model's English in their place.
         */
        async translateReplies(
            replies: string[],
            language: AssistantLanguageType,
            translator: TranslatorType,
            translateLabel: (label: string) => string,
        ): Promise<string[] | null> {
            if (replies.length === 0) {
                return null;
            }
            const english = replies.map((reply) => {
                return toBoldLabelsShown(reply, translateLabel);
            });
            const answered = await translate(
                toRepliesTranslationAsk(english, language),
                translator,
                'replies',
            );
            return readRepliesTranslation(answered, english, language);
        },
    };
}
