import type { BackgroundWebUrlSource } from './backgroundWebUrlHelpers';
import {
    genColorMap,
    genColorNoteDataList,
    genFilePathColorMap,
} from '../helper/colorNoteHelpers';

export type BackgroundWebColorSectionType = {
    colorNote?: string;
    filePaths: string[];
    urlSources: BackgroundWebUrlSource[];
};

export function genBackgroundWebColorSections(
    filePaths: string[],
    urlSources: BackgroundWebUrlSource[],
): BackgroundWebColorSectionType[] {
    const sortedFilePaths = [...filePaths].sort((a, b) => {
        return a.localeCompare(b);
    });
    const sortedUrlSources = [...urlSources].sort((a, b) => {
        return a.fullName.localeCompare(b.fullName);
    });
    const filePathColorMap = genFilePathColorMap(sortedFilePaths);
    const urlSourceColorMap = genColorMap(sortedUrlSources);
    const allColorNotes = new Set([
        ...Object.keys(filePathColorMap),
        ...Object.keys(urlSourceColorMap),
    ]);
    const sectionColorMap = Object.fromEntries(
        [...allColorNotes].map((colorNote) => {
            return [colorNote, [] as never[]];
        }),
    );
    const sections = genColorNoteDataList(sectionColorMap)
        .map((colorNote) => {
            return {
                colorNote,
                filePaths: filePathColorMap[colorNote] ?? [],
                urlSources: urlSourceColorMap[colorNote] ?? [],
            };
        })
        .filter((section) => {
            return (
                section.filePaths.length > 0 || section.urlSources.length > 0
            );
        });

    if (sections.length <= 1) {
        return sections.map(({ filePaths, urlSources }) => {
            return {
                filePaths,
                urlSources,
            };
        });
    }

    return sections;
}
