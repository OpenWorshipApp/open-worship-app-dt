import { type Dirent, type Stats } from 'node:fs';

import appProvider from './appProvider';
import FileSource from '../helper/FileSource';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';

import mimeBibleList from './mime/bible-types.json';
import mimeNoteList from './mime/note-types.json';
import mimeLyricList from './mime/lyric-types.json';
import mimeMarkdownList from './mime/markdown-types.json';
import mimeAppDocumentList from './mime/app-document-types.json';
import mimeImageList from './mime/image-types.json';
import mimePresentingFlowList from './mime/presenting-flow-types.json';
import mimeVideoList from './mime/video-types.json';
import mimeAudioList from './mime/audio-types.json';
import mimeWebList from './mime/web-types.json';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { cloneJson, freezeObject } from '../helper/helpers';
import { electronSendAsync } from './appHelpers';
import { tran } from '../lang/langHelpers';
import {
    DATA_DIR_PATH_ALIAS,
    type DataDirAliasType,
    fromPortableText,
    genDataDirAlias,
    toPortableText,
} from './dataDirAliasHelpers';

for (const ml of [
    mimeBibleList,
    mimeLyricList,
    mimeMarkdownList,
    mimeAppDocumentList,
    mimeImageList,
    mimePresentingFlowList,
    mimeVideoList,
    mimeAudioList,
    mimeWebList,
]) {
    freezeObject(ml);
}

export const mimetypePdf: AppMimetypeType = {
    type: 'PDF File',
    title: 'PDF File',
    mimetypeSignatures: ['application/pdf'],
    mimetypeName: 'other',
    extensions: ['.pdf'],
};

