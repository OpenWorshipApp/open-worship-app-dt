/**
 * How `owa_resource_file` names the Resources panel's files to a model, and
 * reads a name back. Pure, every rule a test; the worker that touches the
 * disk is `agentResourcesHelpers.ts`.
 *
 * A file is named `<folder>/<path inside it>` -- `pdf/LUK.7.pdf` -- never by
 * its whole path: a folder's path carries the computer's account name, and
 * nothing a model is handed needs it. The folder is the Resources folder's
 * own name, made unique when two share one (`pdf`, `pdf#2`).
 */
import kjvBibleConfigJson from './bible-helpers/kjvBibleConfig.json';

export type ResourceFileKindType = 'pdf' | 'note' | 'text' | 'picture';

/** Each Resources folder's name in a file's name, in the list's order. */
export function genResourceFolderLabels(
    dirPaths: string[],
    toBaseName: (dirPath: string) => string,
) {
    const seen = new Map<string, number>();
    return dirPaths.map((dirPath) => {
        const baseName = toBaseName(dirPath).trim() || 'folder';
        const key = baseName.toLowerCase();
        const count = (seen.get(key) ?? 0) + 1;
        seen.set(key, count);
        return count === 1 ? baseName : `${baseName}#${count}`;
    });
}

/**
 * A file on disk as the tool names it, when it lies inside one of the
 * Resources folders (`pdf/LUK.6.pdf`); null when it is in none of them. The
 * path rules are handed in, so this stays free of the file system.
 */
export function toResourceFileName(
    filePath: string,
    dirPaths: string[],
    rules: {
        toBaseName: (dirPath: string) => string;
        toCompareKey: (path: string) => string;
        separator: string;
    },
) {
    const labels = genResourceFolderLabels(dirPaths, rules.toBaseName);
    const fileKey = rules.toCompareKey(filePath);
    for (let index = 0; index < dirPaths.length; index++) {
        const dirPath = dirPaths[index].replace(/[\\/]+$/, '');
        const dirKey = rules.toCompareKey(dirPath) + rules.separator;
        if (fileKey.startsWith(dirKey)) {
            const inner = filePath
                .slice(dirPath.length)
                .replaceAll('\\', '/')
                .replace(/^\/+/, '');
            return `${labels[index]}/${inner}`;
        }
    }
    return null;
}

/**
 * A file's name split back into its folder and the path inside it, or null
 * for anything that could step outside the folder (`..`, an absolute path, a
 * drive) -- the worker checks the resolved path as well, this is the cheap
 * half.
 */
export function splitResourceFileName(fileName: string) {
    const parts = String(fileName ?? '')
        .trim()
        .replaceAll('\\', '/')
        .split('/')
        .filter((part) => {
            return part.length > 0;
        });
    if (
        parts.length < 2 ||
        parts.some((part) => {
            return part === '.' || part === '..' || part.includes(':');
        })
    ) {
        return null;
    }
    return { folder: parts[0], innerParts: parts.slice(1) };
}

const PICTURE_PATTERN = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;
const TEXT_PATTERN =
    /\.(txt|md|markdown|json|csv|log|xml|html?|ya?ml|ini|srt|vtt|owl|ows|owpf|lyric)$/i;

/** What a file is read as, by its name; null for one that cannot be read. */
export function toResourceFileKind(
    fileName: string,
): ResourceFileKindType | null {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) {
        return 'pdf';
    }
    if (lower.endsWith('.own')) {
        return 'note';
    }
    if (PICTURE_PATTERN.test(lower)) {
        return 'picture';
    }
    if (TEXT_PATTERN.test(lower)) {
        return 'text';
    }
    return null;
}

function toCompactName(text: string) {
    return text.toLowerCase().replaceAll(/[\s._-]+/g, '');
}

/**
 * A book as the Resources panel's file names write it (`LUK`), from that key
 * or the book's English name in any case or spacing (`Luke`, `1 john`).
 * Null for anything else.
 */
export function toResourceBookKey(book: unknown) {
    const wanted = toCompactName(String(book ?? ''));
    if (wanted.length === 0) {
        return null;
    }
    const keyBookMap = kjvBibleConfigJson.keyBookMap as Record<string, string>;
    for (const bookKey of kjvBibleConfigJson.bookKeysOrder) {
        if (
            toCompactName(bookKey) === wanted ||
            toCompactName(keyBookMap[bookKey] ?? '') === wanted
        ) {
            return bookKey;
        }
    }
    return null;
}

/** "Pages 3 to 6 of 12" as the model reads it: `3-6`, or `3` for one. */
export function toPageSpanText(startPage: number, count: number) {
    return count <= 1
        ? String(startPage)
        : `${startPage.toString()}-${(startPage + count - 1).toString()}`;
}

/**
 * A name the Resources panel hands out (`pdf/LUK.7.pdf`) back to the file
 * inside the folder it names; null for a folder the panel does not list, a
 * `..`, a drive or an absolute path (the same refusals
 * `splitResourceFileName` makes).
 */
export function resolveResourceFileName(
    fileName: string,
    dirPaths: string[],
    rules: {
        toBaseName: (dirPath: string) => string;
        separator: string;
    },
) {
    const split = splitResourceFileName(fileName);
    if (split === null) {
        return null;
    }
    const labels = genResourceFolderLabels(dirPaths, rules.toBaseName);
    const index = labels.findIndex((label) => {
        return label.toLowerCase() === split.folder.toLowerCase();
    });
    if (index === -1) {
        return null;
    }
    const dirPath = dirPaths[index].replace(/[\\/]+$/, '');
    return [dirPath, ...split.innerParts].join(rules.separator);
}

/**
 * A book's key from a name in ANY installed Bible's own language (JHN for
 * `យ៉ូហាន`), after the code and the English name. The Resources panel's
 * files are named by the KJV's codes, but the person asking is reading a
 * Khmer Bible and says `យ៉ូហាន` (seen live 2026-10-18).
 */
export function resolveResourceBookKeyFromMaps(
    book: unknown,
    mapList: { [bookKey: string]: string }[],
) {
    const englishOrCode = toResourceBookKey(book);
    if (englishOrCode !== null) {
        return englishOrCode;
    }
    const wanted = toCompactName(String(book ?? ''));
    if (wanted.length === 0) {
        return null;
    }
    for (const keyBookMap of mapList) {
        for (const [bookKey, name] of Object.entries(keyBookMap)) {
            if (toCompactName(name) === wanted) {
                return bookKey;
            }
        }
    }
    return null;
}
