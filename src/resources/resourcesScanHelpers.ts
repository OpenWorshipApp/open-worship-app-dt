import CacheManager from '../others/CacheManager';
import {
    checkIsHiddenName,
    fsListDirents,
    getMimetypeExtensions,
    pathBasename,
    pathJoin,
} from '../server/fileHelpers';

/**
 * How deep below a chosen folder to look. Deep enough for any way a person
 * files sermon material by year/book/series, shallow enough that pointing this
 * at a drive root degrades instead of hanging.
 */
export const MAX_SCAN_DEPTH = 8;

/**
 * The real budget. Cost here is dominated by the NUMBER OF `readdir` CALLS --
 * one syscall and one allocation each -- not by how many entries come back:
 * 20000 files in three folders is three reads, 20000 files in 20000 folders is
 * 20000. Capping entries alone would let the pathological shape through.
 */
export const MAX_SCAN_DIRECTORIES = 1500;

/** Backstop for the other shape: a handful of enormous directories. */
export const MAX_SCAN_ENTRIES = 20000;

/**
 * How many free-text hits to keep. A one-letter search over a folder holding
 * thousands would otherwise put thousands of rows into the DOM, which on the
 * machines this app targets is the whole frame budget spent on a list nobody
 * can read anyway. The verse matches are never capped -- they are what the
 * panel is for, and they are a handful by construction.
 */
export const MAX_SEARCH_MATCHES = 200;

/**
 * How many directories to read before handing the frame back to the browser.
 * `readdir` completions are already macrotasks, but 1500 of them arriving
 * back-to-back starves painting on the machines this app targets.
 */
const YIELD_EVERY_DIRECTORIES = 16;

export type ResourcesScanResultType = {
    filePaths: string[];
    /**
     * Free-text hits, kept apart from the verse matches and appended after
     * them rather than merged in: they answer a different question -- "what
     * else is named like this" -- and the verse matches must stay at the top
     * where they were before anyone typed. A file that is both is listed once,
     * as a verse match.
     */
    searchedFilePaths: string[];
    /**
     * A budget ran out. The UI must say so -- a silently short list reads as a
     * broken feature, and nothing else on screen could explain it.
     */
    isTruncated: boolean;
    /** `searchedFilePaths` hit `MAX_SEARCH_MATCHES` and stopped growing. */
    isSearchTruncated: boolean;
};

/**
 * A file name is `<bookKey>.<chapter>.<anything>` -- `PSA.1.pdf`,
 * `PSA.1.outline.docx`. This pulls the chapter number back out of one, or
 * returns `null` if the name is not of that shape for this book.
 *
 * The number has to be spelled the way we would spell it, so `PSA.01.pdf` and
 * `PSA.1e2.pdf` are not chapter 1 and chapter 100. String comparison rather
 * than a regex: this runs once per entry over a folder that can hold thousands.
 */
function toChapterNumber(fileFullName: string, bookKey: string) {
    if (fileFullName.length <= bookKey.length + 1) {
        return null;
    }
    if (
        fileFullName.slice(0, bookKey.length).toLowerCase() !==
            bookKey.toLowerCase() ||
        fileFullName[bookKey.length] !== '.'
    ) {
        return null;
    }
    const rest = fileFullName.slice(bookKey.length + 1);
    const dotIndex = rest.indexOf('.');
    // `<= 0` also rejects `PSA..pdf`; the tail has to be non-empty too, so
    // `PSA.1.` is not a match while `PSA.1.pdf` is.
    if (dotIndex <= 0 || dotIndex === rest.length - 1) {
        return null;
    }
    const chapterText = rest.slice(0, dotIndex);
    const chapter = Number(chapterText);
    if (!Number.isInteger(chapter) || String(chapter) !== chapterText) {
        return null;
    }
    return chapter;
}