export const mimetypePptx: AppMimetypeType = {
    type: 'PPTX File',
    title: 'PPTX File',
    mimetypeSignatures: [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    mimetypeName: 'other',
    extensions: ['.pptx'],
};

export const mimetypeDocx: AppMimetypeType = {
    type: 'DOCX File',
    title: 'DOCX File',
    mimetypeSignatures: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    mimetypeName: 'other',
    extensions: ['.docx'],
};

const appMimeTypesMapper = {
    bible: mimeBibleList,
    lyric: mimeLyricList,
    appDocument: mimeAppDocumentList,
};
const _mimeTypes = Object.values(appMimeTypesMapper) as AppMimetypeType[][];
const appExtensions = _mimeTypes.reduce((acc: string[], cur) => {
    const exts = cur
        .map((mimeType) => {
            return mimeType.extensions;
        })
        .reduce((acc1, cur1) => {
            return acc1.concat(cur1);
        }, []);
    return acc.concat(exts);
}, []);

const mimeTypesMapper = {
    bible: mimeBibleList,
    note: mimeNoteList,
    lyric: mimeLyricList,
    lyricAppDocument: mimeLyricList,
    markdown: mimeMarkdownList,
    appDocument: mimeAppDocumentList,
    pdf: [mimetypePdf],
    pptx: [mimetypePptx],
    docx: [mimetypeDocx],
    image: mimeImageList,
    presentingFlow: mimePresentingFlowList,
    video: mimeVideoList,
    web: mimeWebList,
    audio: mimeAudioList,
};

export type AppMimetypeType = {
    type: string;
    title: string;
    mimetypeSignatures: string[];
    mimetypeName: MimetypeNameType;
    extensions: string[];
};

export type FileMetadataType = {
    fileFullName: string;
    appMimetype: AppMimetypeType;
};

export function checkIsAppFile(fileFullName: string) {
    const dotExtension = getFileDotExtension(fileFullName);
    const isAppFile = appExtensions.includes(dotExtension);
    return isAppFile;
}

export const pathSeparator = appProvider.pathUtils.sep;
export function pathJoin(...paths: string[]): string {
    return appProvider.pathUtils.join(...paths);
}

export function pathResolve(...paths: string[]): string {
    const path = appProvider.pathUtils.resolve(...paths);
    if (path.endsWith(pathSeparator)) {
        return path.slice(0, -1);
    }
    return path;
}

export function pathBasename(filePath: string) {
    return appProvider.pathUtils.basename(filePath);
}

export function pathDirname(filePath: string) {
    return appProvider.pathUtils.dirname(filePath);
}

// --- Names and paths every computer a data folder visits accepts ----------
// Windows, macOS and Linux, and the exFAT/FAT flash drive carried between
// them. A name is judged by the STRICTEST of those file systems, not by the one
// the app runs on: `Service 10:30` is legal on a Mac's own disk, and the file
// it makes can then be neither copied to the stick nor opened on the church's
// Windows laptop. Everything here is pure, so both OS families are tested from
// either one.

// Refused by Windows, and by exFAT/FAT on every OS.
// eslint-disable-next-line no-control-regex
const UNSAFE_NAME_CHARACTER_REGEX = /[<>:"/\\|?*\u0000-\u001f]/;
// eslint-disable-next-line no-control-regex
const UNSAFE_NAME_CHARACTERS_REGEX = /[<>:"/\\|?*\u0000-\u001f]/g;
// Reserved by Windows whatever follows the first dot: `nul.txt` cannot be
// created there either, nor opened once another OS has made it.
const RESERVED_NAME_REGEX = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\.|$)/i;

/**
 * Long enough for any song title, and short enough that the app's own side
 * files (`<name>.ows.bg.json`, `<name>.ows.histories`) stay well inside the
 * 255-character limit every one of those file systems has.
 */
export const PORTABLE_NAME_MAX_LENGTH = 120;

export type PortableFileNameProblemType =
    | 'empty'
    | 'characters'
    | 'leading-dot'
    | 'trailing-dot-or-space'
    | 'reserved'
    | 'too-long';

/**
 * Why this name cannot be a file on every computer, or null when it can. For
 * a name a PERSON typed: refused with the reason, never quietly rewritten,
 * because a file that turns up under another name is lost to whoever looks
 * for it by the one they typed.
 */
export function getPortableFileNameProblem(
    name: string,
): PortableFileNameProblemType | null {
    if (name.trim() === '') {
        return 'empty';
    }
    if (UNSAFE_NAME_CHARACTER_REGEX.test(name)) {
        return 'characters';
    }
    // Hidden on macOS and Linux, and left out of every whole-data backup.
    if (name.trimStart().startsWith('.')) {
        return 'leading-dot';
    }
    // Windows drops a trailing dot or space from a name, so the file it makes
    // is not the one asked for, and one made elsewhere cannot be opened there.
    if (/[. ]$/.test(name)) {
        return 'trailing-dot-or-space';
    }
    if (RESERVED_NAME_REGEX.test(name.trim())) {
        return 'reserved';
    }
    if (Array.from(name).length > PORTABLE_NAME_MAX_LENGTH) {
        return 'too-long';
    }
    return null;
}

/** What to tell a person whose name `getPortableFileNameProblem` refused. */
export function describePortableFileNameProblem(
    problem: PortableFileNameProblemType,
) {
    if (problem === 'empty') {
        return tran('Please type a name.');
    }
    if (problem === 'characters') {
        return (
            tran(
                'A name cannot contain these characters, which some computers refuse:',
            ) + ' \\ / : * ? " < > |'
        );
    }
    if (problem === 'leading-dot') {
        return tran('A name cannot start with a dot.');
    }
    if (problem === 'trailing-dot-or-space') {
        return tran('A name cannot end with a dot or a space.');
    }
    if (problem === 'reserved') {
        return tran(
            'This name is reserved by Windows. Please choose another one.',
        );
    }
    return tran('This name is too long. Please use a shorter one.');
}

/**
 * The nearest name every computer accepts, for text nobody typed as a file
 * name -- a song title from a catalogue, a web page's title, a URL's last
 * part. The words are kept as they read, so the row still looks like the
 * title; `fallbackName` stands in when nothing usable is left.
 */
export function toPortableFileName(name: string, fallbackName: string) {
    let sanitized = name
        .replace(UNSAFE_NAME_CHARACTERS_REGEX, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[. ]+/, '')
        .replace(/[. ]+$/, '');
    // By code point, so a cut never splits an emoji's surrogate pair.
    sanitized = Array.from(sanitized)
        .slice(0, PORTABLE_NAME_MAX_LENGTH)
        .join('')
        .replace(/[. ]+$/, '');
    if (RESERVED_NAME_REGEX.test(sanitized)) {
        const dotIndex = sanitized.indexOf('.');
        sanitized =
            dotIndex === -1
                ? `${sanitized}_`
                : `${sanitized.slice(0, dotIndex)}_${sanitized.slice(dotIndex)}`;
    }
    return sanitized || fallbackName;
}

/**
 * The last name in a path written on ANY operating system. `pathBasename`
 * only knows the running one: on macOS it reads all of
 * `C:\Users\x\data\Song.ows` as a single name, which a bundle imported from a
 * Windows machine then used as the new file's name.
 */
export function toBaseNameOfAnyOs(filePath: string) {
    const parts = filePath.split(/[\\/]/).filter((part) => {
        return part.length > 0;
    });
    return parts.at(-1) ?? '';
}

/**
 * The file a download URL names, as a name every computer accepts: the query
 * string and fragment are not part of it (`…/song.ows?dl=1` is `song.ows`,
 * where the whole address once gave `song.ows?dl=1`, refused by Windows and
 * never listed as a document), and `%20` reads as a space.
 */
export function toFileFullNameFromUrl(url: string, fallbackName: string) {
    try {
        const lastPart = decodeURIComponent(
            toBaseNameOfAnyOs(new URL(url).pathname),
        );
        return toPortableFileFullName(lastPart, fallbackName);
    } catch (_error) {
        return fallbackName;
    }
}

/**
 * `toPortableFileName` for a name WITH its extension: the two are cleaned
 * apart, so a cut to length never eats the extension and a Linux-made
 * `What?.owl` becomes `What.owl` rather than `What .owl`.
 */
export function toPortableFileFullName(
    fileFullName: string,
    fallbackName: string,
) {
    const dotIndex = fileFullName.lastIndexOf('.');
    if (dotIndex <= 0) {
        return toPortableFileName(fileFullName, fallbackName);
    }
    const dotExtension = fileFullName
        .slice(dotIndex)
        .replace(UNSAFE_NAME_CHARACTERS_REGEX, '');
    return (
        toPortableFileName(fileFullName.slice(0, dotIndex), fallbackName) +
        dotExtension
    );
}

/**
 * Where a file inside one data folder sits in another -- the folder a bundle
 * was exported from and the one it is imported into, possibly on different
 * operating systems. Null when the file is not inside `fromDirPath` (a
 * sibling that merely starts with the same letters, `data-dev` beside `data`,
 * is not inside it).
 */
export function rebaseDataDirPath(
    filePath: string,
    fromDirPath: string,
    toDirPath: string,
    sep = pathSeparator,
) {
    const fromDir = fromDirPath.replace(/[\\/]+$/, '');
    if (!fromDir || !filePath.startsWith(fromDir)) {
        return null;
    }
    const rest = filePath.slice(fromDir.length);
    if (!/^[\\/]/.test(rest)) {
        return null;
    }
    const parts = rest.split(/[\\/]/).filter((part) => {
        return part.length > 0;
    });
    if (parts.length === 0) {
        return null;
    }
    return [toDirPath.replace(/[\\/]+$/, ''), ...parts].join(sep);
}

/**
 * The data folder text is aliased against (`$DATA_DIR_PATH`), or null before
 * one is known. `?.`: the test doubles of `appProvider` carry no
 * `sessionData`.
 */
export function getDataDirPath(): string | null {
    return appProvider.sessionData?.defaultStorageDirPath ?? null;
}

// --- Repairing links to where the data folder used to be ------------------
// `$DATA_DIR_PATH` is written lazily, and only for the folder's CURRENT
// location: a file saved before it existed, or while the folder lived
// somewhere else, still names a path on another computer, and points at
// nothing on this one.

export type DataDirLinkType = {
    // Where the link starts in the text, and how much of it names the old
    // folder (everything before one of the data folder's own top-level
    // folders -- the part replaced by the alias).
    index: number;
    prefixLength: number;
    // The link as a path, to prove it really is gone before touching it.
    linkPath: string;
    // From the data folder's top-level folder on: where it lives now.
    segments: string[];
    isUrl: boolean;
    // The separator as written: `\`, a JSON-escaped `\\` … or `/`.
    separator: string;
};

function escapeRegExpText(text: string) {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every absolute path or `file://` URL in `text` that runs through one of
 * `childNames` (the data folder's own top-level folders: `images`,
 * `documents` …), however it is escaped. A candidate, not a verdict: the
 * caller checks it points at nothing and that the same names exist here.
 */
export function findDataDirLinks(text: string, childNames: string[]) {
    if (childNames.length === 0) {
        return [];
    }
    const name = String.raw`[^\\/:*?"<>|\r\n\t]+`;
    const children = childNames.map(escapeRegExpText).join('|');
    // Only after a quote, a bracket, a space or a line start: a `/` inside
    // `https://host/images/a.png` is not a path on this disk.
    // A link may end AT one of those folders (a folder setting, `basePath`)
    // or run on past it; either way the folder's name must be whole, so an
    // `images2` is never taken for `images`.
    const linkRegex = new RegExp(
        String.raw`(?<=["'(\s]|^)(file:\/\/\/?)?([A-Za-z]:)?(\\{8}|\\{4}|\\{2}|\\|\/)((?:${name}\3)*?)(${children})(?:\3((?:${name}\3)*${name}))?(?![^\\/:*?"<>|\r\n\t])`,
        'gm',
    );
    const links: DataDirLinkType[] = [];
    for (const match of text.matchAll(linkRegex)) {
        const [whole, url, drive, separator, middle, child, matchedRest] =
            match;
        const isUrl = url !== undefined;
        // A URL ends at the first character a URL would have encoded.
        const rest =
            isUrl && matchedRest !== undefined
                ? matchedRest.split(/[\s)'"]/)[0]
                : (matchedRest ?? '');
        if (isUrl && separator !== '/') {
            continue;
        }
        const tailText = rest === '' ? '' : `${separator}${rest}`;
        const pathText = `${drive ?? ''}${separator}${middle}${child}${tailText}`;
        let segments =
            rest === '' ? [child] : [child, ...rest.split(separator)];
        let linkPath = pathText
            .split(separator)
            .join(separator === '/' ? '/' : '\\');
        if (isUrl) {
            try {
                segments = segments.map(decodeURIComponent);
                linkPath = decodeURIComponent(linkPath);
            } catch (_error) {
                continue;
            }
        }
        const matchedTailLength =
            matchedRest === undefined
                ? 0
                : separator.length + matchedRest.length;
        links.push({
            index: match.index,
            prefixLength: whole.length - child.length - matchedTailLength,
            linkPath,
            segments,
            isUrl,
            separator,
        });
    }
    return links;
}

/**
 * `text` with every link to an old location of the data folder pointed at the
 * current one -- only a link whose own path is GONE and whose file exists
 * here (a folder chosen elsewhere on purpose still exists, and is left
 * alone). Written as `$DATA_DIR_PATH`, in the form and escape level the link
 * had, so it keeps following the folder from now on.
 */
export async function repairDataDirLinksInText(
    text: string,
    dataDirPath: string,
    childNames: string[],
    checkIsThere: (filePath: string) => Promise<boolean>,
) {
    const links = findDataDirLinks(text, childNames);
    let repairedText = text;
    let count = 0;
    // Right to left, so the indices of the earlier links stay valid.
    for (const link of links.reverse()) {
        if (
            (await checkIsThere(link.linkPath)) ||
            !(await checkIsThere(pathJoin(dataDirPath, ...link.segments)))
        ) {
            continue;
        }
        const aliasPrefix = link.isUrl
            ? `file:///${DATA_DIR_PATH_ALIAS}/`
            : `${DATA_DIR_PATH_ALIAS}${link.separator}`;
        repairedText =
            repairedText.slice(0, link.index) +
            aliasPrefix +
            repairedText.slice(link.index + link.prefixLength);
        count += 1;
    }
    return { text: repairedText, count };
}

export const DATA_DIR_RELATIVE_PATH_TOKEN = '@data';

/**
 * A path inside the data folder written relative to it --
 * `@data/documents/song.ows` -- the same on every computer the folder visits;
 * any other path unchanged. For a NAME made from a path (a setting key), which
 * the `$DATA_DIR_PATH` alias cannot reach because it rewrites file contents,
 * not file names.
 */
export function toDataDirRelativePath(filePath: string) {
    const dataDirPath = getDataDirPath();
    if (dataDirPath === null) {
        return filePath;
    }
    return (
        rebaseDataDirPath(
            filePath,
            dataDirPath,
            DATA_DIR_RELATIVE_PATH_TOKEN,
            '/',
        ) ?? filePath
    );
}

/**
 * A path's folder and file name, `''` for the folder of a bare name. On
 * Windows EITHER separator splits -- `E:\data/lyrics/a.owl` is a real Windows
 * path, and splitting it on `\` alone named the file `data/lyrics/a.owl` in
 * `E:\` -- while on macOS and Linux only `/` does, `\` being an ordinary
 * character in a name there.
 */
export function splitFilePath(
    filePath: string,
    isWindows = pathSeparator === '\\',
) {
    const index = isWindows
        ? Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))
        : filePath.lastIndexOf('/');
    return {
        dirPath: index === -1 ? '' : filePath.substring(0, index),
        fileFullName: filePath.substring(index + 1),
    };
}

/**
 * The path a `file://` URL names on this computer. A Windows share keeps its
 * server (`file://server/share/a.png` → `\\server\share\a.png`), which reading
 * the URL's `pathname` alone dropped.
 */
export function toFilePathFromFileUrl(
    src: string,
    isWindows = pathSeparator === '\\',
) {
    const url = new URL(src);
    const filePath = decodeURIComponent(url.pathname);
    if (!isWindows) {
        return filePath;
    }
    if (url.host) {
        return `\\\\${url.host}${filePath.replaceAll('/', '\\')}`;
    }
    return filePath.substring(1).replaceAll('/', '\\');
}

/**
 * A path as its ROOT and the names under it: `C:\a\b` is `C:\` + [a, b],
 * `\\server\share\a` is `\\server\share\` + [a], `/Volumes/USB/a` is `/` +
 * [Volumes, USB, a]. Splitting on the separator alone loses the root -- a
 * macOS or Linux path came back relative (`Volumes/USB/data`), which only
 * resolved when the app happened to be started from `/`.
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

// --- Finding a data folder again ------------------------------------------
// Each computer remembers the data folder as ONE absolute path, and a flash
// drive does not keep its address: Windows hands it `E:` today and `F:`
// tomorrow, a Mac mounts it at `/Volumes/<label>`, Linux under
// `/media/<user>/<label>`. The folder carries a marker with an id, so the same
// folder is recognised wherever it turns up. Dot-named, so no list shows it and
// no whole-data backup copies it (a restored copy is a different folder).
export const DATA_DIR_MARKER_FILE_NAME = '.owa-data-folder.json';

// The folders removable drives are mounted under, and how many names deep the
// mount point is: `/Volumes/<label>`, `/media/<user>/<label>`, …
const POSIX_VOLUME_BASES: [string[], number][] = [
    [['Volumes'], 1],
    [['media'], 2],
    [['run', 'media'], 2],
    [['mnt'], 1],
];

/**
 * A path on a removable drive as the drive's mount point and the names under
 * it: `E:\data\x` is `E:\` + [data, x]; `/Volumes/USB/data` is `/Volumes/USB`
 * + [data]. Null for a path that is not on such a drive -- a folder on the
 * system disk does not move -- or for a drive's own root.
 */
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

/**
 * Every removable-drive mount point this computer has right now. Read only
 * when a data folder has to be FOUND -- its remembered path is gone, or none
 * was ever chosen -- never on an ordinary start.
 */
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

/** The id in a data folder's marker, or null when it has none. */
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

/**
 * The data folder's id, its marker written first when it has none. Null when
 * the folder cannot be written (a locked stick): such a folder is simply not
 * found again, which is no worse than before markers existed.
 */
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

/**
 * The same data folder on another drive: the remembered path's names under
 * the drive, tried under every other mount point, accepted only where the
 * marker's id matches -- a folder that merely has the same name is somebody
 * else's data.
 */
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

/**
 * Data folders on this computer's drives, for a computer that has never had
 * one chosen: the root of every removable drive and the folders directly in
 * it, plus `extraDirPaths` (the default Desktop folder), that carry a marker.
 */
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

/**
 * How two folder or file names are compared the way the running OS's disks
 * compare them: Windows and a default macOS disk ignore case, Linux does not.
 */
export function toPathCompareKey(filePath: string) {
    return appProvider.systemUtils?.isLinux
        ? filePath
        : filePath.toLocaleLowerCase();
}

/** `C:\…`, `C:/…` or a network share `\\server\share\…`. */
export function checkIsWindowsAbsolutePath(filePath: string) {
    return /^[A-Za-z]:[\\/]/.test(filePath) || /^\\\\[^\\]/.test(filePath);
}

/**
 * Whether a stored path was written on the OTHER operating system family:
 * `D:\Songs` read on a Mac, `/Users/me/Songs` read on Windows. Such a path
 * names nothing here, and must be kept exactly as written -- resolving it
 * made `D:\Songs` into `/D:\Songs` on a Mac, which saved back and came home to
 * Windows as `C:\D:\Songs`, the real folder lost for good.
 */
export function checkIsForeignAbsolutePath(
    filePath: string,
    isWindows = pathSeparator === '\\',
) {
    if (isWindows) {
        return filePath.startsWith('/') && !/^[\\/]{2}/.test(filePath);
    }
    return checkIsWindowsAbsolutePath(filePath);
}

/**
 * Whether a stored path is absolute on THIS operating system family. A path
 * written on the other one is not a path here at all: `C:\a` on a Mac is a
 * relative name, and `/Users/a` on Windows is a folder on the current drive,
 * so code that resolves or tests one answers about the wrong file.
 * `isWindows` defaults to the running OS; tests pass it.
 */
export function checkIsNativeAbsolutePath(
    filePath: string,
    isWindows = pathSeparator === '\\',
) {
    if (isWindows) {
        return checkIsWindowsAbsolutePath(filePath);
    }
    return filePath.startsWith('/');
}

export function getFileName(fileFullName: string) {
    return fileFullName.substring(0, fileFullName.lastIndexOf('.'));
}

export function getFileDotExtension(fileFullName: string) {
    return fileFullName.substring(fileFullName.lastIndexOf('.'));
}

export function addExtension(name: string, extension: string) {
    return `${name}${extension}`;
}

export const createNewFileDetail = async (
    dir: string,
    name: string,
    content: string,
    mimetypeName: MimetypeNameType,
) => {
    const extensions = getMimetypeExtensions(mimetypeName);
    if (extensions.length === 0) {
        throw new Error(`No extensions found for mimetype: ${mimetypeName}`);
    }
    // Refused here, at the one place every new document, song, run sheet,
    // Bible list and notes file is made: a name this computer accepts and the
    // next one refuses (`Service 10:30` on a Mac) makes a file that can be
    // neither copied to the stick nor opened on Windows.
    const problem = getPortableFileNameProblem(name);
    if (problem !== null) {
        showSimpleToast(
            tran('Invalid file name'),
            describePortableFileNameProblem(problem),
        );
        return null;
    }
    const fileFullName = `${name}.${extensions[0]}`;
    try {
        const filePath = pathJoin(dir, fileFullName);
        return await fsCreateFile(filePath, content);
    } catch (error: any) {
        showSimpleToast(tran('Creating File'), error.message);
    }
    return null;
};

export const mimetypeNameTypeList = [
    'image',
    'video',
    'appDocument',
    'pptx',
    'pdf',
    'docx',
    'presentingFlow',
    'lyric',
    'lyricAppDocument',
    'markdown',
    'bible',
    'note',
    'audio',
    'web',
    'other',
] as const;
export type MimetypeNameType = (typeof mimetypeNameTypeList)[number];

/**
 * A name the app does not look at: anything dot-prefixed. Mostly the `._*`
 * AppleDouble stubs a macOS machine or a USB round-trip leaves in a folder,
 * plus whatever the OS hides there. Written once because every list that has
 * ever needed it — directory listings, the XML bibles, the bible download
 * cache, the data archive — has to agree, or a file skipped by one shows up
 * through another.
 */
export function checkIsHiddenName(fileFullName: string) {
    return fileFullName.startsWith('.');
}

// Written by the OS into any folder it shows, including a flash drive's: the
// thumbnail cache, the folder-view settings and a custom-icon file.
const SYSTEM_FILE_NAME_SET = new Set(['thumbs.db', 'desktop.ini', 'icon\r']);

/**
 * A file the operating system keeps beside the user's own -- never one of
 * theirs, so never offered in a list of them. Not dot-prefixed, so
 * `checkIsHiddenName` does not catch it.
 */
export function checkIsSystemFileName(fileFullName: string) {
    return SYSTEM_FILE_NAME_SET.has(fileFullName.toLowerCase());
}

export function getFileMetaData(
    fileFullName: string,
    mimetypeList?: AppMimetypeType[],
): FileMetadataType | null {
    mimetypeList = mimetypeList ?? getAllAppMimetype();
    const dotExtension = getFileDotExtension(fileFullName);
    const foundMimetype = mimetypeList.find((mimetype) => {
        const lowerExtensions = mimetype.extensions.map((ext) => {
            return ext.toLowerCase();
        });
        return lowerExtensions.includes(dotExtension.toLowerCase());
    });
    if (foundMimetype) {
        return { fileFullName: fileFullName, appMimetype: foundMimetype };
    }
    return null;
}

export function getAllAppMimetype() {
    return mimetypeNameTypeList
        .map((mimetypeName) => {
            return getAppMimetype(mimetypeName);
        })
        .reduce((acc, cur) => {
            return acc.concat(cur);
        }, []);
}

export function getAppMimetype(mimetypeName: MimetypeNameType) {
    if (mimetypeName === 'other') {
        return [];
    }
    const json = cloneJson(mimeTypesMapper[mimetypeName]);
    for (const data of json as any[]) {
        data.mimetypeName = mimetypeName;
    }
    return json as AppMimetypeType[];
}

export function getMimetypeExtensions(mimetypeName: MimetypeNameType) {
    const mimetypeList = getAppMimetype(mimetypeName);
    return mimetypeList
        .reduce((r: string[], mimetype) => {
            r.push(...mimetype.extensions);
            return r;
        }, [])
        .map((ext) => {
            return ext.replace('.', '');
        });
}

export function isSupportedMimetype(
    fileMimetype: string,
    mimetypeName: MimetypeNameType,
) {
    const mimetypeList = getAppMimetype(mimetypeName);
    return mimetypeList.some((newMimetype) => {
        return newMimetype.mimetypeSignatures.includes(fileMimetype);
    });
}

export function isSupportedExt(
    fileFullName: string,
    mimetypeName: MimetypeNameType,
) {
    const mimetypeList = getAppMimetype(mimetypeName);
    const dotExtension = getFileDotExtension(fileFullName);
    return mimetypeList
        .map((newMimetype) => {
            return newMimetype.extensions;
        })
        .some((extensions) => {
            return extensions.includes(dotExtension);
        });
}

export function fsCreateWriteStream(filePath: string) {
    return appProvider.fileUtils.createWriteStream(filePath);
}

export function fsCreateReadStream(filePath: string) {
    return appProvider.fileUtils.createReadStream(filePath);
}

export type FileResultType = {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    filePath: string;
};

function fsFilePromise<T>(
    fn: (...args: any) => void,
    ...args: any
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        args = args ?? [];
        args.push(function (error: any, ...args1: any) {
            if (error) {
                reject(error as Error);
            } else {
                args1 = args1 ?? [];
                (resolve as any)(...args1);
            }
        });
        fn(...args);
    });
}

