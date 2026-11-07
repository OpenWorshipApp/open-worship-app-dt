import type { LocaleType } from '../lang/langHelpers';
import type { LongTextColumnStyleType } from '../_screen/screenLongTextTypeHelpers';
import {
    readLongTextColumnStyle,
    toLongTextSectionKey,
} from '../_screen/screenLongTextTypeHelpers';
import type { LongTextItemDataType } from '../_screen/screenTypeHelpers';

// Long Text Show: one text in several languages -- a song to sing along to --
// drawn the way several Bibles are, a column per language and a row per
// section. This is what a session HOLDS and how its languages are checked
// against each other; nothing here reads a file or touches a screen, so all
// of it is tested as plain functions.

export const LONG_TEXT_WIDGET_KEY = 'long-text';

export type LongTextSourceType = 'raw' | 'lyric';

/**
 * One language of a session. A language is in a session ONCE: its code is
 * what the column on the screen is known by.
 *
 * Both sources are kept whichever is in use, so switching to a lyric file and
 * back does not lose what was typed.
 */
export type LongTextLanguageType = {
    langCode: string;
    source: LongTextSourceType;
    // Typed text: its title, and one entry per section.
    title: string;
    sections: string[];
    // A lyric file from the Documents folder; title and sections are its own.
    lyricFilePath: string;
    style?: LongTextColumnStyleType;
    // How a lyric card lists its parts in the panel: as buttons, or --
    // `cards` -- each with its words under it. The panel's own, never
    // the screen's. A new language starts as cards (`genLongTextLanguage`);
    // one stored without it was the buttons, and stays them.
    sectionView?: 'cards';
};

export type LongTextSessionType = {
    languages: LongTextLanguageType[];
    // ATOM MODE: every LINE of a section is a row of its own, numbered on
    // from the one before -- a verse of four lines is four rows. Kept only
    // while on, the way a card's `sectionView` is.
    isAtomMode?: true;
    // STACK: the languages one under another in the SAME row, under one
    // header, instead of side by side. The screen's layout only: the rows,
    // their numbers and their keys are the same either way.
    isStacked?: true;
    // HIDE NUMBER: the screen draws the rows without their numbers. The
    // panel keeps them -- they are how the operator finds a part.
    isNumberHidden?: true;
};

/**
 * Where ONE session is kept: a single JSON key, because a setting key is a
 * file read. Not under `foreground-`: Screen Mirror hands every setting of
 * that prefix to its guests, and this one holds a song's words and a file
 * path, which a guest only drawing the screen has no use for.
 */
export function toLongTextSettingName(suffix: string) {
    return `long-text-setting${suffix}`;
}

/** What a session's text is known by on a screen. */
export function toLongTextSourceId(suffix: string) {
    return `${LONG_TEXT_WIDGET_KEY}${suffix}`;
}

const LANG_CODE_PATTERN = /^[a-z]{2,3}$/;

export function genLongTextLanguage(langCode: string): LongTextLanguageType {
    return {
        langCode,
        source: 'raw',
        title: '',
        sections: [''],
        lyricFilePath: '',
        // Text cards from the start, at the user's word: a song is followed
        // by its words. Typed text has no parts to list, so it is only
        // what a switch to `Lyric File` finds.
        sectionView: 'cards',
    };
}

/**
 * A session of ONE language reading a lyric file -- what a lyric's own `Long
 * Text Show` starts, ready to show. In English unless told otherwise; the
 * card's language button changes it, and Add Language puts a translation
 * beside it.
 */
export function genLyricLongTextSession(
    lyricFilePath: string,
    langCode = 'en',
): LongTextSessionType {
    return {
        languages: [
            {
                ...genLongTextLanguage(langCode),
                source: 'lyric',
                lyricFilePath,
            },
        ],
    };
}

