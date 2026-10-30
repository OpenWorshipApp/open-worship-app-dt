// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The sibling `fileListFilterHelpers.test.ts` covers `toDisplayedFilePaths`
// with a setting hook that never stores anything. This file covers the type
// sort, the helpers' edge cases and the persisted `useFileListFilterData`.

const state = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    colorNotes: new Map<string, string>(),
    emptyGroups: [] as string[],
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
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        getSetting: (key: string) => state.settings.get(key) ?? null,
        useStateSettingString: (settingName: string, defaultString = '') => {
            const [value, setValue] = useState(
                state.settings.get(settingName) || defaultString,
            );
            return [
                value,
                (newValue: string) => {
                    setValue(newValue);
                    state.settings.set(settingName, newValue);
                },
            ];
        },
    };
});
vi.mock('../helper/colorNoteHelpers', () => ({
    genFilePathColorMap: (filePaths: string[]) => {
        const colorMap: Record<string, string[]> = { unknown: [] };
        for (const colorNote of state.emptyGroups) {
            colorMap[colorNote] = [];
        }
        for (const filePath of filePaths) {
            const colorNote = state.colorNotes.get(filePath) ?? 'unknown';
            colorMap[colorNote] = colorMap[colorNote] ?? [];
            colorMap[colorNote].push(filePath);
        }
        return colorMap;
    },
    genColorNoteDataList: (colorMap: Record<string, string[]>) => [
        ...Object.keys(colorMap)
            .filter((key) => key !== 'unknown')
            .sort(),
        'unknown',
    ],
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

const FILES = [
    '/docs/b.pdf',
    '/docs/a.pptx',
    '/docs/c.pdf',
    '/docs/README',
    '/docs/a.pdf',
];

beforeEach(() => {
    state.settings.clear();
    state.colorNotes.clear();
    state.emptyGroups = [];
});

describe('file type names', () => {
    test('are the extension uppercased, or "?" with none', () => {
        expect(toFileTypeName('/docs/song.ows')).toBe('OWS');
        expect(toFileTypeName('/docs/README')).toBe('?');
    });

    test('are listed once each, in order', () => {
        expect(genFileTypeNames(FILES)).toEqual(['?', 'PDF', 'PPTX']);
    });
});

describe('filterFilePaths', () => {
    test('with no text and no type the list is returned untouched', () => {
        expect(filterFilePaths(FILES, '  ', '')).toBe(FILES);
    });

    test('a type keeps that type only, text narrows by name', () => {
        expect(filterFilePaths(FILES, '', 'PDF')).toEqual([
            '/docs/b.pdf',
            '/docs/c.pdf',
            '/docs/a.pdf',
        ]);
        expect(filterFilePaths(FILES, ' A. ', '')).toEqual([
            '/docs/a.pptx',
            '/docs/a.pdf',
        ]);
        expect(filterFilePaths(FILES, 'a', 'PPTX')).toEqual(['/docs/a.pptx']);
    });
});

describe('genCombinedSortFilePaths', () => {
    test('a type sort groups by type, then by name', () => {
        const sort = genCombinedSortFilePaths(undefined, {
            key: 'type',
            isAscending: true,
        })!;
        expect(sort(FILES)).toEqual([
            '/docs/README',
            '/docs/a.pdf',
            '/docs/b.pdf',
            '/docs/c.pdf',
            '/docs/a.pptx',
        ]);
    });

    test('descending reverses both the types and the names', () => {
        const sort = genCombinedSortFilePaths(undefined, {
            key: 'type',
            isAscending: false,
        })!;
        expect(sort(FILES)).toEqual([
            '/docs/a.pptx',
            '/docs/c.pdf',
            '/docs/b.pdf',
            '/docs/a.pdf',
            '/docs/README',
        ]);
    });

    test('with no sort chosen the list keeps its own ordering', () => {
        const baseSort = (filePaths: string[]) => filePaths;
        expect(genCombinedSortFilePaths(baseSort, DEFAULT_SORT_DATA)).toBe(
            baseSort,
        );
    });
});

describe('toDisplayedFilePaths', () => {
    test('an empty colour group is skipped, the sort applies inside each group', () => {
        state.emptyGroups = ['#00ff00'];
        state.colorNotes.set('/docs/c.pdf', '#ff0000');
        state.colorNotes.set('/docs/a.pptx', '#ff0000');
        state.settings.set('docs-list-sort', 'type:asc');
        expect(toDisplayedFilePaths('docs', FILES)).toEqual([
            '/docs/c.pdf',
            '/docs/a.pptx',
            '/docs/README',
            '/docs/a.pdf',
            '/docs/b.pdf',
        ]);
    });

    test('an unknown stored sort falls back to the list order', () => {
        state.settings.set('docs-list-sort', 'size:asc');
        expect(toDisplayedFilePaths('docs', FILES)).toEqual(FILES);
    });

    test('a single file is never filtered away', () => {
        state.settings.set('docs-list-filter-type', 'PPTX');
        expect(toDisplayedFilePaths('docs', ['/docs/a.pdf'])).toEqual([
            '/docs/a.pdf',
        ]);
    });
});

describe('useFileListFilterData', () => {
    let host: HTMLDivElement;
    let root: Root;
    let data: FileListFilterDataType;

    function ProbeComp({ settingName }: Readonly<{ settingName: string }>) {
        data = useFileListFilterData({ settingName } as any);
        return null;
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        host = document.createElement('div');
        document.body.append(host);
        root = createRoot(host);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
    });

    test('starts unsorted, unfiltered and with the search closed', async () => {
        await act(async () => root.render(<ProbeComp settingName="docs" />));
        expect(data.sortData).toEqual(DEFAULT_SORT_DATA);
        expect(data.filterTypeName).toBe('');
        expect(data.filterText).toBe('');
        expect(data.isSearchShowing).toBe(false);
    });

    test('restores the stored sort and type filter of its own list', async () => {
        state.settings.set('docs-list-sort', 'type:desc');
        state.settings.set('docs-list-filter-type', 'PDF');
        state.settings.set('other-list-sort', 'name:asc');
        await act(async () => root.render(<ProbeComp settingName="docs" />));
        expect(data.sortData).toEqual({ key: 'type', isAscending: false });
        expect(data.filterTypeName).toBe('PDF');
    });

    test('a new sort and type are stored; the search text is not', async () => {
        await act(async () => root.render(<ProbeComp settingName="docs" />));
        await act(async () =>
            data.setSortData({ key: 'name', isAscending: false }),
        );
        expect(state.settings.get('docs-list-sort')).toBe('name:desc');
        expect(data.sortData).toEqual({ key: 'name', isAscending: false });
        await act(async () =>
            data.setSortData({ key: 'type', isAscending: true }),
        );
        expect(state.settings.get('docs-list-sort')).toBe('type:asc');

        await act(async () => data.setFilterTypeName('PPTX'));
        expect(state.settings.get('docs-list-filter-type')).toBe('PPTX');

        await act(async () => {
            data.setFilterText('grace');
            data.setIsSearchShowing(true);
        });
        expect(data.filterText).toBe('grace');
        expect(data.isSearchShowing).toBe(true);
        expect([...state.settings.values()]).not.toContain('grace');
    });
});