function _fsStat(filePath: string) {
    return fsFilePromise<Stats>(appProvider.fileUtils.stat, filePath);
}

function _fsMkdir(dirPath: string, isRecursive: boolean) {
    return fsFilePromise<void>(appProvider.fileUtils.mkdir, dirPath, {
        recursive: isRecursive,
    });
}

function _fsRmdir(dirPath: string) {
    return fsFilePromise<void>(appProvider.fileUtils.rmdir, dirPath, {
        recursive: true,
    });
}

function _fsReaddir(dirPath: string) {
    return fsFilePromise<string[]>(appProvider.fileUtils.readdir, dirPath);
}

// A data folder carried between computers keeps no absolute path of its own in
// any file: text written inside it stores the folder as `$DATA_DIR_PATH`, and
// every text read expands it (see `dataDirAliasHelpers`). Web files are loaded
// by an <iframe> straight from disk, where nothing would expand it, so they
// keep real paths.
const webFileExtensions = mimeWebList.flatMap(({ extensions }) => {
    return extensions;
});
// One entry, rebuilt only when the data folder changes.
let dataDirAlias: DataDirAliasType | null = null;
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
function toRealFileText(filePath: string, text: string) {
    const alias = getDataDirAlias(filePath);
    return alias === null ? text : fromPortableText(text, alias);
}
function toPortableFileText(filePath: string, text: string) {
    const alias = getDataDirAlias(filePath);
    // Only what is written INSIDE the data folder: an export, a temp file or
    // a download stays readable by whatever opens it. Reads resolve the alias
    // anywhere, so a file copied off the drive still works.
    if (alias === null || !filePath.startsWith(alias.prefix)) {
        return text;
    }
    return toPortableText(text, alias);
}

