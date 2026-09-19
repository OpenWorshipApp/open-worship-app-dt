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
    checkIsBookChapterName,
    checkIsMatchedName,
    checkIsResourceFileListed,
    checkIsSearchedName,
    compareResourceFiles,
    fromResourceTargetsKey,
    groupResourceFiles,
    invalidateResourcesScanCache,
    MAX_OTHER_MATCHES,
    MAX_SCAN_DEPTH,
    MAX_SEARCH_MATCHES,
    normalizeResourceSearchText,
    scanResourceFiles,
    toResourceIcon,
    toResourceMatchPatterns,
    toResourceNameParts,
    toResourceTargetsKey,
    checkIsBookLevelName,
} from './resourcesScanHelpers';

type FakeTreeType = { [dirPath: string]: string[] | Error };

const PSA_1 = [{ bookKey: 'PSA', chapter: 1 }];

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

function toPatternStrings(targets: { bookKey: string; chapter: number }[]) {
    return toResourceMatchPatterns(targets).map(({ pattern, isBookLevel }) => {
        return isBookLevel ? `[${pattern}]` : pattern;
    });
}

describe('toResourceMatchPatterns', () => {
    test('names both halves of what is searched', () => {
        expect(toPatternStrings(PSA_1)).toEqual(['PSA.1.*', '[PSA.0.*]']);
    });

    test('does not print the book-level half twice', () => {
        expect(toPatternStrings([{ bookKey: 'PSA', chapter: 0 }])).toEqual([
            '[PSA.0.*]',
        ]);
        expect(toPatternStrings([{ bookKey: 'PSA', chapter: -1 }])).toEqual([
            '[PSA.-1.*]',
        ]);
    });

    test('one chapter pattern per pane, then one book-level per book', () => {
        expect(
            toPatternStrings([
                { bookKey: 'GEN', chapter: 29 },
                { bookKey: 'PSA', chapter: 1 },
                { bookKey: 'GEN', chapter: 27 },
            ]),
        ).toEqual([
            'GEN.29.*',
            'PSA.1.*',
            'GEN.27.*',
            '[GEN.0.*]',
            '[PSA.0.*]',
        ]);
        expect(toPatternStrings([])).toEqual([]);
    });
});

describe('toResourceTargetsKey / fromResourceTargetsKey', () => {
    test('keeps pane order, drops repeats and round-trips', () => {
        const targets = [
            { bookKey: 'GEN', chapter: 29 },
            { bookKey: 'GEN', chapter: 27 },
            // Two panes on one chapter in two versions ask once.
            { bookKey: 'GEN', chapter: 29 },
            { bookKey: '1CH', chapter: -1 },
        ];
        const key = toResourceTargetsKey(targets);
        expect(key).toBe('GEN.29,GEN.27,1CH.-1');
        expect(fromResourceTargetsKey(key)).toEqual([
            { bookKey: 'GEN', chapter: 29 },
            { bookKey: 'GEN', chapter: 27 },
            { bookKey: '1CH', chapter: -1 },
        ]);
        expect(fromResourceTargetsKey('')).toEqual([]);
    });
});

describe('groupResourceFiles', () => {
    test('files each match under its pattern, in print order', () => {
        const targets = [
            { bookKey: 'GEN', chapter: 29 },
            { bookKey: 'GEN', chapter: 27 },
        ];
        const groupList = groupResourceFiles(
            [
                '/r/GEN.0.pdf',
                '/r/GEN.27.pdf',
                '/r/GEN.29.docx',
                '/r/sub/GEN.29.pdf',
            ],
            targets,
        );
        expect(
            groupList.map(({ pattern, filePaths }) => {
                return [pattern, filePaths];
            }),
        ).toEqual([
            ['GEN.29.*', ['/r/GEN.29.docx', '/r/sub/GEN.29.pdf']],
            ['GEN.27.*', ['/r/GEN.27.pdf']],
            // Listed ONCE, not once under each chapter of the book.
            ['GEN.0.*', ['/r/GEN.0.pdf']],
        ]);
    });

    test('a pattern nothing matched is left out', () => {
        expect(groupResourceFiles(['/r/GEN.27.pdf'], PSA_1)).toEqual([]);
        expect(
            groupResourceFiles(['/r/PSA.1.pdf'], PSA_1).map(({ pattern }) => {
                return pattern;
            }),
        ).toEqual(['PSA.1.*']);
    });
});

