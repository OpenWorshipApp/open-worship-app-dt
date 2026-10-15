// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    open: vi.fn(),
    read: vi.fn(),
    close: vi.fn(),
    readFile: vi.fn(),
    listFiles: vi.fn(),
    downloaded: vi.fn(),
    input: vi.fn(),
    confirm: vi.fn(),
    keyInput: vi.fn(),
    language: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    model: {
        bookKeysOrder: ['GEN', 'EXO'],
        flippingKey: {} as Record<string, string>,
    },
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        fileUtils: {
            openSync: mocks.open,
            readSync: mocks.read,
            closeSync: mocks.close,
        },
        isPageScreen: false,
    },
}));
vi.mock('../../helper/FileSource', () => ({
    default: { readFileData: mocks.readFile },
}));
vi.mock('../../server/fileHelpers', () => ({
    fsListFiles: mocks.listFiles,
    pathJoin: (...parts: string[]) => parts.join('/'),
    checkIsHiddenName: (name: string) => name.startsWith('.'),
}));
vi.mock('../../helper/bible-helpers/BibleDataReader', () => ({
    bibleDataReader: { getWritableBiblePath: async () => '/bibles' },
}));
vi.mock('../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getDownloadedBibleInfoList: mocks.downloaded,
}));
vi.mock('../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: () => ({ GEN: 'Genesis', EXO: 'Exodus' }),
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    getBibleModelInfo: () => mocks.model,
}));
vi.mock('../../helper/helpers', () => ({
    cloneJson: (value: unknown) => JSON.parse(JSON.stringify(value)),
}));
vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getLangDataAsync: mocks.language,
    tran: (text: string) => text,
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: mocks.input,
    showAppConfirm: mocks.confirm,
}));
vi.mock('./bibleXMLAttributesGuessing', () => ({
    genBibleKeyXMLInput: mocks.keyInput,
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: mocks.error }));
vi.mock('../../helper/loggerHelpers', () => ({
    appLog: mocks.log,
    appWarning: vi.fn(),
}));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => Promise<unknown>) =>
        callback(),
    unlockingCacher: async (_key: string, callback: () => Promise<unknown>) =>
        callback(),
}));

import {
    bibleKeyToXMLFilePath,
    getAllXMLFileKeys,
    getBibleHeadInfoFromFile,
    getBibleInfoJson,
    getBibleKeyFromFile,
    jsonToXMLText,
    xmlTextToBibleElement,
    xmlTextToJson,
} from './bibleXMLJsonDataHelpers';
import { appXMLParser, appXMLSerializer } from '../../helper/xmlHelpers';

const book =
    '<book key="GEN"><chapter number="1"><verse number="1">In &amp; out &lt;light&gt;</verse></chapter></book>';

function head(text: string) {
    mocks.read.mockImplementation((_fd: number, buffer: Buffer) =>
        buffer.write(text),
    );
}

beforeEach(() => {
    mocks.open.mockReturnValue(17);
    head('<bible key="KJV" title="King James" locale="en-US">');
    mocks.readFile.mockResolvedValue(null);
    mocks.listFiles.mockResolvedValue([]);
    mocks.downloaded.mockResolvedValue([]);
    mocks.language.mockResolvedValue(null);
    mocks.model.flippingKey = {};
});

