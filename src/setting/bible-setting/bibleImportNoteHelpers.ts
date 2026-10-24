/**
 * The `note` an imported Bible carries: when it came in, who brought it, the
 * link it was downloaded from and what was chosen for it -- so a Bible found
 * on the list months later can be traced back to its source, fetched again,
 * or reported to whoever published it.
 *
 * Written in plain English INTO the Bible file, like its title, never through
 * `tran()`: the file outlives the language the app is shown in and may be
 * shared with another church. The person can edit it in the Info editor like
 * any other field.
 *
 * No imports on purpose: the Settings import form and the assistant's worker
 * (`agentBibleXMLHelpers.ts`) both build one, and neither should pull more
 * than this file in for it.
 */

// The note is an attribute on the root `<bible>` tag, and the scans of the
// installed Bibles read only the head of each file (`BIBLE_KEY_HEAD_READ_BYTES`
// in `bibleXMLJsonDataHelpers.ts`). A root tag that outgrows that head costs a
// whole multi-MB read per Bible per scan, so the note stays bounded -- the
// facts that matter most come first and survive the cut.
export const BIBLE_NOTE_MAX_CHARS = 2000;
const URL_MAX_CHARS = 600;
const TEXT_MAX_CHARS = 200;

export type BibleImportByType = 'chatbot' | 'agent' | 'settings';

const BY_TEXT_MAP: Record<BibleImportByType, string> = {
    chatbot: 'the assistant (Chatbot)',
    agent: 'an AI agent connected to the app (MCP)',
    settings: 'Settings > Bible > Import XML File',
};

export type BibleImportOriginType = {
    by: BibleImportByType;
    // The Settings form, filled in by the assistant's "Do it in Settings
    // instead" (`requestBibleImport`).
    isLinkFromChatbot?: boolean;
    // The address as it was given, the one actually downloaded (a GitHub or
    // Drive share page turned into its file) and where the redirects ended.
    url?: string | null;
    downloadUrl?: string | null;
    finalUrl?: string | null;
    fileName?: string | null;
    bytes?: number | null;
    bookNames?: { label: string; source?: string | null } | null;
};

export type BibleContentCountType = {
    books: number;
    chapters: number;
    verses: number;
};

export type BibleImportNoteInputType = {
    origin: BibleImportOriginType;
    // What the file said of itself, before the person's choices.
    fileInfo: { key: string; title: string };
    chosen: { key: string; title: string; locale: string; digits?: string[] };
    counts?: BibleContentCountType | null;
    appVersion?: string | null;
    // A note the file already carried -- an exported Bible imported again
    // keeps where it first came from.
    previousNote?: string | null;
    at?: Date;
};

export function checkIsBibleImportBy(
    value: unknown,
): value is BibleImportByType {
    return typeof value === 'string' && Object.hasOwn(BY_TEXT_MAP, value);
}

function toLine(value: unknown, maxChars = TEXT_MAX_CHARS) {
    if (typeof value !== 'string') {
        return null;
    }
    // One line each: a newline inside a value would forge a line of its own.
    const text = value.replaceAll(/\s+/g, ' ').trim();
    if (text === '') {
        return null;
    }
    return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

/** An http(s) address, or nothing: a truncated link is no link at all. */
export function toBibleNoteUrl(value: unknown) {
    if (typeof value !== 'string' || value.length > URL_MAX_CHARS) {
        return null;
    }
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return null;
        }
        // Never a sign-in kept in the file a church may pass on.
        if (url.username || url.password) {
            return null;
        }
        return url.href;
    } catch (_error) {
        return null;
    }
}

