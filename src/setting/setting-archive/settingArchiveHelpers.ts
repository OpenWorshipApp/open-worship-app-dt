import {
    ARCHIVE_VERSION,
    MANIFEST_FILE_NAME,
    SETTING_ARCHIVE_ITEM_KIND,
    createWorkDir,
    safeDeleteDir,
    writeArchiveManifest,
} from '../../helper/appArchiveHelpers';
import {
    PLAIN_ARCHIVE_TEMP_NAME,
    checkIsArchiveFileFullName,
    genNextArchiveFilePath,
    toArchiveDotExtension,
    toArchiveFileName,
} from '../../helper/archiveNameHelpers';
import {
    openArchiveForReading,
    protectArchiveFile,
} from '../../helper/archivePasswordHelpers';
import { mapInYieldingBatches } from '../../helper/helpers';
import { tarCreate, tarExtract } from '../../server/appHelpers';
import { appHomeStorage } from '../../server/appHomeStorage';
import appProvider from '../../server/appProvider';
import { appSecureStorage } from '../../server/appSecureStorage';
import {
    fsCheckFileExist,
    fsGetFileSize,
    fsReadFileBytes,
    getDownloadPath,
    pathJoin,
    toPortableFileText,
    toRealFileText,
} from '../../server/fileHelpers';
import { appLocalStorage } from '../directory-setting/appLocalStorage';
import {
    SECURE_SETTING_KEY_LIST,
    SETTING_SECTION_LIST,
    SETTING_STORE_LIST,
    type SettingStoreType,
    THEME_LEAF_ID,
    THEME_SETTING_KEY,
    checkIsPortableSettingKey,
    getSettingLeaf,
    toSettingLeafId,
} from './settingArchiveCatalog';

/**
 * The file **Export Settings** writes and **Import Settings** reads: a
 * `.owasetting.tar.gz` holding nothing but `manifest.json`, or
 * `.owasetting.enc` once it has a password (the shared container,
 * `archivePasswordHelpers`).
 *
 * The manifest lists the SECTIONS (leaf ids, `settingArchiveCatalog`) that
 * were chosen and every setting in them. A section chosen with nothing in it
 * is still listed, because an import REPLACES a section: what the file leaves
 * out goes back to its default, and an empty section is how a file says
 * "all default here".
 *
 * Local settings travel PORTABLE: a path inside the data folder is stored as
 * `$DATA_DIR_PATH`, exactly as it sits on disk, and expands to the data folder
 * of the computer it is imported on. That conversion is done one VALUE at a
 * time, against the setting's own file, never over the manifest as a whole --
 * a value is JSON inside JSON there, and the alias rules read the escape level
 * off the text around a path.
 */

export const SETTING_ARCHIVE_DOT_EXTENSION = '.owasetting.tar.gz';
export const SETTING_ARCHIVE_FALLBACK_NAME = 'Settings';
// Tight enough to refuse a file that is plainly not one of ours before it is
// parsed; a real profile's manifest is a few MB, one big value ~1 MB
// (`excalidraw-libraries`).
const MAX_MANIFEST_BYTE_SIZE = 64 * 1024 * 1024;
const MAX_ENTRY_COUNT = 50_000;
const MAX_VALUE_LENGTH = 8 * 1024 * 1024;
const MAX_TOTAL_VALUE_LENGTH = 50 * 1024 * 1024;
const INVALID_MANIFEST_MESSAGE = 'Invalid settings archive manifest';
// A file saved by an editor may start with a byte order mark.
const BOM_PATTERN = new RegExp(`^${String.fromCharCode(0xfeff)}`);
const THEME_VALUE_LIST = ['light', 'dark', 'system'];
const DEFAULT_THEME_VALUE = 'system';
// How many settings are written or removed between two yields to the event
// loop, so the progress bar keeps painting on a slow machine.
const WRITE_BATCH_SIZE = 50;

export type SettingArchiveEntryType = {
    store: SettingStoreType;
    key: string;
    value: string;
};

