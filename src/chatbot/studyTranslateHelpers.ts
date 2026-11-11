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
import { listAssistantLanguages } from './chatLangHelpers';

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
    return language.nativeName !== '' && language.nativeName !== language.name
        ? `${language.name} (${language.nativeName})`
        : language.name;
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

export function toStudyTextTranslationAsk(
    text: string,
    language: StudyTranslateLanguageType,
) {
    const termsText = toStudyTermsText(text, language);
    return (
        `${text.trim()}\n\n(Translate the part of a Bible study above into ` +
        `${toLanguageText(language)}, in plain words a church reads aloud. ` +
        'Keep exactly as written: every Markdown mark (#, -, 1., **, *, >, ' +
        '| of a table, ---), every line break and blank line, links, numbers ' +
        'and Bible references (write the book in that language), and every ' +
        '[^…] token. Translate every other word -- headings and table cells ' +
        'too; leave nothing in the language it was in.' +
        termsText +
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
        'arrow, bracket, quote mark, colon, indent and line break. Answer ' +
        'with the diagram alone, no ``` fence.)'
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
        return {
            action: 'draft',
            file: plan.file,
            content: `${trimmed}\n${plan.footer}`,
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
