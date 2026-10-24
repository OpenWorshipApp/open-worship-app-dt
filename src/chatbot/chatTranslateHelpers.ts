// The person's language behind the scenes (2026-10-17, the user's ask: _for
// khmer, behind the scene it should translate all khmer to english to work
// with llm or post directly to llm if it is gemma 4 family, then translate
// to khmer to show to user … for translation recommend using gemma 4
// models. make sure to make it generic, this will be the template for all
// supporting language_, and _use gemma 4 as sub assistant (if gemma 4 models
// available) to help translation_).
//
// - **A Gemma 4 model is asked in their language and answers in it**: that
//   family reads and writes the languages the app is shown in well enough to
//   be handed them directly (Khmer measured on gemma-4-12b, 2026-10-16).
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
// No language is named here: a language is one with an `assistant.json`
// (`chatLangHelpers.ts`), and English needs nothing. Pure, so every rule is a
// test: the window hands in who translates and how a model is asked.
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
 * with no data. A model asked to write Khmer from the English page copied
 * its sentences into the answer as they stood (2026-10-17, gemma4:cloud);
 * the page in Khmer has every button, message and step in the words the
 * Khmer app shows (`W-31@km`, and the English page where none is current).
 */
export function findPageLanguage(replyLang: string | null | undefined) {
    if (
        typeof replyLang !== 'string' ||
        replyLang === DEFAULT_CHAT_LANG_CODE ||
        replyLang === OTHER_CHAT_LANG_CODE
    ) {
        return null;
    }
    return getAssistantLanguage(replyLang).code === replyLang
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
    // written without spaces a short word sits inside a longer one (Khmer
    // "God" inside "Bible" and "Jesus"), and must not be read there.
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
        'Keep links, numbers, Bible references, key names (F5, Ctrl+B) and ' +
        'anything in quotes exactly as written.' +
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

// A label a model put in front of its answer, and quote marks or a code
// fence round the whole of it.
const LEAD_LABEL_PATTERN =
    /^\s*(?:english|translation|translated(?:\s+text)?|answer)\s*:\s*/i;

// What a local model's template leaks into its words now and then: a
// control token like `<audio|>` or `<|im_end|>`, once seen in the middle of
// a Khmer word (gemma-4-12b, 2026-10-17). Never the words of an answer.
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
export function readAnswerTranslation(
    answerText: string,
    english: string,
    language: AssistantLanguageType,
): string | null {
    const translated = stripWrapping(answerText);
    if (translated.length === 0 || translated === english.trim()) {
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
    // a Stop, which ends the question.
    translate: (
        ask: string,
        translator: TranslatorType,
        kind: 'question' | 'answer',
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
    };
}
