import { beforeEach, describe, expect, test, vi } from 'vitest';

const { fileSourceColorNotes, getFileSourceMock } = vi.hoisted(() => {
    const fileSourceColorNotes = new Map<string, string | null>();
    return {
        fileSourceColorNotes,
        getFileSourceMock: vi.fn((filePath: string) => {
            return {
                filePath,
                colorNote: fileSourceColorNotes.get(filePath) ?? null,
            };
        }),
    };
});

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: getFileSourceMock,
    },
}));

import type { BackgroundWebUrlSource } from './backgroundWebUrlHelpers';
import { genBackgroundWebColorSections } from './backgroundWebCompHelpers';

function createUrlSource(
    id: string,
    fullName: string,
    colorNote: string | null,
) {
    return {
        id,
        fullName,
        colorNote,
    } as BackgroundWebUrlSource;
}

describe('backgroundWebCompHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fileSourceColorNotes.clear();
    });

    test('merges file and URL color-note sections and keeps URL-only colors', () => {
        fileSourceColorNotes.set('/web/b.html', null);
        fileSourceColorNotes.set('/web/a.html', 'red');
        const redUrlSource = createUrlSource(
            'url-2',
            'https://a.example/page',
            'red',
        );
        const blueUrlSource = createUrlSource(
            'url-1',
            'https://z.example/page',
            'blue',
        );

        expect(
            genBackgroundWebColorSections(
                ['/web/b.html', '/web/a.html'],
                [blueUrlSource, redUrlSource],
            ),
        ).toEqual([
            {
                colorNote: 'blue',
                filePaths: [],
                urlSources: [blueUrlSource],
            },
            {
                colorNote: 'red',
                filePaths: ['/web/a.html'],
                urlSources: [redUrlSource],
            },
            {
                colorNote: 'unknown',
                filePaths: ['/web/b.html'],
                urlSources: [],
            },
        ]);
    });

    test('drops the color bar state when only one combined section has items', () => {
        fileSourceColorNotes.set('/web/a.html', 'red');
        const redUrlSource = createUrlSource(
            'url-1',
            'https://a.example/page',
            'red',
        );

        expect(
            genBackgroundWebColorSections(['/web/a.html'], [redUrlSource]),
        ).toEqual([
            {
                filePaths: ['/web/a.html'],
                urlSources: [redUrlSource],
            },
        ]);
    });
});
