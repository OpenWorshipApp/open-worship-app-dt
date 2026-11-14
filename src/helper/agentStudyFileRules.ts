/**
 * The pure half of a study file (2026-11-09, EC-464, the user: _ask chatbot
 * to make a resource study content for Matthew 3:3-7 … I expect to have the
 * new markdown file with enough information for the passage with creative
 * mermaid diagrams_): a Markdown file the help window drafts for a passage
 * and the PERSON saves into `<data folder>/resources/Default`, where the
 * Bible Reader's Resources panel shows it beside that chapter.
 *
 * What lives here, each rule a test, nothing touching the disk or a Bible:
 *
 * - The NAME. `MAT.3.3-7 The Voice in the Wilderness.md`: the book's key,
 *   the chapter and the verse span the app read off the reference (never
 *   the model's), then the title. A whole chapter has no span
 *   (`MAT.3.The Voice.md`) and a passage over two chapters reads
 *   `MAT.3.16-4.2 …`. The panel matches a file to a chapter by
 *   `<BOOK>.<CHAPTER>.` alone (`toChapterNumber` in
 *   `resourcesScanHelpers.ts`), so each of these lands under its chapter.
 *   A title is REFUSED, never cleaned, like every name an agent writes.
 * - The verse TOKENS. A model never quotes a verse: `[^Isaiah 40:3]` on a
 *   line of its own is quoted by the app from the installed Bible, and one
 *   inside a sentence becomes the reference as that Bible writes it.
 * - The DIAGRAM check. Each ```mermaid block starts with a kind the preview
 *   draws and carries no `%%{init`, no `click` and no HTML; the help window
 *   also parses each one with mermaid itself, which this check cannot.
 * - A CHANGE by part (2026-11-10, EC-479): a section named by its heading
 *   given new words, words added at the end of one or of the file, the
 *   app's own last lines (the rule and the italic footnote) kept last.
 *   A model never has to write a whole file back to change a line of it --
 *   on a server of the user's own it COULD not: a help round is 2 000
 *   tokens, and the user's 13 KB John 3 study is more than that.
 * - A TRANSLATION's parts (EC-478): the words, each diagram and each quoted
 *   passage apart, so the words are translated, a diagram keeps its syntax
 *   and a passage is quoted again from a Bible in the new language rather
 *   than put into it by a model.
 * - An exact REPLACE (2026-11-12, EC-537): words written anew where they
 *   stand, each `from` exactly as the file writes it, in the words and the
 *   diagrams only -- never a passage the app quoted, a code block or the
 *   app's last lines -- and never a piece of a longer word or of a letter
 *   cluster.
 * - The whole file stays under `STUDY_FILE_MAX_CHARS`, which holds a study
 *   with its translation added under it; a read returns
 *   `STUDY_READ_MAX_CHARS` of it whole, and a longer one is changed by part.
 */
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import { checkIsClusterEdge } from './scriptClusterHelpers';

export const STUDY_FOLDER_NAME = 'Default';
/**
 * A study kept in the Bible Notes list instead (2026-11-12, EC-509, the
 * user: _when create markdown file for user make sure ask user into
 * resource or bible-note area_), named the way a Resources file is:
 * `Bible Notes/JHN.3.16 Love.md`, the folder being the Bible Notes folder of
 * the session in front.
 */
export const STUDY_BIBLE_NOTES_LABEL = 'Bible Notes';
/** Where `save` keeps a NEW study: the person picks one at Create. */
export const STUDY_PLACE_LIST = ['resources', 'bible-notes'] as const;
export type StudyPlaceType = (typeof STUDY_PLACE_LIST)[number];
export const STUDY_FILE_EXTENSION = '.md';
/**
 * A study file whole: a 16 KB study and its translation into a script that
 * takes more letters (2026-11-10, EC-478: the user's John 3 study, 13 KB in
 * English, with its Khmer added under it).
 */
export const STUDY_FILE_MAX_CHARS = 64 * 1024;
/** `MAX_TEXT_CHARS` in `agentResourcesHelpers.ts`: a read returns it whole. */
export const STUDY_READ_MAX_CHARS = 16 * 1024;
/** The study's own part; the rest is the title and the quoted passage. */
export const STUDY_CONTENT_MAX_CHARS = 48_000;
export const STUDY_TITLE_MAX_CHARS = 60;
/** What a NEW study draws: the 2 to 4 that teach it, and room. */
export const STUDY_MAX_DIAGRAMS = 6;
/** What a whole file may hold: a study and its translation under it. */
export const STUDY_FILE_MAX_DIAGRAMS = 16;
export const STUDY_MAX_VERSE_TOKENS = 24;
/** One quoted reference: a few verses, not a chapter. */
export const STUDY_MAX_QUOTED_VERSES = 30;
/** The passage at the top: a long chapter is quoted this far and named. */
export const STUDY_PASSAGE_MAX_VERSES = 60;

/** The diagram kinds the preview's mermaid draws and a study uses. */
export const STUDY_DIAGRAM_TYPE_LIST = [
    'flowchart',
    'graph',
    'sequenceDiagram',
    'timeline',
    'mindmap',
    'journey',
    'pie',
    'stateDiagram-v2',
    'stateDiagram',
    'quadrantChart',
] as const;

export type StudyTargetType = {
    bookKey: string;
    chapter: number;
    verseStart: number;
    verseEnd: number;
    chapterEnd?: number;
};

export type StudyVerseType = { number: string; text: string };

export type StudyQuoteType = {
    title: string;
    bibleKey: string;
    verses: StudyVerseType[];
};

/**
 * The span in the name: `16`, `3-7`, `16-4.2` across chapters, and nothing
 * for a whole chapter (`chapterVerseCount` is how many verses it has, or
 * null when that could not be read -- then the span is always written).
 */
export function toStudySpanText(
    target: StudyTargetType,
    chapterVerseCount: number | null,
) {
    const { chapter, verseStart, verseEnd, chapterEnd } = target;
    if (chapterEnd !== undefined && chapterEnd > chapter) {
        return `${verseStart}-${chapterEnd}.${verseEnd}`;
    }
    if (
        verseStart === 1 &&
        chapterVerseCount !== null &&
        verseEnd >= chapterVerseCount
    ) {
        return '';
    }
    return verseStart === verseEnd
        ? `${verseStart}`
        : `${verseStart}-${verseEnd}`;
}

// `MAT.3.3-7 The Voice.md`, `1CO.13.Love.md`, `JHN.3.16-4.2 Title.md`.
const STUDY_NAME_PATTERN =
    /^([1-3A-Z][A-Z0-9]{2})\.(\d{1,3})\.(?:(\d{1,3}(?:-\d{1,3}(?:\.\d{1,3})?)?) +)?(.+)$/;

/** A study file's name read back into its parts, or null. */
export function readStudyFileName(fileName: string) {
    const trimmed = fileName.trim();
    if (!trimmed.toLowerCase().endsWith(STUDY_FILE_EXTENSION)) {
        return null;
    }
    const match = STUDY_NAME_PATTERN.exec(
        trimmed.slice(0, -STUDY_FILE_EXTENSION.length),
    );
    if (match === null) {
        return null;
    }
    return {
        bookKey: match[1],
        chapter: Number(match[2]),
        span: match[3] ?? '',
        title: match[4].trim(),
    };
}

/**
 * Whether a file named as the Resources tools name it (`Default/JHN.3.16
 * Love.md`, `Bible Notes/Easter.md`) is a study `owa_resource_file` can
 * change: a Markdown file straight in Default or in the Bible Notes folder,
 * under a name a file may carry -- what its worker's `resolveStudyFile`
 * takes. Any other file, a PDF or one in another Resources folder, is only
 * read.
 */
export function checkIsChangeableStudyName(name: string | null | undefined) {
    const parts = String(name ?? '').split('/');
    if (parts.length !== 2) {
        return false;
    }
    const [folder, fileName] = parts;
    return (
        [STUDY_FOLDER_NAME, STUDY_BIBLE_NOTES_LABEL].some((label) => {
            return label.toLowerCase() === folder.toLowerCase();
        }) &&
        fileName.length > STUDY_FILE_EXTENSION.length &&
        fileName.toLowerCase().endsWith(STUDY_FILE_EXTENSION) &&
        checkAgentFileName(fileName) === null
    );
}

/**
 * The title a model or a person gave, or why it will not do. A whole name
 * typed back (`MAT.3.3-7 The Voice.md`, as the card shows it) is read as its
 * title; anything else a file name may not carry is refused by
 * `checkAgentFileName`'s own sentence.
 */
export function toStudyTitle(
    value: unknown,
): { title: string } | { reason: string } {
    if (typeof value !== 'string' || value.trim() === '') {
        return {
            reason:
                'Give a short `title` for the study, 2 to 6 words, e.g. ' +
                '"The Voice in the Wilderness".',
        };
    }
    let title = value.replace(/\s+/g, ' ').trim();
    if (title.toLowerCase().endsWith(STUDY_FILE_EXTENSION)) {
        title = title.slice(0, -STUDY_FILE_EXTENSION.length).trim();
    }
    const named = readStudyFileName(`${title}${STUDY_FILE_EXTENSION}`);
    if (named !== null) {
        title = named.title;
    }
    title = title.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
    if (title === '') {
        return { reason: 'Give the study a title of a few words.' };
    }
    if (title.length > STUDY_TITLE_MAX_CHARS) {
        return {
            reason:
                `That title is longer than ${STUDY_TITLE_MAX_CHARS} ` +
                'characters: give one of 2 to 6 words.',
        };
    }
    const reason = checkAgentFileName(title);
    return reason === null ? { title } : { reason };
}

/** `MAT.3.3-7 The Voice.md`, or why that name cannot be written. */
export function toStudyFileName(
    bookKey: string,
    chapter: number,
    span: string,
    title: string,
): { name: string } | { reason: string } {
    const name =
        span === ''
            ? `${bookKey}.${chapter}.${title}${STUDY_FILE_EXTENSION}`
            : `${bookKey}.${chapter}.${span} ${title}${STUDY_FILE_EXTENSION}`;
    const reason = checkAgentFileName(name);
    return reason === null ? { name } : { reason };
}

const FENCE_PATTERN = /^\s{0,3}(```|~~~)/;
const MERMAID_FENCE_PATTERN = /^\s{0,3}(```|~~~)\s*mermaid\s*$/i;

/**
 * Each line with whether it is inside a fenced block. A verse token in a
 * code or diagram block is the block's own text, never a verse to quote.
 */
export function splitLinesByFence(content: string) {
    const lines = content.split(/\r?\n/);
    let fence: string | null = null;
    return lines.map((line) => {
        const match = FENCE_PATTERN.exec(line);
        if (match !== null) {
            if (fence === null) {
                fence = match[1];
                return { line, isInFence: true };
            }
            if (match[1] === fence) {
                fence = null;
                return { line, isInFence: true };
            }
        }
        return { line, isInFence: fence !== null };
    });
}