export type SettingArchiveManifestType = {
    version: typeof ARCHIVE_VERSION;
    itemKind: typeof SETTING_ARCHIVE_ITEM_KIND;
    /** The leaf ids chosen at export, in catalog order. */
    sections: string[];
    settings: SettingArchiveEntryType[];
};

export type SettingKeyRefType = {
    store: SettingStoreType;
    key: string;
    leafId: string;
};

export function checkIsSettingArchiveFileFullName(fileFullName: string) {
    return checkIsArchiveFileFullName(
        fileFullName,
        SETTING_ARCHIVE_DOT_EXTENSION,
    );
}

function decodeText(bytes: Uint8Array) {
    return new TextDecoder().decode(bytes);
}

function yieldToEventLoop() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

function readTheme() {
    const theme = appProvider.messageUtils.sendDataSync('main:app:get-theme');
    return typeof theme === 'string' ? theme : DEFAULT_THEME_VALUE;
}

function addCount(countByLeafId: Map<string, number>, leafId: string) {
    countByLeafId.set(leafId, (countByLeafId.get(leafId) ?? 0) + 1);
}

/**
 * Every setting that could be exported, by NAME only: one directory listing
 * and one call for the main process's own store. No value is read here, and
 * no credential -- reading one can raise the OS keychain prompt, which must
 * not happen merely because the dialog opened. The credentials are listed by
 * the allowlist and counted nowhere.
 */
export async function listExportableSettingKeys() {
    const refs: SettingKeyRefType[] = [];
    const countByLeafId = new Map<string, number>();
    const addRef = (store: SettingStoreType, key: string) => {
        const leafId = toSettingLeafId(store, key);
        if (leafId === null) {
            return;
        }
        refs.push({ store, key, leafId });
        if (store !== 'secure') {
            addCount(countByLeafId, leafId);
        }
    };
    for (const key of await appLocalStorage.listKeys()) {
        addRef('local', key);
    }
    for (const key of appHomeStorage.getAllKeys()) {
        addRef('home', key);
    }
    for (const key of SECURE_SETTING_KEY_LIST) {
        addRef('secure', key);
    }
    addRef('theme', THEME_SETTING_KEY);
    return { refs, countByLeafId };
}

async function readLocalSettingText(key: string) {
    const fullPath = appLocalStorage.toFullPath(key);
    if (!(await fsCheckFileExist(fullPath))) {
        return null;
    }
    // The bytes as they are on disk -- already portable for anything written
    // since the alias existed -- and converted once more for a value written
    // before it, which still holds this computer's own path.
    return toPortableFileText(
        fullPath,
        decodeText(await fsReadFileBytes(fullPath)),
    );
}

async function readSettingValue({ store, key }: SettingKeyRefType) {
    if (store === 'local') {
        return await readLocalSettingText(key);
    }
    if (store === 'home') {
        return appHomeStorage.getItem(key);
    }
    if (store === 'secure') {
        return appSecureStorage.getItem(key);
    }
    return readTheme();
}

/** Catalog order, unknown ids and duplicates dropped. */
function toOrderedLeafIds(leafIds: Iterable<string>) {
    const leafIdSet = new Set(leafIds);
    return SETTING_SECTION_LIST.flatMap((section) => {
        return section.leaves
            .filter((leaf) => {
                return leafIdSet.has(leaf.id);
            })
            .map((leaf) => {
                return leaf.id;
            });
    });
}

/**
 * The chosen leaves this export may write. Credentials only ever go into a
 * protected file: the dialog already refuses the combination, and this is
 * the line that holds if a caller did not.
 */
function toWritableLeafIds(leafIds: string[], isProtected: boolean) {
    return toOrderedLeafIds(
        leafIds.filter((leafId) => {
            const leaf = getSettingLeaf(leafId);
            return leaf !== null && (isProtected || !leaf.needsPassword);
        }),
    );
}