function formatAt(at: Date) {
    // `2026-10-15 07:03 UTC`: the same on every computer it is read on.
    return `${at.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function formatSize(bytes: number) {
    if (bytes >= 1048576) {
        return `${(bytes / 1048576).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function countBibleContents(books: {
    [bookKey: string]: { [chapter: string]: { [verse: string]: string } };
}): BibleContentCountType {
    let chapters = 0;
    let verses = 0;
    for (const book of Object.values(books)) {
        for (const chapter of Object.values(book)) {
            chapters++;
            verses += Object.keys(chapter).length;
        }
    }
    return { books: Object.keys(books).length, chapters, verses };
}

function genSourceLines(origin: BibleImportOriginType) {
    const lineList: string[] = [];
    const url = toBibleNoteUrl(origin.url);
    const downloadUrl = toBibleNoteUrl(origin.downloadUrl);
    const finalUrl = toBibleNoteUrl(origin.finalUrl);
    const sourceUrl = url ?? downloadUrl ?? finalUrl;
    if (sourceUrl !== null) {
        lineList.push(`Downloaded from: ${sourceUrl}`);
        if (downloadUrl !== null && downloadUrl !== sourceUrl) {
            lineList.push(`File link used: ${downloadUrl}`);
        }
        if (
            finalUrl !== null &&
            finalUrl !== sourceUrl &&
            finalUrl !== downloadUrl
        ) {
            lineList.push(`Served from: ${finalUrl}`);
        }
    }
    const fileName = toLine(origin.fileName);
    const fileParts = fileName === null ? [] : [fileName];
    const bytes = origin.bytes;
    if (typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0) {
        fileParts.push(formatSize(bytes));
    }
    if (fileParts.length > 0) {
        lineList.push(
            `${sourceUrl === null ? 'From the file' : 'File'}: ` +
                fileParts.join(', '),
        );
    }
    return lineList;
}

function genChoiceLine(
    chosen: BibleImportNoteInputType['chosen'],
    bookNames: BibleImportOriginType['bookNames'],
) {
    const choiceList = [`key ${chosen.key}`, `language ${chosen.locale}`];
    if (
        chosen.digits !== undefined &&
        chosen.digits.join('') !== '0123456789'
    ) {
        choiceList.push(`digits ${chosen.digits.join(' ')}`);
    }
    const label = toLine(bookNames?.label);
    if (label !== null) {
        const source = toBibleNoteUrl(bookNames?.source);
        choiceList.push(
            `book names "${label}"${source === null ? '' : ` (${source})`}`,
        );
    }
    return `Chosen: ${choiceList.join(', ')}.`;
}

export function genBibleImportNote(input: BibleImportNoteInputType) {
    const { origin, fileInfo, chosen, counts } = input;
    const by =
        (BY_TEXT_MAP[origin.by] ?? BY_TEXT_MAP.agent) +
        (origin.by === 'settings' && origin.isLinkFromChatbot
            ? `, with the link from ${BY_TEXT_MAP.chatbot}`
            : '');
    const version = toLine(input.appVersion);
    const lineList = [
        `Imported on ${formatAt(input.at ?? new Date())} by ${by}` +
            (version === null ? '' : ` in Open Worship app ${version}`) +
            '.',
        ...genSourceLines(origin),
    ];
    if (counts) {
        lineList.push(
            `Contents: ${counts.books} books, ${counts.chapters} chapters, ` +
                `${counts.verses} verses.`,
        );
    }
    // What the file called itself, when the person chose otherwise: the only
    // way to match this Bible to its file again after a rename.
    const fileTitle = toLine(fileInfo.title);
    if (fileTitle !== null && fileTitle !== toLine(chosen.title)) {
        lineList.push(`Title in the file: ${fileTitle}`);
    }
    const fileKey = toLine(fileInfo.key, 40);
    if (fileKey !== null && fileKey !== chosen.key) {
        lineList.push(`Key in the file: ${fileKey}`);
    }
    lineList.push(genChoiceLine(chosen, origin.bookNames));
    const previousNote = input.previousNote?.trim() ?? '';
    if (previousNote !== '') {
        lineList.push(`Earlier note: ${previousNote}`);
    }
    const note = lineList.join('\n');
    return note.length > BIBLE_NOTE_MAX_CHARS
        ? `${note.slice(0, BIBLE_NOTE_MAX_CHARS - 1)}…`
        : note;
}

/** The first web address in a note, for the Bible list to link to. */
export function findBibleNoteUrl(note: string | null | undefined) {
    const found = /https?:\/\/[^\s<>"]+/.exec(note ?? '')?.[0];
    return found === undefined ? null : toBibleNoteUrl(found);
}