describe('checkIsBookLevelName', () => {
    test.each([
        ['PSA.0.pdf', true],
        ['PSA.-1.pdf', true],
        ['psa.0.PDF', true],
        ['PSA.1.pdf', false],
        // Not one of this book's files at all, so not book-level either.
        ['GEN.0.pdf', false],
        ['notes.pdf', false],
    ])('%s -> %s', (fileFullName, expected) => {
        expect(checkIsBookLevelName(fileFullName, 'PSA')).toBe(expected);
    });
});

describe('toResourceNameParts', () => {
    test.each([
        ['PSA.1.pdf', ['PSA.1', '.pdf']],
        ['PSA.1.notes.docx', ['PSA.1.notes', '.docx']],
        // No extension to peel off, and a dotfile is a name, not an extension.
        ['README', ['README', '']],
        ['.gitignore', ['.gitignore', '']],
    ])('%s -> %s', (fileFullName, expected) => {
        expect(toResourceNameParts(fileFullName)).toEqual(expected);
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
        ['a.md', 'markdown'],
        ['a.MARKDOWN', 'markdown'],
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
        const result = await scanResourceFiles('/root', PSA_1);
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
        const result = await scanResourceFiles('/root', PSA_1);
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
        const result = await scanResourceFiles('/root', PSA_1);
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
        const result = await scanResourceFiles('/root', PSA_1);
        // Depth 0 through MAX_SCAN_DEPTH inclusive get read; the folder one
        // below the last of those is never opened.
        expect(result?.filePaths).toHaveLength(MAX_SCAN_DEPTH + 1);
    });

    test('reads the folder and two levels under it, never a third', async () => {
        installTree({
            '/root': ['PSA.1.top.pdf', 'a/'],
            '/root/a': ['PSA.1.one.pdf', 'b/'],
            '/root/a/b': ['PSA.1.two.pdf', 'c/'],
            '/root/a/b/c': ['PSA.1.three.pdf'],
        });
        const result = await scanResourceFiles('/root', PSA_1);
        expect(result?.filePaths).toEqual([
            '/root/a/PSA.1.one.pdf',
            '/root/PSA.1.top.pdf',
            '/root/a/b/PSA.1.two.pdf',
        ]);
        expect(readdirMock).toHaveBeenCalledTimes(3);
        // Stopping at the depth is the design, not a budget running out.
        expect(result?.isTruncated).toBe(false);
    });

    test('a subfolder that cannot be read is skipped, not fatal', async () => {
        installTree({
            '/root': ['locked/', 'PSA.1.pdf'],
            '/root/locked': Object.assign(new Error('denied'), {
                code: 'EACCES',
            }),
        });
        const result = await scanResourceFiles('/root', PSA_1);
        expect(result?.filePaths).toEqual(['/root/PSA.1.pdf']);
    });

    test('an unreadable ROOT rejects so the box can say which failure', async () => {
        installTree({
            '/gone': Object.assign(new Error('missing'), { code: 'ENOENT' }),
        });
        await expect(scanResourceFiles('/gone', PSA_1)).rejects.toMatchObject({
            code: 'ENOENT',
        });
    });

    test('returns null and caches nothing when asked to stop', async () => {
        installTree({ '/root': ['PSA.1.pdf'] });
        const result = await scanResourceFiles(
            '/root',
            PSA_1,
            '',
            false,
            () => true,
        );
        expect(result).toBeNull();
        // A partial walk must not be served to the next caller as the answer.
        readdirMock.mockClear();
        await scanResourceFiles('/root', PSA_1);
        expect(readdirMock).toHaveBeenCalled();
    });

    test('caches per folder and prefix, and invalidation forces a re-read', async () => {
        installTree({ '/root': ['PSA.1.pdf', 'PSA.2.pdf'] });
        await scanResourceFiles('/root', PSA_1);
        expect(readdirMock).toHaveBeenCalledTimes(1);

        await scanResourceFiles('/root', PSA_1);
        expect(readdirMock).toHaveBeenCalledTimes(1);

        // A different verse is a different question.
        await scanResourceFiles('/root', [{ bookKey: 'PSA', chapter: 2 }]);
        expect(readdirMock).toHaveBeenCalledTimes(2);

        // So is the same verse with something typed in the search box.
        await scanResourceFiles('/root', PSA_1, 'psa');
        expect(readdirMock).toHaveBeenCalledTimes(3);

        invalidateResourcesScanCache('/root');
        await scanResourceFiles('/root', PSA_1);
        expect(readdirMock).toHaveBeenCalledTimes(4);
        // Invalidation has to reach the searched entries too, whatever was
        // typed when they were cached.
        await scanResourceFiles('/root', PSA_1, 'psa');
        expect(readdirMock).toHaveBeenCalledTimes(5);
    });

    test('every open chapter is found in ONE walk, whatever the pane order', async () => {
        installTree({
            '/root': ['GEN.0.pdf', 'GEN.27.pdf', 'GEN.29.pdf', 'GEN.30.pdf'],
        });
        const result = await scanResourceFiles('/root', [
            { bookKey: 'GEN', chapter: 29 },
            { bookKey: 'GEN', chapter: 27 },
        ]);
        expect(result?.filePaths).toEqual([
            '/root/GEN.0.pdf',
            '/root/GEN.27.pdf',
            '/root/GEN.29.pdf',
        ]);
        expect(readdirMock).toHaveBeenCalledTimes(1);
        // The panes swapped around is the same question, already answered.
        await scanResourceFiles('/root', [
            { bookKey: 'GEN', chapter: 27 },
            { bookKey: 'GEN', chapter: 29 },
        ]);
        expect(readdirMock).toHaveBeenCalledTimes(1);
    });

    test('nothing to look for reads no directory at all', async () => {
        installTree({ '/root': ['GEN.1.pdf'] });
        const result = await scanResourceFiles('/root', []);
        expect(result?.filePaths).toEqual([]);
        expect(readdirMock).not.toHaveBeenCalled();
        // ...unless something is typed, which is a question of its own.
        const searched = await scanResourceFiles('/root', [], 'gen');
        expect(searched?.searchedFilePaths).toEqual(['/root/GEN.1.pdf']);
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
        const result = await scanResourceFiles('/root', PSA_1, 'abc');
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
        const result = await scanResourceFiles('/root', PSA_1, 'psa');
        expect(result?.filePaths).toEqual(['/root/PSA.1.pdf']);
        expect(result?.searchedFilePaths).toEqual([]);
    });

    test('caps the searched half and says it did', async () => {
        const names = ['PSA.1.pdf'];
        for (let index = 0; index < MAX_SEARCH_MATCHES + 5; index++) {
            names.push(`abc-${index}.txt`);
        }
        installTree({ '/root': names });
        const result = await scanResourceFiles('/root', PSA_1, 'abc');
        expect(result?.searchedFilePaths).toHaveLength(MAX_SEARCH_MATCHES);
        expect(result?.isSearchTruncated).toBe(true);
        // Over the cap the walk carries on, so the verse matches -- what the
        // panel is actually for -- are still all there.
        expect(result?.filePaths).toEqual(['/root/PSA.1.pdf']);
    });

    test('an empty search text searches for nothing extra', async () => {
        installTree({ '/root': ['PSA.1.pdf', 'anything.txt'] });
        const result = await scanResourceFiles('/root', PSA_1, '   ');
        expect(result?.searchedFilePaths).toEqual([]);
    });
});