// const rwState: { [key: string]: { r: number; w: number } } = {};
// for debugging read/write operation count, not used for logic
// (globalThis as any).rwState = rwState;
async function _fsReadFile(filePath: string, options?: any) {
    // rwState[filePath] = rwState[filePath] ?? { r: 0, w: 0 };
    // rwState[filePath].r++;
    // console.log('read-file', filePath);
    const text = await fsFilePromise<string>(
        appProvider.fileUtils.readFile,
        filePath,
        options,
    );
    return toRealFileText(filePath, text);
}
function _fsWriteFile(filePath: string, data: string | Buffer, options?: any) {
    // rwState[filePath] = rwState[filePath] ?? { r: 0, w: 0 };
    // rwState[filePath].w++;
    return fsFilePromise<void>(
        appProvider.fileUtils.writeFile,
        filePath,
        typeof data === 'string' ? toPortableFileText(filePath, data) : data,
        options,
    );
}

// `rename` cannot cross a volume boundary — it fails with EXDEV. Media
// downloads stage into the OS temp dir (`C:\...\Temp`) while the data dir often
// lives on another drive (`D:\open-worship-data`), so those moves need a copy
// followed by deleting the source. Only reached on EXDEV: a same-volume move
// stays a cheap metadata-only rename with no bytes read or written.
async function _fsMoveAcrossDevices(
    oldFullPath: string,
    newFullPath: string,
    isDirectory: boolean,
) {
    if (!isDirectory) {
        try {
            // `copyFile` streams inside libuv — the file never lands in the
            // renderer's memory, which matters for a ~100MB video.
            await fsFilePromise<void>(
                appProvider.fileUtils.copyFile,
                oldFullPath,
                newFullPath,
            );
        } catch (error) {
            // A half-written destination is worse than none: everything
            // downstream would read it as a finished file.
            try {
                await _fsUnlink(newFullPath);
            } catch (_error) {}
            throw error;
        }
        await _fsUnlink(oldFullPath);
        return;
    }
    await _fsMkdir(newFullPath, true);
    // One entry at a time: copying a whole directory in parallel would hold N
    // file handles and N disk queues open at once on a weak machine.
    for (const entry of await fsList(oldFullPath)) {
        await _fsMoveAcrossDevices(
            entry.filePath,
            pathJoin(newFullPath, entry.name),
            entry.isDirectory,
        );
    }
    await _fsRmdir(oldFullPath);
}

