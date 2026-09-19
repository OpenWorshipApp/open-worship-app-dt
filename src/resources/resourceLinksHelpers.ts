import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { fsGetFileSize, fsReadFile } from '../server/fileHelpers';

/**
 * The one extension whose CONTENT this panel looks inside. A `.json` beside the
 * verse -- `1CH.0.json` -- may be a list of links, which the panel shows and
 * opens itself; it may equally be any other data file, which is handed to the
 * operating system like every other row. Only reading it says which.
 */
export const RESOURCE_LINKS_DOT_EXTENSION = '.json';

/**
 * The default schema. A resource `.json` is a JSON ARRAY of entries, each with
 * a `title` to read and a `url` to open:
 *
 *     [{ "title": "Overview: 1-2 Chronicles", "url": "https://youtu.be/..." }]
 *
 * Two leniencies, both because these files are hand-written: an entry may be a
 * bare URL STRING, which then titles itself, and an entry whose `title` is
 * blank or missing falls back to its own URL -- a row with nothing to read
 * would be a row nobody can press. Anything else in the array is DROPPED and
 * counted, never guessed at: a link list that quietly invented half its rows
 * would be worse than one that says two entries were not understood.
 */
export type ResourceLinkType = { title: string; url: string };

/** Why a `.json` candidate turned out not to be a link list. */
export type ResourceLinksFailureType =
    'not-a-list' | 'too-large' | 'unreadable';

export type ResourceLinksResultType = {
    links: ResourceLinkType[];
    /**
     * Entries the schema could not read -- a missing `url`, a `mailto:` or a
     * `file:` one, a number where an entry should be. Shown as a count, so a
     * typo in one row of twenty is visible instead of silent.
     */
    droppedCount: number;
    /** The file held more than `MAX_RESOURCE_LINKS` and the tail was cut. */
    isTruncated: boolean;
    /**
     * Why this file is not a link list, for whoever is reading the code or the
     * tests. `null` when it parsed. NOT a message key and never shown: a
     * `.json` that is not a link list is drawn as the ordinary file it is, and
     * a warning about the shape of somebody's data file, beside the verse they
     * are reading, would be an error report where they wanted a shelf.
     */
    failureReason: ResourceLinksFailureType | null;
};

/**
 * Big enough for any hand-written list of links, small enough that pointing
 * this at a 40MB data dump reads its SIZE and stops -- `JSON.parse` has no
 * incremental mode, so a file too big to parse comfortably must never be read
 * into memory at all on the machines this app targets.
 */
export const MAX_RESOURCE_LINKS_FILE_SIZE = 256 * 1024;

/**
 * How many links to keep. Well past any real list, and it bounds the DOM a
 * single expanded row can add.
 */
export const MAX_RESOURCE_LINKS = 200;

/**
 * Did the content actually turn out to be a link list?
 *
 * ONE openable link is the whole bar, and it is deliberately about the CONTENT
 * rather than the name: a `.json` that does not parse, is not an array, holds
 * nothing this panel can open, or cannot be read at all is not a link list --
 * it is an ordinary file, and the row draws and behaves as one, opening in
 * whatever application the machine uses for it. A `.json` is a general-purpose
 * format, so the extension can only ever make a row a CANDIDATE
 * (`checkIsResourceLinksName`); this is what decides.
 */
export function checkIsResourceLinkList(result: ResourceLinksResultType) {
    return result.links.length > 0;
}

/**
 * Is this file worth READING to see whether it is a link list? The extension
 * alone -- never enough on its own, see `checkIsResourceLinkList`.
 */
export function checkIsResourceLinksName(fileFullName: string) {
    const dotIndex = fileFullName.lastIndexOf('.');
    return (
        dotIndex > 0 &&
        fileFullName.slice(dotIndex).toLowerCase() ===
            RESOURCE_LINKS_DOT_EXTENSION
    );
}

/**
 * Is this a URL the app may hand to the system browser?
 *
 * `http(s)` ONLY, and that is a security boundary rather than a tidiness one:
 * `openExternalURL` is `shell.openExternal`, which on every desktop will also
 * launch whatever application has registered a scheme -- so a `file:`, `smb:`
 * or bespoke-scheme URL sitting in a `.json` that arrived inside a shared
 * archive would be a way to start a program on the operator's machine from a
 * data file. Parsed rather than string-matched, so `HTTPS://` and anything
 * hiding behind whitespace are both decided on the CANONICAL scheme.
 */