describe('Bible XML metadata and conversion', () => {
    test('reads aliases, numeric book indexes, maps and metadata without losing verse text', async () => {
        const result =
            await xmlTextToJson(`<bible abbr="TEST" name="Title" desc="Desc" version="3" locale="en-US" status="Public" publisher="Press" copyRights="Rights">
            <map><number-map key="1" value="១"/><number-map value="ignored"/><book-map key="GEN" value="First"/><book-map key="EXO"/></map>
            <testament><book id="1"><chapter index="1"><verse id="1">A &amp; B</verse><verse>skip</verse></chapter><chapter/></book></testament>
            <book key="EXO"><chapter number="2"><verse index="4">Second</verse></chapter></book>
            <book key="UNKNOWN"/><book number="bad"/><book number="99"/>
        </bible>`);
        expect(result?.info).toEqual({
            key: 'TEST',
            title: 'Title',
            description: 'Desc',
            version: 3,
            locale: 'en-US',
            legalNote: 'Public',
            publisher: 'Press',
            copyRights: 'Rights',
            keyBookMap: { GEN: 'First', EXO: 'Exodus' },
            booksAvailable: ['GEN', 'EXO'],
            numbersMap: {
                ...Object.fromEntries(
                    Array.from({ length: 10 }, (_, i) => [
                        String(i),
                        String(i),
                    ]),
                ),
                '1': '១',
            },
        });
        expect(result?.books).toEqual({
            GEN: { '1': { '1': 'A & B' } },
            EXO: { '2': { '4': 'Second' } },
        });
        expect(mocks.input).not.toHaveBeenCalled();
    });

    test('applies locale sanitization to a copy of model book names', async () => {
        mocks.language.mockResolvedValue({
            sanitizeText: (text: string) => text.toUpperCase(),
        });
        const info = await getBibleInfoJson('<bible key="T" version="bad"/>');
        expect(info).toMatchObject({
            version: 1,
            locale: 'en-US',
            keyBookMap: { GEN: 'GENESIS', EXO: 'EXODUS' },
            booksAvailable: [],
        });
        mocks.language.mockResolvedValue(null);
        expect(
            (await getBibleInfoJson('<bible key="U"/>'))?.keyBookMap.GEN,
        ).toBe('Genesis');
    });

    test('preview offers unique attribute tokens without prompting for a missing key', async () => {
        const choices = vi.fn();
        const result = await xmlTextToJson(
            `<bible title="First, First. Second">${book}</bible>`,
            { isImportPreview: true, onKeyChoices: choices },
        );
        expect(result?.info).toMatchObject({
            key: '',
            title: 'First, First. Second',
            version: 1,
        });
        expect(choices).toHaveBeenCalledWith(['First', 'Second']);
        expect(mocks.input).not.toHaveBeenCalled();
        expect(mocks.confirm).not.toHaveBeenCalled();
    });

    test.each([
        '<other/>',
        '<bible key="T"/>',
        '<bible key="T"><book key="GEN"/></bible>',
    ])('preview refuses an unusable Bible: %s', async (xml) => {
        expect(await xmlTextToJson(xml, { isImportPreview: true })).toBeNull();
        expect(mocks.input).not.toHaveBeenCalled();
    });

    test('round-trips maps, escaped verses, line breaks and JSON extras using the real serializer', async () => {
        const original = await xmlTextToJson(
            `<bible key="ROUND" title="A &amp; B">${book}</bible>`,
        );
        expect(original).not.toBeNull();
        const data = {
            ...original!,
            newLines: ['GEN 1:1', 'EXO 2:3'],
            newLinesTitleMap: {
                'GEN 1:1': [{ content: 'Title ]]> & <text>' }],
            },
            customVersesMap: {
                'GEN 1:1': [{ content: 'Custom & <verse>' }],
                'EXO 1:1': [],
            },
        };
        const xml = jsonToXMLText(data);
        expect(xml).toContain('In &amp; out &lt;light&gt;');
        expect(xml).toContain('<![CDATA[');
        expect(xml).toContain(']]&gt;');
        expect(await xmlTextToJson(xml!)).toEqual(data);
        expect(mocks.log).not.toHaveBeenCalled();
    });

    test('reads legacy extra tag names and isolates malformed JSON entries', async () => {
        const result = await xmlTextToJson(`<bible key="T">${book}
            <new_lines><item> GEN 1:1 </item><item> </item><item/></new_lines>
            <new_lines_title_map><item key="ok">[{"content":"Heading"}]</item><item key="empty">[]</item><item key="bad">{</item><item>[1]</item><item key="blank"/></new_lines_title_map>
            <customversesmap><item key="ok"><![CDATA[[{"content":"Verse"}]]]></item><item key="bad">{</item><item>[1]</item><item key="empty">[]</item></customversesmap>
        </bible>`);
        expect(result?.newLines).toEqual(['GEN 1:1']);
        expect(result?.newLinesTitleMap).toEqual({
            ok: [{ content: 'Heading' }],
        });
        expect(result?.customVersesMap).toEqual({
            ok: [{ content: 'Verse' }],
            empty: [],
        });
        expect(mocks.error).toHaveBeenCalledTimes(2);
    });

    test('supports model tag replacements and reports missing Bible roots', () => {
        mocks.model.flippingKey = { BIBLE: 'bible' };
        expect(
            xmlTextToBibleElement('<BIBLE key="T"/>')?.getAttribute('key'),
        ).toBe('T');
        expect(xmlTextToBibleElement('<other/>')).toBeNull();
    });

    test('rejects serialization when the emitted book count does not match', async () => {
        const data = await xmlTextToJson(`<bible key="T">${book}</bible>`);
        vi.spyOn(appXMLSerializer, 'serializeToString').mockReturnValue(
            '<bible/>',
        );
        expect(jsonToXMLText(data!)).toBeNull();
        expect(mocks.log).toHaveBeenCalledWith(
            expect.stringContaining('Books in JSON: 1'),
        );
    });

    test('parses a complete XML document once for all extractors', async () => {
        const parse = vi.spyOn(appXMLParser, 'parseFromString');
        expect(
            (await xmlTextToJson(`<bible key="T">${book}</bible>`))?.books.GEN[
                '1'
            ]['1'],
        ).toBe('In & out <light>');
        expect(parse).toHaveBeenCalledTimes(1);
    });
});

