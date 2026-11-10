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
 * - The whole file stays under `STUDY_FILE_MAX_CHARS`, what
 *   `owa_resource_file read` returns WHOLE -- a change is drafted from the
 *   file as read, and a file read in part would be written back in part.
 */
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';

export const STUDY_FOLDER_NAME = 'Default';
export const STUDY_FILE_EXTENSION = '.md';
/** `MAX_TEXT_CHARS` in `agentResourcesHelpers.ts`: a read returns it whole. */
export const STUDY_FILE_MAX_CHARS = 16 * 1024;
/** The model's own part; the rest is the title and the quoted passage. */
export const STUDY_CONTENT_MAX_CHARS = 12_000;
export const STUDY_TITLE_MAX_CHARS = 60;
export const STUDY_MAX_DIAGRAMS = 6;
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
export function lintStudyContent(content: string): StudyLintType {
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
    if (diagrams.length > STUDY_MAX_DIAGRAMS) {
        reasons.push(
            `${diagrams.length} diagrams is more than ${STUDY_MAX_DIAGRAMS}: ` +
                'keep the 2 to 4 that teach the passage best.',
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

function toSectionMap(text: string) {
    const sectionMap = new Map<string, string>();
    let heading = '';
    let body: string[] = [];
    const flush = () => {
        if (heading !== '' || body.join('').trim() !== '') {
            sectionMap.set(heading, body.join('\n').trim());
        }
    };
    for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
        const match = HEADING_PATTERN.exec(line);
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
    const oldMap = toSectionMap(oldText);
    const newMap = toSectionMap(newText);
    const addedSections: string[] = [];
    const changedSections: string[] = [];
    for (const [heading, body] of newMap) {
        if (!oldMap.has(heading)) {
            addedSections.push(heading);
        } else if (oldMap.get(heading) !== body) {
            changedSections.push(heading);
        }
    }
    const removedSections = [...oldMap.keys()].filter((heading) => {
        return !newMap.has(heading);
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
        parts.push(`adds ${change.addedSections.map(quote).join(', ')}`);
    }
    if (change.changedSections.length > 0) {
        parts.push(`changes ${change.changedSections.map(quote).join(', ')}`);
    }
    if (change.removedSections.length > 0) {
        parts.push(`removes ${change.removedSections.map(quote).join(', ')}`);
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
