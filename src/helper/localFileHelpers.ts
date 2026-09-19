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