export function toSettingArchiveFileName(
    name: string,
    password: string | null = null,
) {
    return toArchiveFileName(
        name,
        toArchiveDotExtension(SETTING_ARCHIVE_DOT_EXTENSION, password),
        SETTING_ARCHIVE_FALLBACK_NAME,
    );
}

/**
 * Write the chosen sections into the Downloads folder and answer the path.
 * Values are read only for the chosen sections, a batch at a time.
 */
export async function createSettingArchive(
    refs: SettingKeyRefType[],
    leafIds: string[],
    password: string | null = null,
) {
    const isProtected = !!password;
    const sections = toWritableLeafIds(leafIds, isProtected);
    const sectionSet = new Set(sections);
    const chosenRefs = refs.filter((ref) => {
        return (
            sectionSet.has(ref.leafId) &&
            (isProtected || ref.store !== 'secure')
        );
    });
    const values = await mapInYieldingBatches(chosenRefs, readSettingValue);
    const settings: SettingArchiveEntryType[] = [];
    chosenRefs.forEach(({ store, key }, index) => {
        const value = values[index];
        if (typeof value === 'string') {
            settings.push({ store, key, value });
        }
    });
    const manifest: SettingArchiveManifestType = {
        version: ARCHIVE_VERSION,
        itemKind: SETTING_ARCHIVE_ITEM_KIND,
        sections,
        settings,
    };
    // In a `finally` below: with a password the staged manifest holds the
    // credentials in plain text, and must never outlive this call.
    const stagingDir = await createWorkDir('owasetting-export');
    try {
        await writeArchiveManifest(stagingDir, manifest);
        const dotExtension = toArchiveDotExtension(
            SETTING_ARCHIVE_DOT_EXTENSION,
            password,
        );
        const archiveFilePath = await genNextArchiveFilePath(
            getDownloadPath(),
            toSettingArchiveFileName(SETTING_ARCHIVE_FALLBACK_NAME, password),
            dotExtension,
        );
        const plainFilePath = password
            ? pathJoin(stagingDir, PLAIN_ARCHIVE_TEMP_NAME)
            : archiveFilePath;
        await tarCreate(stagingDir, plainFilePath, [MANIFEST_FILE_NAME], true);
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

function checkIsSettingStore(store: unknown): store is SettingStoreType {
    return (SETTING_STORE_LIST as readonly unknown[]).includes(store);
}

/**
 * The manifest as this version will act on it. Anyone can hand-edit a file,
 * so everything is checked and only the known fields are copied.
 *
 * REFUSED (thrown) -- the file is not one this app wrote: a wrong version or
 * kind, a malformed entry, a key that is not a plain file name (a local key
 * BECOMES a file name, so `..\` or `C:` there is an attack, not a typo), a
 * duplicate, sizes past any real profile.
 *
 * DROPPED (silently) -- the file is fine but this version will not take that
 * part: a key excluded since it was written, one the home or secure allowlist
 * does not name, a section this version does not know, a setting outside every
 * section the file lists (replacing a section only some of whose settings are
 * in the file would wipe the rest), and EVERY credential when the file was not
 * password-protected -- Export Settings never writes one into an unprotected
 * file, so one found there was put there by someone else.
 *
 * Error messages name an index or a key, never a value.
 */
export function validateSettingManifest(
    jsonData: unknown,
    isProtected: boolean,
): SettingArchiveManifestType {
    const manifest = jsonData as Record<string, any> | null;
    if (
        manifest === null ||
        typeof manifest !== 'object' ||
        manifest.version !== ARCHIVE_VERSION
    ) {
        throw new Error(INVALID_MANIFEST_MESSAGE);
    }
    if (manifest.itemKind !== SETTING_ARCHIVE_ITEM_KIND) {
        throw new Error(
            `This archive holds a "${String(manifest.itemKind)}", not settings`,
        );
    }
    if (
        !Array.isArray(manifest.sections) ||
        !Array.isArray(manifest.settings)
    ) {
        throw new TypeError(INVALID_MANIFEST_MESSAGE);
    }
    if (manifest.settings.length > MAX_ENTRY_COUNT) {
        throw new Error('This settings archive holds too many settings');
    }
    const sections = toWritableLeafIds(
        manifest.sections.filter((leafId: unknown) => {
            return typeof leafId === 'string';
        }),
        isProtected,
    );
    const sectionSet = new Set(sections);
    const seenIds = new Set<string>();
    const settings: SettingArchiveEntryType[] = [];
    let totalLength = 0;
    manifest.settings.forEach((entry: unknown, index: number) => {
        if (entry === null || typeof entry !== 'object') {
            throw new TypeError(`Invalid setting at #${index}`);
        }
        const { store, key, value } = entry as Record<string, unknown>;
        if (!checkIsSettingStore(store)) {
            throw new TypeError(`Invalid setting store at #${index}`);
        }
        if (!checkIsPortableSettingKey(key) || typeof value !== 'string') {
            throw new TypeError(`Invalid setting at #${index}`);
        }
        if (value.length > MAX_VALUE_LENGTH) {
            throw new Error(`Setting "${key}" is too large`);
        }
        totalLength += value.length;
        if (totalLength > MAX_TOTAL_VALUE_LENGTH) {
            throw new Error('This settings archive is too large');
        }
        const id = `${store}\n${key}`;
        if (seenIds.has(id)) {
            throw new Error(`Duplicate setting "${key}"`);
        }
        seenIds.add(id);
        const leafId = toSettingLeafId(store, key);
        if (
            leafId === null ||
            !sectionSet.has(leafId) ||
            (store === 'secure' && !isProtected) ||
            (store === 'theme' && !THEME_VALUE_LIST.includes(value))
        ) {
            return;
        }
        settings.push({ store, key, value });
    });
    return {
        version: ARCHIVE_VERSION,
        itemKind: SETTING_ARCHIVE_ITEM_KIND,
        sections,
        settings,
    };
}

/**
 * Open a settings file and read its manifest, ONCE. `null` is the password
 * prompt cancelled. Only `manifest.json` is extracted; the file holds nothing
 * else, and a bundle of another kind should not be unpacked to find that out.
 *
 * Read as raw bytes rather than through `fsReadFile`, which would expand
 * `$DATA_DIR_PATH` across the whole manifest at once -- see the module note.
 */
export async function openSettingArchive(
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
    await tarExtract(readableArchive.filePath, extractDir, [
        MANIFEST_FILE_NAME,
    ]);
    const manifestFilePath = pathJoin(extractDir, MANIFEST_FILE_NAME);
    if (
        !(await fsCheckFileExist(manifestFilePath)) ||
        (await fsGetFileSize(manifestFilePath)) > MAX_MANIFEST_BYTE_SIZE
    ) {
        throw new Error(INVALID_MANIFEST_MESSAGE);
    }
    let jsonData: unknown;
    try {
        jsonData = JSON.parse(
            decodeText(await fsReadFileBytes(manifestFilePath)).replace(
                BOM_PATTERN,
                '',
            ),
        );
    } catch (error) {
        throw new Error(INVALID_MANIFEST_MESSAGE, { cause: error });
    }
    const { isProtected } = readableArchive;
    return {
        manifest: validateSettingManifest(jsonData, isProtected),
        isProtected,
    };
}

/** How many settings of the file fall in each of its sections. */
export function countManifestByLeaf(manifest: SettingArchiveManifestType) {
    const countByLeafId = new Map<string, number>();
    for (const { store, key } of manifest.settings) {
        const leafId = toSettingLeafId(store, key);
        if (leafId !== null) {
            addCount(countByLeafId, leafId);
        }
    }
    return countByLeafId;
}

export type SettingImportResultType = {
    /** Settings written because they differed from what was here. */
    writtenCount: number;
    /** Settings removed because the file left them at their default. */
    removedCount: number;
    /** A chosen section is read by the main process at launch. */
    needsRelaunch: boolean;
};

async function forEachInBatches<T>(
    items: Iterable<T>,
    callee: (item: T) => void,
) {
    let count = 0;
    for (const item of items) {
        callee(item);
        count++;
        if (count % WRITE_BATCH_SIZE === 0) {
            await yieldToEventLoop();
        }
    }
}

/**
 * Import the chosen sections of a file, REPLACING each one: every setting on
 * this computer that belongs to a chosen section and is not in the file is
 * removed (back to its default), and every one in the file is written. A
 * section that was not chosen is not touched.
 *
 * Both sides are classified by THIS version's catalog, so a setting is always
 * judged by the rules the app running now uses for it.
 *
 * Credentials are taken only out of a protected file, and only when a
 * credentials section was chosen; reading them back to compare is skipped
 * (it can raise the OS keychain prompt), so they are simply written.
 */
export async function importSettingSections(
    manifest: SettingArchiveManifestType,
    leafIds: string[],
    isProtected: boolean,
): Promise<SettingImportResultType> {
    const fileSectionSet = new Set(manifest.sections);
    const chosenLeafIdSet = new Set(
        toWritableLeafIds(leafIds, isProtected).filter((leafId) => {
            return fileSectionSet.has(leafId);
        }),
    );
    const desiredMaps: Record<SettingStoreType, Map<string, string>> = {
        local: new Map(),
        home: new Map(),
        secure: new Map(),
        theme: new Map(),
    };
    for (const { store, key, value } of manifest.settings) {
        const leafId = toSettingLeafId(store, key);
        if (leafId !== null && chosenLeafIdSet.has(leafId)) {
            desiredMaps[store].set(key, value);
        }
    }
    const checkIsChosen = (store: SettingStoreType, key: string) => {
        const leafId = toSettingLeafId(store, key);
        return leafId !== null && chosenLeafIdSet.has(leafId);
    };
    let writtenCount = 0;
    let removedCount = 0;

    const localKeysToRemove = (await appLocalStorage.listKeys()).filter(
        (key) => {
            return checkIsChosen('local', key) && !desiredMaps.local.has(key);
        },
    );
    await forEachInBatches(localKeysToRemove, (key) => {
        appLocalStorage.removeItem(key);
        removedCount++;
    });
    await forEachInBatches(desiredMaps.local.entries(), ([key, value]) => {
        const realValue = toRealFileText(
            appLocalStorage.toFullPath(key),
            value,
        );
        if (appLocalStorage.getItemForce(key) !== realValue) {
            appLocalStorage.setItem(key, realValue);
            writtenCount++;
        }
    });

    for (const key of appHomeStorage.getAllKeys()) {
        if (checkIsChosen('home', key) && !desiredMaps.home.has(key)) {
            appHomeStorage.removeItem(key);
            removedCount++;
        }
    }
    for (const [key, value] of desiredMaps.home) {
        if (appHomeStorage.getItem(key) !== value) {
            appHomeStorage.setItem(key, value);
            writtenCount++;
        }
    }

    if (isProtected) {
        for (const key of SECURE_SETTING_KEY_LIST) {
            if (!checkIsChosen('secure', key)) {
                continue;
            }
            const value = desiredMaps.secure.get(key);
            if (value === undefined) {
                appSecureStorage.removeItem(key);
            } else {
                appSecureStorage.setItem(key, value);
                writtenCount++;
            }
        }
    }

    if (chosenLeafIdSet.has(THEME_LEAF_ID)) {
        const theme =
            desiredMaps.theme.get(THEME_SETTING_KEY) ?? DEFAULT_THEME_VALUE;
        if (readTheme() !== theme) {
            appProvider.messageUtils.sendData('main:app:set-theme', theme);
            writtenCount++;
        }
    }

    const needsRelaunch = Array.from(chosenLeafIdSet).some((leafId) => {
        return getSettingLeaf(leafId)?.needsRelaunch === true;
    });
    return { writtenCount, removedCount, needsRelaunch };
}