export async function fsMove(oldFullPath: string, newFullPath: string) {
    try {
        await fsFilePromise<void>(
            appProvider.fileUtils.rename,
            oldFullPath,
            newFullPath,
        );
    } catch (error: any) {
        if (error?.code !== 'EXDEV') {
            throw error;
        }
        await _fsMoveAcrossDevices(
            oldFullPath,
            newFullPath,
            await fsCheckDirExist(oldFullPath),
        );
    }
}

function _fsUnlink(filePath: string) {
    return fsFilePromise<void>(appProvider.fileUtils.unlink, filePath);
}

export function fsCloneFile(file: File | Blob | string, dest: string) {
    if (file instanceof File) {
        return new Promise<void>((resolve, reject) => {
            const writeStream = fsCreateWriteStream(dest);
            // Settle exactly once: a disk error (e.g. disk full) must reject
            // instead of leaving the promise pending forever.
            let isSettled = false;
            const fail = (error: Error) => {
                if (isSettled) {
                    return;
                }
                isSettled = true;
                writeStream.destroy();
                reject(error);
            };
            writeStream.on('error', fail);
            writeStream.once('close', () => {
                if (isSettled) {
                    return;
                }
                isSettled = true;
                resolve();
            });
            const writableStream = new WritableStream({
                write(chunk) {
                    // Honor backpressure: on a slow disk the source must
                    // wait, or the whole file buffers in memory.
                    if (writeStream.write(chunk)) {
                        return;
                    }
                    return new Promise<void>((resolveDrain) => {
                        writeStream.once('drain', resolveDrain);
                    });
                },
                close() {
                    writeStream.end();
                },
                abort() {
                    writeStream.destroy();
                },
            });
            file.stream().pipeTo(writableStream).catch(fail);
        });
    }
    return fsFilePromise<void>(appProvider.fileUtils.copyFile, file, dest);
}

