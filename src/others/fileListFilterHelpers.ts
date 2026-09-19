import { useCallback, useMemo, useState } from 'react';

import type DirSource from '../helper/DirSource';
import { getFileDotExtension, pathBasename } from '../server/fileHelpers';
import { useStateSettingString } from '../helper/settingHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

// Below this many files a filter/sort bar costs more (vertical space on a
// small sidebar, an extra pass over the list) than it can ever save, so it is
// not rendered and filtering is skipped entirely. Without the skip a stale
// persisted type filter could hide the only file with no visible way to undo.
export const MIN_FILTERABLE_FILE_COUNT = 2;

export const SORT_KEY_NONE = 'none';
export const SORT_KEY_NAME = 'name';
export const SORT_KEY_TYPE = 'type';
const sortKeyList = [SORT_KEY_NONE, SORT_KEY_NAME, SORT_KEY_TYPE] as const;
export type SortKeyType = (typeof sortKeyList)[number];
export type SortDataType = {
    key: SortKeyType;
    isAscending: boolean;
};

export const DEFAULT_SORT_DATA: SortDataType = {
    key: SORT_KEY_NONE,
    isAscending: true,
};

// The document type of a file is its extension, uppercased (`PDF`, `PPTX`,
// `OWS`, ...). Deliberately not `getFileMetaData`: that clones the whole mime
// table per call, and this runs once per file on every list render.
export function toFileTypeName(filePath: string) {
    const dotExtension = getFileDotExtension(pathBasename(filePath));
    if (!dotExtension) {
        return '?';
    }
    return dotExtension.slice(1).toUpperCase();
}

export function genFileTypeNames(filePaths: string[]) {
    const typeNames = new Set<string>();
    for (const filePath of filePaths) {
        typeNames.add(toFileTypeName(filePath));
    }
    return Array.from(typeNames).sort((typeName1, typeName2) => {
        return typeName1.localeCompare(typeName2);
    });
}

export function filterFilePaths(
    filePaths: string[],
    filterText: string,
    filterTypeName: string,
) {
    const searchText = filterText.trim().toLowerCase();
    if (!searchText && !filterTypeName) {
        return filePaths;
    }
    return filePaths.filter((filePath) => {
        if (filterTypeName && toFileTypeName(filePath) !== filterTypeName) {
            return false;
        }
        if (!searchText) {
            return true;
        }
        return pathBasename(filePath).toLowerCase().includes(searchText);
    });
}

function genSortComparator(sortData: SortDataType) {
    if (sortData.key === SORT_KEY_NONE) {
        return null;
    }
    const factor = sortData.isAscending ? 1 : -1;
    const isByType = sortData.key === SORT_KEY_TYPE;
    return (filePath1: string, filePath2: string) => {
        if (isByType) {
            const result = toFileTypeName(filePath1).localeCompare(
                toFileTypeName(filePath2),
            );
            if (result !== 0) {
                return result * factor;
            }
        }
        const result = pathBasename(filePath1).localeCompare(
            pathBasename(filePath2),
        );
        return result * factor;
    };
}

// An explicit user sort wins over the list's own ordering (e.g. "default bible
// first"), so the base sort only survives while the user has not picked one.
export function genCombinedSortFilePaths(
    baseSortFilePaths: ((filePaths: string[]) => string[]) | undefined,
    sortData: SortDataType,
) {
    const comparator = genSortComparator(sortData);
    if (comparator === null) {
        return baseSortFilePaths;
    }
    return (filePaths: string[]) => {
        return [...filePaths].sort(comparator);
    };
}

function toSortSettingName(settingName: string) {
    return `${settingName}-list-sort`;
}

function toFilterTypeSettingName(settingName: string) {
    return `${settingName}-list-filter-type`;
}

function toSortText({ key, isAscending }: SortDataType) {
    return `${key}:${isAscending ? 'asc' : 'desc'}`;
}

function fromSortText(sortText: string): SortDataType {
    const [key, direction] = sortText.split(':');
    if (!sortKeyList.includes(key as SortKeyType)) {
        return DEFAULT_SORT_DATA;
    }
    return { key: key as SortKeyType, isAscending: direction !== 'desc' };
}

export type FileListFilterDataType = {
    filterText: string;
    setFilterText: (text: string) => void;
    isSearchShowing: boolean;
    setIsSearchShowing: (isShowing: boolean) => void;
    sortData: SortDataType;
    setSortData: (sortData: SortDataType) => void;
    filterTypeName: string;
    setFilterTypeName: (typeName: string) => void;
};

// The sort choice and the type filter are sticky preferences (persisted per
// list), but the search text is not: a list that comes back empty after a
// restart with no visible reason is worse than retyping a few characters.
export function useFileListFilterData(
    dirSource: DirSource,
): FileListFilterDataType {
    const [filterText, setFilterText] = useState('');
    const [isSearchShowing, setIsSearchShowing] = useState(false);
    const [sortText, setSortText] = useStateSettingString(
        toSortSettingName(dirSource.settingName),
        '',
    );
    const [filterTypeName, setFilterTypeName] = useStateSettingString(
        toFilterTypeSettingName(dirSource.settingName),
        '',
    );
    const sortData = useMemo(() => {
        return fromSortText(sortText);
    }, [sortText]);
    const setSortTextRef = useAppCurrentRef(setSortText);
    const setSortData = useCallback((newSortData: SortDataType) => {
        setSortTextRef.current(toSortText(newSortData));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return {
        filterText,
        setFilterText,
        isSearchShowing,
        setIsSearchShowing,
        sortData,
        setSortData,
        filterTypeName,
        setFilterTypeName,
    };
}
