/**
 * What else a SAVED study's translation left as no reader of its language
 * writes it (2026-11-13, EC-559).
 *
 * A new translation is held, part by part, to no letter of a third script
 * (EC-490) and to no English word or diagram label left (EC-533), each
 * asked about once more before it is drafted. A saved one stays as it was
 * written, and the check of it (EC-536) read only the words of its verses
 * written with another vowel sign. The user's John 3 study, its translation
 * written by the window on 2026-11-10 -- before those checks -- still
 * writes a letter of another script glued into a word and a word of a
 * third script between two of its own, "and" and "between" in its
 * sentences, and seven labels of two diagrams in English: asked to check
 * it, a model was handed its three vowel slips and none of these.
 *
 * Now each translation under the study is read with the same rules, off
 * the same text: the letters of a script neither its own nor one the
 * English half uses (`findStudyStrayLetterSet`), its own script read off
 * the rest of its letters (`readStudyWordsScript`), the English words
 * between that script's letters (`listStudyStrayWords`) and each diagram's
 * labels left (`listStudyDiagramLeftLabels`, against the English half's
 * diagram at its place). Each is given as the words a `replace` writes
 * over (`checkIsStudyReplaceWords`) -- a letter of another script glued
 * into a word is a word of its own there (EC-559) -- with how often its
 * words write them and the heading of the part they first stand in.
 *
 * And a name written with other letters than the verse giving it
 * (2026-11-13, EC-560): the user's study writes the Jordan with a letter
 * fewer and other signs than verse 26, which the check had only ever shown.
 * A verse's words are not all names, so the name is read off the words
 * standing for it: each bold span of the English half naming a name the
 * passages give, and the translation's bold span in its place -- the parts
 * of words paired by their order, their spans too when both write as many,
 * else line by line (`pairBoldSpans`). Where none of the words that may
 * write the name (`listStudyNameWords`) is written in that span, as it is
 * or with another vowel sign, the place coming closest to one is named
 * (`listStudyNameOtherLetters`). A whole line was tried in place of a span
 * and matched the land of Judea to a word for "after": spans only.
 *
 * And the church's own words (2026-11-13, EC-596): a new translation's
 * headings that ARE a church word of its language are written as that word
 * (`applyStudyHeadingTerms`, EC-486) and a word of more than one word it
 * says another way is asked about once more (`listMissingStudyTerms`,
 * EC-491). The user's study, translated before both, heads its Cross
 * references with no word of its language and writes the bronze serpent
 * three ways, none of them its Bible's. Now each translation's language is
 * read off its own words (`readStudyPartsLanguage`) and its church words
 * loaded for the one question (`readSavedStudyTranslationChecks`): each
 * heading paired with an English heading that is one and not writing it
 * (`listStudyHeadingTermSlips`), and each such word the English half uses
 * and it never writes, with its lines in the places the English half uses
 * it -- the parts of words and their lines paired in their order. Judged
 * only when the translation writes at least half the church words the
 * English half uses (`checkIsStudyTermLanguage`): a language not installed
 * can be read as a near one that is.
 *
 * And a translation the window has just drafted, before it is saved
 * (2026-11-13, EC-600, `toStudyTranslationLeftNote`): the translate job asks
 * about a part's slips once more and keeps the answer with fewer, so what
 * the second answer still left went into the card unsaid. The study as
 * written and its new translation are read together, as a translation
 * added after it is, and the model told what is left: to put the plain
 * slips right in the change the card holds -- or in the new study a copy
 * is (EC-604) -- in the same ask, and to say the rest.
 *
 * Pure: no call, nothing kept, and a translation that quotes no passage in
 * its language is read too -- the church words are handed in by the
 * window. Apart from `studyNameCheckHelpers.ts` so the study tool's worker,
 * which imports that file, never loads the language reading this one needs.
 */