function readLanguage(value: unknown): LongTextLanguageType | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const raw = value as { [key: string]: unknown };
    if (
        typeof raw.langCode !== 'string' ||
        !LANG_CODE_PATTERN.test(raw.langCode)
    ) {
        return null;
    }
    const style = readLongTextColumnStyle(raw.style);
    return {
        langCode: raw.langCode,
        source: raw.source === 'lyric' ? 'lyric' : 'raw',
        title: typeof raw.title === 'string' ? raw.title : '',
        sections: Array.isArray(raw.sections)
            ? raw.sections.filter((section): section is string => {
                  return typeof section === 'string';
              })
            : [],
        lyricFilePath:
            typeof raw.lyricFilePath === 'string' ? raw.lyricFilePath : '',
        ...(style === undefined ? {} : { style }),
        ...(raw.sectionView === 'cards' ? { sectionView: 'cards' } : {}),
    };
}

/**
 * A stored session, read back. Whatever is not a language is dropped rather
 * than refused, and a language named twice keeps its first entry: a setting
 * file can be edited by hand, and one bad entry must not cost the rest.
 */
export function parseLongTextSession(
    raw: string | null | undefined,
): LongTextSessionType {
    if (!raw) {
        return { languages: [] };
    }
    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch (_error) {
        return { languages: [] };
    }
    const rawSession = json as {
        languages?: unknown;
        isAtomMode?: unknown;
        isStacked?: unknown;
        isNumberHidden?: unknown;
    } | null;
    const rawLanguages = rawSession?.languages;
    if (!Array.isArray(rawLanguages)) {
        return { languages: [] };
    }
    const languages: LongTextLanguageType[] = [];
    for (const rawLanguage of rawLanguages) {
        const language = readLanguage(rawLanguage);
        if (
            language !== null &&
            !languages.some(({ langCode }) => {
                return langCode === language.langCode;
            })
        ) {
            languages.push(language);
        }
    }
    return {
        languages,
        ...(rawSession?.isAtomMode === true ? { isAtomMode: true } : {}),
        ...(rawSession?.isStacked === true ? { isStacked: true } : {}),
        ...(rawSession?.isNumberHidden === true
            ? { isNumberHidden: true }
            : {}),
    };
}

export function serializeLongTextSession(session: LongTextSessionType) {
    return JSON.stringify(session);
}

/** The header chip of a language's column, and what a restyle finds it by. */
export function toLongTextColumnCode(langCode: string) {
    return langCode.toUpperCase();
}

export function genLongTextStyleByCode(session: LongTextSessionType) {
    const styleByCode: { [code: string]: LongTextColumnStyleType | undefined } =
        {};
    for (const { langCode, style } of session.languages) {
        styleByCode[toLongTextColumnCode(langCode)] = style;
    }
    return styleByCode;
}

export type LongTextSectionTextType = {
    // A lyric file's part (`Verse 1`, `Chorus`); typed text has none.
    partName?: string;
    text: string;
};

export type LongTextReadProblemType =
    // No lyric file is chosen yet.
    | 'no-file'
    // The file is gone, or holds nothing.
    | 'missing'
    // It is not a song this app can read.
    | 'invalid'
    // Its Structure names a part the song does not have.
    | 'missing-part';

/** One language as its words, whichever source they came from. */
export type LongTextResolvedLanguageType = {
    langCode: string;
    source: LongTextSourceType;
    title: string;
    // A lyric file's parts in SUNG order (a Chorus once per time it is sung);
    // typed text as typed.
    sections: LongTextSectionTextType[];
    readProblem?: { kind: LongTextReadProblemType; partName?: string };
};

export function toRawResolvedLanguage(
    language: LongTextLanguageType,
): LongTextResolvedLanguageType {
    return {
        langCode: language.langCode,
        source: 'raw',
        title: language.title,
        sections: language.sections.map((text) => {
            return { text };
        }),
    };
}

/**
 * A section's words as the rows Atom mode puts up, one per line. A blank line
 * is KEPT, as an empty row, at the user's word (_keep empty text_): a line
 * left blank in one language is a line in the others too. A section with no
 * words at all has no line, so a part one language only plays (an Intro of
 * chords) is no mismatch -- its cells are left empty, as they always were.
 */
export function toLongTextAtomLines(text: string) {
    if (text === '') {
        return [];
    }
    return text.split(/\r?\n/);
}