const VERSE_TOKEN_PATTERN = /\[\^([^\]\n]{1,80})\]/g;
const OWN_LINE_TOKEN_PATTERN = /^\s*(?:>\s*)?\[\^([^\]\n]{1,80})\]\s*$/;

/** Every verse token outside a fenced block, each once, in order. */
export function listStudyVerseTokens(content: string) {
    const tokenSet = new Set<string>();
    for (const { line, isInFence } of splitLinesByFence(content)) {
        if (isInFence) {
            continue;
        }
        for (const match of line.matchAll(VERSE_TOKEN_PATTERN)) {
            tokenSet.add(match[1].trim());
        }
    }
    return [...tokenSet];
}

/** A quoted passage as Markdown: its reference, then a verse a paragraph. */
export function toStudyQuoteLines(quote: StudyQuoteType) {
    const lines = [`> **${quote.title}** (${quote.bibleKey})`];
    for (const verse of quote.verses) {
        lines.push('>');
        lines.push(`> **${verse.number}** ${verse.text.trim()}`);
    }
    return lines;
}

/**
 * The content with its verse tokens put in: a token alone on its line is
 * the passage quoted, one inside a sentence its reference. A token the map
 * lacks is left as written -- the caller refuses those by name first.
 */
export function applyStudyVerseTokens(
    content: string,
    quoteMap: Map<string, StudyQuoteType>,
) {
    const outLines: string[] = [];
    for (const { line, isInFence } of splitLinesByFence(content)) {
        if (isInFence) {
            outLines.push(line);
            continue;
        }
        const ownLine = OWN_LINE_TOKEN_PATTERN.exec(line);
        const ownQuote =
            ownLine === null ? undefined : quoteMap.get(ownLine[1].trim());
        if (ownQuote !== undefined) {
            outLines.push(...toStudyQuoteLines(ownQuote));
            continue;
        }
        outLines.push(
            line.replace(VERSE_TOKEN_PATTERN, (whole, token: string) => {
                const quote = quoteMap.get(token.trim());
                return quote === undefined ? whole : quote.title;
            }),
        );
    }
    return outLines.join('\n');
}

const ALLOWED_TAG_PATTERN = /^<br\s*\/?>$/i;
const TAG_PATTERN = /<\/?[a-z][^>]*>?/gi;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;
const AUTOLINK_PATTERN = /<(?:https?:\/\/|mailto:)[^>\s]+>/gi;

function findHtmlTag(text: string) {
    const plain = text
        .replace(INLINE_CODE_PATTERN, '')
        .replace(AUTOLINK_PATTERN, '');
    for (const match of plain.matchAll(TAG_PATTERN)) {
        if (!ALLOWED_TAG_PATTERN.test(match[0])) {
            return match[0];
        }
    }
    return null;
}

/** Why one diagram will not be drawn by the preview, or null. */
export function checkStudyDiagram(source: string): string | null {
    if (/%%\s*\{/.test(source)) {
        return 'it sets its own options with %%{…}%% -- leave them out';
    }
    if (/javascript:/i.test(source)) {
        return 'it carries a script address';
    }
    const lines = source.split(/\r?\n/);
    if (
        lines.some((line) => {
            return /^\s*click\s/i.test(line);
        })
    ) {
        return 'it has a `click` line -- a study diagram is not pressed';
    }
    const tag = findHtmlTag(source);
    if (tag !== null) {
        return `it carries HTML (${tag}) -- write plain words in quotes`;
    }
    const first = lines.find((line) => {
        const trimmed = line.trim();
        return trimmed !== '' && !trimmed.startsWith('%%');
    });
    if (first === undefined) {
        return 'it is empty';
    }
    const kind = first.trim().split(/\s+/)[0];
    if (
        !STUDY_DIAGRAM_TYPE_LIST.some((one) => {
            return one === kind;
        })
    ) {
        return (
            `it starts with "${kind}" -- start with one of ` +
            STUDY_DIAGRAM_TYPE_LIST.join(', ')
        );
    }
    return null;
}

export type StudyLintType = {
    reasons: string[];
    diagrams: string[];
};

/**
 * Whether a study's Markdown can be written as it is: its fences closed,
 * no raw HTML outside code, and every diagram one the preview draws. Each
 * reason is a sentence for the model, naming the diagram by its number.
 */
export function lintStudyContent(
    content: string,
    maxDiagrams = STUDY_MAX_DIAGRAMS,
): StudyLintType {
    const reasons: string[] = [];
    const diagrams: string[] = [];
    let fence: string | null = null;
    let mermaidLines: string[] | null = null;
    for (const line of content.split(/\r?\n/)) {
        const match = FENCE_PATTERN.exec(line);
        if (fence === null) {
            if (match !== null) {
                fence = match[1];
                mermaidLines = MERMAID_FENCE_PATTERN.test(line) ? [] : null;
                continue;
            }
            const tag = findHtmlTag(line);
            if (tag !== null && reasons.length < 6) {
                reasons.push(
                    `Raw HTML (${tag}) is not written into a study file: ` +
                        'use Markdown -- #, -, **, > and tables.',
                );
            }
            continue;
        }
        if (match !== null && match[1] === fence) {
            if (mermaidLines !== null) {
                diagrams.push(mermaidLines.join('\n'));
            }
            fence = null;
            mermaidLines = null;
            continue;
        }
        mermaidLines?.push(line);
    }
    if (fence !== null) {
        reasons.push(`A ${fence} block is not closed.`);
    }
    if (diagrams.length > maxDiagrams) {
        reasons.push(
            `${diagrams.length} diagrams is more than ${maxDiagrams}: ` +
                (maxDiagrams === STUDY_MAX_DIAGRAMS
                    ? 'keep the 2 to 4 that teach the passage best.'
                    : 'keep the ones that teach the passage best.'),
        );
    }
    diagrams.forEach((source, index) => {
        const reason = checkStudyDiagram(source);
        if (reason !== null) {
            reasons.push(`Diagram ${index + 1} will not be drawn: ${reason}.`);
        }
    });
    return { reasons: [...new Set(reasons)], diagrams };
}

/**
 * The content without the diagrams at these places (0 is the first
 * ```mermaid block): what the help window does to a diagram that would not
 * draw after the model was asked once to fix it.
 */
export function dropStudyDiagrams(content: string, indexes: number[]) {
    const dropSet = new Set(indexes);
    const outLines: string[] = [];
    let fence: string | null = null;
    let diagramIndex = -1;
    let isDropping = false;
    for (const line of content.split('\n')) {
        const match = FENCE_PATTERN.exec(line);
        if (fence === null && match !== null) {
            fence = match[1];
            if (MERMAID_FENCE_PATTERN.test(line)) {
                diagramIndex += 1;
                isDropping = dropSet.has(diagramIndex);
            }
            if (!isDropping) {
                outLines.push(line);
            }
            continue;
        }
        if (fence !== null && match !== null && match[1] === fence) {
            fence = null;
            if (!isDropping) {
                outLines.push(line);
            }
            isDropping = false;
            continue;
        }
        if (!isDropping) {
            outLines.push(line);
        }
    }
    return outLines.join('\n');
}

/**
 * The model's part with a title of its own taken off: the app writes the
 * file's `#` title from the name, and two would read as a stutter.
 */
export function toStudyBody(content: string) {
    const lines = content.replace(/\r\n/g, '\n').trim().split('\n');
    if (lines.length > 0 && /^#\s/.test(lines[0])) {
        lines.shift();
    }
    return lines.join('\n').trim();
}

export type StudyFilePartsType = {
    title: string;
    passage: StudyQuoteType;
    isPassageCut: boolean;
    body: string;
    footnote: string;
};

/**
 * The whole file: the title, the passage quoted from the installed Bible,
 * the model's study, and one line saying who drafted it.
 */
export function composeStudyFile(parts: StudyFilePartsType) {
    const lines = [`# ${parts.title}`, '', ...toStudyQuoteLines(parts.passage)];
    if (parts.isPassageCut) {
        lines.push('>', '> …');
    }
    lines.push('', parts.body.trim(), '', '---', '', `*${parts.footnote}*`, '');
    return lines.join('\n');
}

/**
 * A short fingerprint of a file's text: a change is drafted from the file
 * as read, and saved only while the file still reads that way.
 */
export function toStudyTextHash(text: string) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `${text.length.toString(36)}-${hash.toString(16).padStart(8, '0')}`;
}

const HEADING_PATTERN = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const STUDY_HEADING_LINE_PATTERN = /^#{1,6}\s/;

/** How many of these lines are headings, a fenced block's left out. */
function countStudyHeadingLines(lines: string[]) {
    return splitLinesByFence(lines.join('\n')).filter(({ line, isInFence }) => {
        return !isInFence && STUDY_HEADING_LINE_PATTERN.test(line);
    }).length;
}
const RULE_PATTERN = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;

/**
 * A section's words as two drafts are compared: the blank lines and rules
 * at its end left out -- a rule between sections is a separator, and a
 * translation added after the last one starts with one (EC-478).
 */
function toComparedBody(lines: string[]) {
    const kept = [...lines];
    while (
        kept.length > 0 &&
        (kept[kept.length - 1].trim() === '' ||
            RULE_PATTERN.test(kept[kept.length - 1]))
    ) {
        kept.pop();
    }
    return kept.join('\n').trim();
}

/**
 * Every section by its heading, outside fenced blocks. A heading met again
 * -- the same words in a translation added under the study -- is a section
 * of its own (`Verse by Verse (2)`), never the first one changed.
 */
function toSectionMap(text: string) {
    const sectionMap = new Map<string, { heading: string; body: string }>();
    const seenCountMap = new Map<string, number>();
    let heading = '';
    let body: string[] = [];
    const flush = () => {
        const compared = toComparedBody(body);
        if (heading === '' && compared === '') {
            return;
        }
        const count = (seenCountMap.get(heading) ?? 0) + 1;
        seenCountMap.set(heading, count);
        sectionMap.set(count === 1 ? heading : `${heading} (${count})`, {
            heading,
            body: compared,
        });
    };
    for (const { line, isInFence } of splitLinesByFence(
        text.replace(/\r\n/g, '\n'),
    )) {
        const match = isInFence ? null : HEADING_PATTERN.exec(line);
        if (match !== null) {
            flush();
            heading = match[1];
            body = [];
            continue;
        }
        body.push(line);
    }
    flush();
    return sectionMap;
}

function countLines(text: string) {
    const countMap = new Map<string, number>();
    for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
        const key = line.trim();
        if (key !== '') {
            countMap.set(key, (countMap.get(key) ?? 0) + 1);
        }
    }
    return countMap;
}

export type StudyChangeType = {
    addedSections: string[];
    removedSections: string[];
    changedSections: string[];
    addedLines: number;
    removedLines: number;
};