/**
 * Does this file belong to the chapter being read?
 *
 * Two ways it can. Its own chapter number matches -- or it is a BOOK-LEVEL
 * file, which is what a chapter number below 1 means: `PSA.0.pdf` is the
 * introduction to the Psalms, not a chapter of them, so it belongs to every
 * chapter of that book. `0` is the only one the library uses today; `-1`, `-2`
 * and so on are accepted the same way rather than being special-cased, so a
 * second or third book-level document needs no code change.
 *
 * Case-insensitive on every platform, deliberately. NTFS and a default APFS are
 * case-insensitive while ext4 is not, so a case-sensitive match would find
 * `psa.1.pdf` on the user's Windows machine and silently lose it on a Linux
 * one. `toLowerCase` is locale-independent (the Turkish-I hazard is
 * `toUpperCase`), so `PSA` is safe. The original casing is what gets displayed.
 */
export function checkIsMatchedName(
    fileFullName: string,
    bookKey: string,
    chapter: number,
) {
    const fileChapter = toChapterNumber(fileFullName, bookKey);
    if (fileChapter === null) {
        return false;
    }
    return fileChapter === chapter || fileChapter < 1;
}

/**
 * What the free-text box actually searches for, once the noise is off it.
 *
 * Surrounding `*` are stripped because that is how people write "starting with
 * abc" -- the user asked for this feature in exactly those words -- and a
 * literal star would match nothing and read as broken. Everything else stays
 * literal: this is a substring search, not a glob, so no other character has a
 * meaning to lose. Lowercased once here rather than per entry.
 */
export function normalizeResourceSearchText(searchText: string) {
    return searchText
        .trim()
        .replace(/^\*+|\*+$/g, '')
        .trim()
        .toLowerCase();
}

/**
 * The free-text half of a match: a plain case-insensitive substring of the file
 * name, so `abc` finds `abc.pdf`, `01-ABC-notes.docx` and `xabcx.mp4` alike.
 * `lowerSearchText` is expected to have been through
 * `normalizeResourceSearchText` already -- it is hoisted out of the loop that
 * calls this once per entry.
 */
export function checkIsSearchedName(
    fileFullName: string,
    lowerSearchText: string,
) {
    return fileFullName.toLowerCase().includes(lowerSearchText);
}

/**
 * Is this file one of the book-level ones -- `PSA.0.pdf` rather than
 * `PSA.1.pdf`? The panel tags these, because a file for the whole book showing
 * up under chapter 1 otherwise looks like a mismatch.
 */
export function checkIsBookLevelName(fileFullName: string, bookKey: string) {
    const fileChapter = toChapterNumber(fileFullName, bookKey);
    return fileChapter !== null && fileChapter < 1;
}

/**
 * What the panel says it is looking for, as its two halves: the chapter that is
 * open, then the book-level catch-all. The second is dropped when the chapter
 * IS book-level, so it is never printed twice.
 *
 * Two strings rather than one so the panel can draw them as what they are --
 * the chapter pattern solid, the book-level one dashed -- instead of a single
 * run of grey text the user has to parse a separator out of.
 */
export function toResourceMatchPatterns(bookKey: string, chapter: number) {
    const chapterPattern = `${bookKey}.${chapter}.*`;
    if (chapter < 1) {
        return [chapterPattern];
    }
    return [chapterPattern, `${bookKey}.0.*`];
}

/**
 * A file name split into the part worth reading and the part that is only
 * noise once a hundred rows share it: `['PSA.1', '.pdf']`. An extensionless
 * name keeps its whole self as the stem.
 */
export function toResourceNameParts(fileFullName: string): [string, string] {
    const dotIndex = fileFullName.lastIndexOf('.');
    // `<= 0` keeps a dotfile whole: `.gitignore` is a name, not an extension.
    if (dotIndex <= 0) {
        return [fileFullName, ''];
    }
    return [fileFullName.slice(0, dotIndex), fileFullName.slice(dotIndex)];
}

function toDotExtension(fileFullName: string) {
    const dotIndex = fileFullName.lastIndexOf('.');
    return dotIndex === -1 ? '' : fileFullName.slice(dotIndex).toLowerCase();
}

/**
 * Extension first (what the user asked to sort by), then name, then full path.
 *
 * Plain `<`/`>` on the extension so the grouping is identical on every machine;
 * `localeCompare` with `numeric` on the NAME because that half is user-facing
 * and `...27.2.pdf` should come before `...27.10.pdf`. The full path is the last
 * tiebreak so two identically-named files in different subfolders still have
 * one stable order instead of whatever the directory reads happened to return.
 */
