// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

// `appProvider` touches `document` and its provider source at module load, and
// `fileHelpers` reaches it for the path separator -- see the memory
// `appprovider-mock-node-env`.
vi.mock('../server/appProvider', () => {
    return {
        default: {
            isPageScreen: false,
            isDesktop: true,
            systemUtils: { isDev: false, isWindows: false, isMac: false },
            pathUtils: {
                sep: '/',
                join: (...paths: string[]) => {
                    return paths.join('/');
                },
                basename: (filePath: string) => {
                    return filePath.split('/').pop() ?? '';
                },
            },
        } as any,
    };
});

const settingMap = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => {
    return {
        getSetting: (key: string) => {
            return settingMap.get(key) ?? null;
        },
        useStateSettingString: () => {
            return ['', () => {}];
        },
    };
});

vi.mock('../helper/colorNoteHelpers', () => {
    return {
        genFilePathColorMap: (filePaths: string[]) => {
            const colorMap: { [key: string]: string[] } = { unknown: [] };
            for (const filePath of filePaths) {
                const colorNote = colorNoteMap.get(filePath) ?? 'unknown';
                colorMap[colorNote] = colorMap[colorNote] ?? [];
                colorMap[colorNote].push(filePath);
            }
            return colorMap;
        },
        genColorNoteDataList: (colorMap: { [key: string]: string[] }) => {
            const colorNotes = Object.keys(colorMap)
                .filter((key) => {
                    return key !== 'unknown';
                })
                .sort((key1, key2) => {
                    return key1.localeCompare(key2);
                });
            colorNotes.push('unknown');
            return colorNotes;
        },
    };
});

const colorNoteMap = new Map<string, string>();

const { toDisplayedFilePaths } = await import('./fileListFilterHelpers');

// The order Windows' own `readdir` hands this folder back in -- `1_cv.mp4`
// lands between `19_cv.mp4` and `20_cv.mp4`, which is what made a slide show
// walking it jump over `10_cv.mp4`.
const RAW_FILE_PATHS = [
    '/videos/10_cv.mp4',
    '/videos/19_cv.mp4',
    '/videos/1_cv.mp4',
    '/videos/20_cv.mp4',
    '/videos/2_cv.mp4',
];

function sortMediaFilePaths(filePaths: string[]) {
    return [...filePaths].sort((filePath1, filePath2) => {
        return filePath1.localeCompare(filePath2);
    });
}

describe('toDisplayedFilePaths', () => {
    beforeEach(() => {
        settingMap.clear();
        colorNoteMap.clear();
    });

    it('should follow the grid order, not the directory order', () => {
        const filePaths = toDisplayedFilePaths(
            'select-dir-video-bg',
            RAW_FILE_PATHS,
            sortMediaFilePaths,
        );
        expect(filePaths).toEqual([
            '/videos/1_cv.mp4',
            '/videos/10_cv.mp4',
            '/videos/19_cv.mp4',
            '/videos/2_cv.mp4',
            '/videos/20_cv.mp4',
        ]);
        const index = filePaths.indexOf('/videos/1_cv.mp4');
        expect(filePaths[index + 1]).toBe('/videos/10_cv.mp4');
    });

    it('should not reorder the list it was handed', () => {
        const filePaths = [...RAW_FILE_PATHS];
        toDisplayedFilePaths(
            'select-dir-video-bg',
            filePaths,
            sortMediaFilePaths,
        );
        expect(filePaths).toEqual(RAW_FILE_PATHS);
    });

    it('should honour a sort the operator picked', () => {
        settingMap.set('select-dir-video-bg-list-sort', 'name:desc');
        expect(
            toDisplayedFilePaths(
                'select-dir-video-bg',
                RAW_FILE_PATHS,
                sortMediaFilePaths,
            ),
        ).toEqual([
            '/videos/20_cv.mp4',
            '/videos/2_cv.mp4',
            '/videos/19_cv.mp4',
            '/videos/10_cv.mp4',
            '/videos/1_cv.mp4',
        ]);
    });

    it('should leave out what the type filter hides', () => {
        settingMap.set('select-dir-video-bg-list-filter-type', 'MP4');
        expect(
            toDisplayedFilePaths(
                'select-dir-video-bg',
                [...RAW_FILE_PATHS, '/videos/a.webm'],
                sortMediaFilePaths,
            ),
        ).not.toContain('/videos/a.webm');
    });

    it('should walk colour groups the way the list draws them', () => {
        colorNoteMap.set('/videos/20_cv.mp4', '#ff0000');
        colorNoteMap.set('/videos/10_cv.mp4', '#ff0000');
        expect(
            toDisplayedFilePaths(
                'select-dir-video-bg',
                RAW_FILE_PATHS,
                sortMediaFilePaths,
            ),
        ).toEqual([
            '/videos/10_cv.mp4',
            '/videos/20_cv.mp4',
            '/videos/1_cv.mp4',
            '/videos/19_cv.mp4',
            '/videos/2_cv.mp4',
        ]);
    });
});