/** What a change does to a study file, by section and by line. */
export function summarizeStudyChange(
    oldText: string,
    newText: string,
): StudyChangeType {
    // The app's last lines are no section's words.
    const oldMap = toSectionMap(splitStudyFooter(oldText).body);
    const newMap = toSectionMap(splitStudyFooter(newText).body);
    const addedSections: string[] = [];
    const changedSections: string[] = [];
    for (const [key, section] of newMap) {
        const old = oldMap.get(key);
        if (old === undefined) {
            addedSections.push(section.heading);
        } else if (old.body !== section.body) {
            changedSections.push(section.heading);
        }
    }
    const removedSections = [...oldMap.entries()]
        .filter(([key]) => {
            return !newMap.has(key);
        })
        .map(([, section]) => {
            return section.heading;
        });
    const oldCount = countLines(oldText);
    const newCount = countLines(newText);
    let addedLines = 0;
    let removedLines = 0;
    for (const [line, count] of newCount) {
        addedLines += Math.max(0, count - (oldCount.get(line) ?? 0));
    }
    for (const [line, count] of oldCount) {
        removedLines += Math.max(0, count - (newCount.get(line) ?? 0));
    }
    return {
        addedSections: addedSections.filter(Boolean),
        removedSections: removedSections.filter(Boolean),
        changedSections: changedSections.filter((heading) => {
            return heading !== '';
        }),
        addedLines,
        removedLines,
    };
}

/** One English sentence for the model and the card about a change. */
export function describeStudyChange(change: StudyChangeType) {
    const parts: string[] = [];
    if (change.addedSections.length > 0) {
        parts.push(`adds ${toNamesText(change.addedSections)}`);
    }
    if (change.changedSections.length > 0) {
        parts.push(`changes ${toNamesText(change.changedSections)}`);
    }
    if (change.removedSections.length > 0) {
        parts.push(`removes ${toNamesText(change.removedSections)}`);
    }
    const lineText = `${change.addedLines} line(s) in, ${change.removedLines} out`;
    if (parts.length === 0) {
        return change.addedLines === 0 && change.removedLines === 0
            ? 'Nothing changes.'
            : `It changes words inside the sections (${lineText}).`;
    }
    return `It ${parts.join('; ')} (${lineText}).`;
}

function quote(text: string) {
    return `“${text}”`;
}

// A whole translation adds every heading the study has: five are named.
const MAX_NAMED_SECTIONS = 5;

function toNamesText(headings: string[]) {
    const named = headings.slice(0, MAX_NAMED_SECTIONS).map(quote).join(', ');
    return headings.length > MAX_NAMED_SECTIONS
        ? `${named} and ${headings.length - MAX_NAMED_SECTIONS} more`
        : named;
}

// --- a change by part (EC-479) -----------------------------------------------

// The app's own last lines (`composeStudyFile`): a rule, then the footnote
// in italics, and nothing after them.
const FOOTER_PATTERN =
    /\n[ \t]{0,3}-{3,}[ \t]*\n(?:[ \t]*\n)*[ \t]*\*[^*\n][^\n]*\*[ \t]*\n*$/;

/**
 * The file and the app's last lines apart: `body + footer` is the text as
 * it was (line ends made `\n`). A file with no such lines has no footer.
 */
export function splitStudyFooter(text: string) {
    const normalized = String(text ?? '').replace(/\r\n/g, '\n');
    const match = FOOTER_PATTERN.exec(normalized);
    if (match === null) {
        return { body: normalized, footer: '' };
    }
    return {
        body: normalized.slice(0, match.index),
        footer: normalized.slice(match.index),
    };
}

/** The body and the footer joined again, a blank line between them. */
function joinStudyFooter(body: string, footer: string) {
    const trimmed = body.trimEnd();
    if (footer === '') {
        return `${trimmed}\n`;
    }
    return `${trimmed}\n${footer.endsWith('\n') ? footer : `${footer}\n`}`;
}

export type StudySectionType = {
    level: number;
    heading: string;
    /** The heading's line, and the first line past the section. */
    start: number;
    end: number;
};

