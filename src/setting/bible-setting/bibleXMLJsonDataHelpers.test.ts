// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const fileTexts = new Map<string, string>();

    class CacheManagerMock<T> {
        private readonly store = new Map<string, T>();

        async get(key: string) {
            return this.store.get(key) ?? null;
        }

        async has(key: string) {
            return this.store.has(key);
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }
    }

    return {
        CacheManagerMock,
        fileTexts,
        fsListFilesMock: vi.fn(),
        getDownloadedBibleInfoListMock: vi.fn(),
        getLangDataAsyncMock: vi.fn(),
        getModelKeyBookMapMock: vi.fn(),
        getWritableBiblePathMock: vi.fn(),
        getBibleModelInfoMock: vi.fn(),
        handleErrorMock: vi.fn(),
        readFileDataMock: vi.fn(async (filePath: string) => {
            return fileTexts.get(filePath) ?? null;
        }),
        reset() {
            fileTexts.clear();
        },
        showAppConfirmMock: vi.fn(),
        showAppInputMock: vi.fn(),
        unlockingCacherMock: vi.fn(
            async (
                key: string,
                callback: () => Promise<unknown>,
                cache: CacheManagerMock<unknown>,
                shouldCache: boolean,
            ) => {
                if (shouldCache && (await cache.has(key))) {
                    return await cache.get(key);
                }
                const value = await callback();
                if (shouldCache && value !== null) {
                    await cache.set(key, value);
                }
                return value;
            },
        ),
    };
});

vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getLangDataAsync: mocks.getLangDataAsyncMock,
    tran: (text: string) => text,
}));

vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.showAppConfirmMock,
    showAppInput: mocks.showAppInputMock,
}));

vi.mock('./bibleXMLAttributesGuessing', () => ({
    genBibleKeyXMLInput: (
        key: string,
        onChange: (newKey: string) => void,
        takenBibleKeys: string[],
        guessingKeys: string[],
    ) => ({ props: { key, onChange, takenBibleKeys, guessingKeys } }),
}));

vi.mock('../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getDownloadedBibleInfoList: mocks.getDownloadedBibleInfoListMock,
}));

vi.mock('../../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));

vi.mock('../../helper/bible-helpers/BibleDataReader', () => ({
    bibleDataReader: {
        getWritableBiblePath: mocks.getWritableBiblePathMock,
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    fsListFiles: mocks.fsListFilesMock,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        readFileData: mocks.readFileDataMock,
    },
}));

vi.mock('../../others/CacheManager', () => ({
    default: mocks.CacheManagerMock,
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlockingCacher: mocks.unlockingCacherMock,
}));

vi.mock('../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: mocks.getModelKeyBookMapMock,
}));

vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    getBibleModelInfo: mocks.getBibleModelInfoMock,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

async function loadModule() {
    return await import('./bibleXMLJsonDataHelpers');
}