/**
 * What a language's words come to for CHECKING: which parts, whether each
 * has any words, and how many lines it has (what Atom mode lines up). It is
 * all a card needs to keep between two reads of a lyric file -- the words
 * themselves are read again when they go up.
 */
export type LongTextOutlineType = {
    langCode: string;
    source: LongTextSourceType;
    title: string;
    steps: { partName?: string; isEmpty: boolean; lineCount: number }[];
    readProblem?: { kind: LongTextReadProblemType; partName?: string };
};

export function toLongTextOutline(
    resolved: LongTextResolvedLanguageType,
): LongTextOutlineType {
    return {
        langCode: resolved.langCode,
        source: resolved.source,
        title: resolved.title,
        steps: resolved.sections.map(({ partName, text }) => {
            return {
                ...(partName === undefined ? {} : { partName }),
                isEmpty: text.trim() === '',
                lineCount: toLongTextAtomLines(text).length,
            };
        }),
        ...(resolved.readProblem === undefined
            ? {}
            : { readProblem: resolved.readProblem }),
    };
}

export type LongTextProblemType =
    | { kind: 'no-language' }
    | {
          kind: 'unreadable';
          langCode: string;
          reason: LongTextReadProblemType;
          partName?: string;
      }
    // Two lyric files are not sung in the same order. `index` is the first
    // step where they part; a name is undefined where that song has ended.
    | {
          kind: 'structure';
          langCode: string;
          otherLangCode: string;
          index: number;
          partName?: string;
          otherPartName?: string;
      }
    // A language has another number of sections than the text has rows.
    | { kind: 'count'; langCode: string; count: number; expectedCount: number }
    // A typed section with no words in it.
    | { kind: 'empty'; langCode: string; index: number }
    | { kind: 'no-section' }
    // Atom mode: two languages break the same row into another number of
    // lines. `index` is the ROW (a part, or a typed section); its part's name
    // when a lyric language has one.
    | {
          kind: 'lines';
          index: number;
          partName?: string;
          langCode: string;
          count: number;
          otherLangCode: string;
          otherCount: number;
      };

/**
 * One row as it goes up on the screen. `row` is the text's row -- a part, or
 * a typed section -- and `line` the line of it, in Atom mode only. Without
 * Atom mode a screen row IS a row; with it, a row of four lines is four.
 */
export type LongTextScreenRowType = { row: number; line?: number };

export type LongTextVerifyResultType =
    | { problem: LongTextProblemType }
    | {
          problem: null;
          // The rows of the text, as indexes into a LYRIC language's steps.
          // A step with words in no lyric language is no row: an Intro of
          // chords only has nothing to sing. Typed languages have exactly one
          // section per row.
          rowIndexes: number[];
          // The rows as they are numbered on the screen, and as the panel
          // lists them: one per row, or one per LINE in Atom mode.
          screenRows: LongTextScreenRowType[];
      };

function findStructureProblem(
    reference: LongTextOutlineType,
    other: LongTextOutlineType,
): LongTextProblemType | null {
    const length = Math.max(reference.steps.length, other.steps.length);
    for (let index = 0; index < length; index++) {
        const partName = reference.steps[index]?.partName;
        const otherPartName = other.steps[index]?.partName;
        if (partName !== otherPartName) {
            return {
                kind: 'structure',
                langCode: reference.langCode,
                otherLangCode: other.langCode,
                index,
                ...(partName === undefined ? {} : { partName }),
                ...(otherPartName === undefined ? {} : { otherPartName }),
            };
        }
    }
    return null;
}

/**
 * Atom mode's rows: each row as its lines, which every language must break it
 * into alike -- or line 3 of one language would sit beside line 3 of another
 * that is not its translation. A language with no words in a row (a part it
 * only plays) has no lines there and is not counted.
 */