describe('checkIsBookChapterName', () => {
    test.each([
        ['GEN.4.pdf', true],
        ['gen.50.notes.docx', true],
        ['1CH.0.json', true],
        ['PSA.-1.pdf', true],
        // A book only the KJVD and Douay-Rheims models carry still counts.
        ['TOB.1.pdf', true],
        ['Jesus-family-line.jpeg', false],
        // Shaped like one, but `IMG` is no book.
        ['IMG.2.jpg', false],
        // A book, spelled the way no chapter is -- so it shows up somewhere.
        ['GEN.01.pdf', false],
        ['GEN.pdf', false],
        ['GEN.4', false],
        ['README', false],
        ['.GEN.4.pdf', false],
    ])('%s -> %s', (fileFullName, expected) => {
        expect(checkIsBookChapterName(fileFullName)).toBe(expected);
    });
});

describe('scanResourceFiles with Others', () => {
    const GEN_4 = [{ bookKey: 'GEN', chapter: 4 }];

    beforeEach(() => {
        invalidateResourcesScanCache();
    });

    test('lists the files named after no chapter, apart from the rest', async () => {
        installTree({
            '/root': [
                'GEN.4.pdf',
                'GEN.5.pdf',
                'Jesus-family-line.jpeg',
                'sub/',
            ],
            '/root/sub': ['map.png', 'IMG.2.jpg', 'GEN.01.pdf'],
        });
        const result = await scanResourceFiles('/root', GEN_4, '', true);
        expect(result?.filePaths).toEqual(['/root/GEN.4.pdf']);
        // `GEN.5.pdf` is another chapter's file, not an "other" one.
        expect(result?.otherFilePaths).toEqual([
            '/root/Jesus-family-line.jpeg',
            '/root/sub/IMG.2.jpg',
            '/root/sub/GEN.01.pdf',
            '/root/sub/map.png',
        ]);
        expect(result?.isOthersTruncated).toBe(false);
    });

    test('unticked, collects nothing extra', async () => {
        installTree({ '/root': ['GEN.4.pdf', 'Jesus-family-line.jpeg'] });
        const result = await scanResourceFiles('/root', GEN_4);
        expect(result?.otherFilePaths).toEqual([]);
    });

    test('a file the search found is listed there, not here', async () => {
        installTree({ '/root': ['GEN.4.pdf', 'jesus-map.png', 'church.png'] });
        const result = await scanResourceFiles('/root', GEN_4, 'jesus', true);
        expect(result?.searchedFilePaths).toEqual(['/root/jesus-map.png']);
        expect(result?.otherFilePaths).toEqual(['/root/church.png']);
    });

    test('is a cache entry of its own, dropped with its folder', async () => {
        installTree({ '/root': ['GEN.4.pdf', 'map.png'] });
        await scanResourceFiles('/root', GEN_4);
        const result = await scanResourceFiles('/root', GEN_4, '', true);
        // Ticking the box must not be answered by the unticked walk.
        expect(readdirMock).toHaveBeenCalledTimes(2);
        expect(result?.otherFilePaths).toEqual(['/root/map.png']);
        invalidateResourcesScanCache('/root');
        await scanResourceFiles('/root', GEN_4, '', true);
        expect(readdirMock).toHaveBeenCalledTimes(3);
    });

    test('still walks with no chapter open', async () => {
        installTree({ '/root': ['map.png'] });
        const result = await scanResourceFiles('/root', [], '', true);
        expect(result?.otherFilePaths).toEqual(['/root/map.png']);
    });

    test('caps the other files and says it did', async () => {
        const names = ['GEN.4.pdf'];
        for (let index = 0; index < MAX_OTHER_MATCHES + 5; index++) {
            names.push(`photo-${index}.jpg`);
        }
        installTree({ '/root': names });
        const result = await scanResourceFiles('/root', GEN_4, '', true);
        expect(result?.otherFilePaths).toHaveLength(MAX_OTHER_MATCHES);
        expect(result?.isOthersTruncated).toBe(true);
        // The chapter's own files are all still there past the cap.
        expect(result?.filePaths).toEqual(['/root/GEN.4.pdf']);
    });
});