describe('bibleXMLJsonDataHelpers', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mocks.reset();

        mocks.getLangDataAsyncMock.mockResolvedValue({
            sanitizeText: (text: string) => text.trim().toUpperCase(),
        });
        mocks.getDownloadedBibleInfoListMock.mockResolvedValue([]);
        mocks.getModelKeyBookMapMock.mockReturnValue({
            EXO: ' Exodus ',
            GEN: ' Genesis ',
            REV: ' Revelation ',
        });
        mocks.getWritableBiblePathMock.mockResolvedValue('/bibles');
        mocks.getBibleModelInfoMock.mockReturnValue({
            bookKeysOrder: ['GEN', 'EXO', 'REV'],
            flippingKey: {
                __REV__: 'REV',
            },
        });
        mocks.fsListFilesMock.mockResolvedValue([]);
        mocks.showAppConfirmMock.mockResolvedValue(true);
        mocks.showAppInputMock.mockResolvedValue(false);
    });

    test('parses bible elements, applies flipping keys, and handles missing bible roots', async () => {
        const { xmlTextToBibleElement } = await loadModule();

        const bibleElement = xmlTextToBibleElement(
            '<?xml version="1.0"?><bible><book key="__REV__"><chapter number="1"><verse number="1">Text</verse></chapter></book></bible>',
        );

        expect(
            bibleElement?.getElementsByTagName('book')[0]?.getAttribute('key'),
        ).toBe('REV');
        expect(
            xmlTextToBibleElement('<?xml version="1.0"?><root />'),
        ).toBeNull();
    });

    test('optimizes hinted XML parses while preserving requested text and element attributes', async () => {
        const { xmlTextToBibleElement } = await loadModule();
        const { appXMLParser } = await import('../../helper/xmlHelpers');
        const parsedXMLTexts: string[] = [];
        const originalParseFromString =
            appXMLParser.parseFromString.bind(appXMLParser);
        const parseSpy = vi
            .spyOn(appXMLParser, 'parseFromString')
            .mockImplementation((xmlText, contentType) => {
                parsedXMLTexts.push(xmlText);
                return originalParseFromString(xmlText, contentType);
            });

        try {
            const largeVerseText = 'In the beginning '.repeat(1000);
            const xmlText =
                '<bible key="KJV" title="Test Bible">' +
                '<map><book-map key="GEN" value="Genesis" /></map>' +
                '<book key="GEN"><chapter number="1">' +
                `<verse number="1">${largeVerseText}</verse>` +
                '</chapter></book>' +
                '<new-lines><item>GEN 1:1</item></new-lines>' +
                '</bible>';

            const bibleElement = xmlTextToBibleElement(xmlText, {
                childTags: ['new-lines'],
            });

            expect(bibleElement?.getAttribute('key')).toBe('KJV');
            expect(
                bibleElement?.getElementsByTagName('item')[0]?.textContent,
            ).toBe('GEN 1:1');
            expect(bibleElement?.getElementsByTagName('book')).toHaveLength(0);
            expect(parsedXMLTexts[0]).not.toContain('<book');
            expect(parsedXMLTexts[0]).not.toContain(largeVerseText);
            expect(parsedXMLTexts[0].length).toBeLessThan(xmlText.length);

            parsedXMLTexts.length = 0;
            const bibleRootElement = xmlTextToBibleElement(xmlText, {
                keys: ['key'],
            });

            expect(bibleRootElement?.getAttribute('title')).toBe('Test Bible');
            expect(bibleRootElement?.getElementsByTagName('book')).toHaveLength(
                0,
            );
            expect(parsedXMLTexts[0]).not.toContain('<book');
        } finally {
            parseSpy.mockRestore();
        }
    });

    test('extracts bible info with defaults and supports prompting for a missing key', async () => {
        const { getBibleInfoJson } = await loadModule();

        mocks.showAppInputMock.mockImplementationOnce(
            async (_title, element) => {
                element.props.onChange('WEB');
                return true;
            },
        );

        const result = await getBibleInfoJson(
            '<bible locale="en-US"><book number="1"><chapter number="1">' +
                '<verse number="1">One</verse></chapter></book></bible>',
        );

        expect(result).toEqual({
            booksAvailable: ['GEN'],
            copyRights: 'Unknown Copy Rights',
            description: 'Unknown Description',
            key: 'WEB',
            keyBookMap: {
                EXO: 'EXODUS',
                GEN: 'GENESIS',
                REV: 'REVELATION',
            },
            legalNote: 'Unknown Legal Note',
            locale: 'en-US',
            numbersMap: {
                0: '0',
                1: '1',
                2: '2',
                3: '3',
                4: '4',
                5: '5',
                6: '6',
                7: '7',
                8: '8',
                9: '9',
            },
            publisher: 'Unknown Publisher',
            title: 'Unknown Title',
            version: 1,
        });
        expect(mocks.showAppInputMock).toHaveBeenCalledTimes(1);
        expect(mocks.showAppConfirmMock).toHaveBeenCalledTimes(1);
    });

    test('extracts bible info without parsing full book text', async () => {
        const { getBibleInfoJson } = await loadModule();
        const { appXMLParser } = await import('../../helper/xmlHelpers');
        const parsedXMLTexts: string[] = [];
        const originalParseFromString =
            appXMLParser.parseFromString.bind(appXMLParser);
        const parseSpy = vi
            .spyOn(appXMLParser, 'parseFromString')
            .mockImplementation((xmlText, contentType) => {
                parsedXMLTexts.push(xmlText);
                return originalParseFromString(xmlText, contentType);
            });

        try {
            const largeVerseText = 'In the beginning '.repeat(1000);
            const xmlText =
                '<bible key="KJV" locale="en-US">' +
                '<book key="GEN"><chapter number="1">' +
                `<verse number="1">${largeVerseText}</verse>` +
                '</chapter></book>' +
                '</bible>';

            const result = await getBibleInfoJson(xmlText);

            expect(result?.booksAvailable).toEqual(['GEN']);
            expect(
                parsedXMLTexts.some((parsedXMLText) => {
                    return parsedXMLText.includes(largeVerseText);
                }),
            ).toBe(false);
        } finally {
            parseSpy.mockRestore();
        }
    });

    test('defaults malformed bible versions to version 1', async () => {
        const { getBibleInfoJson } = await loadModule();

        const result = await getBibleInfoJson(
            '<bible key="BAD" version="next"><book number="1"><chapter number="1">' +
                '<verse number="1">One</verse></chapter></book></bible>',
        );

        expect(result?.version).toBe(1);
    });

    test('converts XML text to JSON including maps, verses, and extra metadata', async () => {
        const { xmlTextToJson } = await loadModule();
        const xmlText = `<?xml version="1.0"?>
<bible key="KJV" locale="km-KH" title="Test Bible" description="Desc" version="2" legalNote="Legal" publisher="Pub" copyRights="Copy">
    <map>
        <book-map key="GEN" value=" Genesis "/>
        <number-map key="1" value="១"/>
    </map>
    <book number="1">
        <chapter number="1">
            <verse number="1">In the beginning</verse>
        </chapter>
    </book>
    <book key="EXO">
        <chapter number="2">
            <verse id="3">Let my people go</verse>
        </chapter>
    </book>
    <new-lines>
        <item>GEN 1:1</item>
        <item>   </item>
    </new-lines>
    <new-lines-title-map>
        <item key="GEN 1:1">[{"content":"Title"}]</item>
        <item key="GEN 1:2">bad-json</item>
    </new-lines-title-map>
    <custom-verses-map>
        <item key="EXO 2:3">[{"content":"Custom","isGW":true}]</item>
        <item key="EXO 2:4">bad-json</item>
    </custom-verses-map>
</bible>`;

        const result = await xmlTextToJson(xmlText);

        expect(result).toEqual({
            books: {
                EXO: {
                    2: {
                        3: 'Let my people go',
                    },
                },
                GEN: {
                    1: {
                        1: 'In the beginning',
                    },
                },
            },
            customVersesMap: {
                'EXO 2:3': [{ content: 'Custom', isGW: true }],
            },
            info: {
                booksAvailable: ['GEN', 'EXO'],
                copyRights: 'Copy',
                description: 'Desc',
                key: 'KJV',
                keyBookMap: {
                    EXO: 'EXODUS',
                    GEN: 'GENESIS',
                    REV: 'REVELATION',
                },
                legalNote: 'Legal',
                locale: 'km-KH',
                numbersMap: {
                    0: '0',
                    1: '១',
                    2: '2',
                    3: '3',
                    4: '4',
                    5: '5',
                    6: '6',
                    7: '7',
                    8: '8',
                    9: '9',
                },
                publisher: 'Pub',
                title: 'Test Bible',
                version: 2,
            },
            newLines: ['GEN 1:1'],
            newLinesTitleMap: {
                'GEN 1:1': [{ content: 'Title' }],
            },
        });
        expect(mocks.handleErrorMock).toHaveBeenCalledWith(
            expect.stringContaining('Fail to parse custom verses map'),
        );
    });

    test('serializes JSON data to XML, round-trips it back, and can detect malformed serialization', async () => {
        const { jsonToXMLText, xmlTextToJson } = await loadModule();
        const jsonData = {
            books: {
                GEN: {
                    1: {
                        1: 'In the beginning',
                    },
                },
                REV: {
                    22: {
                        21: 'Amen',
                    },
                },
            },
            customVersesMap: {
                'GEN 1:1': [{ content: 'Custom verse ]]> fallback' }],
            },
            info: {
                booksAvailable: ['GEN', 'REV'],
                copyRights: 'Copy',
                description: 'Desc',
                key: 'KJV',
                keyBookMap: {
                    EXO: 'Exodus',
                    GEN: 'Genesis',
                    REV: 'Revelation',
                },
                legalNote: 'Legal',
                locale: 'en-US',
                numbersMap: {
                    0: '0',
                    1: '1',
                    2: '2',
                    3: '3',
                    4: '4',
                    5: '5',
                    6: '6',
                    7: '7',
                    8: '8',
                    9: '9',
                },
                publisher: 'Pub',
                title: 'Test Bible',
                version: 2,
            },
            newLines: ['GEN 1:1'],
            newLinesTitleMap: {
                'GEN 1:1': [{ content: 'Heading <title> & body' }],
            },
        } as any;

        const xmlText = jsonToXMLText(jsonData);

        expect(xmlText).toContain('<book key="GEN">');
        expect(xmlText).toContain('<new-lines>');
        expect(xmlText).toContain('<![CDATA[');
        expect(xmlText).toContain('Heading <title> & body');
        expect(await xmlTextToJson(xmlText!)).toEqual(
            expect.objectContaining({
                books: jsonData.books,
                customVersesMap: jsonData.customVersesMap,
                newLines: ['GEN 1:1'],
                newLinesTitleMap: jsonData.newLinesTitleMap,
            }),
        );

        const { appXMLSerializer } = await import('../../helper/xmlHelpers');
        const serializeToStringSpy = vi
            .spyOn(appXMLSerializer, 'serializeToString')
            .mockReturnValue('<bible></bible>');

        try {
            expect(jsonToXMLText(jsonData)).toBeNull();
        } finally {
            serializeToStringSpy.mockRestore();
        }
    });

    test('reads bible keys from files, lists XML file mappings, and resolves bible paths', async () => {
        const {
            bibleKeyToXMLFilePath,
            getAllXMLFileKeys,
            getBibleKeyFromFile,
        } = await loadModule();

        mocks.fileTexts.set(
            '/bibles/kjv.xml',
            '<bible key="KJV"><book number="1"><chapter number="1"><verse number="1">One</verse></chapter></book></bible>',
        );
        mocks.fileTexts.set(
            '/bibles/web.xml',
            '<bible key="WEB"><book number="1"><chapter number="1"><verse number="1">One</verse></chapter></book></bible>',
        );
        mocks.fsListFilesMock.mockResolvedValue([
            'kjv.xml',
            'notes.txt',
            'web.xml',
        ]);

        expect(await getBibleKeyFromFile('/bibles/kjv.xml')).toBe('KJV');
        expect(await getBibleKeyFromFile('/bibles/kjv.xml')).toBe('KJV');
        expect(mocks.readFileDataMock).toHaveBeenCalledTimes(1);

        expect(await getAllXMLFileKeys()).toEqual({
            KJV: '/bibles/kjv.xml',
            WEB: '/bibles/web.xml',
        });
        expect(await bibleKeyToXMLFilePath('KJV')).toBe('/bibles/kjv.xml');
        expect(await bibleKeyToXMLFilePath('NEW', true)).toBe(
            '/bibles/NEW.xml',
        );
        expect(await bibleKeyToXMLFilePath('MISSING')).toBeNull();
        expect(mocks.handleErrorMock).toHaveBeenCalledWith(
            expect.stringContaining('Unable to find file path for: "MISSING"'),
        );
    });
});
