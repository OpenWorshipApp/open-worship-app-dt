import { beforeEach, describe, expect, test, vi } from 'vitest';

const { statMock, readFileMock, openExternalURLMock } = vi.hoisted(() => ({
    statMock: vi.fn(),
    readFileMock: vi.fn(),
    openExternalURLMock: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        fileUtils: { stat: statMock, readFile: readFileMock },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (filePath: string) =>
                filePath.slice(filePath.lastIndexOf('/') + 1),
        },
        browserUtils: { openExternalURL: openExternalURLMock },
    },
}));

// `tran` reads the locale out of the settings store, which otherwise walks all
// the way down to IPC. With nothing stored it short-circuits to English.
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

import {
    checkIsOpenableResourceUrl,
    checkIsResourceLinkList,
    checkIsResourceLinksName,
    MAX_RESOURCE_LINKS,
    MAX_RESOURCE_LINKS_FILE_SIZE,
    openResourceLinkUrl,
    parseResourceLinks,
    readResourceLinks,
    toResourceLinkHostLabel,
} from './resourceLinksHelpers';

function genLinksText(links: any) {
    return JSON.stringify(links);
}

describe('checkIsResourceLinksName', () => {
    test('only a .json is read as a link list', () => {
        expect(checkIsResourceLinksName('GEN.0.json')).toBe(true);
        // However the user typed the extension: the panel matches file names
        // case-insensitively everywhere else too.
        expect(checkIsResourceLinksName('GEN.0.JSON')).toBe(true);
        expect(checkIsResourceLinksName('GEN.0.pdf')).toBe(false);
        expect(checkIsResourceLinksName('GEN.0.json.pdf')).toBe(false);
        // A dotfile is a NAME, not an extension -- `.json` alone is not a
        // link list, it is a file called `.json`.
        expect(checkIsResourceLinksName('.json')).toBe(false);
        expect(checkIsResourceLinksName('json')).toBe(false);
    });
});

describe('checkIsOpenableResourceUrl', () => {
    test('http and https only', () => {
        expect(checkIsOpenableResourceUrl('https://youtu.be/abc')).toBe(true);
        expect(checkIsOpenableResourceUrl('http://example.com')).toBe(true);
        // Decided on the CANONICAL scheme, so casing cannot smuggle one past.
        expect(checkIsOpenableResourceUrl('HTTPS://example.com')).toBe(true);
    });
    test('every other scheme is refused', () => {
        // `openExternalURL` is `shell.openExternal`, which launches whatever
        // application has registered a scheme -- so a data file must never be
        // able to name one.
        for (const url of [
            'file:///C:/Windows/System32/cmd.exe',
            'javascript:alert(1)',
            'mailto:someone@example.com',
            'smb://server/share',
            'owa://local/presenter.html',
            'data:text/html,<h1>hi</h1>',
            'not a url at all',
            '',
        ]) {
            expect(checkIsOpenableResourceUrl(url)).toBe(false);
        }
    });
});

describe('parseResourceLinks', () => {
    test('the default schema: an array of title and url', () => {
        const result = parseResourceLinks(
            genLinksText([
                { title: 'Old Testament', url: 'https://youtu.be/one' },
                { title: '1-2 Chronicles', url: 'https://youtu.be/two' },
            ]),
        );
        expect(result.failureReason).toBeNull();
        expect(result.droppedCount).toBe(0);
        expect(result.isTruncated).toBe(false);
        expect(result.links).toEqual([
            { title: 'Old Testament', url: 'https://youtu.be/one' },
            { title: '1-2 Chronicles', url: 'https://youtu.be/two' },
        ]);
    });
    test('a bare url string titles itself', () => {
        const result = parseResourceLinks(genLinksText(['https://a.example']));
        expect(result.links).toEqual([
            { title: 'https://a.example', url: 'https://a.example' },
        ]);
    });
    test('a blank or missing title falls back to the url', () => {
        // A row with nothing to read would be a row nobody can press.
        const result = parseResourceLinks(
            genLinksText([
                { url: 'https://a.example' },
                { title: '   ', url: 'https://b.example' },
            ]),
        );
        expect(
            result.links.map(({ title }) => {
                return title;
            }),
        ).toEqual(['https://a.example', 'https://b.example']);
        expect(result.droppedCount).toBe(0);
    });
    test('titles and urls are trimmed', () => {
        const result = parseResourceLinks(
            genLinksText([
                { title: '  Overview  ', url: '  https://a.example  ' },
            ]),
        );
        expect(result.links).toEqual([
            { title: 'Overview', url: 'https://a.example' },
        ]);
    });
    test('an entry the schema cannot read is dropped and COUNTED', () => {
        const result = parseResourceLinks(
            genLinksText([
                { title: 'Good', url: 'https://a.example' },
                { title: 'No url' },
                { title: 'Wrong scheme', url: 'file:///etc/passwd' },
                42,
                null,
                { title: 'Also good', url: 'https://b.example' },
            ]),
        );
        expect(result.failureReason).toBeNull();
        expect(
            result.links.map(({ title }) => {
                return title;
            }),
        ).toEqual(['Good', 'Also good']);
        // Named rather than hidden: a file with a typo in one row otherwise
        // just shows fewer rows than the person who wrote it can count.
        expect(result.droppedCount).toBe(4);
    });
    test('broken JSON and a non-array are the same answer', () => {
        for (const text of ['', 'not json', '{ "url": "https://a.example" }']) {
            const result = parseResourceLinks(text);
            expect(result.failureReason).toBe('not-a-list');
            expect(result.links).toEqual([]);
            expect(result.droppedCount).toBe(0);
        }
    });
    test('an empty array parses -- it is not an error', () => {
        const result = parseResourceLinks('[]');
        expect(result.failureReason).toBeNull();
        expect(result.links).toEqual([]);
        // ...but it is not a link list either: see `checkIsResourceLinkList`.
        expect(checkIsResourceLinkList(result)).toBe(false);
    });
    test('the tail past the cap is cut, not called malformed', () => {
        const entries = Array.from(
            { length: MAX_RESOURCE_LINKS + 5 },
            (_, index) => {
                return {
                    title: `#${index}`,
                    url: `https://a.example/${index}`,
                };
            },
        );
        const result = parseResourceLinks(genLinksText(entries));
        expect(result.links).toHaveLength(MAX_RESOURCE_LINKS);
        expect(result.isTruncated).toBe(true);
        // The tail was never looked at, so nothing there is "not understood".
        expect(result.droppedCount).toBe(0);
    });
});

