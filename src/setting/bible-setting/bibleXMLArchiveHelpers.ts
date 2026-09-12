import {
    ARCHIVE_FILES_DIR,
    ARCHIVE_VERSION,
    MANIFEST_FILE_NAME,
    createWorkDir,
    readArchiveManifest,
    safeDeleteDir,
    writeArchiveManifest,
} from '../../helper/appArchiveHelpers';
// From the LEAF, not `appArchiveHelpers`, for the naming rules: they are the
// only part of it a bundle this simple shares, and taking them from here says
// so. `appArchiveHelpers` re-exports them anyway.
import {
    PLAIN_ARCHIVE_TEMP_NAME,
    checkIsArchiveFileFullName,
    genNextArchiveFilePath,
    sanitizeFileNamePart,
    toArchiveDotExtension,
    toArchiveFileName,
} from '../../helper/archiveNameHelpers';
import {
    openArchiveForReading,
    protectArchiveFile,
} from '../../helper/archivePasswordHelpers';
import { tarCreate, tarExtract } from '../../server/appHelpers';
import {
    ensureDirectory,
    fsCheckFileExist,
    fsCloneFile,
    getDownloadPath,
    pathJoin,
} from '../../server/fileHelpers';
import {
    bibleKeyToXMLFilePath,
    getAllXMLFileKeys,
    getBibleHeadInfoFromFile,
    getBibleKeyFromFile,
} from './bibleXMLJsonDataHelpers';
import { clearBibleXMLCache } from './bibleXMLHelpers';

/**
 * The XML bibles of the Bible settings page as a `.owabdata.tar.gz` bundle.
 *
 * NOT built on `src/helper/singleItemArchiveHelpers.ts`: that bundles ONE list
 * item plus its `.bg.json` sidecar, canvas media and color notes, and resolves
 * where it lands through `kindDirSettingNameMap` — a folder the operator chose.
 * An XML bible has none of that. They are flat files, MANY per bundle, in an
 * app-managed folder (`bibleDataReader.getWritableBiblePath()`), and what
 * identifies one is the bible KEY inside the XML rather than its file name.
 * The shape this follows is `src/bible-list/note/bibleNoteItemArchiveHelpers.ts`
 * — a bespoke bundle over the shared leaf helpers.
 *
 * Layout: `manifest.json` + `files/`. Password protection rides the shared
 * container, so a protected export is `<name>.owabdata.enc` and is recognised by
 * its magic bytes rather than by that name.
 *
 * The downloaded bible DATABASES beside these XML files are deliberately not
 * bundled: they are hundreds of MB and re-downloadable, which is the same call
 * the whole-data archive makes when it filters that folder to `*.xml`.
 */

export const BIBLE_XML_ARCHIVE_DOT_EXTENSION = '.owabdata.tar.gz';
export const BIBLE_XML_ARCHIVE_FALLBACK_NAME = 'Bible Data';
const BIBLE_XML_ITEM_KIND = 'bible-xml';

export type BibleXMLArchiveEntryType = {
    /** The key as it was written in the XML on the exporting machine. */
    bibleKey: string;
    /** Row label; may be empty when the head chunk carried no title. */
    title: string;
    /** The file's original name, e.g. `KJV.xml`. */
    fileFullName: string;
    /** Where it sits inside the bundle, e.g. `files/001-KJV.xml`. */
    archivePath: string;
};

export type BibleXMLArchiveManifestType = {
    version: typeof ARCHIVE_VERSION;
    /** Refuses another kind of bundle picked through the file dialog. */
    itemKind: typeof BIBLE_XML_ITEM_KIND;
    bibles: BibleXMLArchiveEntryType[];
};

/**
 * Why a row cannot be imported. Both shapes read to the operator as the same
 * thing — "this one is not coming in, and here is why" — which is why they are
 * one field rather than a boolean plus a reason.
 */
export type BibleXMLImportIssueType =
    'unreadable' | 'duplicate' | 'duplicate-in-archive';

