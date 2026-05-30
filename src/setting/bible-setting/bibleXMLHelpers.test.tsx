// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const dirs = new Set<string>();
    const fileInstances = new Map<string, any>();
    const files = new Map<string, string>();
    const trashedFiles: string[] = [];

    class CacheManagerMock<T> {
        private readonly store = new Map<string, T>();

        constructor(_duration?: number) {}

        async get(key: string) {
            return this.store.get(key) ?? null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }
    }

    const getInstance = (filePath: string) => {
        if (!fileInstances.has(filePath)) {
            fileInstances.set(filePath, {
                readFileData: vi.fn(async () => files.get(filePath) ?? null),
                trash: vi.fn(async () => {
                    trashedFiles.push(filePath);
                    files.delete(filePath);
                }),
                writeFileData: vi.fn(async (data: string) => {
                    files.set(filePath, data);
                    return true;
                }),
            });
        }
        return fileInstances.get(filePath);
    };

    return {
        CacheManagerMock,
        bibleKeyToXMLFilePathMock: vi.fn(),
        bookChapterValidateMock: vi.fn(),
        dirs,
        ensureDirectoryMock: vi.fn(async (dirPath: string) => {
            dirs.add(dirPath);
        }),
        fileInstances,
        files,
        fsCheckFileExistMock: vi.fn(async (filePath: string) =>
            files.has(filePath),
        ),
        fsDeleteDirMock: vi.fn(async (dirPath: string) => {
            dirs.delete(dirPath);
            for (const filePath of [...files.keys()]) {
                if (
                    filePath === dirPath ||
                    filePath.startsWith(`${dirPath}/`)
                ) {
                    files.delete(filePath);
                }
            }
        }),
        fsDeleteFileMock: vi.fn(async (filePath: string) => {
            files.delete(filePath);
        }),
        getAllXMLFileKeysMock: vi.fn(),
        getBibleInfoJsonMock: vi.fn(),
        getBibleInfoMock: vi.fn(),
        getFileMD5Mock: vi.fn(),
        getInstance,
        getMenuTitleRevealFileMock: vi.fn(() => 'Reveal in File Explorer'),
        getModelKeyBookMapMock: vi.fn(),
        getBibleModelInfoSettingMock: vi.fn(),
        handleErrorMock: vi.fn(),
        hideProgressBarMock: vi.fn(),
        infoValidateMock: vi.fn(),
        initHttpRequestMock: vi.fn(),
        jsonToXMLTextMock: vi.fn(),
        pathJoinMock: vi.fn((...parts: string[]) => parts.join('/')),
        readFileDataMock: vi.fn(
            async (filePath: string) => files.get(filePath) ?? null,
        ),
        reset() {
            dirs.clear();
            fileInstances.clear();
            files.clear();
            trashedFiles.length = 0;
        },
        showAppContextMenuMock: vi.fn(),
        showFileOrDirExplorerMock: vi.fn(),
        showProgressBarMock: vi.fn(),
        showSimpleToastMock: vi.fn(),
        trashedFiles,
        unlockingMock: vi.fn(
            async (_key: string, callback: () => Promise<unknown>) => {
                return await callback();
            },
        ),
        writeStreamToFileMock: vi.fn(),
        xmlTextToBibleElementMock: vi.fn(),
        xmlTextToJsonMock: vi.fn(),
    };
});

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToastMock,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        pathUtils: {
            basename: (filePath: string) =>
                filePath.split('/').at(-1) ?? filePath,
            resolve: (...parts: string[]) => parts.join('/'),
        },
    },
}));

vi.mock('../../helper/bible-helpers/downloadHelpers', () => ({
    initHttpRequest: mocks.initHttpRequestMock,
    writeStreamToFile: mocks.writeStreamToFileMock,
}));

vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: mocks.showFileOrDirExplorerMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: mocks.ensureDirectoryMock,
    fsCheckFileExist: mocks.fsCheckFileExistMock,
    fsDeleteDir: mocks.fsDeleteDirMock,
    fsDeleteFile: mocks.fsDeleteFileMock,
    getFileMD5: mocks.getFileMD5Mock,
    pathJoin: mocks.pathJoinMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: mocks.getBibleInfoMock,
}));

vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenuMock,
}));

vi.mock('../../helper/debuggerHelpers', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
    };
});

vi.mock('../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    fromBibleFileName: (fileName: string) => {
        const [bookKey, chapterNum] = fileName.split(' ');
        if (!bookKey || !chapterNum) {
            return null;
        }
        return { bookKey, chapterNum };
    },
    getModelKeyBookMap: mocks.getModelKeyBookMapMock,
}));

vi.mock('./bibleXMLJsonDataHelpers', () => ({
    bibleKeyToXMLFilePath: mocks.bibleKeyToXMLFilePathMock,
    getAllXMLFileKeys: mocks.getAllXMLFileKeysMock,
    getBibleInfoJson: mocks.getBibleInfoJsonMock,
    jsonToXMLText: mocks.jsonToXMLTextMock,
    xmlTextToBibleElement: mocks.xmlTextToBibleElementMock,
    xmlTextToJson: mocks.xmlTextToJsonMock,
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: mocks.getInstance,
        readFileData: mocks.readFileDataMock,
    },
}));

vi.mock('../../helper/helpers', () => ({
    getMenuTitleRevealFile: mocks.getMenuTitleRevealFileMock,
}));

vi.mock('../directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        defaultStorage: '/storage',
    },
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlockingMock,
}));

vi.mock('../../others/CacheManager', () => ({
    default: mocks.CacheManagerMock,
}));

vi.mock('../../progress-bar/progressBarHelpers', () => ({
    hideProgressBar: mocks.hideProgressBarMock,
    showProgressBar: mocks.showProgressBarMock,
}));

vi.mock('./schemas/bibleSchemaHelpers', () => ({
    bookChapterEditorSchemaHandler: {
        validate: mocks.bookChapterValidateMock,
    },
    infoEditorSchemaHandler: {
        validate: mocks.infoValidateMock,
    },
}));

vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    getBibleModelInfoSetting: mocks.getBibleModelInfoSettingMock,
}));

async function loadModule() {
    return await import('./bibleXMLHelpers');
}

function createFormWithInput(name: string, value = '') {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.appendChild(input);
    return { form, input };
}