/** A heading as it is compared: no #, no bold, no case, one space. */
export function toStudyHeadingKey(text: string) {
    return String(text ?? '')
        .replace(/^\s*#{1,6}\s*/, '')
        .replace(/\s+#+\s*$/, '')
        .replace(/\*\*|__/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Every section of the text: a heading outside a fenced block, down to the
 * next heading of its level or above (a `##` holds its `###`s).
 */
export function listStudySections(text: string): StudySectionType[] {
    const marked = splitLinesByFence(text.replace(/\r\n/g, '\n'));
    const headings: { level: number; heading: string; line: number }[] = [];
    marked.forEach(({ line, isInFence }, index) => {
        if (isInFence) {
            return;
        }
        const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
        if (match !== null) {
            headings.push({
                level: match[1].length,
                heading: match[2],
                line: index,
            });
        }
    });
    return headings.map((one, index) => {
        const next = headings.slice(index + 1).find((other) => {
            return other.level <= one.level;
        });
        return {
            level: one.level,
            heading: one.heading,
            start: one.line,
            end: next === undefined ? marked.length : next.line,
        };
    });
}

/**
 * What opens the list of a file's headings wherever one is written for a
 * model -- a long file's read note, a section not found -- and what the
 * help window looks for to take the list off a read (EC-499).
 */
export const STUDY_HEADINGS_LEAD = 'Its headings:';

/** The sections as a model reads them: `## Background`, one a line. */
export function toStudyOutline(text: string, maxCount = 40) {
    const sections = listStudySections(text);
    const lines = sections.slice(0, maxCount).map((section) => {
        return `${'#'.repeat(section.level)} ${section.heading}`;
    });
    if (sections.length > maxCount) {
        lines.push(`… and ${sections.length - maxCount} more`);
    }
    return lines.join('\n');
}

/**
 * The ONE section a heading's words name, or why not: none there, or the
 * same words twice (`twiceAdvice` says what to do then), with the headings
 * the text has.
 */
function findStudySection(
    body: string,
    section: string,
    twiceAdvice: string,
): { section: StudySectionType } | { reason: string } {
    const key = toStudyHeadingKey(section);
    const found = listStudySections(body).filter((one) => {
        return toStudyHeadingKey(one.heading) === key;
    });
    if (found.length === 1) {
        return { section: found[0] };
    }
    const outline = toStudyOutline(body);
    return {
        reason:
            (found.length === 0
                ? `The file has no section “${section}”.`
                : `The file has ${found.length} sections called ` +
                  `“${section}”; ${twiceAdvice}.`) +
            (outline === ''
                ? ' It has no headings: add to it with `append`.'
                : ` ${STUDY_HEADINGS_LEAD}\n${outline}`),
    };
}

/**
 * One section of a long file as `read` gives it (EC-481): its heading's
 * line down to the next heading of its level or above -- what is past the
 * first 16 KB, a translation under the study included, is reached so.
 */
export function readStudySection(
    text: string,
    section: string,
): { heading: string; text: string } | { reason: string } {
    const { body } = splitStudyFooter(text);
    const found = findStudySection(
        body,
        String(section ?? '').trim(),
        'read the whole file instead',
    );
    if ('reason' in found) {
        return found;
    }
    const { start, end } = holdStudySectionToHalf(body, found.section);
    return {
        heading: found.section.heading,
        text: dropEdgeBlankLines(body.split('\n').slice(start, end)).join('\n'),
    };
}

// A line Markdown takes as a block of its own, or as the inside of one: a
// heading, a list item, a quote, a table row, a rule, a footnote, HTML, and
// an indented line (code, or a list item's own words).
const BLOCK_LINE_PATTERN =
    /^(?:\s{0,3}(?:#{1,6}(?:\s|$)|[-*+](?:\s|$)|\d{1,3}[.)](?:\s|$)|>|\||(?:-{3,}|\*{3,}|_{3,}|={3,})\s*$|\[\^[^\]\n]+\]:|<)| {4}|\t)/;
// A line that ends a sentence in any script, a quote or a mark after it.
const SENTENCE_END_PATTERN =
    /[\p{Sentence_Terminal}:;]["'\p{Pf}\p{Pe}*_]*\s*$/u;
// A line led by a reference -- `John 3:1-2`, `1 John 2:3`, `3:16` -- in any
// script's letters and digits, or by a bold label.
const LEAD_PATTERN =
    /^\s{0,3}(?:\*\*[^*\n]+\*\*|(?:\p{Nd}\s?)?\p{L}[\p{L}\p{M}.]*(?:\s\p{L}[\p{L}\p{M}.]*)?\s+\p{Nd}{1,3}:\p{Nd}{1,3}|\p{Nd}{1,3}:\p{Nd}{1,3})/u;
// A line that already breaks: two spaces or a backslash at its end.
const HARD_BREAK_PATTERN = /(?: {2,}|\\)$/;

/** Whether lines run into one paragraph were written one item a line. */
function checkIsLinePerItem(lines: string[]) {
    if (
        lines.some((line) => {
            return HARD_BREAK_PATTERN.test(line);
        })
    ) {
        return false;
    }
    return (
        lines.every((line) => {
            return LEAD_PATTERN.test(line);
        }) ||
        lines.slice(0, -1).every((line) => {
            return SENTENCE_END_PATTERN.test(line);
        })
    );
}

/**
 * The text with lines written one item a line kept apart (EC-482):
 * Markdown joins lines with no blank line between them into ONE paragraph,
 * so a study's `John 3:1-2 …` / `John 3:3-8 …` lines -- the user's own
 * John 3 file -- were drawn as a single block. A run of plain lines each
 * led by a reference, or each ending a sentence, gets a blank line between
 * its lines. Fenced blocks, lists, quotes, tables and the words straight
 * under one of them (they continue it) are left alone, and so is a run
 * whose every line is in `keptText` -- the file as it was, which a change
 * does not rewrite where it was not asked to.
 */
export function separateStudyLines(text: string, keptText = '') {
    const keptLineSet = new Set(
        String(keptText ?? '')
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((line) => {
                return line.trim();
            }),
    );
    const outLines: string[] = [];
    let run: string[] = [];
    let isContinuing = false;
    const flush = () => {
        const isSeparated =
            !isContinuing &&
            run.length > 1 &&
            checkIsLinePerItem(run) &&
            !run.every((line) => {
                return keptLineSet.has(line.trim());
            });
        run.forEach((line, index) => {
            if (isSeparated && index > 0) {
                outLines.push('');
            }
            outLines.push(line);
        });
        run = [];
    };
    let previous = '';
    for (const { line, isInFence } of splitLinesByFence(
        String(text ?? '').replace(/\r\n/g, '\n'),
    )) {
        const isPlain =
            !isInFence && line.trim() !== '' && !BLOCK_LINE_PATTERN.test(line);
        if (!isPlain) {
            flush();
            outLines.push(line);
            previous = isInFence ? '' : line;
            continue;
        }
        if (run.length === 0) {
            // Words straight under a list item, a quote or a table row are
            // more of it, not a paragraph of their own.
            isContinuing =
                previous.trim() !== '' && !/^\s{0,3}#{1,6}\s/.test(previous);
        }
        run.push(line);
        previous = line;
    }
    flush();
    return outLines.join('\n');
}

export type StudyEditType = {
    /** The heading of the section changed, as the file writes it. */
    section?: string;
    /** That section's new text; without `section`, the whole new body. */
    content?: string;
    /** Words added at the end of the section, or of the file. */
    append?: string;
};

function dropEdgeBlankLines(lines: string[]) {
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start].trim() === '') {
        start += 1;
    }
    while (end > start && lines[end - 1].trim() === '') {
        end -= 1;
    }
    return lines.slice(start, end);
}

const LIST_ITEM_PATTERN = /^\s{0,3}(?:[-*+]|\d{1,9}[.)])\s/;

/**
 * Words added under some lines: a blank line between them, except more
 * items for the list the lines end in, which go on that list -- a gap would
 * spread every item of it apart.
 */
function joinAppendedLines(lines: string[], append: string) {
    const kept = dropEdgeBlankLines(lines);
    const appended = append.split('\n');
    const isListGoingOn =
        LIST_ITEM_PATTERN.test(kept[kept.length - 1] ?? '') &&
        LIST_ITEM_PATTERN.test(appended[0] ?? '');
    return [...kept, ...(isListGoingOn ? [] : ['']), ...appended];
}

// --- a quoted passage kept under new words (2026-11-13, EC-548) ---------------
//
// The app writes a study's passage right under its title
// (`composeStudyFile`), so the title's own words ARE the passage: new
// words sent for them -- an introduction asked for at the top -- had taken
// the passage out too, all 73 quoted lines of the user's John 3 study.

/** A passage the app quoted (`toStudyQuoteLines`) among some lines. */
type StudyPassageBlockType = {
    start: number;
    end: number;
    /** Its reference as its Bible writes it, and that Bible. */
    title: string;
    bibleKey: string;
};

/**
 * The passages the app quoted among these lines, outside a fenced block:
 * the `> **John 3:1-36** (KJV)` line and the quote's lines under it.
 */
function listStudyPassageBlocks(lines: string[]): StudyPassageBlockType[] {
    const marked = splitLinesByFence(lines.join('\n'));
    const blocks: StudyPassageBlockType[] = [];
    let index = 0;
    while (index < marked.length) {
        const head = marked[index].isInFence
            ? null
            : QUOTE_HEAD_PATTERN.exec(marked[index].line);
        if (head === null) {
            index += 1;
            continue;
        }
        let end = index + 1;
        while (
            end < marked.length &&
            !marked[end].isInFence &&
            /^\s{0,3}>/.test(marked[end].line)
        ) {
            end += 1;
        }
        blocks.push({
            start: index,
            end,
            title: head[1].trim(),
            bibleKey: head[2].trim(),
        });
        index = end;
    }
    return blocks;
}

/**
 * Whether words place a passage of their own: one quoted, or a verse token
 * alone on its line (`[^John 3:16]`), which the draft quotes.
 */
function checkHasStudyPassage(lines: string[]) {
    return (
        listStudyPassageBlocks(lines).length > 0 ||
        splitLinesByFence(lines.join('\n')).some(({ line, isInFence }) => {
            return !isInFence && OWN_LINE_TOKEN_PATTERN.test(line);
        })
    );
}

/** The passages the app quoted that a part's new words kept (EC-548). */
export type StudyKeptPassagesType = {
    heading: string;
    passages: { title: string; bibleKey: string }[];
    /** Whether they stand above the new words, as they stood first. */
    isAbove: boolean;
};

/**
 * A part's new words (`newLines`, its parts' too when they write them)
 * with the passages its old words quoted (`oldLines`) put back where they
 * stood -- first, when nothing but blank lines came before them, else at
 * the end of its own words, above its parts -- or null when the old words
 * quoted none, or the new words place a passage of their own.
 */
function keepStudyPassages(oldLines: string[], newLines: string[]) {
    const blocks = listStudyPassageBlocks(oldLines);
    if (blocks.length === 0 || checkHasStudyPassage(newLines)) {
        return null;
    }
    const passageLines = blocks.flatMap((block, index) => {
        return [
            ...(index > 0 ? [''] : []),
            ...oldLines.slice(block.start, block.end),
        ];
    });
    const isAbove = oldLines.slice(0, blocks[0].start).every((line) => {
        return line.trim() === '';
    });
    const headAt = splitLinesByFence(newLines.join('\n')).findIndex(
        ({ line, isInFence }) => {
            return !isInFence && STUDY_HEADING_LINE_PATTERN.test(line);
        },
    );
    const ownEnd = headAt === -1 ? newLines.length : headAt;
    const own = dropEdgeBlankLines(newLines.slice(0, ownEnd));
    const parts = dropEdgeBlankLines(newLines.slice(ownEnd));
    const ownWithPassages = isAbove
        ? [...passageLines, ...(own.length > 0 ? ['', ...own] : [])]
        : [...(own.length > 0 ? [...own, ''] : []), ...passageLines];
    return {
        lines: [
            '',
            ...ownWithPassages,
            ...(parts.length > 0 ? ['', ...parts] : []),
        ],
        passages: blocks.map((block) => {
            return { title: block.title, bibleKey: block.bibleKey };
        }),
        isAbove,
    };
}

/**
 * What the model and the card are told of the passages kept beside a
 * part's new words (EC-548), and how to quote another or take one out.
 * '' for none.
 */
export function describeStudyKeptPassages(kept: StudyKeptPassagesType | null) {
    if (kept === null || kept.passages.length === 0) {
        return '';
    }
    const isOne = kept.passages.length === 1;
    const names = toNamesText(
        kept.passages.map((one) => {
            return one.title;
        }),
    );
    return (
        `${isOne ? 'The passage' : 'The passages'} ${names} quoted under ` +
        `“${kept.heading}” ${isOne ? 'was' : 'were'} kept as ` +
        `${isOne ? 'it was' : 'they were'}, ` +
        `${kept.isAbove ? 'above' : 'below'} these words: the app quotes ` +
        `${isOne ? 'it' : 'them'} from the Bible. To quote another passage ` +
        'there, put its reference alone on a line of the words, as ' +
        '[^John 3:16]; to take one out, draft `remove` with `section` ' +
        `${quote(kept.passages[0].title)}.`
    );
}

// --- a quoted passage is the Bible's words (2026-11-13, EC-549) --------------
//
// New words that copy a passage the app quoted -- the whole part rewritten
// with it, or the file -- carry it as the model wrote it out, and 73 lines
// written out again are where words drift: a Bible's words changed under
// its name. `replace` already writes only in the study's own words.

/** A passage put back as the app quoted it (EC-549). */
export type StudyRestoredPassageType = {
    title: string;
    bibleKey: string;
    /** How many of its lines the new words had changed. */
    lineCount: number;
};

function toPassageKey(block: StudyPassageBlockType) {
    return JSON.stringify([block.title, block.bibleKey]);
}

function checkIsSameQuote(lines: string[], otherLines: string[]) {
    return (
        lines.length === otherLines.length &&
        lines.every((line, index) => {
            return line.trimEnd() === otherLines[index].trimEnd();
        })
    );
}

// A verse's number as the app writes it (`**16**`, `**3:16**`) -- or the
// head's reference -- with what leads it on the line.
const QUOTE_LEAD_PATTERN = /^\s{0,3}>\s*\*\*[^*\n]+\*\*\s*/;
const QUOTE_MARK_PATTERN = /^\s{0,3}>\s?/;
const EMPHASIS_MARK_PATTERN = /[*_]/g;
const QUOTE_NUMBER_PATTERN = /^\s{0,3}>\s*\*\*([^*\n]+)\*\*/;
const QUOTE_CUT_LINE = '> …';

/**
 * A quote line's words as a Bible gives them (EC-565): what leads the line
 * -- the `>` and a verse's number -- exactly as written, then the rest with
 * no emphasis mark, so words put in bold or italics are the same words.
 */
function toQuoteWords(line: string) {
    const trimmed = line.trimEnd();
    const lead =
        QUOTE_LEAD_PATTERN.exec(trimmed)?.[0] ??
        QUOTE_MARK_PATTERN.exec(trimmed)?.[0] ??
        '';
    return `${lead}\n${trimmed
        .slice(lead.length)
        .replace(EMPHASIS_MARK_PATTERN, '')}`;
}

/**
 * A quote the app quoted (`quoted`) with each line of `sent` holding the
 * same words kept as sent -- a phrase put in bold or italics, or taken out
 * of them (EC-565: asked to put a verse in bold, the passage had been put
 * back without it) -- and every other line as quoted. A quote with lines
 * added or taken out is the quote as quoted. `changedCount` is how many
 * lines came from the quote: 0 when `sent` holds its words.
 */
export function mergeStudyQuoteLines(quoted: string[], sent: string[]) {
    if (quoted.length !== sent.length) {
        return {
            lines: quoted,
            changedCount: countChangedQuoteLines(quoted, sent),
        };
    }
    let changedCount = 0;
    const lines = quoted.map((line, index) => {
        if (toQuoteWords(line) === toQuoteWords(sent[index])) {
            return sent[index];
        }
        changedCount += 1;
        return line;
    });
    return { lines, changedCount };
}

/** The lines of one quote the other lacks, the larger count of the two. */
function countChangedQuoteLines(lines: string[], otherLines: string[]) {
    const countMissing = (from: string[], against: string[]) => {
        const bag = new Map<string, number>();
        for (const line of against) {
            bag.set(line.trimEnd(), (bag.get(line.trimEnd()) ?? 0) + 1);
        }
        return from.filter((line) => {
            const count = bag.get(line.trimEnd()) ?? 0;
            bag.set(line.trimEnd(), count - 1);
            return count <= 0;
        }).length;
    };
    return Math.max(
        countMissing(lines, otherLines),
        countMissing(otherLines, lines),
    );
}

/**
 * New words with each passage the app quoted in the old text put back as
 * it was quoted, where the words copied it with words changed (EC-549): a
 * quote whose reference AND Bible are those of a quote the old text holds
 * -- the same reference and Bible quoted twice apart, written as it is.
 * A quote of another reference or Bible is a new one, written as it is.
 */
export function restoreStudyPassages(oldText: string, newText: string) {
    const oldLines = String(oldText ?? '')
        .replace(/\r\n/g, '\n')
        .split('\n');
    const quoteMap = new Map<string, string[] | null>();
    for (const block of listStudyPassageBlocks(oldLines)) {
        const key = toPassageKey(block);
        const lines = oldLines.slice(block.start, block.end);
        const known = quoteMap.get(key);
        if (known === undefined) {
            quoteMap.set(key, lines);
        } else if (known !== null && !checkIsSameQuote(known, lines)) {
            quoteMap.set(key, null);
        }
    }
    const restored: StudyRestoredPassageType[] = [];
    if (quoteMap.size === 0) {
        return { text: newText, restored };
    }
    const newLines = String(newText ?? '').split('\n');
    const outLines: string[] = [];
    let cursor = 0;
    for (const block of listStudyPassageBlocks(newLines)) {
        const lines = newLines.slice(block.start, block.end);
        const quoted = quoteMap.get(toPassageKey(block));
        outLines.push(...newLines.slice(cursor, block.start));
        // A line holding the quote's words is kept as sent: a phrase put
        // in bold or italics, or taken out of them (EC-565).
        const merged =
            quoted === undefined || quoted === null
                ? null
                : mergeStudyQuoteLines(quoted, lines);
        if (merged === null || merged.changedCount === 0) {
            outLines.push(...lines);
        } else {
            outLines.push(...merged.lines);
            restored.push({
                title: block.title,
                bibleKey: block.bibleKey,
                lineCount: merged.changedCount,
            });
        }
        cursor = block.end;
    }
    if (restored.length === 0) {
        return { text: newText, restored };
    }
    outLines.push(...newLines.slice(cursor));
    return { text: outLines.join('\n'), restored };
}

/**
 * What the model and the card are told of passages put back as quoted
 * (EC-549), and how to quote another. '' for none.
 */
export function describeStudyRestoredPassages(
    restored: readonly StudyRestoredPassageType[],
) {
    if (restored.length === 0) {
        return '';
    }
    const isOne = restored.length === 1;
    const names = toNamesText(
        restored.map((one) => {
            return one.title;
        }),
    );
    const lineCount = restored.reduce((sum, one) => {
        return sum + one.lineCount;
    }, 0);
    return (
        `${isOne ? 'The passage' : 'The passages'} ${names} ` +
        `${isOne ? 'was' : 'were'} put back as the app quoted ` +
        `${isOne ? 'it' : 'them'} from the Bible: the words sent changed ` +
        `${lineCount} of ${isOne ? 'its' : 'their'} line(s), and a quoted ` +
        "passage is the Bible's own words. To quote another passage, put " +
        'its reference alone on a line, as [^John 3:16].'
    );
}

// --- a passage quoted under a Bible's name is that Bible's (EC-565) ----------
//
// New words can carry a passage in the app's own form -- `> **Romans 5:8**
// (KJV)` and a verse a line -- that the file never quoted: a model copying
// the form of the passages it read, its verse written from memory. Saved,
// the study shows words under a Bible's name that the Bible may not have.
// The worker quotes such a passage again from that Bible
// (`requoteNewStudyPassages` in `agentStudyFileHelpers.ts`).

/** A passage new words quote that the old text does not (EC-565). */
export type StudyNewPassageType = {
    start: number;
    end: number;
    /** Its reference and Bible as the words write them. */
    title: string;
    bibleKey: string;
    lines: string[];
};

/**
 * The passages new words quote in the app's own form, outside a fenced
 * block, whose reference AND Bible no quote of the old text has -- the
 * ones the file quotes already are `restoreStudyPassages`'. Lines are
 * counted as `newText.split('\n')` counts them.
 */
export function listStudyNewPassages(
    oldText: string,
    newText: string,
): StudyNewPassageType[] {
    const oldKeySet = new Set(
        listStudyPassageBlocks(
            String(oldText ?? '')
                .replace(/\r\n/g, '\n')
                .split('\n'),
        ).map(toPassageKey),
    );
    const newLines = String(newText ?? '').split('\n');
    return listStudyPassageBlocks(newLines)
        .filter((block) => {
            return !oldKeySet.has(toPassageKey(block));
        })
        .map((block) => {
            return {
                ...block,
                lines: newLines.slice(block.start, block.end),
            };
        });
}

function listQuoteVerseNumbers(lines: string[]) {
    return lines.slice(1).flatMap((line) => {
        const match = QUOTE_NUMBER_PATTERN.exec(line);
        return match === null ? [] : [match[1].trim()];
    });
}

/**
 * How many verses to quote a new passage to: as many as it holds when it
 * ends where the app cuts a quote (`> …`) -- a translation's passages are
 * quoted so -- else as far as a study's own passage goes.
 */
export function toStudyQuoteMaxVerses(lines: string[]) {
    const isCut = lines.at(-1)?.trimEnd() === QUOTE_CUT_LINE;
    const count = listQuoteVerseNumbers(lines).length;
    return isCut && count > 0 ? count : STUDY_PASSAGE_MAX_VERSES;
}

/**
 * Whether a Bible's quote of a new passage's reference (`quotedTitle`, its
 * lines) is the passage the words meant: the reference reads the same, or
 * the quote holds every verse the words number. A reference read as other
 * verses is no ground to rewrite the words.
 */
export function checkIsSameStudyPassage(
    passage: StudyNewPassageType,
    quotedTitle: string,
    quotedLines: string[],
) {
    const toKey = (text: string) => {
        return text.replace(/\s+/g, ' ').trim();
    };
    if (toKey(passage.title) === toKey(quotedTitle)) {
        return true;
    }
    const quotedSet = new Set(listQuoteVerseNumbers(quotedLines));
    const numbers = listQuoteVerseNumbers(passage.lines);
    return (
        numbers.length > 0 &&
        numbers.every((number) => {
            return quotedSet.has(number);
        })
    );
}

/** Some ranges of `text.split('\n')` written anew, every other line kept. */
export function replaceStudyLineRanges(
    text: string,
    ranges: readonly { start: number; end: number; lines: string[] }[],
) {
    const lines = String(text ?? '').split('\n');
    const outLines: string[] = [];
    let cursor = 0;
    for (const range of [...ranges].sort((a, b) => {
        return a.start - b.start;
    })) {
        outLines.push(...lines.slice(cursor, range.start), ...range.lines);
        cursor = range.end;
    }
    outLines.push(...lines.slice(cursor));
    return outLines.join('\n');
}

/** A new passage quoted again from the Bible it names (EC-565). */
export type StudyRequotedPassageType = {
    title: string;
    bibleKey: string;
    /** How many of its lines the words sent had otherwise. */
    lineCount: number;
};

/**
 * What the model and the card are told of new passages quoted again from
 * the Bibles they name (EC-565), and how to quote one. '' for none.
 */
export function describeStudyRequotedPassages(
    requoted: readonly StudyRequotedPassageType[],
) {
    if (requoted.length === 0) {
        return '';
    }
    const isOne = requoted.length === 1;
    const named = requoted.slice(0, MAX_NAMED_SECTIONS).map((one) => {
        return `${quote(one.title)} (${one.bibleKey})`;
    });
    const names =
        requoted.length > MAX_NAMED_SECTIONS
            ? `${named.join(', ')} and ${requoted.length - MAX_NAMED_SECTIONS} more`
            : named.join(', ');
    const lineCount = requoted.reduce((sum, one) => {
        return sum + one.lineCount;
    }, 0);
    return (
        `${isOne ? 'The passage' : 'The passages'} ${names} ` +
        `${isOne ? 'was' : 'were'} quoted from ` +
        `${isOne ? 'that Bible as it reads' : 'their Bibles as they read'} ` +
        `there: the words sent had ${lineCount} of ` +
        `${isOne ? 'its' : 'their'} line(s) otherwise, and a passage under a ` +
        "Bible's name is that Bible's own words. To quote a passage, put its " +
        'reference alone on a line, as [^John 3:16].'
    );
}

/** What was kept beside a part's new words: its parts, then its passages. */
export function describeStudyEditKept(edited: {
    keptParts?: StudyKeptPartsType;
    keptPassages?: StudyKeptPassagesType;
}) {
    return [
        describeStudyKeptParts(edited.keptParts ?? null),
        describeStudyKeptPassages(edited.keptPassages ?? null),
    ]
        .filter((sentence) => {
            return sentence !== '';
        })
        .join(' ');
}

/**
 * The text with ONE change made by part: a section given new words or more
 * words, or words added at the end -- before the app's last lines, which
 * stay last. A section is named by its heading's words; one not there, or
 * named twice, is refused with the headings the file has. New words that
 * write no heading under their first line are the part's OWN words, and
 * the parts it holds stay under them (`keptParts`); a heading alone
 * renames the part (EC-544). A passage the app quoted in its own words
 * stays beside new words that place none (`keptPassages`, EC-548).
 */
export function applyStudyEdit(
    oldText: string,
    edit: StudyEditType,
):
    | {
          text: string;
          keptParts?: StudyKeptPartsType;
          keptPassages?: StudyKeptPassagesType;
      }
    | { reason: string } {
    const { body, footer } = splitStudyFooter(oldText);
    const section = String(edit.section ?? '').trim();
    const content = String(edit.content ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
    const append = String(edit.append ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
    if (section === '') {
        if (append === '') {
            return {
                reason:
                    'Give `append` (the words added at the end), or ' +
                    '`section` (a heading) with its new `content`.',
            };
        }
        return {
            text: joinStudyFooter(
                joinAppendedLines(body.split('\n'), append).join('\n'),
                footer,
            ),
        };
    }
    if (content === '' && append === '') {
        return {
            reason:
                `Give the new words of “${section}” in \`content\`, or the ` +
                'words to add to it in `append`.',
        };
    }
    const found = findStudySection(
        body,
        section,
        'change one with its whole text instead',
    );
    if ('reason' in found) {
        return found;
    }
    // Never past the rule a translation after it opens with (EC-571).
    const target = holdStudySectionToHalf(body, found.section);
    const lines = body.split('\n');
    // The parts it holds (EC-544): its heading, its own words down to the
    // first of them, and those parts, each kept unless the words write it.
    const inner = listStudySections(body).filter((one) => {
        return one.start > target.start && one.start < target.end;
    });
    const ownEnd = inner[0]?.start ?? target.end;
    let headLine = lines[target.start];
    let ownLines = lines.slice(target.start + 1, ownEnd);
    let partLines = lines.slice(ownEnd, target.end);
    let isOwnWritten = false;
    let keptPassages: StudyKeptPassagesType | null = null;
    if (content !== '') {
        const newLines = content.split('\n');
        const hasHead = STUDY_HEADING_LINE_PATTERN.test(newLines[0]);
        const words = hasHead ? newLines.slice(1) : ['', ...newLines];
        if (hasHead) {
            headLine = newLines[0];
        }
        const oldOwnLines = ownLines;
        if (countStudyHeadingLines(words) > 0) {
            // Its parts written too: the whole part is these words.
            ownLines = words;
            partLines = [];
        } else if (words.join('').trim() !== '') {
            ownLines = words;
            isOwnWritten = true;
        }
        // A heading alone renames the part: every word of it is kept.
        if (ownLines !== oldOwnLines) {
            // The passage the app quoted there stays (EC-548).
            const kept = keepStudyPassages(oldOwnLines, ownLines);
            if (kept !== null) {
                ownLines = kept.lines;
                keptPassages = {
                    heading: target.heading,
                    passages: kept.passages,
                    isAbove: kept.isAbove,
                };
            }
        }
    }
    if (append !== '') {
        const isPartAdded = STUDY_HEADING_LINE_PATTERN.test(
            append.split('\n')[0],
        );
        if (partLines.length > 0 && !isPartAdded) {
            // Words, not a part: at the end of its own words, never in
            // its last part.
            ownLines = joinAppendedLines([headLine, ...ownLines], append).slice(
                1,
            );
            isOwnWritten = true;
        } else {
            ownLines = joinAppendedLines(
                [headLine, ...ownLines, ...partLines],
                append,
            ).slice(1);
            partLines = [];
        }
    }
    const sectionLines = [
        ...dropEdgeBlankLines([headLine, ...ownLines]),
        ...(partLines.length > 0 ? ['', ...dropEdgeBlankLines(partLines)] : []),
    ];
    const keptLevel = Math.min(
        ...inner.map((one) => {
            return one.level;
        }),
    );
    const keptParts =
        isOwnWritten && partLines.length > 0
            ? {
                  heading: target.heading,
                  parts: inner
                      .filter((one) => {
                          return one.level === keptLevel;
                      })
                      .map((one) => {
                          return one.heading;
                      }),
              }
            : null;
    const before = lines.slice(0, target.start);
    const after = lines.slice(target.end);
    const outLines = [
        ...before,
        ...dropEdgeBlankLines(sectionLines),
        ...(after.length > 0 ? ['', ...dropEdgeBlankLines(after)] : []),
    ];
    return {
        text: joinStudyFooter(outLines.join('\n'), footer),
        ...(keptParts === null ? {} : { keptParts }),
        ...(keptPassages === null ? {} : { keptPassages }),
    };
}

/** The parts a part's new words were put above (EC-544). */
export type StudyKeptPartsType = { heading: string; parts: string[] };

/**
 * What the model and the card are told of parts kept under new words
 * (EC-544): a model writing the words under a heading had taken out every
 * part it held -- under a study's title, the whole study. '' for none.
 */
export function describeStudyKeptParts(kept: StudyKeptPartsType | null) {
    if (kept === null || kept.parts.length === 0) {
        return '';
    }
    return (
        `The parts under “${kept.heading}” were kept as they were, below ` +
        `these words: ${toNamesText(kept.parts)}. To take one out, draft it ` +
        'with `remove`.'
    );
}

// --- a part taken out (2026-11-13, EC-543) -----------------------------------
//
// No call took a part out of a study: `section` with no words is refused,
// and a whole text leaving a part out of a long file is refused too
// (EC-502). Asked to take the prayer out of a 44 KB study, or to drop an
// old translation for a new one, the model had nothing to send.

/** Why a removal sent with words beside it is refused. */
export const STUDY_REMOVE_ALONE_REASON =
    '`remove` takes a part out whole: send it with `file` and `section` ' +
    'alone, without `content`, `append` or `replace`.';

function dropTrailingBlankLines(lines: string[]) {
    let end = lines.length;
    while (end > 0 && lines[end - 1].trim() === '') {
        end -= 1;
    }
    return lines.slice(0, end);
}

function checkIsRuleLine(line: string | undefined) {
    return line !== undefined && RULE_PATTERN.test(line);
}

/**
 * The text with ONE passage the app quoted taken out (EC-548), named by
 * its reference as the file writes it, its Bible after it or not: null
 * when no passage is, why not when two are.
 */
function removeStudyPassage(
    body: string,
    footer: string,
    section: string,
): { text: string } | { reason: string } | null {
    const key = toStudyHeadingKey(section);
    const lines = body.split('\n');
    const found = listStudyPassageBlocks(lines).filter((block) => {
        return (
            toStudyHeadingKey(block.title) === key ||
            toStudyHeadingKey(`${block.title} (${block.bibleKey})`) === key
        );
    });
    if (found.length === 0) {
        return null;
    }
    if (found.length > 1) {
        return {
            reason:
                `The file quotes ${quote(section)} ${found.length} times; ` +
                'only their place tells them apart, so the person takes ' +
                'the one out in the editor.',
        };
    }
    const head = dropTrailingBlankLines(lines.slice(0, found[0].start));
    const rest = dropEdgeBlankLines(lines.slice(found[0].end));
    const outLines = [
        ...head,
        ...(head.length > 0 && rest.length > 0 ? [''] : []),
        ...rest,
    ];
    return { text: joinStudyFooter(outLines.join('\n'), footer) };
}

/**
 * The text with ONE part taken out (EC-543): its heading's line down to
 * the next heading of its level or above, its own parts with it, and every
 * other line as it was. A rule closing the part stays when a part comes
 * after it -- a translation under the study opens with one -- unless the
 * line above the cut is a rule already; a rule left last before the app's
 * last lines goes. The study's own title is refused: its part is the
 * whole study.
 */
export function applyStudyRemove(
    oldText: string,
    sectionText: string,
): { text: string } | { reason: string } {
    const { body, footer } = splitStudyFooter(oldText);
    const section = String(sectionText ?? '').trim();
    if (section === '') {
        return {
            reason:
                'Name the part to take out in `section`: its heading, as ' +
                'the file writes it.',
        };
    }
    const found = findStudySection(
        body,
        section,
        'only their place tells them apart, so the person takes the one ' +
            'out in the editor',
    );
    if ('reason' in found) {
        // A passage the app quoted, named by its reference (EC-548).
        return removeStudyPassage(body, footer, section) ?? found;
    }
    const target = found.section;
    const sections = listStudySections(body);
    if (target.level === 1 && sections[0]?.start === target.start) {
        const ownEnd =
            sections.find((one) => {
                return one.start > target.start && one.start < target.end;
            })?.start ?? target.end;
        const [passage] = listStudyPassageBlocks(
            body.split('\n').slice(target.start + 1, ownEnd),
        );
        return {
            reason:
                `“${target.heading}” is the study's own title: its part ` +
                'is the whole study. ' +
                (passage === undefined
                    ? ''
                    : 'The passage quoted under it is taken out by its ' +
                      `reference: \`section\` ${quote(passage.title)}. `) +
                'Name the part to take out by its own heading. ' +
                `${STUDY_HEADINGS_LEAD}\n${toStudyOutline(body)}`,
        };
    }
    const lines = body.split('\n');
    const removed = lines.slice(target.start, target.end);
    let keptFrom = removed.length;
    while (
        keptFrom > 1 &&
        (removed[keptFrom - 1].trim() === '' ||
            checkIsRuleLine(removed[keptFrom - 1]))
    ) {
        keptFrom -= 1;
    }
    let head = dropTrailingBlankLines(lines.slice(0, target.start));
    const rest = dropEdgeBlankLines(lines.slice(target.end));
    let closing = removed
        .slice(keptFrom)
        .filter((line) => {
            return line.trim() !== '';
        })
        .at(-1);
    if (rest.length === 0) {
        // Nothing after the cut: a rule there would stand over the app's
        // own rule, or over nothing.
        closing = undefined;
        while (checkIsRuleLine(head.at(-1))) {
            head = dropTrailingBlankLines(head.slice(0, -1));
        }
    } else if (head.length === 0 || checkIsRuleLine(head.at(-1))) {
        closing = undefined;
    }
    const blocks = [head, closing === undefined ? [] : [closing], rest].filter(
        (block) => {
            return block.length > 0;
        },
    );
    const outLines = blocks.flatMap((block, index) => {
        return index === 0 ? block : ['', ...block];
    });
    const hasWords = outLines.some((line) => {
        return line.trim() !== '' && !checkIsRuleLine(line);
    });
    if (!hasWords) {
        return {
            reason:
                `“${target.heading}” is all the study holds: nothing would ` +
                'be left of it.',
        };
    }
    return { text: joinStudyFooter(outLines.join('\n'), footer) };
}

// --- a translation's parts (EC-478) ------------------------------------------

export type StudyTranslatePartKindType =
    'text' | 'diagram' | 'passage' | 'keep';

export type StudyTranslatePartType = {
    kind: StudyTranslatePartKindType;
    /** The part as the file writes it, line ends `\n`, none at its end. */
    text: string;
    /** A passage's reference as its Bible writes it, and that Bible. */
    title?: string;
    bibleKey?: string;
};

const QUOTE_HEAD_PATTERN = /^\s{0,3}>\s*\*\*(.+?)\*\*\s*\(([^)\n]{1,40})\)\s*$/;

/**
 * The body (`splitStudyFooter`'s) as the study was written, apart from the
 * translations added after it (2026-11-11, EC-492): an added translation
 * opens with a rule and a `#` title of its own -- the window drafts it so,
 * and a study has one `#` title, at its top. Asked for Serbian after a
 * Khmer translation was added, the whole file had been translated and the
 * Serbian came back twice, once from the English and once from the Khmer.
 * `translations` starts at that rule; the two joined by `\n` are the body.
 */
export function splitStudyTranslations(body: string) {
    const lineList = splitLinesByFence(String(body ?? ''));
    const lines = lineList.map(({ line }) => {
        return line;
    });
    let hasWords = false;
    for (const [index, { line, isInFence }] of lineList.entries()) {
        if (!isInFence && hasWords && RULE_PATTERN.test(line)) {
            let next = index + 1;
            while (next < lineList.length && lines[next].trim() === '') {
                next += 1;
            }
            const after = lineList[next];
            if (
                after !== undefined &&
                !after.isInFence &&
                /^#\s+\S/.test(after.line)
            ) {
                return {
                    original: lines.slice(0, index).join('\n'),
                    translations: lines.slice(index).join('\n'),
                };
            }
        }
        if (line.trim() !== '') {
            hasWords = true;
        }
    }
    return { original: lines.join('\n'), translations: '' };
}

/**
 * Each translation of `splitStudyTranslations`' `translations`, in its
 * order, its rule first, `max` at most: joined by `\n`, the list is that
 * text again (when no more than `max` are there).
 */
export function listStudyTranslations(
    translations: string,
    max = Number.MAX_SAFE_INTEGER,
) {
    const list: string[] = [];
    let rest = String(translations ?? '');
    while (rest.trim() !== '' && list.length < max) {
        const split = splitStudyTranslations(rest);
        list.push(split.original);
        rest = split.translations;
    }
    return list;
}

/**
 * The study as written and each translation added after it, each with the
 * Bible its passage is quoted from -- the first passage the app quoted in
 * it, or null (2026-11-13, EC-570): a verse added to one is quoted from
 * that Bible. Joined by `\n`, the halves are the text again.
 */
export function listStudyHalves(text: string) {
    return listStudyHalfTexts(text).map((half) => {
        const block = listStudyPassageBlocks(half.split('\n'))[0];
        return {
            text: half,
            bibleKey: block === undefined ? null : block.bibleKey,
        };
    });
}

function listStudyHalfTexts(text: string) {
    const { original, translations } = splitStudyTranslations(text);
    return [original, ...listStudyTranslations(translations)];
}

/**
 * A part held to its half (2026-11-13, EC-571): a part runs to the next
 * heading of its level or above, so the study's last part ran on over the
 * rule that opens a translation added after it. Words appended to it went
 * in under that rule and new words for it took the rule out -- either way
 * the translation was no longer one, to the next `translate` nor to its
 * own Bible's verses (EC-570) -- and a read of it ended on the rule.
 */
function holdStudySectionToHalf(
    body: string,
    section: StudySectionType,
): StudySectionType {
    let halfEnd = 0;
    for (const half of listStudyHalfTexts(body)) {
        halfEnd += half.split('\n').length;
        if (halfEnd > section.start) {
            return section.end > halfEnd
                ? { ...section, end: halfEnd }
                : section;
        }
    }
    return section;
}

/**
 * The body (`splitStudyFooter`'s) in the parts a translation treats apart:
 * WORDS to translate; a DIAGRAM, its fences included, whose labels are
 * translated and its syntax kept; a PASSAGE the app quoted (`> **John
 * 3:16** (KJV)` and its verse lines), quoted again rather than translated;
 * and what is KEPT as it is -- a code block, a rule. The parts joined by
 * `\n` are the body as it was.
 */
export function splitStudyForTranslation(
    body: string,
): StudyTranslatePartType[] {
    const lines = String(body ?? '')
        .replace(/\r\n/g, '\n')
        .split('\n');
    const parts: StudyTranslatePartType[] = [];
    const push = (part: StudyTranslatePartType) => {
        const last = parts.at(-1);
        if (
            last !== undefined &&
            last.kind === part.kind &&
            (part.kind === 'text' || part.kind === 'keep')
        ) {
            last.text = `${last.text}\n${part.text}`;
            return;
        }
        parts.push(part);
    };
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        const fence = FENCE_PATTERN.exec(line);
        if (fence !== null) {
            let end = index + 1;
            while (end < lines.length) {
                const closing = FENCE_PATTERN.exec(lines[end]);
                if (closing !== null && closing[1] === fence[1]) {
                    break;
                }
                end += 1;
            }
            const block = lines.slice(index, Math.min(end + 1, lines.length));
            push({
                kind: MERMAID_FENCE_PATTERN.test(line) ? 'diagram' : 'keep',
                text: block.join('\n'),
            });
            index = end + 1;
            continue;
        }
        const quoteHead = QUOTE_HEAD_PATTERN.exec(line);
        if (quoteHead !== null) {
            let end = index + 1;
            while (end < lines.length && /^\s{0,3}>/.test(lines[end])) {
                end += 1;
            }
            push({
                kind: 'passage',
                text: lines.slice(index, end).join('\n'),
                title: quoteHead[1].trim(),
                bibleKey: quoteHead[2].trim(),
            });
            index = end;
            continue;
        }
        push({ kind: RULE_PATTERN.test(line) ? 'keep' : 'text', text: line });
        index += 1;
    }
    return parts;
}

/**
 * A part's words cut where a paragraph ends, each piece at most `maxChars`
 * where the text allows -- one paragraph longer than that stays whole -- so
 * each is translated within one answer.
 */
export function chunkStudyText(text: string, maxChars: number) {
    const paragraphs = String(text ?? '')
        .split(/\n[ \t]*\n/)
        .map((paragraph) => {
            return paragraph.replace(/^\n+|\s+$/g, '');
        })
        .filter((paragraph) => {
            return paragraph.trim() !== '';
        });
    const chunks: string[] = [];
    for (const paragraph of paragraphs) {
        const last = chunks.at(-1);
        if (
            last !== undefined &&
            last.length + paragraph.length + 2 <= maxChars
        ) {
            chunks[chunks.length - 1] = `${last}\n\n${paragraph}`;
        } else {
            chunks.push(paragraph);
        }
    }
    return chunks;
}

/** A diagram's source, its fences off: what a translator is handed. */
export function toStudyDiagramSource(block: string) {
    const lines = block.split('\n');
    const isClosed = lines.length > 1 && FENCE_PATTERN.test(lines.at(-1) ?? '');
    return lines.slice(1, isClosed ? -1 : undefined).join('\n');
}

/** A diagram's source in its fences again, the way the file opened them. */
export function toStudyDiagramBlock(block: string, source: string) {
    const lines = block.split('\n');
    const opening = lines[0];
    const fence = FENCE_PATTERN.exec(opening)?.[1] ?? '```';
    return `${opening}\n${source.replace(/\n+$/, '')}\n${fence}`;
}

/**
 * The first `#` line's words -- the study's title -- or null when the file
 * opens with none.
 */
export function readStudyTitleLine(body: string) {
    for (const { line, isInFence } of splitLinesByFence(body)) {
        if (isInFence) {
            continue;
        }
        const match = /^#\s+(.+?)\s*#*\s*$/.exec(line);
        if (match !== null) {
            return match[1];
        }
    }
    return null;
}

// --- an exact replace (2026-11-12, EC-537) -----------------------------------
//
// EC-536 names the words a saved translation writes otherwise than the
// Bible it quotes. Asked to write them as the Bible does, a model could only
// send a whole part again, every other line of it retyped -- and a model
// does not keep those letter for letter (EC-500). A replace is those words
// alone: each `from` exactly as the file writes it, each `to` the words put
// in its place, and no other letter of the file moved.

export type StudyReplaceType = { from: string; to: string };
export type StudyReplacedType = StudyReplaceType & { count: number };

export const STUDY_MAX_REPLACES = 20;
export const STUDY_REPLACE_MAX_CHARS = 400;
/** Why a replace sent with new words besides it is refused. */
export const STUDY_REPLACE_ALONE_REASON =
    '`replace` writes words anew where they stand: send it without ' +
    '`content` or `append` (`section` keeps it to one part).';

// The scripts written with no space between words (`UNSPACED_SCRIPT_SET` in
// `bibleVerseFindHelpers.ts`), read off the letter: there a word is glued to
// the words beside it, and is found so.
const UNSPACED_LETTER_PATTERN =
    /^[\p{sc=Hani}\p{sc=Hira}\p{sc=Kana}\p{sc=Khmr}\p{sc=Laoo}\p{sc=Mymr}\p{sc=Thai}\p{sc=Tibt}]/u;
const WORD_LETTER_PATTERN = /^[\p{L}\p{M}\p{N}]/u;
const LETTER_PATTERN = /^\p{L}/u;
// A `from` glued to letters holds at least this many letters of its own:
// one alone is a piece of half the words of the file.
const MIN_GLUED_LETTERS = 2;
// Each of those scripts on its own -- those one language writes together
// counted as one: a letter glued to a letter of
// ANOTHER of them is a word of its own whatever its length, as a letter of
// another language slipped into a word is (2026-11-13, EC-559: a translation
// had one such letter glued between two of its own).
const UNSPACED_SCRIPT_PATTERN_LIST = [
    /^[\p{sc=Hani}\p{sc=Hira}\p{sc=Kana}]/u,
    /^\p{sc=Khmr}/u,
    /^\p{sc=Laoo}/u,
    /^\p{sc=Mymr}/u,
    /^\p{sc=Thai}/u,
    /^\p{sc=Tibt}/u,
];
// What a replace never writes inside in a part of words: a link's address,
// a web address and a verse token.
const REPLACE_KEPT_SPAN_PATTERN =
    /\]\([^)\n]*\)|<(?:https?:\/\/|mailto:)[^>\s]+>|https?:\/\/[^\s<>)\]]+|\[\^[^\]\n]{1,80}\]/g;