function genAtomScreenRows(
    outlines: LongTextOutlineType[],
    rowIndexes: number[],
):
    | { problem: LongTextProblemType }
    | { problem: null; screenRows: LongTextScreenRowType[] } {
    const screenRows: LongTextScreenRowType[] = [];
    for (let row = 0; row < rowIndexes.length; row++) {
        let first: { langCode: string; count: number } | null = null;
        let partName: string | undefined;
        for (const { langCode, source, steps } of outlines) {
            const step = steps[source === 'lyric' ? rowIndexes[row] : row];
            partName ??= step?.partName;
            const count = step?.lineCount ?? 0;
            if (count === 0) {
                continue;
            }
            if (first === null) {
                first = { langCode, count };
            } else if (first.count !== count) {
                return {
                    problem: {
                        kind: 'lines',
                        index: row,
                        ...(partName === undefined ? {} : { partName }),
                        langCode: first.langCode,
                        count: first.count,
                        otherLangCode: langCode,
                        otherCount: count,
                    },
                };
            }
        }
        for (let line = 0; line < (first?.count ?? 0); line++) {
            screenRows.push({ row, line });
        }
    }
    return { problem: null, screenRows };
}

/**
 * Whether the languages of one text can be put up side by side, row for row.
 *
 * Every language has to have the SAME sections in the SAME order, or the rows
 * of the screen would pair a verse with another verse's translation -- and a
 * room singing along would be reading the wrong words. So this is asked before
 * every Show, and a text that fails it does not go up at all.
 *
 *  1. Every language is readable.
 *  2. Lyric files are sung in the same order: the same parts, step for step.
 *  3. The rows are those steps, less the ones no lyric language has words
 *     for (an instrumental).
 *  4. A typed language has exactly one non-empty section per row.
 *  5. In Atom mode, every language breaks each row into as many lines.
 *
 * The first thing wrong is the one reported: it is the one to fix first.
 */
export function verifyLongText(
    outlines: LongTextOutlineType[],
    isAtomMode = false,
): LongTextVerifyResultType {
    if (outlines.length === 0) {
        return { problem: { kind: 'no-language' } };
    }
    for (const { langCode, readProblem } of outlines) {
        if (readProblem !== undefined) {
            return {
                problem: {
                    kind: 'unreadable',
                    langCode,
                    reason: readProblem.kind,
                    ...(readProblem.partName === undefined
                        ? {}
                        : { partName: readProblem.partName }),
                },
            };
        }
    }
    const lyricOutlines = outlines.filter(({ source }) => {
        return source === 'lyric';
    });
    const rawOutlines = outlines.filter(({ source }) => {
        return source === 'raw';
    });
    let rowIndexes: number[];
    if (lyricOutlines.length > 0) {
        const [reference, ...others] = lyricOutlines;
        for (const other of others) {
            const problem = findStructureProblem(reference, other);
            if (problem !== null) {
                return { problem };
            }
        }
        rowIndexes = reference.steps
            .map((_, index) => {
                return index;
            })
            .filter((index) => {
                return lyricOutlines.some(({ steps }) => {
                    return !steps[index].isEmpty;
                });
            });
    } else {
        rowIndexes = rawOutlines[0].steps.map((_, index) => {
            return index;
        });
    }
    if (rowIndexes.length === 0) {
        return { problem: { kind: 'no-section' } };
    }
    for (const { langCode, steps } of rawOutlines) {
        if (steps.length !== rowIndexes.length) {
            return {
                problem: {
                    kind: 'count',
                    langCode,
                    count: steps.length,
                    expectedCount: rowIndexes.length,
                },
            };
        }
        const emptyIndex = steps.findIndex(({ isEmpty }) => {
            return isEmpty;
        });
        if (emptyIndex !== -1) {
            return { problem: { kind: 'empty', langCode, index: emptyIndex } };
        }
    }
    if (!isAtomMode) {
        return {
            problem: null,
            rowIndexes,
            screenRows: rowIndexes.map((_, row) => {
                return { row };
            }),
        };
    }
    const atomResult = genAtomScreenRows(outlines, rowIndexes);
    if (atomResult.problem !== null) {
        return { problem: atomResult.problem };
    }
    return { problem: null, rowIndexes, screenRows: atomResult.screenRows };
}

