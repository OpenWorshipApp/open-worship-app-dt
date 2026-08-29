import { beforeEach, describe, expect, test, vi } from 'vitest';

const { readdirMock } = vi.hoisted(() => ({
    readdirMock: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        fileUtils: { readdir: readdirMock },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (filePath: string) =>
                filePath.slice(filePath.lastIndexOf('/') + 1),
        },
    },
}));

import {
    checkIsMatchedName,
    checkIsSearchedName,
    compareResourceFiles,
    invalidateResourcesScanCache,
    MAX_SCAN_DEPTH,
    MAX_SEARCH_MATCHES,
    normalizeResourceSearchText,
    scanResourceFiles,
    toResourceIcon,
    toResourceMatchHint,
} from './resourcesScanHelpers';

type FakeTreeType = { [dirPath: string]: string[] | Error };

function installTree(tree: FakeTreeType) {
    readdirMock.mockImplementation(
        (dirPath: string, _options: any, callback: any) => {
            const entry = tree[dirPath];
            if (entry === undefined || entry instanceof Error) {
                const error =
                    entry ??
                    Object.assign(new Error('missing'), { code: 'ENOENT' });
                callback(error);
                return;
            }
            callback(
                null,
                entry.map((name) => {
                    // A trailing `/` marks a directory in these fixtures.
                    const isDirectory = name.endsWith('/');
                    return {
                        name: isDirectory ? name.slice(0, -1) : name,
                        isFile: () => !isDirectory,
                        isDirectory: () => isDirectory,
                    };
                }),
            );
        },
    );
}

describe('toResourceMatchHint', () => {
    test('names both halves of what is searched', () => {
        expect(toResourceMatchHint('PSA', 1)).toBe('PSA.1.* \u00b7 PSA.0.*');
    });

    test('does not print the book-level half twice', () => {
        expect(toResourceMatchHint('PSA', 0)).toBe('PSA.0.*');
        expect(toResourceMatchHint('PSA', -1)).toBe('PSA.-1.*');
    });
});

describe('checkIsMatchedName', () => {
    test.each([
        // -- the chapter's own files
        ['PSA.1.pdf', true],
        ['psa.1.PDF', true],
        ['PSA.1.notes.pdf', true],
        ['PSA.1.own', true],
        ['PSA.1.mp4', true],
        ['PSA.1.xyz', true],
        // -- book-level: chapter below 1 belongs to EVERY chapter of the book.
        // `0` is the one the library uses; the negatives are accepted the same
        // way so a second book-level document needs no code change.
        ['PSA.0.pdf', true],
        ['PSA.-1.pdf', true],
        ['PSA.-12.notes.pdf', true],
        // -- other chapters. A complete Psalms library holds every one of
        // these beside `PSA.1.pdf`, which is what the parse has to survive.
        ['PSA.10.pdf', false],
        ['PSA.100.pdf', false],
        ['PSA.149.pdf', false],
        ['PSA.2.pdf', false],
        // -- not this shape at all
        ['PSA.1', false],
        ['PSA.1.', false],
        ['PSA..pdf', false],
        ['PSA.01.pdf', false],
        ['PSA.1e2.pdf', false],
        ['PSA.-0.pdf', false],
        ['PSA.one.pdf', false],
        ['2 PSA.1.pdf', false],
        ['1CH.1.pdf', false],
        ['PSA.pdf', false],
    ])('%s -> %s', (fileFullName, expected) => {
        expect(checkIsMatchedName(fileFullName, 'PSA', 1)).toBe(expected);
    });

    test('a book-level chapter still matches its own book only', () => {
        expect(checkIsMatchedName('PSA.0.pdf', 'PSA', 0)).toBe(true);
        expect(checkIsMatchedName('PSA.0.pdf', '1CH', 0)).toBe(false);
    });
});

describe('compareResourceFiles', () => {
    test('groups by extension first', () => {
        const sorted = ['/d/b.pdf', '/d/a.zip', '/d/c.docx'].sort(
            compareResourceFiles,
        );
        expect(sorted).toEqual(['/d/c.docx', '/d/b.pdf', '/d/a.zip']);
    });

    test('sorts names numerically within one extension', () => {
        const sorted = [
            '/d/PSA.1.10.pdf',
            '/d/PSA.1.2.pdf',
            '/d/PSA.1.1.pdf',
        ].sort(compareResourceFiles);
        expect(sorted).toEqual([
            '/d/PSA.1.1.pdf',
            '/d/PSA.1.2.pdf',
            '/d/PSA.1.10.pdf',
        ]);
    });

    test('falls back to the full path for identical names', () => {
        expect(compareResourceFiles('/b/x.pdf', '/a/x.pdf')).toBeGreaterThan(0);
        expect(compareResourceFiles('/a/x.pdf', '/a/x.pdf')).toBe(0);
    });

    test('does not mistake a dotless name for its own extension', () => {
        // `getFileDotExtension` would return the WHOLE name here.
        expect(compareResourceFiles('/d/README', '/d/a.pdf')).toBeLessThan(0);
    });
});