import {
    type StudySectionType,
    type StudyTranslatePartType,
    checkIsStudyReplaceWords,
    listStudySections,
} from '../helper/agentStudyFileRules';
import { checkIsClusterEdge } from '../helper/scriptClusterHelpers';
import { DEFAULT_CHAT_LANG_CODE } from './chatLangHelpers';
import { listStudyDiagramLeftLabels } from './studyDiagramWordHelpers';
import {
    type SavedStudyTranslationType,
    type StudyLeftWordsType,
    type StudyMissingTermType,
    type StudyNameCheckType,
    type StudyNameOtherLettersType,
    type StudyTermHeadingType,
    type StudyTranslationLeftTargetType,
    pairStudyQuotedPassages,
    readSavedStudyTranslations,
    readStudyTranslationNameSlips,
    toStudyTranslationLeftText,
    toWordsText,
} from './studyNameCheckHelpers';
import {
    type StudyBoldPairType,
    type StudyNameWordsType,
    addStudyNameWords,
    listStudyNameOtherLetters,
    listStudyWordLines,
    pairStudyBoldSpans,
    readStudyQuoteVerses,
} from './studyNameHelpers';
import {
    type StudyTranslateLanguageType,
    checkIsStudyTermLanguage,
    findStudyStrayLetterSet,
    listMissingStudyTerms,
    listStudyHeadingTermSlips,
    listStudyStrayWords,
    listStudyTermPlaces,
    readStudyPartsLanguage,
    readStudyWordsScript,
    resolveStudyTranslateLanguage,
    withStudyChurchWords,
    withStudyLabelTerms,
} from './studyTranslateHelpers';

