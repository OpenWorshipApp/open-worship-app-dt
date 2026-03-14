import FileSource from './FileSource';

export const UNKNOWN_COLOR_NOTE = 'unknown';

export function genColorBar(colorNote: string) {
    return (
        <hr
            style={
                colorNote === UNKNOWN_COLOR_NOTE
                    ? {}
                    : {
                          backgroundColor: colorNote,
                          height: '1px',
                          border: 0,
                      }
            }
        />
    );
}

export function genColorMap<T extends { colorNote: string | null }>(
    items: T[],
) {
    const newFilePathColorMap: { [key: string]: T[] } = {
        [UNKNOWN_COLOR_NOTE]: [],
    };
    for (const item of items) {
        const colorNote = item.colorNote ?? UNKNOWN_COLOR_NOTE;
        newFilePathColorMap[colorNote] = newFilePathColorMap[colorNote] ?? [];
        newFilePathColorMap[colorNote].push(item);
    }
    return newFilePathColorMap;
}

export function genFilePathColorMap(filePaths: string[]) {
    const fileSources = filePaths.map((filePath) => {
        return FileSource.getInstance(filePath);
    });
    const fileSourceColorMap = genColorMap(fileSources);
    return Object.fromEntries(
        Object.entries(fileSourceColorMap).map(([colorNote, fileSources]) => {
            const newFilePaths = fileSources.map((fileSource) => {
                return fileSource.filePath;
            });
            return [colorNote, newFilePaths];
        }),
    );
}

export function genColorNoteDataList<T>(colorMap: { [key: string]: T[] }) {
    const newColorNotes = Object.keys(colorMap)
        .filter((key) => {
            return key !== UNKNOWN_COLOR_NOTE;
        })
        .sort((a, b) => a.localeCompare(b));
    newColorNotes.push(UNKNOWN_COLOR_NOTE);
    return newColorNotes;
}
