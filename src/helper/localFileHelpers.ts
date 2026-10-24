// `appFilePath` is stamped onto `File` objects by the electron preload (see
// electron/client/fileUtils); blobs created in the renderer do not carry it.
export type LocalFile = Readonly<{
    appFilePath?: unknown;
}>;

export function getAppFilePathFromFile(file: unknown) {
    const filePath = (file as LocalFile | null | undefined)?.appFilePath;
    if (typeof filePath !== 'string' || filePath.trim() === '') {
        return null;
    }
    return filePath;
}

/**
 * Whether the drag carries files at all.
 *
 * The `length > 0` is not redundant: `.every()` on an empty
 * `dataTransfer.items` is vacuously true, so without it a drag of pure text
 * would light a target up as an accepted drop. Everything the app drags
 * INTERNALLY -- a verse, a slide, a background -- travels as `string` items,
 * so this is also what keeps those from being offered a folder drop.
 */
export function checkIsDraggingFiles(dataTransfer: DataTransfer | null) {
    if (dataTransfer === null) {
        return false;
    }
    const items = Array.from(dataTransfer.items);
    return (
        items.length > 0 &&
        items.every((item) => {
            return item.kind === 'file';
        })
    );
}

/**
 * The on-disk paths a drop carried, in drop order and without repeats.
 *
 * Read off `dataTransfer.files` rather than through `readDroppedFiles`, which
 * walks `webkitGetAsEntry()` and yields only entries whose `isFile` is true --
 * a dropped FOLDER is exactly what that skips. `appFilePath` is stamped onto
 * every dropped `File` by the electron preload; a `File` made in the renderer
 * carries none and is dropped here.
 */
export function readDroppedPaths(dataTransfer: DataTransfer | null): string[] {
    if (dataTransfer === null) {
        return [];
    }
    const droppedPaths: string[] = [];
    for (const file of Array.from(dataTransfer.files ?? [])) {
        const filePath = getAppFilePathFromFile(file);
        if (filePath === null || droppedPaths.includes(filePath)) {
            continue;
        }
        droppedPaths.push(filePath);
    }
    return droppedPaths;
}
