import {
    fsCheckFileExist,
    pathBasename,
    pathJoin,
} from '../server/fileHelpers';

/**
 * What an archive is CALLED — every extension, de-duplication and recognition
 * rule the five bundle formats share, and nothing else.
 *
 * Deliberately a leaf: it reaches only into `fileHelpers`, so a module that
 * needs to name a bundle does not thereby import `DirSource`, `FileSource` and
 * the collector graph behind `appArchiveHelpers`. That mattered as soon as the
 * bible-note bundle started naming itself the shared way — pulling the archive
 * machinery into it dragged the note editor's own dependencies in behind it.
 * `appArchiveHelpers` re-exports all of this, so existing callers are unchanged.
 */

const INVALID_FILE_NAME_CHAR_CODES = new Set([
    34, 42, 47, 58, 60, 62, 63, 92, 124,
]);

/** See `genNextArchiveFilePath` — a bound, not an expected number of exports. */
const MAX_ARCHIVE_NAME_ATTEMPTS = 1000;

export function sanitizeFileNamePart(value: string) {
    const sanitizedText = Array.from(value.trim())
        .map((char) => {
            const codePoint = char.codePointAt(0) ?? 0;
            if (codePoint < 32 || INVALID_FILE_NAME_CHAR_CODES.has(codePoint)) {
                return '_';
            }
            return char;
        })
        .join('');
    return sanitizedText
        .replace(/_+/g, '_')
        .replace(/\s+/g, ' ')
        .replace(/[_ .]+$/g, '');
}

export function toArchiveFileName(
    name: string,
    dotExtension: string,
    fallbackName: string,
) {
    const fileName = sanitizeFileNamePart(name).slice(0, 120);
    return `${fileName || fallbackName}${dotExtension}`;
}

/**
 * The next free path for an archive, de-duplicated as `<name> (1)<dotExtension>`.
 *
 * NOT `FileSource.genNextFilePath()`: that splits a name on its LAST dot, so a
 * multi-part archive extension came back as `service.owapl.tar (1).gz` — a name
 * that no longer ends in `.owapl.tar.gz`, which the drop-import gate then
 * refused. Exporting the same playlist twice therefore produced a bundle the app
 * itself had written and would not take back, in silence. Every archive
 * extension is known at the call site, so it is kept whole here.
 */
export async function genNextArchiveFilePath(
    dirPath: string,
    fileFullName: string,
    dotExtension: string,
) {
    const baseName = fileFullName
        .toLocaleLowerCase()
        .endsWith(dotExtension.toLocaleLowerCase())
        ? fileFullName.slice(0, -dotExtension.length)
        : fileFullName;
    let filePath = pathJoin(dirPath, `${baseName}${dotExtension}`);
    let i = 0;
    while (await fsCheckFileExist(filePath)) {
        i++;
        // Bounded. A folder that answers "that name is taken" to everything —
        // a permissions oddity, a network share behaving badly — used to spin
        // here forever, building a longer string every turn until the process
        // ran out of memory. Failing after a thousand tries is a message the
        // operator can act on; a silent hang is not.
        if (i > MAX_ARCHIVE_NAME_ATTEMPTS) {
            throw new Error(
                `Unable to find a free name for "${baseName}${dotExtension}"` +
                    ` in ${dirPath}`,
            );
        }
        filePath = pathJoin(dirPath, `${baseName} (${i})${dotExtension}`);
    }
    return filePath;
}

/**
 * The tail of an archive file name, in BOTH the shapes that exist on disk.
 *
 * The canonical one is `<name><dotExtension>`. The other is what older builds
 * wrote for a second export: the de-duplicating suffix went in before the LAST
 * dot, giving `service.owapl.tar (1).gz`. Those bundles are already sitting in
 * people's Downloads folders, so every place that recognises an archive name has
 * to know the shape — refusing it is what made a dropped bundle do nothing at
 * all, and failing to strip it is what named the imported playlist
 * `service.owapl.tar (1)`.
 */
function toArchiveFileNameRegex(dotExtension: string) {
    const escape = (text: string) =>
        text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lastDotIndex = dotExtension.lastIndexOf('.');
    const head = escape(dotExtension.slice(0, lastDotIndex));
    const tail = escape(dotExtension.slice(lastDotIndex));
    return new RegExp(`${head}(\\s*\\(\\d+\\))?${tail}$`, 'i');
}