describe('bibleXMLHelpers', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mocks.reset();

        mocks.bibleKeyToXMLFilePathMock.mockImplementation(
            async (bibleKey: string, isFromFileName = false) => {
                if (isFromFileName) {
                    return `/bibles/${bibleKey}.xml`;
                }
                if (bibleKey === 'MISSING') {
                    return null;
                }
                return `/bibles/${bibleKey}.xml`;
            },
        );
        mocks.getAllXMLFileKeysMock.mockResolvedValue({});
        mocks.getBibleInfoMock.mockResolvedValue(null);
        mocks.getBibleInfoJsonMock.mockResolvedValue({
            key: 'KJV',
            title: 'Bible',
        });
        mocks.getFileMD5Mock.mockResolvedValue('abc123');
        mocks.getModelKeyBookMapMock.mockReturnValue({
            EXO: 'Exodus',
            GEN: 'Genesis',
        });
        mocks.getBibleModelInfoSettingMock.mockReturnValue('model-1');
        mocks.infoValidateMock.mockReturnValue({ valid: true });
        mocks.bookChapterValidateMock.mockReturnValue({ valid: true });
        mocks.initHttpRequestMock.mockResolvedValue({ ok: true });
        mocks.writeStreamToFileMock.mockImplementation(
            (
                filePath: string,
                callbacks: {
                    onDone: (error: unknown, filePath: string) => void;
                    onProgress: (progress: number) => void;
                    onStart: (total: number) => void;
                },
            ) => {
                mocks.files.set(filePath, '<bible key="KJV" />');
                callbacks.onStart(1.25);
                callbacks.onProgress(0.5);
                callbacks.onDone(null, filePath);
            },
        );
        mocks.xmlTextToJsonMock.mockResolvedValue({
            books: {
                GEN: {
                    1: {
                        1: 'One',
                    },
                },
            },
            customVersesMap: {},
            info: {
                key: 'KJV',
                keyBookMap: {
                    GEN: 'Genesis',
                },
            },
            newLines: [],
            newLinesTitleMap: {},
        });
        mocks.xmlTextToBibleElementMock.mockReturnValue(
            document.createElement('bible'),
        );

        class MockFileReader {
            onerror: ((error: unknown) => void) | null = null;
            onload:
                | ((event: { target?: { result: string | null } }) => void)
                | null = null;

            readAsText(file: any) {
                if (file.__shouldError) {
                    this.onerror?.(new Error('read failed'));
                    return;
                }
                this.onload?.({ target: { result: file.__text ?? null } });
            }
        }

        Object.defineProperty(globalThis, 'FileReader', {
            configurable: true,
            value: MockFileReader,
        });
    });

    test('reads named inputs, validates URLs, and reads uploaded files', async () => {
        const { checkIsValidUrl, getInputByName, readFromFile } =
            await loadModule();
        const { form, input } = createFormWithInput('file');
        const messages: Array<string | null> = [];

        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [{ __text: '<bible />' }],
        });

        expect(getInputByName(form, 'file')).toBe(input);
        expect(getInputByName(form, 'missing')).toBeNull();
        expect(checkIsValidUrl('https://example.com/test.xml')).toBe(true);
        expect(checkIsValidUrl('not a url')).toBe(false);
        expect(
            await readFromFile(form, (message) => {
                messages.push(message);
            }),
        ).toBe('<bible />');
        expect(messages).toEqual(['Reading file...', null]);

        const { form: emptyForm } = createFormWithInput('file');
        expect(await readFromFile(emptyForm, vi.fn())).toBeNull();

        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [{ __shouldError: true }],
        });
        await expect(readFromFile(form, vi.fn())).rejects.toThrow(
            'Error during reading file',
        );
        expect(mocks.handleErrorMock).toHaveBeenCalled();
    });

    test('downloads XML from a URL, reads it, deletes the temp file, and reports failures', async () => {
        const { readFromUrl } = await loadModule();
        const { form } = createFormWithInput('url', 'https://example.com/kjv');
        const messages: Array<string | null> = [];

        await expect(
            readFromUrl(form, (message) => {
                messages.push(message);
            }),
        ).resolves.toBe('<bible key="KJV" />');

        expect(mocks.initHttpRequestMock).toHaveBeenCalledWith(
            new URL('https://example.com/kjv'),
        );
        expect(mocks.fsDeleteFileMock).toHaveBeenCalledWith(
            '/storage/temp-xml/kjv.xml',
        );
        expect(messages).toContain('Downloading file...');
        expect(messages.at(-1)).toBeNull();
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Download Completed',
            'File saved at: /storage/temp-xml/kjv.xml',
        );

        mocks.initHttpRequestMock.mockRejectedValueOnce(new Error('offline'));

        await expect(readFromUrl(form, vi.fn())).resolves.toBeNull();
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Error occurred during download "https://example.com/kjv"',
            'Error: Error: offline',
        );
    });

    test('reads XML info, collects cached bible info list, writes XML text, and trashes XML files', async () => {
        const {
            deleteBibleXML,
            getBibleXMLCacheInfoList,
            getBibleXMLInfo,
            saveXMLText,
        } = await loadModule();

        mocks.files.set('/bibles/KJV.xml', '<bible key="KJV" />');
        mocks.getAllXMLFileKeysMock.mockResolvedValue({
            KJV: '/bibles/KJV.xml',
            WEB: '/bibles/WEB.xml',
        });
        mocks.getBibleInfoMock
            .mockResolvedValueOnce({ key: 'KJV', title: 'Bible 1' })
            .mockResolvedValueOnce(null);

        expect(await getBibleXMLInfo('KJV')).toEqual({
            key: 'KJV',
            title: 'Bible',
        });
        expect(mocks.getBibleInfoJsonMock).toHaveBeenCalledWith(
            '<bible key="KJV" />',
        );
        expect(mocks.xmlTextToBibleElementMock).not.toHaveBeenCalled();

        mocks.getBibleInfoJsonMock.mockResolvedValueOnce(null);
        expect(await getBibleXMLInfo('KJV')).toBeNull();

        expect(await getBibleXMLCacheInfoList()).toEqual([
            { key: 'KJV', title: 'Bible 1' },
        ]);

        expect(await saveXMLText('KJV', '<bible key="KJV" />')).toBe(true);
        expect(mocks.files.get('/bibles/KJV.xml')).toBe('<bible key="KJV" />');
        mocks.bibleKeyToXMLFilePathMock.mockResolvedValueOnce(null);
        expect(await saveXMLText('MISSING', '<bible />')).toBe(false);

        await deleteBibleXML('KJV');
        expect(mocks.trashedFiles).toContain('/bibles/KJV.xml');
    });

    test('opens context menu actions and invalidates bible XML cache folders', async () => {
        const { handBibleKeyContextMenuOpening } = await loadModule();

        handBibleKeyContextMenuOpening('KJV', { type: 'contextmenu' });

        const items = mocks.showAppContextMenuMock.mock.calls[0]?.[1];

        expect(items).toHaveLength(2);
        expect(items[0]?.menuElement).toBe('Reveal in File Explorer');
        expect(items[1]?.menuElement).toBe('Clear Cache');

        await items[0]?.onSelect();
        expect(mocks.showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/bibles/KJV.xml',
        );

        items[1]?.onSelect();
        await Promise.resolve();
        await Promise.resolve();
    });

    test('uses backup and fresh cache paths when reading cached XML data and chapter data', async () => {
        const { getBibleXMLDataFromKeyCaching, readBibleXMLData } =
            await loadModule();
        const backupData = {
            books: {},
            customVersesMap: {},
            info: { key: 'KJV' },
            newLines: [],
            newLinesTitleMap: {},
        };

        mocks.files.set(
            '/bibles/KJV.xml.cache/all',
            JSON.stringify({
                _bibleModel: 'model-1',
                _cachingTime: Date.now(),
                value: backupData,
            }),
        );

        expect(await getBibleXMLDataFromKeyCaching('KJV')).toEqual(backupData);
        expect(mocks.xmlTextToJsonMock).not.toHaveBeenCalled();

        vi.resetModules();
        const reloadedModule = await loadModule();

        mocks.files.clear();
        mocks.files.set('/bibles/KJV.xml', '<bible key="KJV" />');
        mocks.xmlTextToJsonMock.mockResolvedValue({
            books: {
                GEN: {
                    1: {
                        1: 'Verse 1',
                        2: 'Verse 2',
                    },
                },
            },
            customVersesMap: {
                'GEN 1:1': [{ content: 'Custom' }],
                'EXO 1:1': [{ content: 'Ignore' }],
            },
            info: {
                key: 'KJV',
                keyBookMap: {
                    GEN: 'Genesis',
                },
            },
            newLines: ['GEN 1:1', 'EXO 1:1'],
            newLinesTitleMap: {
                'GEN 1:1': [{ content: 'Heading' }],
                'EXO 1:1': [{ content: 'Other' }],
            },
        });

        expect(
            await reloadedModule.getBibleXMLDataFromKeyCaching('KJV'),
        ).toEqual(
            expect.objectContaining({
                books: {
                    GEN: {
                        1: {
                            1: 'Verse 1',
                            2: 'Verse 2',
                        },
                    },
                },
            }),
        );
        expect(
            await reloadedModule.getBibleXMLDataFromKeyCaching('KJV'),
        ).toEqual(
            expect.objectContaining({
                info: { key: 'KJV', keyBookMap: { GEN: 'Genesis' } },
            }),
        );
        expect(mocks.xmlTextToJsonMock).toHaveBeenCalledTimes(1);
        expect(mocks.files.has('/bibles/KJV.xml.cache/all')).toBe(true);

        expect(await reloadedModule.readBibleXMLData('KJV', '_info')).toEqual({
            key: 'KJV',
            keyBookMap: { GEN: 'Genesis' },
        });
        expect(await reloadedModule.readBibleXMLData('KJV', 'GEN 1')).toEqual({
            customVersesMap: {
                'GEN 1:1': [{ content: 'Custom' }],
            },
            newLines: ['GEN 1:1'],
            newLinesTitleMap: {
                'GEN 1:1': [{ content: 'Heading' }],
            },
            title: 'Genesis 1',
            verses: {
                1: 'Verse 1',
                2: 'Verse 2',
            },
        });
        expect(await reloadedModule.readBibleXMLData('KJV', 'BAD')).toBeNull();
    });

    test('saves JSON back to XML, reads XML data, and updates bible info with fallbacks', async () => {
        const {
            getBibleXMLDataFromKey,
            saveJsonDataToXMLfile,
            updateBibleXMLInfo,
        } = await loadModule();
        const jsonData = {
            books: {},
            customVersesMap: {},
            info: {
                key: 'KJV',
                keyBookMap: { GEN: 'Genesis' },
            },
            newLines: [],
            newLinesTitleMap: {},
        };

        mocks.jsonToXMLTextMock.mockReturnValue(null);
        expect(await saveJsonDataToXMLfile(jsonData as any)).toBe(false);
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Error',
            'Error occurred during saving to XML',
        );

        mocks.jsonToXMLTextMock.mockReturnValue('<bible key="KJV" />');
        expect(await saveJsonDataToXMLfile(jsonData as any)).toBe(true);
        expect(mocks.files.get('/bibles/KJV.xml')).toBe('<bible key="KJV" />');
        expect(mocks.fsDeleteDirMock).toHaveBeenCalledWith(
            '/bibles/KJV.xml.cache',
        );
        expect(mocks.ensureDirectoryMock).toHaveBeenCalledWith(
            '/bibles/KJV.xml.cache',
        );
        expect(mocks.files.has('/bibles/KJV.xml.cache/abc123')).toBe(true);

        mocks.files.set('/bibles/KJV.xml', '<bible key="KJV" />');
        mocks.xmlTextToJsonMock.mockResolvedValueOnce(jsonData);
        expect(await getBibleXMLDataFromKey('KJV')).toEqual(jsonData);
        mocks.bibleKeyToXMLFilePathMock.mockResolvedValueOnce(null);
        expect(await getBibleXMLDataFromKey('MISSING')).toBeNull();

        mocks.bibleKeyToXMLFilePathMock.mockImplementation(
            async (bibleKey: string, isFromFileName = false) => {
                if (isFromFileName) {
                    return `/bibles/${bibleKey}.xml`;
                }
                return `/bibles/${bibleKey}.xml`;
            },
        );
        mocks.files.set('/bibles/OLD.xml', '<bible key="OLD" />');
        mocks.xmlTextToJsonMock.mockResolvedValueOnce(null);
        expect(
            await updateBibleXMLInfo(
                { key: 'OLD', keyBookMap: {} } as any,
                { key: 'NEW', keyBookMap: {} } as any,
            ),
        ).toBe(false);
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Error',
            'Error occurred during reading file',
        );

        mocks.xmlTextToJsonMock.mockResolvedValueOnce({
            ...jsonData,
            info: { key: 'OLD', keyBookMap: { GEN: 'Genesis' } },
        });
        expect(
            await updateBibleXMLInfo(
                { key: 'OLD', keyBookMap: { GEN: 'Genesis' } } as any,
                { key: 'NEW' } as any,
            ),
        ).toBe(true);
        expect(mocks.jsonToXMLTextMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                info: expect.objectContaining({
                    key: 'NEW',
                    keyBookMap: {
                        EXO: 'Exodus',
                        GEN: 'Genesis',
                    },
                }),
            }),
        );
    });
});
