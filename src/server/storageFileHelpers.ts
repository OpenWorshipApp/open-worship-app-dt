import appProvider from './appProvider';
import { handleError } from '../helper/errorHelpers';
import mimeWebList from './mime/web-types.json';
import {
    type DataDirAliasType,
    fromPortableText,
    genDataDirAlias,
    toPortableText,
} from './dataDirAliasHelpers';

/**
 * The small synchronous filesystem surface needed while every renderer boots.
 *
 * Keep this module independent of `fileHelpers`: locale startup reaches
 * `SettingManager` -> `appLocalStorage`, and importing the broad helper from
 * there pulls FileSource, document rendering and screen management into every
 * window before it needs them.
 */

export const pathSeparator = appProvider.pathUtils.sep;

export function pathJoin(...paths: string[]): string {
    return appProvider.pathUtils.join(...paths);
}

/** The active data folder, or null before window startup has selected one. */
export function getDataDirPath(): string | null {
    return appProvider.sessionData?.defaultStorageDirPath ?? null;
}

/**
 * A path as its root and the names under it. Windows accepts either separator;
 * macOS and Linux treat only `/` as one.
 */
export function splitPathRoot(
    filePath: string,
    isWindows = pathSeparator === '\\',
) {
    let root = '';
    if (isWindows) {
        const match =
            /^[\\/]{2}[^\\/]+[\\/][^\\/]+[\\/]?/.exec(filePath) ??
            /^[A-Za-z]:[\\/]?/.exec(filePath) ??
            /^[\\/]/.exec(filePath);
        root = match?.[0] ?? '';
    } else if (filePath.startsWith('/')) {
        root = '/';
    }
    const segments = filePath
        .slice(root.length)
        .split(isWindows ? /[\\/]/ : '/')
        .filter((part) => {
            return part.length > 0;
        });
    if (isWindows && root !== '' && !/[\\/]$/.test(root)) {
        root += '\\';
    }
    return { root, segments };
}

export function checkIsHiddenName(fileFullName: string) {
    return fileFullName.startsWith('.');
}

// A data folder carries this id so the same removable drive can be found after
// Windows changes its drive letter or another OS mounts it somewhere else.
export const DATA_DIR_MARKER_FILE_NAME = '.owa-data-folder.json';

const POSIX_VOLUME_BASES: [string[], number][] = [
    [['Volumes'], 1],
    [['media'], 2],
    [['run', 'media'], 2],
    [['mnt'], 1],
];

export function splitVolumePath(
    dirPath: string,
    isWindows = pathSeparator === '\\',
) {
    const { root, segments } = splitPathRoot(dirPath, isWindows);
    if (isWindows) {
        if (!/^[A-Za-z]:\\$/.test(root) || segments.length === 0) {
            return null;
        }
        return { volumeRoot: root, segments };
    }
    for (const [base, depth] of POSIX_VOLUME_BASES) {
        const mountLength = base.length + depth;
        const isUnderBase = base.every((name, index) => {
            return segments[index] === name;
        });
        if (isUnderBase && segments.length > mountLength) {
            return {
                volumeRoot: `/${segments.slice(0, mountLength).join('/')}`,
                segments: segments.slice(mountLength),
            };
        }
    }
    return null;
}

function listDirNamesSync(dirPath: string) {
    try {
        return appProvider.fileUtils.readdirSync(dirPath) as string[];
    } catch (_error) {
        return [];
    }
}

export function listVolumeRootsSync() {
    if (pathSeparator === '\\') {
        return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
            .split('')
            .map((letter) => {
                return `${letter}:\\`;
            })
            .filter((root) => {
                return fsExistSync(root);
            });
    }
    const roots: string[] = [];
    for (const [base, depth] of POSIX_VOLUME_BASES) {
        let dirPaths = [`/${base.join('/')}`];
        for (let level = 0; level < depth; level++) {
            dirPaths = dirPaths.flatMap((dirPath) => {
                return listDirNamesSync(dirPath)
                    .filter((name) => {
                        return !checkIsHiddenName(name);
                    })
                    .map((name) => {
                        return `${dirPath}/${name}`;
                    });
            });
        }
        roots.push(...dirPaths);
    }
    return roots;
}

export function readDataDirMarkerIdSync(dirPath: string) {
    try {
        const markerPath = pathJoin(dirPath, DATA_DIR_MARKER_FILE_NAME);
        if (!fsExistSync(markerPath)) {
            return null;
        }
        const id = JSON.parse(fsReadSync(markerPath))?.id;
        return typeof id === 'string' && id.length > 0 ? id : null;
    } catch (_error) {
        return null;
    }
}

export function ensureDataDirMarkerIdSync(dirPath: string) {
    const existingId = readDataDirMarkerIdSync(dirPath);
    if (existingId !== null) {
        return existingId;
    }
    try {
        const id = crypto.randomUUID();
        fsWriteFileSync(
            pathJoin(dirPath, DATA_DIR_MARKER_FILE_NAME),
            JSON.stringify({
                id,
                app: 'open-worship-app',
                createdAt: new Date().toISOString(),
            }),
        );
        return id;
    } catch (error) {
        handleError(error);
        return null;
    }
}