export function compareResourceFiles(filePathA: string, filePathB: string) {
    const nameA = pathBasename(filePathA);
    const nameB = pathBasename(filePathB);
    const extensionA = toDotExtension(nameA);
    const extensionB = toDotExtension(nameB);
    if (extensionA !== extensionB) {
        return extensionA < extensionB ? -1 : 1;
    }
    const byName = nameA.localeCompare(nameB, undefined, {
        numeric: true,
        sensitivity: 'base',
    });
    if (byName !== 0) {
        return byName;
    }
    if (filePathA === filePathB) {
        return 0;
    }
    return filePathA < filePathB ? -1 : 1;
}

const RESOURCE_ICON_BY_DOT_EXTENSION: { [key: string]: [string, string?] } = {
    // Same glyphs and tints the Documents list gives these very files, so one
    // file reads the same in both places -- see `documentIconByDotExtension`.
    '.pdf': ['file-earmark-pdf', '#bd0b02'],
    '.pptx': ['file-earmark-ppt', '#d24726'],
    '.ppt': ['file-earmark-ppt', '#d24726'],
    '.docx': ['file-earmark-word', '#2b579a'],
    '.doc': ['file-earmark-word', '#2b579a'],
    '.own': ['journal-text'],
};

// Built ONCE at module load, not per row. The obvious alternative,
// `getFileMetaData(name)`, runs `getAllAppMimetype()` -- a `structuredClone` of
// all fourteen mimetype tables -- on every single call, which is a whole
// mimetype registry rebuilt to draw one 16px icon.
for (const [mimetypeName, iconName] of [
    ['image', 'file-earmark-image'],
    ['video', 'file-earmark-play'],
    ['audio', 'file-earmark-music'],
] as const) {
    for (const extension of getMimetypeExtensions(mimetypeName)) {
        const dotExtension = `.${extension.toLowerCase()}`;
        RESOURCE_ICON_BY_DOT_EXTENSION[dotExtension] ??= [iconName];
    }
}

export function toResourceIcon(fileFullName: string): [string, string?] {
    return (
        RESOURCE_ICON_BY_DOT_EXTENSION[toDotExtension(fileFullName)] ?? [
            // The same "unknown" glyph `toDragTypeIconName` falls back to.
            'question-diamond',
        ]
    );
}

// 10 seconds, matching `globalCacheManager10Seconds`: `CacheManager` warns above
// that, and a short life is all this needs -- it exists to make toggling a box,
// flipping between two verses and a StrictMode double-mount free, not to hold
// results. Only the MATCHES are stored, never a directory listing: a listing of
// a big tree is tens of thousands of strings retained for a panel that shows a
// handful of them.
const scanCacheManager = new CacheManager<ResourcesScanResultType>(10);

function toScanCacheKey(
    dirPath: string,
    bookKey: string,
    chapter: number,
    lowerSearchText: string,
) {
    // The search text goes LAST so `invalidateResourcesScanCache`'s
    // `${dirPath} ` prefix still drops every entry for a folder, whatever was
    // typed when they were made.
    return `${dirPath} ${bookKey.toLowerCase()} ${chapter} ${lowerSearchText}`;
}

/**
 * Drop what a folder cached, so the next scan really reads the disk again.
 *
 * Nothing watches these folders -- they are anywhere on the machine, outside
 * the app's data dir and the `fs.watch` on it -- so a file added while the app
 * is open is only picked up by the TTL lapsing or by this.
 */
export function invalidateResourcesScanCache(dirPath?: string) {
    if (dirPath === undefined) {
        scanCacheManager.clear();
        return;
    }
    const keyPrefix = `${dirPath} `;
    scanCacheManager.deleteMatchedSync((key) => {
        return key.startsWith(keyPrefix);
    });
}

