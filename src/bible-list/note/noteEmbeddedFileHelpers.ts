// A LEAF: nothing here may import the note model, the archive collector, or
// anything that reaches React. Walking a note's Lexical content for the files
// it embeds is needed by both the note-item bundle and the whole-note-file
// bundle, and neither may drag the other's graph in behind it.
import { handleError } from '../../helper/errorHelpers';

const EMBEDDED_FILE_PATH_KEYS = ['appFilePath', 'src'] as const;

export function parseJson(text: string) {
    const trimmedText = text.trim();
    if (!trimmedText.startsWith('{') && !trimmedText.startsWith('[')) {
        return null;
    }
    try {
        return JSON.parse(text) as unknown;
    } catch (error) {
        handleError(error);
        return null;
    }
}

function isUrlLike(value: string) {
    const lowerValue = value.toLowerCase();
    return (
        lowerValue.startsWith('http://') ||
        lowerValue.startsWith('https://') ||
        lowerValue.startsWith('data:') ||
        lowerValue.startsWith('blob:')
    );
}

function isLocalFilePath(value: string) {
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0 || isUrlLike(trimmedValue)) {
        return false;
    }

    const firstCodePoint = trimmedValue.codePointAt(0);
    const secondCodePoint = trimmedValue.codePointAt(1);
    const thirdCodePoint = trimmedValue.codePointAt(2);
    const isWindowsDrivePath =
        firstCodePoint !== undefined &&
        ((firstCodePoint >= 65 && firstCodePoint <= 90) ||
            (firstCodePoint >= 97 && firstCodePoint <= 122)) &&
        secondCodePoint === 58 &&
        (thirdCodePoint === 47 || thirdCodePoint === 92);
    const isPosixAbsolutePath = firstCodePoint === 47;
    const isUncPath = firstCodePoint === 92 && secondCodePoint === 92;
    return isWindowsDrivePath || isPosixAbsolutePath || isUncPath;
}

function checkIsEmbeddedFilePathField(key: string, value: string) {
    if (key === 'appFilePath') {
        return value.length > 0;
    }
    return key === 'src' && isLocalFilePath(value);
}

function collectAppFilePaths(
    value: unknown,
    paths: string[],
    seenPaths: Set<string>,
) {
    if (Array.isArray(value)) {
        value.forEach((child) => {
            collectAppFilePaths(child, paths, seenPaths);
        });
        return;
    }
    if (value === null || typeof value !== 'object') {
        return;
    }

    const objectValue = value as Record<string, unknown>;
    for (const key of EMBEDDED_FILE_PATH_KEYS) {
        const embeddedFilePath = objectValue[key];
        if (
            typeof embeddedFilePath === 'string' &&
            checkIsEmbeddedFilePathField(key, embeddedFilePath) &&
            !seenPaths.has(embeddedFilePath)
        ) {
            seenPaths.add(embeddedFilePath);
            paths.push(embeddedFilePath);
        }
    }
    Object.values(objectValue).forEach((child) => {
        collectAppFilePaths(child, paths, seenPaths);
    });
}

export function collectLexicalAppFilePaths(content: string) {
    const jsonData = parseJson(content);
    if (jsonData === null) {
        return [];
    }
    const paths: string[] = [];
    collectAppFilePaths(jsonData, paths, new Set<string>());
    return paths;
}

function rewriteAppFilePaths(
    value: unknown,
    appFilePathByOriginalPath: Map<string, string>,
) {
    let isChanged = false;
    if (Array.isArray(value)) {
        value.forEach((child) => {
            isChanged =
                rewriteAppFilePaths(child, appFilePathByOriginalPath) ||
                isChanged;
        });
        return isChanged;
    }
    if (value === null || typeof value !== 'object') {
        return false;
    }

    const objectValue = value as Record<string, unknown>;
    for (const key of EMBEDDED_FILE_PATH_KEYS) {
        const embeddedFilePath = objectValue[key];
        if (typeof embeddedFilePath !== 'string') {
            continue;
        }
        const importedPath = appFilePathByOriginalPath.get(embeddedFilePath);
        if (importedPath !== undefined) {
            objectValue[key] = importedPath;
            isChanged = true;
        }
    }
    Object.values(objectValue).forEach((child) => {
        isChanged =
            rewriteAppFilePaths(child, appFilePathByOriginalPath) || isChanged;
    });
    return isChanged;
}

export function rewriteLexicalAppFilePaths(
    content: string,
    appFilePathByOriginalPath: Map<string, string>,
) {
    const jsonData = parseJson(content);
    if (jsonData === null) {
        return content;
    }
    if (!rewriteAppFilePaths(jsonData, appFilePathByOriginalPath)) {
        return content;
    }
    return JSON.stringify(jsonData);
}