describe('bounded file reads and key lookup', () => {
    test('reads key, title and locale from one 4 KB head without a full read', async () => {
        expect(await getBibleHeadInfoFromFile('/bibles/kjv.xml')).toEqual({
            bibleKey: 'KJV',
            title: 'King James',
            locale: 'en-US',
        });
        expect(mocks.open).toHaveBeenCalledWith('/bibles/kjv.xml', 'r');
        expect(mocks.read).toHaveBeenCalledWith(
            17,
            expect.any(Buffer),
            0,
            4096,
            0,
        );
        expect(mocks.read).toHaveBeenCalledTimes(1);
        expect(mocks.close).toHaveBeenCalledWith(17);
        expect(mocks.readFile).not.toHaveBeenCalled();
        expect(mocks.input).not.toHaveBeenCalled();
    });

    test('falls back only for the key when the head cannot provide it', async () => {
        head('<bible title="Partial" locale="fr-FR">');
        mocks.readFile.mockResolvedValue('<bible key="FULL" title="Full"/>');
        expect(await getBibleHeadInfoFromFile('/bibles/partial.xml')).toEqual({
            bibleKey: 'FULL',
            title: 'Partial',
            locale: 'fr-FR',
        });
        expect(mocks.readFile).toHaveBeenCalledWith('/bibles/partial.xml');
        expect(mocks.input).not.toHaveBeenCalled();
    });

    test('falls back after failed open without closing an unopened descriptor', async () => {
        mocks.open.mockImplementation(() => {
            throw new Error('denied');
        });
        mocks.readFile.mockResolvedValue('<bible abbr="FALLBACK"/>');
        expect(await getBibleKeyFromFile('/bibles/error.xml')).toBe('FALLBACK');
        expect(mocks.close).not.toHaveBeenCalled();
    });

    test('closes a descriptor even when its read fails', async () => {
        mocks.read.mockImplementation(() => {
            throw new Error('read failed');
        });
        expect(
            await getBibleHeadInfoFromFile('/bibles/missing.xml'),
        ).toBeNull();
        expect(mocks.close).toHaveBeenCalledTimes(2);
        expect(mocks.input).not.toHaveBeenCalled();
    });

    test('lists visible XML files sequentially and skips files with no key', async () => {
        mocks.listFiles.mockResolvedValue([
            '.hidden.xml',
            'notes.txt',
            'first.XML',
            'empty.xml',
            'last.xml',
        ]);
        mocks.open.mockImplementation((path: string) => path);
        mocks.read.mockImplementation((path: string, buffer: Buffer) =>
            buffer.write(
                path.endsWith('empty.xml')
                    ? '<bible/>'
                    : `<bible key="${path.includes('first') ? 'FIRST' : 'LAST'}">`,
            ),
        );
        expect(await getAllXMLFileKeys()).toEqual({
            FIRST: '/bibles/first.XML',
            LAST: '/bibles/last.xml',
        });
        expect(mocks.open.mock.calls.map(([path]) => path)).toEqual([
            '/bibles/first.XML',
            '/bibles/empty.xml',
            '/bibles/last.xml',
        ]);
        expect(mocks.readFile).toHaveBeenCalledWith('/bibles/empty.xml');
    });

    test('resolves filename paths directly and controls missing-key error reporting', async () => {
        expect(await bibleKeyToXMLFilePath('NEW', true)).toBe(
            '/bibles/NEW.xml',
        );
        expect(mocks.listFiles).not.toHaveBeenCalled();
        mocks.listFiles.mockResolvedValue(['kjv.xml']);
        expect(await bibleKeyToXMLFilePath('KJV')).toBe('/bibles/kjv.xml');
        expect(await bibleKeyToXMLFilePath('MISSING', false, false)).toBeNull();
        expect(mocks.error).not.toHaveBeenCalled();
        expect(await bibleKeyToXMLFilePath('MISSING')).toBeNull();
        expect(mocks.error).toHaveBeenCalledWith(
            expect.stringContaining('"MISSING"'),
        );
    });
});