async function _fsCheckExist(
    isFile: boolean,
    filePath: string,
    fileFullName?: string,
) {
    if (!filePath) {
        return false;
    }
    if (fileFullName) {
        filePath = pathJoin(filePath, fileFullName);
    }
    try {
        const stat = await _fsStat(filePath);
        if (isFile) {
            return stat.isFile();
        } else {
            return stat.isDirectory();
        }
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return false;
        } else {
            handleError(error);
            throw new Error('Error during checking file exist', {
                cause: error,
            });
        }
    }
}

export function fsCheckDirExist(dirPath: string) {
    return _fsCheckExist(false, dirPath);
}

export function fsCheckFileExist(filePath: string, fileFullName?: string) {
    return _fsCheckExist(true, filePath, fileFullName);
}

export async function fsGetFileSize(filePath: string) {
    const stat = await _fsStat(filePath);
    if (!stat.isFile()) {
        throw new Error('Path is not a file');
    }
    return stat.size;
}

export async function fsList(dir: string) {
    if (!dir) {
        return [];
    }
    const foundFileList = await _fsReaddir(dir);
    const fileList = [];
    for (const file of foundFileList) {
        const filePath = pathJoin(dir, file);
        try {
            const fileStat = await _fsStat(filePath);
            fileList.push({
                isFile: fileStat.isFile(),
                isDirectory: fileStat.isDirectory(),
                name: file,
                filePath,
            });
        } catch (_error) {}
    }
    return fileList;
}

