// @vitest-environment jsdom

import { act, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The parts of `fileListFilterHelpers` the sibling `.test.ts` does not reach:
// the type sort, the empty colour group, the persisted filter state hook. The
// path helpers are the real `fileHelpers` over a POSIX `pathUtils`.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    colorNotes: new Map<string, string>(),
    setSettingCalls: [] as [string, string][],
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        isDesktop: true,
        systemUtils: { isDev: false, isWindows: false, isMac: false },
        pathUtils: {
            sep: '/',
            join: (...paths: string[]) => paths.join('/'),
            basename: (filePath: string) => filePath.split('/').pop() ?? '',
        },
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    // As the real one: seeded from the stored value, writing back each set.
    useStateSettingString: (settingName: string, defaultString = '') => {
        const [data, setData] = useState(
            h.settings.get(settingName) || defaultString,
        );
        const setDataSetting = useCallback(
            (text: string) => {
                setData(text);
                h.settings.set(settingName, text);
                h.setSettingCalls.push([settingName, text]);
            },
            [settingName],
        );
        return [data, setDataSetting];
    },
}));
vi.mock('../helper/colorNoteHelpers', () => ({
    genFilePathColorMap: (filePaths: string[]) => {
        const colorMap: { [key: string]: string[] } = { unknown: [] };
        for (const filePath of filePaths) {
            const colorNote = h.colorNotes.get(filePath) ?? 'unknown';
            colorMap[colorNote] = colorMap[colorNote] ?? [];
            colorMap[colorNote].push(filePath);
        }
        return colorMap;
    },
    genColorNoteDataList: (colorMap: { [key: string]: string[] }) => {
        const colorNotes = Object.keys(colorMap)
            .filter((colorNote) => colorNote !== 'unknown')
            .sort((colorNote1, colorNote2) => {
                return colorNote1.localeCompare(colorNote2);
            });
        colorNotes.push('unknown');
        return colorNotes;
    },
}));

import {
    DEFAULT_SORT_DATA,
    filterFilePaths,
    genCombinedSortFilePaths,
    genFileTypeNames,
    toDisplayedFilePaths,
    toFileTypeName,
    useFileListFilterData,
    type FileListFilterDataType,
} from './fileListFilterHelpers';

let container: HTMLDivElement;
let root: Root;
let latest: FileListFilterDataType;