export const BIBLE_XML_IMPORT_ISSUE_MESSAGE_MAP: Record<
    BibleXMLImportIssueType,
    string
> = {
    unreadable: 'Unable to read this bible file',
    duplicate: 'Bible key already exists',
    'duplicate-in-archive': 'Duplicate bible key in this archive',
};

export type BibleXMLImportEntryType = BibleXMLArchiveEntryType & {
    /** The extracted file on disk — the thing that actually gets copied in. */
    extractedFilePath: string;
    /** `null` ⇒ importable. Anything else makes the row red and skips it. */
    issue: BibleXMLImportIssueType | null;
};

export function checkIsBibleXMLArchiveFileFullName(fileFullName: string) {
    return checkIsArchiveFileFullName(
        fileFullName,
        BIBLE_XML_ARCHIVE_DOT_EXTENSION,
    );
}

/** Keys compare case-insensitively: `kjv` and `KJV` are the same bible. */
function toComparableBibleKey(bibleKey: string) {
    return bibleKey.trim().toLocaleLowerCase();
}

export type BibleXMLExportEntryType = {
    bibleKey: string;
    title: string;
    filePath: string;
};

/**
 * Every installed XML bible, with a label, for the export picker. Built from the
 * 4KB head read rather than from `getBibleInfo`, which parses the whole file —
 * opening this dialog must not cost a full parse of every bible on the machine.
 */
export async function getExportableBibleXMLEntries() {
    const bibleKeyFilePathMap = await getAllXMLFileKeys();
    const entries: BibleXMLExportEntryType[] = [];
    // Sequential on purpose, like `getAllXMLFileKeys` itself: concurrent reads
    // would hold every file's fallback full read in memory at once.
    for (const [bibleKey, filePath] of Object.entries(bibleKeyFilePathMap)) {
        const headInfo = await getBibleHeadInfoFromFile(filePath);
        entries.push({
            bibleKey,
            title: headInfo?.title ?? '',
            filePath,
        });
    }
    return entries.sort((entryA, entryB) => {
        return entryA.bibleKey.localeCompare(entryB.bibleKey);
    });
}

function toArchiveEntryPath(index: number, fileFullName: string) {
    const fileName = sanitizeFileNamePart(fileFullName);
    const paddedIndex = String(index + 1).padStart(3, '0');
    return `${ARCHIVE_FILES_DIR}/${paddedIndex}-${fileName || 'bible.xml'}`;
}

export function toBibleXMLArchiveFileName(
    name: string,
    password: string | null = null,
) {
    return toArchiveFileName(
        name,
        toArchiveDotExtension(BIBLE_XML_ARCHIVE_DOT_EXTENSION, password),
        BIBLE_XML_ARCHIVE_FALLBACK_NAME,
    );
}

/**
 * Write the bundle into the Downloads folder and answer its path. The XML files
 * are cloned into a staging dir rather than read into memory — a bible is
 * several MB and a bundle may hold a dozen of them.
 */
