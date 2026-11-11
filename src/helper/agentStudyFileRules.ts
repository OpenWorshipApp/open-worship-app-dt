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
 * - The whole file stays under `STUDY_FILE_MAX_CHARS`, which holds a study
 *   with its translation added under it; a read returns
 *   `STUDY_READ_MAX_CHARS` of it whole, and a longer one is changed by part.
 */
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';

export const STUDY_FOLDER_NAME = 'Default';
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
function splitLinesByFence(content: string) {
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
    const lines = body.split('\n');
    return {
        heading: found.section.heading,
        text: dropEdgeBlankLines(
            lines.slice(found.section.start, found.section.end),
        ).join('\n'),
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

/**
 * The text with ONE change made by part: a section given new words or more
 * words, or words added at the end -- before the app's last lines, which
 * stay last. A section is named by its heading's words; one not there, or
 * named twice, is refused with the headings the file has.
 */
export function applyStudyEdit(
    oldText: string,
    edit: StudyEditType,
): { text: string } | { reason: string } {
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
    const target = found.section;
    const lines = body.split('\n');
    let sectionLines = lines.slice(target.start, target.end);
    if (content !== '') {
        const newLines = content.split('\n');
        sectionLines = /^#{1,6}\s/.test(newLines[0])
            ? newLines
            : [lines[target.start], '', ...newLines];
    }
    if (append !== '') {
        sectionLines = joinAppendedLines(sectionLines, append);
    }
    const before = lines.slice(0, target.start);
    const after = lines.slice(target.end);
    const outLines = [
        ...before,
        ...dropEdgeBlankLines(sectionLines),
        ...(after.length > 0 ? ['', ...dropEdgeBlankLines(after)] : []),
    ];
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