describe('missing-key confirmation', () => {
    test('stops when downloaded key information is unavailable', async () => {
        mocks.downloaded.mockResolvedValue(null);
        expect(await getBibleInfoJson('<bible/>')).toBeNull();
        expect(mocks.input).not.toHaveBeenCalled();
    });

    test('validates names and collisions before accepting a trimmed key', async () => {
        mocks.downloaded.mockResolvedValue([{ key: 'KJV' }]);
        let changeKey: (value: string) => void;
        mocks.keyInput.mockImplementation((_value, onChange) => {
            changeKey = onChange;
            return 'input';
        });
        mocks.input.mockImplementation(async (_title, _body, options) => {
            expect(options.canConfirm()).toBe(false);
            for (const invalid of ['kjv', '../bad', '   ']) {
                changeKey(invalid);
                expect(options.canConfirm()).toBe(false);
            }
            changeKey('  SAFE  ');
            expect(options.canConfirm()).toBe(true);
            return true;
        });
        mocks.confirm.mockResolvedValue(true);
        expect(
            (await getBibleInfoJson('<bible title="Candidate"/>'))?.key,
        ).toBe('SAFE');
        expect(mocks.keyInput).toHaveBeenCalledWith(
            '',
            expect.any(Function),
            ['KJV'],
            ['Candidate'],
        );
        expect(mocks.confirm).toHaveBeenCalledWith(
            'Confirm Key for Bible',
            'Do you want to continue with key="SAFE"?',
            expect.any(Object),
        );
    });

    test('retries a rejected key and allows confirmed cancellation', async () => {
        mocks.keyInput.mockImplementation((_value, onChange) => {
            onChange('FIRST');
            return 'input';
        });
        mocks.input.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        mocks.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        expect(await getBibleInfoJson('<bible/>')).toBeNull();
        expect(mocks.input).toHaveBeenCalledTimes(2);
        expect(mocks.confirm).toHaveBeenLastCalledWith(
            'Confirm Key for Bible',
            'Are you sure you want to quit?',
            expect.any(Object),
        );
    });
});