const MAX_QUOTED_REPLACE_CHARS = 40;
const MAX_NAMED_REPLACE_PROBLEMS = 5;
const PLACE_CONTEXT_CHARS = 12;

/**
 * `replace` as a model sends it, checked: up to `STUDY_MAX_REPLACES` pairs,
 * each `from` some words on one line and each `to` another, neither longer
 * than `STUDY_REPLACE_MAX_CHARS`; or why not, naming the pair.
 */
export function toStudyReplaceList(
    value: unknown,
): { list: StudyReplaceType[] } | { reason: string } {
    if (!Array.isArray(value) || value.length === 0) {
        return {
            reason:
                'Give `replace` as a list of {"from", "to"}: each `from` the ' +
                'words exactly as the file writes them, each `to` the words ' +
                'to write in their place.',
        };
    }
    if (value.length > STUDY_MAX_REPLACES) {
        return {
            reason:
                `${value.length} pairs is more than ${STUDY_MAX_REPLACES} a ` +
                'call: send the rest in another draft.',
        };
    }
    const list: StudyReplaceType[] = [];
    for (const [index, item] of value.entries()) {
        const name = `Pair ${index + 1}`;
        const from = typeof item?.from === 'string' ? item.from : null;
        const to = typeof item?.to === 'string' ? item.to : null;
        if (from === null || to === null) {
            return { reason: `${name} needs \`from\` and \`to\`, both words.` };
        }
        if (from.trim() === '') {
            return {
                reason: `${name}'s \`from\` is empty: give the words to replace.`,
            };
        }
        if (/[\r\n]/.test(from) || /[\r\n]/.test(to)) {
            return {
                reason:
                    `${name} holds a line break: a replace changes words ` +
                    'within a line. To change lines, draft `section` with ' +
                    'its `content`.',
            };
        }
        if (
            from.length > STUDY_REPLACE_MAX_CHARS ||
            to.length > STUDY_REPLACE_MAX_CHARS
        ) {
            return {
                reason:
                    `${name} is longer than ${STUDY_REPLACE_MAX_CHARS} ` +
                    'characters a side: replace fewer words at a time, or ' +
                    'draft `section` with its `content`.',
            };
        }
        if (from === to) {
            return {
                reason: `${name} writes ${quote(from)} for itself: leave it out.`,
            };
        }
        const earlier = list.findIndex((one) => {
            return one.from === from;
        });
        if (earlier >= 0) {
            return {
                reason:
                    `${name} replaces ${quote(from)} again, as pair ` +
                    `${earlier + 1} does: give each \`from\` once.`,
            };
        }
        list.push({ from, to });
    }
    return { list };
}