export async function createBibleXMLArchive(
    entries: BibleXMLExportEntryType[],
    password: string | null = null,
) {
    const stagingDir = await createWorkDir('owabdata-export');
    try {
        await ensureDirectory(pathJoin(stagingDir, ARCHIVE_FILES_DIR));
        const bibles: BibleXMLArchiveEntryType[] = [];
        for (const [index, entry] of entries.entries()) {
            const fileFullName = `${entry.bibleKey}.xml`;
            const archivePath = toArchiveEntryPath(index, fileFullName);
            await fsCloneFile(
                entry.filePath,
                pathJoin(stagingDir, ...archivePath.split('/')),
            );
            bibles.push({
                bibleKey: entry.bibleKey,
                title: entry.title,
                fileFullName,
                archivePath,
            });
        }
        const manifest: BibleXMLArchiveManifestType = {
            version: ARCHIVE_VERSION,
            itemKind: BIBLE_XML_ITEM_KIND,
            bibles,
        };
        await writeArchiveManifest(stagingDir, manifest);
        const archiveFilePath = await genNextArchiveFilePath(
            getDownloadPath(),
            toBibleXMLArchiveFileName(
                BIBLE_XML_ARCHIVE_FALLBACK_NAME,
                password,
            ),
            toArchiveDotExtension(BIBLE_XML_ARCHIVE_DOT_EXTENSION, password),
        );
        // Protecting one means tar writes into the staging dir instead — that
        // dir is deleted in `finally` either way, so the plain copy never
        // outlives the call and only the wrapped one reaches Downloads. Safe at
        // the staging root: the entry list below is explicit, so tar never
        // packs it.
        const plainFilePath = password
            ? pathJoin(stagingDir, PLAIN_ARCHIVE_TEMP_NAME)
            : archiveFilePath;
        await tarCreate(
            stagingDir,
            plainFilePath,
            [MANIFEST_FILE_NAME, ARCHIVE_FILES_DIR],
            true,
        );
        if (password) {
            return await protectArchiveFile(
                plainFilePath,
                archiveFilePath,
                password,
            );
        }
        return archiveFilePath;
    } finally {
        await safeDeleteDir(stagingDir);
    }
}

function validateManifest(jsonData: unknown): BibleXMLArchiveManifestType {
    const manifest = jsonData as Partial<BibleXMLArchiveManifestType> | null;
    if (
        manifest === null ||
        typeof manifest !== 'object' ||
        manifest.version !== ARCHIVE_VERSION
    ) {
        throw new Error('Invalid bible data archive manifest');
    }
    if (manifest.itemKind !== BIBLE_XML_ITEM_KIND) {
        throw new Error(
            `This archive holds a "${manifest.itemKind}", not bible data`,
        );
    }
    if (!Array.isArray(manifest.bibles)) {
        throw new TypeError('Invalid bible data archive manifest');
    }
    return {
        version: ARCHIVE_VERSION,
        itemKind: BIBLE_XML_ITEM_KIND,
        bibles: manifest.bibles.map((bible: any) => {
            if (
                typeof bible?.bibleKey !== 'string' ||
                typeof bible?.archivePath !== 'string'
            ) {
                throw new TypeError('Invalid bible data archive entry');
            }
            return {
                bibleKey: bible.bibleKey,
                title: typeof bible.title === 'string' ? bible.title : '',
                fileFullName:
                    typeof bible.fileFullName === 'string'
                        ? bible.fileFullName
                        : `${bible.bibleKey}.xml`,
                archivePath: bible.archivePath,
            };
        }),
    };
}

/**
 * `archivePath` comes out of a file anyone could have edited, so it is resolved
 * segment by segment and never allowed to climb out of the extract dir. Same
 * rule, and the same message, as every other bundle's.
 */
function toExtractedFilePath(extractDir: string, archivePath: string) {
    const parts = archivePath.split('/').filter((part) => {
        return part.length > 0;
    });
    if (
        parts.length === 0 ||
        parts.some((part) => {
            return part === '..' || part.includes('\\');
        })
    ) {
        throw new Error('Invalid archive file path');
    }
    return pathJoin(extractDir, ...parts);
}

/**
 * Open a bundle and unpack it whole, ONCE.
 *
 * A protected archive has to be decrypted before anything inside it can be
 * read, and doing that twice — once to list what is in it, once to import it —
 * is what the whole-data archive documents as the mistake not to repeat. So the
 * caller gets the extract dir back and does both against it.
 */
export async function openBibleXMLArchive(
    archiveFilePath: string,
    extractDir: string,
    title: string,
) {
    const readableArchive = await openArchiveForReading(
        archiveFilePath,
        extractDir,
        title,
    );
    if (readableArchive === null) {
        return null;
    }
    await tarExtract(readableArchive.filePath, extractDir);
    return validateManifest(
        await readArchiveManifest(
            extractDir,
            'Invalid bible data archive manifest',
        ),
    );
}

