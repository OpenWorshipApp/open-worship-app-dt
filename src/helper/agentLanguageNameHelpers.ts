// Which language a few words NAME -- its English name, "a Bible in <it>", a code,
// a locale, a language's own name for itself -- for `owa_language`
// (`agentLanguageHelpers.ts`), which the help window asks whenever its
// conversation turns to a language (2026-11-05, the user: _chatbot must ask
// user permission to install any language package that related to chatting
// session_). Pure: every name comes from the caller -- English's table of
// language names, the installed plugins' and the catalog's own names -- so
// no language is named here.

export type LangNameSourceType = {
    langCode: string;
    names: readonly string[];
};

// A code or a locale, typed as the whole answer: "de", "de-DE", "zh_TW".
const CODE_PATTERN = /^([a-z]{2,3})(?:[-_][a-z0-9]{2,8})*$/;
const LATIN_LETTER_PATTERN = /\p{Script=Latin}/u;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{M}\p{N}]/u;
// A name shorter than this is an initial, and initials occur by accident.
const MIN_NAME_LENGTH = 2;

function normalizeText(text: string) {
    return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * A name as it may be written: whole, and its first part -- English's table
 * says "Catalan, Valencian" and "Tonga (Tonga Islands)", a person says
 * "Catalan" and "Tonga".
 */
function toNameVariants(name: string) {
    const whole = normalizeText(name);
    const first = normalizeText(name.split(/[,(;]/)[0]);
    return [...new Set([whole, first])].filter((variant) => {
        return [...variant].length >= MIN_NAME_LENGTH;
    });
}

/**
 * Where a name stands in the text, or -1. A name in Latin letters must be
 * whole words ("Malay" is not inside "Malayalam"); one in a script written
 * without spaces sits inside a run of letters, the way a language's word for
 * "language" is joined to it.
 */
function findNameAt(text: string, name: string) {
    if (!LATIN_LETTER_PATTERN.test(name)) {
        return text.indexOf(name);
    }
    let at = text.indexOf(name);
    while (at !== -1) {
        const before = text.charAt(at - 1);
        const after = text.charAt(at + name.length);
        if (
            !WORD_CHARACTER_PATTERN.test(before) &&
            !WORD_CHARACTER_PATTERN.test(after)
        ) {
            return at;
        }
        at = text.indexOf(name, at + 1);
    }
    return -1;
}

function findByName(text: string, sourceList: readonly LangNameSourceType[]) {
    let best: { langCode: string; length: number; at: number } | null = null;
    for (const source of sourceList) {
        for (const name of source.names) {
            if (typeof name !== 'string') {
                continue;
            }
            for (const variant of toNameVariants(name)) {
                const at = findNameAt(text, variant);
                if (at < 0) {
                    continue;
                }
                // The longest name wins ("Haitian Creole" over a "Creole"),
                // then the one said first.
                if (
                    best === null ||
                    variant.length > best.length ||
                    (variant.length === best.length && at < best.at)
                ) {
                    best = {
                        langCode: source.langCode,
                        length: variant.length,
                        at,
                    };
                }
            }
        }
    }
    return best?.langCode ?? null;
}

// A word that is a cut-short name, or a name with more after it: "korea"
// for Korean, "indonesia" for Indonesian, "germany" for German -- the way the
// Bible collection's own search reads a language word, its file names
// STARTING with the language (2026-11-05, the user's picture: "korea" listed
// the eleven Korean Bibles and offered no Korean). Four Latin letters at
// least on the shorter side, and only when ONE language fits: "mala" is
// Malay, Malayalam and Malagasy, and names none of them.
const MIN_PREFIX_LENGTH = 4;
const LATIN_WORD_PATTERN = /^\p{Script=Latin}+$/u;

function findByNameStart(
    text: string,
    sourceList: readonly LangNameSourceType[],
) {
    const wordList = text.split(/[^\p{L}\p{M}]+/u).filter((word) => {
        return (
            word.length >= MIN_PREFIX_LENGTH && LATIN_WORD_PATTERN.test(word)
        );
    });
    for (const word of wordList) {
        const codeSet = new Set<string>();
        for (const source of sourceList) {
            for (const name of source.names) {
                if (typeof name !== 'string') {
                    continue;
                }
                for (const variant of toNameVariants(name)) {
                    if (
                        variant.length < MIN_PREFIX_LENGTH ||
                        !LATIN_WORD_PATTERN.test(variant)
                    ) {
                        continue;
                    }
                    if (variant.startsWith(word) || word.startsWith(variant)) {
                        codeSet.add(source.langCode);
                    }
                }
            }
        }
        if (codeSet.size === 1) {
            return [...codeSet][0];
        }
    }
    return null;
}

/**
 * The code of the language the words name, or null. `toEnglishName` puts a
 * word of another language into the English name a source carries -- the
 * Bible collection's own mapping (`toCatalogLanguageWord`: a country, the
 * name a language gives itself); it is asked only when no name was found as
 * written. A cut-short name or a country that starts with one is read last
 * (`findByNameStart`).
 */
export function findNamedLangCode(
    text: string,
    sourceList: readonly LangNameSourceType[],
    toEnglishName?: (word: string) => string | null,
): string | null {
    const clean = normalizeText(String(text ?? ''));
    if (clean === '') {
        return null;
    }
    const codeMatch = CODE_PATTERN.exec(clean);
    if (codeMatch !== null) {
        const langCode = codeMatch[1];
        if (
            sourceList.some((source) => {
                return source.langCode === langCode;
            })
        ) {
            return langCode;
        }
    }
    const named = findByName(clean, sourceList);
    if (named !== null) {
        return named;
    }
    if (toEnglishName !== undefined) {
        const wordList = [
            clean,
            ...clean.split(/[\s,.;:!?()"'“”«»]+/).filter((word) => {
                return word.length > 0;
            }),
        ];
        for (const word of wordList) {
            let english: string | null;
            try {
                english = toEnglishName(word);
            } catch (_error) {
                english = null;
            }
            if (typeof english !== 'string' || english.trim() === '') {
                continue;
            }
            const found = findByName(normalizeText(english), sourceList);
            if (found !== null) {
                return found;
            }
        }
    }
    return findByNameStart(clean, sourceList);
}

/** A download's size as a person reads it: "0.2 MB", "14 MB". */
export function toDownloadSizeText(bytes: unknown) {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) {
        return null;
    }
    const megabytes = size / (1024 * 1024);
    if (megabytes < 0.1) {
        return '0.1 MB';
    }
    return megabytes < 10
        ? `${megabytes.toFixed(1)} MB`
        : `${Math.round(megabytes)} MB`;
}