export const ENCRYPTED_DOT_EXTENSION_TAIL = '.enc';

/**
 * The name the PLAIN archive is written under while a protected export is being
 * built. It sits at the root of the staging directory the export already
 * creates and deletes, so the unprotected copy never outlives the call and
 * needs no cleanup of its own. Safe there because every `tarCreate` is handed an
 * explicit entry list (`stageArchiveFiles`), so tar never packs it.
 */
export const PLAIN_ARCHIVE_TEMP_NAME = 'plain-archive.tmp';

/**
 * The name a password protected archive is written under: the compression tail
 * is swapped for `.enc`, so `.owapl.tar.gz` becomes `.owapl.enc`.
 *
 * The KIND stays in the name deliberately. Every list recognises its own bundle
 * by name — that is what the drop gates and the file dialogs match on — and a
 * single shared `.enc` extension would force each of them to open the file and
 * sniff it before it could say whether it even belongs there.
 *
 * Keeping the `.tar.gz` tail was the other option and is worse: the file is no
 * longer a tar, and naming it one sends people to a tool that cannot read it.
 */
export function toEncryptedDotExtension(dotExtension: string) {
    const baseDotExtension = dotExtension.replace(/\.tar(\.gz)?$/i, '');
    return `${baseDotExtension}${ENCRYPTED_DOT_EXTENSION_TAIL}`;
}

/** The extension an export will actually write, password or not. */
export function toArchiveDotExtension(
    dotExtension: string,
    password: string | null,
) {
    return password ? toEncryptedDotExtension(dotExtension) : dotExtension;
}

/** Whether a file name is a PASSWORD PROTECTED archive of this kind. */
export function checkIsEncryptedArchiveFileFullName(
    fileFullName: string,
    dotExtension: string,
) {
    return toArchiveFileNameRegex(toEncryptedDotExtension(dotExtension)).test(
        fileFullName,
    );
}

/**
 * Whether a file name is an archive of this kind, protected or not. Both shapes
 * are accepted here rather than at each call site, so every drop gate and file
 * dialog took the protected bundle the moment the format existed.
 */
export function checkIsArchiveFileFullName(
    fileFullName: string,
    dotExtension: string,
) {
    return (
        toArchiveFileNameRegex(dotExtension).test(fileFullName) ||
        checkIsEncryptedArchiveFileFullName(fileFullName, dotExtension)
    );
}

/** The archive's name without its extension, whichever shape that took. */
export function toArchiveBaseName(fileFullName: string, dotExtension: string) {
    return fileFullName
        .replace(toArchiveFileNameRegex(dotExtension), '')
        .replace(
            toArchiveFileNameRegex(toEncryptedDotExtension(dotExtension)),
            '',
        );
}

/**
 * Name the temp file a downloaded archive is written to. The URL's own name is
 * kept when it already looks like one of ours, so what lands on disk carries the
 * same base name the import will call the thing it creates.
 */
export function toArchiveFileNameFromUrl(
    url: string,
    dotExtension: string,
    fallbackName: string,
) {
    const fileFullName = decodeURIComponent(
        pathBasename(new URL(url).pathname),
    );
    // A protected bundle keeps its own extension. Nothing reads the name to
    // decide how to open it — the container magic does that — but calling a
    // file `.owapl.tar.gz` when it is not a tar at all sends the operator to a
    // tool that cannot read it.
    const lowerFileFullName = fileFullName.toLocaleLowerCase();
    const encryptedDotExtension = toEncryptedDotExtension(dotExtension);
    const resolvedDotExtension = lowerFileFullName.endsWith(
        encryptedDotExtension.toLocaleLowerCase(),
    )
        ? encryptedDotExtension
        : dotExtension;
    const name = lowerFileFullName.endsWith(
        resolvedDotExtension.toLocaleLowerCase(),
    )
        ? fileFullName.slice(0, -resolvedDotExtension.length)
        : fileFullName.replace(/\.[^.]*$/, '');
    return toArchiveFileName(name, resolvedDotExtension, fallbackName);
}