export function findMovedDataDirSync(
    rememberedDirPath: string,
    markerId: string | null,
) {
    const volumePath = markerId ? splitVolumePath(rememberedDirPath) : null;
    if (volumePath === null) {
        return null;
    }
    for (const volumeRoot of listVolumeRootsSync()) {
        if (volumeRoot === volumePath.volumeRoot) {
            continue;
        }
        const candidate = pathJoin(volumeRoot, ...volumePath.segments);
        if (readDataDirMarkerIdSync(candidate) === markerId) {
            return candidate;
        }
    }
    return null;
}

export function findDataDirsOnVolumesSync(extraDirPaths: string[] = []) {
    const candidates = [...extraDirPaths];
    for (const volumeRoot of listVolumeRootsSync()) {
        candidates.push(volumeRoot);
        for (const name of listDirNamesSync(volumeRoot)) {
            if (!checkIsHiddenName(name)) {
                candidates.push(pathJoin(volumeRoot, name));
            }
        }
    }
    return candidates.filter((dirPath) => {
        return readDataDirMarkerIdSync(dirPath) !== null;
    });
}

export function toPathCompareKey(filePath: string) {
    return appProvider.systemUtils?.isLinux
        ? filePath
        : filePath.toLocaleLowerCase();
}

const webFileExtensions = mimeWebList.flatMap(({ extensions }) => {
    return extensions;
});
let dataDirAlias: DataDirAliasType | null = null;

function getFileDotExtension(fileFullName: string) {
    return fileFullName.substring(fileFullName.lastIndexOf('.'));
}

function getDataDirAlias(filePath: string) {
    const dirPath = getDataDirPath();
    if (
        !dirPath ||
        webFileExtensions.includes(getFileDotExtension(filePath).toLowerCase())
    ) {
        return null;
    }
    if (dataDirAlias?.dirPath !== dirPath) {
        dataDirAlias = genDataDirAlias(
            dirPath,
            pathSeparator,
            appProvider.browserUtils.pathToFileURL,
        );
    }
    return dataDirAlias;
}

export function toRealFileText(filePath: string, text: string) {
    const alias = getDataDirAlias(filePath);
    return alias === null ? text : fromPortableText(text, alias);
}

export function toPortableFileText(filePath: string, text: string) {
    const alias = getDataDirAlias(filePath);
    if (alias === null || !filePath.startsWith(alias.prefix)) {
        return text;
    }
    return toPortableText(text, alias);
}

export function fsMkDirSync(dirPath: string, isRecursive = true) {
    return appProvider.fileUtils.mkdirSync(dirPath, {
        recursive: isRecursive,
    });
}

export function fsWriteFileSync(filePath: string, txt: string, encoding?: any) {
    return appProvider.fileUtils.writeFileSync(
        filePath,
        toPortableFileText(filePath, txt),
        {
            encoding: encoding ?? 'utf8',
            flag: 'w',
        },
    );
}

/**
 * A write another window can never read half of. `fsWriteFileSync` truncates
 * the target and then fills it, so a window reading at that moment gets a
 * prefix of the file (`Unterminated string in JSON`), and the on-screen maps
 * turned that failed read into `{}` and saved it over every other screen.
 * Here the text goes to a hidden sibling first (a dot name, so
 * `appLocalStorage.listKeys` never lists it) and is renamed over the target.
 *
 * Windows refuses the rename (EPERM) while another process holds the target
 * open, which a reader in another window does for the length of its read; it
 * is retried a few times and then written in place — the old behaviour, never
 * worse than it.
 */
export function fsWriteFileAtomicSync(filePath: string, txt: string) {
    const { renameSync } = appProvider.fileUtils;
    if (typeof renameSync !== 'function') {
        return fsWriteFileSync(filePath, txt);
    }
    const dirPath = appProvider.pathUtils.dirname(filePath);
    const tempPath = pathJoin(
        dirPath,
        `.${appProvider.pathUtils.basename(filePath)}.` +
            `${Math.random().toString(36).slice(2)}.tmp`,
    );
    // Converted for the TARGET's path: the portable-alias rule reads the
    // extension, and the temporary name's `.tmp` is not the file's own.
    appProvider.fileUtils.writeFileSync(
        tempPath,
        toPortableFileText(filePath, txt),
        { encoding: 'utf8', flag: 'w' },
    );
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            renameSync(tempPath, filePath);
            return;
        } catch (_error) {
            // Retried: see the EPERM note above.
        }
    }
    try {
        fsWriteFileSync(filePath, txt);
    } finally {
        try {
            fsUnlinkSync(tempPath);
        } catch (_error) {
            // Already gone or still held; a hidden name is never read back.
        }
    }
}

export function fsExistSync(filePath: string) {
    return appProvider.fileUtils.existsSync(filePath);
}

export function fsUnlinkSync(filePath: string) {
    return appProvider.fileUtils.unlinkSync(filePath);
}

export function fsReadSync(filePath: string) {
    return toRealFileText(
        filePath,
        appProvider.fileUtils.readFileSync(filePath, 'utf8'),
    );
}

export function getUserWritablePath(): string {
    return appProvider.messageUtils.sendDataSync('main:app:get-data-path');
}