// The most words of each kind named for one translation.
const STUDY_LEFT_MAX_WORDS = 8;
// How far round a letter of another script the words a replace writes over
// are looked for, in characters each way: a word or two.
const STRAY_WORDS_REACH = 24;
// The characters shown each side of a letter of another script, at least.
const STRAY_CONTEXT_CHARS = 8;
// The most runs of such letters read in one translation: one written in a
// wrong script throughout would otherwise be read run by run.
const STRAY_MAX_RUNS = 32;
// The most lines of a translation shown for a church word it never writes.
const STUDY_TERM_MAX_LINES = 3;
// The most characters of such a line shown, about the place the English
// half's own line uses the word.
const STUDY_TERM_LINE_CHARS = 160;
const MARK_PATTERN = /^\p{M}/u;
const SPACE_PATTERN = /\s/u;
const FENCE_LINE_PATTERN = /^\s*(?:```|~~~)/;

type WordPartType = StudyTranslatePartType & { line: number };

/** An English bold span, the translation's in its place, and its part. */
type BoldPairType = StudyBoldPairType & { part: WordPartType };

/** Each part, with the line of the translation it starts on. */
function toWordParts(parts: readonly StudyTranslatePartType[]) {
    let line = 0;
    return parts.map((part): WordPartType => {
        const placed = { ...part, line };
        line += part.text.split('\n').length;
        return placed;
    });
}

/** The heading of the innermost part that holds `line`, or ''. */
function findLineHeading(sections: readonly StudySectionType[], line: number) {
    let found: StudySectionType | null = null;
    for (const section of sections) {
        if (
            section.start <= line &&
            line < section.end &&
            (found === null || section.start > found.start)
        ) {
            found = section;
        }
    }
    return found?.heading ?? '';
}

/**
 * How often the parts of `kinds` write `written` as words a replace writes
 * over -- else, written glued as no replace takes it, at all -- and the
 * heading of the first place; null when they write it nowhere.
 */
function findLeftWords(
    written: string,
    wordParts: readonly WordPartType[],
    sections: readonly StudySectionType[],
    kinds: readonly string[],
): StudyLeftWordsType | null {
    let wholeCount = 0;
    let count = 0;
    let firstLine = -1;
    for (const part of wordParts) {
        if (!kinds.includes(part.kind)) {
            continue;
        }
        let index = part.text.indexOf(written);
        while (index >= 0) {
            const end = index + written.length;
            count += 1;
            if (checkIsStudyReplaceWords(part.text, index, end)) {
                wholeCount += 1;
            }
            if (firstLine < 0) {
                firstLine =
                    part.line +
                    part.text.slice(0, index).split('\n').length -
                    1;
            }
            index = part.text.indexOf(written, end);
        }
    }
    if (count === 0) {
        return null;
    }
    return {
        written,
        count: wholeCount > 0 ? wholeCount : count,
        section: findLineHeading(sections, firstLine),
    };
}

/** The runs of letters of another script in a text, the marks on them in. */
function listStrayRuns(text: string, straySet: ReadonlySet<string>) {
    const runList: { start: number; end: number }[] = [];
    let start = -1;
    let index = 0;
    for (const char of text) {
        if (straySet.has(char)) {
            if (start < 0) {
                start = index;
            }
        } else if (start >= 0 && !MARK_PATTERN.test(char)) {
            runList.push({ start, end: index });
            start = -1;
        }
        index += char.length;
    }
    if (start >= 0) {
        runList.push({ start, end: index });
    }
    return runList;
}

/**
 * The words a replace writes over that hold `start`..`end` of a text: the
 * run alone when it is such words, else the fewest letters of its line
 * round it that make them, within reach; the run when none do.
 */
function toStrayWords(text: string, start: number, end: number) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEndAt = text.indexOf('\n', end);
    const lineEnd = lineEndAt < 0 ? text.length : lineEndAt;
    const spanList: { start: number; end: number; reach: number }[] = [];
    for (
        let spanStart = start;
        spanStart >= Math.max(lineStart, start - STRAY_WORDS_REACH);
        spanStart--
    ) {
        for (
            let spanEnd = end;
            spanEnd <= Math.min(lineEnd, end + STRAY_WORDS_REACH);
            spanEnd++
        ) {
            if (
                SPACE_PATTERN.test(text[spanStart]) ||
                SPACE_PATTERN.test(text[spanEnd - 1])
            ) {
                continue;
            }
            spanList.push({
                start: spanStart,
                end: spanEnd,
                reach: start - spanStart + (spanEnd - end),
            });
        }
    }
    spanList.sort((first, second) => {
        return first.reach - second.reach || second.start - first.start;
    });
    const found = spanList.find((span) => {
        return checkIsStudyReplaceWords(text, span.start, span.end);
    });
    return text.slice(found?.start ?? start, found?.end ?? end);
}

/**
 * The letters of its line round `start`..`end`, a few each way, cut where
 * a letter cluster ends: never a vowel sign without its letter.
 */
function toStrayContext(text: string, start: number, end: number) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEndAt = text.indexOf('\n', end);
    const lineEnd = lineEndAt < 0 ? text.length : lineEndAt;
    let from = Math.max(lineStart, start - STRAY_CONTEXT_CHARS);
    while (from > lineStart && !checkIsClusterEdge(text, from)) {
        from -= 1;
    }
    let to = Math.min(lineEnd, end + STRAY_CONTEXT_CHARS);
    while (to < lineEnd && !checkIsClusterEdge(text, to)) {
        to += 1;
    }
    return (
        (from > lineStart ? '…' : '') +
        text.slice(from, to).trim() +
        (to < lineEnd ? '…' : '')
    );
}

/** A diagram part's own lines, its fences left out. */
function toDiagramSource(text: string) {
    const lines = text.split('\n');
    if (FENCE_LINE_PATTERN.test(lines[0] ?? '')) {
        lines.shift();
    }
    if (lines.length > 0 && FENCE_LINE_PATTERN.test(lines.at(-1) ?? '')) {
        lines.pop();
    }
    return lines.join('\n');
}

/** Whether a list already holds these words, or holds its most. */
function checkIsListDone(leftList: StudyLeftWordsType[], written: string) {
    return (
        leftList.length >= STUDY_LEFT_MAX_WORDS ||
        leftList.some((left) => {
            return left.written === written;
        })
    );
}

/**
 * The English half's bold spans, each with the translation's in its place
 * (see the top): the parts of words in their order when both have as many,
 * and in a part its spans in their order when both write as many -- else
 * line by line, the lines holding words, in lines bolding as many
 * (`pairStudyBoldSpans`).
 */
function pairBoldSpans(
    englishParts: readonly StudyTranslatePartType[],
    wordParts: readonly WordPartType[],
) {
    const englishTexts = englishParts.filter((part) => {
        return part.kind === 'text';
    });
    const texts = wordParts.filter((part) => {
        return part.kind === 'text';
    });
    if (englishTexts.length !== texts.length) {
        return [];
    }
    return texts.flatMap((part, index) => {
        return pairStudyBoldSpans(englishTexts[index].text, part.text).map(
            (pair): BoldPairType => {
                return { ...pair, part };
            },
        );
    });
}

/**
 * The words that may write each name the passages give, of every passage
 * the translation quotes in a Bible of its own (`listStudyNameWords`).
 */
function readNameWords(
    englishParts: readonly StudyTranslatePartType[],
    parts: readonly StudyTranslatePartType[],
) {
    const englishPassages = englishParts.filter((part) => {
        return part.kind === 'passage';
    });
    const words: StudyNameWordsType = {
        nameMap: new Map(),
        wordSet: new Set(),
    };
    const quotedMap = pairStudyQuotedPassages(
        englishPassages,
        parts.filter((part) => {
            return part.kind === 'passage';
        }),
    );
    for (const [index, quoted] of quotedMap) {
        addStudyNameWords(
            words,
            readStudyQuoteVerses(englishPassages[index].text),
            readStudyQuoteVerses(quoted.text),
        );
    }
    return words;
}

/** The names one translation writes with other letters (see the top). */
function readOtherLetterNames(
    englishParts: readonly StudyTranslatePartType[],
    translation: SavedStudyTranslationType,
    wordParts: readonly WordPartType[],
    sections: readonly StudySectionType[],
) {
    const namedList: StudyNameOtherLettersType[] = [];
    const pairList = pairBoldSpans(englishParts, wordParts);
    if (pairList.length === 0) {
        return namedList;
    }
    const words = readNameWords(englishParts, translation.parts);
    if (words.nameMap.size === 0) {
        return namedList;
    }
    for (const { english, span, part } of pairList) {
        const foundList = listStudyNameOtherLetters(
            english,
            span.text,
            words,
            (start, end) => {
                return checkIsStudyReplaceWords(
                    part.text,
                    span.start + start,
                    span.start + end,
                );
            },
        );
        for (const found of foundList) {
            const written = span.text.slice(found.start, found.end);
            if (checkIsListDone(namedList, written)) {
                continue;
            }
            const left = findLeftWords(written, wordParts, sections, [
                'text',
                'diagram',
            ]);
            if (left !== null) {
                namedList.push({
                    ...left,
                    name: found.name,
                    spelling: found.spelling,
                    key: found.key,
                });
            }
        }
    }
    return namedList;
}

/** What one translation left or wrote otherwise (see the top). */
function readLeftWords(
    englishParts: readonly StudyTranslatePartType[],
    translation: SavedStudyTranslationType,
    wordParts: readonly WordPartType[],
    sections: readonly StudySectionType[],
) {
    const otherLetterNames = readOtherLetterNames(
        englishParts,
        translation,
        wordParts,
        sections,
    );
    // Its prose: its own script is read off it, never off its diagrams,
    // whose syntax and labels left in English are Latin letters.
    const textWords = wordParts
        .filter((part) => {
            return part.kind === 'text';
        })
        .map((part) => {
            return part.text;
        })
        .join('\n\n');
    const straySet = findStudyStrayLetterSet(
        toWordsText(englishParts),
        toWordsText(translation.parts),
        textWords,
    );
    const otherScriptWords: StudyLeftWordsType[] = [];
    let runCount = 0;
    for (const part of wordParts) {
        if (part.kind !== 'text' && part.kind !== 'diagram') {
            continue;
        }
        for (const run of listStrayRuns(part.text, straySet)) {
            runCount += 1;
            if (
                runCount > STRAY_MAX_RUNS ||
                otherScriptWords.length >= STUDY_LEFT_MAX_WORDS
            ) {
                break;
            }
            const written = toStrayWords(part.text, run.start, run.end);
            if (checkIsListDone(otherScriptWords, written)) {
                continue;
            }
            const found = findLeftWords(written, wordParts, sections, [
                'text',
                'diagram',
            ]);
            if (found !== null) {
                otherScriptWords.push({
                    ...found,
                    context: toStrayContext(part.text, run.start, run.end),
                });
            }
        }
    }
    // Its own script, read off its prose but the letters of another script.
    const script = readStudyWordsScript([
        [...textWords]
            .filter((char) => {
                return !straySet.has(char);
            })
            .join(''),
    ]);
    const englishWords: StudyLeftWordsType[] = [];
    for (const written of listStudyStrayWords(textWords, {
        scriptPattern: script?.pattern ?? null,
    })) {
        const found = findLeftWords(written, wordParts, sections, ['text']);
        if (found !== null && !checkIsListDone(englishWords, written)) {
            englishWords.push(found);
        }
    }
    const englishLabels: StudyLeftWordsType[] = [];
    const englishDiagrams = englishParts.filter((part) => {
        return part.kind === 'diagram';
    });
    const diagramParts = wordParts.filter((part) => {
        return part.kind === 'diagram';
    });
    // Into a language written in Latin letters a label left is told by the
    // English half's diagram at its place, so only when both draw as many.
    const isPaired = englishDiagrams.length === diagramParts.length;
    if (script !== null || isPaired) {
        diagramParts.forEach((part, index) => {
            const englishSource = isPaired
                ? toDiagramSource(englishDiagrams[index].text)
                : '';
            for (const label of listStudyDiagramLeftLabels(
                englishSource,
                toDiagramSource(part.text),
                script?.pattern ?? null,
            )) {
                if (checkIsListDone(englishLabels, label)) {
                    continue;
                }
                englishLabels.push(
                    findLeftWords(label, diagramParts, sections, [
                        'diagram',
                    ]) ?? {
                        written: label,
                        count: 1,
                        section: findLineHeading(sections, part.line),
                    },
                );
            }
        });
    }
    return { otherLetterNames, otherScriptWords, englishWords, englishLabels };
}

/** The own words of some parts, as one text: where their headings are. */
function toTextWords(parts: readonly StudyTranslatePartType[]) {
    return parts
        .filter((part) => {
            return part.kind === 'text';
        })
        .map((part) => {
            return part.text;
        })
        .join('\n\n');
}

/**
 * Some of a line, `STUDY_TERM_LINE_CHARS` at most, about `ratio` of its
 * length -- where the English half's line uses the word -- cut where a
 * letter cluster ends.
 */
function toLinePiece(line: string, ratio: number) {
    const text = line.trim();
    if (text.length <= STUDY_TERM_LINE_CHARS) {
        return text;
    }
    let from = Math.max(
        0,
        Math.min(
            text.length - STUDY_TERM_LINE_CHARS,
            Math.round(ratio * text.length) - STUDY_TERM_LINE_CHARS / 2,
        ),
    );
    let to = from + STUDY_TERM_LINE_CHARS;
    while (from > 0 && !checkIsClusterEdge(text, from)) {
        from -= 1;
    }
    while (to < text.length && !checkIsClusterEdge(text, to)) {
        to += 1;
    }
    return (
        (from > 0 ? '…' : '') +
        text.slice(from, to).trim() +
        (to < text.length ? '…' : '')
    );
}

/**
 * The translation's lines where the English half uses a church word (see
 * the top), three at most, each once, and the heading of the part holding
 * the first: the parts of words paired in their order, and in a part the
 * lines holding words -- when both have as many. None when they do not.
 */
function findTermLines(
    english: string,
    englishTexts: readonly StudyTranslatePartType[],
    texts: readonly WordPartType[],
    sections: readonly StudySectionType[],
) {
    const lineList: string[] = [];
    let section = '';
    if (englishTexts.length !== texts.length) {
        return { lineList, section };
    }
    const takenSet = new Set<string>();
    englishTexts.forEach((englishPart, index) => {
        const part = texts[index];
        const englishLines = listStudyWordLines(englishPart.text);
        const lines = listStudyWordLines(part.text);
        if (englishLines.length === 0 || englishLines.length !== lines.length) {
            return;
        }
        for (const at of listStudyTermPlaces(englishPart.text, english)) {
            if (lineList.length >= STUDY_TERM_MAX_LINES) {
                return;
            }
            let order = englishLines.length - 1;
            while (order > 0 && englishLines[order].start > at) {
                order -= 1;
            }
            const key = `${index}:${order}`;
            if (takenSet.has(key)) {
                continue;
            }
            takenSet.add(key);
            const englishLine = englishLines[order];
            const line = lines[order];
            if (lineList.length === 0) {
                section = findLineHeading(
                    sections,
                    part.line +
                        part.text.slice(0, line.start).split('\n').length -
                        1,
                );
            }
            lineList.push(
                toLinePiece(
                    line.text,
                    (at - englishLine.start) /
                        Math.max(1, englishLine.text.length),
                ),
            );
        }
    });
    return { lineList, section };
}

/**
 * One translation's headings and church words its language writes
 * otherwise (see the top), eight of each at most: none with no language
 * read, or when its words do not read as that language's
 * (`checkIsStudyTermLanguage`). A church word a heading listed already
 * writes is not listed again.
 */
function readTermWords(
    englishParts: readonly StudyTranslatePartType[],
    wordParts: readonly WordPartType[],
    sections: readonly StudySectionType[],
    language: StudyTranslateLanguageType,
) {
    const termHeadings: StudyTermHeadingType[] = [];
    const missingTerms: StudyMissingTermType[] = [];
    const englishWords = toWordsText(englishParts);
    const words = toWordsText(wordParts);
    if (!checkIsStudyTermLanguage(englishWords, words, language)) {
        return { termHeadings, missingTerms };
    }
    const englishTexts = englishParts.filter((part) => {
        return part.kind === 'text';
    });
    const texts = wordParts.filter((part) => {
        return part.kind === 'text';
    });
    for (const slip of listStudyHeadingTermSlips(
        toTextWords(englishTexts),
        toTextWords(texts),
        language,
    )) {
        if (checkIsListDone(termHeadings, slip.written)) {
            continue;
        }
        const left = findLeftWords(slip.written, wordParts, sections, ['text']);
        if (left !== null) {
            termHeadings.push({
                ...left,
                english: slip.english,
                word: slip.word,
            });
        }
    }
    for (const [english, word] of listMissingStudyTerms(
        englishWords,
        words,
        language,
    )) {
        const wordKey = word.toLowerCase();
        if (
            missingTerms.length >= STUDY_LEFT_MAX_WORDS ||
            [...termHeadings, ...missingTerms].some((listed) => {
                return listed.word.toLowerCase() === wordKey;
            })
        ) {
            continue;
        }
        const { lineList, section } = findTermLines(
            english,
            englishTexts,
            texts,
            sections,
        );
        missingTerms.push({
            english,
            word,
            count: listStudyTermPlaces(englishWords, english).length,
            section,
            ...(lineList.length === 0 ? {} : { lines: lineList }),
        });
    }
    return { termHeadings, missingTerms };
}

/** One translation's check (see the top), or null with nothing to say. */
function toTranslationCheck(
    englishParts: readonly StudyTranslatePartType[],
    translation: SavedStudyTranslationType,
    language: StudyTranslateLanguageType | null,
): StudyNameCheckType | null {
    const named = readStudyTranslationNameSlips(
        englishParts,
        translation.parts,
    );
    const wordParts = toWordParts(translation.parts);
    const sections = listStudySections(translation.text);
    const left = readLeftWords(englishParts, translation, wordParts, sections);
    const terms =
        language === null
            ? null
            : readTermWords(englishParts, wordParts, sections, language);
    const slips = named?.slips ?? [];
    if (
        slips.length +
            left.otherLetterNames.length +
            left.otherScriptWords.length +
            left.englishWords.length +
            left.englishLabels.length +
            (terms?.termHeadings.length ?? 0) +
            (terms?.missingTerms.length ?? 0) ===
        0
    ) {
        return null;
    }
    return {
        title: translation.title,
        passages: named?.passages ?? [],
        slips,
        ...left,
        ...terms,
    };
}

/**
 * Every translation under a saved study with words to put right: those of
 * its verses written with another vowel sign (EC-536), its names written
 * with other letters, its letters of another script, and its English words
 * and diagram labels left (see the top), eight of each kind at most; empty
 * when none has any. Its church words are `readSavedStudyTranslationChecks`'.
 */
export function listSavedStudyTranslationChecks(
    text: string,
): StudyNameCheckType[] {
    const saved = readSavedStudyTranslations(text);
    if (saved === null) {
        return [];
    }
    return saved.translations.flatMap((translation) => {
        const check = toTranslationCheck(saved.englishParts, translation, null);
        return check === null ? [] : [check];
    });
}

/**
 * `listSavedStudyTranslationChecks`, each translation also read for its
 * language's church words (see the top): its language read off its own
 * words (`readLanguage`, a code it is typed by), and each language loaded
 * once by `loadLanguage` -- in the help window two small files of an
 * installed language, let go with the question. A language that cannot be
 * read or loaded leaves the rest as it was.
 */
export async function readSavedStudyTranslationChecks(
    text: string,
    loadLanguage: (code: string) => Promise<StudyTranslateLanguageType | null>,
    readLanguage: (
        parts: readonly StudyTranslatePartType[],
    ) => string | null = readStudyPartsLanguage,
): Promise<StudyNameCheckType[]> {
    const saved = readSavedStudyTranslations(text);
    if (saved === null) {
        return [];
    }
    const codeList = saved.translations.map((translation) => {
        return readLanguage(translation.parts);
    });
    const languageMap = new Map<string, StudyTranslateLanguageType | null>();
    await Promise.all(
        [...new Set(codeList)].map(async (code) => {
            if (code === null) {
                return;
            }
            let language: StudyTranslateLanguageType | null = null;
            try {
                language = await loadLanguage(code);
            } catch (_error) {
                // Read without its church words.
            }
            languageMap.set(code, language);
        }),
    );
    return saved.translations.flatMap((translation, index) => {
        const code = codeList[index];
        const check = toTranslationCheck(
            saved.englishParts,
            translation,
            code === null ? null : (languageMap.get(code) ?? null),
        );
        return check === null ? [] : [check];
    });
}

/**
 * What a translation the window just drafted still leaves (2026-11-13,
 * EC-600; see the top), for the model to say before the person saves it:
 * `original` the study as written, `translated` its new translation from
 * its `#` title, read together as a translation added after it is, its
 * church words `language`'s -- the job's. `target` is what the card holds:
 * a change of the file, or the new study a copy is (EC-604). Null with
 * nothing left, and when the two do not read as a study and a translation
 * of it (one with no `#` title).
 */
export function toStudyTranslationLeftNote(
    original: string,
    translated: string,
    language: StudyTranslateLanguageType,
    target: StudyTranslationLeftTargetType,
) {
    const saved = readSavedStudyTranslations(
        `${original.trimEnd()}\n\n---\n\n${translated.trim()}\n`,
    );
    const translation = saved?.translations[0];
    if (saved === null || translation === undefined) {
        return null;
    }
    const check = toTranslationCheck(
        saved.englishParts,
        translation,
        language.code === DEFAULT_CHAT_LANG_CODE ? null : language,
    );
    return toStudyTranslationLeftText(
        check === null ? [] : [check],
        language.name,
        target,
    );
}

/**
 * A saved translation's language with its church words (EC-596): its own
 * `translationTerms` (`resolveStudyTranslateLanguage`), its Bible's words
 * (a language's `churchWords.json`, `withStudyChurchWords`) and the app's
 * labels it is handed (`withStudyLabelTerms`). Null for English, for no
 * language at all, and for one with no church words.
 */
export function toStudyCheckLanguage(
    code: string,
    churchWords: unknown,
    labels: unknown,
): StudyTranslateLanguageType | null {
    if (code === '' || code === DEFAULT_CHAT_LANG_CODE) {
        return null;
    }
    const named = resolveStudyTranslateLanguage(code);
    if (named === null) {
        return null;
    }
    const language = withStudyLabelTerms(
        withStudyChurchWords(named, churchWords),
        labels,
    );
    return Object.keys(language.terms).length === 0 ? null : language;
}