/** A language's words, one per row of a text that passed `verifyLongText`. */
export function genLongTextRowTexts(
    resolved: LongTextResolvedLanguageType,
    rowIndexes: number[],
) {
    if (resolved.source === 'raw') {
        return resolved.sections.map(({ text }) => {
            return text;
        });
    }
    return rowIndexes.map((index) => {
        return resolved.sections[index]?.text ?? '';
    });
}

/**
 * A language's words, one per SCREEN row: a row's words, or in Atom mode the
 * one line of them -- empty where this language has no words in that row.
 */
export function genLongTextScreenTexts(
    resolved: LongTextResolvedLanguageType,
    rowIndexes: number[],
    screenRows: LongTextScreenRowType[],
) {
    const rowTexts = genLongTextRowTexts(resolved, rowIndexes);
    return screenRows.map(({ row, line }) => {
        const text = rowTexts[row] ?? '';
        return line === undefined
            ? text
            : (toLongTextAtomLines(text)[line] ?? '');
    });
}

/**
 * Where the mark goes when the same text goes up again in rows of another
 * kind (Atom mode turned on or off on a showing text): to the first screen
 * row of the ROW that was marked, so the song is where it had got to.
 */
export function mapLongTextSectionKey(
    key: string | null,
    oldScreenRows: LongTextScreenRowType[],
    newScreenRows: LongTextScreenRowType[],
) {
    if (key === null) {
        return null;
    }
    const oldIndex = oldScreenRows.findIndex((_, index) => {
        return toLongTextSectionKey(index) === key;
    });
    if (oldIndex === -1) {
        return null;
    }
    const { row } = oldScreenRows[oldIndex];
    const newIndex = newScreenRows.findIndex((screenRow) => {
        return screenRow.row === row;
    });
    return newIndex === -1 ? null : toLongTextSectionKey(newIndex);
}

/**
 * A section's words on ONE line, for a card in the panel: its lines run on
 * with a slash between them, the way a song is quoted in a sentence. A
 * card is for finding a part at a glance, and nine stanzas set line by
 * line push the part being looked for out of the panel.
 */
export function toInlineSectionText(text: string) {
    return text
        .split(/\r?\n/)
        .map((line) => {
            return line.trim();
        })
        .filter((line) => {
            return line !== '';
        })
        .join(' / ');
}

/**
 * What a part's card reads: its words on one line, or in Atom mode the ONE
 * line of them the card stands for.
 */
export function toLongTextCardText(text: string, line?: number) {
    if (line === undefined) {
        return toInlineSectionText(text);
    }
    return (toLongTextAtomLines(text)[line] ?? '').trim();
}

export type LongTextColumnInputType = {
    langCode: string;
    locale: LocaleType;
    title: string;
    // One per row, and its number in that language's own digits.
    texts: string[];
    nums: string[];
    style?: LongTextColumnStyleType;
};

/** What goes to `ScreenLongTextManager.handleLongTextShowing`. */
export function genLongTextItemData(
    sourceId: string,
    columns: LongTextColumnInputType[],
    {
        isStacked = false,
        isNumberHidden = false,
    }: { isStacked?: boolean; isNumberHidden?: boolean } = {},
): LongTextItemDataType {
    return {
        type: 'long-text',
        locale: columns[0]?.locale ?? 'en-US',
        scroll: 0,
        selectedKJVVerseKey: null,
        longTextData: {
            sourceId,
            ...(isStacked ? { isStacked: true } : {}),
            ...(isNumberHidden ? { isNumberHidden: true } : {}),
            renderedList: columns.map(
                ({ langCode, locale, title, texts, nums, style }) => {
                    const columnStyle = readLongTextColumnStyle(style);
                    return {
                        locale,
                        code: toLongTextColumnCode(langCode),
                        title,
                        sections: texts.map((text, index) => {
                            return {
                                num: nums[index] ?? `${index + 1}`,
                                text,
                                // The ROW's key, so every language of a row
                                // shares it -- and a Chorus sung twice is two
                                // rows with two keys.
                                key: toLongTextSectionKey(index),
                            };
                        }),
                        ...(columnStyle === undefined
                            ? {}
                            : { style: columnStyle }),
                    };
                },
            ),
        },
    };
}