export type DirentResultType = {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
};

/**
 * The entries of one directory, WITHOUT a `stat` per entry.
 *
 * `fsList` costs one `readdir` plus one `stat` for every entry it returns;
 * `readdir(…, { withFileTypes: true })` answers the same is-it-a-file question
 * from the single directory read the kernel already did. On a weak disk that is
 * the difference between one syscall and one-plus-N for a folder the user only
 * wants NAMES from -- which is what a recursive name-match search wants.
 *
 * Two ways this deliberately differs from `fsList`, because a `Dirent` does not
 * follow links the way `stat` does:
 * - A SYMLINK is neither `isFile` nor `isDirectory` here. Callers that must
 *   resolve links want `fsList`.
 * - Nothing is skipped or sorted. Hidden names are the caller's to filter
 *   (`checkIsHiddenName`).
 *
 * Rejects rather than swallowing: a caller walking a tree has to tell "this
 * folder is unreadable" (EACCES) from "this folder is gone" (ENOENT) to say
 * anything useful, and `fsList`'s per-entry `catch` cannot.
 */
export async function fsListDirents(
    dirPath: string,
): Promise<DirentResultType[]> {
    if (!dirPath) {
        return [];
    }
    const direntList = await fsFilePromise<Dirent[]>(
        appProvider.fileUtils.readdir,
        dirPath,
        { withFileTypes: true },
    );
    return direntList.map((dirent) => {
        return {
            name: dirent.name,
            isFile: dirent.isFile(),
            isDirectory: dirent.isDirectory(),
        };
    });
}

/**
 * The files in a folder, hidden ones left out. A data folder on a flash drive
 * used on a Mac collects `._<name>` AppleDouble stubs beside real files, and
 * every caller here read one as the real thing: an editing history found two
 * `…-head` files and gave up (undo, redo and the unsaved `*` all stopped), and a
 * PDF's page images never matched its page count, so it re-rendered on every
 * open. Nothing in the app keeps a dot-file of its own in a listed folder.
 */
export async function fsListFiles(dirPath: string) {
    const foundFileList = await fsList(dirPath);
    return foundFileList
        .filter(({ isFile, name }) => {
            return isFile && !checkIsHiddenName(name);
        })
        .map(({ name }) => {
            return name;
        });
}

export async function fsListDirectories(dirPath: string) {
    const foundFileList = await fsList(dirPath);
    return foundFileList
        .filter(({ name, isDirectory }) => {
            if (checkIsHiddenName(name)) {
                return false;
            }
            return isDirectory;
        })
        .map(({ name }) => {
            return name;
        });
}

export async function fsListFilesWithMimetype(
    dir: string,
    mimetypeName: MimetypeNameType,
) {
    if (!dir) {
        return [];
    }
    try {
        const mimetypeList = getAppMimetype(mimetypeName);
        const files = await fsListFiles(dir);
        const matchedFiles = files
            .map((fileFullName) => {
                return getFileMetaData(fileFullName, mimetypeList);
            })
            .filter((d) => {
                return !!d;
            });
        return matchedFiles.map((fileMetadata) => {
            return FileSource.getInstance(dir, fileMetadata.fileFullName)
                .filePath;
        });
    } catch (error) {
        handleError(error);
        showSimpleToast(
            tran('Getting File List'),
            tran('Error occurred during listing file'),
        );
    }
    return null;
}

export function fsCreateDir(dirPath: string, isRecursive = true) {
    return _fsMkdir(dirPath, isRecursive);
}

export function fsMkDirSync(dirPath: string, isRecursive = true) {
    return appProvider.fileUtils.mkdirSync(dirPath, {
        recursive: isRecursive,
    });
}

export async function fsWriteFile(
    filePath: string,
    data: string | Buffer,
    encoding?: string,
) {
    await _fsWriteFile(filePath, data, {
        encoding: encoding ?? 'utf8',
        flag: 'w',
    });
    return filePath;
}

export function fsWriteFileSync(filePath: string, txt: string, encoding?: any) {
    // Settings go through here, and they hold most of the data folder's paths.
    return appProvider.fileUtils.writeFileSync(
        filePath,
        toPortableFileText(filePath, txt),
        {
            encoding: encoding ?? 'utf8',
            flag: 'w',
        },
    );
}

export async function fsCreateFile(
    filePath: string,
    txt: string,
    isOverride?: boolean,
) {
    if (await fsCheckFileExist(filePath)) {
        if (isOverride) {
            await fsDeleteFile(filePath);
        } else {
            throw new Error('File exist');
        }
    }
    await _fsWriteFile(filePath, txt);
    return filePath;
}

export function fsExistSync(filePath: string) {
    return appProvider.fileUtils.existsSync(filePath);
}

export async function fsRenameFile(
    basePath: string,
    oldFileName: string,
    newFileName: string,
) {
    const oldFilePath = pathJoin(basePath, oldFileName);
    const newFilePath = pathJoin(basePath, newFileName);
    if (!(await fsCheckFileExist(oldFilePath))) {
        throw new Error('File not exist');
    } else if (await fsCheckFileExist(newFilePath)) {
        throw new Error('File exist');
    }
    return fsMove(oldFilePath, newFilePath);
}