type ReplaceRegionType = { start: number; end: number };

/**
 * Where a replace may write in `text`: each part of words with its link
 * addresses, web addresses and verse tokens left out, and each diagram's
 * lines inside its fences -- never a passage the app quoted from a Bible, a
 * code block or a rule (`splitStudyForTranslation`'s parts).
 */
function listReplaceRegions(text: string) {
    const regions: ReplaceRegionType[] = [];
    let offset = 0;
    for (const part of splitStudyForTranslation(text)) {
        const partStart = offset;
        offset += part.text.length + 1;
        if (part.kind === 'diagram') {
            const lines = part.text.split('\n');
            const isClosed =
                lines.length > 1 && FENCE_PATTERN.test(lines.at(-1) ?? '');
            const start = partStart + lines[0].length + 1;
            const end =
                partStart +
                part.text.length -
                (isClosed ? (lines.at(-1) ?? '').length + 1 : 0);
            if (end > start) {
                regions.push({ start, end });
            }
            continue;
        }
        if (part.kind !== 'text') {
            continue;
        }
        let from = 0;
        for (const match of part.text.matchAll(REPLACE_KEPT_SPAN_PATTERN)) {
            regions.push({
                start: partStart + from,
                end: partStart + match.index,
            });
            from = match.index + match[0].length;
        }
        regions.push({
            start: partStart + from,
            end: partStart + part.text.length,
        });
    }
    return regions;
}