describe('checkIsResourceFileListed', () => {
    const genesisFour = [{ bookKey: 'GEN', chapter: 4 }];

    test('a file named after an open chapter is drawn', () => {
        expect(
            checkIsResourceFileListed('GEN.4.pdf', genesisFour, '', false),
        ).toBe(true);
        // Book-level files show under every chapter of that book.
        expect(
            checkIsResourceFileListed('GEN.0.pdf', genesisFour, '', false),
        ).toBe(true);
    });

    test('a file named after nothing is drawn only with Others ticked', () => {
        expect(
            checkIsResourceFileListed('notes.docx', genesisFour, '', false),
        ).toBe(false);
        expect(
            checkIsResourceFileListed('notes.docx', genesisFour, '', true),
        ).toBe(true);
        // Named after a chapter that is NOT open: the Others list skips it
        // too, so it is drawn nowhere.
        expect(
            checkIsResourceFileListed('GEN.9.pdf', genesisFour, '', true),
        ).toBe(false);
    });

    test('the search box is a way in of its own', () => {
        expect(
            checkIsResourceFileListed('notes.docx', genesisFour, 'note', false),
        ).toBe(true);
        expect(
            checkIsResourceFileListed('notes.docx', genesisFour, 'map', false),
        ).toBe(false);
    });

    test('a hidden file is drawn by nothing at all', () => {
        expect(
            checkIsResourceFileListed('.GEN.4.pdf', genesisFour, '', true),
        ).toBe(false);
    });
});