describe('checkIsResourceLinkList', () => {
    test('one openable link is the bar', () => {
        expect(
            checkIsResourceLinkList(
                parseResourceLinks(
                    genLinksText([{ title: 'A', url: 'https://a.example' }]),
                ),
            ),
        ).toBe(true);
    });
    test('anything with no openable link is an ordinary file', () => {
        // The row then draws and behaves exactly as a `.pdf` row does: no
        // chevron, and a press hands it to the machine's own application.
        for (const text of [
            'not json',
            '{}',
            '[]',
            genLinksText([{ title: 'No url' }]),
            genLinksText([
                { title: 'Wrong scheme', url: 'file:///etc/passwd' },
            ]),
        ]) {
            expect(checkIsResourceLinkList(parseResourceLinks(text))).toBe(
                false,
            );
        }
    });
});

describe('toResourceLinkHostLabel', () => {
    test('says where the press goes', () => {
        expect(toResourceLinkHostLabel('https://youtu.be/abc')).toBe(
            'youtu.be',
        );
        expect(toResourceLinkHostLabel('https://www.example.com/a')).toBe(
            'example.com',
        );
        expect(toResourceLinkHostLabel('nonsense')).toBe('');
    });
});

describe('readResourceLinks', () => {
    beforeEach(() => {
        statMock.mockReset();
        readFileMock.mockReset();
    });
    function mockFile(size: number, text: string | Error) {
        statMock.mockImplementation((_filePath: string, callback: any) => {
            callback(null, { size, isFile: () => true });
        });
        readFileMock.mockImplementation(
            (_filePath: string, _options: any, callback: any) => {
                if (text instanceof Error) {
                    callback(text);
                    return;
                }
                callback(null, text);
            },
        );
    }
    test('reads and parses a link list', async () => {
        const text = genLinksText([
            { title: 'Overview', url: 'https://a.example' },
        ]);
        mockFile(text.length, text);
        const result = await readResourceLinks('/shelf/GEN.0.json');
        expect(result.failureReason).toBeNull();
        expect(result.links).toEqual([
            { title: 'Overview', url: 'https://a.example' },
        ]);
    });
    test('a file too big is never read at all', async () => {
        mockFile(MAX_RESOURCE_LINKS_FILE_SIZE + 1, '[]');
        const result = await readResourceLinks('/shelf/GEN.0.json');
        expect(result.failureReason).toBe('too-large');
        // The point of the cap is not to read the bytes -- `JSON.parse` has no
        // incremental mode.
        expect(readFileMock).not.toHaveBeenCalled();
    });
    test('an unreadable file is a message, never a throw', async () => {
        // One broken file among twenty good ones must not take the panel down.
        statMock.mockImplementation((_filePath: string, callback: any) => {
            callback(Object.assign(new Error('nope'), { code: 'ENOENT' }));
        });
        const result = await readResourceLinks('/shelf/GEN.0.json');
        expect(result.failureReason).toBe('unreadable');
    });
    test('a read that fails after the size check is a message too', async () => {
        mockFile(10, new Error('EACCES'));
        const result = await readResourceLinks('/shelf/GEN.0.json');
        expect(result.failureReason).toBe('unreadable');
    });
});

describe('openResourceLinkUrl', () => {
    beforeEach(() => {
        openExternalURLMock.mockReset();
    });
    test('hands an http(s) link to the system browser', () => {
        expect(openResourceLinkUrl('https://a.example')).toBe(true);
        expect(openExternalURLMock).toHaveBeenCalledWith('https://a.example');
    });
    test('refuses anything else, and opens NOTHING', () => {
        // The last place a scheme can be refused: this is the call with
        // `shell.openExternal` behind it.
        expect(openResourceLinkUrl('file:///C:/Windows/System32/cmd.exe')).toBe(
            false,
        );
        expect(openExternalURLMock).not.toHaveBeenCalled();
    });
});