/** The letter before `index` and the letter at it, each '' at an end. */
function toLetterBefore(text: string, index: number) {
    return [...text.slice(Math.max(0, index - 2), index)].at(-1) ?? '';
}

function toLetterAt(text: string, index: number) {
    return [...text.slice(index, index + 2)][0] ?? '';
}

/** Whether two letters of scripts written with no spaces are of one. */
function checkIsOneUnspacedScript(letter: string, other: string) {
    return UNSPACED_SCRIPT_PATTERN_LIST.some((pattern) => {
        return pattern.test(letter) && pattern.test(other);
    });
}

/**
 * Whether a word may end where `inside` meets `outside`: a letter on only
 * one side; or, in a script written with no spaces, both -- a `from` of
 * `MIN_GLUED_LETTERS` letters or more glued to the words beside it, or of
 * any length glued to another such script's (EC-559).
 */
function checkIsReplaceEdge(
    outside: string,
    inside: string,
    letterCount: number,
) {
    if (
        !WORD_LETTER_PATTERN.test(outside) ||
        !WORD_LETTER_PATTERN.test(inside)
    ) {
        return true;
    }
    return (
        (letterCount >= MIN_GLUED_LETTERS ||
            !checkIsOneUnspacedScript(outside, inside)) &&
        UNSPACED_LETTER_PATTERN.test(outside) &&
        UNSPACED_LETTER_PATTERN.test(inside)
    );
}