export function checkIsOpenableResourceUrl(url: string) {
    if (!URL.canParse(url)) {
        return false;
    }
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
}

function toResourceLink(entry: any): ResourceLinkType | null {
    // A bare string entry is a URL that titles itself.
    const url = typeof entry === 'string' ? entry : entry?.url;
    if (typeof url !== 'string') {
        return null;
    }
    const trimmedUrl = url.trim();
    if (!checkIsOpenableResourceUrl(trimmedUrl)) {
        return null;
    }
    const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
    return { title: title === '' ? trimmedUrl : title, url: trimmedUrl };
}

/**
 * The schema applied to a file's text. Pure -- no disk, no app state -- so the
 * shape of a link list is decided in one testable place.
 */
export function parseResourceLinks(text: string): ResourceLinksResultType {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = null;
    }
    if (!Array.isArray(data)) {
        return {
            links: [],
            droppedCount: 0,
            isTruncated: false,
            failureReason: 'not-a-list',
        };
    }
    const links: ResourceLinkType[] = [];
    let droppedCount = 0;
    let isTruncated = false;
    for (const entry of data) {
        if (links.length >= MAX_RESOURCE_LINKS) {
            // Stops reading rather than counting the rest as dropped: the tail
            // was never looked at, and calling it malformed would be a lie.
            isTruncated = true;
            break;
        }
        const link = toResourceLink(entry);
        if (link === null) {
            droppedCount += 1;
        } else {
            links.push(link);
        }
    }
    return { links, droppedCount, isTruncated, failureReason: null };
}

/**
 * The links inside one resource `.json`, read ON DEMAND -- for the files of the
 * chapter being read as their rows appear, and for a free-text hit not until it
 * is pressed. Nothing holds the result once the row is folded away. There is
 * deliberately no cache: the file is small, the read is one syscall, and
 * re-reading is what makes an edit on disk show up without a Refresh.
 *
 * Never throws: every failure comes back as a result with no links, because a
 * broken file among twenty good ones must not take the panel down with it --
 * and because a file this cannot read is simply a file, handed to the machine's
 * own application for it like any other row.
 */
export async function readResourceLinks(
    filePath: string,
): Promise<ResourceLinksResultType> {
    try {
        // The size FIRST, on purpose: the point of the cap is not to read the
        // bytes at all.
        const fileSize = await fsGetFileSize(filePath);
        if (fileSize > MAX_RESOURCE_LINKS_FILE_SIZE) {
            return {
                links: [],
                droppedCount: 0,
                isTruncated: false,
                failureReason: 'too-large',
            };
        }
    } catch {
        return {
            links: [],
            droppedCount: 0,
            isTruncated: false,
            failureReason: 'unreadable',
        };
    }
    try {
        return parseResourceLinks(await fsReadFile(filePath));
    } catch {
        return {
            links: [],
            droppedCount: 0,
            isTruncated: false,
            failureReason: 'unreadable',
        };
    }
}

/**
 * Hand one link to the system browser. Re-checked here rather than trusted
 * from the parse: this is the function with `shell.openExternal` behind it, and
 * it is the last place a scheme can be refused.
 */
export function openResourceLinkUrl(url: string) {
    if (!checkIsOpenableResourceUrl(url)) {
        return false;
    }
    appProvider.browserUtils.openExternalURL(url);
    return true;
}

/**
 * `youtu.be` -- drawn after a title so a link says where pressing it goes,
 * which is the one thing a title alone cannot say.
 */
export function toResourceLinkHostLabel(url: string) {
    if (!URL.canParse(url)) {
        return '';
    }
    return new URL(url).hostname.replace(/^www\./, '');
}

/** `2 entries were not understood`, or the singular of it. */
export function toResourceLinksDroppedLabel(droppedCount: number) {
    const messageKey =
        droppedCount === 1
            ? 'entry was not understood'
            : 'entries were not understood';
    return `${droppedCount} ${tran(messageKey)}`;
}