describe('toResourceIcon', () => {
    test.each([
        ['a.pdf', 'file-earmark-pdf'],
        ['a.pptx', 'file-earmark-ppt'],
        ['a.docx', 'file-earmark-word'],
        ['a.own', 'journal-text'],
        ['a.PNG', 'file-earmark-image'],
        ['a.mp4', 'file-earmark-play'],
        ['a.zzz', 'question-diamond'],
        ['noextension', 'question-diamond'],
    ])('%s -> %s', (fileFullName, iconName) => {
        expect(toResourceIcon(fileFullName)[0]).toBe(iconName);
    });

    test('gives pdf the same tint the documents list uses', () => {
        expect(toResourceIcon('a.pdf')[1]).toBe('#bd0b02');
    });
});

describe('scanResourceFiles', () => {
    beforeEach(() => {
        // `mockReset: true` in vitest.config.ts already wipes the readdir
        // implementation before each test, so every test installs its own.
        invalidateResourcesScanCache();
    });

    test('finds matches in nested folders and sorts them', async () => {
        installTree({
            '/root': ['PSA.1.pdf', 'sub/', '.hidden/', 'PSA.10.pdf'],
            '/root/sub': ['deeper/', 'PSA.1.docx'],
            '/root/sub/deeper': ['PSA.1.zip', 'OTHER.2.pdf'],
        });
        const result = await scanResourceFiles('/root', 'PSA', 1);
        expect(result?.filePaths).toEqual([
            '/root/sub/PSA.1.docx',
            '/root/PSA.1.pdf',
            '/root/sub/deeper/PSA.1.zip',
        ]);
        expect(result?.isTruncated).toBe(false);
    });

    test('skips hidden entries and never descends into them', async () => {
        installTree({
            '/root': ['.PSA.1.pdf', '.git/'],
            '/root/.git': ['PSA.1.pdf'],
        });
        const result = await scanResourceFiles('/root', 'PSA', 1);
        expect(result?.filePaths).toEqual([]);
        expect(readdirMock).toHaveBeenCalledTimes(1);
    });

    test('ignores entries that are neither file nor directory', async () => {
        readdirMock.mockImplementation((_dirPath, _options, callback) => {
            callback(null, [
                {
                    name: 'PSA.1.pdf',
                    isFile: () => false,
                    isDirectory: () => false,
                },
            ]);
        });
        const result = await scanResourceFiles('/root', 'PSA', 1);
        expect(result?.filePaths).toEqual([]);
    });

    test('stops descending at MAX_SCAN_DEPTH', async () => {
        const tree: FakeTreeType = {};
        let dirPath = '/root';
        for (let index = 0; index <= MAX_SCAN_DEPTH + 2; index++) {
            tree[dirPath] = ['next/', `PSA.1.d${index}.pdf`];
            dirPath = `${dirPath}/next`;
        }
        installTree(tree);
        const result = await scanResourceFiles('/root', 'PSA', 1);
        // Depth 0 through MAX_SCAN_DEPTH inclusive get read; the folder one
        // below the last of those is never opened.
        expect(result?.filePaths).toHaveLength(MAX_SCAN_DEPTH + 1);
    });

    test('a subfolder that cannot be read is skipped, not fatal', async () => {
        installTree({
            '/root': ['locked/', 'PSA.1.pdf'],
            '/root/locked': Object.assign(new Error('denied'), {
                code: 'EACCES',
            }),
        });
        const result = await scanResourceFiles('/root', 'PSA', 1);
        expect(result?.filePaths).toEqual(['/root/PSA.1.pdf']);
    });

    test('an unreadable ROOT rejects so the box can say which failure', async () => {
        installTree({
            '/gone': Object.assign(new Error('missing'), { code: 'ENOENT' }),
        });
        await expect(
            scanResourceFiles('/gone', 'PSA', 1),
        ).rejects.toMatchObject({ code: 'ENOENT' });
    });

    test('returns null and caches nothing when asked to stop', async () => {
        installTree({ '/root': ['PSA.1.pdf'] });
        const result = await scanResourceFiles(
            '/root',
            'PSA',
            1,
            '',
            () => true,
        );
        expect(result).toBeNull();
        // A partial walk must not be served to the next caller as the answer.
        readdirMock.mockClear();
        await scanResourceFiles('/root', 'PSA', 1);
        expect(readdirMock).toHaveBeenCalled();
    });

    test('caches per folder and prefix, and invalidation forces a re-read', async () => {
        installTree({ '/root': ['PSA.1.pdf', 'PSA.2.pdf'] });
        await scanResourceFiles('/root', 'PSA', 1);
        expect(readdirMock).toHaveBeenCalledTimes(1);

        await scanResourceFiles('/root', 'PSA', 1);
        expect(readdirMock).toHaveBeenCalledTimes(1);

        // A different verse is a different question.
        await scanResourceFiles('/root', 'PSA', 2);
        expect(readdirMock).toHaveBeenCalledTimes(2);

        // So is the same verse with something typed in the search box.
        await scanResourceFiles('/root', 'PSA', 1, 'psa');
        expect(readdirMock).toHaveBeenCalledTimes(3);

        invalidateResourcesScanCache('/root');
        await scanResourceFiles('/root', 'PSA', 1);
        expect(readdirMock).toHaveBeenCalledTimes(4);
        // Invalidation has to reach the searched entries too, whatever was
        // typed when they were cached.
        await scanResourceFiles('/root', 'PSA', 1, 'psa');
        expect(readdirMock).toHaveBeenCalledTimes(5);
    });
});