function countLetters(letters: readonly string[]) {
    return letters.filter((letter) => {
        return LETTER_PATTERN.test(letter);
    }).length;
}

/** Whether the `letters` at `start`..`end` of `text` stand as whole words. */
function checkIsWholeAt(
    text: string,
    start: number,
    end: number,
    letters: readonly string[],
    letterCount: number,
) {
    return (
        checkIsClusterEdge(text, start) &&
        checkIsClusterEdge(text, end) &&
        checkIsReplaceEdge(
            toLetterBefore(text, start),
            letters[0] ?? '',
            letterCount,
        ) &&
        checkIsReplaceEdge(
            toLetterAt(text, end),
            letters.at(-1) ?? '',
            letterCount,
        )
    );
}

/**
 * Whether `start`..`end` of a text is words a replace could write over,
 * wherever they are: whole words, or glued ones of a script written with
 * no spaces, that start and end a letter cluster (EC-541).
 */
export function checkIsStudyReplaceWords(
    text: string,
    start: number,
    end: number,
) {
    const letters = [...text.slice(start, end)];
    return checkIsWholeAt(text, start, end, letters, countLetters(letters));
}

type ReplacePlacesType = {
    starts: number[];
    /** The first place found where a replace leaves the words. */
    keptAt: number | null;
    /** The first place found inside a longer word or a letter cluster. */
    gluedAt: number | null;
};

/** Where `from` stands in `text` as words a replace may write over. */
function findReplacePlaces(text: string, from: string): ReplacePlacesType {
    const regions = listReplaceRegions(text);
    const letters = [...from];
    const letterCount = countLetters(letters);
    const found: ReplacePlacesType = {
        starts: [],
        keptAt: null,
        gluedAt: null,
    };
    let index = text.indexOf(from);
    while (index >= 0) {
        const end = index + from.length;
        const isInRegion = regions.some((region) => {
            return region.start <= index && end <= region.end;
        });
        const isWhole =
            isInRegion &&
            checkIsWholeAt(text, index, end, letters, letterCount);
        if (isWhole) {
            found.starts.push(index);
            index = text.indexOf(from, end);
            continue;
        }
        if (!isInRegion && found.keptAt === null) {
            found.keptAt = index;
        } else if (isInRegion && found.gluedAt === null) {
            found.gluedAt = index;
        }
        index = text.indexOf(from, index + 1);
    }
    return found;
}

/** Some words in quotes, cut at a cluster's edge past 40 characters. */
function quoteReplaceWords(text: string) {
    if (text.length <= MAX_QUOTED_REPLACE_CHARS) {
        return quote(text);
    }
    let end = MAX_QUOTED_REPLACE_CHARS;
    while (end < text.length && !checkIsClusterEdge(text, end)) {
        end += 1;
    }
    return quote(`${text.slice(0, end)}…`);
}

/** The words round a place, within its line, cut at clusters' edges. */
function toPlaceContext(text: string, start: number, end: number) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineBreak = text.indexOf('\n', end);
    const lineEnd = lineBreak < 0 ? text.length : lineBreak;
    let from = Math.max(lineStart, start - PLACE_CONTEXT_CHARS);
    while (from > lineStart && !checkIsClusterEdge(text, from)) {
        from -= 1;
    }
    let to = Math.min(lineEnd, end + PLACE_CONTEXT_CHARS);
    while (to < lineEnd && !checkIsClusterEdge(text, to)) {
        to += 1;
    }
    return (
        (from > lineStart ? '…' : '') +
        text.slice(from, to).trim() +
        (to < lineEnd ? '…' : '')
    );
}

/** The file's own writing of `from` in another case or without spaces. */
function findReplaceHint(text: string, from: string) {
    const trimmed = from.trim();
    if (trimmed !== from && text.includes(trimmed)) {
        return trimmed;
    }
    const lowerText = text.toLowerCase();
    const at = lowerText.indexOf(from.toLowerCase());
    return at >= 0 && lowerText.length === text.length
        ? text.slice(at, at + from.length)
        : null;
}

type ReplaceMissType = {
    scope: string;
    originalScope: string;
    body: string;
    footer: string;
    sectionName: string;
};

/** Why `from` has no place to be replaced in, for the model. */
function explainReplaceMiss(
    from: string,
    found: ReplacePlacesType,
    miss: ReplaceMissType,
) {
    const quoted = quoteReplaceWords(from);
    if (found.gluedAt !== null) {
        const context = toPlaceContext(
            miss.scope,
            found.gluedAt,
            found.gluedAt + from.length,
        );
        return (
            `${quoted} is there only inside a longer word or letter ` +
            `cluster (${quote(context)}): give the whole word as \`from\`.`
        );
    }
    if (found.keptAt !== null) {
        return (
            `${quoted} is there only where a replace leaves the words as ` +
            'they are: a passage the app quoted from a Bible, a code block, ' +
            "a link's address or a verse token."
        );
    }
    if (miss.originalScope.includes(from)) {
        return (
            `the pairs before it leave no ${quoted} to replace: give it ` +
            'first, or as the words read once they are made.'
        );
    }
    if (miss.footer.includes(from)) {
        return (
            `${quoted} is only in the app's own last lines, which a replace ` +
            'leaves as they are.'
        );
    }
    if (miss.sectionName !== '' && miss.body.includes(from)) {
        return (
            `${quoted} is not in “${miss.sectionName}”, though the file has ` +
            'it elsewhere: leave `section` out, or name the part holding it.'
        );
    }
    const where =
        miss.sectionName === '' ? 'the file' : `“${miss.sectionName}”`;
    const hint = findReplaceHint(miss.scope, from);
    if (hint !== null) {
        return (
            `${quoted} is not in ${where}, which writes ` +
            `${quoteReplaceWords(hint)}: copy \`from\` letter for letter as ` +
            'the file writes it.'
        );
    }
    return (
        `${quoted} is not in ${where}: copy each \`from\` letter for letter ` +
        'from a `read` of it (`file` and `section`).'
    );
}

/**
 * The text with each `from` written as its `to`, the pairs made in the
 * order given, and every other letter as it was (line ends made `\n`):
 * only in the study's words and its diagrams, `section` keeping it to one
 * part, and only as whole words -- glued to the words beside it in a
 * script written with no spaces -- that start and end a letter cluster.
 * A pair with no such place refuses the lot, saying why.
 */
export function applyStudyReplace(
    oldText: string,
    replaceList: readonly StudyReplaceType[],
    section = '',
): { text: string; replaced: StudyReplacedType[] } | { reason: string } {
    const { body, footer } = splitStudyFooter(oldText);
    const lines = body.split('\n');
    const sectionName = String(section ?? '').trim();
    let start = 0;
    let end = lines.length;
    if (sectionName !== '') {
        const found = findStudySection(
            body,
            sectionName,
            'leave `section` out, or name a part the file has once',
        );
        if ('reason' in found) {
            return found;
        }
        start = found.section.start;
        end = found.section.end;
    }
    const originalScope = lines.slice(start, end).join('\n');
    let scope = originalScope;
    const replaced: StudyReplacedType[] = [];
    const problems: string[] = [];
    replaceList.forEach(({ from, to }, index) => {
        const found = findReplacePlaces(scope, from);
        if (found.starts.length === 0) {
            problems.push(
                `Pair ${index + 1}: ${explainReplaceMiss(from, found, {
                    scope,
                    originalScope,
                    body,
                    footer,
                    sectionName,
                })}`,
            );
            return;
        }
        let written = '';
        let cursor = 0;
        for (const at of found.starts) {
            written += scope.slice(cursor, at) + to;
            cursor = at + from.length;
        }
        scope = written + scope.slice(cursor);
        replaced.push({ from, to, count: found.starts.length });
    });
    if (problems.length > 0) {
        const more =
            problems.length > MAX_NAMED_REPLACE_PROBLEMS
                ? ` And ${problems.length - MAX_NAMED_REPLACE_PROBLEMS} more.`
                : '';
        return {
            reason:
                problems.slice(0, MAX_NAMED_REPLACE_PROBLEMS).join(' ') +
                more +
                ' Nothing is changed: draft again with every `from` as the ' +
                'file writes it, or without the pairs it cannot find.',
        };
    }
    return {
        text:
            [...lines.slice(0, start), scope, ...lines.slice(end)].join('\n') +
            footer,
        replaced,
    };
}

/** One English sentence for the model about what a replace writes. */
export function describeStudyReplace(replaced: readonly StudyReplacedType[]) {
    const named = replaced
        .slice(0, MAX_NAMED_SECTIONS)
        .map(({ from, to, count }) => {
            const places = `${count} ${count === 1 ? 'place' : 'places'}`;
            return to === ''
                ? `takes out ${quoteReplaceWords(from)} (${places})`
                : `writes ${quoteReplaceWords(to)} for ` +
                      `${quoteReplaceWords(from)} (${places})`;
        });
    const more =
        replaced.length > MAX_NAMED_SECTIONS
            ? `; and ${replaced.length - MAX_NAMED_SECTIONS} more`
            : '';
    return `It ${named.join('; ')}${more}; nothing else changes.`;
}

/**
 * The places (0 is the first ```mermaid block) where `newText` draws a
 * diagram otherwise than `oldText` at the same place: what a replace
 * changed in the file's own diagrams, which stay where they were.
 */
export function listChangedStudyDiagrams(oldText: string, newText: string) {
    const oldDiagrams = lintStudyContent(oldText, Infinity).diagrams;
    return lintStudyContent(newText, Infinity).diagrams.flatMap(
        (diagram, index) => {
            return diagram === oldDiagrams[index] ? [] : [index];
        },
    );
}