/**
 * One verified row per manifest entry.
 *
 * The key is re-derived from the EXTRACTED FILE rather than trusted from the
 * manifest: the manifest is plain JSON inside a file anyone can rewrite, and a
 * row that claims a free key while holding a bible that is already installed is
 * exactly the overwrite this feature must never do. A file whose key cannot be
 * read, or whose key disagrees with what the manifest promised, is the "we
 * cannot check this one" case and goes red.
 */
export async function resolveBibleXMLImportEntries(
    extractDir: string,
    manifest: BibleXMLArchiveManifestType,
) {
    const installedKeys = new Set(
        Object.keys(await getAllXMLFileKeys()).map(toComparableBibleKey),
    );
    const seenKeys = new Set<string>();
    const entries: BibleXMLImportEntryType[] = [];
    for (const bible of manifest.bibles) {
        const extractedFilePath = toExtractedFilePath(
            extractDir,
            bible.archivePath,
        );
        let issue: BibleXMLImportIssueType | null = null;
        let bibleKey = bible.bibleKey;
        const actualBibleKey = (await fsCheckFileExist(extractedFilePath))
            ? await getBibleKeyFromFile(extractedFilePath)
            : null;
        if (
            actualBibleKey === null ||
            toComparableBibleKey(actualBibleKey) !==
                toComparableBibleKey(bible.bibleKey)
        ) {
            issue = 'unreadable';
        } else {
            bibleKey = actualBibleKey;
            const comparableKey = toComparableBibleKey(actualBibleKey);
            if (installedKeys.has(comparableKey)) {
                issue = 'duplicate';
            } else if (seenKeys.has(comparableKey)) {
                issue = 'duplicate-in-archive';
            }
            seenKeys.add(comparableKey);
        }
        entries.push({ ...bible, bibleKey, extractedFilePath, issue });
    }
    return entries;
}

/**
 * Copy the chosen bibles into the app's bible folder.
 *
 * Named after the bible's own KEY (`KJV.xml`), which is how `saveXMLText`
 * already names what it writes and what keeps `getAllXMLFileKeys` consistent —
 * so a bundle whose file was called `kjv-2011.xml` still lands as `KJV.xml`.
 *
 * The free-key check runs AGAIN here, against the folder as it is right now:
 * the picker may have sat open while another window imported the same bible, or
 * the operator may have re-run an import over a bundle they already took. This
 * never overwrites and never writes a `KJV (1).xml` beside an existing one — a
 * key that is taken by the time we get here is simply skipped.
 */
export async function importBibleXMLEntries(
    entries: BibleXMLImportEntryType[],
) {
    const installedKeys = new Set(
        Object.keys(await getAllXMLFileKeys()).map(toComparableBibleKey),
    );
    const importedBibleKeys: string[] = [];
    const skippedBibleKeys: string[] = [];
    for (const entry of entries) {
        const comparableKey = toComparableBibleKey(entry.bibleKey);
        if (entry.issue !== null || installedKeys.has(comparableKey)) {
            skippedBibleKeys.push(entry.bibleKey);
            continue;
        }
        const destinationFilePath = await bibleKeyToXMLFilePath(
            entry.bibleKey,
            true,
        );
        if (
            destinationFilePath === null ||
            (await fsCheckFileExist(destinationFilePath))
        ) {
            skippedBibleKeys.push(entry.bibleKey);
            continue;
        }
        await fsCloneFile(entry.extractedFilePath, destinationFilePath);
        // The key was free, but a `<KEY>.xml.cache` folder from whatever bible
        // last held it may not have been — and it would answer for this one.
        await clearBibleXMLCache(entry.bibleKey);
        installedKeys.add(comparableKey);
        importedBibleKeys.push(entry.bibleKey);
    }
    return { importedBibleKeys, skippedBibleKeys };
}