function ProbeComp({ settingName }: Readonly<{ settingName: string }>) {
    latest = useFileListFilterData({ settingName } as any);
    return null;
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.settings.clear();
    h.colorNotes.clear();
    h.setSettingCalls.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('file type names', () => {
    test('are the upper-cased extension, and "?" for a nameless path', () => {
        expect(toFileTypeName('/docs/Sermon.final.PDF')).toBe('PDF');
        expect(toFileTypeName('/docs/song.owl')).toBe('OWL');
        expect(toFileTypeName('')).toBe('?');
        expect(
            genFileTypeNames(['/a/x.pptx', '/a/y.pdf', '/a/z.PDF', '/a/w.mp4']),
        ).toEqual(['MP4', 'PDF', 'PPTX']);
    });

    // Found by UT-81 (2026-11-03): `getFileDotExtension` answers the WHOLE
    // name for a file with no dot, so `README` was listed under Filter by
    // Type as "EADME".
    test('a file with no extension is "?", not its own name cut short', () => {
        expect(toFileTypeName('/docs/README')).toBe('?');
        expect(genFileTypeNames(['/a/README', '/a/x.pdf'])).toEqual([
            '?',
            'PDF',
        ]);
    });
});

describe('filterFilePaths', () => {
    test('keeps what matches the trimmed text and the type', () => {
        const filePaths = [
            '/a/Amazing Grace.owl',
            '/a/Grace Notes.pdf',
            '/a/Other.owl',
        ];
        expect(filterFilePaths(filePaths, '  GRACE ', '')).toEqual([
            '/a/Amazing Grace.owl',
            '/a/Grace Notes.pdf',
        ]);
        expect(filterFilePaths(filePaths, 'grace', 'OWL')).toEqual([
            '/a/Amazing Grace.owl',
        ]);
        expect(filterFilePaths(filePaths, '', 'OWL')).toEqual([
            '/a/Amazing Grace.owl',
            '/a/Other.owl',
        ]);
        expect(filterFilePaths(filePaths, '   ', '')).toBe(filePaths);
    });
});

describe('genCombinedSortFilePaths', () => {
    const filePaths = ['/a/b.pdf', '/a/a.pptx', '/a/c.mp4', '/a/a.pdf'];

    test('keeps the list own order while no sort is picked', () => {
        const baseSort = (paths: string[]) => paths;
        expect(genCombinedSortFilePaths(baseSort, DEFAULT_SORT_DATA)).toBe(
            baseSort,
        );
        expect(
            genCombinedSortFilePaths(undefined, DEFAULT_SORT_DATA),
        ).toBeUndefined();
    });

    test('sorts by type, then by name inside a type, either way', () => {
        const ascending = genCombinedSortFilePaths(undefined, {
            key: 'type',
            isAscending: true,
        })!;
        expect(ascending(filePaths)).toEqual([
            '/a/c.mp4',
            '/a/a.pdf',
            '/a/b.pdf',
            '/a/a.pptx',
        ]);
        const descending = genCombinedSortFilePaths(undefined, {
            key: 'type',
            isAscending: false,
        })!;
        expect(descending(filePaths)).toEqual([
            '/a/a.pptx',
            '/a/b.pdf',
            '/a/a.pdf',
            '/a/c.mp4',
        ]);
        // The list it was handed is left as it was.
        expect(filePaths).toEqual([
            '/a/b.pdf',
            '/a/a.pptx',
            '/a/c.mp4',
            '/a/a.pdf',
        ]);
    });
});

describe('toDisplayedFilePaths', () => {
    test('skips a colour group left empty, the unknown one included', () => {
        h.settings.set('docs-list-sort', 'type:asc');
        h.colorNotes.set('/a/b.pdf', '#ff0000');
        h.colorNotes.set('/a/a.pptx', '#00ff00');
        h.colorNotes.set('/a/c.mp4', '#ff0000');
        expect(
            toDisplayedFilePaths('docs', ['/a/b.pdf', '/a/a.pptx', '/a/c.mp4']),
        ).toEqual(['/a/a.pptx', '/a/c.mp4', '/a/b.pdf']);
    });
});

describe('useFileListFilterData', () => {
    test('restores the persisted sort and type, keeps the search text unsaved', async () => {
        h.settings.set('videos-list-sort', 'type:desc');
        h.settings.set('videos-list-filter-type', 'MP4');
        await act(async () => {
            root.render(<ProbeComp settingName="videos" />);
        });
        expect(latest.sortData).toEqual({ key: 'type', isAscending: false });
        expect(latest.filterTypeName).toBe('MP4');
        expect(latest.filterText).toBe('');
        expect(latest.isSearchShowing).toBe(false);

        const { setSortData } = latest;
        await act(async () => {
            latest.setSortData({ key: 'name', isAscending: true });
        });
        expect(h.setSettingCalls).toEqual([['videos-list-sort', 'name:asc']]);
        expect(latest.sortData).toEqual({ key: 'name', isAscending: true });
        // A stable setter: list headers keep it in their dependencies.
        expect(latest.setSortData).toBe(setSortData);

        await act(async () => {
            latest.setSortData({ key: 'type', isAscending: false });
        });
        expect(h.settings.get('videos-list-sort')).toBe('type:desc');

        await act(async () => {
            latest.setFilterText('chorus');
            latest.setIsSearchShowing(true);
        });
        expect(latest.filterText).toBe('chorus');
        expect(latest.isSearchShowing).toBe(true);

        await act(async () => {
            latest.setFilterTypeName('PDF');
        });
        expect(latest.filterTypeName).toBe('PDF');
        expect(h.setSettingCalls.map(([settingName]) => settingName)).toEqual([
            'videos-list-sort',
            'videos-list-sort',
            'videos-list-filter-type',
        ]);
    });

    test('falls back to no sort for an unknown stored sort', async () => {
        h.settings.set('lyrics-list-sort', 'size:asc');
        await act(async () => {
            root.render(<ProbeComp settingName="lyrics" />);
        });
        expect(latest.sortData).toEqual(DEFAULT_SORT_DATA);
        expect(latest.filterTypeName).toBe('');
    });
});