async function walkForMatches(
    dirPath: string,
    bookKey: string,
    chapter: number,
    lowerSearchText: string,
    checkShouldStop: () => boolean,
): Promise<ResourcesScanResultType | null> {
    const filePaths: string[] = [];
    const searchedFilePaths: string[] = [];
    // Breadth-first, with an explicit queue. The file the user wants is almost
    // always one or two levels down, so if a budget runs out, breadth-first has
    // already found it -- depth-first could spend the whole budget inside one
    // deep `Archive/2019/...` branch and come back with nothing.
    const queue: { dirPath: string; depth: number }[] = [{ dirPath, depth: 0 }];
    let directoryCount = 0;
    let entryCount = 0;
    let isTruncated = false;
    let isSearchTruncated = false;
    while (queue.length > 0) {
        if (checkShouldStop()) {
            return null;
        }
        if (
            directoryCount >= MAX_SCAN_DIRECTORIES ||
            entryCount >= MAX_SCAN_ENTRIES
        ) {
            isTruncated = true;
            break;
        }
        const current = queue.shift() as { dirPath: string; depth: number };
        let direntList;
        try {
            direntList = await fsListDirents(current.dirPath);
        } catch (error) {
            // The ROOT has to surface: "that folder is gone" and "I cannot read
            // that folder" are the two things the box must be able to say. A
            // subfolder that cannot be read is skipped instead -- one
            // unreadable system folder must not void the whole search.
            if (current.depth === 0) {
                throw error;
            }
            continue;
        }
        directoryCount += 1;
        entryCount += direntList.length;
        for (const { name, isFile, isDirectory } of direntList) {
            if (checkIsHiddenName(name)) {
                continue;
            }
            if (isFile) {
                if (checkIsMatchedName(name, bookKey, chapter)) {
                    filePaths.push(pathJoin(current.dirPath, name));
                } else if (
                    lowerSearchText !== '' &&
                    checkIsSearchedName(name, lowerSearchText)
                ) {
                    // Over the cap the walk carries ON rather than breaking:
                    // the verse matches still have to be collected, and they
                    // are the ones the panel exists to show.
                    if (searchedFilePaths.length >= MAX_SEARCH_MATCHES) {
                        isSearchTruncated = true;
                    } else {
                        searchedFilePaths.push(pathJoin(current.dirPath, name));
                    }
                }
            } else if (isDirectory && current.depth < MAX_SCAN_DEPTH) {
                queue.push({
                    dirPath: pathJoin(current.dirPath, name),
                    depth: current.depth + 1,
                });
            }
            // Anything that is neither -- a symlink, a socket -- is skipped,
            // which also makes a symlink cycle impossible by construction.
        }
        if (directoryCount % YIELD_EVERY_DIRECTORIES === 0) {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        }
    }
    filePaths.sort(compareResourceFiles);
    searchedFilePaths.sort(compareResourceFiles);
    return { filePaths, searchedFilePaths, isTruncated, isSearchTruncated };
}

/**
 * Every file under `dirPath` belonging to this book and chapter -- the
 * chapter's own files plus the book-level ones (`PSA.0.*`) -- and, when
 * `searchText` is given, everything else under it whose name contains that
 * text, returned separately.
 *
 * Returns `null` when `checkShouldStop` asked it to give up, so a walk started
 * for a verse the user has already moved off stops touching the disk instead of
 * running to completion on the machine that can least afford it. An abandoned
 * walk is never cached -- its result is partial by definition.
 *
 * Throws only when the ROOT folder cannot be read; the caller renders that.
 */
export async function scanResourceFiles(
    dirPath: string,
    bookKey: string,
    chapter: number,
    searchText: string = '',
    checkShouldStop: () => boolean = () => false,
): Promise<ResourcesScanResultType | null> {
    const lowerSearchText = normalizeResourceSearchText(searchText);
    const cacheKey = toScanCacheKey(dirPath, bookKey, chapter, lowerSearchText);
    return await scanCacheManager.unlocking(cacheKey, async () => {
        // Inside the lock: two boxes over one folder, or a remount from a tab
        // switch, then cost one walk instead of two racing ones.
        const cached = scanCacheManager.getSync(cacheKey);
        if (cached !== null) {
            return cached;
        }
        const result = await walkForMatches(
            dirPath,
            bookKey,
            chapter,
            lowerSearchText,
            checkShouldStop,
        );
        if (result !== null) {
            scanCacheManager.setSync(cacheKey, result);
        }
        return result;
    });
}