describe('normalizeResourceSearchText', () => {
    test.each([
        ['  ABC  ', 'abc'],
        // `abc*` is how the user asked for "starting with abc"; a literal star
        // would match nothing.
        ['abc*', 'abc'],
        ['*abc*', 'abc'],
        ['**abc**', 'abc'],
        // Anything else stays literal -- this is a substring search.
        ['a*c', 'a*c'],
        ['   ', ''],
        ['*', ''],
    ])('%s -> %s', (input, expected) => {
        expect(normalizeResourceSearchText(input)).toBe(expected);
    });
});

describe('checkIsSearchedName', () => {
    test.each([
        ['abc.pdf', true],
        ['01-ABC-notes.docx', true],
        ['xabcx.mp4', true],
        ['ab.pdf', false],
    ])('%s -> %s', (fileFullName, expected) => {
        expect(checkIsSearchedName(fileFullName, 'abc')).toBe(expected);
    });
});

describe('scanResourceFiles with a search text', () => {
    beforeEach(() => {
        invalidateResourcesScanCache();
    });

    test('appends name matches without disturbing the verse matches', async () => {
        installTree({
            '/root': ['PSA.1.pdf', 'sub/', 'nothing.txt'],
            '/root/sub': ['abc-notes.docx', 'ABC.mp4'],
        });
        const result = await scanResourceFiles('/root', 'PSA', 1, 'abc');
        // The verse half is untouched by what was typed.
        expect(result?.filePaths).toEqual(['/root/PSA.1.pdf']);
        // The extra half is its own list, sorted the same way.
        expect(result?.searchedFilePaths).toEqual([
            '/root/sub/abc-notes.docx',
            '/root/sub/ABC.mp4',
        ]);
        expect(result?.isSearchTruncated).toBe(false);
    });

    test('a file that is both is listed once, as a verse match', async () => {
        installTree({ '/root': ['PSA.1.pdf'] });
        const result = await scanResourceFiles('/root', 'PSA', 1, 'psa');
        expect(result?.filePaths).toEqual(['/root/PSA.1.pdf']);
        expect(result?.searchedFilePaths).toEqual([]);
    });

    test('caps the searched half and says it did', async () => {
        const names = ['PSA.1.pdf'];
        for (let index = 0; index < MAX_SEARCH_MATCHES + 5; index++) {
            names.push(`abc-${index}.txt`);
        }
        installTree({ '/root': names });
        const result = await scanResourceFiles('/root', 'PSA', 1, 'abc');
        expect(result?.searchedFilePaths).toHaveLength(MAX_SEARCH_MATCHES);
        expect(result?.isSearchTruncated).toBe(true);
        // Over the cap the walk carries on, so the verse matches -- what the
        // panel is actually for -- are still all there.
        expect(result?.filePaths).toEqual(['/root/PSA.1.pdf']);
    });

    test('an empty search text searches for nothing extra', async () => {
        installTree({ '/root': ['PSA.1.pdf', 'anything.txt'] });
        const result = await scanResourceFiles('/root', 'PSA', 1, '   ');
        expect(result?.searchedFilePaths).toEqual([]);
    });
});