export async function fsDeleteFile(filePath: string) {
    if (await fsCheckDirExist(filePath)) {
        throw new Error(`${filePath} is not a file`);
    }
    if (await fsCheckFileExist(filePath)) {
        await _fsUnlink(filePath);
    }
}

export function fsUnlinkSync(filePath: string) {
    return appProvider.fileUtils.unlinkSync(filePath);
}

export async function fsDeleteDir(dirPath: string) {
    if (await fsCheckFileExist(dirPath)) {
        throw new Error(`${dirPath} is not a directory`);
    }
    if (await fsCheckDirExist(dirPath)) {
        await _fsRmdir(dirPath);
    }
}

export async function fsReadFile(filePath: string) {
    let text = await _fsReadFile(filePath, 'utf8');
    // remove `\uFEFF`
    text = text.replace(/^\uFEFF/, '');
    return text;
}

export function fsReadSync(filePath: string) {
    return toRealFileText(
        filePath,
        appProvider.fileUtils.readFileSync(filePath, 'utf8'),
    );
}

// The bytes of a file as base64 -- a saved picture on its way back to the
// clipboard, which takes a data URL and never a path.
export function fsReadFileBase64Sync(filePath: string) {
    return appProvider.fileUtils.readFileSync(filePath, 'base64');
}

// The raw bytes of a file that is not text -- a picture going into an exported
// package. Deliberately not through `_fsReadFile`, whose portable-path
// rewriting is for text.
export function fsReadFileBytes(filePath: string) {
    return fsFilePromise<Uint8Array>(appProvider.fileUtils.readFile, filePath);
}

export async function fsCopyFilePathToPath(
    file: File | Blob | string,
    destinationPath: string,
    fileFullName?: string,
) {
    let distFileFullName = fileFullName;
    if (!distFileFullName) {
        if (file instanceof File) {
            distFileFullName = getFileFullName(file);
        }
        if (distFileFullName === undefined && typeof file === 'string') {
            distFileFullName = FileSource.getInstance(file).fullName;
        }
    }
    const progressKey = 'Copying File:' + distFileFullName;
    showProgressBar(progressKey);
    try {
        if (!distFileFullName) {
            throw new Error('Cannot get file name');
        }
        const targetFilePath = pathJoin(destinationPath, distFileFullName);
        const targetFileSource = FileSource.getInstance(targetFilePath);
        const nextFilePath = await targetFileSource.genNextFilePath();
        await fsCloneFile(file, nextFilePath);
        return nextFilePath;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            progressKey,
            tran('Error occurred during copying file') + ': ' + error.message,
        );
        return null;
    } finally {
        hideProgressBar(progressKey);
    }
}

export function getFileFullName(file: File | string): string | undefined {
    if (file instanceof File) {
        return file.name;
    }
    const fileFullName = pathBasename(file);
    return fileFullName;
}

export async function selectDirs() {
    showProgressBar('Selecting Directory');
    const dirs = await electronSendAsync<string[]>('main:app:select-dirs');
    hideProgressBar('Selecting Directory');
    return dirs;
}
export async function selectFiles(
    filters: {
        name: string;
        extensions: string[];
    }[],
) {
    showProgressBar('Selecting File');
    const filePaths = await electronSendAsync<string[]>(
        'main:app:select-files',
        { filters },
    );
    hideProgressBar('Selecting File');
    return filePaths;
}

export function getUserWritablePath(): string {
    return appProvider.messageUtils.sendDataSync('main:app:get-data-path');
}

export function getDesktopPath(): string {
    return appProvider.messageUtils.sendDataSync(
        'main:app:get-special-path',
        'desktop',
    );
}
export function getDownloadPath(): string {
    return appProvider.messageUtils.sendDataSync(
        'main:app:get-special-path',
        'downloads',
    );
}
export function getTempPath(): string {
    return appProvider.messageUtils.sendDataSync(
        'main:app:get-special-path',
        'temp',
    );
}

export function writeFileFromBase64Sync(filePath: string, base64: string) {
    return appProvider.fileUtils.writeFileFromBase64Sync(filePath, base64);
}

export function getDotExtensionFromBase64Data(base64Data: string) {
    const mimeRegex = /^data:([a-zA-Z0-9+]+\/[a-zA-Z0-9+]+);base64,/;
    const mimeMatch = mimeRegex.exec(base64Data);
    if (mimeMatch) {
        const mimeType = mimeMatch[1].toLowerCase();
        const allMimeTypes = Object.values(mimeTypesMapper).flat();
        const foundMime = allMimeTypes.find((mt) => {
            return mt.mimetypeSignatures.includes(mimeType);
        });
        if (foundMime) {
            return foundMime.extensions[0];
        }
    }
    return null;
}

export async function ensureDirectory(dirPath: string) {
    if (await fsCheckFileExist(dirPath)) {
        throw new Error(
            `Cannot ensure directory "${dirPath}", ` +
                'a file already exists at that path',
        );
    }
    if (!(await fsCheckDirExist(dirPath))) {
        fsMkDirSync(dirPath, true);
    }
}

export function getFileChecksum(filePath: string, algorithm: string) {
    return new Promise<string | null>((resolve) => {
        const hash = appProvider.cryptoUtils.createHash(algorithm);
        const stream = appProvider.fileUtils.createReadStream(filePath);
        stream.on('error', (err) => {
            handleError(err);
            resolve(null);
        });
        stream.on('data', (chunk) => {
            hash.update(chunk);
        });
        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });
    });
}

export function getFileMD5(filePath: string) {
    return getFileChecksum(filePath, 'md5');
}

export const KEY_SEPARATOR = '<id>';

export function getFileBase64(src: string) {
    return new Promise<string>((resolve, reject) => {
        fetch(src)
            .then((response) => response.blob())
            .then((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result as string);
                };
                reader.onerror = (error: any) => {
                    reject(new Error('Error reading blob as base64: ' + error));
                };
                reader.readAsDataURL(blob);
            })
            .catch((error) => {
                reject(error);
            });
    });
}
